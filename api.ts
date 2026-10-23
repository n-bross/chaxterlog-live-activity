import { BASE_URL, clock, readToken, type ChaxterState } from "./config"

export type ApiResult = { ok: true; state: ChaxterState; text: string } | { ok: false; status: number; message: string }

// One request helper for the app, the intents and the polling loop. Every ChaxterLog
// response carries today's totals, so each call yields a complete Live Activity state.
export async function callApi(path: "/today" | "/visit" | "/undo", method: "GET" | "POST" = "GET", body?: Record<string, unknown>): Promise<ApiResult> {
  const token = readToken()
  if (!token) return { ok: false, status: 401, message: "Kein Token gespeichert. Skript in Scripting starten." }
  try {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await response.json()
    if (!response.ok) return { ok: false, status: response.status, message: String(data?.text ?? data?.error ?? `Fehler ${response.status}`) }
    return {
      ok: true,
      text: String(data.text ?? ""),
      state: {
        u15: Number(data.u15 ?? 0),
        o15: Number(data.o15 ?? 0),
        total: Number(data.total ?? 0),
        changedAt: data.updatedAt ? clock(new Date(data.updatedAt)) : "–",
        refreshedAt: clock(new Date()),
        message: "",
      },
    }
  } catch {
    return { ok: false, status: 0, message: "Keine Verbindung zu ChaxterLog." }
  }
}
