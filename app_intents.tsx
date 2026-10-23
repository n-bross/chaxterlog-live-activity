import { AppIntentManager, AppIntentProtocol, LiveActivity } from "scripting"
import { callApi, type ApiResult } from "./api"
import { ACTIVITY_NAME, DEBUG_KEY, FLASH_MS, LAST_STATE_KEY, SHARED, TAP_KEY, clock, type ChaxterState, type Flash } from "./config"

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

// Runs one tap as fast as possible: the request starts first, the activity shows the expected result
// right away, then the server's totals replace it. The highlight is cleared without making the intent
// wait, so the next tap is not held up.
async function runTap(request: Promise<ApiResult>, flash: Flash) {
  const tap = `${Date.now()}-${Math.random()}`
  Storage.set(TAP_KEY, tap, SHARED)
  const last = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED)
  await loadBuilder()
  if (last) {
    // Expected result, stored too, so quick follow-up taps build on it.
    const expected: ChaxterState = flash === "u15" || flash === "o15"
      ? { ...last, [flash]: last[flash] + 1, total: last.total + 1, flash, message: "" }
      : { ...last, flash, message: "" }
    Storage.set(LAST_STATE_KEY, expected, SHARED)
    await updateAll(expected)
  }
  const result = await request
  // On failure the last known totals come back with the error underneath.
  const state: ChaxterState = result.ok ? result.state
    : { ...(last ?? { u15: 0, o15: 0, total: 0, changedAt: "–" }), refreshedAt: clock(new Date()), message: result.message, flash: "" }
  Storage.set(LAST_STATE_KEY, state, SHARED)
  const updated = await updateAll({ ...state, flash: result.ok ? flash : "error" })
  debug(`${result.ok ? result.text : result.message} · aktualisiert ${updated}`)
  // Only the latest tap clears the highlight, with the latest totals.
  setTimeout(() => {
    if (Storage.get<string>(TAP_KEY, SHARED) !== tap) return
    const latest = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED) ?? state
    void updateAll({ ...latest, flash: "" })
  }, FLASH_MS)
}

export const CountIntent = AppIntentManager.register({
  name: "ChaxterCountIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async ({ group }: { group: "u15" | "o15" }) => {
    try { await runTap(callApi("/visit", "POST", { group }), group) } catch (error) { debug(`Fehler: ${String(error)}`) }
  },
})

// Fetches the current totals without counting, so changes by other staff show up on demand.
export const RefreshIntent = AppIntentManager.register({
  name: "ChaxterRefreshIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (_params: undefined) => {
    try { await runTap(callApi("/today"), "refresh") } catch (error) { debug(`Fehler: ${String(error)}`) }
  },
})

export const UndoIntent = AppIntentManager.register({
  name: "ChaxterUndoIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (_params: undefined) => {
    try { await runTap(callApi("/undo", "POST", {}), "undo") } catch (error) { debug(`Fehler: ${String(error)}`) }
  },
})
