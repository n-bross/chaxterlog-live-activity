# ChaxterLog Live Activity (Scripting)

Live Activity für den Sperrbildschirm und die Dynamic Island mit den Knöpfen Undo (eigenen letzten Klick zurücknehmen), U15 +1 und Ü15 +1 in den Farben der Website. Läuft in der iOS-App [Scripting](https://scriptingapp.github.io/).

## Einrichten

1. In Scripting **Import Remote Scripts** mit `https://github.com/n-bross/chaxterlog-live-activity`.
2. `index.tsx` starten. Beim ersten Start fragt das Skript nach dem Token. Den Token in ChaxterLog unter Konto → Handy-Widget & Kurzbefehle erstellen. Er wird nur im Schlüsselbund dieses Skripts gespeichert, nie im Code.
3. Erneutes Starten ersetzt die laufende Live Activity.

Die Live Activity besteht nur aus drei Knöpfen ohne Hintergrund: Undo links, U15 und Ü15 mit dem Tagesstand des ganzen Teams. Ein Tipp färbt den Knopf kurz grün (Undo rot). Eine Zeile darunter erscheint nur bei einem Fehler.

Mit Scripting PRO läuft `index.tsx` im Hintergrund weiter und fragt alle 15 Sekunden den Stand ab, so erscheinen Klicks anderer Mitarbeiter von selbst. Damit iOS Scripting im Hintergrund nicht anhält, spielt das Skript dabei eine Sekunde Stille in Schleife (`AUDIO_MODE` in `config.ts`): `"mix"` (Standard) läuft neben Musik her; reicht das nicht, `"nowPlaying"` versuchen (ChaxterLog erscheint als laufende Wiedergabe, andere Musik stoppt). Die Zeit der letzten Abfrage steht beim nächsten Start im Log. Ohne PRO zeigt Scripting einen Upgrade-Dialog; dann `BACKGROUND_POLLING` in `config.ts` auf `false` setzen, und der Stand kommt nur mit jedem eigenen Tipp.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `config.ts` | Adresse, Name, Token im Schlüsselbund, gemeinsamer Zustand |
| `api.ts` | Anfragen an die ChaxterLog-API |
| `app_intents.tsx` | Knopf-Aktionen; findet laufende Activities über `LiveActivity.from` |
| `live_activity.tsx` | Ansicht und die einzige `LiveActivity.register`-Stelle |
| `index.tsx` | Token abfragen, Activity starten, Stand abfragen |
| `audio.ts` | Stille Audio-Wiedergabe, damit iOS das Skript im Hintergrund weiterlaufen lässt |

`app_intents.tsx` darf `live_activity.tsx` weder direkt noch über andere Dateien importieren: Scripting führt die Datei sonst ein zweites Mal aus, und die doppelte Registrierung bricht mit „Registering the same builder name repeatedly is not allowed“ ab.
