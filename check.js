#!/usr/bin/env node
/*
 * check.js – Schneller Pre-Deploy-Check (ohne Abhängigkeiten, nur Node-Bordmittel).
 *
 * Prüft:
 *   1) JS-Syntax aller .js-Dateien (node --check)
 *   2) Jede in onclick/oninput/... benutzte Funktion existiert auch
 *      – statisch in index.html UND dynamisch in den Template-Strings in script.js
 *   3) Keine doppelten Element-IDs in index.html
 *
 * Beendet mit Code 1, sobald etwas nicht stimmt – ideal vor "git push".
 *
 * Aufruf:  node check.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
let problems = 0;
const fail = (msg) => { console.error('  ✗ ' + msg); problems++; };
const ok = (msg) => console.log('  ✓ ' + msg);

// --- .js-Dateien einsammeln (Projektwurzel + functions/, ohne node_modules) ---
function collectJsFiles() {
  const out = [];
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.js')) out.push(path.join(ROOT, e.name));
  }
  const fnDir = path.join(ROOT, 'functions');
  if (fs.existsSync(fnDir)) {
    for (const e of fs.readdirSync(fnDir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.js')) out.push(path.join(fnDir, e.name));
    }
  }
  const testsDir = path.join(ROOT, 'tests');
  function collectFromDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) collectFromDir(full);
      else if (e.isFile() && e.name.endsWith('.js')) out.push(full);
    }
  }
  collectFromDir(testsDir);
  return out;
}

// ===================== 1) Syntax =====================
console.log('\n1) JS-Syntax');
const files = collectJsFiles();
for (const f of files) {
  const rel = path.relative(ROOT, f);
  try { execSync(`node --check "${f}"`, { stdio: 'pipe' }); ok(rel); }
  catch (e) { fail(`Syntaxfehler in ${rel}:\n${(e.stderr || e.stdout || e).toString().trim()}`); }
}

// ===================== Quellen laden =====================
const HTML_FILES = ['index.html', 'app.html'].filter(f => fs.existsSync(path.join(ROOT, f)));
const htmlSources = HTML_FILES.map(f => ({ name: f, text: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
const inlineScripts = htmlSources
  .map(h => [...h.text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n'))
  .join('\n');
const allJsText = files.map(f => fs.readFileSync(f, 'utf8')).join('\n') + '\n' + inlineScripts;

// ===================== Definierte Funktionsnamen einsammeln =====================
const defined = new Set();
function addDefs(src) {
  for (const m of src.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/g)) defined.add(m[1]);
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)) defined.add(m[1]);
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*=>/g)) defined.add(m[1]);
  for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
}
addDefs(allJsText);

// ===================== Aufgerufene Funktionen aus Inline-Handlern =====================
const KEYWORDS = new Set(['if','for','while','switch','catch','return','typeof','function','do','else','new','delete','void','in','instanceof','await','yield','case','throw']);
const BUILTINS = new Set(['alert','confirm','prompt','parseInt','parseFloat','isNaN','isFinite','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','Number','String','Boolean','Array','Object','JSON','Math','Date','RegExp','encodeURIComponent','decodeURIComponent','fetch','btoa','atob','Promise']);

const called = new Map(); // name -> Fundort
function collectHandlers(src, label) {
  for (const m of src.matchAll(/\bon[a-z]+\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const body = m[2] != null ? m[2] : m[3];
    for (const c of body.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = c[2];
      if (KEYWORDS.has(name) || BUILTINS.has(name)) continue;
      if (!called.has(name)) called.set(name, label);
    }
  }
}
for (const h of htmlSources) collectHandlers(h.text, h.name);
for (const f of files) collectHandlers(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f));

// ===================== 2) Abgleich =====================
console.log('\n2) Handler-Funktionen existieren');
let missing = 0;
for (const [name, where] of [...called].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (!defined.has(name)) { fail(`"${name}" wird in einem Handler genutzt (${where}), ist aber nirgends definiert`); missing++; }
}
if (missing === 0) ok(`alle ${called.size} genutzten Handler-Funktionen sind definiert`);

// ===================== 3) Doppelte IDs =====================
console.log('\n3) Doppelte Element-IDs');
for (const h of htmlSources) {
  const ids = [...h.text.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const seen = new Set(), dups = new Set();
  for (const id of ids) { if (seen.has(id)) dups.add(id); else seen.add(id); }
  if (dups.size) { for (const d of dups) fail(`doppelte id="${d}" in ${h.name}`); }
  else ok(`keine doppelten IDs in ${h.name}`);
}



// ===================== Ergebnis =====================
console.log('');
if (problems) { console.error(`FEHLGESCHLAGEN: ${problems} Problem(e) gefunden.`); process.exit(1); }
console.log('Alles in Ordnung ✓');
