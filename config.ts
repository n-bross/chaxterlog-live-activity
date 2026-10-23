// Shared constants and state. This file must not import live_activity.tsx or app_intents.tsx:
// Scripting re-runs an entry file it reaches through an import cycle, and a second
// LiveActivity.register call with the same name throws.

export const BASE_URL = "https://chaxterlog.jufo-grafing.de/api/v1"
export const ACTIVITY_NAME = "ChaxterLogActivity"
const TOKEN_KEY = "chaxterlog.token"
// Storage is only visible to Live Activities and intents with the shared option.
export const SHARED = { shared: true }
export const LAST_STATE_KEY = "chaxterlog.lastState"
export const DEBUG_KEY = "chaxterlog.debug"

export type ChaxterState = {
  u15: number
  o15: number
  total: number
  // "HH:MM:SS" of the team's last change and of the last fetch; strings keep the state JSON-safe.
  changedAt: string
  refreshedAt: string
  message: string
}

// The token lives in this script's Keychain, never in the code or the repository.
export const readToken = () => Keychain.get(TOKEN_KEY)
export const saveToken = (token: string) => Keychain.set(TOKEN_KEY, token)
export const clearToken = () => Keychain.remove(TOKEN_KEY)
export const isToken = (value: string) => /^chx_[0-9a-f]{64}$/.test(value)

const pad = (value: number) => String(value).padStart(2, "0")
export const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
