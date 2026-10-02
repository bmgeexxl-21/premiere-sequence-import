# Anleitung: Plugin aufrufen und testen

Diese Anleitung führt dich vom Download bis zum fertig importierten Clip. Rechne mit etwa 15 Minuten beim ersten Mal.

## Was du brauchst

- Premiere Pro 2026 (Version 26.x; mindestens 25.6 geht auch)
- Die Creative-Cloud-App
- Den Ordner `plugin/` aus diesem Repo und die Datei `Testdaten.zip`

---

## Teil 1: Einmalige Vorbereitung

### Schritt 1: Dateien holen

1. Auf GitHub das Repo öffnen: https://github.com/bmgeexxl-21/premiere-sequence-import
2. Oben rechts auf **Code › Download ZIP** klicken.
3. Die ZIP-Datei entpacken, z. B. nach `Dokumente/premiere-sequence-import`.
4. Darin liegt `test/Testdaten.zip`. Auch diese Datei entpacken. Es entsteht ein Ordner `Testdaten`.

Merke dir, wo der Ordner `plugin` liegt. Du brauchst ihn in Schritt 4.

### Schritt 2: UXP Developer Tool installieren

1. Die Creative-Cloud-App öffnen.
2. Nach **UXP Developer Tool** suchen (benötigt wird Version 2.2 oder neuer).
3. Auf **Installieren** klicken.

### Schritt 3: Entwicklermodus in Premiere einschalten

1. Premiere Pro starten.
2. Menü **Einstellungen** öffnen (Mac: *Premiere Pro › Einstellungen*, Windows: *Bearbeiten › Einstellungen*).
3. Den Reiter **Plugins** wählen.
4. Das Häkchen bei **Entwicklermodus aktivieren** (*Enable developer mode*) setzen.
5. Premiere Pro beenden und neu starten.

---

## Teil 2: Plugin laden

### Schritt 4: Plugin im UXP Developer Tool hinzufügen

1. In Premiere ein beliebiges Projekt öffnen oder ein neues anlegen (*Datei › Neu › Projekt*).
2. Das **UXP Developer Tool** öffnen. Fragt es nach dem Entwicklermodus, mit **Ja** bestätigen.
3. Oben auf **Add Plugin** klicken.
4. Im Ordner `plugin` die Datei **manifest.json** auswählen.
5. In der Liste erscheint jetzt **Bildsequenz-Import** mit *Adobe Premiere Pro* als App.

### Schritt 5: Plugin starten

1. In der Zeile von *Bildsequenz-Import* rechts auf **•••** (Actions) klicken und **Load** wählen. Alternativ **Load & Watch**: dann lädt das Plugin automatisch neu, wenn sich eine Datei ändert.
2. In Premiere öffnet sich das Panel **Bildsequenz-Import**.
3. Falls nicht: In Premiere das Menü **Fenster › UXP-Plugins › Bildsequenz-Import** öffnen (englisch: *Window › UXP Plugins*).

Das Panel lässt sich wie jedes andere Premiere-Fenster andocken.

---

## Teil 3: Mit den Testdaten testen

### Schritt 6: Ordner scannen

1. Im Panel auf **Ordner wählen…** klicken.
2. Beim ersten Mal fragt Premiere evtl., ob das Plugin auf Dateien zugreifen darf. Erlauben.
3. Den entpackten Ordner **Testdaten** auswählen.

Im Panel sollten jetzt **7 Sequenzen** stehen:

| Name | Ort | Bilder | Was getestet wird |
|---|---|---|---|
| intro | Testdaten | 48 | Sequenz im obersten Ordner; `notiz.txt` daneben wird ignoriert |
| shot_teil1 | Testdaten / Luecke | 10 | Lücke in der Nummerierung (Bild 11–13 fehlen) |
| shot_teil2 | Testdaten / Luecke | 17 | zweiter Teil nach der Lücke |
| cam | Testdaten / Szene1 | 72 | Unterordner |
| Detail | Testdaten / Szene1 / Detail | 24 | Unter-Unterordner; Dateien heißen nur `0001.png`, deshalb Ordnername als Clipname |
| a | Testdaten / ZweiSerien | 24 | zwei Serien im selben Ordner |
| b | Testdaten / ZweiSerien | 24 | zwei Serien im selben Ordner |

