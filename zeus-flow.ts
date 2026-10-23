// One foreground ZeusX flow for both Live Activity buttons, with passive observation built in.
import { CLOCK_IN_URL, SHARED } from "./config"
import { OBSERVER_SCRIPT, normalizeObservation, type Observation } from "./zeus-observer"

const KEY = "chaxterlog.zeus.observation.v1"
type Capture = { schema: "zeus-observation/v1"; action: "in" | "out"; startedAt: string; records: Observation[] }

export async function copyZeusObservation() {
  const capture = Storage.get<Capture>(KEY, SHARED)
  if (!capture?.records.length) {
    await Dialog.alert({ title: "Keine ZeusX-Aufzeichnung", message: "Öffne ZeusX über Einstempeln oder Ausstempeln und führe deine reguläre Buchung dort selbst aus." })
    return
  }
  await Pasteboard.setString(JSON.stringify(capture, null, 2))
  await Dialog.alert({ title: "ZeusX-Aufzeichnung kopiert", message: "Du kannst den Text im Chat einfügen. Login-Eingaben und Cookies werden nicht aufgezeichnet." })
}

export async function openZeusObserved(action: "in" | "out"): Promise<boolean> {
  const capture: Capture = { schema: "zeus-observation/v1", action, startedAt: new Date().toISOString(), records: [] }
  let browser: WebViewController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let closed = false
  let installing = false
  try {
    // Keep the user's website login between visits; the script never reads credentials/cookies.
    browser = new WebViewController()
    await browser.addScriptMessageHandler("zeusObservation", (input: unknown) => {
      if (closed || capture.records.length >= 100) return
      const record = normalizeObservation(input)
      if (!record) return
      capture.records.push(record)
      Storage.set(KEY, { ...capture, records: capture.records.slice() }, SHARED)
    })
    browser.shouldAllowRequest = async ({ url }) => url.startsWith("https://zeiterfassung.grafing.de/")
    if (!CLOCK_IN_URL || !await browser.loadURL(CLOCK_IN_URL)) throw new Error("ZeusX konnte nicht geladen werden.")
    const install = async () => {
      if (closed || installing || !browser) return
      installing = true
      try { await browser.evaluateJavaScript(OBSERVER_SCRIPT) } catch { /* login/navigation replaces the page */ }
      finally { installing = false }
    }
    const tick = async () => {
      await install()
      if (!closed) timer = setTimeout(() => { void tick() }, 250)
    }
    await install()
    timer = setTimeout(() => { void tick() }, 250)
    await browser.present({ fullscreen: true, navigationTitle: action === "in" ? "ChaxterLog · Einstempeln" : "ChaxterLog · Ausstempeln" })
  } catch {
    await Dialog.alert({ title: "ZeusX nicht geöffnet", message: "Die Seite konnte nicht geöffnet werden. Der Stempelknopf und deine Erinnerungen bleiben aktiv." })
    return false
  } finally {
    closed = true
    if (timer !== undefined) clearTimeout(timer)
    browser?.dispose()
  }
  // A changed result can also be a rejection. Until the actual success response has been verified,
  // the user acknowledges the booking after closing ZeusX; observation alone never marks success.
  while (true) {
    const choice = await Dialog.actionSheet({
      title: "Buchung in ZeusX erledigt?",
      message: capture.records.length ? "Die Terminal-Rückmeldung wurde lokal aufgezeichnet. Bestätige nur, wenn ZeusX deine Buchung angenommen hat." : "Es wurde keine Terminal-Rückmeldung erfasst. Du kannst eine erfolgreiche Buchung selbst bestätigen oder den Stempelknopf behalten.",
      actions: [
        { label: action === "in" ? "Ja, eingestempelt" : "Ja, ausgestempelt" },
        { label: "Noch nicht – Knopf behalten" },
        { label: "ZeusX-Aufzeichnung kopieren" },
      ],
    })
    if (choice === 0) return true
    if (choice !== 2) return false
    await copyZeusObservation()
  }
}
