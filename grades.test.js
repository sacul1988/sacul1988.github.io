const { test } = require('node:test');
const assert = require('node:assert');
const G = require('./grades.js');

test('convertGrade: bekannte Noten -> Zahlenwert', () => {
  assert.strictEqual(G.convertGrade('1'), 1.0);
  assert.strictEqual(G.convertGrade('2-'), 2.33);
  assert.strictEqual(G.convertGrade('3+'), 2.66);
  assert.strictEqual(G.convertGrade('4'), 4.0);
  assert.strictEqual(G.convertGrade('6'), 6.0);
});

test('convertGrade: unbekannt/leer -> 0', () => {
  assert.strictEqual(G.convertGrade('x'), 0);
  assert.strictEqual(G.convertGrade(''), 0);
  assert.strictEqual(G.convertGrade(undefined), 0);
});

test('roundGrade: rundet auf naechste gueltige Note', () => {
  assert.strictEqual(G.roundGrade(2.0), '2');
  assert.strictEqual(G.roundGrade(2.42), '2-');  // naeher an 2.33 als an 2.66
  assert.strictEqual(G.roundGrade(1.0), '1');
  assert.strictEqual(G.roundGrade(5.66), '6+');
});

test('roundGrade: ungueltige Eingabe -> "Keine Note"', () => {
  assert.strictEqual(G.roundGrade(0), 'Keine Note');
  assert.strictEqual(G.roundGrade(-1), 'Keine Note');
  assert.strictEqual(G.roundGrade(NaN), 'Keine Note');
});

test('getGradeColorClass: Farbklasse je Note', () => {
  assert.strictEqual(G.getGradeColorClass('1'), 'grade-excellent');
  assert.strictEqual(G.getGradeColorClass('2'), 'grade-good');
  assert.strictEqual(G.getGradeColorClass('3'), 'grade-average');
  assert.strictEqual(G.getGradeColorClass('4'), 'grade-poor');
  assert.strictEqual(G.getGradeColorClass('5'), 'grade-bad');
  assert.strictEqual(G.getGradeColorClass('6'), 'grade-very-bad');
  assert.strictEqual(G.getGradeColorClass(2.0), 'grade-good'); // auch numerisch
});

test('calculateProjectAverage: Durchschnitt + Rundung', () => {
  assert.strictEqual(G.calculateProjectAverage([]), null);
  assert.strictEqual(G.calculateProjectAverage(null), null);
  const r = G.calculateProjectAverage([{ grade: '2' }, { grade: '3' }, { grade: '4-' }]);
  // (2.0 + 3.0 + 4.33) / 3 = 3.11
  assert.strictEqual(r.exact, '3.11');
  assert.strictEqual(r.rounded, '3');
});

test('calculateProjectAverage: ignoriert leere Noten', () => {
  const r = G.calculateProjectAverage([{ grade: '2' }, { grade: '' }, { grade: '2' }]);
  assert.strictEqual(r.exact, '2.00');
  assert.strictEqual(r.rounded, '2');
});

test('getExportGradeWord: ausgeschriebene Note', () => {
  assert.strictEqual(G.getExportGradeWord('2'), 'gut');
  assert.strictEqual(G.getExportGradeWord('2+'), 'gut (plus)');
  assert.strictEqual(G.getExportGradeWord('3-'), 'befriedigend (minus)');
  assert.strictEqual(G.getExportGradeWord('1'), 'sehr gut');
  assert.strictEqual(G.getExportGradeWord(''), '-');
});
