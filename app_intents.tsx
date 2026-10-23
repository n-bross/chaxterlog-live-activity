import { AppIntentManager, AppIntentProtocol, LiveActivity } from "scripting"
import { callApi, type ApiResult } from "./api"
import { ACTIVITY_NAME, LAST_STATE_KEY, clock, type ChaxterState } from "./config"

// Deliberately no import of ./live_activity: it registers the activity, and reaching it from here
// would register it a second time. Running activities are looked up by name instead.
async function showResult(result: ApiResult) {
  // On failure only the message line changes; the last known totals stay visible.
  const last = Storage.get<ChaxterState>(LAST_STATE_KEY)
  const state: ChaxterState = result.ok ? result.state
    : { ...(last ?? { u15: 0, o15: 0, total: 0, changedAt: "–" }), refreshedAt: clock(new Date()), message: result.message }
  if (result.ok) Storage.set(LAST_STATE_KEY, state)
  for (const detail of await LiveActivity.getAllActivities()) {
    if (detail.state !== "active") continue
    const activity = await LiveActivity.from(detail.id, ACTIVITY_NAME)
    if (activity) await activity.update(state)
  }
}

export const CountIntent = AppIntentManager.register({
  name: "ChaxterCountIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async ({ group }: { group: "u15" | "o15" }) => {
    await showResult(await callApi("/visit", "POST", { group }))
  },
})

export const UndoIntent = AppIntentManager.register({
  name: "ChaxterUndoIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (_params: undefined) => {
    await showResult(await callApi("/undo", "POST", {}))
  },
})
