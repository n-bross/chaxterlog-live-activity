# ChaxterLog Live Activity (Scripting)

Live Activity für den Sperrbildschirm und die Dynamic Island mit den Knöpfen Undo (eigenen letzten Klick zurücknehmen), U15 +1 und Ü15 +1 in den Farben der Website. Läuft in der iOS-App [Scripting](https://scriptingapp.github.io/).

## Einrichten

1. In Scripting **Import Remote Scripts** mit `https://github.com/n-bross/chaxterlog-live-activity`.
2. `index.tsx` starten. Beim ersten Start fragt das Skript nach dem Token. Den Token in ChaxterLog unter Konto → Handy-Widget & Kurzbefehle erstellen. Er wird nur im Schlüsselbund dieses Skripts gespeichert, nie im Code.
3. Erneutes Starten ersetzt die laufende Live Activity.

**Ab Version 1.3.0 ist ZeusX-Beobachtung direkt enthalten. Nur dieses Projekt importieren bzw. aktualisieren.** Das separate Projekt „ZeusX beobachten“ ist für diesen Ablauf nicht mehr nötig. Starte nach dem Update `index.tsx` einmal neu, damit die Live Activity die aktuellen Knopf-Links erhält. Das Skript benötigt den Vordergrund; in Kurzbefehle **Run Script in App** verwenden.

Die Live Activity besteht nur aus drei Knöpfen ohne Hintergrund: Undo links, U15 und Ü15 mit dem Tagesstand des ganzen Teams. Ein Tipp färbt den Knopf kurz grün (Undo rot). Eine Zeile darunter erscheint nur bei einem Fehler.

Mit Scripting PRO läuft `index.tsx` im Hintergrund weiter und fragt alle 15 Sekunden den Stand ab, so erscheinen Klicks anderer Mitarbeiter von selbst. Damit iOS Scripting im Hintergrund nicht anhält, spielt das Skript dabei eine Sekunde Stille in Schleife (`AUDIO_MODE` in `config.ts`): `"mix"` (Standard) läuft neben Musik her; reicht das nicht, `"nowPlaying"` versuchen (ChaxterLog erscheint als laufende Wiedergabe, andere Musik stoppt). Die Zeit der letzten Abfrage steht beim nächsten Start im Log. Ohne PRO zeigt Scripting einen Upgrade-Dialog; dann `BACKGROUND_POLLING` in `config.ts` auf `false` setzen, und der Stand kommt nur mit jedem eigenen Tipp.

## Ankommen, Einstempeln, Gehen

- **Ankommen (empfohlen):** Kurzbefehle → Automation → „Ankommen“ → „Sofort ausführen“ (Run Immediately) → Aktion **„Skript in App ausführen“ / „Run Script in App“** von Scripting → Skript „ChaxterLog“ aus der Liste wählen. Das startet `intent.tsx`, das den passenden Link selbst öffnet; der Skriptname muss nicht stimmen. Für „Verlassen“ dieselbe Aktion mit dem Text „gehen“ als Eingabe (dafür in Scripting beim Projekt unter Intent-Einstellungen „Text“ als Eingabe erlauben).
- **Ankommen per Link:** In der Kurzbefehle-App eine persönliche Automation „Ankommen“ beim Arbeitsort anlegen, „Sofort ausführen“ wählen, Aktion „URL öffnen“ mit `scripting://run_single/ChaxterLog?arrive=1`. Das öffnet Scripting kurz und startet die Live Activity (iOS lässt sie nur bei geöffneter App starten). Wer schon ein eigenes Standort-Skript hat, öffnet von dort denselben Link oder ruft `Script.run({ name: "ChaxterLog", queryParameters: { arrive: true } })` auf.
- **Einstempeln:** Der orange Knopf öffnet ZeusX **innerhalb von ChaxterLog**, mit der passiven Beobachtung bereits aktiv. Du meldest dich dort an und drückst selbst „Kommt/Geht“. Warte die vollständige Rückmeldung ab und schließe die eingeblendete Webseite. Wähle anschließend **Ja, eingestempelt**. Dann verschwinden beide Stempelknöpfe, die Erinnerungen werden gelöscht und nur Undo, U15 und Ü15 bleiben sichtbar; die Hintergrund-Abfragen laufen weiter.
- **Ausstempeln:** Der Knopf erscheint erst nach der Verlassen-Automation. Er öffnet dieselbe beobachtete ZeusX-Seite. Stemple dort selbst aus, schließe die Webseite und wähle **Ja, ausgestempelt**. Dann endet die Live Activity samt laufender Abfragen und Erinnerungen.
- **Abbrechen oder Fehler:** Wenn du **Noch nicht – Knopf behalten** wählst, die Frage schließt oder ZeusX nicht geladen werden kann, bleiben Stempelknopf und Erinnerungen bestehen. Die Besucher-API muss für den ZeusX-Aufruf nicht erreichbar sein.
- **Gehen (optional):** Automation „Verlassen“ mit `scripting://run_single/ChaxterLog?leave=1`. Ist schon ausgestempelt, endet die Live Activity. Sonst bleibt sie mit dem Ausstempeln-Knopf stehen und es kommt eine Erinnerung.

Auch `index.tsx` ohne Parameter zu starten gilt jetzt als Ankommen: Die Live Activity startet mit dem Einstempeln-Knopf. Wiederholtes Starten während eines laufenden Besuchs erhält den bisherigen Stand. Nach Ausstempeln und erneutem Start ist auch am selben Tag eine neue Sitzung möglich.

Die Stempelknöpfe und Erinnerungen verwenden `run_single` mit dem tatsächlich installierten Skriptnamen. Dadurch brauchen sie keinen Resume-Callback des alten Laufs. Nach dem Update `index.tsx` einmal neu starten, damit bereits gespeicherte Knopf-Links ersetzt werden.

## Eingebaute ZeusX-Beobachtung

Der Beobachter erfasst ausschließlich deinen eigenen Kommt/Geht-Tipp und den danach sichtbaren Bereich `TerminalResult` oberhalb des Knopfs. Die letzten 20 aufgezeichneten ZeusX-Sitzungen bleiben gemeinsam im selben ChaxterLog-Projekt auf dem iPhone gespeichert; Login-Eingaben und Cookies werden nicht gelesen. Die normale WebView-Sitzung bleibt lokal erhalten, damit du dich nicht bei jedem Aufruf neu anmelden musst. Kein Skript drückt Stempelknöpfe oder führt Buchungen im Hintergrund aus.

Nach dem Schließen der Webseite kannst du direkt **ZeusX-Aufzeichnung kopieren** wählen. Alternativ später die Scripting-Kurzbefehl-Aktion für ChaxterLog mit dem Text **protokoll** starten oder `scripting://run_single/ChaxterLog?zeusLog=1` öffnen. Bei einem anderen installierten Projektnamen den Namen im Link entsprechend anpassen.

Die Aufzeichnung markiert allein noch keinen Erfolg, da auch eine Fehlermeldung die Terminal-Anzeige verändert. Deshalb bestätigst du die Buchung vorerst selbst nach dem Schließen von ZeusX. Die automatische Erkennung einer erfolgreichen Buchung mit Saldo bleibt bis zur Auswertung der echten Rückmeldung ausgesetzt.

## Kurzbefehle

Automationen werden weiterhin auf dem iPhone eingerichtet. In der englischen Kurzbefehle-App die Scripting-Aktion **Run Script in App** verwenden, „ChaxterLog“ auswählen und zum Ankommen keine Eingabe übergeben. Für Verlassen den Text **gehen** übergeben; dafür in Scripting in den Intent-Einstellungen die Eingabe **Text** erlauben. Die passenden Links stehen bei jedem Start im Log.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `config.ts` | Adresse, Name, Token im Schlüsselbund, gemeinsamer Zustand |
| `api.ts` | Anfragen an die ChaxterLog-API |
| `app_intents.tsx` | Knopf-Aktionen; findet laufende Activities über `LiveActivity.from` |
| `live_activity.tsx` | Ansicht und die einzige `LiveActivity.register`-Stelle |
| `index.tsx` | Token abfragen, Activity starten, Stand abfragen |
| `zeus-flow.ts` | Gemeinsame ZeusX-WebView, Abschlussabfrage und Export |
| `zeus-observer.ts` | Passives Erfassen des eigenen Stempelklicks und der Terminal-Rückmeldung |
| `audio.ts` | Stille Audio-Wiedergabe, damit iOS das Skript im Hintergrund weiterlaufen lässt |

`app_intents.tsx` darf `live_activity.tsx` weder direkt noch über andere Dateien importieren: Scripting führt die Datei sonst ein zweites Mal aus, und die doppelte Registrierung bricht mit „Registering the same builder name repeatedly is not allowed“ ab.

## Prüfen

Mit installiertem TypeScript: `node --test tests/*.test.cjs`. Die Tests prüfen den gemeinsamen beobachteten ZeusX-Aufruf, das Behalten der Knöpfe bei Abbruch, das Entfernen von Einstempeln erst nach Bestätigung, Ausstempeln erst nach Verlassen, das Ende der Activity sowie Aufzeichnung, Export und Kurzbefehl-Aufrufe. Es werden keine echten Stempelungen ausgelöst.

Falls ChaxterLog beim Start oder im laufenden Ablauf scheitert, zeigt es nun einen Fehlerdialog mit Version 1.3.4 und dem Fehlertext an. Diesen Text zur Diagnose übermitteln.

## Startkorrektur in 1.3.1

`Notification` wird ausdrücklich aus `scripting` importiert. Dadurch entfallen die Compile-Fehler „Cannot find name Notification“, die den Start verhindert haben. Fehler beim Planen der Ankunftserinnerungen werden außerdem protokolliert und verhindern nicht mehr den Start der Live Activity.

Das vorhandene Projekt in Scripting aus diesem Repository aktualisieren und danach `index.tsx` mit ▶ starten. Die Versionsnummer muss **1.3.1** sein. ZeusX-Beobachtung ist bereits in diesem Projekt enthalten.

## Verlassen-Korrektur in 1.3.2

Der Verlassen-Aufruf wird jetzt auch behandelt, wenn ein `scripting://run/ChaxterLog?leave=1`-Link das bereits laufende Skript fortsetzt. Zuvor wurde `leave` in diesem Fall ignoriert. Der empfohlene Link bleibt `scripting://run_single/ChaxterLog?leave=1`; dieser startet den Ablauf neu. Der Ausstempeln-Knopf wird vor der Erinnerung aktualisiert und bleibt auch bei einem Fehler der Benachrichtigungen sichtbar.

Zum Prüfen: vorhandenes ChaxterLog-Projekt auf **1.3.2** aktualisieren, `index.tsx` starten und nach deiner eigenen regulären ZeusX-Buchung **Ja, eingestempelt** bestätigen. Jetzt bleiben die drei Zählknöpfe. Den Verlassen-Kurzbefehl ausführen: **Ausstempeln** muss erscheinen. Nach eigener Ausstempelung und **Ja, ausgestempelt** endet die Activity. Ohne zuvor bestätigtes Einstempeln beendet Verlassen die Activity direkt.

## Sofortiges Entfernen in 1.3.3

Nach **Ja, ausgestempelt** wird die Activity jetzt mit `dismissTimeInterval: 0` sofort vom Sperrbildschirm entfernt. Ohne diese Option konnte die bereits beendete Anzeige noch mehrere Stunden sichtbar bleiben. Fehler beim Löschen von Erinnerungen verhindern das Entfernen nicht mehr. Auch beim Ersetzen einer alten Activity und beim Verlassen ohne offene Ausstempelung wird die alte Anzeige sofort entfernt.

Das vorhandene Projekt auf **1.3.3** aktualisieren und `index.tsx` einmal neu starten. Die bisherigen Kurzbefehl-Links bleiben gleich. Der Abschluss erfolgt weiterhin nach deiner eigenen ZeusX-Buchung und der Bestätigung **Ja, ausgestempelt**; es werden keine Buchungen automatisch ausgeführt.

## Beobachtungsverlauf in 1.3.4

Ein- und Ausstempeln sowie weitere Versuche werden jetzt sitzungsübergreifend gespeichert. **ZeusX-Aufzeichnung kopieren** exportiert den gesamten Verlauf gemeinsam (`zeus-observations/v2`). Du musst nach dem Einstempeln nichts schicken; ein gemeinsamer Export nach dem Ausstempeln reicht. Aufgezeichnet wird weiterhin ausschließlich innerhalb der über ChaxterLog geöffneten ZeusX-Seite, nicht in anderen Browsern oder bei geschlossenem Skript.

Gespeichert werden die neuesten **20 Sitzungen mit Ereignissen**, je höchstens 100 Ereignisse. Ein Öffnen ohne erfassten Stempelklick ersetzt keine frühere Aufzeichnung. Eine noch vorhandene Aufzeichnung aus Version 1.3.3 oder älter wird beim Upgrade übernommen; bereits überschriebene alte Sitzungen lassen sich nicht wiederherstellen. Login-Eingaben und Cookies bleiben ausgeschlossen.
