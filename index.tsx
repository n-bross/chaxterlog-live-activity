// BackgroundKeeper, Dialog, Keychain, Notification, Safari and Storage are Scripting globals.
import { LiveActivity, Script } from "scripting"
import { ChaxterActivity } from "./live_activity"
import { callApi } from "./api"
import { startSilentAudio } from "./audio"
import {
  ACTIVITY_NAME, BACKGROUND_POLLING, CLOCK_IN_URL, DEBUG_KEY, FLASH_MS, LAST_STATE_KEY, POLL_DEBUG_KEY, REMINDER_MINUTES, RUNNER_KEY, SHARED, TAP_KEY,
  clearArrival, clearToken, clock, clockInPending, isToken, markArrived, markClockedIn, readToken, saveToken, withClockIn, type ChaxterState,
} from "./config"

const POLL_MS = 15_000
const MAX_RUNTIME_MS = 8 * 60 * 60 * 1000 // iOS ends Live Activities after 8 hours anyway.
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms))
// Compares what the activity shows, ignoring the fetch time, so an unchanged poll does not redraw.
const shown = ({ u15, o15, changedAt, message }: ChaxterState) => JSON.stringify([u15, o15, changedAt, message])

async function ensureToken() {
  if (readToken()) return true
  const input = (await Dialog.prompt({
    title: "ChaxterLog-Token",
    message: "In ChaxterLog unter Konto → Handy-Widget & Kurzbefehle einen Token erstellen und hier einfügen.",
    placeholder: "chx_…",
    obscureText: true,
    confirmLabel: "Speichern",
    cancelLabel: "Abbrechen",
  }))?.trim()
  if (!input) return false
  if (!isToken(input)) {
    await Dialog.alert({ title: "Ungültiger Token", message: "Ein ChaxterLog-Token beginnt mit chx_ und hat 68 Zeichen." })
    return false
  }
  return saveToken(input)
}

// Start links: "?arrive=1" when arriving at work (Shortcuts automation), "?leave=1" when leaving,
// "?clockIn=1" from the Einstempeln button and the reminders. URL values arrive as strings.
const flag = (value: unknown) => value === true || value === "1" || value === "true"

async function updateRunning(state: ChaxterState) {
  for (const detail of await LiveActivity.getAllActivities()) {
    if (detail.state !== "active") continue
    await (await LiveActivity.from(detail.id, ACTIVITY_NAME))?.update(withClockIn(state))
  }
}

// Arriving shows the Einstempeln button and schedules the reminders, unless today is already done.
async function arrive() {
  const link = Script.createRunURLScheme(Script.name, { clockIn: "1" })
  markArrived(link)
  await Notification.removeAllPendingsOfCurrentScript()
  if (!clockInPending()) return
  for (const minutes of REMINDER_MINUTES) {
    await Notification.schedule({
      title: "Einstempeln nicht vergessen",
      body: `Du bist seit ${minutes} Minuten in der Arbeit. Tippen zum Einstempeln.`,
      interruptionLevel: "timeSensitive",
      trigger: new TimeIntervalNotificationTrigger({ timeInterval: minutes * 60, repeats: false }),
      tapAction: { type: "openURL", url: link },
    })
  }
}

// Marks today as clocked in: the button disappears, open reminders are withdrawn.
async function clockIn() {
  markClockedIn()
  await Notification.removeAllPendingsOfCurrentScript()
  await Notification.removeAllDeliveredsOfCurrentScript()
  const last = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED)
  if (last) await updateRunning(last)
}

async function openClockIn() {
  if (CLOCK_IN_URL) await Safari.openURL(CLOCK_IN_URL)
  else await Dialog.alert({ title: "ChaxterLog", message: "Als eingestempelt markiert. Für den Link zum Zeitsystem CLOCK_IN_URL in config.ts eintragen." })
}

async function leave() {
  Storage.set(RUNNER_KEY, "", SHARED)
  clearArrival()
  await Notification.removeAllPendingsOfCurrentScript()
  try { await LiveActivity.endAllActivities() } catch { /* nothing running */ }
}

