// One foreground ZeusX flow for both Live Activity buttons, with passive observation built in.
import { Script } from "scripting"
import { CLOCK_IN_URL, SHARED } from "./config"
import { OBSERVER_SCRIPT, OBSERVER_STATUS_SCRIPT, normalizeObservation, type Observation } from "./zeus-observer"

const LEGACY_KEY = "chaxterlog.zeus.observation.v1"
const HISTORY_KEY = "chaxterlog.zeus.observations.v2"
const MAX_CAPTURES = 20
const DIAGNOSTIC_KEY = "chaxterlog.zeus.observerDiagnostic.v1"
type ObserverChecks = { originAllowed: boolean; installed: boolean; bridgeAvailable: boolean; loginPage: boolean; terminalButtonFound: boolean; terminalResultFound: boolean; frameCount: number }
type ObserverDiagnostic = {
  version: "1.3.5"; script: string; action: "in" | "out"; startedAt: string;
  phase: "opening" | "loaded" | "observing" | "openFailed" | "closed";
  installAttempts: number; evaluationFailures: number; records: number; rejectedMessages: number;
  checks?: ObserverChecks;
}
type Capture = { schema: "zeus-observation/v1"; action: "in" | "out"; startedAt: string; records: Observation[] }

type CaptureHistory = { schema: "zeus-observations/v2"; captures: Capture[] }

function readCaptures(): Capture[] {
  const history = Storage.get<CaptureHistory>(HISTORY_KEY, SHARED)
  if (history?.schema === "zeus-observations/v2" && Array.isArray(history.captures)) return history.captures.slice(-MAX_CAPTURES)
  const legacy = Storage.get<Capture>(LEGACY_KEY, SHARED)
  return legacy?.records?.length ? [legacy] : []
}

export async function copyZeusObservation() {
  const captures = readCaptures()
  const diagnostic = Storage.get<ObserverDiagnostic>(DIAGNOSTIC_KEY, SHARED)
  if (!captures.length && !diagnostic) {
    await Dialog.alert({ title: "Keine ZeusX-Aufzeichnung", message: `In diesem Projekt (${Script.name}, Version 1.3.5) ist keine Aufzeichnung oder Diagnose gespeichert. Öffne ZeusX über den Knopf dieser ChaxterLog-Version. Für eine Selbstprüfung brauchst du nicht zu stempeln: Schließe die Seite wieder und wähle „Noch nicht – Knopf behalten“.` })
    return
  }
  await Pasteboard.setString(JSON.stringify({ schema: "zeus-observations/v2", captures, diagnostic }, null, 2))
  await Dialog.alert({ title: captures.length ? "ZeusX-Aufzeichnung kopiert" : "Keine Buchung erfasst – Diagnose kopiert", message: `${captures.length} ZeusX-Sitzung(en) und die verfügbare Selbstprüfung kopiert. Du kannst den Text im Chat einfügen. Login-Eingaben und Cookies werden nicht aufgezeichnet.` })
}

export async function openZeusObserved(action: "in" | "out"): Promise<boolean> {
  const capture: Capture = { schema: "zeus-observation/v1", action, startedAt: new Date().toISOString(), records: [] }
  const previous = readCaptures()
  const diagnostic: ObserverDiagnostic = {
    version: "1.3.5", script: Script.name, action, startedAt: capture.startedAt,
    phase: "opening", installAttempts: 0, evaluationFailures: 0, records: 0, rejectedMessages: 0,
  }
  let diagnosticSavedAt = 0
  const saveDiagnostic = (force = true) => {
    const now = Date.now()
    if (!force && now - diagnosticSavedAt < 5000) return
    diagnosticSavedAt = now
    Storage.set(DIAGNOSTIC_KEY, { ...diagnostic }, SHARED)
  }
  saveDiagnostic()
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
      if (!record) { diagnostic.rejectedMessages++; saveDiagnostic(); return }
      capture.records.push(record)
      diagnostic.records = capture.records.length
      saveDiagnostic()
      Storage.set(HISTORY_KEY, { schema: "zeus-observations/v2", captures: [...previous, { ...capture, records: capture.records.slice() }].slice(-MAX_CAPTURES) }, SHARED)
    })
    browser.shouldAllowRequest = async ({ url }) => url.startsWith("https://zeiterfassung.grafing.de/")
    if (!CLOCK_IN_URL || !await browser.loadURL(CLOCK_IN_URL)) throw new Error("ZeusX konnte nicht geladen werden.")
    diagnostic.phase = "loaded"
    saveDiagnostic()
    const install = async () => {
      if (closed || installing || !browser) return
      installing = true
      diagnostic.installAttempts++
      try {
        await browser.evaluateJavaScript(OBSERVER_SCRIPT)
        const checks = await browser.evaluateJavaScript<ObserverChecks>(OBSERVER_STATUS_SCRIPT)
        if (closed) return
        diagnostic.checks = {
          originAllowed: checks?.originAllowed === true, installed: checks?.installed === true,
          bridgeAvailable: checks?.bridgeAvailable === true, loginPage: checks?.loginPage === true,
          terminalButtonFound: checks?.terminalButtonFound === true, terminalResultFound: checks?.terminalResultFound === true,
          frameCount: Math.max(0, Math.min(100, Number(checks?.frameCount) || 0)),
        }
        diagnostic.phase = "observing"
      } catch {
        if (!closed) diagnostic.evaluationFailures++
      } finally {
        installing = false
        if (!closed) saveDiagnostic(false)
      }
    }
    const tick = async () => {
      await install()
      if (!closed) timer = setTimeout(() => { void tick() }, 250)
    }
    await install()
    timer = setTimeout(() => { void tick() }, 250)
    await browser.present({ fullscreen: true, navigationTitle: action === "in" ? "ChaxterLog · Einstempeln" : "ChaxterLog · Ausstempeln" })
  } catch {
    diagnostic.phase = "openFailed"
    saveDiagnostic()
    await Dialog.alert({ title: "ZeusX nicht geöffnet", message: "Die Seite konnte nicht geöffnet werden. Der Stempelknopf und deine Erinnerungen bleiben aktiv." })
    return false
  } finally {
    closed = true
    if (diagnostic.phase !== "openFailed") diagnostic.phase = "closed"
    saveDiagnostic()
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
