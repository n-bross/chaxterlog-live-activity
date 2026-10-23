// Shared constants and state. This file must not import live_activity.tsx or app_intents.tsx:
// Scripting re-runs an entry file it reaches through an import cycle, and a second
// LiveActivity.register call with the same name throws.

export const BASE_URL = "https://chaxterlog.jufo-grafing.de/api/v1"
export const ACTIVITY_NAME = "ChaxterLogActivity"
// Polling in the background needs Scripting PRO (BackgroundKeeper); without it Scripting shows an
// upgrade dialog. Set to false to use the activity without PRO: then only taps fetch the totals.
export const BACKGROUND_POLLING = true
const TOKEN_KEY = "chaxterlog.token"
// Storage is only visible to Live Activities and intents with the shared option.
export const SHARED = { shared: true }
export const LAST_STATE_KEY = "chaxterlog.lastState"
export const DEBUG_KEY = "chaxterlog.debug"
// Time and result of the last background poll, shown in the log on the next start.
export const POLL_DEBUG_KEY = "chaxterlog.lastPoll"
export const TAP_KEY = "chaxterlog.lastTap"
// A new run of index.tsx stores its id here; an older polling loop sees the change and ends.
export const RUNNER_KEY = "chaxterlog.runner"
// How the polling loop stays awake in the background (see audio.ts): "mix" silent audio alongside
// music, "nowPlaying" silent audio as the Now Playing app (stops other music), "off" none.
export const AUDIO_MODE: "mix" | "nowPlaying" | "off" = "mix"

export type ChaxterState = {
  u15: number
  o15: number
  total: number
  // "HH:MM:SS" of the team's last change and of the last fetch; strings keep the state JSON-safe.
  changedAt: string
  refreshedAt: string
  message: string
  // Which button just succeeded ("u15", "o15", "undo", "refresh") or "error"; "" when idle.
  flash: Flash
}
export type Flash = "" | "u15" | "o15" | "undo" | "refresh" | "error"
// How long a confirmed tap stays highlighted before the activity returns to normal.
export const FLASH_MS = 1400

// The token lives in this script's Keychain, never in the code or the repository.
export const readToken = () => Keychain.get(TOKEN_KEY)
export const saveToken = (token: string) => Keychain.set(TOKEN_KEY, token)
export const clearToken = () => Keychain.remove(TOKEN_KEY)
export const isToken = (value: string) => /^chx_[0-9a-f]{64}$/.test(value)

const pad = (value: number) => String(value).padStart(2, "0")
export const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
