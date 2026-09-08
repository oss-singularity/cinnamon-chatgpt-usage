# Nächster Schritt zur ersten offiziellen Spice

Stand: 8. September 2026. **1.0.0** ist geprüft und zur Veröffentlichung
freigegeben. Der Projekt-PR ist gemergt und die Spices-Einreichung abgesendet.
Die Aufnahme in den Cinnamon-Katalog steht noch aus.

## Bereits von Claudiu freigegeben

1. **Keinen neuen Account registrieren.** Die Einreichung erfolgt über einen
   GitHub-Pull-Request an `linuxmint/cinnamon-spices-applets`. Der vorhandene
   Account `ClaudiuSchuster` ist bereits angemeldet und entspricht dem
   vorbereiteten `info.json.author`. OSS Singularity bleibt Projektidentität
   und Repository-Eigentümer. Ein separates Spices-/Forum-Konto gehört nicht
   zu den dokumentierten Voraussetzungen für diesen Pull-Request.
2. **Supportumfang ist entschieden:** Cinnamon **6.6**, tatsächlich geprüft
   auf 6.6.9. Die Metadatei nennt nur diese Versionsreihe. Claudiu hat die
   zusätzliche Testreihe für 5.8–6.4 ausdrücklich abgewählt.
3. **Kandidatenreview abgeschlossen.** Keine Rechte-Anfragen:
   Claudiu hat eigene Ersatzgrafiken gewählt. Der öffentliche Name ist
   **ChatGPT Usage Monitor**, mit eigenen Quoten-/Chat-/Terminal-Roboter-Symbolen.
   Hintergrund und Layout des Social Previews bleiben erhalten.
   [Rechteprüfung](rights-review.md) und [Dateibelege](rights-inventory.json)
   dokumentieren die Quellen und Lizenzhinweise. Claudiu hat den Namen mit
   „DAS GEHT KLAR BRO“ bestätigt und den Reviewpunkt geschlossen. Screenshots,
   Readiness-Umfang und Paketbeleg sind ebenfalls akzeptiert.

Es müssen jetzt weder ein Forum-Beitrag geschrieben noch eine API-Anwendung,
ein API-Schlüssel oder ein neues OpenAI-Konto angelegt werden. Auch ein Fork
des Spices-Repositories muss nicht manuell vorbereitet werden; dieser kommt
erst beim freigegebenen Einreichungsschritt.

## Was bereits grün ist

- `make verify`: 42 Python-Tests, JavaScript-Regressionen, Paket-Roundtrips,
  PNG-/Quellinventar und die Repository-Prüfungen bestanden.
- Gepinnter Super-Linter erfolgreich; bestehender allgemeiner Hinweis zur
  nicht gesetzten React-Version, kein neuer Codebefund.
- Alle 15 README-Aufnahmen aktuell; helle/dunkle Dialoge, echte
  GTK-Einstellungen, Pfad-Erkennung, Platzhalter/Fokus und Recheck geprüft.
- Transport, Reset-Journal und Sicherheits-Haken, Benachrichtigungen,
  Modell-Anzeigeschalter und 420-px-Menübreite mit gezielten Regressionen.
- Lokales Paket zusätzlich über Cinnamons nativen Spices-Installer installiert:
  23 Dateien byteidentisch, Metadaten bis auf Cinnamons `last-edited` und
  JSON-Formatierung identisch. Im Manager erkannt, gezielter Reload gesund;
  Einstellungen unverändert. Keine echte Reset-Gutschrift für Tests verbraucht.
- Die Beschreibung behält „usage beautifully in view“ und passt einzeilig
  in die geprüfte native Manager-Zeile.
- Neues Installations- und Einreichungspaket besteht den offiziellen
  Strukturvalidator; [genauer Paketbeleg](release-checkpoint.json).

## Technischer Umfang und bewusste Grenzen

- Gettext/POT für JavaScript, Python, Metadaten und Settings ist vorhanden.
  Ein tatsächlich kompilierter Testkatalog prüft Fallback und umsortierte
  Platzhalter. Ausgeliefert wird weiterhin Englisch; Übersetzungen können folgen.
