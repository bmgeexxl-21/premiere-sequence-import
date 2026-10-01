// Erkennt Einzelbildsequenzen anhand nummerierter Dateinamen.
// Reines JavaScript ohne UXP-Abhängigkeiten, damit es auch mit Node getestet werden kann.

const DEFAULT_EXTENSIONS = [
  "png", "jpg", "jpeg", "tif", "tiff", "exr", "dpx", "tga", "bmp", "psd", "gif", "heic", "heif"
];

// Präfix (beliebig, auch leer) + Zahl am Ende des Namens + Endung.
// Beispiele: "frame_0001.png", "shot01.0042.exr", "0001.jpg"
const NUMBERED = /^(.*?)(\d+)\.([A-Za-z0-9]+)$/;

function parseFileName(name) {
  const m = NUMBERED.exec(name);
  if (!m) return null;
  return {
    prefix: m[1],
    digits: m[2],
    number: parseInt(m[2], 10),
    ext: m[3].toLowerCase()
  };
}

function cleanName(prefix) {
  return prefix.replace(/[\s._-]+$/, "").replace(/^[\s._-]+/, "");
}

/**
 * Findet die Sequenzen in EINEM Ordner.
 * @param {Array<{name:string, path:string}>} files  Dateien des Ordners
 * @param {object} opts
 *   extensions: erlaubte Endungen (klein, ohne Punkt)
 *   minFrames:  Mindestanzahl Bilder, damit es als Sequenz zählt
 *   splitGaps:  bei Lücken in der Nummerierung mehrere Clips erzeugen
 *   folderName: Name des Ordners (Fallback für den Clipnamen)
 * @returns {Array<object>} Sequenzen, sortiert nach Name
 */
function detectSequencesInFolder(files, opts = {}) {
  const extensions = new Set((opts.extensions || DEFAULT_EXTENSIONS).map((e) => e.toLowerCase()));
  const minFrames = Math.max(1, opts.minFrames || 2);
  const splitGaps = opts.splitGaps !== false;

  const groups = new Map();
  for (const file of files) {
    if (file.name.startsWith(".")) continue; // ._Dateien von macOS, versteckte Dateien
    const p = parseFileName(file.name);
    if (!p || !extensions.has(p.ext)) continue;
    const key = p.prefix + "\u0000" + p.ext;
    if (!groups.has(key)) groups.set(key, { prefix: p.prefix, ext: p.ext, frames: [] });
    groups.get(key).frames.push({ number: p.number, digits: p.digits, name: file.name, path: file.path });
  }

  const result = [];
  for (const g of groups.values()) {
    g.frames.sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));

    // Doppelte Nummern (z. B. "f_1.png" und "f_001.png") entfernen, erstes behalten.
    const frames = g.frames.filter((f, i, arr) => i === 0 || arr[i - 1].number !== f.number);

    const runs = [];
    let current = [frames[0]];
    for (let i = 1; i < frames.length; i++) {
      if (splitGaps && frames[i].number !== frames[i - 1].number + 1) {
        runs.push(current);
        current = [];
      }
      current.push(frames[i]);
    }
    runs.push(current);

    const valid = runs.filter((r) => r.length >= minFrames);
    const base = cleanName(g.prefix) || opts.folderName || "Sequenz";
    valid.forEach((run, idx) => {
      const first = run[0];
      const last = run[run.length - 1];
      const widths = new Set(run.map((f) => f.digits.length));
      const expected = last.number - first.number + 1;
      result.push({
        name: valid.length > 1 ? `${base}_teil${idx + 1}` : base,
        prefix: g.prefix,
        ext: g.ext,
        firstPath: first.path,
        firstName: first.name,
        start: first.number,
        end: last.number,
        frameCount: run.length,
        missingFrames: expected - run.length,
        mixedPadding: widths.size > 1
      });
    });
  }

  // Gleiche Namen (z. B. "shot.png"-Serie und "shot.exr"-Serie) über die Endung unterscheiden.
  const counts = new Map();
  for (const s of result) counts.set(s.name, (counts.get(s.name) || 0) + 1);
  for (const s of result) if (counts.get(s.name) > 1) s.name = `${s.name}_${s.ext}`;

  result.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return result;
}

module.exports = { detectSequencesInFolder, parseFileName, DEFAULT_EXTENSIONS };
