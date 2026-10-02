const ppro = require("premierepro");
const uxp = require("uxp");
const { detectSequencesInFolder, DEFAULT_EXTENSIONS } = require("./sequences.js");

const $ = (id) => document.getElementById(id);

let rootFolder = null; // UXP-Folder-Entry des gewählten Ordners
let found = [];        // [{ seq, binPath: [..], checked }]

$("exts").value = DEFAULT_EXTENSIONS.join(", ");

// Premiere stellt (noch) keine Theme-CSS-Variablen bereit, daher Theme selbst abfragen.
function applyTheme(theme) {
  const t = theme === "light" || theme === "lightest" ? "light" : "dark";
  document.body.className = `theme-${t}`;
}
try {
  applyTheme(document.theme && document.theme.getCurrent ? document.theme.getCurrent() : "dark");
  if (document.theme && document.theme.onUpdated) document.theme.onUpdated.addListener(applyTheme);
} catch (e) {
  applyTheme("dark");
}

// ---------- Protokoll ----------

function log(msg, cls) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  $("log").appendChild(line);
  $("log").scrollTop = $("log").scrollHeight;
}

function clearLog() {
  $("log").innerHTML = "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Protokolldatei ----------
// Wird vor jedem riskanten Schritt auf die Platte geschrieben. Stürzt Premiere ab,
// zeigt das Panel beim nächsten Start, bei welcher Sequenz es passiert ist.

const LOG_FILE = "import-protokoll.txt";
let fileLog = [];

async function dataFolder() {
  return uxp.storage.localFileSystem.getDataFolder();
}

async function writeFileLog(line) {
  fileLog.push(`${new Date().toISOString()}  ${line}`);
  try {
    const folder = await dataFolder();
    const file = await folder.createFile(LOG_FILE, { overwrite: true });
    await file.write(fileLog.join("\n") + "\n");
  } catch (e) {
    console.log("Protokolldatei nicht schreibbar", e);
  }
}

async function checkPreviousRun() {
  try {
    const folder = await dataFolder();
    const file = await folder.getEntry(LOG_FILE);
    const text = await file.read();
    const lines = text.trim().split("\n");
    const last = lines[lines.length - 1] || "";
    if (last.includes("START ")) {
      log("Der letzte Import wurde nicht beendet (Absturz?). Letzter Schritt:", "err");
      log(last.replace(/^\S+\s+START\s+/, ""), "err");
      log(`Protokoll: ${file.nativePath}`, "warn");
    }
  } catch (e) {
    // Noch kein Protokoll vorhanden
  }
}

// ---------- Ordner scannen ----------

function readOptions() {
  const exts = $("exts").value.split(/[\s,;]+/).map((e) => e.replace(/^\./, "").toLowerCase()).filter(Boolean);
  const fpsText = $("fps").value.trim().replace(",", ".");
  const fps = fpsText ? parseFloat(fpsText) : null;
  return {
    extensions: exts.length ? exts : DEFAULT_EXTENSIONS,
    minFrames: parseInt($("minframes").value, 10) || 1,
    splitGaps: $("gaps").checked,
    makeBins: $("bins").checked,
    rename: $("rename").checked,
    fps: fps && fps > 0 ? fps : null,
    pause: Math.max(0, parseInt($("pause").value, 10) || 0),
    makeSequence: $("makeseq").checked,
    sequenceName: $("seqname").value.trim()
  };
}

async function scanFolder(folder, segments, opts, out) {
  let entries;
  try {
    entries = await folder.getEntries();
  } catch (e) {
    log(`Ordner nicht lesbar: ${folder.nativePath} (${e})`, "err");
    return;
  }

  const files = [];
  const subfolders = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isFolder) subfolders.push(entry);
    else if (entry.isFile) files.push({ name: entry.name, path: entry.nativePath });
  }

  const seqs = detectSequencesInFolder(files, {
    extensions: opts.extensions,
    minFrames: opts.minFrames,
    splitGaps: opts.splitGaps,
    folderName: folder.name
  });
  for (const seq of seqs) out.push({ seq, binPath: segments.slice(), checked: true });

  subfolders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const sub of subfolders) {
    await scanFolder(sub, segments.concat(sub.name), opts, out);
  }
}