Unten im Protokoll steht „7 Sequenz(en) gefunden.“

### Schritt 7: Importieren

1. Alle Häkchen gesetzt lassen.
2. Auf **Importieren** klicken.
3. Das Protokoll zeigt pro Clip eine Zeile mit ✓ und am Ende „Fertig: 7 von 7 importiert.“

### Schritt 8: Ergebnis im Projektfenster prüfen

Im Projektfenster sollte jetzt diese Struktur stehen:

```
Testdaten
├── intro
├── Luecke
│   ├── shot_teil1
│   └── shot_teil2
├── Szene1
│   ├── cam
│   └── Detail
│       └── Detail
└── ZweiSerien
    ├── a
    └── b
```

Prüfe außerdem:

- [ ] Jeder Eintrag ist **ein** Clip, nicht viele Einzelbilder.
- [ ] Ein Doppelklick auf `intro` zeigt im Quellmonitor einen weißen Balken, der beim Abspielen von links nach rechts wandert.
- [ ] Die Dauer von `intro` ist knapp 2 Sekunden (48 Bilder bei 25 fps).
- [ ] Rechtsklick auf einen Clip › **Ändern › Filmmaterial interpretieren** zeigt 25 fps.
- [ ] **Bearbeiten › Rückgängig** macht den Import Schritt für Schritt rückgängig.

### Schritt 9: Optionen ausprobieren (optional)

- Häkchen **Bei Lücken in mehrere Clips teilen** entfernen: Das Panel scannt neu, statt `shot_teil1/2` steht nur noch `shot` mit dem Hinweis „3 Bild(er) fehlen“.
- **Mindestanzahl Bilder** auf `30` setzen: Nur noch `intro` (48) und `cam` (72) bleiben übrig.
- **Bildrate** leeren: Premiere nimmt seine Voreinstellung (*Einstellungen › Medien › Unbestimmte Medien-Zeitbasis*).
- **Ordnerstruktur als Bins nachbilden** ausschalten: Alle Clips landen direkt im Projektstamm.
- Zum Wiederholen vorher die Bins im Projektfenster löschen, sonst entstehen doppelte Clips.

Danach mit deinem echten Material testen.

---

## Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| UXP Developer Tool findet Premiere nicht | Premiere muss laufen, der Entwicklermodus muss an sein (Schritt 3) und Premiere danach neu gestartet worden sein. |
| Fehler beim Laden: Version passt nicht | Premiere ist älter als 25.6. Über die Creative-Cloud-App aktualisieren. |
| Panel ist leer oder weiß | Im UXP Developer Tool **••• › Debug** öffnen. Unter *Console* stehen die Fehlermeldungen. |
| „Kein Projekt geöffnet.“ | Erst in Premiere ein Projekt öffnen, dann importieren. |
| Ein Clip hat ✗ im Protokoll | Den Text der Zeile kopieren und mir schicken. |
| Clip zeigt nur ein Standbild | Bitte melden, mit dem Dateinamen des ersten Bildes. |

Nach Änderungen an `manifest.json` im UXP Developer Tool erst **Unload**, dann wieder **Load** klicken. Bei Änderungen an anderen Dateien reicht **Reload**, mit *Load & Watch* passiert das automatisch.

## Dauerhaft installieren (wenn alles klappt)

1. Im UXP Developer Tool **••• › Package** wählen. Es entsteht eine `.ccx`-Datei.
2. Die `.ccx`-Datei doppelklicken, die Creative-Cloud-App installiert das Plugin.
3. Premiere neu starten. Ab jetzt ist das Panel ohne UXP Developer Tool unter *Fenster › UXP-Plugins* verfügbar.

## Testdaten selbst neu erzeugen

Wer Python 3 hat, kann die Testdaten auch neu erzeugen:

```
python3 test/make_testdata.py <Zielordner>
```