async function main() {
  const params = Script.queryParameters ?? {}
  if (flag(params.leave)) return leave()
  if (flag(params.arrive)) await arrive()
  // Clocking in through a fresh run: mark first, so the new activity starts without the button.
  const clockingIn = flag(params.clockIn)
  if (clockingIn) await clockIn()
  const lastIntent = Storage.get<string>(DEBUG_KEY, SHARED)
  if (lastIntent) console.log(`Letzter Knopf-Tipp: ${lastIntent}`)
  const lastPoll = Storage.get<string>(POLL_DEBUG_KEY, SHARED)
  if (lastPoll) console.log(`Letzte Abfrage im Hintergrund: ${lastPoll}`)
  // The exact links for the Shortcuts automations, with this script's name as installed.
  console.log(`Ankommen: ${Script.createRunSingleURLScheme(Script.name, { arrive: "1" })}`)
  console.log(`Gehen: ${Script.createRunSingleURLScheme(Script.name, { leave: "1" })}`)
  if (!await ensureToken()) return
  const first = await callApi("/today")
  if (!first.ok) {
    // A rejected token is removed, so the next run asks for a new one.
    if (first.status === 401) clearToken()
    await Dialog.alert({ title: "ChaxterLog", message: first.message })
    return
  }
  Storage.set(LAST_STATE_KEY, first.state, SHARED)

  // One activity at a time: a new run replaces the previous one and its polling loop.
  const runner = `${Date.now()}-${Math.random()}`
  Storage.set(RUNNER_KEY, runner, SHARED)
  try { await LiveActivity.endAllActivities() } catch { /* nothing running */ }
  const activity = ChaxterActivity()
  if (!await activity.start(withClockIn(first.state))) {
    await Dialog.alert({ title: "ChaxterLog", message: "Live Activity konnte nicht gestartet werden. Live-Aktivitäten für Scripting in den Einstellungen erlauben." })
    return
  }

  // Live Activities can only start while Scripting is open, so the browser opens afterwards.
  if (clockingIn) await openClockIn()

  // Without PRO the script ends here; the activity stays and updates on every tap.
  // With BACKGROUND_POLLING (needs Scripting PRO) changes by other staff also arrive on their own.
  if (!BACKGROUND_POLLING) return
  if (!await BackgroundKeeper.keepAlive()) {
    await activity.update(withClockIn({ ...first.state, message: "Hintergrundbetrieb nicht verfügbar (Scripting PRO)." }))
    return
  }
  // While this run is alive, the Einstempeln button and the reminders reach it here instead of
  // starting a second run.
  const stopListening = Script.onResume(async ({ queryParameters }) => {
    if (flag(queryParameters?.arrive)) {
      await arrive()
      const last = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED)
      if (last) await updateRunning(last)
    }
    if (flag(queryParameters?.clockIn)) {
      await clockIn()
      await openClockIn()
    }
  })
  let stopAudio: (() => Promise<void>) | null = null
  try {
    try { stopAudio = await startSilentAudio() } catch (error) { console.log(`Audio: ${String(error)}`) }
    const stopAt = Date.now() + MAX_RUNTIME_MS
    while (Date.now() < stopAt) {
      await sleep(POLL_MS)
      if (Storage.get<string>(RUNNER_KEY, SHARED) !== runner) break
      const running = await LiveActivity.getAllActivities()
      if (!running.some((detail) => detail.state === "active")) break
      const tappedAt = Number(Storage.get<string>(TAP_KEY, SHARED)?.split("-")[0] ?? 0)
      const next = await callApi("/today")
      Storage.set(POLL_DEBUG_KEY, `${clock(new Date())} ${next.ok ? `U15 ${next.state.u15} · Ü15 ${next.state.o15}` : next.message}`, SHARED)
      // A tap in progress shows its own result and highlight; the next poll catches up.
      if (!next.ok || Date.now() - tappedAt < FLASH_MS + 1000) continue
      const current = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED) ?? first.state
      Storage.set(LAST_STATE_KEY, next.state, SHARED)
      if (shown(next.state) !== shown(current)) await activity.update(withClockIn(next.state))
    }
  } finally {
    stopListening()
    await stopAudio?.()
    await BackgroundKeeper.stopKeepAlive()
  }
}

main().finally(() => Script.exit())