async function scan() {
  if (!rootFolder) return;
  clearLog();
  const opts = readOptions();
  found = [];
  log("Scanne…");
  fileLog = [];
  await writeFileLog(`START Scan ${rootFolder.nativePath}`);
  await scanFolder(rootFolder, [rootFolder.name], opts, found);
  await writeFileLog(`OK    Scan: ${found.length} Sequenz(en)`);
  render();
  log(`${found.length} Sequenz(en) gefunden.`, found.length ? "ok" : "warn");
}

function render() {
  const list = $("list");
  list.innerHTML = "";
  if (!found.length) {
    list.innerHTML = '<div class="empty">Keine Bildsequenzen gefunden.</div>';
  }
  found.forEach((item, i) => {
    const s = item.seq;
    const row = document.createElement("div");
    row.className = "seq";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.checked;
    cb.addEventListener("change", () => { item.checked = cb.checked; });

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = s.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.binPath.join(" / ")} · ${s.frameCount} Bilder (${s.start}–${s.end}) · ${s.ext}`;
    text.appendChild(title);
    text.appendChild(meta);

    if (s.missingFrames > 0 || s.mixedPadding) {
      const w = document.createElement("div");
      w.className = "meta warn";
      const parts = [];
      if (s.missingFrames > 0) parts.push(`${s.missingFrames} Bild(er) fehlen`);
      if (s.mixedPadding) parts.push("uneinheitliche Nummernlänge");
      w.textContent = parts.join(", ");
      text.appendChild(w);
    }

    row.appendChild(cb);
    row.appendChild(text);
    list.appendChild(row);
  });

  const has = found.length > 0;
  $("import").disabled = !has;
  $("all").disabled = !has;
  $("none").disabled = !has;
  $("rescan").disabled = !rootFolder;
}

// ---------- Premiere: Bins und Import ----------

function asProjectItem(item) {
  try {
    return ppro.ProjectItem.cast(item) || item;
  } catch (e) {
    return item;
  }
}

function asClip(item) {
  try {
    return ppro.ClipProjectItem.cast(item) || null;
  } catch (e) {
    return null;
  }
}

function runTransaction(project, label, build) {
  let ok = false;
  project.lockedAccess(() => {
    ok = project.executeTransaction((compoundAction) => {
      for (const action of build()) compoundAction.addAction(action);
    }, label);
  });
  return ok;
}

async function findChildBin(parent, name) {
  const items = await parent.getItems();
  for (const item of items) {
    if (item.name !== name) continue;
    try {
      if (ppro.ClipProjectItem.cast(item)) continue; // gleichnamiger Clip, kein Bin
    } catch (e) { /* kein Clip */ }
    try {
      const folder = ppro.FolderItem.cast(item);
      if (folder) return folder;
    } catch (e) { /* kein Bin */ }
  }
  return null;
}

async function ensureBin(project, parent, name) {
  const existing = await findChildBin(parent, name);
  if (existing) return existing;
  runTransaction(project, `Bin „${name}“ anlegen`, () => [parent.createBinAction(name, false)]);
  const created = await findChildBin(parent, name);
  if (!created) throw new Error(`Bin „${name}“ konnte nicht angelegt werden`);
  return created;
}

async function itemIds(bin) {
  const ids = new Set();
  for (const item of await bin.getItems()) ids.add(String(await item.getId()));
  return ids;
}

async function importSelected() {
  const opts = readOptions();
  const todo = found.filter((f) => f.checked);
  if (!todo.length) {
    log("Nichts ausgewählt.", "warn");
    return;
  }

  const project = await ppro.Project.getActiveProject();
  if (!project) {
    log("Kein Projekt geöffnet.", "err");
    return;
  }

  $("import").disabled = true;
  clearLog();
  const root = await project.getRootItem();
  const binCache = new Map();

  async function binFor(segments) {
    if (!opts.makeBins) return root;
    let parent = root;
    let key = "";
    for (const seg of segments) {
      key += "/" + seg;
      if (!binCache.has(key)) binCache.set(key, await ensureBin(project, parent, seg));
      parent = binCache.get(key);
    }
    return parent;
  }

  fileLog = [];
  await writeFileLog(`Import von ${todo.length} Sequenz(en), Bildrate ${opts.fps || "Voreinstellung"}, Bins ${opts.makeBins ? "an" : "aus"}`);

  let okCount = 0;
  const toSetUp = [];
  for (let i = 0; i < todo.length; i++) {
    const item = todo[i];
    const s = item.seq;
    const label = `${i + 1}/${todo.length} ${item.binPath.join(" / ")} / ${s.name}`;
    try {
      const bin = await binFor(item.binPath);
      const before = await itemIds(bin);

      log(`… ${label} (${s.frameCount} Bilder)`);
      await writeFileLog(`START ${label} | ${s.frameCount} Bilder ${s.ext} | ${s.firstPath}`);
      const imported = await project.importFiles([s.firstPath], true, asProjectItem(bin), true);
      if (!imported) throw new Error("Premiere hat den Import abgelehnt");
      await writeFileLog(`OK    ${label}`);

      // Neu hinzugekommenen Clip im Ziel-Bin merken, um ihn danach zu benennen und die Bildrate zu setzen.
      const newItems = [];
      for (const pi of await bin.getItems()) {
        if (!before.has(String(await pi.getId()))) newItems.push(pi);
      }
      const clip = newItems.map(asClip).find(Boolean);
      if (clip) toSetUp.push({ clip, s, label });
      else log(`Hinweis: importierter Clip für „${s.name}“ nicht gefunden, Name/Bildrate unverändert.`, "warn");

      okCount++;
      log(`✓ ${label}`, "ok");
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      await writeFileLog(`FEHLER ${label}: ${msg}`);
      log(`✗ ${label}: ${msg}`, "err");
    }
    // Premiere Zeit geben, den Import abzuschließen, bevor der nächste startet.
    await sleep(opts.pause);
  }

  // Umbenennen und Bildrate erst setzen, wenn alle Importe durch sind.
  if (opts.rename || opts.fps) {
    for (const { clip, s, label } of toSetUp) {
      try {
        await writeFileLog(`START Einrichten ${label}`);
        runTransaction(project, `Sequenz „${s.name}“ einrichten`, () => {
          const actions = [];
          if (opts.fps) actions.push(clip.createSetOverrideFrameRateAction(opts.fps));
          if (opts.rename) actions.push(clip.createSetNameAction(s.name));
          return actions;
        });
        await writeFileLog(`OK    Einrichten ${label}`);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        await writeFileLog(`FEHLER Einrichten ${label}: ${msg}`);
        log(`✗ Einrichten ${s.name}: ${msg}`, "err");
      }
      await sleep(50);
    }
  }

  // Optional: alle Clips in der Reihenfolge der Liste nacheinander in eine neue Sequenz legen.
  if (opts.makeSequence && toSetUp.length) {
    const seqName = opts.sequenceName || (rootFolder && rootFolder.name) || "Bildsequenzen";
    try {
      await sleep(opts.pause);
      await writeFileLog(`START Sequenz „${seqName}“ mit ${toSetUp.length} Clip(s)`);
      const targetBin = opts.makeBins && todo.length ? await binFor([todo[0].binPath[0]]) : root;
      const sequence = await project.createSequenceFromMedia(
        seqName,
        toSetUp.map((t) => t.clip),
        asProjectItem(targetBin)
      );
      if (!sequence) throw new Error("Premiere hat keine Sequenz angelegt");
      await writeFileLog(`OK    Sequenz „${seqName}“`);
      try {
        await project.openSequence(sequence);
      } catch (e) {
        // Öffnen ist nur Komfort; die Sequenz liegt in jedem Fall im Projekt.
      }
      log(`✓ Sequenz „${seqName}“ mit ${toSetUp.length} Clip(s) angelegt`, "ok");
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      await writeFileLog(`FEHLER Sequenz: ${msg}`);
      log(`✗ Sequenz „${seqName}“: ${msg}`, "err");
    }
  }

  await writeFileLog(`ENDE ${okCount} von ${todo.length} importiert`);
  log(`Fertig: ${okCount} von ${todo.length} importiert.`, okCount === todo.length ? "ok" : "warn");
  $("import").disabled = false;
}

// ---------- UI-Ereignisse ----------

$("pick").addEventListener("click", async () => {
  const folder = await uxp.storage.localFileSystem.getFolder();
  if (!folder || !folder.isFolder) return;
  rootFolder = folder;
  $("folder").textContent = folder.nativePath;
  $("seqname").placeholder = folder.name;
  await scan();
});

$("rescan").addEventListener("click", scan);
// Optionen, die die Erkennung beeinflussen, lösen einen neuen Scan aus.
for (const id of ["gaps", "minframes", "exts"]) $(id).addEventListener("change", scan);
$("all").addEventListener("click", () => { found.forEach((f) => (f.checked = true)); render(); });
$("none").addEventListener("click", () => { found.forEach((f) => (f.checked = false)); render(); });
$("import").addEventListener("click", importSelected);

checkPreviousRun();
