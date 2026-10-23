// BackgroundKeeper, Dialog, Keychain and Storage are Scripting globals, not module exports.
import { LiveActivity, Script } from "scripting"
import { ChaxterActivity } from "./live_activity"
import { callApi } from "./api"
import { startSilentAudio } from "./audio"
import { BACKGROUND_POLLING, DEBUG_KEY, FLASH_MS, LAST_STATE_KEY, POLL_DEBUG_KEY, RUNNER_KEY, SHARED, TAP_KEY, clearToken, clock, isToken, readToken, saveToken, type ChaxterState } from "./config"

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

async function main() {
  const lastIntent = Storage.get<string>(DEBUG_KEY, SHARED)
  if (lastIntent) console.log(`Letzter Knopf-Tipp: ${lastIntent}`)
  const lastPoll = Storage.get<string>(POLL_DEBUG_KEY, SHARED)
  if (lastPoll) console.log(`Letzte Abfrage im Hintergrund: ${lastPoll}`)
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
  if (!await activity.start(first.state)) {
    await Dialog.alert({ title: "ChaxterLog", message: "Live Activity konnte nicht gestartet werden. Live-Aktivitäten für Scripting in den Einstellungen erlauben." })
    return
  }

  // Without PRO the script ends here; the activity stays and updates on every tap.
  // With BACKGROUND_POLLING (needs Scripting PRO) changes by other staff also arrive on their own.
  if (!BACKGROUND_POLLING) return
  if (!await BackgroundKeeper.keepAlive()) {
    await activity.update({ ...first.state, message: "Hintergrundbetrieb nicht verfügbar (Scripting PRO)." })
    return
  }
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
      if (shown(next.state) !== shown(current)) await activity.update(next.state)
    }
  } finally {
    await stopAudio?.()
    await BackgroundKeeper.stopKeepAlive()
  }
}

main().finally(() => Script.exit())
