# Scripting auf dem Mac vorbereiten

Das Setup verwendet den vom Hersteller empfohlenen `scripting-cli` (fest auf 1.5.0), Node.js ab 20 und dein vorhandenes VS Code. Es erstellt einen separaten Desktop-Arbeitsordner, installiert die CLI und klont ChaxterLog als synchronisierbares Projekt. Vorhandene Projektdateien werden nicht überschrieben. Die Installation startet weder ChaxterLog noch eine ZeusX-Buchung.

Auf dem Mac aus dem heruntergeladenen Repository ausführen:

```bash
bash .desktop/setup-mac.sh
```

Ziel ist standardmäßig `~/Developer/chaxterlog-scripting`. Ein anderer Zielordner kann als erstes Argument übergeben werden. Danach dort in VS Code **Terminal → Run Task → Scripting: iPhone verbinden** wählen oder `npm run remote` starten. Der Dienst läuft auf Port 4000 und bleibt bis Ctrl+C aktiv. Die Verbindung und Projektauswahl müssen einmal in Scripting auf dem iPhone hergestellt werden; App und Mac müssen sich per lokalem Netzwerk oder VPN erreichen können. Bonjour-Erkennung ist für das lokale Netz vorgesehen.

Erst die Verbindung prüfen, bevor Änderungen am ChaxterLog-Projekt gespeichert werden: Die Synchronisierung erfolgt in beide Richtungen und gespeicherter Code kann auf dem iPhone ausgeführt werden. Nach der Verbindung liefert die App ihre aktuellen `dts/*.d.ts`, damit VS Code echte Scripting-Typen prüfen kann.

## MCP-Status

Die geprüfte offizielle `scripting-cli` 1.5.0 bietet Dateisynchronisierung, aber keinen dokumentierten MCP-Server und keinen `scripting-ts`-Befehl. Deshalb enthält dieses Setup keine erfundene MCP-Adresse und installiert keinen fremden Ersatzserver. Für die gewünschte MCP-Anbindung wird noch die konkrete Anleitung beziehungsweise der Installationsbefehl aus der Scripting-App benötigt. Eine erfolgreiche CLI-Installation bedeutet nicht, dass die iPhone-Verbindung oder MCP bereits eingerichtet ist.

Quellen: [Hersteller-CLI](https://github.com/thomfang/scripting-cli), [offizieller Desktop-Leitfaden](https://github.com/ScriptingApp/scripting-app-development/blob/main/references/desktop-cli.md).
