import { AppIntentManager, AppIntentProtocol, LiveActivity } from "scripting";
import { BASE_URL, TOKEN, ACTIVITY_NAME } from "./live_activity";

async function apiCall(endpoint: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return await response.json();
}

async function updateAllRunning(res: any) {
  const activities = await LiveActivity.getAllActivities();
  for (const act of activities) {
    if (act.state === "active") {
      const handle = LiveActivity.from(act.id, ACTIVITY_NAME);
      await handle.update({
        u15: res.u15 ?? 0,
        o15: res.o15 ?? 0,
        total: res.total ?? 0,
        lastUpdate: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      });
    }
  }
}

export const CountIntent = AppIntentManager.register({
  name: "ChaxterCountIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (params: { group: "u15" | "o15" }) => {
    if (!params?.group) return;
    const res = await apiCall("/visit", "POST", { group: params.group });
    if (!res.error) {
      await updateAllRunning(res);
    }
  },
});

export const UndoIntent = AppIntentManager.register({
  name: "ChaxterUndoIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (_params: Record<string, unknown>) => {
    const res = await apiCall("/undo", "POST", {});
    if (!res.error) {
      await updateAllRunning(res);
    }
  },
});
