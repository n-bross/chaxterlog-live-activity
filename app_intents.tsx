import { AppIntentManager, AppIntentProtocol, LiveActivity } from "scripting"
import { callApi, type ApiResult } from "./api"
import { ACTIVITY_NAME, DEBUG_KEY, FLASH_MS, LAST_STATE_KEY, SHARED, clock, type ChaxterState, type Flash } from "./config"

// No static import of ./live_activity: it imports this file, and the cycle would register the
// activity twice. The intent host still needs the registered builder before LiveActivity.from can
// update anything, so it is loaded lazily here, after both modules have finished initialising.
async function loadBuilder() {
  try { await import("./live_activity") } catch (error) { debug(`Builder: ${String(error)}`) }
}

// The last intent run, readable from index.tsx ("Diagnose") when an update does not show up.
function debug(message: string) {
  Storage.set(DEBUG_KEY, `${clock(new Date())} ${message}`, SHARED)
}

async function updateAll(state: ChaxterState) {
  let updated = 0
  for (const detail of await LiveActivity.getAllActivities()) {
    if (detail.state !== "active") continue
    const activity = await LiveActivity.from(detail.id, ACTIVITY_NAME)
    if (activity) { await activity.update(state); updated++ }
  }
  return updated
}

// Shows the result with the tapped button highlighted, then the same totals without the highlight,
// so every confirmed tap is visible as a short flash.
async function showResult(result: ApiResult, flash: Flash) {
  // On failure only the message line changes; the last known totals stay visible.
  const last = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED)
  const state: ChaxterState = result.ok ? result.state
    : { ...(last ?? { u15: 0, o15: 0, total: 0, changedAt: "–" }), refreshedAt: clock(new Date()), message: result.message, flash: "" }
  if (result.ok) Storage.set(LAST_STATE_KEY, state, SHARED)
  await loadBuilder()
  const updated = await updateAll({ ...state, flash: result.ok ? flash : "error" })
  debug(`${result.ok ? result.text : result.message} · aktualisiert ${updated}`)
  await new Promise<void>((resolve) => setTimeout(() => resolve(), FLASH_MS))
  await updateAll({ ...state, flash: "" })
}

export const CountIntent = AppIntentManager.register({
  name: "ChaxterCountIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async ({ group }: { group: "u15" | "o15" }) => {
    try { await showResult(await callApi("/visit", "POST", { group }), group) } catch (error) { debug(`Fehler: ${String(error)}`) }
  },
})

// Fetches the current totals without counting, so changes by other staff show up on demand.
export const RefreshIntent = AppIntentManager.register({
  name: "ChaxterRefreshIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (_params: undefined) => {
    try { await showResult(await callApi("/today"), "refresh") } catch (error) { debug(`Fehler: ${String(error)}`) }
  },
})

export const UndoIntent = AppIntentManager.register({
  name: "ChaxterUndoIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (_params: undefined) => {
    try { await showResult(await callApi("/undo", "POST", {}), "undo") } catch (error) { debug(`Fehler: ${String(error)}`) }
  },
})
