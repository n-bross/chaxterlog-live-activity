# ChaxterLog Live Activity (Scripting)

Live Activity für den Sperrbildschirm und die Dynamic Island mit den Knöpfen Undo (eigenen letzten Klick zurücknehmen), U15 +1 und Ü15 +1 in den Farben der Website. Läuft in der iOS-App [Scripting](https://scriptingapp.github.io/).

## Einrichten

1. In Scripting **Import Remote Scripts** mit `https://github.com/n-bross/chaxterlog-live-activity`.
2. `index.tsx` starten. Beim ersten Start fragt das Skript nach dem Token. Den Token in ChaxterLog unter Konto → Handy-Widget & Kurzbefehle erstellen. Er wird nur im Schlüsselbund dieses Skripts gespeichert, nie im Code.
3. Erneutes Starten ersetzt die laufende Live Activity.

Die Live Activity besteht nur aus drei Knöpfen ohne Hintergrund: Undo links, U15 und Ü15 mit dem Tagesstand des ganzen Teams. Ein Tipp färbt den Knopf kurz grün (Undo rot). Eine Zeile darunter erscheint nur bei einem Fehler.

Mit Scripting PRO läuft `index.tsx` im Hintergrund weiter und fragt alle 15 Sekunden den Stand ab, so erscheinen Klicks anderer Mitarbeiter von selbst. Damit iOS Scripting im Hintergrund nicht anhält, spielt das Skript dabei eine Sekunde Stille in Schleife (`AUDIO_MODE` in `config.ts`): `"mix"` (Standard) läuft neben Musik her; reicht das nicht, `"nowPlaying"` versuchen (ChaxterLog erscheint als laufende Wiedergabe, andere Musik stoppt). Die Zeit der letzten Abfrage steht beim nächsten Start im Log. Ohne PRO zeigt Scripting einen Upgrade-Dialog; dann `BACKGROUND_POLLING` in `config.ts` auf `false` setzen, und der Stand kommt nur mit jedem eigenen Tipp.

## Ankommen, Einstempeln, Gehen

- **Ankommen (empfohlen):** Kurzbefehle → Automation → „Ankommen“ → „Sofort ausführen“ (Run Immediately) → Aktion **„Skript in App ausführen“ / „Run Script in App“** von Scripting → Skript „ChaxterLog“ aus der Liste wählen. Das startet `intent.tsx`, das den passenden Link selbst öffnet; der Skriptname muss nicht stimmen. Für „Verlassen“ dieselbe Aktion mit dem Text „gehen“ als Eingabe (dafür in Scripting beim Projekt unter Intent-Einstellungen „Text“ als Eingabe erlauben).
- **Ankommen per Link:** In der Kurzbefehle-App eine persönliche Automation „Ankommen“ beim Arbeitsort anlegen, „Sofort ausführen“ wählen, Aktion „URL öffnen“ mit `scripting://run_single/ChaxterLog?arrive=1`. Das öffnet Scripting kurz und startet die Live Activity (iOS lässt sie nur bei geöffneter App starten). Wer schon ein eigenes Standort-Skript hat, öffnet von dort denselben Link oder ruft `Script.run({ name: "ChaxterLog", queryParameters: { arrive: true } })` auf.
- **Einstempeln:** Nach dem Ankommen steht über den Zählknöpfen ein oranger Knopf „Einstempeln“. Er öffnet die hinterlegte ZeusX-Seite der Stadt Grafing (`CLOCK_IN_URL` in `config.ts`). Sobald iOS das Öffnen bestätigt, verschwindet der Knopf bis zum nächsten Tag. Schlägt das Öffnen fehl, bleiben Knopf und Erinnerungen aktiv. Solange er nicht gedrückt wurde, kommen Erinnerungen nach 10, 20 und 30 Minuten (`REMINDER_MINUTES`) mit Ton und Vibration; Tippen auf die Erinnerung öffnet dieselbe Seite.
- **Ausstempeln:** Nach dem Einstempeln steht dort ein kleinerer Knopf „Ausstempeln“. Er öffnet ebenfalls das Zeitsystem und verschwindet danach. Die Knöpfe öffnen die Website. Einloggen und das tatsächliche Stempeln erfolgen dort; das Skript kann den Erfolg der Stempelung nicht feststellen.
- **Gehen (optional):** Automation „Verlassen“ mit `scripting://run_single/ChaxterLog?leave=1`. Ist schon ausgestempelt, endet die Live Activity. Sonst bleibt sie mit dem Ausstempeln-Knopf stehen und es kommt eine Erinnerung.

Einfacher: `index.tsx` von Hand starten. Solange noch keine Ankunft ankam, fragt das Skript „Automatisch starten beim Ankommen?“ und kopiert den passenden Link (mit dem Namen, unter dem das Skript installiert ist) in die Zwischenablage. Automationen lassen sich bei iOS nicht als Datei verschicken, sie müssen auf dem iPhone angelegt werden. Die Links stehen außerdem bei jedem Start im Log.

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

## Prüfen

Mit installiertem TypeScript: `node --test tests/clock-links.test.cjs`. Die Tests prüfen erfolgreiche und fehlgeschlagene Seitenaufrufe bei laufendem und neu gestarteten Skript sowie nach dem Verlassen der Arbeit.
