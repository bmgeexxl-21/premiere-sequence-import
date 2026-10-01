// Ausführen mit: node test/sequences.test.js
const assert = require("assert");
const { detectSequencesInFolder, parseFileName } = require("../plugin/sequences.js");

const f = (names) => names.map((n) => ({ name: n, path: "/x/" + n }));
const range = (pre, a, b, ext, pad = 4) =>
  Array.from({ length: b - a + 1 }, (_, i) => `${pre}${String(a + i).padStart(pad, "0")}.${ext}`);

// Präfix mit Zahlen
assert.deepStrictEqual(parseFileName("shot01_frame0042.png"), { prefix: "shot01_frame", digits: "0042", number: 42, ext: "png" });
assert.strictEqual(parseFileName("readme.txt"), null);

// Einfache Sequenz
let r = detectSequencesInFolder(f(range("frame_", 1, 100, "png")), { minFrames: 3 });
assert.strictEqual(r.length, 1);
assert.strictEqual(r[0].name, "frame");
assert.strictEqual(r[0].frameCount, 100);
assert.strictEqual(r[0].firstName, "frame_0001.png");

// Zwei Sequenzen im selben Ordner plus Störfiles
r = detectSequencesInFolder(f([...range("A_", 1, 10, "png"), ...range("B.", 5, 9, "EXR"), "notes.txt", "logo1.png", ".DS_Store", "._A_0001.png"]), { minFrames: 3 });
assert.deepStrictEqual(r.map((s) => [s.name, s.frameCount, s.start]), [["A", 10, 1], ["B", 5, 5]]);

// Lücke: geteilt bzw. nicht geteilt
const gap = f([...range("g", 1, 5, "jpg"), ...range("g", 8, 12, "jpg")]);
r = detectSequencesInFolder(gap, { minFrames: 3 });
assert.deepStrictEqual(r.map((s) => [s.name, s.start, s.end]), [["g_teil1", 1, 5], ["g_teil2", 8, 12]]);
r = detectSequencesInFolder(gap, { minFrames: 3, splitGaps: false });
assert.strictEqual(r.length, 1);
assert.strictEqual(r[0].missingFrames, 2);

// Nur Zahlen als Name -> Ordnername
r = detectSequencesInFolder(f(range("", 0, 4, "tif")), { minFrames: 3, folderName: "Render_v2" });
assert.strictEqual(r[0].name, "Render_v2");

// Sortierung: Zahlen numerisch, nicht alphabetisch
r = detectSequencesInFolder(f(["x_9.png", "x_10.png", "x_11.png", "x_8.png"]), { minFrames: 2 });
assert.strictEqual(r[0].firstName, "x_8.png");
assert.strictEqual(r[0].frameCount, 4);

// Gleicher Präfix, unterschiedliche Endung
r = detectSequencesInFolder(f([...range("s", 1, 3, "png"), ...range("s", 1, 3, "jpg")]), { minFrames: 3 });
assert.deepStrictEqual(r.map((s) => s.name).sort(), ["s_jpg", "s_png"]);

// Zu kurz
r = detectSequencesInFolder(f(range("k", 1, 2, "png")), { minFrames: 3 });
assert.strictEqual(r.length, 0);

console.log("Alle Tests bestanden.");
