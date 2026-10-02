# Bildsequenz-Import für Premiere Pro 2026

Ein UXP-Panel für Premiere Pro, das einen Ordner samt aller Unterordner durchsucht, nummerierte Einzelbildsequenzen erkennt und jede als Videoclip importiert.

**Schritt-für-Schritt zum Aufrufen und Testen: [ANLEITUNG.md](ANLEITUNG.md)**

## Was das Plugin macht

- Ordner wählen, das Plugin scannt rekursiv alle Unterordner.
- In jedem Ordner werden Dateien nach Muster `Präfix + Nummer + Endung` gruppiert, z. B. `intro_0001.png … intro_0250.png` oder `0001.exr …`. Mehrere Sequenzen pro Ordner sind möglich.
- Vor dem Import zeigt eine Liste alle gefundenen Sequenzen mit Bildanzahl, Nummernbereich und Warnungen (fehlende Bilder, uneinheitliche Nummernlänge). Einzelne Sequenzen lassen sich abwählen.
- Import als nummerierte Standbilder, also als ein Clip pro Sequenz.

Optionen im Panel:

| Option | Standard | Wirkung |
|---|---|---|
| Ordnerstruktur als Bins nachbilden | an | `Shoot/Szene1/Detail` auf der Platte wird zu den Bins `Shoot › Szene1 › Detail`. Vorhandene Bins werden wiederverwendet. Aus: alles landet im Projektstamm. |
| Clips nach Sequenz benennen | an | Clip heißt `intro` statt `intro_0001.png`. Besteht der Name nur aus Ziffern, wird der Ordnername verwendet. |
| Bei Lücken in mehrere Clips teilen | an | Fehlen z. B. Bild 6 und 7, entstehen `name_teil1` (1–5) und `name_teil2` (8–12). Aus: eine Sequenz mit Warnung. |
| Bildrate | 25 | Setzt die Bildrate jedes Clips. Leer lassen, um Premieres Voreinstellung „Unbestimmte Medien-Zeitbasis“ zu nutzen. Kommazahlen wie `23,976` gehen. |
| Danach als Film in neue Sequenz legen | aus | Legt alle importierten Clips in der Reihenfolge der Liste lückenlos hintereinander in eine neue Sequenz und öffnet sie im Schnittfenster. Die Sequenzeinstellungen (Auflösung, Bildrate) übernimmt Premiere vom ersten Clip. Die Sequenz liegt im obersten Bin. |
| Name der Sequenz | Ordnername | Name der neuen Sequenz. |
| Pause zwischen Importen | 300 ms | Wartezeit nach jedem Clip, damit Premiere den Import abschließen kann. Name und Bildrate werden erst gesetzt, wenn alle Clips importiert sind. |
| Mindestanzahl Bilder | 3 | Kürzere Nummernfolgen (z. B. `logo1.png`) werden ignoriert. |
| Dateiendungen | png, jpg, jpeg, tif, tiff, exr, dpx, tga, bmp, psd, gif, heic, heif | Nur diese Formate werden berücksichtigt. |

Jeder Import-Schritt wird vorher in `import-protokoll.txt` im Datenordner des Plugins geschrieben. Stürzt Premiere ab, zeigt das Panel beim nächsten Öffnen, bei welcher Sequenz es passiert ist.

Versteckte Dateien und macOS-Reste (`.DS_Store`, `._datei.png`) werden übersprungen.

## Voraussetzungen

- Premiere Pro 2026 (Version 26.x). Die verwendete Premiere-UXP-API gibt es ab Version 25.6, ältere Versionen laden das Plugin nicht.
- Zum Laden während der Entwicklung: **Adobe UXP Developer Tool (UDT)**, kostenlos über die Creative-Cloud-App installierbar.

## Installation

### Variante A: Laden mit dem UXP Developer Tool (zum Ausprobieren)

1. Den Ordner `plugin/` auf deinen Rechner kopieren.
2. Premiere Pro starten und ein Projekt öffnen.
3. Falls Premiere es verlangt, unter *Einstellungen › Plugins* den Entwicklermodus aktivieren und Premiere neu starten.
4. UXP Developer Tool öffnen, bei der Frage nach dem Entwicklermodus zustimmen.
5. *Add Plugin* klicken und `plugin/manifest.json` auswählen.
6. In der Zeile des Plugins *Actions › Load* wählen.
7. In Premiere über *Fenster › UXP-Plugins › Bildsequenz-Import* (bzw. *Window › UXP Plugins*) das Panel öffnen.

### Variante B: Dauerhaft installieren

1. Im UXP Developer Tool beim Plugin *Actions › Package* wählen. Es entsteht eine `.ccx`-Datei.
2. Die `.ccx`-Datei doppelklicken. Die Creative-Cloud-App installiert das Plugin.
3. Premiere neu starten, das Panel liegt im selben Menü wie oben.

## Benutzung

1. *Ordner wählen…* klicken und den obersten Ordner auswählen.
2. Liste prüfen, ggf. Sequenzen abwählen. Nach Änderungen an Lücken, Mindestanzahl oder Endungen wird automatisch neu gescannt.
3. *Importieren* klicken. Das Protokoll unten zeigt jeden Clip mit ✓ oder den Fehler mit ✗.

Jeder Schritt ist in Premiere rückgängig machbar (Bearbeiten › Rückgängig).

## Dateien

```
plugin/
  manifest.json   Plugin-Beschreibung für Premiere (UXP, manifestVersion 5)
  index.html      Panel-Oberfläche
  main.js         Ordner scannen, Bins anlegen, Import, Umbenennen, Bildrate
  sequences.js    Sequenzerkennung (reines JavaScript, ohne Premiere testbar)
  icons/          Panel- und Plugin-Symbol
test/
  sequences.test.js   Tests der Erkennung: node test/sequences.test.js
  Testdaten.zip       Beispielordner mit 7 Bildsequenzen für den Test in Premiere
  make_testdata.py    erzeugt die Testdaten neu (python3 test/make_testdata.py <Ziel>)
ANLEITUNG.md          Schritt-für-Schritt-Anleitung zum Laden und Testen
```

## Stand der Tests

- Die Sequenzerkennung ist mit Node getestet (Präfixe mit Ziffern, mehrere Sequenzen pro Ordner, Lücken, nur-Ziffern-Namen, numerische Sortierung, gleiche Präfixe mit verschiedenen Endungen, Störfiles).
- Der Ablauf im Panel (Scan, Bin-Struktur, Import, Umbenennen, Bildrate, Wiederverwenden vorhandener Bins) wurde gegen nachgebaute Premiere- und Dateisystem-Objekte getestet.
- **Noch nicht in einem echten Premiere Pro 2026 getestet.** Die API-Aufrufe folgen Adobes Referenz und dem offiziellen Beispiel-Plugin (`importFiles(..., asNumberedStills = true)`, `createBinAction`, `createSetNameAction`, `createSetOverrideFrameRateAction`).

## Bekannte Grenzen

- Premiere importiert ab dem ersten Bild fortlaufend. Ist die Nummerierung uneinheitlich lang (`f_9.png`, `f_10.png`), kann Premiere die Sequenz eventuell nicht vollständig erkennen; das Panel warnt in diesem Fall.
- Ein erneuter Import desselben Ordners legt die Clips ein zweites Mal an (Bins werden aber wiederverwendet).