- Cinnamon steuert Öffnen, Schließen und Menü-Stack. Native Prüfungen umfassen
  Tastaturfokus, benannte Aktionen, wiederholtes Öffnen und Entfernen mit Tooltip.
- Normale Schrift behält 420 px. Bei größerer Schrift wächst die Breite;
  Ringe, Labels und Graphen werden auf tatsächliche Inhaltsgrenzen geprüft.
  Lange Menüs scrollen auf kleinen Bildschirmen, auch zum Tastaturfokus.
- Geprüfte Basis: Cinnamon 6.6.9/X11, Mint-Y und Mint-Y-Dark-Aqua,
  100% Display-Skalierung, 100–200% Schrift, 1366×768 und 1920×1080.
  Mehrmonitor/Mixed-DPI, fraktionale Display-Skalierung, RTL, High-Contrast-
  Shell-Themes und vollständige Orca-Bedienung sind damit nicht zertifiziert.
- History bleibt bewusst dem Desktopprofil zugeordnet. Die dokumentierte
  manuelle Archivierung bei Konto-Wechsel sowie die unabhängige Reset-Journal-
  Grenze sind mit synthetischen Daten geprüft; keine Zugangsdaten wurden gelesen.

Die sechs geschützten **Remote-PR-Prüfungen** sind erfolgreich auf
[Projekt-PR #46](https://github.com/oss-singularity/cinnamon-chatgpt-usage/pull/46).
Auch beide Workflows nach dem Merge sind erfolgreich. Den aktuellen Status hält das
[Release-Issue](https://github.com/oss-singularity/cinnamon-chatgpt-usage/issues/45) fest.
Die [Readiness-Dokumentation](spices-readiness.md) und der
[Paketbeleg](release-checkpoint.json) halten den genauen Umfang fest.

## Reihenfolge ab hier

1. **Erledigt:** Claudiu hat Bilder, Readiness-Umfang und Paketbeleg akzeptiert.
   UUID bleibt `chatgpt-usage@oss-singularity`; kein zusätzlicher 0.4.0-Release.
2. **Erledigt:** Projekt-PR #46 gemergt; Spices-PR
   [#9024](https://github.com/linuxmint/cinnamon-spices-applets/pull/9024)
   mit `ClaudiuSchuster` als Maintainer abgesendet. OSS Singularity bleibt
   Projektidentität. Upstream-Review und Freigabe des PR-Workflows stehen aus.
3. **Jetzt:** Den freigegebenen GitHub-Release 1.0.0 mit Installations-ZIP und
   Prüfsummen veröffentlichen. Die Release-Notizen benennen den offenen
   Spices-Status ausdrücklich; ein GitHub-Release bedeutet keine Katalogaufnahme.
4. Nach Annahme den tatsächlichen Katalogeintrag, das heruntergeladene Paket
   und Installation/Update über Cinnamon prüfen. Erst dann als **offizielle
   Spice** ankündigen und die vorbereiteten Katalog-/Forum-Texte mit den
   tatsächlich verifizierten Links vervollständigen.

## Offizielle Referenzen

- [Einreichung, Autor und Workflow](https://github.com/linuxmint/cinnamon-spices-applets/blob/b425f4d648196d279ff972d642f1693d5b23b55b/README.md)
- [Ein Applet pro PR und Titelformat](https://github.com/linuxmint/cinnamon-spices-applets/blob/b425f4d648196d279ff972d642f1693d5b23b55b/.github/CONTRIBUTING.md)
- [Technische Reviewregeln einschließlich Übersetzbarkeit](https://github.com/linuxmint/cinnamon-spices-applets/blob/b425f4d648196d279ff972d642f1693d5b23b55b/.github/copilot-instructions.md)
- [OpenAI-Logo- und Markennutzungsbedingungen](https://openai.com/brand/)

Die Artwork-Frage betrifft die belegbare Verwendung konkreter Dateien;
dieses Dokument trifft keine rechtliche Feststellung über deren Zulässigkeit.
