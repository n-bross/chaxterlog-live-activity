// BackgroundKeeper, Dialog, Keychain and Storage are Scripting globals, not module exports.
import { LiveActivity, Script } from "scripting"
import { ChaxterActivity } from "./live_activity"
import { callApi } from "./api"
import { LAST_STATE_KEY, clearToken, isToken, readToken, saveToken, type ChaxterState } from "./config"

const POLL_MS = 15_000
const MAX_RUNTIME_MS = 8 * 60 * 60 * 1000 // iOS ends Live Activities after 8 hours anyway.
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms))
// Compares totals and change time only, so the "Stand" time shows the last real update, not every poll.
const totals = ({ refreshedAt: _, ...rest }: ChaxterState) => JSON.stringify(rest)

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
  if (!await ensureToken()) return
  const first = await callApi("/today")
  if (!first.ok) {
    // A rejected token is removed, so the next run asks for a new one.
    if (first.status === 401) clearToken()
    await Dialog.alert({ title: "ChaxterLog", message: first.message })
    return
  }
  Storage.set(LAST_STATE_KEY, first.state)

  // One activity at a time: a new run replaces the previous one.
  try { await LiveActivity.endAllActivities() } catch { /* nothing running */ }
  const activity = ChaxterActivity()
  if (!await activity.start(first.state)) {
    await Dialog.alert({ title: "ChaxterLog", message: "Live Activity konnte nicht gestartet werden. Live-Aktivitäten für Scripting in den Einstellungen erlauben." })
    return
  }

  // Changes by other staff only arrive by polling. Without background time (Scripting PRO)
  // the activity still updates after its own button taps.
  if (!await BackgroundKeeper.keepAlive()) return
  try {
    let last = totals(first.state)
    const stopAt = Date.now() + MAX_RUNTIME_MS
    while (Date.now() < stopAt) {
      await sleep(POLL_MS)
      const running = await LiveActivity.getAllActivities()
      if (!running.some((detail) => detail.state === "active")) break
      const next = await callApi("/today")
      if (!next.ok) continue
      Storage.set(LAST_STATE_KEY, next.state)
      if (totals(next.state) !== last) { last = totals(next.state); await activity.update(next.state) }
    }
  } finally {
    await BackgroundKeeper.stopKeepAlive()
  }
}

main().finally(() => Script.exit())
