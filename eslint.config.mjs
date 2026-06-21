import js from '@eslint/js';
import globals from 'globals';
import fs from 'node:fs';

// Projekt-eigene Funktionen/Variablen als bekannte Globals sammeln, damit der
// globale Skript-Stil (Funktionen auf window, datei-übergreifende Aufrufe
// script.js <-> Inline-Skripte in index.html) nicht als "undefined" gemeldet wird.
// Echte Tippfehler (Name existiert NIRGENDS) werden weiterhin erkannt.
function projectGlobals() {
  let src = '';
  try { src += fs.readFileSync('script.js', 'utf8') + '\n'; } catch { /* ignore */ }
  try { src += fs.readFileSync('grades.js', 'utf8') + '\n'; } catch { /* ignore */ }
  try {
    const html = fs.readFileSync('index.html', 'utf8');
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) src += m[1] + '\n';
  } catch { /* ignore */ }
  const g = {};
  for (const m of src.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) g[m[1]] = 'writable';
  for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) g[m[1]] = 'writable';
  for (const m of src.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) g[m[1]] = 'writable';
  return g;
}

// Über CDN eingebundene Bibliotheken
const libGlobals = {
  firebase: 'readonly', flatpickr: 'readonly', Swal: 'readonly', swal: 'readonly',
  XLSX: 'readonly', Sortable: 'readonly', Chart: 'readonly', html2canvas: 'readonly',
  jspdf: 'readonly', jsPDF: 'readonly',
};

export default [
  { ignores: ['node_modules/**', 'functions/node_modules/**'] },

  // Browser-Code (klassische Skripte, kein Modul)
  {
    files: ['script.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.serviceworker, ...libGlobals, ...projectGlobals() },
    },
    rules: {
      ...js.configs.recommended.rules,
      // An den globalen Skript-Stil dieser App angepasst:
      'no-unused-vars': 'off',       // viele Funktionen werden nur aus HTML-Handlern aufgerufen
      'no-redeclare': 'off',         // Funktionen werden zusätzlich auf window gelegt
      'no-global-assign': 'off',     // window-Globals (classes etc.) werden bewusst neu zugewiesen
      'no-useless-assignment': 'off',// pedantisch beim Muster `let x=''; if(...) x=...`
      // Kosmetisch/vorbestehend -> sichtbar, aber kein harter Fehler:
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
      'no-case-declarations': 'warn',
    },
  },

  // Node-/CommonJS-Code (grades.js ist dual-mode: Browser-global + module.exports)
  {
    files: ['functions/**/*.js', 'check.js', 'grades.js', '*.test.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
      'no-useless-assignment': 'off',
    },
  },
];
