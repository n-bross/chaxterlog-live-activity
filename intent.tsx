// Safari is a Scripting global.
import { Intent, Script } from "scripting"

// Entry for the Shortcuts actions "Run Script in App" (Scripting → ChaxterLog). The automation picks
// the script from a list, so the link below always carries the name the script is installed under.
// Input text "gehen" / "leave" ends the day; anything else, or no input, starts it ("ankommen").
const input = (Intent.shortcutParameter?.type === "text" ? String(Intent.shortcutParameter.value) : Intent.textsParameter?.[0] ?? "").trim().toLowerCase()
const leaving = /geh|leave|verlass/.test(input)

async function run() {
  let opened = false
  try {
    opened = await Safari.openURL(Script.createRunSingleURLScheme(Script.name, leaving ? { leave: "1" } : { arrive: "1" }))
  } catch { /* Show the same actionable error as a rejected URL. */ }
  if (!opened) {
    await Dialog.alert({ title: "ChaxterLog nicht gestartet", message: "Bitte in Kurzbefehle die Scripting-Aktion „Run Script in App“ verwenden und dieses Skript auswählen. Zum Prüfen kannst du index.tsx direkt in Scripting starten." })
    Script.exit(Intent.text("ChaxterLog konnte nicht gestartet werden."))
    return
  }
  Script.exit(Intent.text(leaving ? "ChaxterLog: Gehen" : "ChaxterLog: Ankommen"))
}

run()
