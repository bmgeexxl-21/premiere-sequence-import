const ppro = require("premierepro");
const uxp = require("uxp");
const { detectSequencesInFolder, DEFAULT_EXTENSIONS } = require("./sequences.js");

const $ = (id) => document.getElementById(id);

let rootFolder = null; // UXP-Folder-Entry des gewählten Ordners
let found = [];        // [{ seq, binPath: [..], checked }]

$("exts").value = DEFAULT_EXTENSIONS.join(", ");

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
    fps: fps && fps > 0 ? fps : null
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
  await scanFolder(rootFolder, [rootFolder.name], opts, found);
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

  let okCount = 0;
  for (const item of todo) {
    const s = item.seq;
    try {
      const bin = await binFor(item.binPath);
      const before = await itemIds(bin);

      const imported = await project.importFiles([s.firstPath], true, asProjectItem(bin), true);
      if (!imported) throw new Error("Premiere hat den Import abgelehnt");

      // Neu hinzugekommenen Clip im Ziel-Bin suchen, um ihn zu benennen und die Bildrate zu setzen.
      const newItems = [];
      for (const pi of await bin.getItems()) {
        if (!before.has(String(await pi.getId()))) newItems.push(pi);
      }
      const clip = newItems.map(asClip).find(Boolean);

      if (clip && (opts.rename || opts.fps)) {
        runTransaction(project, `Sequenz „${s.name}“ einrichten`, () => {
          const actions = [];
          if (opts.fps) actions.push(clip.createSetOverrideFrameRateAction(opts.fps));
          if (opts.rename) actions.push(clip.createSetNameAction(s.name));
          return actions;
        });
      } else if (!clip) {
        log(`Hinweis: importierter Clip für „${s.name}“ nicht gefunden, Name/Bildrate unverändert.`, "warn");
      }

      okCount++;
      log(`✓ ${item.binPath.join(" / ")} / ${s.name} (${s.frameCount} Bilder)`, "ok");
    } catch (e) {
      log(`✗ ${s.name}: ${e && e.message ? e.message : e}`, "err");
    }
  }

  log(`Fertig: ${okCount} von ${todo.length} importiert.`, okCount === todo.length ? "ok" : "warn");
  $("import").disabled = false;
}

// ---------- UI-Ereignisse ----------

$("pick").addEventListener("click", async () => {
  const folder = await uxp.storage.localFileSystem.getFolder();
  if (!folder || !folder.isFolder) return;
  rootFolder = folder;
  $("folder").textContent = folder.nativePath;
  await scan();
});

$("rescan").addEventListener("click", scan);
// Optionen, die die Erkennung beeinflussen, lösen einen neuen Scan aus.
for (const id of ["gaps", "minframes", "exts"]) $(id).addEventListener("change", scan);
$("all").addEventListener("click", () => { found.forEach((f) => (f.checked = true)); render(); });
$("none").addEventListener("click", () => { found.forEach((f) => (f.checked = false)); render(); });
$("import").addEventListener("click", importSelected);
