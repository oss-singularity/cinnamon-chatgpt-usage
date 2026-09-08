# Nächster Schritt zur ersten offiziellen Spice

Stand: 8. September 2026. Funktionsbasis vor der aktuellen Grafik-/Paketänderung:
[`314a4ca`](https://github.com/oss-singularity/cinnamon-chatgpt-usage/commit/314a4ca699a15f57e5c423226e1e9035af911959).
Die Version ist weiterhin **0.3.12**, das Ziel **1.0.0**. Das vorliegende
Paket ist ein Prüfstand, noch keine freigegebene Veröffentlichung.

## Was Claudiu jetzt tun muss

1. **Keinen neuen Account registrieren.** Die Einreichung erfolgt über einen
   GitHub-Pull-Request an `linuxmint/cinnamon-spices-applets`. Der vorhandene
   Account `ClaudiuSchuster` ist bereits angemeldet und entspricht dem
   vorbereiteten `info.json.author`. OSS Singularity bleibt Projektidentität
   und Repository-Eigentümer. Ein separates Spices-/Forum-Konto gehört nicht
   zu den dokumentierten Voraussetzungen für diesen Pull-Request.
2. **Supportumfang ist entschieden:** Cinnamon **6.6**, tatsächlich geprüft
   auf 6.6.9. Die Metadatei nennt nur diese Versionsreihe. Claudiu hat die
   zusätzliche Testreihe für 5.8–6.4 ausdrücklich abgewählt.
3. **Nur noch den konkreten Kandidaten reviewen.** Keine Rechte-Anfragen:
   Claudiu hat eigene Ersatzgrafiken gewählt. Der öffentliche Name ist
   **ChatGPT Usage Monitor**, mit eigenen Quoten-/Chat-/Terminal-Roboter-Symbolen.
   Hintergrund und Layout des Social Previews bleiben erhalten.
   [Rechteprüfung](rights-review.md) und [Dateibelege](rights-inventory.json)
   dokumentieren die Quellen und Lizenzhinweise. Der ausdrücklich gewählte
   öffentliche Name **ChatGPT Usage Monitor** bleibt als Marken-/Namensfrage
   offen; eigene Grafiken allein klären diese Verwendung nicht abschließend.

Es müssen jetzt weder ein Forum-Beitrag geschrieben noch eine API-Anwendung,
ein API-Schlüssel oder ein neues OpenAI-Konto angelegt werden. Auch ein Fork
des Spices-Repositories muss nicht manuell vorbereitet werden; dieser kommt
erst beim freigegebenen Einreichungsschritt.

## Was bereits grün ist

- `make verify`: 38 Python-Tests, JavaScript-Regressionen, Paket-Roundtrips,
  PNG-/Quellinventar und die Repository-Prüfungen bestanden.
- Gepinnter Super-Linter erfolgreich; bestehender allgemeiner Hinweis zur
  nicht gesetzten React-Version, kein neuer Codebefund.
- Alle 15 README-Aufnahmen aktuell; helle/dunkle Dialoge, echte
  GTK-Einstellungen, Pfad-Erkennung, Platzhalter/Fokus und Recheck geprüft.
- Transport, Reset-Journal und Sicherheits-Haken, Benachrichtigungen,
  Modell-Anzeigeschalter und 420-px-Menübreite mit gezielten Regressionen.
- Normaler lokaler Install/Reload: alle 23 Paketdateien identisch, gesunde
  laufende Instanz. Keine echte Reset-Gutschrift für Tests verbraucht.
- Neues Installations- und Einreichungspaket besteht den offiziellen
  Strukturvalidator; [genauer Paketbeleg](release-checkpoint.json).

## Was noch Arbeit ist

Diese Punkte werden nicht dadurch erledigt, dass der Strukturvalidator grün ist:

| Punkt                 | Tatsächlicher Stand                                                                 | Nächste technische Arbeit                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Übersetzbarkeit       | Kein Gettext/POT; auch das neue GTK-Feld enthält englische Texte                    | Vollständige Nachrichten und Platzhalter übersetzbar machen; Extraktion/POT für JS, Python und Settings prüfen                                                                    |
| Unterstützte Umgebung | Cinnamon 6.6 beschlossen, Metadaten entsprechend eingegrenzt; GUI auf 6.6.9 geprüft | Verbleibenden API-/Bedienreview auf 6.6 abschließen; keine ältere Testmatrix                                                                                                      |
| Bedien-/Layoutmatrix  | Viele konkrete Dialog-/Fokus-/Theme-Tests vorhanden                                 | Noch fehlende Skalierungs-, High-Contrast-, große-Schrift-, RTL-, Panel-/Mehrmonitor- und Screenreader-Prüfungen abschließen oder den unterstützten Umfang ausdrücklich begrenzen |
| Cinnamon-Integration  | Menüeigene private Methoden und `global.menuStack` werden noch verwendet            | Gegen die aktuellen Upstream-Reviewregeln prüfen; nötige Anpassungen und Teardown-/Responsiveness-Nachweise erbringen                                                             |
| Konto-/History-Grenze | Verlauf gehört zum Desktopprofil, nicht zu einer Konto-ID                           | Dokumentierte Begrenzung beibehalten; Wechsel-/Retry-Grenzen mit Fixtures prüfen, ohne echte Zugangsdaten auszulesen                                                              |
| Veröffentlichung      | Noch kein Projekt-PR, keine Remote-PR-Prüfungen                                     | Erst den fertigen Kandidaten vorlegen, dann die sechs geschützten Checks am Projekt-PR ausführen                                                                                  |

Das sind konkrete Restarbeiten. Sie sind keine Aufforderung, dass Claudiu
sämtliche Tests selbst ausführt. Die ausführliche
[Readiness-Dokumentation](spices-readiness.md) bleibt die technische Referenz.

## Reihenfolge ab hier

1. Die technischen Restarbeiten für Cinnamon 6.6 und den abschließenden Asset-Abgleich
   abschließen. UUID bleibt `chatgpt-usage@oss-singularity`.
2. Einen konkreten 1.0.0-Kandidaten mit endgültigem Namen/Artwork,
   Übersetzungsgrundlage, Changelog, Bildern und neuen Paket-Hashes vorlegen.
   Ein zusätzlicher öffentlicher 0.4.0-Zwischenrelease ist dafür nicht nötig.
3. Nach Claudius Review den Projekt-PR erstellen; die sechs geschützten
   Prüfungen bestehen lassen und den Merge separat freigeben lassen.
4. Den fertigen Spices-Pull-Request mit genau einem Applet vorlegen und erst
   nach Freigabe absenden. Dafür den persönlichen GitHub-Maintainer verwenden;
   eine gewünschte Organisation als `info.json.author` vorher mit Upstream
   klären. Die bereits akzeptierte persönliche Variante ist kein Blocker.
5. Nach Annahme den tatsächlichen Katalogeintrag, das heruntergeladene Paket
   und Installation/Update über Cinnamon prüfen. Erst dann als **offizielle
   Spice** ankündigen. Tag, GitHub Release und öffentliche Beiträge bleiben
   einzeln reviewbare Schritte; es erfolgt keine automatische Veröffentlichung.

## Offizielle Referenzen

- [Einreichung, Autor und Workflow](https://github.com/linuxmint/cinnamon-spices-applets/blob/b425f4d648196d279ff972d642f1693d5b23b55b/README.md)
- [Ein Applet pro PR und Titelformat](https://github.com/linuxmint/cinnamon-spices-applets/blob/b425f4d648196d279ff972d642f1693d5b23b55b/.github/CONTRIBUTING.md)
- [Technische Reviewregeln einschließlich Übersetzbarkeit](https://github.com/linuxmint/cinnamon-spices-applets/blob/b425f4d648196d279ff972d642f1693d5b23b55b/.github/copilot-instructions.md)
- [OpenAI-Logo- und Markennutzungsbedingungen](https://openai.com/brand/)

Die Artwork-Frage betrifft die belegbare Verwendung konkreter Dateien;
dieses Dokument trifft keine rechtliche Feststellung über deren Zulässigkeit.
