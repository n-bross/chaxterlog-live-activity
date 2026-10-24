import { Intent, Script } from "scripting"
import { arrive, leave } from "./automation"

// Use Scripting's "Run Script" action, not "Run Script in App" or "Open URL".
// The automation must be able to finish without opening an app or asking for unlock.
const input = (Intent.shortcutParameter?.type === "text" ? String(Intent.shortcutParameter.value) : Intent.textsParameter?.[0] ?? "").trim().toLowerCase()

async function run() {
  let message: string
  try {
    if (/^(protokoll|log|zeuslog)$/.test(input)) {
      message = `ZeusX-Aufzeichnung öffnen: ${Script.createRunSingleURLScheme(Script.name, { zeusLog: "1" })}`
    } else if (/^(gehen|leave|verlassen|depart|departure)$/.test(input)) {
      const result = await leave()
      message = result.pending
        ? result.notificationsScheduled ? "ChaxterLog: Ausstempeln vorgemerkt, Mitteilung geplant." : "ChaxterLog: Ausstempeln vorgemerkt. Bitte Mitteilungen für Scripting erlauben."
        : "ChaxterLog: Verlassen verarbeitet, keine offene Ausstempelung."
    } else if (/^(ankommen|arrive|arrival)?$/.test(input)) {
      const result = await arrive(true)
      message = result.pending
        ? result.notificationsScheduled ? "ChaxterLog: Ankommen gespeichert. Mitteilung antippen, um die Live Activity zu starten." : "ChaxterLog: Ankommen gespeichert. Bitte Mitteilungen für Scripting erlauben und ChaxterLog manuell öffnen."
        : "ChaxterLog: Ankommen gespeichert, bereits eingestempelt."
    } else {
      message = "ChaxterLog: Als Eingabe bitte „ankommen“ oder „gehen“ verwenden."
    }
  } catch (error) {
    message = `ChaxterLog: Hintergrundaktion fehlgeschlagen: ${String(error)}`
  }
  Script.exit(Intent.text(message))
}

run()
