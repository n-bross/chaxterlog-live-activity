import { LiveActivity, Notification, Script } from "scripting"
import {
  ACTIVITY_NAME, LAST_STATE_KEY, REMINDER_MINUTES, RUNNER_KEY, SHARED,
  clearArrival, clockInPending, clockOutPending, markArrived, withClockIn, type ChaxterState,
} from "./config"

// These finite operations also run in the Shortcuts extension while the phone is locked.
// No app launch, dialog, network request, polling or LiveActivity.start belongs here.
export async function updateRunning(state: ChaxterState) {
  const running = (await LiveActivity.getAllActivities()).filter(({ state }) => state === "active" || state === "stale")
  if (running.length === 0) return 0
  // index.tsx has already registered the builder. The separate intent host has not.
  if (Script.env === "intent") await import("./live_activity")
  let updated = 0
  for (const detail of running) {
    const activity = await LiveActivity.from<ChaxterState>(detail.id, ACTIVITY_NAME)
    if (activity && await activity.update(withClockIn(state))) updated++
  }
  return updated
}

async function updateLastState() {
  try {
    const last = Storage.get<ChaxterState>(LAST_STATE_KEY, SHARED)
    return last ? await updateRunning(last) : 0
  } catch (error) {
    console.log(`Live Activity nicht aktualisiert: ${String(error)}`)
    return 0
  }
}

async function clearReminders() {
  // Each cleanup is independent: a cleanup failure must not prevent a new reminder.
  try { await Notification.removeAllPendingsOfCurrentScript() } catch (error) { console.log(String(error)) }
  try { await Notification.removeAllDeliveredsOfCurrentScript() } catch (error) { console.log(String(error)) }
}

async function notify(title: string, body: string, url: string, minutes?: number) {
  try {
    return await Notification.schedule({
      title, body, interruptionLevel: "timeSensitive",
      ...(minutes == null ? {} : { trigger: new TimeIntervalNotificationTrigger({ timeInterval: minutes * 60, repeats: false }) }),
      tapAction: { type: "openURL", url },
    })
  } catch (error) {
    console.log(`Erinnerung nicht verfügbar: ${String(error)}`)
    return false
  }
}

export async function arrive(background = false) {
  markArrived(
    Script.createRunSingleURLScheme(Script.name, { clockIn: "1" }),
    Script.createRunSingleURLScheme(Script.name, { clockOut: "1" }),
  )
  const updated = await updateLastState()
  await clearReminders()
  const pending = clockInPending()
  let notificationsScheduled = true
  if (pending) {
    // A notification tap can enter the foreground and start a missing activity. Linking directly
    // to clockIn would open ZeusX but leave the user without an activity afterwards.
    const link = Script.createRunSingleURLScheme(Script.name, { arrive: "1" })
    if (background) notificationsScheduled = await notify(
      "Einstempeln nicht vergessen", "Tippen, um ChaxterLog zu öffnen und die Live Activity zu starten.", link,
    )
    for (const minutes of REMINDER_MINUTES) {
      const scheduled = await notify("Einstempeln nicht vergessen", `Du bist seit ${minutes} Minuten in der Arbeit. Tippen, um ChaxterLog zu öffnen.`, link, minutes)
      notificationsScheduled = scheduled && notificationsScheduled
    }
  }
  return { pending, updated, notificationsScheduled }
}

export async function leave() {
  Storage.set(RUNNER_KEY, "", SHARED)
  clearArrival()
  const pending = clockOutPending()
  const updated = pending ? await updateLastState() : 0
  if (!pending) {
    try { await LiveActivity.endAllActivities({ dismissTimeInterval: 0 }) } catch (error) { console.log(`Live Activity nicht beendet: ${String(error)}`) }
  }
  await clearReminders()
  // Generate the link even if arrival never ran (for example after updating the script).
  const notificationsScheduled = !pending || await notify(
    "Ausstempeln nicht vergessen", "Du hast die Arbeit verlassen. Tippen zum Ausstempeln.",
    Script.createRunSingleURLScheme(Script.name, { clockOut: "1" }),
  )
  return { pending, updated, notificationsScheduled }
}
