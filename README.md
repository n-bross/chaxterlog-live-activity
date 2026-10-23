# ChaxterLog Live Activity (Scripting)

Live Activity für den Sperrbildschirm und die Dynamic Island mit den Knöpfen Undo (eigenen letzten Klick zurücknehmen), U15 +1 und Ü15 +1 in den Farben der Website. Läuft in der iOS-App [Scripting](https://scriptingapp.github.io/).

## Einrichten

1. In Scripting **Import Remote Scripts** mit `https://github.com/n-bross/chaxterlog-live-activity`.
2. `index.tsx` starten. Beim ersten Start fragt das Skript nach dem Token. Den Token in ChaxterLog unter Konto → Handy-Widget & Kurzbefehle erstellen. Er wird nur im Schlüsselbund dieses Skripts gespeichert, nie im Code.
3. Erneutes Starten ersetzt die laufende Live Activity.

Jeder Tipp auf Undo, U15 oder Ü15 zeigt danach den aktuellen Tagesstand des ganzen Teams; ↻ holt ihn ohne zu zählen. Mit Scripting PRO kann `BACKGROUND_POLLING` in `config.ts` auf `true` gesetzt werden: Dann fragt das Skript alle 15 Sekunden den Stand ab, und Klicks anderer Mitarbeiter erscheinen von selbst. Ohne PRO bleibt es aus, sonst zeigt Scripting einen Upgrade-Dialog.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `config.ts` | Adresse, Name, Token im Schlüsselbund, gemeinsamer Zustand |
| `api.ts` | Anfragen an die ChaxterLog-API |
| `app_intents.tsx` | Knopf-Aktionen; findet laufende Activities über `LiveActivity.from` |
| `live_activity.tsx` | Ansicht und die einzige `LiveActivity.register`-Stelle |
| `index.tsx` | Token abfragen, Activity starten, Stand abfragen |

`app_intents.tsx` darf `live_activity.tsx` weder direkt noch über andere Dateien importieren: Scripting führt die Datei sonst ein zweites Mal aus, und die doppelte Registrierung bricht mit „Registering the same builder name repeatedly is not allowed“ ab.
