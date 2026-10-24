# ChaxterLog Live Activity (Scripting)

Live Activity für Sperrbildschirm und Dynamic Island mit Undo, U15 +1 und Ü15 +1. Läuft in [Scripting](https://scriptingapp.github.io/); ZeusX mit passiver Beobachtung ist enthalten.

## Einrichten und auf 1.4.0 aktualisieren

1. Das vorhandene Projekt aus `https://github.com/n-bross/chaxterlog-live-activity` aktualisieren oder über den verbundenen Developer Server synchronisieren. Dasselbe Projekt weiterverwenden, damit Token und Aufzeichnungen erhalten bleiben.
2. `index.tsx` einmal **bei entsperrtem iPhone** starten. Falls nötig, den Token aus ChaxterLog → Konto → Handy-Widget & Kurzbefehle einfügen. Er liegt nur im Schlüsselbund des Skripts. Mitteilungen und Live-Aktivitäten für Scripting erlauben.
3. Die Ankommen- und Verlassen-Kurzbefehle wie unten umstellen. Alte URL-Aktionen verlangen weiterhin den Vordergrund; ein Skript-Update allein ändert diese Aktionen nicht.

## Automationen bei gesperrtem iPhone

**Beide Automationen verwenden jetzt die Scripting-Aktion „Run Script“ / „Skript ausführen“.** Die bisherigen Aktionen „URL öffnen“ und „Run Script in App“ müssen ersetzt werden: Sie versuchen Scripting im Vordergrund zu öffnen und können ein Entsperren verlangen.

| Automation | Aktion | Skript | Texteingabe |
|---|---|---|---|
| Ankommen / Arrive | Scripting: Run Script | ChaxterLog | `ankommen` (oder keine Eingabe) |
| Verlassen / Departure | Scripting: Run Script | ChaxterLog | `gehen` |

- In Scripting beim Projekttitel → **Intent Settings** die Eingabe **Text** erlauben.
- Für die Automation **Sofort ausführen / Run Immediately** wählen, falls diese Option angezeigt wird. Falls verfügbar, in den Details unter **Datenschutz → Ausführen im gesperrten Zustand erlauben / Allow Running When Locked** aktivieren. Die Oberfläche unterscheidet sich nach iOS-Version.
- Falls die Aktion „Beim Ausführen anzeigen / Show When Run“ anbietet, ausschalten. Keine zusätzlichen Aktionen „App öffnen“, „URL öffnen“, „Schnellansicht“ oder Dialoge an den automatischen Ablauf anhängen.
- Beide Kurzbefehle einmal entsperrt ausführen und eventuelle Systemberechtigungen erteilen. Danach mit einem zeitgesteuerten Test bei gesperrtem Bildschirm prüfen; dafür sind weder Ortswechsel noch echte ZeusX-Buchungen nötig.

### Was bei Ankommen passiert

Der Hintergrund-Intent speichert die Ankunft und die Stempel-Links, aktualisiert eine bereits vorhandene Activity und plant sofort eine Mitteilung sowie Erinnerungen nach 10, 20 und 30 Minuten. Es werden keine App, Webseite oder Eingabefrage geöffnet und keine Besucher gezählt.

**Eine neue Live Activity startet mit den derzeit verwendeten Scripting-APIs erst im Vordergrund.** Tippe deshalb die Ankommen-Mitteilung an und entsperre das iPhone. ChaxterLog startet mit **Einstempeln**. Eine vorhandene Activity kann bereits im Hintergrund aktualisiert werden. Die Mitteilungen verwenden den Ankommen-Link, damit auch eine fehlende Activity beim Antippen erstellt werden kann.

Bei bereits bestätigtem Einstempeln löst eine erneute Ankunft keine weiteren Einstempel-Erinnerungen aus. Fehler bei Mitteilungen verhindern die Zustandsänderung nicht; der Kurzbefehl gibt dann einen entsprechenden Hinweis als Text zurück.

### Was bei Verlassen passiert

Nach zuvor bestätigtem Einstempeln erscheint **Ausstempeln** in der laufenden Activity und eine Mitteilung wird geplant. Ist die Activity schon beendet oder kann sie nicht aktualisiert werden, öffnet der Mitteilungs-Link trotzdem den beobachteten ZeusX-Ablauf. Ohne offene Ausstempelung wird die Activity sofort entfernt. Die laufenden Besucher-Abfragen werden beim Verlassen beendet.

## Ein- und Ausstempeln

- **Einstempeln:** Der Knopf öffnet ZeusX innerhalb von ChaxterLog. Melde dich an und drücke selbst „Kommt/Geht“. Warte die Rückmeldung ab, schließe die Webseite und wähle **Ja, eingestempelt**. Die Stempelknöpfe und Erinnerungen verschwinden; Undo, U15 und Ü15 bleiben.
- **Ausstempeln:** Der Knopf erscheint nach Verlassen. Stemple auf ZeusX selbst aus, schließe die Webseite und wähle **Ja, ausgestempelt**. Die Activity wird mit `dismissTimeInterval: 0` sofort entfernt.
- **Abbrechen oder Fehler:** Bei **Noch nicht – Knopf behalten** oder einem Ladefehler bleiben die Stempelknöpfe erhalten. Die Besucher-API muss für den ZeusX-Aufruf nicht erreichbar sein.

`index.tsx` ohne Parameter gilt als manuelles Ankommen. Wiederholtes Starten während eines laufenden Besuchs erhält den Stempelstatus. Nach Ausstempeln und erneutem Start ist auch am selben Tag eine neue Sitzung möglich.

Manuelle Links bleiben verfügbar; sie benötigen den Vordergrund:

- `scripting://run_single/ChaxterLog?arrive=1`
- `scripting://run_single/ChaxterLog?leave=1`
- `scripting://run_single/ChaxterLog?zeusLog=1`

Bei einem abweichenden Projektnamen den Namen ersetzen. Die Stempelknöpfe und Mitteilungen erzeugen ihre Links automatisch mit dem installierten Namen.

## Besucherzahlen im Hintergrund

Mit Scripting PRO fragt `index.tsx` alle 15 Sekunden den Stand ab. Die Activity zeigt Undo, U15 und Ü15 in den Farben der Website; ein Tipp färbt den Knopf kurz grün (Undo rot). Eine zusätzliche Zeile erscheint nur bei Fehlern.

Damit iOS die Abfragen im Hintergrund nicht anhält, spielt das Skript Stille in Schleife: `AUDIO_MODE` in `config.ts` ist standardmäßig `"mix"` neben anderer Musik. `"nowPlaying"` übernimmt die Wiedergabe und kann andere Musik stoppen; `"off"` deaktiviert die Audiohilfe. Ohne PRO `BACKGROUND_POLLING` auf `false` setzen; dann aktualisieren eigene Knopf-Tipps den Stand. Die Hintergrund-Automationen selbst benötigen keine dauerhafte Audio-Wiedergabe.

## ZeusX-Beobachtung und Diagnose

Der Beobachter erfasst ausschließlich deinen eigenen Kommt/Geht-Tipp und die danach sichtbare Rückmeldung in `TerminalResult`. Die neuesten **20 Sitzungen mit Ereignissen**, je maximal 100 Ereignisse, bleiben im selben Projekt auf dem iPhone gespeichert. Ein gemeinsamer Export nach Ein- und Ausstempeln reicht. Öffnen ohne Ereignisse überschreibt keine frühere Aufzeichnung; eine vorhandene alte Einzelaufzeichnung wird übernommen. Login-Eingaben und Cookies werden nicht gelesen, und kein Skript führt Buchungen automatisch aus.

Nach dem Schließen der Webseite **ZeusX-Aufzeichnung kopieren** wählen oder den oben genannten `zeusLog`-Link manuell öffnen. Die Hintergrund-Kurzbefehl-Eingabe **protokoll** gibt diesen Link als Text zurück; sie öffnet die App nicht automatisch.

Zusätzlich wird beim Öffnen von ZeusX eine Diagnose gespeichert: Skriptversion und Projektname, Lade-/Abschlussstatus, Injektionsversuche und Fehleranzahl sowie Wahrheitswerte für Beobachter, Nachrichtenbrücke, Login-Seite, Stempelknopf und Terminal-Bereich. Die Anzahl der iFrames wird erfasst; Login-Werte, Cookies und weitere Seitentexte werden nicht ausgelesen. Der Export enthält die Diagnose auch ohne Buchungsereignisse und bezeichnet eine leere Ereignisliste ausdrücklich als **Keine Buchung erfasst**. Alte fehlende Aufzeichnungen können nicht wiederhergestellt werden.

Eine Prüfung braucht keine zusätzliche Stempelung: ZeusX über ChaxterLog öffnen, die Seite laden lassen, schließen, **Noch nicht – Knopf behalten** wählen und den Export-Link öffnen. Eine veränderte Terminal-Anzeige allein beweist noch keine erfolgreiche Buchung; bis zur Auswertung echter Rückmeldungen bestätigst du den Erfolg selbst.

## Aufbau und Prüfung

| Datei | Aufgabe |
|---|---|
| `config.ts` | Adresse, Token und gemeinsamer Zustand |
| `automation.ts` | Endliche Hintergrundaktionen für Ankommen und Verlassen, Mitteilungen |
| `intent.tsx` | Kurzbefehl-Eingabe und Rückgabe ohne App-Öffnen |
| `index.tsx` | Token abfragen, Activity im Vordergrund starten, Stand abfragen |
| `app_intents.tsx` | Zählknöpfe und Undo |
| `live_activity.tsx` | Ansicht und einzige `LiveActivity.register`-Stelle |
| `zeus-flow.ts` | ZeusX-WebView, Bestätigung und Export |
| `zeus-observer.ts` | Passives Erfassen des eigenen Stempelklicks |
| `audio.ts` | Audiohilfe für laufende Besucher-Abfragen |

`app_intents.tsx` darf die Activity-Ansicht nicht statisch importieren, da ein Importzyklus zu doppelter Registrierung führt. Der Hintergrund-Intent lädt die Ansicht erst unmittelbar vor dem Aktualisieren einer vorhandenen Activity.

Mit installiertem TypeScript: `node --test tests/*.test.cjs`. Die Tests prüfen Hintergrund-Aktionen ohne App-Öffnen, Erinnerungen bei fehlender Activity, verweigerte Mitteilungen, Zustandswechsel, bestätigte und abgebrochene Buchungsabläufe sowie passives Erfassen und Export. Es werden keine echten Stempelungen ausgelöst. Zusätzlich wurde Version 1.4.0 gegen die vom verbundenen Scripting-Gerät gelieferten Typdefinitionen geprüft. Der echte Sperrbildschirm-Ablauf muss am iPhone bestätigt werden.
