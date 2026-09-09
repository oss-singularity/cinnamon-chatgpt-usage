# Veröffentlichung und Upstream-Nachlauf

Stand: 9. September 2026. Die ursprüngliche 1.0.0-Einreichung und der aktuelle
1.0.4-Release sind veröffentlicht; der falsch entstandene 1.0.2-Release samt Tag
wurde nach der Verifikation entfernt. Historische Receipts bleiben als Provenienz
im Repository erhalten. Version 1.0.4 deklariert Cinnamon 5.8,
6.0, 6.2, 6.4 und 6.6. Die Aufnahme in den Cinnamon-Katalog steht noch aus.
Die folgenden ursprünglichen Freigaben und Nachlauf-Schritte bleiben als
Hand-off dokumentiert.

## Main-first-Release-Gate

Ein GitHub-Release darf erst entstehen, wenn der vollständige Quellstand über
einen PR in `main` gelandet ist. GitHubs `targetCommitish`-Anzeige ist dafür
kein Herkunftsnachweis; maßgeblich ist der Commit, auf den der Tag tatsächlich
zeigt.

Für jede neue Version gilt daher diese Reihenfolge:

1. `git fetch --prune origin main --tags`
2. `python3 scripts/check-release-base.py --version X.Y.Z`
3. Paket exportieren, validieren und den Release-Receipt auf diesem sauberen,
   exakt zu `origin/main` passenden Checkout committen.
4. Den annotierten Tag `vX.Y.Z` auf genau diesen `main`-Commit setzen und
   anschließend mit `python3 scripts/check-release-base.py --version X.Y.Z --tag vX.Y.Z`
   den aufgewickelten Tag verifizieren.
5. Erst danach GitHub-Release und Assets veröffentlichen.

Ein bereits falsch erzeugter Tag wird nicht verschoben. Nach einem explizit
freigegebenen Aufräumen werden der falsche Release und Tag erst gelöscht, wenn
der korrigierte Release verifiziert und alle aktiven externen Verweise angepasst
sind. Die historischen Receipts bleiben als Provenienz im Repository erhalten.

## Bereits von Claudiu freigegeben

1. **Keinen neuen Account registrieren.** Die Einreichung erfolgt über einen
   GitHub-Pull-Request an `linuxmint/cinnamon-spices-applets`. Der vorhandene
   Account `ClaudiuSchuster` ist bereits angemeldet und entspricht dem
   vorbereiteten `info.json.author`. OSS Singularity bleibt Projektidentität
   und Repository-Eigentümer. Ein separates Spices-/Forum-Konto gehört nicht
   zu den dokumentierten Voraussetzungen für diesen Pull-Request.
2. **Supportumfang der Erstfreigabe:** Cinnamon **6.6**, tatsächlich geprüft
   auf 6.6.9. Version 1.0.4 erweitert die Metadaten nun auf die deklarierte
   Reihe 5.8, 6.0, 6.2, 6.4 und 6.6; der native Live-Nachweis bleibt 6.6.9.
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

- `make verify`: 45 Python-Tests, JavaScript-Regressionen, Paket-Roundtrips,
  PNG-/Quellinventar und die Repository-Prüfungen bestanden.
- Gepinnter Super-Linter erfolgreich; bestehender allgemeiner Hinweis zur
  nicht gesetzten React-Version, kein neuer Codebefund.
- Alle 15 README-Aufnahmen aktuell; helle/dunkle Dialoge, echte
  GTK-Einstellungen, Pfad-Erkennung, Platzhalter/Fokus und Recheck geprüft.
- Transport, Reset-Journal und Sicherheits-Haken, Benachrichtigungen,
  Modell-Anzeigeschalter und 420-px-Menübreite mit gezielten Regressionen.
- Lokales Paket zusätzlich über Cinnamons nativen Spices-Installer installiert:
  25 Dateien byteidentisch und als reguläre Dateien vorhanden. Im Manager
  erkannt, gezielter Reload gesund;
  Einstellungen unverändert. Keine echte Reset-Gutschrift für Tests verbraucht.
- Die Beschreibung behält „usage beautifully in view“ und passt einzeilig
  in die geprüfte native Manager-Zeile.
- Neues Installations- und Einreichungspaket besteht den offiziellen
  Strukturvalidator; [genauer Paketbeleg](release-1.0.4.json).

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
[Projekt-PR #52](https://github.com/oss-singularity/cinnamon-chatgpt-usage/pull/52).
Auch beide Workflows nach dem Merge sind erfolgreich. Den aktuellen Status hält das
[Release-Issue](https://github.com/oss-singularity/cinnamon-chatgpt-usage/issues/45) fest.
Die [Readiness-Dokumentation](spices-readiness.md) und der
[Paketbeleg](release-1.0.4.json) halten den genauen Umfang fest.

## Reihenfolge ab hier

1. **Erledigt:** Claudiu hat Bilder, Readiness-Umfang und Paketbeleg akzeptiert.
   UUID bleibt `chatgpt-usage@oss-singularity`; kein zusätzlicher 0.4.0-Release.
2. **Erledigt:** Projekt-PR #52 gemergt; Spices-PR
   [#9024](https://github.com/linuxmint/cinnamon-spices-applets/pull/9024)
   mit `ClaudiuSchuster` als Maintainer abgesendet. OSS Singularity bleibt
   Projektidentität. Source-Release 1.0.4, Main-first-Tag und Upstream-PR-
   Synchronisierung sind erledigt; nur die Upstream-Katalogaufnahme steht aus.
3. **Erledigt:** GitHub-Release 1.0.4 mit Installations-ZIP und Prüfsummen
   veröffentlicht. Der falsche 1.0.2-Release/Tag wurde erst nach Aktualisierung
   aller aktiven Upstream-Verweise entfernt; ein GitHub-Release bedeutet keine
   Katalogaufnahme.
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
