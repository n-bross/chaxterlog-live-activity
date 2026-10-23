// BackgroundKeeper, Dialog, Keychain and Storage are Scripting globals.
// Notification is a module export and must be imported explicitly.
import { LiveActivity, Notification, Script } from "scripting"
import { ChaxterActivity } from "./live_activity"
import { callApi } from "./api"
import { startSilentAudio } from "./audio"
import { openZeusObserved, copyZeusObservation } from "./zeus-flow"
import {
  ACTIVITY_NAME, BACKGROUND_POLLING, DEBUG_KEY, FLASH_MS, LAST_STATE_KEY, POLL_DEBUG_KEY, REMINDER_MINUTES, RUNNER_KEY, SHARED, TAP_KEY,
  clearArrival, clearToken, clock, clockInPending, clockOutLink, clockOutPending, isToken, markArrived, markClockedIn, markClockedOut, readToken, saveToken, withClockIn, type ChaxterState,
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
// "?clockIn=1" / "?clockOut=1" from the buttons and the reminders. URL values arrive as strings.
const flag = (value: unknown) => value === true || value === "1" || value === "true"

async function updateRunning(state: ChaxterState) {
  for (const detail of await LiveActivity.getAllActivities()) {
    if (detail.state !== "active") continue
    await (await LiveActivity.from(detail.id, ACTIVITY_NAME))?.update(withClockIn(state))
  }
}

// Arriving shows the Einstempeln button and schedules the reminders, unless today is already done.
async function arrive() {
  const link = Script.createRunSingleURLScheme(Script.name, { clockIn: "1" })
  markArrived(link, Script.createRunSingleURLScheme(Script.name, { clockOut: "1" }))
  try {
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
  } catch (error) {
    console.log(`Erinnerungen nicht verfügbar: ${String(error)}`)
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

async function clockOut() {
  markClockedOut()
  clearArrival()
  Storage.set(RUNNER_KEY, "", SHARED)
  // Ending alone can leave the activity visible on the Lock Screen for hours.
  await LiveActivity.endAllActivities({ dismissTimeInterval: 0 })
  try {
    await Notification.removeAllPendingsOfCurrentScript()
    await Notification.removeAllDeliveredsOfCurrentScript()
  } catch (error) {
    console.log(`Erinnerungen nicht verfügbar: ${String(error)}`)
  }
}

async function openTimeTracking(action: "in" | "out") {
  if (!await openZeusObserved(action)) return false
  if (action === "in") await clockIn()
  else await clockOut()
  return true
}

async function resumePolling() {
  const last = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED)
  const running = (await LiveActivity.getAllActivities()).find((detail) => detail.state === "active")
  if (last && running) {
    const activity = await LiveActivity.from(running.id, ACTIVITY_NAME)
    if (activity) await keepPolling(activity, last)
  }
}

// Leaving ends the activity, unless today's clock-out is still open: then the activity stays with
// the Ausstempeln button and one reminder goes out. Stamping itself only happens on a tap.
async function leave() {
  Storage.set(RUNNER_KEY, "", SHARED)
  clearArrival()
  const pending = clockOutPending()
  // The button must change even when notification permission is denied or scheduling fails.
  if (pending) {
    const last = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED)
    if (last) await updateRunning(last)
  } else {
    try { await LiveActivity.endAllActivities({ dismissTimeInterval: 0 }) } catch { /* nothing running */ }
  }
  try {
    await Notification.removeAllPendingsOfCurrentScript()
    if (pending) {
      await Notification.schedule({
        title: "Ausstempeln nicht vergessen",
        body: "Du hast die Arbeit verlassen. Tippen zum Ausstempeln.",
        interruptionLevel: "timeSensitive",
        tapAction: { type: "openURL", url: clockOutLink() },
      })
    }
  } catch (error) {
    console.log(`Erinnerungen nicht verfügbar: ${String(error)}`)
  }
}

async function main() {
  const params = Script.queryParameters ?? {}
  if (flag(params.zeusLog)) {
    await copyZeusObservation()
    return resumePolling()
  }
  if (flag(params.leave)) return leave()
  const clockingIn = flag(params.clockIn)
  const clockingOut = flag(params.clockOut)
  // A button tap updates the existing activity without needing the count API or restarting it.
  if (clockingIn) {
    await openTimeTracking("in")
    // run_single replaced the old runner, so resume updates on the existing activity.
    await resumePolling()
    return
  }
  if (clockingOut) return openTimeTracking("out")
  if (flag(params.arrive) || Object.keys(params).length === 0) await arrive()
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
  try { await LiveActivity.endAllActivities({ dismissTimeInterval: 0 }) } catch { /* nothing running */ }
  const activity = ChaxterActivity()
  if (!await activity.start(withClockIn(first.state))) {
    await Dialog.alert({ title: "ChaxterLog", message: "Live Activity konnte nicht gestartet werden. Live-Aktivitäten für Scripting in den Einstellungen erlauben." })
    return
  }

  await keepPolling(activity, first.state, runner)
}

async function keepPolling(
  activity: { update: (state: ChaxterState) => Promise<unknown> },
  first: ChaxterState,
  runner = `${Date.now()}-${Math.random()}`,
) {
  Storage.set(RUNNER_KEY, runner, SHARED)
  // Without PRO the script ends here; the activity stays and updates on every tap.
  // With BACKGROUND_POLLING (needs Scripting PRO) changes by other staff also arrive on their own.
  if (!BACKGROUND_POLLING) return
  if (!await BackgroundKeeper.keepAlive()) {
    await activity.update(withClockIn({ ...first, message: "Hintergrundbetrieb nicht verfügbar (Scripting PRO)." }))
    return
  }
  // While this run is alive, the Einstempeln button and the reminders reach it here instead of
  // starting a second run.
  const stopListening = Script.onResume(async ({ queryParameters }) => {
    if (flag(queryParameters?.leave)) return leave()
    if (flag(queryParameters?.arrive)) {
      await arrive()
      const last = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED)
      if (last) await updateRunning(last)
    }
    // Compatibility for links stored by older versions; new links always start a fresh run.
    if (flag(queryParameters?.clockIn)) await openTimeTracking("in")
    if (flag(queryParameters?.clockOut)) await openTimeTracking("out")
    if (flag(queryParameters?.zeusLog)) await copyZeusObservation()
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
      if (Storage.get<string>(RUNNER_KEY, SHARED) !== runner) break
      if (!next.ok || Date.now() - tappedAt < FLASH_MS + 1000) continue
      const current = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED) ?? first
      Storage.set(LAST_STATE_KEY, next.state, SHARED)
      if (shown(next.state) !== shown(current)) await activity.update(withClockIn(next.state))
    }
  } finally {
    stopListening()
    await stopAudio?.()
    await BackgroundKeeper.stopKeepAlive()
  }
}

main().catch(async (error) => {
  const message = String(error)
  Storage.set(DEBUG_KEY, `ChaxterLog 1.3.3: ${message}`, SHARED)
  await Dialog.alert({ title: "ChaxterLog konnte nicht fortfahren", message: `Version 1.3.3\n${message}` })
}).finally(() => Script.exit())
