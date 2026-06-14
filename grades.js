/*
 * grades.js – Reine Notenlogik der Schulverwaltung.
 *
 * Bewusst OHNE DOM-/Firebase-Abhängigkeiten, damit diese (kritische) Rechenlogik
 * mit `node --test` geprüft werden kann (siehe grades.test.js).
 *
 * Wird im Browser als KLASSISCHES Skript VOR script.js geladen → die Funktionen
 * und Tabellen stehen dort global zur Verfügung (auch für das Utils-Objekt).
 * In Node werden sie zusätzlich via module.exports exportiert.
 */

// Notenumrechnungstabelle
const gradeConversion = {
  '1': 1.0,
  '1-': 1.33,
  '2+': 1.66,
  '2': 2.0,
  '2-': 2.33,
  '3+': 2.66,
  '3': 3.0,
  '3-': 3.33,
  '4+': 3.66,
  '4': 4.0,
  '4-': 4.33,
  '5+': 4.66,
  '5': 5.0,
  '5-': 5.33,
  '6+': 5.66,
  '6': 6.0
};

// Umgekehrte Notenumrechnungstabelle (für Rundung)
const reverseGradeConversion = {
  1.0: '1',
  1.33: '1-',
  1.66: '2+',
  2.0: '2',
  2.33: '2-',
  2.66: '3+',
  3.0: '3',
  3.33: '3-',
  3.66: '4+',
  4.0: '4',
  4.33: '4-',
  4.66: '5+',
  5.0: '5',
  5.33: '5-',
  5.66: '6+',
  6.0: '6'
};

// Notenstring -> Zahlenwert (z.B. "2-" -> 2.33), unbekannt -> 0
function convertGrade(grade) {
  return gradeConversion[grade] ?? 0;
}

// Zahlenwert -> nächste gültige Note (z.B. 2.42 -> "2-")
function roundGrade(grade) {
  if (isNaN(grade) || grade <= 0) return 'Keine Note';

  const grades = Object.keys(gradeConversion).map(key => gradeConversion[key]);
  let closestGrade = grades[0];
  let minDiff = Math.abs(grade - closestGrade);

  grades.forEach(g => {
    const diff = Math.abs(grade - g);
    if (diff < minDiff) {
      minDiff = diff;
      closestGrade = g;
    }
  });

  return reverseGradeConversion[closestGrade] || 'Keine Note';
}

// Notenwert/-string -> CSS-Klasse für die Farbe
function getGradeColorClass(grade) {
  const numericGrade = typeof grade === 'number' ? grade : convertGrade(grade);
  if (numericGrade <= 1.33) return 'grade-excellent';
  if (numericGrade <= 2.33) return 'grade-good';
  if (numericGrade <= 3.33) return 'grade-average';
  if (numericGrade <= 4.33) return 'grade-poor';
  if (numericGrade <= 5.33) return 'grade-bad';
  return 'grade-very-bad';
}

// Durchschnitt einer Projektliste ([{ grade }]) -> { exact, rounded } oder null
function calculateProjectAverage(projects) {
  if (!projects || projects.length === 0) return null;

  let sum = 0;
  let count = 0;

  projects.forEach(project => {
    if (project.grade) {
      const gradeValue = convertGrade(project.grade);
      if (gradeValue > 0) {
        sum += gradeValue;
        count++;
      }
    }
  });

  if (count === 0) return null;

  const average = sum / count;
  const rounded = roundGrade(average);

  return {
    exact: average.toFixed(2),
    rounded: reverseGradeConversion[rounded] || rounded.toString()
  };
}

// Notencode -> ausgeschriebenes Wort (z.B. "2+" -> "gut (plus)")
function getExportGradeWord(gradeCode) {
  if (!gradeCode) return '-';
  const baseGradesMap = { "1": "sehr gut", "2": "gut", "3": "befriedigend", "4": "ausreichend", "5": "mangelhaft", "6": "ungenügend" };
  const base = gradeCode.charAt(0);
  const suffix = gradeCode.slice(1);
  const word = baseGradesMap[base];
  if (!word) return gradeCode;
  if (suffix === "+") return `${word} (plus)`;
  if (suffix === "-") return `${word} (minus)`;
  return word;
}

// Node-Export für Tests; im Browser ist "module" nicht definiert -> übersprungen.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gradeConversion,
    reverseGradeConversion,
    convertGrade,
    roundGrade,
    getGradeColorClass,
    calculateProjectAverage,
    getExportGradeWord
  };
}
