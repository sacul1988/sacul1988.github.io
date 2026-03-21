// ===== APP STATE =====
const AppState = {
    classes: [],
    activeClassId: null,
    activeModule: 'sitzplan',
    activeListId: null,
    currentPage: 'home',
    currentEvaluationStudentIndex: null,
    isClassSortingMode: false,
    currentOralStudentIndex: 0,
    tempOralGrades: [],
    selectedSingleOralGrade: null,
    selectedSingleStudentIndex: null,
    zeugnisViewMode: 'individual', // 'individual' or 'average'
    isInitialSyncComplete: false // Neu: Sperre für Cloud-Sync beim Start
};

// Start-Sperre setzen (3 Sekunden), damit Cloud-Daten Zeit zum Laden haben
setTimeout(() => {
    AppState.isInitialSyncComplete = true;
    console.log("App: Initial-Sync-Sperre aufgehoben.");
}, 3500);

// ===== GLOBALE VARIABLEN (deprecated, use AppState) =====
// Für Abwärtskompatibilität, aber bevorzuge AppState
let classes = AppState.classes;
window.classes = classes; // Explizit global für index.html verfügbar machen
let activeClassId = AppState.activeClassId;
let activeModule = AppState.activeModule;
let activeListId = AppState.activeListId;
let currentPage = AppState.currentPage;

// Für Sitzplan-Evaluation
let currentEvaluationStudentIndex = AppState.currentEvaluationStudentIndex;

// Variable für Klassen-Sortierung
let isClassSortingMode = AppState.isClassSortingMode;

// Funktion zum globalen Aktualisieren der Klassen-Daten (wird von Firestore aufgerufen)
window.setClasses = function(newClasses) {
    if (Array.isArray(newClasses)) {
        classes = newClasses;
        AppState.classes = newClasses;
        window.classes = newClasses;
    }
};

// Für mündliche Noten Modal
let currentOralStudentIndex = AppState.currentOralStudentIndex;
let tempOralGrades = AppState.tempOralGrades;

// Für einzelne mündliche Note
let selectedSingleOralGrade = AppState.selectedSingleOralGrade;
let selectedSingleStudentIndex = AppState.selectedSingleStudentIndex;

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

// ===== KONFIGURATION UND HILFSOBJEKTE =====
const AppConfig = {
    defaultOralWeight: 50,
    maxGradeValue: 6.0,
    minGradeValue: 1.0,
    defaultModule: 'sitzplan'
};

// Hilfsfunktionen für häufig verwendete Operationen
const Utils = {
    // Sicheres Abrufen eines DOM-Elements mit Fehlerbehandlung
    safeGetElement: function(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element mit ID '${id}' nicht gefunden`);
        }
        return element;
    },

    // Sicheres Parsen von Zahlen
    safeParseInt: function(value, defaultValue = 0) {
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
    },

    // Sicheres Parsen von Floats
    safeParseFloat: function(value, defaultValue = 0.0) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    },

    // Formatierung von Zahlen mit fester Nachkommastellen
    formatNumber: function(num, decimals = 2) {
        return this.safeParseFloat(num).toFixed(decimals);
    },

    // HTML-Escaping für sichere DOM-Manipulation
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Sichere Template-Funktion für HTML mit Platzhaltern
    createSafeHtml: function(template, data) {
        let html = template;
        Object.keys(data).forEach(key => {
            const placeholder = `{{${key}}}`;
            const value = data[key];
            // Escape den Wert, es sei denn, er ist bereits sicher markiert
            const safeValue = value && value.__safe ? value.value : this.escapeHtml(String(value || ''));
            html = html.replace(new RegExp(placeholder, 'g'), safeValue);
        });
        return html;
    },

    // Markierung für bereits sichere HTML-Strings
    markAsSafe: function(html) {
        return { __safe: true, value: html };
    },

    // Funktion zum Konvertieren eines Notenstrings in eine ganze Note (z.B. "1-" -> 1, "2+" -> 2)
    convertToWholeGrade: function(gradeStr) {
        if (!gradeStr) return 0;
        
        // Extrahiere nur die erste Ziffer der Note
        const wholeGrade = parseInt(gradeStr.charAt(0));
        return isNaN(wholeGrade) ? 0 : wholeGrade;
    },

    // Funktion zur Umrechnung von Noten
    convertGrade: function(grade) {
        return gradeConversion[grade] ?? 0;
    },

    // Funktion zur Rundung der Endnote
    roundGrade: function(grade) {
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

        // Sicherstellen, dass ein gültiger Schlüssel zurückgegeben wird
        return reverseGradeConversion[closestGrade] || 'Keine Note';
    },

    // Funktion zum Bestimmen der Notenfarbe
    getGradeColorClass: function(grade) {
        const numericGrade = typeof grade === 'number' ? grade : this.convertGrade(grade);
        if (numericGrade <= 1.33) return 'grade-excellent';
        if (numericGrade <= 2.33) return 'grade-good';
        if (numericGrade <= 3.33) return 'grade-average';
        if (numericGrade <= 4.33) return 'grade-poor';
        if (numericGrade <= 5.33) return 'grade-bad';
        return 'grade-very-bad';
    },

    // Hilfsfunktion zur Bestimmung der Farbe basierend auf dem Notenwert
    getGradeColor: function(grade) {
        if (grade <= 1.5) return '#38b000'; // Sehr gut
        if (grade <= 2.5) return '#70e000'; // Gut
        if (grade <= 3.5) return '#ffdd00'; // Befriedigend
        if (grade <= 4.0) return '#ff9500'; // Ausreichend
        if (grade <= 5.0) return '#ff0a54'; // Mangelhaft
        return '#8B0000'; // Ungenügend
    },

    // Funktion zum Abrufen des heutigen Datums im ISO-Format (nur Datum, ohne Zeit)
    getTodayDateString: function() {
        const today = new Date();
        return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    }
};

// ===== EVENT-LISTENER-MANAGEMENT =====

// Verbesserte Event-Listener-Verwaltung für bessere Speicherverwaltung
const EventManager = {
    // Registry für Event-Listener
    listeners: new WeakMap(),

    // Event-Listener hinzufügen mit automatischer Verwaltung
    add(element, event, handler, options = {}) {
        if (!element) return;

        // Entferne vorherigen Listener falls vorhanden
        this.remove(element, event, handler);

        // Füge neuen Listener hinzu
        element.addEventListener(event, handler, options);

        // Speichere Referenz für späteres Entfernen
        if (!this.listeners.has(element)) {
            this.listeners.set(element, new Map());
        }
        this.listeners.get(element).set(event, handler);
    },

    // Event-Listener entfernen
    remove(element, event, handler) {
        if (!element || !this.listeners.has(element)) return;

        const listeners = this.listeners.get(element);
        if (listeners.has(event)) {
            element.removeEventListener(event, listeners.get(event));
            listeners.delete(event);
        }
    },

    // Alle Event-Listener für ein Element entfernen
    removeAll(element) {
        if (!element || !this.listeners.has(element)) return;

        const listeners = this.listeners.get(element);
        listeners.forEach((handler, event) => {
            element.removeEventListener(event, handler);
        });
        this.listeners.delete(element);
    },

    // Event-Listener für dynamisch erstellte Elemente mit automatischer Bereinigung
    addTemporary(element, event, handler, options = {}) {
        if (!element) return;

        this.add(element, event, handler, options);

        // Automatische Bereinigung wenn Element aus DOM entfernt wird
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === element || node.contains(element)) {
                        this.removeAll(element);
                        observer.disconnect();
                    }
                });
            });
        });

        // Performance-Optimierung: Observer nur starten, wenn nötig
        if (element.parentNode) {
            observer.observe(element.parentNode, { childList: true, subtree: false });
        }
    }
};

// ===== LOKALISIERUNG =====

// Einfaches Lokalisierungsobjekt für mehrsprachige Unterstützung
const Localization = {
    // Aktuelle Sprache (kann später erweitert werden)
    currentLanguage: 'de',
    
    // Deutsche Texte
    de: {
        // Allgemein
        'sort': 'Sortieren',
        'cancel': 'Abbrechen',
        'save': 'Speichern',
        'delete': 'Löschen',
        'edit': 'Bearbeiten',
        'add': 'Hinzufügen',
        'close': 'Schließen',
        'confirm': 'Bestätigen',
        'yes': 'Ja',
        'no': 'Nein',
        
        // Klassen
        'noClasses': 'Keine Klassen vorhanden',
        'addNewClass': 'Füge eine neue Klasse hinzu, um zu beginnen',
        'className': 'Klassenname',
        'editClass': 'Klasse bearbeiten',
        'deleteClass': 'Klasse löschen',
        'deleteClassConfirm': 'Möchtest du die Klasse "{name}" wirklich löschen? Alle Daten gehen verloren.',
        
        // Schüler
        'noStudents': 'Keine Schüler in dieser Klasse',
        'addStudent': 'Schüler hinzufügen',
        'studentName': 'Schülername',
        'editStudent': 'Schüler bearbeiten',
        'deleteStudent': 'Schüler löschen',
        'deleteStudentConfirm': 'Möchtest du {name} wirklich löschen?',
        
        // Noten
        'grades': 'Noten',
        'noGrades': 'Keine Noten',
        'noProjects': 'Keine Projekte',
        'projects': 'Projekte',
        'allProjects': 'Alle Projekte',
        
        // Modal-Titel und -Texte
        'addClass': 'Klasse hinzufügen',
        'cloneClass': 'Klasse klonen',
        'newClassName': 'Neuer Klassenname',
        'cloneOptions': 'Klon-Optionen',
        'includeStudents': 'Schüler einbeziehen',
        'includeGrades': 'Noten einbeziehen',
        
        // Fehlermeldungen
        'error': 'Fehler',
        'enterClassName': 'Bitte gib einen Klassennamen ein',
        'enterStudentName': 'Bitte gib einen Namen für den Schüler ein',
        'noValidNames': 'Keine gültigen Namen gefunden',
        'enterNoteContent': 'Bitte gib einen Inhalt für die Notiz ein',
        
        // Erfolgsmeldungen
        'importedStudents': 'Schüler importiert',
        'noNewStudents': 'Keine neuen Schüler importiert',
        
        // Warnungen
        'disableLearningSupport': 'Förderschwerpunkt deaktivieren?',
        'disableLearningSupportConfirm': 'Möchtest du den Förderschwerpunkt "Lernen" für {name} wirklich deaktivieren?',
        'deleteEntry': 'Eintrag löschen?',
        'deleteEntryConfirm': 'Möchtest du diesen Verlaufseintrag wirklich löschen?',
        
        // Position
        'addAtEnd': 'Am Ende hinzufügen',
        'addAtBeginning': 'Am Anfang hinzufügen',
        'afterPosition': 'Nach Nr. {number} ({name})'
    },
    
    // Funktion zum Abrufen eines lokalisierten Textes
    get: function(key, params = {}) {
        const lang = this[this.currentLanguage] || this.de;
        let text = lang[key] || key;
        
        // Parameter ersetzen
        Object.keys(params).forEach(param => {
            text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
        });
        
        return text;
    },
    
    // Sprache ändern (für zukünftige Erweiterungen)
    setLanguage: function(lang) {
        if (this[lang]) {
            this.currentLanguage = lang;
        }
    }
};

// Hilfsfunktion für Lokalisierung (kürzere Schreibweise)
function t(key, params = {}) {
    return Localization.get(key, params);
}

// Auch die t-Funktion global verfügbar machen
window.t = t;

// Sicheres Abrufen eines DOM-Elements mit Fehlerbehandlung
function safeGetElement(id) {
    return Utils.safeGetElement(id);
}

// Sicheres Parsen von Zahlen
function safeParseInt(value, defaultValue = 0) {
    return Utils.safeParseInt(value, defaultValue);
}

// Sicheres Parsen von Floats
function safeParseFloat(value, defaultValue = 0.0) {
    return Utils.safeParseFloat(value, defaultValue);
}

// Formatierung von Zahlen mit fester Nachkommastellen
function formatNumber(num, decimals = 2) {
    return Utils.formatNumber(num, decimals);
}

// Funktion zum Konvertieren eines Notenstrings in eine ganze Note (z.B. "1-" -> 1, "2+" -> 2)
function convertToWholeGrade(gradeStr) {
    return Utils.convertToWholeGrade(gradeStr);
}

// Funktion zur Umrechnung von Noten
function convertGrade(grade) {
    return Utils.convertGrade(grade);
}

// Funktion zur Rundung der Endnote
function roundGrade(grade) {
    return Utils.roundGrade(grade);
}

// Funktion zum Bestimmen der Notenfarbe
function getGradeColorClass(grade) {
    return Utils.getGradeColorClass(grade);
}

// Hilfsfunktion zur Bestimmung der Farbe basierend auf dem Notenwert
function getGradeColor(grade) {
    return Utils.getGradeColor(grade);
}

// ===== NAVIGATION UND UI =====

// Seitennavigation
function showPage(page, classId = null) {
    const previousClassId = activeClassId;

    // Vor Seiten-/Klassenwechsel offene Zeugnis-Änderungen der aktuellen Klasse sichern.
    if (previousClassId !== null && (page !== 'class' || classId !== previousClassId)) {
        saveFocusedZeugnisTextarea(previousClassId);
    }

    // Sortier-Modus deaktivieren und Button immer zurücksetzen
    if (page === 'class') {
        isClassSortingMode = false;
        const sortBtn = safeGetElement('sort-classes-btn');
        if (sortBtn) {
            sortBtn.innerHTML = '<i class="fas fa-arrows-alt"></i> Sortieren';
            sortBtn.classList.remove('btn-orange');
        }
    } else if (page === 'home') {
        // Sortier-Modus immer deaktivieren, wenn zurück zur Startseite gewechselt wird
        isClassSortingMode = false;
        const sortBtn = safeGetElement('sort-classes-btn');
        if (sortBtn) {
            sortBtn.innerHTML = '<i class="fas fa-arrows-alt"></i> Sortieren';
            sortBtn.classList.remove('btn-orange');
        }
    }
    
    // Alle Seiten ausblenden
    const pages = document.querySelectorAll('.page');
    if (pages) {
        pages.forEach(p => p.style.display = 'none');
    }
    
    // Gewünschte Seite anzeigen, wenn vorhanden
    const targetPage = safeGetElement(`${page}-page`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    currentPage = page;
    localStorage.setItem('currentPage', page);
    
    // Breadcrumb aktualisieren
    const breadcrumbActive = safeGetElement('breadcrumb-active');
    if (breadcrumbActive) {
        if (page === 'home') {
            breadcrumbActive.innerHTML = '';
            localStorage.removeItem('activeClassId');
        } else if (page === 'class' && classId !== null && classes[classId]) {
            activeClassId = classId;
            localStorage.setItem('activeClassId', classId);
            const className = classes[classId].name;
            breadcrumbActive.innerHTML = `
                <span class="separator">/</span>
                <span>${className}</span>
            `;
            
            // Standardmodus für Sitzplan auf Bewerten setzen
            if (classes[classId].sitzplan) {
                classes[classId].sitzplan.currentMode = 'evaluation';
            }
            
            // Standardmodul laden
            showModule('sitzplan');
        }
    }
    
    // Inhalte aktualisieren
    if (page === 'home') {
        renderClassesGrid();
    } else if (page === 'class') {
        // Cloud-Sync beim Klassenwechsel entfernt.
        // Synchronisierung erfolgt nur bei Änderungen.
        /*
        if (typeof window.triggerCloudSyncDebounced === 'function') {
            window.triggerCloudSyncDebounced(2000);
        } else if (typeof window.saveDataToCloud === 'function') {
            window.saveDataToCloud();
        }
        */
        renderModuleContent();
    }
}

// Modul wechseln
function showModule(module) {
    // Vor dem Modulwechsel offene Zeugnis-Eingaben sichern.
    saveFocusedZeugnisTextarea();

    // Neu: Wenn zum Zeugnis-Tab gewechselt wird, IMMER erst einmal die neuesten Daten aus der Cloud erzwingen
    if (module === 'zeugnis') {
        if (typeof window.forceRefreshFromCloud === 'function') {
            console.log("showModule: Zeugnis-Tab aktiviert. Erzwungener Cloud-Sync gestartet.");
            
            window.forceRefreshFromCloud().then(() => {
                // Modul erst rendern wenn Daten (hoffentlich) da sind
                console.log("showModule: Refresh beendet, Ansicht wird aktualisiert.");
                if (typeof renderModuleContent === 'function') {
                    renderModuleContent();
                }
            });
        }
    }

    // Bei Tab-Wechsel KEIN automatischer Cloud-Sync mehr.
    // Cloud-Sync erfolgt nur bei tatsächlichen Datenänderungen (saveData).
    /* 
    if (typeof window.triggerCloudSyncDebounced === 'function') {
        window.triggerCloudSyncDebounced(2000);
    } else if (typeof window.saveDataToCloud === 'function') {
        window.saveDataToCloud();
    }
    */
    
    // Alle Module ausblenden
    const modules = document.querySelectorAll('.module');
    if (modules) {
        modules.forEach(m => m.style.display = 'none');
    }
    
    // Gewünschtes Modul anzeigen, wenn vorhanden
    const targetModule = safeGetElement(`${module}-module`);
    if (targetModule) {
        targetModule.style.display = 'block';
    }
    
    // Aktiven Button hervorheben
    const moduleNavItems = document.querySelectorAll('.module-nav-item');
    if (moduleNavItems) {
        moduleNavItems.forEach(item => {
            if (item.dataset.module === module) {
                const btn = item.querySelector('.btn');
                if (btn) btn.className = 'btn btn-primary';
            } else {
                const btn = item.querySelector('.btn');
                if (btn) btn.className = 'btn btn-light';
            }
        });
    }
    
    activeModule = module;
    localStorage.setItem('activeModule', module);
    renderModuleContent();
}

function isZeugnisNotesTextarea(element) {
    return !!(element &&
        element.tagName === 'TEXTAREA' &&
        element.id &&
        (element.id.startsWith('notes-left-') ||
         element.id.startsWith('notes-right-') ||
         element.id.startsWith('notes-summary-')));
}

function getStudentIndexFromZeugnisTextareaId(textareaId) {
    if (!textareaId) return -1;
    const rawIndex = textareaId.split('-').pop();
    const parsed = parseInt(rawIndex, 10);
    return Number.isNaN(parsed) ? -1 : parsed;
}

function saveFocusedZeugnisTextarea(expectedClassId = null) {
    const activeElement = document.activeElement;
    if (!isZeugnisNotesTextarea(activeElement)) return;
    if (expectedClassId !== null && expectedClassId !== activeClassId) return;

    const studentIndex = getStudentIndexFromZeugnisTextareaId(activeElement.id);
    if (studentIndex >= 0) {
        saveStudentNotes(studentIndex);
    }
}

// Diese Funktion dient als Verzweigung zu den vier aktiven Modulen
function renderModuleContent() {
    if (activeClassId === null || !classes[activeClassId]) return;
    
    switch (activeModule) {
        case 'schueler':
            renderStudentsModule();
            break;
        case 'noten':
            renderGradesModule();
            updateProjectSelectionOptions();
            updateProjectStatistics();
            break;
        case 'zeugnis':
            renderZeugnisModule();
            break;
        case 'sitzplan':
            renderSitzplanModule();
            break;
        default:
            renderStudentsModule();
            break;
    }
}

// Modal anzeigen/verstecken
function showModal(modalId) {
    const modalContainer = safeGetElement('modal-container');
    if (!modalContainer) return;

    modalContainer.style.display = 'flex';
    modalContainer.setAttribute('aria-hidden', 'false');

    // Alle Modals ausblenden
    const modals = document.querySelectorAll('.modal');
    if (modals) {
        modals.forEach(m => {
            m.style.display = 'none';
            m.setAttribute('aria-hidden', 'true');
        });
    }

    // Gewünschtes Modal anzeigen
    const targetModal = safeGetElement(modalId);
    if (targetModal) {
        targetModal.style.display = 'block';
        targetModal.setAttribute('aria-hidden', 'false');

        // Fokus auf das erste fokussierbare Element setzen
        const focusableElement = targetModal.querySelector('input, button, select, textarea');
        if (focusableElement) {
            focusableElement.focus();
        }
    }
}

function hideModal() {
    const modalContainer = safeGetElement('modal-container');
    if (modalContainer) {
        modalContainer.style.display = 'none';
        modalContainer.setAttribute('aria-hidden', 'true');

        // Alle Modals ausblenden
        const modals = document.querySelectorAll('.modal');
        if (modals) {
            modals.forEach(m => {
                m.setAttribute('aria-hidden', 'true');
            });
        }
    }

    // Sitzplan-spezifische Logik: selectedDesk zurücksetzen und Auswahl aufheben
    selectedDesk = null;

    // Auswahl aufheben
    const allDesks = document.querySelectorAll('.desk');
    allDesks.forEach(d => d.classList.remove('selected'));
}

// Funktion zum Schließen des Modals beim Klick außerhalb
function closeModalOnOutsideClick(event) {
    const modalContainer = safeGetElement('modal-container');
    if (!modalContainer) return;
    
    // Prüfen, ob der Klick auf dem modal-container selbst war (nicht auf einem Kind-Element)
    if (event.target === modalContainer) {
        hideModal();
    }
}

// Funktion zum Zurückkehren zum Bewertungsmodal aus Untermodals
// ===== DATENSPEICHERUNG UND -LADUNG =====

// Daten im localStorage speichern
function saveData(specificStudentIndex = null) {
    try {
        // SICHERHEITS-CHECK VOR DEM SPEICHERN:
        // Prüfen, ob im localStorage zwischenzeitlich (z.B. von index.html Sync) neuere Daten gelandet sind
        const lastLocalTimestamp = localStorage.getItem('lastUpdate');
        if (lastLocalTimestamp) {
            const savedClassesRaw = localStorage.getItem('classes');
            if (savedClassesRaw) {
                const savedClasses = JSON.parse(savedClassesRaw);
                // Wenn wir nicht gerade selbst gespeichert haben, aktualisieren wir unsere lokale Variable
                // falls die Daten im Storage eine andere Länge oder Schlüsselstruktur haben.
                // Das verhindert das Überschreiben von Cloud-Updates beim Tab-Wechsel.
                const now = Date.now();
                if (now - (window._lastLocalSaveTime || 0) > 3000) {
                     console.log("saveData: Prüfe auf Hintergrund-Updates...");
                     // window.classes wurde in index.html bereits aktualisiert, wir ziehen hier nach
                     if (window.classes) {
                         const hasCloudChanges = JSON.stringify(window.classes) !== JSON.stringify(classes);
                         if (hasCloudChanges) {
                             console.log("saveData: Cloud-Daten im Hintergrund gefunden. Synchronisiere lokal vor Speicherung...");
                             classes = window.classes;
                             AppState.classes = classes;
                         }
                     }
                }
            }
        }

        // Zeitstempel für Synchronisation aktualisieren
        const timestamp = new Date().toISOString();
        localStorage.setItem('lastUpdate', timestamp);
        
        // Markiere den Zeitpunkt des lokalen Speicherns für den Cloud-Sync-Wächter
        window._lastLocalSaveTime = Date.now();
        
        // Sicherstellen, dass window.classes immer die aktuellsten Daten hat
        window.classes = classes;
        
        const dataToSave = JSON.stringify(classes);
        localStorage.setItem('classes', dataToSave);

        const oralWeightElement = safeGetElement('oralWeightValue');
        if (oralWeightElement) {
            localStorage.setItem('oralWeight', oralWeightElement.innerText);
            AppState.oralWeight = safeParseInt(oralWeightElement.innerText, 50);
        }

        // Cloud-Sync (wenn eingeloggt)
        // VERHINDERUNG VON FRÜH-SPEICHERN: Nur synchronisieren wenn Initial-Sync fertig
        if (!AppState.isInitialSyncComplete) {
            console.log('App: Blockiere Cloud-Sync während Initialisierungsphase (3.5s).');
            return;
        }

        console.log('Rufe Cloud-Sync auf...');
        if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.flushCloudSyncNow === 'function') {
            // Sofortige Synchronisation ohne Verzögerung (0.1s wäre 100ms, flushCloudSyncNow ist 0ms)
            window.flushCloudSyncNow(specificStudentIndex);
        } else if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.triggerCloudSyncDebounced === 'function') {
            window.triggerCloudSyncDebounced(100, specificStudentIndex);
        } else if (typeof window.saveDataToCloud === 'function' && window.firebaseAuth && window.firebaseAuth.currentUser) {
            window.saveDataToCloud(specificStudentIndex);
        } else if (typeof window.triggerCloudSync === 'function') {
            window.triggerCloudSync();
        } else {
            console.log('Cloud-Sync nicht möglich: ', 
                typeof window.saveDataToCloud === 'function' ? 'User nicht eingeloggt' : 'saveDataToCloud Funktion fehlt');
        }

        // Optional: Erfolgsmeldung für Debugging
        console.log('Daten lokal erfolgreich gespeichert');
    } catch (error) {
        console.error('Fehler beim Speichern der Daten:', error);
        // Zeige dem Benutzer eine Fehlermeldung
        if (typeof swal !== 'undefined') {
            swal('Fehler', 'Daten konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.', 'error');
        }
    }
}

// Daten aus dem localStorage laden
function loadData() {
    try {
        const savedClasses = localStorage.getItem('classes');
        const savedOralWeight = localStorage.getItem('oralWeight');

        if (savedClasses) {
            const parsedClasses = JSON.parse(savedClasses);

            // Grundlegende Validierung der geladenen Daten
            if (Array.isArray(parsedClasses)) {
                classes = parsedClasses;
                AppState.classes = classes; // AppState synchron halten

                // Stelle sicher, dass alle erforderlichen Eigenschaften vorhanden sind
                classes.forEach(cls => {
                    // Module-Daten initialisieren, falls nicht vorhanden
                    if (!cls.alphabeticallySorted) cls.alphabeticallySorted = false;
                    if (!cls.notes) cls.notes = [];
                    // Neue Felder für die neuen Module initialisieren
                    if (!cls.studentsListSorted) cls.studentsListSorted = false;

                    // Sitzplan-Daten initialisieren
                    if (!cls.sitzplan) cls.sitzplan = { desks: [], currentMode: 'evaluation' };

                    // Sicherstellen, dass alle Schüler die erweiterten Eigenschaften haben
                    if (cls.students) {
                        cls.students.forEach(student => {
                            if (!student.individualGrade) student.individualGrade = null;
                            if (!student.individualGradeComment) student.individualGradeComment = '';
                            if (!student.isExpanded) student.isExpanded = false; // Für Noten-Tab
                            if (!student.notenExpanded) student.notenExpanded = false; // Für Schriftliche Noten
                            if (!student.muendlicheExpanded) student.muendlicheExpanded = false; // Für Mündliche Noten

                            // Neu: Schülernotizen initialisieren
                            if (!student.notes) student.notes = [];

                            // NEU: Tägliche Beteiligung initialisieren
                            if (!student.dailyParticipation) {
                                const today = new Date().toISOString().split('T')[0];
                                student.dailyParticipation = { date: today, positive: 0, negative: 0 };
                            }

                            // Mündliche Noten initialisieren
                            if (!student.oralGrades) student.oralGrades = [];

                            // Projekte mit Unterschrift-Eigenschaft erweitern
                            if (student.projects) {
                                student.projects.forEach(project => {
                                    // Alte signatureProvided-Eigenschaft entfernen, falls vorhanden
                                    if (project.hasOwnProperty('signatureProvided')) {
                                        delete project.signatureProvided;
                                    }
                                });
                            } else {
                                student.projects = [];
                            }
                        });
                    } else {
                        cls.students = [];
                    }
                });
            } else {
                console.warn('Geladene Klassendaten sind kein Array, verwende leere Daten');
                classes = [];
            }
        }

        if (savedOralWeight) {
            const oralWeightElement = safeGetElement('oralWeightValue');
            if (oralWeightElement) {
                const weight = Utils.safeParseInt(savedOralWeight, 50);
                oralWeightElement.innerText = weight;

                // Aktiven Button markieren
                const weightButtons = document.querySelectorAll('.weight-btn');
                if (weightButtons) {
                    weightButtons.forEach(btn => {
                        btn.classList.remove('active-weight');
                    });

                    const weightButton = document.querySelector(`.weight-btn[onclick="setWeight(${weight})"]`);
                    if (weightButton) {
                        weightButton.classList.add('active-weight');
                    }
                }
            }
        }
    } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
        // Fallback: Leere Daten verwenden
        classes = [];
        if (typeof swal !== 'undefined') {
            swal('Warnung', 'Daten konnten nicht geladen werden. Neue Sitzung wird gestartet.', 'warning');
        }
    }

    // Zustands-Wiederherstellung entfernt für bessere Synchronisations-Stabilität beim Start
    // Wir starten bei jedem Neuladen immer auf der Startseite
    showPage('home');
}

// Startseite: Klassen-Grid rendern
function renderClassesGrid() {
    // Referenzen global verfügbar machen
    window.renderClassesGrid = renderClassesGrid;
    window.renderModuleContent = renderModuleContent;
    window.renderGradesModule = renderGradesModule;
    window.renderSitzplanModule = renderSitzplanModule;

    const classesGrid = safeGetElement('classes-grid');
    if (!classesGrid) return;
    
    classesGrid.innerHTML = '';
    
    if (!classes || classes.length === 0) {
        classesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-school"></i>
                <p>${t('noClasses')}</p>
                <p>${t('addNewClass')}</p>
            </div>
        `;
        return;
    }
    
    classes.forEach((cls, index) => {
        // Fallback für fehlende students-Arrays
        if (!cls.students) {
            cls.students = [];
        }
        
        // Statistiken berechnen
        const studentCount = cls.students.length;
        
        const classCard = document.createElement('div');
        classCard.className = 'class-card';
        
        // Drag & Drop Attribute hinzufügen, wenn Sortier-Modus aktiv
        if (isClassSortingMode) {
            classCard.draggable = true;
            classCard.ondragstart = (event) => handleClassDragStart(event, index);
            classCard.ondragend = handleClassDragEnd;
            classCard.ondragover = handleClassDragOver;
            classCard.ondragleave = handleClassDragLeave;
            classCard.ondrop = (event) => handleClassDrop(event, index);
            classCard.style.cursor = 'move';
        }
        
        classCard.innerHTML = `
            <div class="class-card-header" style="background-color: ${cls.color || '#6c757d'}">
                <span>${cls.name}</span>
                <span class="badge" style="background-color: ${cls.color || '#6c757d'}; color: white;">${studentCount} Schüler</span>
            </div>
            <div class="class-card-body">
                <div class="module-buttons">
                    <button class="btn btn-green btn-block" onclick="showPage('class', ${index})">
                        ${cls.name}
                    </button>
                    <div class="class-card-actions">
                        <button class="btn btn-primary btn-icon-only" onclick="editClass(${index})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-secondary btn-icon-only" onclick="showCloneModal(${index})">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-secondary btn-icon-only" onclick="deleteClass(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        classesGrid.appendChild(classCard);
    });
}

function handleHomeClick(event) {
    if (event) event.preventDefault();
    hideModal();
    showPage('home');
}

// Funktion zum Umschalten des Klassen-Sortier-Modus
function toggleClassSorting() {
    isClassSortingMode = !isClassSortingMode;
    
    const sortBtn = safeGetElement('sort-classes-btn');
    if (sortBtn) {
        if (isClassSortingMode) {
            sortBtn.innerHTML = `<i class="fas fa-arrows-alt"></i> ${t('sort')}`;
            sortBtn.classList.add('btn-orange');
        } else {
            sortBtn.innerHTML = `<i class="fas fa-arrows-alt"></i> ${t('sort')}`;
            sortBtn.classList.remove('btn-orange');
        }
    }
    
    renderClassesGrid();
}

// Drag & Drop Funktionen für Klassen-Sortierung
let draggedClassIndex = null;

// Drag & Drop Funktionen für Schüler-Sortierung
let draggedStudentIndex = null;
let dragIndicator = null;

function handleClassDragStart(event, classIndex) {
    if (!isClassSortingMode) return;
    
    draggedClassIndex = classIndex;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.outerHTML);
    
    event.target.style.opacity = '0.5';
}

function handleClassDragEnd(event) {
    event.target.style.opacity = '1';
    draggedClassIndex = null;
}

function handleClassDragOver(event) {
    if (!isClassSortingMode) return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const target = event.target.closest('.class-card');
    if (target && target !== event.target) {
        target.style.borderTop = '2px solid #4361ee';
    }
}

function handleClassDragLeave(event) {
    const target = event.target.closest('.class-card');
    if (target) {
        target.style.borderTop = '';
    }
}

function handleClassDrop(event, targetIndex) {
    if (!isClassSortingMode || draggedClassIndex === null) return;
    
    event.preventDefault();
    
    const target = event.target.closest('.class-card');
    if (target) {
        target.style.borderTop = '';
    }
    
    if (draggedClassIndex !== targetIndex) {
        // Klasse in der Array verschieben
        const [movedClass] = classes.splice(draggedClassIndex, 1);
        classes.splice(targetIndex, 0, movedClass);
        
        // Daten speichern
        saveData();
        
        // UI aktualisieren
        renderClassesGrid();
    }
}

// Drag & Drop Funktionen für Schüler-Sortierung
function handleStudentDragStart(event, studentIndex) {
    draggedStudentIndex = studentIndex;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.outerHTML);
    
    event.target.style.opacity = '0.5';
}

function handleStudentDragEnd(event) {
    // Entferne Linie
    if (dragIndicator) {
        dragIndicator.remove();
        dragIndicator = null;
    }
    
    event.target.style.opacity = '1';
    draggedStudentIndex = null;
}

function handleStudentDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    // Entferne alte Hervorhebung
    if (dragIndicator) {
        dragIndicator.remove();
        dragIndicator = null;
    }
    
    // Füge neue Linie hinzu
    const table = document.querySelector('.student-list-table');
    const targetRow = event.target.closest('tr');
    if (targetRow && table && targetRow.parentElement === table.querySelector('tbody')) {
        const rect = targetRow.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        
        dragIndicator = document.createElement('div');
        dragIndicator.style.position = 'absolute';
        dragIndicator.style.top = (rect.top - tableRect.top - 2) + 'px';
        dragIndicator.style.left = '0';
        dragIndicator.style.width = '100%';
        dragIndicator.style.height = '4px';
        dragIndicator.style.backgroundColor = '#ff6600';
        dragIndicator.style.zIndex = '10';
        dragIndicator.style.pointerEvents = 'none';
        
        table.style.position = 'relative';
        table.appendChild(dragIndicator);
    }
}

function handleStudentDrop(event, targetIndex) {
    event.preventDefault();
    
    // Entferne Linie
    if (dragIndicator) {
        dragIndicator.remove();
        dragIndicator = null;
    }
    
    if (draggedStudentIndex === null || draggedStudentIndex === targetIndex) return;
    
    const cls = classes[activeClassId];
    if (!cls || !cls.students) return;
    
    // Speichere die alten Schüler für die Desk-Aktualisierung
    const oldStudents = [...cls.students];
    
    // Schüler in der Array verschieben
    const [movedStudent] = cls.students.splice(draggedStudentIndex, 1);
    cls.students.splice(targetIndex, 0, movedStudent);
    
    // studentIndex in den desks aktualisieren, um den Sitzplan unverändert zu lassen
    if (cls.sitzplan && cls.sitzplan.desks) {
        cls.sitzplan.desks.forEach(desk => {
            if (desk.studentIndex !== null) {
                const oldStudent = oldStudents[desk.studentIndex];
                if (oldStudent) {
                    desk.studentIndex = cls.students.findIndex(s => s.name === oldStudent.name);
                }
            }
        });
    }
    
    // Daten speichern
    saveData();
    
    // UI aktualisieren
    renderStudentsModule();
}

// Klasse erstellen
function createClass() {
    const classNameInput = safeGetElement('new-class-name');
    const subjectInput = safeGetElement('new-class-subject');
    const colorInput = safeGetElement('new-class-color');

    if (!classNameInput) return;

    const className = classNameInput.value.trim();
    const subject = subjectInput ? subjectInput.value.trim() : '';
    const color = colorInput ? colorInput.value : '#6c757d';

    if (!className) {
        if (typeof swal !== 'undefined') {
            swal('Fehler', 'Bitte geben Sie einen Klassennamen ein', 'error');
        }
        return;
    }

    // Zusätzliche Validierung: Prüfe auf ungültige Zeichen
    if (className.length > 50) {
        if (typeof swal !== 'undefined') {
            swal('Fehler', 'Klassenname ist zu lang (max. 50 Zeichen)', 'error');
        }
        return;
    }

    // Prüfe, ob Klasse bereits existiert
    if (classes.some(cls => cls.name.toLowerCase() === className.toLowerCase())) {
        if (typeof swal !== 'undefined') {
            swal('Fehler', 'Eine Klasse mit diesem Namen existiert bereits', 'error');
        }
        return;
    }

    const newClass = {
        name: className,
        subject: subject,
        color: color,
        students: [],
        alphabeticallySorted: false,
        notes: [],
        studentsListSorted: false,
        sitzplan: {
            desks: [],
            currentMode: 'evaluation'
        }
    };

    classes.push(newClass);
    window.classes = classes; // Sicherstellen, dass die globale Referenz aktuell ist
    saveData();
    hideModal();

    // Felder zurücksetzen
    if (classNameInput) classNameInput.value = '';
    if (subjectInput) subjectInput.value = '';

    renderClassesGrid();

    // Erfolgsmeldung
    if (typeof swal !== 'undefined') {
        swal('Erfolg', `Klasse "${className}" wurde erstellt`, 'success');
    }
}

// Klasse klonen - Zeige Modal
function showCloneModal(classId) {
    if (classId === null || classId === undefined || !classes[classId]) return;
    
    const cls = classes[classId];
    const cloneNewNameInput = safeGetElement('clone-class-new-name');
    const cloneModal = safeGetElement('clone-class-modal');
    
    if (!cloneModal) return;
    
    // Modal-Felder aktualisieren
    if (cloneNewNameInput) {
        cloneNewNameInput.value = `${cls.name} Kopie`;
    }
    
    // Index für späteren Gebrauch speichern
    cloneModal.dataset.classId = classId;
    
    showModal('clone-class-modal');
}

// Klasse klonen - Ausführen
function cloneClass() {
    const cloneModal = safeGetElement('clone-class-modal');
    if (!cloneModal) return;
    
    const classId = cloneModal.dataset.classId;
    if (classId === undefined || !classes[classId]) return;
    
    const originalClass = classes[classId];
    const cloneNewNameInput = safeGetElement('clone-class-new-name');
    
    if (!cloneNewNameInput) return;
    
    const newName = cloneNewNameInput.value.trim();
    
    if (!newName) {
        swal("Fehler", "Bitte gib einen Namen für die neue Klasse ein", "error");
        return;
    }

    // Tab-Auswahl auslesen (nur Schüler werden geklont)
    const cloneStudents = true;
    const cloneHomework = false;
    const cloneGrades = false;
    
    // Neue Klasse erstellen mit grundlegenden Eigenschaften
    const newClass = {
        name: newName,
        subject: originalClass.subject,
        students: cloneStudents ? JSON.parse(JSON.stringify(originalClass.students || [])) : [],
        alphabeticallySorted: originalClass.alphabeticallySorted || false,
        studentsListSorted: originalClass.studentsListSorted || false,
        notes: [],
        sitzplan: originalClass.sitzplan ? JSON.parse(JSON.stringify(originalClass.sitzplan)) : { desks: [], currentMode: 'evaluation' }
    };
    
    // Noten zurücksetzen, wenn nicht übernommen werden sollen
    if (!cloneGrades && cloneStudents && newClass.students) {
        newClass.students.forEach(student => {
            student.projects = [];
            student.oralGrade = '';
            student.individualGrade = null;
            student.individualGradeComment = '';
            student.isExpanded = false;
            // Beteiligung zurücksetzen
            student.participation = { positive: 0, negative: 0 };
            const today = new Date().toISOString().split('T')[0];
            student.dailyParticipation = { date: today, positive: 0, negative: 0 };
        });
    }
    
    classes.push(newClass);
    saveData();
    hideModal();
    renderClassesGrid();
}

// Klasse bearbeiten
// Variable für die zu bearbeitende Klasse
let classToEditId = null;

function editClass(classId) {
    if (classId === null || classId === undefined || !classes[classId]) return;
    
    classToEditId = classId;
    const cls = classes[classId];
    const input = safeGetElement('edit-class-input');
    if (input) input.value = cls.name;
    
    const colorInput = safeGetElement('edit-class-color');
    if (colorInput) colorInput.value = cls.color || '#6c757d'; // Default grau
    
    showModal('edit-class-modal');
}

// Klasse speichern nach Bearbeitung
function saveEditedClass() {
    const input = safeGetElement('edit-class-input');
    const colorInput = safeGetElement('edit-class-color');
    if (!input || classToEditId === null) return;
    
    const newName = input.value.trim();
    if (newName) {
        classes[classToEditId].name = newName;
        classes[classToEditId].color = colorInput ? colorInput.value : '#6c757d';
        saveData();
        renderClassesGrid();
        renderClassesGrid();
        
        // Falls aktive Klasse, Breadcrumb aktualisieren
        if (currentPage === 'class' && activeClassId === classToEditId) {
            const breadcrumbActive = safeGetElement('breadcrumb-active');
            if (breadcrumbActive) {
                breadcrumbActive.innerHTML = `
                    <span class="separator">/</span>
                    <span>${classes[classToEditId].name}</span>
                `;
            }
        }
    }
    
    hideModal();
    classToEditId = null;
}

// Klasse löschen
// Variable für die zu löschende Klasse
let classToDeleteId = null;

function deleteClass(classId) {
    if (classId === null || classId === undefined || !classes[classId]) return;
    
    const cls = classes[classId];
    
    swal({
        title: "Klasse löschen?",
        text: `Möchtest du die Klasse "${classes[classId].name}" wirklich löschen? Alle Daten gehen verloren.`,
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            classes.splice(classId, 1);
            window.classes = classes;
            saveData();
            
            // Falls aktive Klasse gelöscht wurde, zurück zur Startseite
            if (currentPage === 'class' && activeClassId === classId) {
                showPage('home');
            } else if (currentPage === 'class' && activeClassId > classId) {
                // Index anpassen, wenn eine Klasse davor gelöscht wurde
                activeClassId--;
            }
            
            renderClassesGrid();
        }
    });
}

// ===== EVENT HANDLING =====

// Event-Listener für Dokumentenladung
document.addEventListener('DOMContentLoaded', function() {
    // Initialisierungsfunktion rufen
    loadData();
    
    // Add styles for the project grades preview
    addProjectGradesPreviewStyles();
    
    // Execute immediately if we're already on the grades tab
    if (activeModule === 'noten') {
        // Wait a short time to ensure the original module has fully rendered
        requestAnimationFrame(() => {
            showProjectGradesInCollapsedView();
        });
    }
    
    // Initialize lightbox
    initImageLightbox();
    
    // Event-Listener für Navigation
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.addEventListener('click', handleHomeClick);
    }
});

// ===== SCHÜLERLISTE MODUL =====

// Schüler Modul rendern
function renderStudentsModule() {
    const studentsTable = safeGetElement('students-list-table');
    if (!studentsTable) return;
    
    // Temporäres Fragment für flackerfreies Update
    const fragment = document.createDocumentFragment();
    
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        classes[activeClassId].students = [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.students.length === 0) {
        studentsTable.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-state">
                        <i class="fas fa-user-graduate"></i>
                        <p>Keine Schüler in dieser Klasse</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    cls.students.forEach((student, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="${student.learningSupport ? 'learning-support' : ''} ${student.eseSupport ? 'ese-support' : ''}">${student.name}</td>
            <td style="text-align: center;">
                <input type="checkbox" ${student.eseSupport ? 'checked' : ''} onclick="toggleEseSupport(${index}, this)">
            </td>
            <td style="text-align: center;">
                <input type="checkbox" ${student.learningSupport ? 'checked' : ''} onclick="toggleLearningSupport(${index}, this)">
            </td>
            <td>
                <div class="student-actions">
                    <button class="btn btn-sm btn-primary btn-square" onclick="editStudentName(${index})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-square" onclick="deleteStudent(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        row.draggable = true;
        row.addEventListener('dragstart', (event) => handleStudentDragStart(event, index));
        row.addEventListener('dragover', handleStudentDragOver);
        row.addEventListener('drop', (event) => handleStudentDrop(event, index));
        row.addEventListener('dragend', handleStudentDragEnd);
        
        fragment.appendChild(row);
    });
    
    // Inhalt auf einmal austauschen
    studentsTable.innerHTML = '';
    studentsTable.appendChild(fragment);
}

// Schüler hinzufügen
function addStudent() {

    const studentNameInput = safeGetElement('new-student-name');
    const positionSelect = safeGetElement('new-student-position');

    if (!studentNameInput || !positionSelect) return;

    const studentName = studentNameInput.value.trim();
    const position = positionSelect.value;

    if (!studentName) {
        if (typeof swal !== 'undefined') {
            swal('Fehler', 'Bitte geben Sie einen Namen für den Schüler ein', 'error');
        }
        return;
    }

    // Zusätzliche Validierung
    if (studentName.length > 100) {
        if (typeof swal !== 'undefined') {
            swal('Fehler', 'Schülername ist zu lang (max. 100 Zeichen)', 'error');
        }
        return;
    }

    // Prüfe, ob Schüler bereits existiert
    if (classes[activeClassId].students.some(student => student.name.toLowerCase() === studentName.toLowerCase())) {
        if (typeof swal !== 'undefined') {
            swal('Fehler', 'Ein Schüler mit diesem Namen existiert bereits in dieser Klasse', 'error');
        }
        return;
    }

    if (!classes[activeClassId].students) {
        classes[activeClassId].students = [];
    }

    const newStudent = {
        name: studentName,
        projects: [],
        oralGrade: '',
        individualGrade: null,
        individualGradeComment: '',
        isExpanded: false,
        notes: [],
        participation: { positive: 0, negative: 0 },
        dailyParticipation: { date: new Date().toISOString().split('T')[0], positive: 0, negative: 0 },
        grades: {
            written: [],
            oral: [],
            other: []
        }
    };

    if (position === 'end') {
        classes[activeClassId].students.push(newStudent);
    } else if (position === 'start') {
        classes[activeClassId].students.unshift(newStudent);
    } else {
        const insertIndex = parseInt(position) + 1; // +1 um NACH der Position einzufügen
        classes[activeClassId].students.splice(insertIndex, 0, newStudent);
    }

    saveData();
    hideModal();

    // Felder zurücksetzen
    if (studentNameInput) studentNameInput.value = '';

    renderModuleContent();

    // Erfolgsmeldung
    if (typeof swal !== 'undefined') {
        swal('Erfolg', `Schüler "${studentName}" wurde hinzugefügt`, 'success');
    }
}

// Funktion zum Bearbeiten eines Schülernamens
// Variable für den zu bearbeitenden Schüler
let studentToEditIndex = null;

function editStudentName(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;
    
    studentToEditIndex = studentIndex;
    const input = safeGetElement('edit-student-input');
    if (input) input.value = student.name;
    
    showModal('edit-student-modal');
}

// Schüler speichern nach Bearbeitung
function saveEditedStudent() {
    const input = safeGetElement('edit-student-input');
    if (!input || studentToEditIndex === null) return;
    
    const newName = input.value.trim();
    if (newName) {
        classes[activeClassId].students[studentToEditIndex].name = newName;
        saveData();
        renderModuleContent();
    }
    
    hideModal();
    studentToEditIndex = null;
}

// Schüler importieren
function importStudents() {
    if (!classes[activeClassId]) return;
    
    const importNamesTextarea = safeGetElement('import-names');
    if (!importNamesTextarea) return;
    
    const namesText = importNamesTextarea.value.trim();
    
    if (!namesText) {
        swal("Fehler", "Bitte füge Namen ein", "error");
        return;
    }
    
    const names = namesText.split('\n').filter(name => name.trim() !== '');
    
    if (names.length === 0) {
        swal("Fehler", "Keine gültigen Namen gefunden", "error");
        return;
    }
    
    if (!classes[activeClassId].students) {
        classes[activeClassId].students = [];
    }
    
    let importedCount = 0;
    
    names.forEach(name => {
        const cleanName = name.trim();
        if (cleanName && !classes[activeClassId].students.some(s => s.name === cleanName)) {
            classes[activeClassId].students.push({
                name: cleanName,
                projects: [],
                oralGrade: '',
                individualGrade: null,
                individualGradeComment: '',
                isExpanded: false,
                notes: [],
                participation: { positive: 0, negative: 0 },
                grades: {
                    written: [],
                    oral: [],
                    other: []
                }
            });
            importedCount++;
        }
    });
    
    if (importedCount > 0) {
        saveData();
        if (importNamesTextarea) importNamesTextarea.value = '';
        renderModuleContent();
    } else {
        swal("Info", "Keine neuen Schüler importiert", "info");
    }
}

// Schüler löschen
function deleteStudent(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const sortedStudents = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= sortedStudents.length) return;
    
    const student = sortedStudents[studentIndex];
    
    swal({
        title: "Schüler löschen?",
        text: `Möchtest du ${student.name} wirklich löschen?`,
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
            if (originalIndex !== -1) {
                // Entsprechenden Tisch im Sitzplan entfernen oder studentIndex aktualisieren
                if (classes[activeClassId].sitzplan && classes[activeClassId].sitzplan.desks) {
                    // Finde den Desk des zu löschenden Schülers
                    const deskIndex = classes[activeClassId].sitzplan.desks.findIndex(desk => desk.studentIndex === originalIndex);
                    if (deskIndex !== -1) {
                        // Entferne den Desk des gelöschten Schülers
                        classes[activeClassId].sitzplan.desks.splice(deskIndex, 1);
                    }
                    
                    // Aktualisiere alle studentIndex-Werte für Desks, die höhere Indizes hatten
                    classes[activeClassId].sitzplan.desks.forEach(desk => {
                        if (desk.studentIndex > originalIndex) {
                            desk.studentIndex--;
                        }
                    });
                }
                
                // Schüler aus der Liste entfernen
                classes[activeClassId].students.splice(originalIndex, 1);
                saveData();
                renderModuleContent();
            }
        }
    });
}

// Helper für sortierte Schülerlisten
function getSortedStudents() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        return [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.alphabeticallySorted) {
        // Erstelle eine Kopie der Schülerliste und sortiere sie
        return [...cls.students].sort((a, b) => {
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
        });
    }
    
    return cls.students;
}

// Funktion zum Umschalten des Förderschwerpunkts ESE
function toggleEseSupport(studentIndex, checkbox) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Im Schülermodul ist es die direkte Reihenfolge aus dem Array
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;
    
    // Prüfen, ob der Förderschwerpunkt deaktiviert werden soll
    if (student.eseSupport) {
        // Checkbox zunächst visuell auf "checked" lassen
        checkbox.checked = true;
        
        // Bestätigung anfordern
        swal({
            title: "Förderschwerpunkt deaktivieren?",
            text: `Möchtest du den Förderschwerpunkt "ESE" für ${student.name} wirklich deaktivieren?`,
            icon: "warning",
            buttons: ["Abbrechen", "Deaktivieren"],
            dangerMode: true,
        })
        .then((willDisable) => {
            if (willDisable) {
                student.eseSupport = false;
                checkbox.checked = false;
                saveData();
                renderStudentsModule();
            } else {
                checkbox.checked = true;
            }
        });
        return;
    }
    
    // Wenn aktiviert wird (von false auf true)
    student.eseSupport = true;
    saveData();
    renderStudentsModule();
}

// Funktion zum Umschalten des Förderschwerpunkts Lernen
function toggleLearningSupport(studentIndex, checkbox) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Prüfen, ob der Förderschwerpunkt deaktiviert werden soll
    const currentStatus = classes[activeClassId].students[originalIndex].learningSupport;
    
    if (currentStatus) {
        // Checkbox zurücksetzen (visuell)
        checkbox.checked = true;
        
        // Bestätigung anfordern, wenn Förderschwerpunkt deaktiviert werden soll
        swal({
            title: "Förderschwerpunkt deaktivieren?",
            text: `Möchtest du den Förderschwerpunkt "Lernen" für ${student.name} wirklich deaktivieren?`,
            icon: "warning",
            buttons: ["Abbrechen", "Deaktivieren"],
            dangerMode: true,
        })
        .then((willDisable) => {
            if (willDisable) {
                // Umschalten des Förderschwerpunkts
                classes[activeClassId].students[originalIndex].learningSupport = false;
                checkbox.checked = false; // Checkbox aktualisieren
                
                // Daten speichern
                saveData();
                
                // UI sofort aktualisieren durch Neurendern des aktuellen Moduls
                if (activeModule === 'noten') {
                    renderGradesModule();
                } else if (activeModule === 'sitzplan') {
                    renderSitzplanModule();
                } else if (activeModule === 'schueler') {
                    renderStudentsModule();
                } else if (activeModule === 'zeugnis') {
                    renderZeugnisModule();
                }
            } else {
                // Bei Abbruch Checkbox zurücksetzen
                checkbox.checked = true;
            }
        });
    } else {
        // Direkt aktivieren ohne Bestätigung
        classes[activeClassId].students[originalIndex].learningSupport = true;
        
        // Daten speichern
        saveData();
        
        // UI sofort aktualisieren durch Neurendern des aktuellen Moduls
        if (activeModule === 'noten') {
            renderGradesModule();
        } else if (activeModule === 'sitzplan') {
            renderSitzplanModule();
        } else if (activeModule === 'schueler') {
            renderStudentsModule();
        } else if (activeModule === 'zeugnis') {
            renderZeugnisModule();
        }
    }
}

// Alphabetische Sortierung umschalten - Mit direkter DOM-Manipulation
// Modify the toggleSortStudents function to completely rebuild the UI
function toggleSortStudents() {
    if (!classes[activeClassId]) return;
    
    classes[activeClassId].alphabeticallySorted = !classes[activeClassId].alphabeticallySorted;
    saveData();
    
    // Render das aktuelle Modul neu
    if (activeModule === 'noten') {
        renderGradesModule();
    } else {
        renderModuleContent();
    }
}

// ===== SCHÜLERNOTIZEN =====

// Modal für Schülernotizen anzeigen
function showStudentNotesModal(studentIndex, sourceTab) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    let studentsArray;
    
    // Je nach Tab die richtige sortierte Schülerliste verwenden
    if (sourceTab === 'grades') {
        studentsArray = getSortedStudents();
    } else if (sourceTab === 'sitzplan') {
        // Im Sitzplan-Modul verwenden wir den direkten Index
        studentsArray = classes[activeClassId].students;
    } else {
        // Fallback
        studentsArray = classes[activeClassId].students;
    }
    
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass das notes-Array existiert
    if (!classes[activeClassId].students[originalIndex].notes) {
        classes[activeClassId].students[originalIndex].notes = [];
    }
    
    // Modal-Felder aktualisieren
    const studentNameElement = safeGetElement('student-notes-name');
    const notesListElement = safeGetElement('student-notes-list');
    const newNoteTextarea = safeGetElement('new-student-note-content');
    const modalElement = safeGetElement('student-notes-modal');
    
    if (!studentNameElement || !notesListElement || !newNoteTextarea || !modalElement) return;
    
    studentNameElement.textContent = `Schüler: ${student.name}`;
    studentNameElement.style.marginBottom = '15px';
    newNoteTextarea.value = '';
    
    // Bestehende Notizen anzeigen
    renderStudentNotes(originalIndex);
    
    // Index und Tab für späteren Gebrauch speichern
    modalElement.dataset.studentIndex = originalIndex;
    modalElement.dataset.sourceTab = sourceTab;
    
    // Wenn aus dem Sitzplan, Schließen-Button anpassen
    if (sourceTab === 'sitzplan') {
        const closeButton = modalElement.querySelector('.btn-light[onclick="hideModal()"]');
        if (closeButton) {
            closeButton.setAttribute('onclick', 'if(selectedDesk) { showEvaluationPanel(selectedDesk); } else { hideModal(); }');
        }
    } else {
        // Für andere Tabs sicherstellen, dass der Button hideModal() aufruft
        const closeButton = modalElement.querySelector('.btn-light');
        if (closeButton) {
            closeButton.setAttribute('onclick', 'hideModal()');
        }
    }
    
    showModal('student-notes-modal');
}

// Notizen für einen Schüler rendern
function renderStudentNotes(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    const notesListElement = safeGetElement('student-notes-list');
    
    if (!notesListElement) return;
    
    notesListElement.innerHTML = '';
    
    if (!student.notes || student.notes.length === 0) {
        notesListElement.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sticky-note"></i>
                <p>Keine Notizen vorhanden</p>
            </div>
        `;
        return;
    }
    
    // Notizen sortieren, wichtige zuerst
    const sortedNotes = [...student.notes].sort((a, b) => {
        // Erst nach Wichtigkeit sortieren
        if (a.important && !b.important) return -1;
        if (!a.important && b.important) return 1;
        // Dann nach Datum (neueste zuerst)
        return new Date(b.date) - new Date(a.date);
    });
    
    sortedNotes.forEach((note, noteIndex) => {
        const noteDate = new Date(note.date);
        const formattedDate = noteDate.toLocaleDateString('de-DE') + ' ' + 
                              noteDate.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
        
        const noteItem = document.createElement('div');
        noteItem.className = `student-note-item ${note.important ? 'important' : ''}`;
        
        noteItem.innerHTML = `
            <div class="student-note-content">${note.content}</div>
            <div class="student-note-meta">
                <span>${formattedDate}</span>
                <div class="student-note-actions">
                    <button class="important-star" onclick="toggleNoteImportance(${studentIndex}, ${noteIndex})">Anpinnen</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStudentNote(${studentIndex}, ${noteIndex})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        notesListElement.appendChild(noteItem);
    });
}

// Notiz zu einem Schüler hinzufügen
function addStudentNote() {
    const modalElement = safeGetElement('student-notes-modal');
    if (!modalElement) return;
    
    const studentIndex = parseInt(modalElement.dataset.studentIndex);
    const sourceTab = modalElement.dataset.sourceTab;
    
    if (isNaN(studentIndex) || !classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) {
        return;
    }
    
    const newNoteTextarea = safeGetElement('new-student-note-content');
    if (!newNoteTextarea) return;
    
    const noteContent = newNoteTextarea.value.trim();
    
    if (!noteContent) {
        swal("Fehler", "Bitte gib einen Inhalt für die Notiz ein", "error");
        return;
    }
    
    // Sicherstellen, dass das notes-Array existiert
    if (!classes[activeClassId].students[studentIndex].notes) {
        classes[activeClassId].students[studentIndex].notes = [];
    }
    
    // Neue Notiz erstellen
    const newNote = {
        content: noteContent,
        date: new Date().toISOString(),
        important: false
    };
    
    // Notiz hinzufügen
    classes[activeClassId].students[studentIndex].notes.push(newNote);
    
    // Daten speichern
    saveData();
    
    // Eingabefeld zurücksetzen
    newNoteTextarea.value = '';
    
    // Notizen neu rendern
    renderStudentNotes(studentIndex);
    
    // Je nach Quelle das UI aktualisieren
    if (activeModule === 'noten') {
        renderGradesModule();
    } else {
        renderModuleContent();
    }
}

// Notizvorlage verwenden
function useNoteTemplate(templateText) {
    const newNoteTextarea = safeGetElement('new-student-note-content');
    if (newNoteTextarea) {
        newNoteTextarea.value = templateText;
        newNoteTextarea.focus();
    }
}

// Funktion zum automatischen Hinzufügen einer Schulplaner-Eintrag-Notiz
function addSchulplanerEntryNote(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) {
        return;
    }
    
    // Sicherstellen, dass das notes-Array existiert
    if (!classes[activeClassId].students[studentIndex].notes) {
        classes[activeClassId].students[studentIndex].notes = [];
    }
    
    // Neue Notiz erstellen
    const newNote = {
        content: "Eintrag in den Schulplaner",
        date: new Date().toISOString(),
        important: true
    };
    
    // Notiz hinzufügen
    classes[activeClassId].students[studentIndex].notes.push(newNote);
    
    // Daten speichern
    saveData();
    
    // Rote Punkte sofort aktualisieren
    updateAttentionDotsForStudent(studentIndex);
    
    // Punkte im Bewertungsmodal aktualisieren
    updateEvaluationModalDots(studentIndex);
}

// Wichtigkeit einer Notiz umschalten
function toggleNoteImportance(studentIndex, noteIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    
    if (!student.notes || noteIndex < 0 || noteIndex >= student.notes.length) return;
    
    // Index der sortierten Notiz zum Original-Array-Index umwandeln
    const sortedNotes = [...student.notes].sort((a, b) => {
        if (a.important && !b.important) return -1;
        if (!a.important && b.important) return 1;
        return new Date(b.date) - new Date(a.date);
    });
    
    const sortedNote = sortedNotes[noteIndex];
    const originalNoteIndex = student.notes.findIndex(note => 
        note.date === sortedNote.date && note.content === sortedNote.content);
    
    if (originalNoteIndex === -1) return;
    
    // Wichtigkeitsstatus umschalten
    student.notes[originalNoteIndex].important = !student.notes[originalNoteIndex].important;
    
    // Daten speichern
    saveData();
    
    // Notizen neu rendern
    renderStudentNotes(studentIndex);
    
    // Rote Punkte sofort aktualisieren, ohne komplette Neurenderung
    updateAttentionDotsForStudent(studentIndex);
    
    // Punkte im Bewertungsmodal aktualisieren
    updateEvaluationModalDots(studentIndex);
}

// Rote Punkte für einen Schüler in allen Modulen sofort aktualisieren
function updateAttentionDotsForStudent(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    const notesCount = student.notes ? student.notes.filter(note => note.important).length : 0;
    
    // Sitzplan-Modul aktualisieren
    if (activeModule === 'sitzplan') {
        // Alle Tische durchgehen und den passenden aktualisieren
        const desks = document.querySelectorAll('#sitzplan-module .desk');
        desks.forEach(deskElement => {
            const deskLabel = deskElement.querySelector('.desk-label');
            if (deskLabel && deskLabel.textContent.trim() === student.name) {
                // Bestehenden roten Punkt entfernen
                const existingDot = deskLabel.querySelector('.attention-dot');
                if (existingDot) {
                    existingDot.remove();
                }
                
                // Bestehende blaue Punkte entfernen
                const existingSchulplanerDots = deskLabel.querySelectorAll('.schulplaner-dot');
                existingSchulplanerDots.forEach(dot => dot.remove());
                
                // Neue Punkte hinzufügen
                let dotsHtml = '';
                
                // Rote Punkte für wichtige Notizen
                if (notesCount > 0) {
                    dotsHtml += `<span class="attention-dot" title="Wichtige Notiz vorhanden"></span>`;
                }
                
                // Blaue Punkte für vergessene Schulplaner
                const activeSchulplanerCount = student.hwHistory ? student.hwHistory.filter(entry => 
                    entry.type === 'schulplaner' && !entry.nachgereicht
                ).length : 0;
                if (activeSchulplanerCount > 0) {
                    const displayCount = Math.min(activeSchulplanerCount, 3); // Maximal 3 Punkte anzeigen
                    for (let i = 0; i < displayCount; i++) {
                        dotsHtml += `<span class="schulplaner-dot" title="Einträge in den Schulplaner (${activeSchulplanerCount}x)"></span>`;
                    }
                }
                
                // Punkte zum Label hinzufügen
                if (dotsHtml) {
                    deskLabel.insertAdjacentHTML('beforeend', dotsHtml);
                }
            }
        });
    }
}

// Blaue Punkte für Schulplaner-Vergessen für einen Schüler aktualisieren
function updateSchulplanerDotsForStudent(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    
    // Anzahl der aktiven (nicht nachgereichten) Schulplaner-Einträge zählen
    const activeSchulplanerCount = student.hwHistory ? student.hwHistory.filter(entry => 
        entry.type === 'schulplaner' && entry.active !== false
    ).length : 0;

    // Anzahl der aktiven Abschreibtext-Einträge zählen
    const activeAbschreibtextCount = student.hwHistory ? student.hwHistory.filter(entry => 
        entry.type === 'abschreibtext' && entry.active !== false
    ).length : 0;
    
    // Nur im Sitzplan-Modul aktualisieren
    if (activeModule === 'sitzplan') {
        const desks = document.querySelectorAll('#sitzplan-module .desk');
        desks.forEach(deskElement => {
            const deskLabel = deskElement.querySelector('.desk-label');
            if (deskLabel && deskLabel.textContent.trim() === student.name) {
                // Klassen entfernen
                deskElement.classList.remove('has-schulplaner-entry', 'has-abschreibtext-entry', 'has-both-entries');

                // Neu setzen
                if (activeSchulplanerCount > 0 && activeAbschreibtextCount > 0) {
                    deskElement.classList.add('has-both-entries');
                } else if (activeSchulplanerCount > 0) {
                    deskElement.classList.add('has-schulplaner-entry');
                } else if (activeAbschreibtextCount > 0) {
                    deskElement.classList.add('has-abschreibtext-entry');
                }
            }
        });
    }
}

// Funktion zum sofortigen Aktualisieren der learning-support CSS-Klasse in allen Modulen
function updateLearningSupportStyling(originalIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        originalIndex < 0 || originalIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[originalIndex];
    const hasLearningSupport = student.learningSupport;
    
    // 1. Noten-Modul aktualisieren
    const sortedGradeStudents = getSortedStudents();
    const gradeIndex = sortedGradeStudents.findIndex(s => s.name === student.name);
    if (gradeIndex !== -1) {
        const studentNameElement = document.querySelector(`#noten-module .student-card:nth-child(${gradeIndex + 1}) .student-name`);
        if (studentNameElement) {
            if (hasLearningSupport) {
                studentNameElement.classList.add('learning-support');
            } else {
                studentNameElement.classList.remove('learning-support');
            }
        }
    }
    
    // 2. Schülerliste-Modul aktualisieren
    const studentListRows = document.querySelectorAll('#student-list-table tbody tr');
    studentListRows.forEach((row, rowIndex) => {
        const nameCell = row.querySelector('td:nth-child(2)'); // Zweite Spalte für Namen
        if (nameCell && nameCell.textContent.trim() === student.name) {
            if (hasLearningSupport) {
                nameCell.classList.add('learning-support');
            } else {
                nameCell.classList.remove('learning-support');
            }
        }
    });
    
    // 3. Sitzplan-Modul aktualisieren
    if (activeModule === 'sitzplan') {
        const desks = document.querySelectorAll('#sitzplan-module .desk');
        desks.forEach(deskElement => {
            const deskLabel = deskElement.querySelector('.desk-label');
            if (deskLabel && deskLabel.textContent.trim() === student.name) {
                if (hasLearningSupport) {
                    deskLabel.classList.add('learning-support');
                } else {
                    deskLabel.classList.remove('learning-support');
                }
            }
        });
    }
}

// Notiz löschen
function deleteStudentNote(studentIndex, noteIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    
    if (!student.notes || noteIndex < 0 || noteIndex >= student.notes.length) return;
    
    // Index der sortierten Notiz zum Original-Array-Index umwandeln
    const sortedNotes = [...student.notes].sort((a, b) => {
        if (a.important && !b.important) return -1;
        if (!a.important && b.important) return 1;
        return new Date(b.date) - new Date(a.date);
    });
    
    const sortedNote = sortedNotes[noteIndex];
    const originalNoteIndex = student.notes.findIndex(note => 
        note.date === sortedNote.date && note.content === sortedNote.content);
    
    if (originalNoteIndex === -1) return;
    
    swal({
        title: "Notiz löschen?",
        text: "Möchtest du diese Notiz wirklich löschen?",
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            // Notiz löschen
            student.notes.splice(originalNoteIndex, 1);
            
            // Daten speichern
            saveData();
            
            // Notizen neu rendern
            renderStudentNotes(studentIndex);
            
            // Rote Punkte sofort aktualisieren, ohne komplette Neurenderung
            updateAttentionDotsForStudent(studentIndex);
            
            // Punkte im Bewertungsmodal aktualisieren
            updateEvaluationModalDots(studentIndex);
            
            // UI in allen Modulen aktualisieren
            if (activeModule === 'noten') {
                renderGradesModule();
            } else {
                renderModuleContent();
            }
        }
    });
}

// ===== NOTENBERECHNUNG UND FUNKTIONEN =====

// Endnote berechnen
function calculateFinalGrade(projects) {
    if (!projects || !Array.isArray(projects)) {
        return { rounded: "Keine Noten", exact: "Keine Noten", numeric: 0 };
    }
    const writtenGrades = projects
        .map(project => typeof convertGrade === "function" ? convertGrade(project.grade) : 0)
        .filter(grade => grade > 0);
    if (writtenGrades.length === 0) {
        return { rounded: "Keine Noten", exact: "Keine Noten", numeric: 0 };
    }
    const writtenAverage = writtenGrades.reduce((sum, grade) => sum + grade, 0) / writtenGrades.length;
    return {
        rounded: typeof roundGrade === "function" ? roundGrade(writtenAverage) : "-",
        exact: writtenAverage.toFixed(3),
        numeric: writtenAverage
    };
}

// Noten Modul rendern
function renderGradesModule() {
    const studentsList = safeGetElement('students-list');
    if (!studentsList) return;
    
    // Bestehenden Inhalt in ein temporäres DIV sichern (für flackerfreies Update)
    let tempContainer = document.createElement('div');
    
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    if (!cls.students || cls.students.length === 0) {
        tempContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-graduate"></i>
                <p>Keine Schüler in dieser Klasse</p>
            </div>
        `;
        studentsList.innerHTML = tempContainer.innerHTML;
        return;
    }
    
    // Sort-Button aktualisieren
    const sortBtn = safeGetElement('sort-students-btn');
    if (sortBtn) {
        sortBtn.innerHTML = `
            <i class="fas fa-sort-alpha-down"></i> ${cls.alphabeticallySorted ? 'Sortierung aufheben' : 'Sortieren'}
        `;
        if (cls.alphabeticallySorted) {
            sortBtn.classList.add('btn-orange');
        } else {
            sortBtn.classList.remove('btn-orange');
        }
        sortBtn.onclick = () => toggleSortStudents();
    }
    
    const studentsToRender = cls.students;
    
    studentsToRender.forEach((student, studentIndex) => {
        if (!student.projects) student.projects = [];
        if (student.notenExpanded === undefined) student.notenExpanded = false;
        
        const studentCard = document.createElement('div');
        studentCard.className = 'student-card'; // Kein fade-in Klasse mehr, um Flackern zu verhindern
        
        const finalGrade = calculateFinalGrade(student.projects);
        
        let studentHeader = `
            <div class="student-header" onclick="toggleStudentDetails('noten', ${studentIndex})">
                <div class="student-name ${student.learningSupport ? 'learning-support' : ''} ${student.eseSupport ? 'ese-support' : ''}">
                    <i class="fas fa-user"></i> ${student.name}
                    <i id="notentoggleIcon-${studentIndex}" class="fas fa-chevron-down toggle-icon ${student.notenExpanded ? 'rotate' : ''}"></i>
                </div>
        `;
        
        if (finalGrade.numeric > 0) {
            const gradeColorClass = getGradeColorClass(finalGrade.numeric);
            studentHeader += `
                <div class="student-grade">
                    <span class="grade-badge ${gradeColorClass}">${finalGrade.rounded}</span>
                    <span>${finalGrade.exact}</span>
                </div>
            `;
        } else {
            studentHeader += `
                <div class="student-grade">
                    <span class="badge badge-secondary">Keine Note</span>
                </div>
            `;
        }
        
        studentHeader += `</div>`;
        
        // Details-Bereich - Nur noch Projekte
        let studentDetails = `
            <div id="notenstudentDetails-${studentIndex}" class="student-details ${student.notenExpanded ? 'show' : ''}">
        `;
        
        // Projekte-Sektion
        studentDetails += `
            <div style="margin-top: 15px;">
                <label>Projekte:</label>
        `;
        
        if (student.projects.length === 0) {
            studentDetails += `
                <div class="empty-state" style="padding: 20px 0;">
                </div>
            `;
        } else {
            student.projects.forEach((project, projectIndex) => {
                const projectGrade = convertGrade(project.grade);
                const gradeColorClass = projectGrade > 0 ? getGradeColorClass(projectGrade) : '';
                
                studentDetails += `
                    <div class="project-item">
                        <div class="form-row">
                            <div>
                                <input type="text" class="form-control" placeholder="Projektname" 
                                    value="${project.name || ''}" 
                                    onchange="updateProjectName(${studentIndex}, ${projectIndex}, this.value)">
                            </div>
                            <div>
                                <select class="form-control" onchange="updateGradeLocally(${studentIndex}, ${projectIndex}, this.value)">
                                    <option value="">Note eingeben</option>
                                    ${['1', '1-', '2+', '2', '2-', '3+', '3', '3-', '4+', '4', '4-', '5+', '5', '5-', '6+', '6'].map(grade => `
                                        <option value="${grade}" ${project.grade === grade ? 'selected' : ''}>${grade}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        // Projekt-Tools
        studentDetails += `
            <div class="project-tools">
            </div>
        `;
        
        studentDetails += `</div>`;
        
        studentCard.innerHTML = studentHeader + studentDetails;
        tempContainer.appendChild(studentCard);
    });
    
    // Den gesamten Inhalt auf einmal austauschen (flackerfreier)
    studentsList.innerHTML = tempContainer.innerHTML;
    
    // Nachdem der DOM aktualisiert wurde, die Projektnoten in der Kopfzeile anzeigen
    showProjectGradesInCollapsedView();
}

// Funktion zum lokalen Aktualisieren einer Note ohne Neu-Rendern der Liste
function updateGradeLocally(studentIndex, projectIndex, grade) {
    const cls = classes[activeClassId];
    if (!cls || !cls.students[studentIndex]) return;
    
    const student = cls.students[studentIndex];
    if (!student.projects[projectIndex]) return;
    
    // Note setzen
    student.projects[projectIndex].grade = grade;
    
    // Oral weight holen
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    // Endnote neu berechnen
    const finalGrade = calculateFinalGrade(student.projects);
    
    // HTML für die Endnote
    let gradeHtml;
    if (finalGrade.numeric > 0) {
        const gradeColorClass = getGradeColorClass(finalGrade.numeric);
        gradeHtml = `<span class="grade-badge ${gradeColorClass}">${finalGrade.rounded}</span><span>${finalGrade.exact}</span>`;
    } else {
        gradeHtml = `<span class="badge badge-secondary">Keine Note</span>`;
    }
    
    // DOM für Endnote in der Kopfzeile aktualisieren
    const studentCards = document.querySelectorAll('#students-list .student-card');
    if (studentCards[studentIndex]) {
        const headerGradeEl = studentCards[studentIndex].querySelector('.student-header .student-grade');
        if (headerGradeEl) {
            headerGradeEl.innerHTML = gradeHtml;
        }
    }
    
    // DOM für Endnote in den Details aktualisieren
    const detailsGradeEl = document.querySelector(`#notenstudentDetails-${studentIndex} .student-grade`);
    if (detailsGradeEl) {
        detailsGradeEl.innerHTML = gradeHtml;
    }
    
    // Projektnoten in der Kopfzeile aktualisieren
    showProjectGradesInCollapsedView();
    
    // Sicherstellen, dass die globale Referenz für Cloud-Sync aktuell ist
    window.classes = classes;
    
    // Daten speichern
    saveData();
}

// Mündliche Noten Modul rendern
function renderMuendlicheNotenModule() {
    const studentsList = safeGetElement('muendliche-noten-students-list');
    if (!studentsList) return;
    
    studentsList.innerHTML = '';
    
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    
    if (!cls.students || cls.students.length === 0) {
        studentsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-graduate"></i>
                <p>Keine Schüler in dieser Klasse</p>
            </div>
        `;
        return;
    }
    
    // Sort-Button aktualisieren
    const sortBtn = safeGetElement('sort-muendlich-btn');
    if (sortBtn) {
        sortBtn.innerHTML = `
            <i class="fas fa-sort-alpha-down"></i> ${cls.alphabeticallySorted ? 'Sortierung aufheben' : 'Sortieren'}
        `;
        // Farbklasse hinzufügen oder entfernen je nach Zustand
        if (cls.alphabeticallySorted) {
            sortBtn.classList.add('btn-orange');
        } else {
            sortBtn.classList.remove('btn-orange');
        }
        sortBtn.onclick = () => toggleSortStudents();
    }
    
    // Sortierte oder unsortierte Schülerliste
    const studentsToRender = cls.students;
    
    studentsToRender.forEach((student, studentIndex) => {
        // Initialisiere Expand-Zustände falls nicht vorhanden
        if (student.muendlicheExpanded === undefined) student.muendlicheExpanded = false;
        
        // Anzahl der wichtigen Notizen für Badge
        const notesCount = student.notes ? student.notes.filter(note => note.important).length : 0;
        
        const studentCard = document.createElement('div');
        studentCard.className = 'student-card fade-in';
        studentCard.id = `student-card-${studentIndex}`;
        
        // Studentenkopf mit Namen und mündlicher Note
        let studentHeader = `
            <div class="student-header muendliche-student-header" onclick="toggleStudentDetails('muendliche', ${studentIndex})">
                <div class="student-name ${student.learningSupport ? 'learning-support' : ''}">
                    <i class="fas fa-user"></i> ${student.name}
                    <i id="muendlichetoggleIcon-${studentIndex}" class="fas fa-chevron-down toggle-icon ${student.muendlicheExpanded ? 'rotate' : ''}"></i>
                </div>
        `;
        
        // Mündliche Noten im eingeklappten Zustand rechts anzeigen
        studentHeader += `<div class="overview-projects-cell">`;
        if (student.oralGrades && student.oralGrades.length > 0) {
            studentHeader += `
                    ${student.oralGrades.map((oral, index) => {
                        const numeric = convertGrade(oral.grade);
                        const colorClass = getGradeColorClass(numeric);
                        let html = `<span class="grade-badge ${colorClass}">${oral.grade}</span>`;
                        if (index < student.oralGrades.length - 1) {
                            html += '<span class="grade-separator">•</span>';
                        }
                        return html;
                    }).join('')}
            `;
        }
        studentHeader += `</div>`;
        
        studentHeader += `</div>`;
        
        // Details-Bereich - Mündliche Noten auflisten
        let studentDetails = `
            <div id="muendlichestudentDetails-${studentIndex}" class="student-details ${student.muendlicheExpanded ? 'show' : ''}">
        `;
        
        if (student.oralGrades && student.oralGrades.length > 0) {
            student.oralGrades.forEach((oral, oralIndex) => {
                const numeric = convertGrade(oral.grade);
                const colorClass = getGradeColorClass(numeric);
                studentDetails += `
                    <div class="project-item">
                        <div class="form-row">
                            <div>
                                <span class="grade-badge ${colorClass}">${oral.grade}</span> (${numeric.toFixed(2)}) - ${oral.date}
                            </div>
                            <div>
                                <button class="btn btn-warning" onclick="editOralGrade(${studentIndex}, ${oralIndex})">
                                    Bearbeiten
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            studentDetails += `
                <div class="empty-state" style="padding: 20px 0;">
                    <p>Keine mündlichen Noten</p>
                </div>
            `;
        }
        
        studentDetails += `</div>`;
        
        studentCard.innerHTML = studentHeader + studentDetails;
        studentsList.appendChild(studentCard);
    });
}

// Funktion zum Öffnen des Modals für mündliche Note für alle
function addOralGradeToAll() {
    if (!classes[activeClassId] || !classes[activeClassId].students || classes[activeClassId].students.length === 0) {
        return;
    }
    
    currentOralStudentIndex = 0;
    tempOralGrades = new Array(classes[activeClassId].students.length).fill(null);
    
    showModal('add-oral-grade-all-modal');
    showCurrentOralStudent();
}

// Funktion zum Anzeigen des aktuellen Schülers im Modal
function showCurrentOralStudent() {
    const students = classes[activeClassId].students;
    if (!students || currentOralStudentIndex >= students.length) {
        saveAllOralGrades();
        return;
    }
    
    const student = students[currentOralStudentIndex];
    const nameElement = safeGetElement('current-student-name');
    if (nameElement) {
        nameElement.textContent = student.name;
    }
    
    // Buttons aktualisieren
    const backBtn = safeGetElement('back-student-btn');
    const nextBtn = safeGetElement('next-student-btn');
    
    if (backBtn) {
        backBtn.style.display = currentOralStudentIndex > 0 ? 'inline-block' : 'none';
    }
    
    if (nextBtn) {
        nextBtn.textContent = currentOralStudentIndex === students.length - 1 ? 'Fertig' : 'Weiter';
    }
}

// Funktion zum Auswählen einer mündlichen Note
function selectOralGrade(grade) {
    tempOralGrades[currentOralStudentIndex] = {
        grade: grade,
        date: getTodayDateString()
    };
    nextStudent();
}

// Funktion zum nächsten Schüler
function nextStudent() {
    currentOralStudentIndex++;
    showCurrentOralStudent();
}

// Funktion zum vorherigen Schüler
function backStudent() {
    if (currentOralStudentIndex > 0) {
        currentOralStudentIndex--;
        showCurrentOralStudent();
    }
}

// Funktion zum Abbrechen
function cancelOralGradeAll() {
    tempOralGrades = [];
    hideModal();
}

// Funktion zum Speichern aller mündlichen Noten
function saveAllOralGrades() {
    const students = classes[activeClassId].students;
    students.forEach((student, index) => {
        if (tempOralGrades[index]) {
            if (!student.oralGrades) {
                student.oralGrades = [];
            }
            student.oralGrades.push(tempOralGrades[index]);
            // Aktualisiere auch die letzte oralGrade für Kompatibilität
            student.oralGrade = tempOralGrades[index].grade;
        }
    });
    
    saveData();
    renderMuendlicheNotenModule();
    renderOverviewModule();
    hideModal();
}

// Funktion zum Öffnen des Modals für mündliche Note für einzelnen Schüler
function addOralGradeToSingle() {
    if (!classes[activeClassId] || !classes[activeClassId].students || classes[activeClassId].students.length === 0) {
        return;
    }
    
    selectedSingleOralGrade = null;
    selectedSingleStudentIndex = null;
    
    // Suchfeld leeren
    const searchInput = safeGetElement('single-oral-student-search');
    const suggestions = safeGetElement('single-oral-student-suggestions');
    if (searchInput) {
        searchInput.value = '';
    }
    if (suggestions) {
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
    }
    
    // Buttons zurücksetzen
    const modal = safeGetElement('add-oral-grade-single-modal');
    if (modal) {
        const buttons = modal.querySelectorAll('.weight-btn');
        buttons.forEach(button => button.classList.remove('active-weight'));
    }
    
    showModal('add-oral-grade-single-modal');
}

// Funktion zum Filtern der Schüler für das einzelne Modal
function filterSingleOralStudents() {
    const searchInput = safeGetElement('single-oral-student-search');
    const suggestions = safeGetElement('single-oral-student-suggestions');
    
    if (!searchInput || !suggestions) return;
    
    const query = searchInput.value.toLowerCase().trim();
    
    if (query === '') {
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
        selectedSingleStudentIndex = null;
        return;
    }
    
    const students = classes[activeClassId].students;
    const filteredStudents = students.filter((student, index) => 
        student.name.toLowerCase().includes(query)
    );
    
    suggestions.innerHTML = '';
    
    if (filteredStudents.length > 0) {
        filteredStudents.forEach((student, originalIndex) => {
            const li = document.createElement('li');
            li.textContent = student.name;
            li.onclick = () => selectSingleOralStudent(students.indexOf(student), student.name);
            suggestions.appendChild(li);
        });
        suggestions.style.display = 'block';
    } else {
        suggestions.style.display = 'none';
    }
}

// Funktion zum Auswählen eines Schülers aus den Vorschlägen
function selectSingleOralStudent(index, name) {
    selectedSingleStudentIndex = index;
    const searchInput = safeGetElement('single-oral-student-search');
    const suggestions = safeGetElement('single-oral-student-suggestions');
    
    if (searchInput) {
        searchInput.value = name;
    }
    if (suggestions) {
        suggestions.style.display = 'none';
    }
}

// Funktion zum Auswählen einer mündlichen Note für einzeln
function selectSingleOralGrade(grade) {
    selectedSingleOralGrade = grade;
    
    // Buttons hervorheben
    const modal = safeGetElement('add-oral-grade-single-modal');
    if (modal) {
        const buttons = modal.querySelectorAll('.weight-btn');
        buttons.forEach(button => {
            if (button.dataset.grade === grade) {
                button.classList.add('active-weight');
            } else {
                button.classList.remove('active-weight');
            }
        });
    }
}

// Funktion zum Speichern der einzelnen mündlichen Note
function saveSingleOralGrade() {
    if (selectedSingleStudentIndex === null || !selectedSingleOralGrade) {
        alert('Bitte Schüler auswählen und Note wählen.');
        return;
    }
    
    const student = classes[activeClassId].students[selectedSingleStudentIndex];
    
    const newOralGrade = {
        grade: selectedSingleOralGrade,
        date: getTodayDateString()
    };
    
    if (!student.oralGrades) {
        student.oralGrades = [];
    }
    student.oralGrades.push(newOralGrade);
    // Aktualisiere auch die letzte oralGrade für Kompatibilität
    student.oralGrade = newOralGrade.grade;
    
    saveData();
    renderMuendlicheNotenModule();
    renderOverviewModule();
    hideModal();
}

// Funktion zum Löschen einer mündlichen Note
function deleteOralGrade(studentIndex, oralIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const student = classes[activeClassId].students[studentIndex];
    if (student.oralGrades && student.oralGrades[oralIndex]) {
        student.oralGrades.splice(oralIndex, 1);
        // Aktualisiere oralGrade zur letzten Note
        student.oralGrade = student.oralGrades.length > 0 ? student.oralGrades[student.oralGrades.length - 1].grade : '';
        saveData();
        renderMuendlicheNotenModule();
        renderOverviewModule();
    }
}

// Funktion zur Bestätigung des Löschens einer mündlichen Note
function confirmDeleteOralGrade() {
    const studentIndex = window.editingStudentIndex;
    const oralIndex = window.editingOralIndex;
    
    if (studentIndex === undefined || oralIndex === undefined) return;
    
    const student = classes[activeClassId].students[studentIndex];
    const oral = student.oralGrades[oralIndex];
    
    swal({
        title: "Note löschen?",
        text: `Möchtest du die mündliche Note "${oral.grade}" vom ${oral.date} wirklich löschen?`,
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            deleteOralGrade(studentIndex, oralIndex);
            hideModal();
        }
    });
}

// Funktion zum Bearbeiten einer mündlichen Note
function editOralGrade(studentIndex, oralIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const student = classes[activeClassId].students[studentIndex];
    if (!student.oralGrades || !student.oralGrades[oralIndex]) return;
    
    // Setze globale Variablen für Bearbeitung
    window.editingStudentIndex = studentIndex;
    window.editingOralIndex = oralIndex;
    
    const select = safeGetElement('edit-oral-grade');
    if (select) {
        select.value = student.oralGrades[oralIndex].grade;
    }
    
    showModal('edit-oral-grade-modal');
}

// Funktion zum Speichern der bearbeiteten mündlichen Note
function saveEditedOralGrade() {
    const select = safeGetElement('edit-oral-grade');
    if (!select) return;
    
    const newGrade = select.value;
    if (!newGrade) return;
    
    const studentIndex = window.editingStudentIndex;
    const oralIndex = window.editingOralIndex;
    
    if (studentIndex === undefined || oralIndex === undefined) return;
    
    const student = classes[activeClassId].students[studentIndex];
    if (student.oralGrades && student.oralGrades[oralIndex]) {
        student.oralGrades[oralIndex].grade = newGrade;
        // Aktualisiere oralGrade zur letzten Note
        student.oralGrade = student.oralGrades[student.oralGrades.length - 1].grade;
        saveData();
        renderMuendlicheNotenModule();
        renderOverviewModule();
        hideModal();
    }
}

// Ein-/Ausklappen der Schülerdetails
function toggleStudentDetails(modul, studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Zustand umschalten basierend auf Modul
    const expandKey = modul === 'noten' ? 'notenExpanded' : 'muendlicheExpanded';
    classes[activeClassId].students[originalIndex][expandKey] = !classes[activeClassId].students[originalIndex][expandKey];
    
    // UI aktualisieren
    const detailsDiv = safeGetElement(`${modul}studentDetails-${studentIndex}`);
    const toggleIcon = safeGetElement(`${modul}toggleIcon-${studentIndex}`);
    
    if (detailsDiv && toggleIcon) {
        if (detailsDiv.classList.contains('show')) {
            detailsDiv.classList.remove('show');
            toggleIcon.classList.remove('rotate');
        } else {
            detailsDiv.classList.add('show');
            toggleIcon.classList.add('rotate');
        }
    }
    
    saveData();
    
    // Projektnoten in der Kopfzeile aktualisieren
    requestAnimationFrame(showProjectGradesInCollapsedView);
}

// Alle Schülerdetails einklappen
function collapseAllStudents() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Alle Schüler auf nicht ausgeklappt setzen basierend auf Modul
    const expandKey = activeModule === 'noten' ? 'notenExpanded' : 'muendlicheExpanded';
    classes[activeClassId].students.forEach(student => {
        student[expandKey] = false;
    });
    
    // UI aktualisieren
    const sortedStudents = getSortedStudents();
    sortedStudents.forEach((student, index) => {
        const modulPrefix = activeModule === 'noten' ? 'noten' : 'muendliche';
        const detailsDiv = safeGetElement(`${modulPrefix}studentDetails-${index}`);
        const toggleIcon = safeGetElement(`${modulPrefix}toggleIcon-${index}`);
        
        if (detailsDiv && toggleIcon) {
            detailsDiv.classList.remove('show');
            toggleIcon.classList.remove('rotate');
        }
    });
    
    saveData();
}

// Funktion zum Setzen der Gewichtung
// Funktion zum Setzen der Gewichtung - Nur UI-Update
function setWeight(weight) {
    const weightButtons = document.querySelectorAll(".weight-btn");
    if (weightButtons) {
        weightButtons.forEach(btn => btn.classList.remove("active-weight"));
    }
    const originalDisplay = document.getElementById("oralWeightValue");
    if (originalDisplay) originalDisplay.innerText = weight;
    localStorage.setItem("oralWeight", weight);
}

// Funktion zum Ein- und Ausblenden der Notentabelle
function toggleGradeTable() {
    // The original grade table in the Noten tab
    const gradeTable = safeGetElement('gradeTable');
    if (gradeTable) {
        if (gradeTable.style.display === 'none') {
            gradeTable.style.display = 'table';
        } else {
            gradeTable.style.display = 'none';
        }
    }
    
    // Check if we need to handle the table in the modal
    const calculationModal = safeGetElement('calculation-path-modal');
    if (calculationModal && calculationModal.style.display !== 'none') {
        // Find or create a table element in the modal
        let modalGradeTable = calculationModal.querySelector('.grade-table-clone');
        
        if (!modalGradeTable) {
            // Clone the original grade table
            if (gradeTable) {
                modalGradeTable = gradeTable.cloneNode(true);
                modalGradeTable.id = 'modalGradeTable';
                modalGradeTable.className = 'grade-table grade-table-clone';
                modalGradeTable.style.display = 'table'; // Make it visible by default
                
                // Find where to insert the cloned table
                const calcContent = calculationModal.querySelector('#calculation-path-content');
                if (calcContent && calcContent.parentNode) {
                    calcContent.parentNode.insertBefore(modalGradeTable, calcContent);
                }
            }
        } else {
            // Toggle the existing table
            if (modalGradeTable.style.display === 'none') {
                modalGradeTable.style.display = 'table';
            } else {
                modalGradeTable.style.display = 'none';
            }
        }
    }
}

// ===== PROJEKT FUNKTIONEN =====

// Funktion zum Aktualisieren der Projekt-Auswahloptionen
function updateProjectSelectionOptions() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const cls = classes[activeClassId];
    const projectSelect = safeGetElement('project-number-select');
    
    if (!projectSelect) return;
    
    // Aktuellen Wert merken
    const currentValue = projectSelect.value;
    
    projectSelect.innerHTML = '<option value="">Alle Projekte</option>';
    
    // Maximale Anzahl an Projekten ermitteln
    let maxProjects = 0;
    cls.students.forEach(student => {
        if (student.projects && Array.isArray(student.projects)) {
            maxProjects = Math.max(maxProjects, student.projects.length);
        }
    });
    
    // Optionen für jede Projektnummer erstellen
    for (let i = 0; i < maxProjects; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Projekt ${i + 1}`;
        projectSelect.appendChild(option);
    }
    
    // Zuvor ausgewählten Wert wiederherstellen, wenn möglich
    if (currentValue && parseInt(currentValue) < maxProjects) {
        projectSelect.value = currentValue;
    }
}

// Funktion zum Ein- und Ausklappen der Projekt-Statistiken
function toggleProjectStatistics() {
    const content = safeGetElement('project-statistics-content');
    const toggleIcon = safeGetElement('project-stats-toggle-icon');
    
    if (!content || !toggleIcon) return;
    
    // Status umschalten
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggleIcon.classList.add('fa-chevron-up');
        toggleIcon.classList.remove('fa-chevron-down');
    } else {
        content.style.display = 'none';
        toggleIcon.classList.add('fa-chevron-down');
        toggleIcon.classList.remove('fa-chevron-up');
    }
}

// Funktion zur Berechnung und Anzeige der Projektstatistiken
function updateProjectStatistics(event) {
    // Stoppe die Ereignispropagierung, falls es von einem Event-Handler aufgerufen wurde
    if (event && event.stopPropagation) {
        event.stopPropagation();
    }
    
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const cls = classes[activeClassId];
    const projectSelect = safeGetElement('project-number-select');
    
    if (!projectSelect) return;
    
    const projectIndex = projectSelect.value === '' ? null : parseInt(projectSelect.value);
    
    let grades = [];
    
    // Noten sammeln, entweder für ein spezifisches Projekt oder alle
    if (projectIndex !== null) {
        // Noten für ein spezifisches Projekt
        cls.students.forEach(student => {
            // Schüler mit Förderschwerpunkt Lernen überspringen
            if (student.learningSupport) return;
            
            if (student.projects && 
                Array.isArray(student.projects) && 
                student.projects.length > projectIndex && 
                student.projects[projectIndex] && 
                student.projects[projectIndex].grade) {
                // Statt convertGrade verwende convertToWholeGrade, um nur ganze Noten zu berücksichtigen
                const gradeValue = convertToWholeGrade(student.projects[projectIndex].grade);
                if (gradeValue > 0) {
                    grades.push(gradeValue);
                }
            }
        });
    } else {
        // Noten für alle Projekte
        cls.students.forEach(student => {
            // Schüler mit Förderschwerpunkt Lernen überspringen
            if (student.learningSupport) return;
            
            if (student.projects && Array.isArray(student.projects)) {
                student.projects.forEach(project => {
                    if (project && project.grade) {
                        // Statt convertGrade verwende convertToWholeGrade, um nur ganze Noten zu berücksichtigen
                        const gradeValue = convertToWholeGrade(project.grade);
                        if (gradeValue > 0) {
                            grades.push(gradeValue);
                        }
                    }
                });
            }
        });
    }
    
    // Durchschnitt anzeigen
    const averageElement = safeGetElement('project-average-value');
    const distributionElement = safeGetElement('project-distribution-graph');
    const emptyStateElement = safeGetElement('project-stats-empty');
    
    if (!averageElement || !distributionElement || !emptyStateElement) return;
    
    if (grades.length === 0) {
        // Keine Noten vorhanden - nichts anzeigen
        averageElement.textContent = '-';
        distributionElement.innerHTML = '';
        emptyStateElement.style.display = 'none';
        return;
    }
    
    // Durchschnitt berechnen und anzeigen
    const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
    const roundedGrade = Math.round(average); // Einfach runden, da wir jetzt mit ganzen Noten arbeiten
    averageElement.textContent = `${roundedGrade} (${average.toFixed(2)})`;
    emptyStateElement.style.display = 'none';
    
    // Notenverteilung berechnen - nur für ganze Noten (1-6)
    const distribution = {
        '1': 0, 
        '2': 0, 
        '3': 0, 
        '4': 0, 
        '5': 0, 
        '6': 0
    };
    
    // Zähle die ganzen Noten
    grades.forEach(grade => {
        // Da wir bereits convertToWholeGrade verwendet haben, sind die Noten bereits ganze Zahlen
        // Stellen Sie sicher, dass die Note im gültigen Bereich 1-6 liegt
        if (grade >= 1 && grade <= 6) {
            distribution[grade.toString()]++;
        }
    });
    
    // Sortiere die Noten für die Darstellung
    const sortedGrades = Object.keys(distribution).filter(grade => distribution[grade] > 0);
    
    // Verteilungsgrafik rendern
    distributionElement.innerHTML = '';
    
    const maxCount = Math.max(...Object.values(distribution));
    
    sortedGrades.forEach(grade => {
        const count = distribution[grade];
        const percentage = Math.round((count / grades.length) * 100);
        const height = Math.max(20, Math.round((count / maxCount) * 100));
        
        const bar = document.createElement('div');
        bar.className = 'distribution-bar';
        bar.style.height = `${height}%`;
        bar.innerHTML = `
            <div class="distribution-bar-value">${count} (${percentage}%)</div>
            <div class="distribution-bar-label">${grade}</div>
        `;
        
        // Farbe basierend auf Note
        bar.style.backgroundColor = getGradeColor(parseInt(grade));
        
        distributionElement.appendChild(bar);
    });
}

// Modal für Projekt zu allen hinzufügen anzeigen
function showAddProjectToAllModal() {
    const modal = safeGetElement('add-project-to-all-modal');
    const input = safeGetElement('project-name-all');
    if (modal && input) {
        input.value = '';
        showModal('add-project-to-all-modal');
        input.focus();
    }
}

// Projekt zu allen Schülern hinzufügen
function addProjectToAll() {
    const input = safeGetElement('project-name-all');
    if (!input) return;
    
    const projectName = input.value.trim();
    if (!projectName) {
        alert('Bitte geben Sie einen Projektnamen ein.');
        return;
    }
    
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const students = classes[activeClassId].students;
    
    // Finde den höchsten aktuellen Projekt-Index
    let maxProjectIndex = 0;
    students.forEach(student => {
        if (student.projects) {
            maxProjectIndex = Math.max(maxProjectIndex, student.projects.length);
        }
    });
    
    // Füge das neue Projekt zu allen Schülern hinzu
    students.forEach(student => {
        if (!student.projects) {
            student.projects = [];
        }
        // Fülle Lücken mit leeren Projekten
        while (student.projects.length < maxProjectIndex) {
            student.projects.push({ name: '', grade: '' });
        }
        // Füge das neue Projekt hinzu
        student.projects.push({ name: projectName, grade: '' });
    });
    
    saveData();
    hideModal();
    
    if (activeModule === 'noten') {
        renderGradesModule();
    }
}

// Modal für Projekt für alle löschen anzeigen
function showDeleteProjectForAllModal() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const select = safeGetElement('delete-project-select');
    if (!select) return;
    
    // Sammle alle einzigartigen Projektnamen mit Indizes
    const projectMap = new Map();
    classes[activeClassId].students.forEach(student => {
        if (student.projects) {
            student.projects.forEach((project, index) => {
                if (project.name && project.name.trim()) {
                    if (!projectMap.has(index)) {
                        projectMap.set(index, project.name);
                    }
                }
            });
        }
    });
    
    // Fülle das Select
    select.innerHTML = '<option value="">Projekt auswählen</option>';
    projectMap.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${index + 1}. ${name}`;
        select.appendChild(option);
    });
    
    showModal('delete-project-for-all-modal');
}

// Projekt für alle Schüler löschen
// Variable für das zu löschende Projekt
let projectToDeleteIndex = null;

function deleteProjectForAll() {
    const select = safeGetElement('delete-project-select');
    if (!select) return;
    
    const projectIndex = parseInt(select.value);
    if (isNaN(projectIndex) || projectIndex < 0) {
        alert('Bitte wählen Sie ein Projekt aus.');
        return;
    }
    
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const projectName = select.options[select.selectedIndex].textContent;
    
    swal({
        title: "Projekt löschen?",
        text: `Möchten Sie das Projekt "${projectName}" wirklich für alle Schüler löschen?`,
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            // Lösche das Projekt bei allen Schülern
            classes[activeClassId].students.forEach(student => {
                if (student.projects && student.projects.length > projectIndex) {
                    student.projects.splice(projectIndex, 1);
                }
            });
            
            saveData();
            hideModal();
            
            if (activeModule === 'noten') {
                renderGradesModule();
            }
        }
    });
}

// Projekt hinzufügen - Mit direkter DOM-Manipulation
function addProject(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass das projects-Array existiert
    if (!classes[activeClassId].students[originalIndex].projects) {
        classes[activeClassId].students[originalIndex].projects = [];
    }
    
    // Neues Projekt hinzufügen
    const newProjectIndex = classes[activeClassId].students[originalIndex].projects.length;
    classes[activeClassId].students[originalIndex].projects.push({
        name: '',
        grade: ''
    });
    
    // Speichern
    saveData();
    
    // DOM direkt aktualisieren statt Neurendern
    const studentDetails = document.getElementById(`studentDetails-${studentIndex}`);
    if (studentDetails) {
        const projectsContainer = studentDetails.querySelector('div[style="margin-top: 15px;"]');
        if (projectsContainer) {
            // Leere-Projekte-Nachricht entfernen falls vorhanden
            const emptyState = projectsContainer.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }
            
            // Vor den Projekt-Tools einfügen
            const projectTools = projectsContainer.querySelector('.project-tools');
            
            // Neues Projekt-Element erstellen
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.innerHTML = `
                <div class="form-row">
                    <div>
                        <input type="text" class="form-control" placeholder="Projektname" 
                            value="" 
                            onchange="updateProjectName(${studentIndex}, ${newProjectIndex}, this.value)">
                    </div>
                    <div>
                        <select class="form-control" onchange="updateProjectGrade(${studentIndex}, ${newProjectIndex}, this.value)">
                            <option value="">Note eingeben</option>
                            ${Object.keys(gradeConversion).map(grade => `
                                <option value="${grade}">${grade}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            `;
            
            // Einfügen
            if (projectTools) {
                projectsContainer.insertBefore(projectItem, projectTools);
            } else {
                projectsContainer.appendChild(projectItem);
            }
        }
    }
    
    // Projekt-Auswahloptionen aktualisieren
    updateProjectSelectionOptions();
}

// Projektname aktualisieren - Mit direkter DOM-Manipulation
function updateProjectName(studentIndex, projectIndex, value) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass das projects-Array existiert
    if (!classes[activeClassId].students[originalIndex].projects) {
        classes[activeClassId].students[originalIndex].projects = [];
    }
    
    if (projectIndex < 0 || projectIndex >= classes[activeClassId].students[originalIndex].projects.length) {
        return;
    }
    
    // Speichere den alten Projektnamen
    const oldProjectName = classes[activeClassId].students[originalIndex].projects[projectIndex].name;
    
    // Aktualisiere den Projektnamen
    classes[activeClassId].students[originalIndex].projects[projectIndex].name = value;
    
    // Speichern
    saveData();
    
    // Wenn das Projekt einen Namen bekommen hat, frage ob es für alle übernommen werden soll
    if (value && value.trim() !== '' && (!oldProjectName || oldProjectName.trim() === '')) {
        swal({
            title: "Projekt für alle übernehmen?",
            text: `Möchtest du das Projekt "${value}" für alle Schüler anlegen?`,
            icon: "question",
            buttons: ["Nur für diesen", "Für alle"],
        })
        .then((applyToAll) => {
            if (applyToAll) {
                applyProjectToAllStudents(projectIndex, value);
                // Nach Übernahme für alle aktualisieren
                updateProjectSelectionOptions();
            }
        });
    }
    
    // Rechenweg aktualisieren, falls sichtbar
    const calculationDiv = document.getElementById(`calculation-${studentIndex}`);
    if (calculationDiv && calculationDiv.style.display !== 'none') {
        showCalculation(studentIndex);
    }
}

// Function to apply a project to all students
function applyProjectToAllStudents(projectIndex, projectName) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Get the current students array
    const students = classes[activeClassId].students;
    
    // Loop through all students
    students.forEach((student) => {
        // Make sure each student has a projects array
        if (!student.projects) {
            student.projects = [];
        }
        
        // If the project index is beyond the student's current projects, add empty projects to fill the gap
        while (student.projects.length <= projectIndex) {
            student.projects.push({
                name: '',
                grade: ''
            });
        }
        
        // Update the project name for this student at the specified index
        student.projects[projectIndex].name = projectName;
    });
    
    // Save the changes
    saveData();
    
    // If we're in the grades module, update the UI
    if (activeModule === 'noten') {
        renderGradesModule();
    }
}

// Projektnote aktualisieren - Mit direkter DOM-Manipulation
function updateProjectGrade(studentIndex, projectIndex, value) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass das projects-Array existiert
    if (!classes[activeClassId].students[originalIndex].projects) {
        classes[activeClassId].students[originalIndex].projects = [];
    }
    
    if (projectIndex < 0 || projectIndex >= classes[activeClassId].students[originalIndex].projects.length) {
        return;
    }
    
    // Note aktualisieren
    classes[activeClassId].students[originalIndex].projects[projectIndex].grade = value;
    window.classes = classes; // Sicherstellen, dass die globale Referenz für Cloud-Sync aktuell ist
    
    // Berechne neue Endnote
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    // Projekte aktualisieren
    const finalGrade = calculateFinalGrade(
        classes[activeClassId].students[originalIndex].projects,
        classes[activeClassId].students[originalIndex].oralGrade, 
        oralWeight
    );
    
    // Speichern
    saveData();
    
    // Statistik aktualisieren
    updateProjectStatistics();
    
    // Modul neu rendern für sofortige Aktualisierung
    renderGradesModule();
    
    // UI aktualisieren: Endnote in der Studentenkarte aktualisieren
    const studentCard = document.querySelector(`#studentDetails-${studentIndex}`).closest('.student-card');
    if (studentCard) {
        const gradeDisplay = studentCard.querySelector('.student-grade');
        if (gradeDisplay) {
            if (finalGrade.numeric > 0) {
                const gradeColorClass = getGradeColorClass(finalGrade.numeric);
                gradeDisplay.innerHTML = `
                    <span class="grade-badge ${gradeColorClass}">${finalGrade.rounded}</span>
                    <span>${finalGrade.exact}</span>
                `;
            } else {
                gradeDisplay.innerHTML = `
                    <span class="badge badge-secondary">Keine Note</span>
                `;
            }
        }
    }
    
    // UI aktualisieren: Projektnote-Optionen in der Projektliste aktualisieren
    const studentDetails = document.getElementById(`studentDetails-${studentIndex}`);
    if (studentDetails) {
        const projectItems = studentDetails.querySelectorAll('.project-item');
        if (projectItems && projectItems[projectIndex]) {
            const gradeSelect = projectItems[projectIndex].querySelector('select');
            if (gradeSelect) {
                // Ursprüngliche Option auswählen
                Array.from(gradeSelect.options).forEach(option => {
                    option.selected = option.value === value;
                });
                
                // Notenwertanzeige aktualisieren
                const projectGrade = convertGrade(value);
                if (projectGrade > 0) {
                    // Text für ausgewählte Option aktualisieren
                    const selectedOption = gradeSelect.options[gradeSelect.selectedIndex];
                    if (selectedOption) {
                        selectedOption.textContent = `${value} (${projectGrade.toFixed(2)})`;
                    }
                }
            }
        }
    }
    
    // Rechenweg aktualisieren, falls sichtbar
    const calculationDiv = document.getElementById(`calculation-${studentIndex}`);
    if (calculationDiv && calculationDiv.style.display !== 'none') {
        showCalculation(studentIndex);
    }
    
    // Statistiken aktualisieren
    updateProjectStatistics();
    
    // Projektnoten in der Kopfzeile aktualisieren
    showProjectGradesInCollapsedView();
}

// Projekt löschen - Mit direkter DOM-Manipulation
function deleteProject(studentIndex, projectIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass das projects-Array existiert und ausreichend Projekte enthält
    if (!classes[activeClassId].students[originalIndex].projects) {
        classes[activeClassId].students[originalIndex].projects = [];
    }
    
    if (projectIndex < 0 || projectIndex >= classes[activeClassId].students[originalIndex].projects.length) {
        return;
    }
    
    // Projektname für die Anzeige im Dialog
    const projectName = classes[activeClassId].students[originalIndex].projects[projectIndex].name || "Unbenanntes Projekt";
    
    swal({
        title: "Projekt löschen?",
        text: `Möchtest du das Projekt "${projectName}" löschen?`,
        icon: "warning",
        buttons: {
            cancel: "Abbrechen",
            deleteOne: {
                text: "Nur für diesen",
                value: "one",
            },
            deleteAll: {
                text: "Für alle",
                value: "all",
            }
        },
        dangerMode: true,
    })
    .then((value) => {
        if (value === "one") {
            // Nur für diesen Schüler löschen
            
            // Projekt aus dem Daten-Array entfernen
            classes[activeClassId].students[originalIndex].projects.splice(projectIndex, 1);
            
            // Daten speichern
            saveData();
            
            // DOM direkt aktualisieren
            updateDOMAfterProjectDeletion(studentIndex, projectIndex);
            
            // Projektstatistiken aktualisieren
            updateProjectSelectionOptions();
            updateProjectStatistics();
        } else if (value === "all") {
            // Für alle Schüler löschen
            deleteProjectForAllStudents(projectIndex);
        }
    });
}

// Hilfsfunktion zur DOM-Aktualisierung nach Projektlöschung
function updateDOMAfterProjectDeletion(studentIndex, projectIndex) {
    // Student Card finden
    const studentDetails = document.getElementById(`${activeModule}studentDetails-${studentIndex}`);
    if (!studentDetails) return;
    
    // Projektcontainer finden
    const projectsContainer = studentDetails.querySelector('div[style="margin-top: 15px;"]');
    if (!projectsContainer) return;
    
    // Alle Projekt-Items finden
    const projectItems = projectsContainer.querySelectorAll('.project-item');
    if (!projectItems || projectIndex >= projectItems.length) return;
    
    // Zu löschendes Projekt-Element entfernen
    projectItems[projectIndex].remove();
    
    // Aktualisiere die Endnote-Anzeige
    updateStudentFinalGradeDisplay(studentIndex);
    
    // Alle Projekt-Items neu finden (nach dem Entfernen)
    const remainingProjectItems = projectsContainer.querySelectorAll('.project-item');
    
    // Wenn kein Projekt mehr vorhanden ist, Empty-State anzeigen
    if (remainingProjectItems.length === 0) {
        const projectLabel = projectsContainer.querySelector('label');
        if (projectLabel) {
            // Nach dem Label einen Empty-State einfügen
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.style.padding = '20px 0';
            emptyState.innerHTML = '<p>Keine Projekte vorhanden</p>';
            
            // Nach dem Label einfügen
            if (projectLabel.nextSibling) {
                projectsContainer.insertBefore(emptyState, projectLabel.nextSibling);
            } else {
                projectsContainer.appendChild(emptyState);
            }
        }
    }
    
    // Rechenweg aktualisieren, falls sichtbar
    const calculationDiv = document.getElementById(`calculation-${studentIndex}`);
    if (calculationDiv && calculationDiv.style.display !== 'none') {
        showCalculation(studentIndex);
    }
    
    // Projektnoten in der Kopfzeile aktualisieren
    showProjectGradesInCollapsedView();
}

// Hilfsfunktion zur Aktualisierung der Endnoten-Anzeige
function updateStudentFinalGradeDisplay(studentIndex) {
    // Studenten-Daten abrufen
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    
    // Gewichtung abrufen
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    // Endnote berechnen
    const finalGrade = calculateFinalGrade(student.projects);
    
    // Studenten-Card finden
    const studentCard = document.querySelector(`#${activeModule}studentDetails-${studentIndex}`).closest('.student-card');
    if (!studentCard) return;
    
    // Noten-Anzeige aktualisieren
    const gradeDisplay = studentCard.querySelector('.student-grade');
    if (gradeDisplay) {
        if (finalGrade.numeric > 0) {
            const gradeColorClass = getGradeColorClass(finalGrade.numeric);
            gradeDisplay.innerHTML = `
                <span class="grade-badge ${gradeColorClass}">${finalGrade.rounded}</span>
                <span>${finalGrade.exact}</span>
            `;
        } else {
            gradeDisplay.innerHTML = `
                <span class="badge badge-secondary">Keine Note</span>
            `;
        }
    }
}

// Projekt für alle Schüler löschen - Mit direkter DOM-Manipulation
function deleteProjectForAllStudents(projectIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Speichere die aktuelle Scroll-Position
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    
    // Für jeden Schüler in der Klasse das Projekt löschen
    classes[activeClassId].students.forEach((student, studentOriginalIndex) => {
        // Stelle sicher, dass das projects-Array existiert
        if (!student.projects) {
            student.projects = [];
        }
        
        // Wenn der Schüler das Projekt hat, lösche es
        if (projectIndex < student.projects.length) {
            student.projects.splice(projectIndex, 1);
            
            // Finde den entsprechenden Index in der sortierten Ansicht
            const sortedStudents = getSortedStudents();
            const sortedIndex = sortedStudents.findIndex(s => s.name === student.name);
            
            // DOM für diesen Schüler aktualisieren, falls der Schüler in der aktuellen Ansicht ist
            if (sortedIndex !== -1) {
                updateDOMAfterProjectDeletion(sortedIndex, projectIndex);
            }
        }
    });
    
    // Daten speichern
    saveData();
    
    // Projektstatistiken aktualisieren
    updateProjectSelectionOptions();
    updateProjectStatistics();
    
    // Stelle die Scroll-Position wieder her
    window.scrollTo(0, scrollPosition);
}

// Alle Projekte eines Schülers löschen
function deleteAllProjectsForStudent(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    const studentData = classes[activeClassId].students[originalIndex];
    
    if (!studentData.projects || studentData.projects.length === 0) {
        swal("Keine Projekte", "Dieser Schüler hat keine Projekte zum Löschen.", "info");
        return;
    }
    
    const projectCount = studentData.projects.length;
    
    swal({
        title: "Alle Projekte löschen?",
        text: `Möchtest du alle ${projectCount} Projekte von ${student.name} löschen?`,
        icon: "warning",
        buttons: ["Abbrechen", "Alle löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            // Projekte löschen
            classes[activeClassId].students[originalIndex].projects = [];
            
            // Daten speichern
            saveData();
            
            // UI aktualisieren
            renderGradesModule();
            
            // Projektstatistiken aktualisieren
            updateProjectSelectionOptions();
            updateProjectStatistics();
        }
    });
}

// Modal für Projektlöschung anzeigen
function showDeleteProjectModal(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;

    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;

    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);

    if (originalIndex === -1) return;

    const studentData = classes[activeClassId].students[originalIndex];

    // Überprüfen, ob der Schüler Projekte hat
    if (!studentData.projects || studentData.projects.length === 0) {
        // Wenn der Schüler keine Projekte hat, überprüfen wir alle Schüler
        const hasAnyProjects = classes[activeClassId].students.some(s => s.projects && s.projects.length > 0);
        if (!hasAnyProjects) {
            swal("Keine Projekte", "Es gibt keine Projekte zum Löschen.", "info");
            return;
        }
    }

    // Studentennamen im Modal setzen
    const studentNameElement = safeGetElement('delete-project-student-name');
    if (studentNameElement) {
        studentNameElement.textContent = `Schüler: ${student.name}`;
    }

    // Standardmäßig "einzeln" auswählen
    const singleRadio = safeGetElement('delete-mode-single');
    if (singleRadio) {
        singleRadio.checked = true;
    }

    // Projektliste basierend auf dem Modus aktualisieren
    updateProjectListForMode();

    // Event-Listener für Radio-Buttons hinzufügen
    const singleRadioBtn = safeGetElement('delete-mode-single');
    const allRadioBtn = safeGetElement('delete-mode-all');

    if (singleRadioBtn) {
        singleRadioBtn.addEventListener('change', updateProjectListForMode);
    }
    if (allRadioBtn) {
        allRadioBtn.addEventListener('change', updateProjectListForMode);
    }

    // Modal anzeigen
    showModal('delete-project-modal');
}

// Hilfsfunktion zum Aktualisieren der Projektliste basierend auf dem ausgewählten Modus
function updateProjectListForMode() {
    const projectListElement = safeGetElement('delete-project-list');
    const singleRadio = safeGetElement('delete-mode-single');
    const allRadio = safeGetElement('delete-mode-all');

    if (!projectListElement) return;

    projectListElement.innerHTML = '';

    if (singleRadio && singleRadio.checked) {
        // Einzeln-Modus: Nur Projekte des ausgewählten Schülers anzeigen
        const studentNameElement = safeGetElement('delete-project-student-name');
        if (!studentNameElement) return;

        const studentName = studentNameElement.textContent.replace('Schüler: ', '');
        const originalIndex = classes[activeClassId].students.findIndex(s => s.name === studentName);

        if (originalIndex === -1) return;

        const studentData = classes[activeClassId].students[originalIndex];

        if (!studentData.projects || studentData.projects.length === 0) {
            projectListElement.innerHTML = '<p class="no-projects-message">Dieser Schüler hat keine Projekte.</p>';
            return;
        }

        studentData.projects.forEach((project, projectIndex) => {
            const projectName = project.name || `Projekt ${projectIndex + 1}`;
            const projectGrade = project.grade || 'Keine Note';

            const projectItem = document.createElement('div');
            projectItem.className = 'project-delete-item';
            projectItem.innerHTML = `
                <label class="project-delete-label">
                    <input type="checkbox" class="project-delete-checkbox" value="${projectIndex}" data-mode="single">
                    <span class="project-delete-info">
                        <strong>${projectName}</strong> - Note: ${projectGrade}
                    </span>
                </label>
            `;

            projectListElement.appendChild(projectItem);
        });
    } else if (allRadio && allRadio.checked) {
        // Für alle-Modus: Alle verfügbaren Projekte aus der Klasse anzeigen
        const allProjects = getAllAvailableProjects();

        if (allProjects.length === 0) {
            projectListElement.innerHTML = '<p class="no-projects-message">Es gibt keine Projekte in dieser Klasse.</p>';
            return;
        }

        allProjects.forEach((projectInfo, index) => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-delete-item';
            projectItem.innerHTML = `
                <label class="project-delete-label">
                    <input type="checkbox" class="project-delete-checkbox" value="${index}" data-mode="all" data-project-id="${projectInfo.id}">
                    <span class="project-delete-info">
                        <strong>${projectInfo.name}</strong> - Note: ${projectInfo.grade} <em>(von ${projectInfo.studentName})</em>
                    </span>
                </label>
            `;

            projectListElement.appendChild(projectItem);
        });

        // Alle Checkboxen automatisch auswählen, wenn "Für alle" Modus aktiv ist
        const allCheckboxes = projectListElement.querySelectorAll('.project-delete-checkbox[data-mode="all"]');
        allCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
    }
}

// Hilfsfunktion zum Sammeln aller verfügbaren Projekte aus der Klasse
function getAllAvailableProjects() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return [];

    const allProjects = [];

    classes[activeClassId].students.forEach((student, studentIndex) => {
        if (student.projects && student.projects.length > 0) {
            student.projects.forEach((project, projectIndex) => {
                allProjects.push({
                    id: `${studentIndex}-${projectIndex}`,
                    name: project.name || `Projekt ${projectIndex + 1}`,
                    grade: project.grade || 'Keine Note',
                    studentName: student.name,
                    studentIndex: studentIndex,
                    projectIndex: projectIndex
                });
            });
        }
    });

    return allProjects;
}

// Hilfsfunktion zum Überprüfen, ob irgendein Schüler Projekte hat
function hasAnyProjectsInClass() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return false;

    return classes[activeClassId].students.some(student =>
        student.projects && student.projects.length > 0
    );
}

// Ausgewählte Projekte löschen
function deleteSelectedProjects() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;

    // Ausgewählte Checkboxen finden
    const checkboxes = document.querySelectorAll('#delete-project-list .project-delete-checkbox:checked');
    if (checkboxes.length === 0) {
        swal("Keine Auswahl", "Bitte wählen Sie mindestens ein Projekt zum Löschen aus.", "warning");
        return;
    }

    const singleRadio = safeGetElement('delete-mode-single');
    const allRadio = safeGetElement('delete-mode-all');

    if (singleRadio && singleRadio.checked) {
        // Einzeln-Modus: Projekte nur für den ausgewählten Schüler löschen
        deleteProjectsForSingleStudent(checkboxes);
    } else if (allRadio && allRadio.checked) {
        // Für alle-Modus: Projekte für alle Schüler löschen
        deleteProjectsForAllStudents(checkboxes);
    }
}

// Hilfsfunktion zum Löschen von Projekten für einen einzelnen Schüler
function deleteProjectsForSingleStudent(checkboxes) {
    // Studentennamen aus dem Modal holen
    const studentNameElement = safeGetElement('delete-project-student-name');
    if (!studentNameElement) return;

    const studentName = studentNameElement.textContent.replace('Schüler: ', '');
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === studentName);

    if (originalIndex === -1) return;

    const studentData = classes[activeClassId].students[originalIndex];

    // Indizes der zu löschenden Projekte sammeln (absteigend sortieren, um Index-Verschiebungen zu vermeiden)
    const indicesToDelete = Array.from(checkboxes)
        .map(checkbox => parseInt(checkbox.value))
        .sort((a, b) => b - a); // Absteigend sortieren

    // Projekte löschen
    indicesToDelete.forEach(index => {
        if (index >= 0 && index < studentData.projects.length) {
            studentData.projects.splice(index, 1);
        }
    });

    // Daten speichern
    saveData();

    // Modal schließen
    hideModal();

    // UI aktualisieren
    renderGradesModule();

    // Projektstatistiken aktualisieren
    updateProjectSelectionOptions();
    updateProjectStatistics();

    const deletedCount = indicesToDelete.length;
}

// Hilfsfunktion zum Löschen von Projekten für alle Schüler
function deleteProjectsForAllStudents(checkboxes) {
    let totalDeleted = 0;

    // Für jede ausgewählte Checkbox
    checkboxes.forEach(checkbox => {
        const projectId = checkbox.getAttribute('data-project-id');
        if (projectId) {
            const [studentIndex, projectIndex] = projectId.split('-').map(Number);

            if (studentIndex >= 0 && studentIndex < classes[activeClassId].students.length) {
                const student = classes[activeClassId].students[studentIndex];
                if (student.projects && projectIndex >= 0 && projectIndex < student.projects.length) {
                    student.projects.splice(projectIndex, 1);
                    totalDeleted++;
                }
            }
        }
    });

    if (totalDeleted > 0) {
        // Daten speichern
        saveData();

        // Modal schließen
        hideModal();

        // UI aktualisieren
        renderGradesModule();

        // Projektstatistiken aktualisieren
        updateProjectSelectionOptions();
        updateProjectStatistics();
    } else {
        swal("Fehler", "Es konnten keine Projekte gelöscht werden.", "error");
    }
}

// Mündliche Note aktualisieren - Verbesserte Version ohne Neurendering
function updateOralGrade(studentIndex, value) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Update the data
    classes[activeClassId].students[originalIndex].oralGrade = value;
    saveData();
    
    // Get the required elements
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    // Calculate the new final grade
    const finalGrade = calculateFinalGrade(student.projects);
    
    // Update only the affected student card grade display
    const studentCard = document.querySelector(`#studentDetails-${studentIndex}`).closest('.student-card');
    if (studentCard) {
        const gradeDisplay = studentCard.querySelector('.student-grade');
        if (gradeDisplay) {
            if (finalGrade.numeric > 0) {
                const gradeColorClass = getGradeColorClass(finalGrade.numeric);
                gradeDisplay.innerHTML = `
                    <span class="grade-badge ${gradeColorClass}">${finalGrade.rounded}</span>
                    <span>${finalGrade.exact}</span>
                `;
            } else {
                gradeDisplay.innerHTML = `
                    <span class="badge badge-secondary">Keine Note</span>
                `;
            }
        }
    }
    
    // If calculation div is open, update it
    const calculationDiv = safeGetElement(`calculation-${studentIndex}`);
    if (calculationDiv && calculationDiv.style.display !== 'none') {
        showCalculation(studentIndex);
    }
}

// ===== RECHENWEG ANZEIGEN =====

// Rechenweg anzeigen/ausblenden
function toggleCalculation(studentIndex) {
    const calculationDiv = safeGetElement(`calculation-${studentIndex}`);
    if (!calculationDiv) return;
    
    if (calculationDiv.style.display === 'none' || calculationDiv.style.display === '') {
        showCalculation(studentIndex);
        calculationDiv.style.display = 'block';
    } else {
        calculationDiv.style.display = 'none';
    }
}

// Rechenweg anzeigen
function showCalculation(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    
    if (!student.projects) {
        student.projects = [];
    }
    
    const calculationDiv = safeGetElement(`calculation-${studentIndex}`);
    if (!calculationDiv) return;
    
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    // Schriftliche Noten mit Kommanoten
    const writtenGrades = student.projects
        .map(project => ({
            name: project.name || 'Unbenanntes Projekt',
            grade: project.grade || '',
            numeric: convertGrade(project.grade)
        }))
        .filter(grade => grade.numeric > 0);

    if (writtenGrades.length === 0) {
        calculationDiv.innerHTML = 'Keine Noten vorhanden.';
        return;
    }

    // Formatierter Noten-String für die Anzeige
    const gradesFormatStr = writtenGrades.map(g => `${g.grade} (${g.numeric.toFixed(2)})`).join('; ');
    
    // Berechnung des Durchschnitts
    const writtenGradeValues = writtenGrades.map(g => g.numeric);
    const writtenAverage = writtenGradeValues.reduce((sum, grade) => sum + grade, 0) / writtenGradeValues.length;
    const oralGradeConverted = student.oralGrade ? convertGrade(student.oralGrade) : null;
    
    // Gerundeter Projekt-Durchschnitt
    const roundedProjectAverage = roundGrade(writtenAverage);

    let calculationText = `Projekt-Noten: ${gradesFormatStr}\n`;
    calculationText += `Projekt-Durchschnitt: (${writtenGradeValues.map(g => g.toFixed(2)).join(' + ')}) / ${writtenGradeValues.length} = ${writtenAverage.toFixed(3)}\n`;
    calculationText += `Gerundeter Projekt-Durchschnitt: ${roundedProjectAverage}\n`;

    if (oralGradeConverted !== null) {
        calculationText += `Mündliche Note: ${student.oralGrade} (${oralGradeConverted.toFixed(2)})\n`;
        calculationText += `Gewichtung: ${oralWeight}% mündlich, ${100 - oralWeight}% schriftlich\n`;
        
        // Berechnung der Endnote
        const finalGrade = (writtenAverage * (100 - oralWeight) / 100 + oralGradeConverted * oralWeight / 100);
        calculationText += `Berechnung: (${writtenAverage.toFixed(3)} * ${(100 - oralWeight) / 100} + ${oralGradeConverted.toFixed(2)} * ${oralWeight / 100}) = ${finalGrade.toFixed(3)}\n`;
        calculationText += `Gerundete Endnote: ${roundGrade(finalGrade)}`;
    } else {
        calculationText += `Keine mündliche Note vorhanden.\n`;
        calculationText += `Gerundete Endnote: ${roundedProjectAverage}`;
    }

    calculationDiv.innerHTML = calculationText;
}

// ===== ERWEITERUNGEN FÜR NOTEN-UI =====

// Function to display project grades in the student header in collapsed view
function showProjectGradesInCollapsedView() {
    // Get all student cards in the grades tab
    const studentCards = document.querySelectorAll('#noten-module .student-card');
    
    studentCards.forEach((card) => {
        // Get the student header element
        const studentHeader = card.querySelector('.student-header');
        if (!studentHeader) return;
        
        // Get the student name to identify the student in the data
        const studentNameElement = studentHeader.querySelector('.student-name');
        if (!studentNameElement) return;
        
        const studentName = studentNameElement.textContent.trim();
        
        // Find the student in the data
        if (!classes[activeClassId] || !classes[activeClassId].students) return;
        
        const student = classes[activeClassId].students.find(s => s.name === studentName);
        if (!student || !student.projects) return;
        
        // Remove any existing grades display to avoid duplication
        const existingGradesDisplay = studentHeader.querySelector('.project-grades-preview');
        if (existingGradesDisplay) {
            existingGradesDisplay.remove();
        }
        
        // Create a new element to display the project grades
        const gradesPreview = document.createElement('div');
        gradesPreview.className = 'project-grades-preview';
        
        // Add project grades to the preview element
        if (student.projects.length === 0) {
            gradesPreview.innerHTML = '<span class="no-projects">Keine Projekte</span>';
        } else {
            // Get all grades that have values
            const projectsWithGrades = student.projects.filter(p => p.grade);
            
            if (projectsWithGrades.length === 0) {
                gradesPreview.innerHTML = '<span class="no-grades">Keine Noten</span>';
            } else {
                // Create badges for each grade
                projectsWithGrades.forEach((project, index) => {
                    const gradeValue = convertGrade(project.grade);
                    const gradeClass = getGradeColorClass(gradeValue);
                    
                    const badge = document.createElement('span');
                    badge.className = `grade-badge-small ${gradeClass}`;
                    badge.textContent = project.grade;
                    
                    // Add a tooltip with the project name if available
                    if (project.name) {
                        badge.title = project.name;
                    }
                    
                    gradesPreview.appendChild(badge);
                    
                    // Add a separator after each badge except the last one
                    if (index < projectsWithGrades.length - 1) {
                        const separator = document.createElement('span');
                        separator.className = 'grade-separator';
                        separator.textContent = '•';
                        gradesPreview.appendChild(separator);
                    }
                });
            }
        }
        
        // Add the preview to the student header
        studentHeader.appendChild(gradesPreview);
    });
}

// Add the CSS for the new elements
function addProjectGradesPreviewStyles() {
    const existingStyle = document.getElementById('project-grades-preview-styles');
    if (existingStyle) return; // Vermeiden doppelter Styleblöcke
    
    const style = document.createElement('style');
    style.id = 'project-grades-preview-styles';
    style.textContent = `
        .project-grades-preview {
            display: flex;
            align-items: center;
            margin-left: 15px;
            flex-wrap: wrap;
            gap: 5px;
        }
        
        .grade-badge-small {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            height: 28px;
            aspect-ratio: 1;
            text-align: center;
            border-radius: 50%;
            color: black;
            font-weight: bold;
            font-size: 0.8rem;
            padding: 0;
        }
        
        .grade-separator {
            color: #ccc;
            margin: 0 4px;
        }
        
        /* Kleineren Abstand im Schriftliche Noten-Modul */
        .project-grades-preview .grade-separator {
            margin: 0 0px;
        }
        
        .no-projects, .no-grades {
            color: #999;
            font-style: italic;
            font-size: 0.85rem;
        }
    `;
    document.head.appendChild(style);
}



// ===== SITZPLAN MODUL =====

// Globale Variablen für den Sitzplan - desks und currentMode werden nicht mehr benötigt
let draggedStudent = null;
let selectedDesk = null;

// Sitzplan Modul rendern
function renderSitzplanModule() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        classes[activeClassId].students = [];
    }
    
    const cls = classes[activeClassId];
    
    // Sicherstellen, dass Sitzplan-Daten vorhanden sind
    if (!cls.sitzplan) {
        cls.sitzplan = { desks: [], currentMode: 'evaluation' };
    }
    
    // Standardmodus auf Bewerten setzen, falls nicht gesetzt
    if (!cls.sitzplan.currentMode) {
        cls.sitzplan.currentMode = 'evaluation';
    }
    
    // Automatisch fehlende Tische für neue Schüler erstellen
    autoGenerateSitzplan();
    
    // Workspace für Tische vorbereiten
    const workspace = safeGetElement('workspace');
    if (workspace) {
        workspace.innerHTML = '<div class="grid-lines"></div>';
        
        // Event-Listener für Touch-Scrolling hinzufügen
        let isWorkspaceScrolling = false;
        let scrollStartX, scrollStartY;
        
        workspace.addEventListener('touchstart', (e) => {
            // Nur für Bewertungs- und Mündlich-Modus
            if (cls.sitzplan.currentMode === 'edit') return;
            
            isWorkspaceScrolling = true;
            scrollStartX = e.touches[0].clientX;
            scrollStartY = e.touches[0].clientY;
        }, { passive: true });
        
        workspace.addEventListener('touchmove', (e) => {
            if (!isWorkspaceScrolling) return;
            
            // Erlaube natives Scrolling
            // preventDefault wird nicht aufgerufen, damit das Scrollen funktioniert
        }, { passive: true });
        
        workspace.addEventListener('touchend', () => {
            isWorkspaceScrolling = false;
        });
        
        // Bestehende Tische rendern
        cls.sitzplan.desks.forEach(desk => {
            renderDesk(desk);
        });
    }
    
    // UI für den aktuellen Modus aktualisieren
    const editBtn = safeGetElement('edit-mode-btn');
    const evaluationBtn = safeGetElement('evaluation-mode-btn');
    const oralBtn = safeGetElement('oral-mode-btn');
    const workBtn = safeGetElement('work-mode-btn');
    
    const currentMode = cls.sitzplan.currentMode || 'evaluation';
    
    if (workspace) {
        if (currentMode === 'edit') {
            workspace.classList.remove('evaluation-mode');
            workspace.classList.remove('oral-mode');
            workspace.classList.remove('work-mode');
        } else if (currentMode === 'evaluation') {
            workspace.classList.add('evaluation-mode');
            workspace.classList.remove('oral-mode');
            workspace.classList.remove('work-mode');
        } else if (currentMode === 'oral') {
            workspace.classList.remove('evaluation-mode');
            workspace.classList.add('oral-mode');
            workspace.classList.remove('work-mode');
        } else if (currentMode === 'work') {
            workspace.classList.remove('evaluation-mode');
            workspace.classList.remove('oral-mode');
            workspace.classList.add('work-mode');
        }
    }
    
    if (editBtn) {
        editBtn.classList.toggle('active', currentMode === 'edit');
    }
    
    if (evaluationBtn) {
        evaluationBtn.classList.toggle('active', currentMode === 'evaluation');
    }
    
    if (oralBtn) {
        oralBtn.classList.toggle('active', currentMode === 'oral');
    }

    if (workBtn) {
        workBtn.classList.toggle('active', currentMode === 'work');
    }
}

// Sitzplan automatisch aktualisieren (ohne Nachricht)
function autoGenerateSitzplan() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        classes[activeClassId].students = [];
    }
    
    const cls = classes[activeClassId];
    
    // Sicherstellen, dass Sitzplan-Daten vorhanden sind
    if (!cls.sitzplan) {
        cls.sitzplan = { desks: [], currentMode: 'evaluation' };
    }
    
    // Bestehende Tische behalten, aber nicht löschen
    const existingDesks = cls.sitzplan.desks || [];
    
    // Neue Tische für Schüler ohne Tisch erstellen
    cls.students.forEach((student, index) => {
        // Prüfen, ob bereits ein Tisch für diesen Schüler existiert
        const existingDesk = existingDesks.find(desk => desk.studentIndex === index);
        if (!existingDesk) {
            // Neuen Tisch in der Mitte erstellen
            const workspace = safeGetElement('workspace');
            const workspaceRect = workspace ? workspace.getBoundingClientRect() : { width: 800, height: 600 };
            
            // Mitte des Workspace berechnen
            const centerX = (workspaceRect.width - 90) / 2; // Tischbreite abziehen
            const centerY = (workspaceRect.height - 60) / 2; // Tischhöhe abziehen
            
            existingDesks.push({
                id: `desk-${index}`,
                studentIndex: index,
                x: centerX,
                y: centerY,
                name: student.name
            });
        }
    });
    
    // Aktualisierte Tische setzen
    cls.sitzplan.desks = existingDesks;
    
    saveData();
}

// Sitzplan aktualisieren
function generateSitzplan() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        classes[activeClassId].students = [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.students.length === 0) {
        swal("Keine Schüler", "Fügen Sie zuerst Schüler zur Klasse hinzu", "info");
        return;
    }
    
    // Sicherstellen, dass Sitzplan-Daten vorhanden sind
    if (!cls.sitzplan) {
        cls.sitzplan = { desks: [], currentMode: 'evaluation' };
    }
    
    // Bestehende Tische behalten, aber nicht löschen
    const existingDesks = cls.sitzplan.desks || [];
    
    // Neue Tische für Schüler ohne Tisch erstellen
    cls.students.forEach((student, index) => {
        // Prüfen, ob bereits ein Tisch für diesen Schüler existiert
        const existingDesk = existingDesks.find(desk => desk.studentIndex === index);
        if (!existingDesk) {
            // Neuen Tisch in der Mitte erstellen
            const workspace = safeGetElement('workspace');
            const workspaceRect = workspace ? workspace.getBoundingClientRect() : { width: 800, height: 600 };
            
            // Mitte des Workspace berechnen
            const centerX = (workspaceRect.width - 90) / 2; // Tischbreite abziehen
            const centerY = (workspaceRect.height - 60) / 2; // Tischhöhe abziehen
            
            existingDesks.push({
                id: `desk-${index}`,
                studentIndex: index,
                x: centerX,
                y: centerY,
                name: student.name
            });
        }
    });
    
    // Aktualisierte Tische setzen
    cls.sitzplan.desks = existingDesks;
    
    saveData();
    renderSitzplanModule();
    
    const newDesksCount = cls.students.length - (existingDesks.length - (cls.sitzplan.desks.length - existingDesks.length));
}

// Modus setzen (Bearbeiten oder Bewerten)
function setMode(mode) {
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    
    // Sicherstellen, dass Sitzplan-Daten vorhanden sind
    if (!cls.sitzplan) {
        cls.sitzplan = { desks: [], currentMode: 'evaluation' };
    }
    
    cls.sitzplan.currentMode = mode;
    saveData();
    
    const workspace = safeGetElement('workspace');
    const editBtn = safeGetElement('edit-mode-btn');
    const evaluationBtn = safeGetElement('evaluation-mode-btn');
    const oralBtn = safeGetElement('oral-mode-btn');
    const workBtn = safeGetElement('work-mode-btn');
    
    if (workspace) {
        if (mode === 'edit') {
            workspace.classList.remove('evaluation-mode');
            workspace.classList.remove('oral-mode');
            workspace.classList.remove('work-mode');
        } else if (mode === 'evaluation') {
            workspace.classList.add('evaluation-mode');
            workspace.classList.remove('oral-mode');
            workspace.classList.remove('work-mode');
        } else if (mode === 'oral') {
            workspace.classList.remove('evaluation-mode');
            workspace.classList.add('oral-mode');
            workspace.classList.remove('work-mode');
        } else if (mode === 'work') {
            workspace.classList.remove('evaluation-mode');
            workspace.classList.remove('oral-mode');
            workspace.classList.add('work-mode');
        }
    }
    
    if (editBtn) {
        editBtn.classList.toggle('active', mode === 'edit');
    }
    
    if (evaluationBtn) {
        evaluationBtn.classList.toggle('active', mode === 'evaluation');
    }
    
    if (oralBtn) {
        oralBtn.classList.toggle('active', mode === 'oral');
    }

    if (workBtn) {
        workBtn.classList.toggle('active', mode === 'work');
    }
    
    // Tische neu rendern, um Punkte basierend auf Modus anzuzeigen
    renderSitzplanModule();
}

// Tisch rendern
// Global für Klick-Historie pro Desk
let deskClickHistory = {};

function renderDesk(desk) {
    const workspace = safeGetElement('workspace');
    if (!workspace) return;
    
    // Bestehenden Tisch entfernen, falls vorhanden
    const existingDesk = safeGetElement(desk.id);
    if (existingDesk) {
        existingDesk.remove();
    }
    
    const cls = classes[activeClassId];
    if (!cls) return;
    
    // Initialisiere Klick-Historie für diesen Desk
    if (!deskClickHistory[desk.id]) {
        deskClickHistory[desk.id] = { lastClickType: null, lastClickTime: 0 };
    }
    
    const deskElement = document.createElement('div');
    deskElement.className = 'desk';
    deskElement.id = desk.id;
    deskElement.style.left = `${desk.x}px`;
    deskElement.style.top = `${desk.y}px`;
    
    if (selectedDesk && selectedDesk.id === desk.id) {
        deskElement.classList.add('selected');
    }
    
    // Prüfen, ob der Name rot gefärbt werden soll (3 oder mehr negative Punkte) - nur in oral und evaluation Modus
    let highNegatives = false;
    if (classes[activeClassId] && classes[activeClassId].students[desk.studentIndex] && cls.sitzplan.currentMode !== 'edit') {
        const student = classes[activeClassId].students[desk.studentIndex];
        const today = new Date().toISOString().split('T')[0];
        if (student.dailyParticipation && student.dailyParticipation.date === today && student.dailyParticipation.negative >= 3) {
            highNegatives = true;
        }
    }
    
    let deskContent = '';
    if (classes[activeClassId] && classes[activeClassId].students[desk.studentIndex]) {
        const student = classes[activeClassId].students[desk.studentIndex];
        
        // Anzahl der wichtigen Notizen für roten Punkt
        const notesCount = student.notes ? student.notes.filter(note => note.important).length : 0;
        
        // Anzahl der aktiven (nicht nachgereichten) Schulplaner-Einträge zählen
        const activeSchulplanerCount = student.hwHistory ? student.hwHistory.filter(entry => 
            entry.type === 'schulplaner' && entry.active !== false
        ).length : 0;
        
        // Anzahl der aktiven Abschreibtext-Einträge zählen
        const activeAbschreibtextCount = student.hwHistory ? student.hwHistory.filter(entry => 
            entry.type === 'abschreibtext' && entry.active !== false
        ).length : 0;
        
        // Tisch einfärben - nur im Bewertungs- und Mündlich-Modus
        if (cls.sitzplan.currentMode === 'evaluation' || cls.sitzplan.currentMode === 'oral') {
            if (activeSchulplanerCount > 0 && activeAbschreibtextCount > 0) {
                deskElement.classList.add('has-both-entries');
            } else if (activeSchulplanerCount > 0) {
                deskElement.classList.add('has-schulplaner-entry');
            } else if (activeAbschreibtextCount > 0) {
                deskElement.classList.add('has-abschreibtext-entry');
            }
        }
        
        // Erstelle die Punkte für Notizen und Schulplaner
        let dotsHtml = '';
        
        // Punkte nur im Bewertungsmodus anzeigen
        if (cls.sitzplan && cls.sitzplan.currentMode === 'evaluation') {
            // Rote Punkte für wichtige Notizen
            if (notesCount > 0) {
                dotsHtml += `<span class="attention-dot" title="Wichtige Notiz vorhanden"></span>`;
            }
            
            // Blaue Punkte für vergessene Schulplaner entfernt - Tische werden blau eingefärbt
        }
        
        // Im Mündlich- oder Arbeitsphase-Modus tägliche Beteiligung anzeigen
        let participationHtml = '';
        if (cls.sitzplan && (cls.sitzplan.currentMode === 'oral' || cls.sitzplan.currentMode === 'work')) {
            const today = new Date().toISOString().split('T')[0];
            if (!student.dailyParticipation || student.dailyParticipation.date !== today) {
                student.dailyParticipation = { date: today, positive: 0, negative: 0 };
            }
            const dailyPositive = student.dailyParticipation.positive || 0;
            const dailyNegative = student.dailyParticipation.negative || 0;
            
            if (cls.sitzplan.currentMode === 'oral') {
                // Nur Positive anzeigen oder beide? Der Wunsch war Trennung. 
                // Für bessere Übersicht zeigen wir im jeweiligen Modus den relevanten Wert groß an.
                participationHtml = `<br><span style="font-size: 16px; color: green; font-weight: bold;">+ ${dailyPositive}</span>`;
            } else if (cls.sitzplan.currentMode === 'work') {
                participationHtml = `<br><span style="font-size: 16px; color: red; font-weight: bold;">- ${dailyNegative}</span>`;
            }
        }
        
        deskContent = `<div class="desk-label ${student.learningSupport ? 'learning-support' : ''} ${student.eseSupport ? 'ese-support' : ''} ${highNegatives ? 'high-negatives-name' : ''}">${student.name}${dotsHtml}${participationHtml}</div>`;
    } else {
        // Leerer Tisch
        deskContent = `<div class="desk-label">Leer</div>`;
    }
    
    deskElement.innerHTML = deskContent;
    
    // Drag-and-Drop Event-Listener für den Tisch selbst
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    // Mouse Events
    deskElement.addEventListener('mousedown', (e) => {
        if (!classes[activeClassId] || !classes[activeClassId].sitzplan || classes[activeClassId].sitzplan.currentMode !== 'edit') return;
        
        isDragging = true;
        window.isDraggingDesk = true; // Globaler Flag für Sync-Sperre
        window._lastDeskMoveTime = Date.now();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = desk.x;
        startTop = desk.y;
        
        deskElement.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    // Touch Events für Touch-Geräte
    deskElement.addEventListener('touchstart', (e) => {
        if (!classes[activeClassId] || !classes[activeClassId].sitzplan || classes[activeClassId].sitzplan.currentMode !== 'edit') return;
        
        isDragging = true;
        window.isDraggingDesk = true; // Globaler Flag für Sync-Sperre
        window._lastDeskMoveTime = Date.now();
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startLeft = desk.x;
        startTop = desk.y;
        
        e.preventDefault(); // Nur verhindern, wenn tatsächlich ein Drag startet
    });
    
    // Mouse Move
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const newX = startLeft + dx;
        const newY = startTop + dy;
        
        // Erlaube unbegrenzte Bewegung für besseres Scrollen
        // Entferne die Begrenzung auf den sichtbaren Bereich
        desk.x = newX;
        desk.y = newY;
        
        deskElement.style.left = `${desk.x}px`;
        deskElement.style.top = `${desk.y}px`;
    });
    
    // Touch Move
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        
        const newX = startLeft + dx;
        const newY = startTop + dy;
        
        // Erlaube unbegrenzte Bewegung für besseres Scrollen
        // Entferne die Begrenzung auf den sichtbaren Bereich
        desk.x = newX;
        desk.y = newY;
        
        deskElement.style.left = `${desk.x}px`;
        deskElement.style.top = `${desk.y}px`;
        
        e.preventDefault(); // Nur verhindern, wenn tatsächlich ein Drag stattfindet
    });
    
    // Mouse Up
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;

        // Speichere die neue Position in der Sitzplan-Datenstruktur
        if (classes[activeClassId] && classes[activeClassId].sitzplan && classes[activeClassId].sitzplan.desks) {
            const deskIndex = classes[activeClassId].sitzplan.desks.findIndex(d => d.id === desk.id);
            if (deskIndex !== -1) {
                classes[activeClassId].sitzplan.desks[deskIndex].x = desk.x;
                classes[activeClassId].sitzplan.desks[deskIndex].y = desk.y;
                saveData();
                if (typeof window.flushCloudSyncNow === 'function') {
                    window.flushCloudSyncNow();
                }
            }
        }

        // Erst nach dem Speichern Drag-Status freigeben, damit Realtime-Updates nicht dazwischenfunken.
        isDragging = false;
        deskElement.style.cursor = 'grab';
        window._lastDeskMoveTime = Date.now();
        setTimeout(() => {
            window.isDraggingDesk = false; // Sync-Sperre leicht verzögert aufheben
        }, 300);
    });
    
    // Touch End
    document.addEventListener('touchend', () => {
        if (!isDragging) return;

        // Speichere die neue Position in der Sitzplan-Datenstruktur
        if (classes[activeClassId] && classes[activeClassId].sitzplan && classes[activeClassId].sitzplan.desks) {
            const deskIndex = classes[activeClassId].sitzplan.desks.findIndex(d => d.id === desk.id);
            if (deskIndex !== -1) {
                classes[activeClassId].sitzplan.desks[deskIndex].x = desk.x;
                classes[activeClassId].sitzplan.desks[deskIndex].y = desk.y;
                saveData();
                if (typeof window.flushCloudSyncNow === 'function') {
                    window.flushCloudSyncNow();
                }
            }
        }

        // Erst nach dem Speichern Drag-Status freigeben, damit Realtime-Updates nicht dazwischenfunken.
        isDragging = false;
        window._lastDeskMoveTime = Date.now();
        setTimeout(() => {
            window.isDraggingDesk = false; // Sync-Sperre leicht verzögert aufheben
        }, 300);
    });
    
    // Klick-Event für Auswahl im Bewertungsmodus
    deskElement.addEventListener('click', (e) => {
        if (isDragging) return; // Verhindere Klick während Drag
        
        if (classes[activeClassId] && classes[activeClassId].sitzplan && classes[activeClassId].sitzplan.currentMode === 'evaluation') {
            selectDeskForEvaluation(desk);
        }
    });
    
    // Klick für Mündlich-Modus (nur +) oder Arbeitsphase (nur -)
    deskElement.addEventListener('click', (e) => {
        if (isDragging) return; // Verhindere Klick während Drag
        
        const currentMode = classes[activeClassId]?.sitzplan?.currentMode;
        if (currentMode !== 'oral' && currentMode !== 'work') return;
        
        // Kein Split mehr nötig, da der Modus den Typ bestimmt
        const type = currentMode === 'oral' ? 'positive' : 'negative';
        const now = Date.now();
        
        if (desk.studentIndex !== null) {
            if (deskClickHistory[desk.id].lastClickType && now - deskClickHistory[desk.id].lastClickTime < 5000) {
                if (deskClickHistory[desk.id].lastClickType === type) {
                    // Gleicher Typ innerhalb 5 Sekunden: Verringere (Undo-Funktion durch Doppelklick)
                    updateParticipation(desk.studentIndex, type, -1);
                    deskClickHistory[desk.id].lastClickType = null; // Reset
                }
            } else {
                // Normal hinzufügen
                updateParticipation(desk.studentIndex, type);
                deskClickHistory[desk.id].lastClickType = type;
                deskClickHistory[desk.id].lastClickTime = now;
            }
        }
    });
    
    // Long-Press für Undo-Modal (in beiden Modi)
    let longPressTimer;
    
    deskElement.addEventListener('mousedown', (e) => {
        const mode = classes[activeClassId]?.sitzplan?.currentMode;
        if ((mode === 'oral' || mode === 'work') && desk.studentIndex !== null) {
            longPressTimer = setTimeout(() => {
                openUndoModal(desk);
            }, 1000); // 1 Sekunde
        }
    });
    
    deskElement.addEventListener('mouseup', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
    
    deskElement.addEventListener('mouseleave', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
    
    // Touch Events für Long-Press
    deskElement.addEventListener('touchstart', (e) => {
        if (classes[activeClassId] && classes[activeClassId].sitzplan && classes[activeClassId].sitzplan.currentMode === 'oral' && desk.studentIndex !== null) {
            longPressTimer = setTimeout(() => {
                openUndoModal(desk);
            }, 1000);
        }
    });
    
    deskElement.addEventListener('touchend', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
    
    workspace.appendChild(deskElement);
}

// Tisch für Bewertung auswählen
function selectDeskForEvaluation(desk) {
    // Prüfen, ob der Tisch einen Schüler hat
    if (desk.studentIndex === null) {
        // Leerer Tisch - nichts tun
        return;
    }
    
    selectedDesk = desk;
    
    // UI aktualisieren
    const allDesks = document.querySelectorAll('.desk');
    allDesks.forEach(d => d.classList.remove('selected'));
    
    const deskElement = safeGetElement(desk.id);
    if (deskElement) {
        deskElement.classList.add('selected');
    }
    
    // Bewertungspanel anzeigen
    showEvaluationPanel(desk);
}

// Bewertungspanel anzeigen
function showEvaluationPanel(desk) {
    const modal = safeGetElement('evaluation-modal');
    const content = safeGetElement('evaluation-modal-content');
    
    if (!modal || !content) return;
    
    content.innerHTML = '';
    
    if (desk.studentIndex !== null && classes[activeClassId] && classes[activeClassId].students[desk.studentIndex]) {
        const student = classes[activeClassId].students[desk.studentIndex];
        
        // Setze die globale Variable für die Buttons
        currentEvaluationStudentIndex = desk.studentIndex;
        
        // Sicherstellen, dass participation Objekt existiert
        if (!student.participation) {
            student.participation = { positive: 0, negative: 0 };
        }
        
        // Punkte berechnen
        const hasSchulplanerEntry = student.hwHistory && student.hwHistory.some(entry => entry.type === 'schulplaner');
        const hasImportantNotes = student.notes && student.notes.some(note => note.important);
        
        let dotsHtml = '';
        if (hasSchulplanerEntry) {
            dotsHtml += '<span class="schulplaner-dot-modal" title="Schulplaner-Eintrag vorhanden"></span>';
        }
        if (hasImportantNotes) {
            dotsHtml += '<span class="attention-dot-modal" title="Eintrag vorhanden"></span>';
        }
        
        content.innerHTML = `
            <div class="evaluation-item">
                <h4>Schüler: ${student.name}${dotsHtml}</h4>
                <div class="participation-controls">
                    <button class="participation-btn btn btn-green plus-btn" onclick="updateParticipation(${desk.studentIndex}, 'positive')">
                        Beteiligung +
                    </button>
                    <button class="participation-btn btn btn-red minus-btn" onclick="updateParticipation(${desk.studentIndex}, 'negative')">
                        Beteiligung -
                    </button>
                </div>
            </div>
            <div class="student-stats">
                <div class="stats-grid">
                    <div class="stat-item stat-item-green">
                        <div class="stat-value" id="stats-positive-${desk.studentIndex}">${student.participation?.positive || 0}</div>
                        <div>Positive Beteiligung</div>
                    </div>
                    <div class="stat-item stat-item-red">
                        <div class="stat-value" id="stats-negative-${desk.studentIndex}">${student.participation?.negative || 0}</div>
                        <div>Negative Beteiligung</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="evaluation-item">
                <h4>Dieser Tisch ist leer</h4>
            </div>
        `;
        // Setze die globale Variable zurück, wenn kein Schüler ausgewählt
        currentEvaluationStudentIndex = null;
    }
    
    showModal('evaluation-modal');
}

// Punkte im Bewertungsmodal aktualisieren
function updateEvaluationModalDots(studentIndex) {
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;

    const hasSchulplanerEntry = student.hwHistory && student.hwHistory.some(entry => entry.type === 'schulplaner');
    const hasImportantNotes = student.notes && student.notes.some(note => note.important);

    const h4 = document.querySelector('#evaluation-modal-content h4');
    if (!h4) return;

    // Entferne bestehende Punkte
    const existingDots = h4.querySelectorAll('.schulplaner-dot-modal, .attention-dot-modal');
    existingDots.forEach(dot => dot.remove());

    // Füge neue Punkte hinzu
    if (hasSchulplanerEntry) {
        const blueDot = document.createElement('span');
        blueDot.className = 'schulplaner-dot-modal';
        blueDot.title = 'Schulplaner-Eintrag vorhanden';
        h4.appendChild(blueDot);
    }
    if (hasImportantNotes) {
        const redDot = document.createElement('span');
        redDot.className = 'attention-dot-modal';
        redDot.title = 'Eintrag vorhanden';
        h4.appendChild(redDot);
    }
}

// Beteiligung aktualisieren
function updateParticipation(studentIndex, type, delta = 1) {
    if (!classes[activeClassId] || !classes[activeClassId].students || studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    
    // Datum prüfen und tägliche Beteiligung zurücksetzen, falls nötig
    const today = new Date().toISOString().split('T')[0];
    if (!student.dailyParticipation || student.dailyParticipation.date !== today) {
        student.dailyParticipation = { date: today, positive: 0, negative: 0 };
    }
    
    // Gesamte Beteiligung auch aktualisieren
    if (!student.participation) {
        student.participation = { positive: 0, negative: 0 };
    }
    
    if (type === 'positive') {
        if (student.dailyParticipation.positive + delta < 0) delta = -student.dailyParticipation.positive;
        student.dailyParticipation.positive += delta;
        student.participation.positive += delta;
    } else if (type === 'negative') {
        if (student.dailyParticipation.negative + delta < 0) delta = -student.dailyParticipation.negative;
        student.dailyParticipation.negative += delta;
        student.participation.negative += delta;
    }
    
    // Statistiken im Modal aktualisieren (Gesamtwerte)
    const positiveStatsElement = safeGetElement(`stats-positive-${studentIndex}`);
    const negativeStatsElement = safeGetElement(`stats-negative-${studentIndex}`);
    
    if (positiveStatsElement) {
        positiveStatsElement.textContent = student.participation.positive;
    }
    
    if (negativeStatsElement) {
        negativeStatsElement.textContent = student.participation.negative;
    }
    
    saveData();
    
    // Prüfen, ob Abschreibtext-Modal geöffnet werden soll
    if (type === 'negative' && student.dailyParticipation.negative >= 3 && !student.abschreibtextActive) {
        showAbschreibtextModal(studentIndex);
    }
    
    // Prüfen, ob Nachsitzen-Modal geöffnet werden soll
    if (type === 'negative' && student.dailyParticipation.negative >= 6) {
        showNachsitzenModal(studentIndex);
    }
    
    // Tische neu rendern, um tägliche Werte anzuzeigen
    if (activeModule === 'sitzplan') {
        renderSitzplanModule();
    }
}

// Beteiligung aus Evaluation-Modal aktualisieren
function updateParticipationFromEvaluation(type) {
    if (currentEvaluationStudentIndex === null) return;
    updateParticipation(currentEvaluationStudentIndex, type);
}

// Modal für Abschreibtext anzeigen
function showAbschreibtextModal(studentIndex) {
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;
    
    // Setze die globale Variable für den Schüler
    currentEvaluationStudentIndex = studentIndex;
    
    // Verwende SweetAlert statt HTML-Modal
    swal({
        title: "Abschreibtext Störungen",
        text: `Möchten Sie ${student.name} einen Abschreibtext heben?`,
        icon: "question",
        buttons: ["Nein", "Ja"],
        dangerMode: false,
    }).then((willGiveAbschreibtext) => {
        if (willGiveAbschreibtext) {
            confirmAbschreibtext();
        }
    });
}

// Modal für Nachsitzen anzeigen
function showNachsitzenModal(studentIndex) {
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;
    
    // Setze die globale Variable für den Schüler
    currentEvaluationStudentIndex = studentIndex;
    
    // Verwende SweetAlert
    swal({
        title: "Nachsitzen",
        text: `Möchten Sie ${student.name} zum Nachsitzen eintragen?`,
        icon: "question",
        buttons: ["Nein", "Ja"],
        dangerMode: false,
    }).then((willGiveNachsitzen) => {
        if (willGiveNachsitzen) {
            confirmNachsitzen();
        }
    });
}

// Abschreibtext bestätigen
function confirmAbschreibtext() {
    if (currentEvaluationStudentIndex === null) return;
    
    const student = classes[activeClassId].students[currentEvaluationStudentIndex];
    if (!student) return;
    
    // Eintrag im Verlauf hinzufügen
    if (!student.hwHistory) student.hwHistory = [];
    student.hwHistory.push({
        type: 'abschreibtext',
        date: new Date().toISOString(),
        active: true,
        id: Date.now().toString()
    });
    
    // Markierung setzen
    student.abschreibtextActive = true;
    
    saveData();
    
    // Tische neu rendern
    if (activeModule === 'sitzplan') {
        renderSitzplanModule();
    }
    
    // Evaluation-Modal neu laden, um Punkte zu aktualisieren
    if (selectedDesk) {
        showEvaluationPanel(selectedDesk);
    }
}

// Nachsitzen bestätigen
function confirmNachsitzen() {
    if (currentEvaluationStudentIndex === null) return;
    
    const student = classes[activeClassId].students[currentEvaluationStudentIndex];
    if (!student) return;
    
    // Eintrag im Verlauf hinzufügen
    if (!student.hwHistory) student.hwHistory = [];
    student.hwHistory.push({
        type: 'nachsitzen',
        date: new Date().toISOString(),
        active: false, // Nachsitzen hat keine aktive Markierung
        id: Date.now().toString()
    });
    
    saveData();
    
    // Tische neu rendern
    if (activeModule === 'sitzplan') {
        renderSitzplanModule();
    }
    
    // Evaluation-Modal neu laden, um Punkte zu aktualisieren
    if (selectedDesk) {
        showEvaluationPanel(selectedDesk);
    }
}

// ===== SITZPLAN EXPORT =====

// Funktion zum Exportieren des Sitzplans als JPEG
function exportSitzplanAsJPEG() {
    const workspace = document.getElementById('workspace');
    
    if (!workspace) {
        swal("Fehler", "Sitzplan konnte nicht gefunden werden", "error");
        return;
    }
    
    // Lade-Animation anzeigen
    const exportBtn = document.querySelector('button[onclick="exportSitzplanAsJPEG()"]');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportiere...';
    exportBtn.disabled = true;
    
    // Punkte temporär ausblenden für sauberen Export
    const dotsToHide = workspace.querySelectorAll('.schulplaner-dot, .attention-dot');
    const originalDisplay = [];
    
    // Speichere ursprüngliche Display-Werte und blende aus
    dotsToHide.forEach(dot => {
        originalDisplay.push({ element: dot, display: dot.style.display });
        dot.style.display = 'none';
    });
    
    // Ursprüngliche Größe des Workspace speichern
    const originalWidth = workspace.style.width;
    const originalHeight = workspace.style.height;
    
    // Berechne die Bounding Box aller Tische
    const desks = workspace.querySelectorAll('.desk');
    
    // Hintergrundfarben der Tische temporär entfernen für sauberen Export
    const originalBackgrounds = [];
    const removedClasses = [];
    const classesToRemove = ['has-schulplaner-entry', 'learning-support', 'ese-support', 'has-abschreibtext-entry', 'high-negatives-name'];
    desks.forEach(desk => {
        originalBackgrounds.push({ element: desk, background: desk.style.backgroundColor });
        desk.style.backgroundColor = 'white';
        
        const removed = [];
        classesToRemove.forEach(cls => {
            if (desk.classList.contains(cls)) {
                desk.classList.remove(cls);
                removed.push(cls);
            }
        });
        const deskLabel = desk.querySelector('.desk-label');
        if (deskLabel) {
            classesToRemove.forEach(cls => {
                if (deskLabel.classList.contains(cls)) {
                    deskLabel.classList.remove(cls);
                    removed.push('label-' + cls);
                }
            });
        }
        removedClasses.push({ element: desk, removed: removed });
    });
    if (desks.length === 0) {
        // Keine Tische, normale Größe verwenden
        const sitzplanContainer = document.querySelector('.sitzplan-container');
        const options = {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            width: sitzplanContainer ? sitzplanContainer.offsetWidth : 800,
            height: sitzplanContainer ? sitzplanContainer.offsetHeight : 600
        };
        
        html2canvas(workspace, options).then(function(canvas) {
            const imageData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Bild in neuem Fenster öffnen und drucken
            const printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>Sitzplan Druck</title></head><body style="margin:0;"><img src="' + imageData + '" style="max-width:100%; height:auto;"></body></html>');
            printWindow.document.close();
            printWindow.print();
            
            // Punkte wieder einblenden
            originalDisplay.forEach(item => {
                item.element.style.display = item.originalDisplay || '';
            });
            
            // Hintergrundfarben wiederherstellen
            originalBackgrounds.forEach(item => {
                item.element.style.backgroundColor = item.background;
            });
            
            // Klassen wiederherstellen
            removedClasses.forEach(item => {
                item.removed.forEach(cls => {
                    if (cls.startsWith('label-')) {
                        const labelCls = cls.substring(6);
                        const deskLabel = item.element.querySelector('.desk-label');
                        if (deskLabel) deskLabel.classList.add(labelCls);
                    } else {
                        item.element.classList.add(cls);
                    }
                });
            });
            
            // Button zurücksetzen
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;
        }).catch(function(error) {
            console.error('Export fehlgeschlagen:', error);
            originalDisplay.forEach(item => {
                item.element.style.display = item.originalDisplay || '';
            });
            // Hintergrundfarben wiederherstellen
            originalBackgrounds.forEach(item => {
                item.element.style.backgroundColor = item.background;
            });
            // Klassen wiederherstellen
            removedClasses.forEach(item => {
                item.removed.forEach(cls => {
                    if (cls.startsWith('label-')) {
                        const labelCls = cls.substring(6);
                        const deskLabel = item.element.querySelector('.desk-label');
                        if (deskLabel) deskLabel.classList.add(labelCls);
                    } else {
                        item.element.classList.add(cls);
                    }
                });
            });
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;
            swal("Export fehlgeschlagen", "Beim Exportieren ist ein Fehler aufgetreten", "error");
        });
        return;
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    desks.forEach(desk => {
        const x = parseFloat(desk.style.left) || 0;
        const y = parseFloat(desk.style.top) || 0;
        const width = desk.offsetWidth || 90;
        const height = desk.offsetHeight || 60;
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
    });
    
    // Füge etwas Padding hinzu
    const padding = 20;
    const totalWidth = maxX - minX + padding * 2;
    const totalHeight = maxY - minY + padding * 2;
    
    // Temporär die Größe des Workspace anpassen
    workspace.style.width = totalWidth + 'px';
    workspace.style.height = totalHeight + 'px';
    
    // Verschiebe alle Tische, damit sie innerhalb des neuen Bereichs liegen
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;
    
    const originalPositions = [];
    desks.forEach(desk => {
        originalPositions.push({
            element: desk,
            left: desk.style.left,
            top: desk.style.top
        });
        
        const x = parseFloat(desk.style.left) || 0;
        const y = parseFloat(desk.style.top) || 0;
        desk.style.left = (x + offsetX) + 'px';
        desk.style.top = (y + offsetY) + 'px';
    });
    
    // html2canvas Optionen
    const options = {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: totalWidth,
        height: totalHeight
    };
    
    html2canvas(workspace, options).then(function(canvas) {
        // Canvas als JPEG konvertieren
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Direkt als JPEG herunterladen
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `Sitzplan_${classes[activeClassId].name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Positionen zurücksetzen
        originalPositions.forEach(item => {
            item.element.style.left = item.left;
            item.element.style.top = item.top;
        });
        
        // Workspace-Größe zurücksetzen
        workspace.style.width = originalWidth;
        workspace.style.height = originalHeight;
        
        // Punkte wieder einblenden
        originalDisplay.forEach(item => {
            item.element.style.display = item.originalDisplay || '';
        });
        
        // Hintergrundfarben wiederherstellen
        originalBackgrounds.forEach(item => {
            item.element.style.backgroundColor = item.background;
        });
        
        // Klassen wiederherstellen
        removedClasses.forEach(item => {
            item.removed.forEach(cls => {
                if (cls.startsWith('label-')) {
                    const labelCls = cls.substring(6);
                    const deskLabel = item.element.querySelector('.desk-label');
                    if (deskLabel) deskLabel.classList.add(labelCls);
                } else {
                    item.element.classList.add(cls);
                }
            });
        });
        
        // Button zurücksetzen
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
    }).catch(function(error) {
        console.error('Export fehlgeschlagen:', error);
        
        // Positionen zurücksetzen
        originalPositions.forEach(item => {
            item.element.style.left = item.left;
            item.element.style.top = item.top;
        });
        
        // Workspace-Größe zurücksetzen
        workspace.style.width = originalWidth;
        workspace.style.height = originalHeight;
        
        // Punkte wieder einblenden auch bei Fehler
        originalDisplay.forEach(item => {
            item.element.style.display = item.originalDisplay || '';
        });
        
        // Hintergrundfarben wiederherstellen
        originalBackgrounds.forEach(item => {
            item.element.style.backgroundColor = item.background;
        });
        
        // Klassen wiederherstellen
        removedClasses.forEach(item => {
            item.removed.forEach(cls => {
                if (cls.startsWith('label-')) {
                    const labelCls = cls.substring(6);
                    const deskLabel = item.element.querySelector('.desk-label');
                    if (deskLabel) deskLabel.classList.add(labelCls);
                } else {
                    item.element.classList.add(cls);
                }
            });
        });
        
        // Button zurücksetzen
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
        
        // Fehlermeldung
        swal("Export fehlgeschlagen", "Beim Exportieren ist ein Fehler aufgetreten", "error");
    });
}

// ===== SUCHFUNKTION =====

// Suchfeld toggeln
function toggleSearch(module) {
    const searchContainer = document.getElementById(`search-container-${module}`);
    if (searchContainer) {
        const isVisible = searchContainer.style.display !== 'none';
        searchContainer.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            // Fokus auf Input setzen
            const input = searchContainer.querySelector('.search-input');
            if (input) {
                input.onkeydown = (event) => handleSearchInputKeydown(module, event);
                input.focus();
                input.value = '';
                filterStudents(module); // Leere Liste anzeigen
            }
        }
    }
}

function handleSearchInputKeydown(module, event) {
    if (event.key !== 'Enter') return;

    event.preventDefault();

    const suggestions = document.getElementById(`search-suggestions-${module}`);
    if (!suggestions) return;

    const firstMatch = suggestions.querySelector('li:not(.no-results)');
    if (firstMatch) {
        firstMatch.click();
    }
}

// Funktion zum Ausblenden der Suche
function hideSearch(module) {
    const searchContainer = document.getElementById(`search-container-${module}`);
    if (searchContainer) {
        searchContainer.style.display = 'none';
    }
}

// Schüler filtern und Vorschläge anzeigen
function filterStudents(module) {
    const input = document.getElementById(`search-input-${module}`);
    const suggestions = document.getElementById(`search-suggestions-${module}`);
    
    if (!input || !suggestions) return;
    
    const query = input.value.toLowerCase().trim();
    
    // Schülerliste basierend auf Modul abrufen
    let students = [];
    if (classes[activeClassId] && classes[activeClassId].students) {
        students = classes[activeClassId].students;
    }
    
    if (query === '') {
        // Leere Suche - nichts anzeigen
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
        return;
    }
    
    // Schüler filtern
    let filteredStudents = students
        .map((student, index) => ({ name: student.name, index }))
        .filter(student => student.name.toLowerCase().includes(query));
    
    // Vorschläge anzeigen
    suggestions.innerHTML = '';
    
    if (filteredStudents.length === 0) {
        const li = document.createElement('li');
        li.className = 'no-results';
        li.textContent = 'Keine Schüler gefunden';
        suggestions.appendChild(li);
    } else {
        filteredStudents.forEach(student => {
            const li = document.createElement('li');
            li.textContent = student.name;
            li.dataset.studentIndex = String(student.index);
            li.onclick = () => selectStudent(module, student.index);
            suggestions.appendChild(li);
        });
    }
    
    suggestions.style.display = 'block';
}

// Schüler auswählen und zu ihm scrollen
function selectStudent(module, studentIndex) {
    // Suchfeld schließen
    const searchContainer = document.getElementById(`search-container-${module}`);
    if (searchContainer) {
        searchContainer.style.display = 'none';
    }
    
    // Zum Schüler scrollen basierend auf Modul
    let targetElement = null;
    
    switch (module) {
        case 'hausaufgaben':
            // In Hausaufgaben-Modul: .hw-item Element finden
            const hwList = document.getElementById('hw-list');
            if (hwList) {
                const hwItems = hwList.querySelectorAll('.student-card');
                if (hwItems[studentIndex]) {
                    targetElement = hwItems[studentIndex];
                }
            }
            break;
            
        case 'noten':
            // In Noten-Modul: .student-card Element finden
            const studentsList = document.getElementById('students-list');
            if (studentsList) {
                const studentCards = studentsList.querySelectorAll('.student-card');
                if (studentCards[studentIndex]) {
                    targetElement = studentCards[studentIndex];
                }
            }
            break;
            
        case 'listen':
            // In Listen-Modul: abhängig von aktiver Liste
            if (activeListId !== null) {
                const listContent = document.getElementById(`list-${activeListId}`);
                if (listContent) {
                    const checklistItems = listContent.querySelectorAll('.checklist-item');
                    if (checklistItems[studentIndex]) {
                        targetElement = checklistItems[studentIndex];
                    }
                }
            }
            break;
            
        case 'zeugnis':
            // In Zeugnis-Modul: .student-card Element finden
            const zeugnisContainer = document.getElementById('zeugnis-container');
            if (zeugnisContainer) {
                const studentCards = zeugnisContainer.querySelectorAll('.student-card');
                if (studentCards[studentIndex]) {
                    targetElement = studentCards[studentIndex];
                }
            }
            break;
    }
    
    // Zum Element scrollen
    if (targetElement) {
        targetElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // Kurz hervorheben
        const originalBackground = targetElement.style.backgroundColor;
        targetElement.style.backgroundColor = '#e3f2fd';
        setTimeout(() => {
            targetElement.style.backgroundColor = originalBackground;
        }, 2000);
    }
}

// ===== SCHÜLER EXPORT =====

// Modal für Schüler-Export anzeigen
function showExportStudentsModal() {
    // Input auf Klassennamen setzen
    const input = document.getElementById('export-title');
    input.value = classes[activeClassId].name;
    // Select auf 1 setzen
    const select = document.getElementById('num-columns');
    select.value = '1';
    showModal('export-students-modal');
}

// Schülerliste exportieren
function exportStudentsList() {
    const numColumns = parseInt(document.getElementById('num-columns').value);
    
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        alert('Keine Schüler vorhanden');
        return;
    }
    
    const students = classes[activeClassId].students;
    const className = classes[activeClassId].name;
    const exportTitle = document.getElementById('export-title').value.trim() || className;
    const numStudents = students.length;
    
    // Dynamische Anpassung der Schriftgröße und Abstände, um die ganze Seite auszunutzen (optimiert für ~31 Schüler)
    const fontSize = Math.max(12, Math.min(24, 500 / (numStudents + 5)));
    const padding = Math.max(5, Math.min(15, 100 / (numStudents + 5)));
    
    // Erstelle Tabelle
    let tableHtml = '<table border="1" style="border-collapse: collapse; width: auto;">';
    
    // Header
    tableHtml += '<thead><tr>';
    for (let i = 1; i <= numColumns + 1; i++) {
        const header = i === 1 ? 'Name' : '';
        tableHtml += `<th style="width: 150px; padding: ${padding}px; text-align: left;">${header}</th>`;
    }
    tableHtml += '</tr></thead>';
    
    // Body
    tableHtml += '<tbody>';
    students.forEach(student => {
        tableHtml += '<tr>';
        for (let i = 1; i <= numColumns + 1; i++) {
            let value = '';
            if (i === 1) {
                value = student.name;
            } else {
                // Leere Spalten für zusätzliche Daten
                value = '';
            }
            tableHtml += `<td style="width: 150px; padding: ${padding}px;">${value}</td>`;
        }
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    
    // HTML für Export
    const exportHtml = `
        <div style="font-family: Arial, sans-serif; margin: 0; font-size: ${fontSize}px; padding: 20px;">
            <h1>${exportTitle}</h1>
            ${tableHtml}
        </div>
    `;
    
    // Temporäres Element erstellen
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = exportHtml;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    document.body.appendChild(tempDiv);
    
    // Verwende html2canvas, um das Element als Bild zu rendern
    html2canvas(tempDiv, {
        scale: 2, // Höhere Auflösung für besseres JPEG
        useCORS: true,
        allowTaint: false
    }).then(canvas => {
        // Canvas in JPEG konvertieren
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Download-Link erstellen
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `${exportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Temporäres Element entfernen
        document.body.removeChild(tempDiv);
        
        hideModal();
    }).catch(error => {
        console.error('Fehler beim Exportieren:', error);
        alert('Fehler beim Exportieren der Tabelle als JPEG.');
        document.body.removeChild(tempDiv);
        hideModal();
    });
}

// ===== NOTEN EXPORT =====

function exportGrades() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        alert('Keine Schüler vorhanden');
        return;
    }
    
    const students = classes[activeClassId].students;
    const className = classes[activeClassId].name;
    
    // Sammle alle eindeutigen Projektnamen
    const allProjects = new Set();
    students.forEach(student => {
        if (student.projects) {
            student.projects.forEach(project => {
                if (project.name && project.name.trim()) {
                    allProjects.add(project.name.trim());
                }
            });
        }
    });
    const projectNames = Array.from(allProjects).sort();
    
    // Gewichtung für Endnote
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    const numStudents = students.length;
    
    // Dynamische Anpassung der Schriftgröße und Abstände, um die ganze Seite auszunutzen (optimiert für ~31 Schüler)
    const fontSize = Math.max(10, Math.min(16, 400 / (numStudents + 5)));
    const padding = Math.max(4, Math.min(8, 60 / (numStudents + 5)));
    
    // Erstelle Tabelle
    let tableHtml = '<table border="1" style="border-collapse: collapse; width: auto;">';
    
    // Header
    tableHtml += '<thead><tr>';
    tableHtml += `<th style="width: 200px; padding: ${padding}px; text-align: left; background-color: #f2f2f2;">Schüler</th>`;
    projectNames.forEach(name => {
        tableHtml += `<th style="width: 120px; padding: ${padding}px; text-align: center; background-color: #f2f2f2;">${name}</th>`;
    });
    tableHtml += '</tr></thead>';
    
    // Body
    tableHtml += '<tbody>';
    students.forEach(student => {
        tableHtml += '<tr>';
        tableHtml += `<td style="width: 200px; padding: ${padding}px;">${student.name}</td>`;
        
        projectNames.forEach(projectName => {
            const project = student.projects ? student.projects.find(p => p.name && p.name.trim() === projectName) : null;
            const grade = project && project.grade ? project.grade : '';
            tableHtml += `<td style="width: 120px; padding: ${padding}px; text-align: center;">${grade}</td>`;
        });
        
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    
    // HTML für Export
    const exportHtml = `
        <div style="font-family: Arial, sans-serif; margin: 0; font-size: ${fontSize}px; padding: 20px;">
            <h1 style="font-size: ${fontSize + 4}px; margin-bottom: 10px;">Noten - ${className}</h1>
            ${tableHtml}
        </div>
    `;
    
    // Temporäres Element erstellen
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = exportHtml;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    document.body.appendChild(tempDiv);
    
    // Verwende html2canvas, um das Element als Bild zu rendern
    html2canvas(tempDiv, {
        scale: 2, // Höhere Auflösung für besseres JPEG
        useCORS: true,
        allowTaint: false
    }).then(canvas => {
        // Canvas in JPEG konvertieren
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Download-Link erstellen
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `Noten_${className.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Temporäres Element entfernen
        document.body.removeChild(tempDiv);
    }).catch(error => {
        console.error('Fehler beim Exportieren:', error);
        alert('Fehler beim Exportieren der Noten als JPEG.');
        document.body.removeChild(tempDiv);
    });
}

// ===== ZEUGNIS MODUL =====

// Zeugnis-Modul rendern
// Funktion zur Berechnung der Durchschnittsnote der Projekte
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

// Funktion zum Umschalten der Zeugnisansicht (Durchschnitt an/aus)
function toggleZeugnisView() {
    AppState.zeugnisViewMode = AppState.zeugnisViewMode === 'individual' ? 'average' : 'individual';
    
    // Update button styling
    const btn = safeGetElement('zeugnis-view-toggle');
    if (btn) {
        if (AppState.zeugnisViewMode === 'average') {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-purple');
        } else {
            btn.classList.remove('btn-purple');
            btn.classList.add('btn-primary');
        }
    }
    
    renderZeugnisModule();
}

function renderZeugnisModule() {
    const container = safeGetElement('zeugnis-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!classes[activeClassId] || !classes[activeClassId].students || classes[activeClassId].students.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-graduate"></i>
                <p>Keine Schüler in dieser Klasse</p>
            </div>
        `;
        return;
    }
    
    classes[activeClassId].students.forEach((student, index) => {
        const card = document.createElement('div');
        card.className = 'student-card';
        
        // Schriftliche Noten sammeln
        let gradesHtml = '';
        let averageHtml = '';
        if (student.projects && student.projects.length > 0) {
            gradesHtml = student.projects.map(project => {
                const grade = project.grade || '-';
                if (grade !== '-') {
                    const gradeValue = Utils.convertGrade(grade);
                    const gradeClass = Utils.getGradeColorClass(gradeValue);
                    return `<div>${project.name}: <span class="grade-badge ${gradeClass}">${grade}</span></div>`;
                } else {
                    return `<div>${project.name}: ${grade}</div>`;
                }
            }).join('');
            
            // Durchschnittsnote berechnen
            if (AppState.zeugnisViewMode === 'average') {
                const average = calculateProjectAverage(student.projects);
                if (average) {
                    const avgGradeValue = Utils.convertGrade(average.rounded);
                    const avgGradeClass = Utils.getGradeColorClass(avgGradeValue);
                    averageHtml = `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd;"><strong>Durchschnittsnote: <span class="grade-badge ${avgGradeClass}">${average.rounded}</span> (${average.exact})</strong></div>`;
                }
            }
        } else {
            gradesHtml = '<div>Keine Noten vorhanden</div>';
        }
        
        // Zähler
        const homework = typeof student.homework === 'number' ? student.homework : 0;
        const materials = typeof student.materials === 'number' ? student.materials : 0;
        const schulplaner = typeof student.schulplaner === 'number' ? student.schulplaner : 0;
        const positive = student.participation ? (typeof student.participation.positive === 'number' ? student.participation.positive : 0) : 0;
        const negative = student.participation ? (typeof student.participation.negative === 'number' ? student.participation.negative : 0) : 0;
        
        // Abschreibtext und Nachsitzen zählen
        const abschreibtextCount = student.hwHistory ? student.hwHistory.filter(entry => entry.type === 'abschreibtext').length : 0;
        const nachsitzenCount = student.hwHistory ? student.hwHistory.filter(entry => entry.type === 'nachsitzen').length : 0;
        
        // Notizen
        const leftNotes = student.leftNotes || '- ';
        const rightNotes = student.rightNotes || '- ';
        const summaryNotes = student.summaryNotes || '';
        
        card.innerHTML = `
            <div class="card-header">
                <h3>${student.name}</h3>
                <button class="btn btn-sm btn-light" onclick="scrollToTopOfZeugnisModule()">Zurück</button>
            </div>
            <div class="card-body">
                <div class="zeugnis-top">
                    <div class="zeugnis-section">
                        <h4>Schriftlich</h4>
                        <div class="grades-list">${gradesHtml}${averageHtml}</div>
                    </div>
                    <div class="zeugnis-section">
                        <h4>Sonstiges</h4>
                        <div class="stats">
                            <div>Hausaufgaben vergessen: ${homework}</div>
                            <div>Material vergessen: ${materials}</div>
                            <div>Positive Beteiligung: ${positive}</div>
                            <div>Negative Beteiligung: ${negative}</div>
                            ${abschreibtextCount > 0 ? `<div>Abschreibtext: ${abschreibtextCount}</div>` : ''}
                            ${nachsitzenCount > 0 ? `<div>Nachsitzen: ${nachsitzenCount}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="zeugnis-section">
                    <h4>Notizen für ${student.name}</h4>
                    <div class="zeugnis-notes-container">
                        <div class="zeugnis-notes-left">
                            <textarea class="form-control notes-textarea" id="notes-left-${index}" rows="13" placeholder="Linke Notizen..." oninput="saveStudentNotes(${index}, true)" onblur="saveStudentNotes(${index})">${leftNotes}</textarea>
                        </div>
                        <div class="zeugnis-notes-right">
                            <textarea class="form-control notes-textarea" id="notes-right-${index}" rows="13" placeholder="Rechte Notizen..." oninput="saveStudentNotes(${index}, true)" onblur="saveStudentNotes(${index})">${rightNotes}</textarea>
                        </div>
                    </div>
                </div>
                <div class="zeugnis-section summary-section">
                    <h4>Zusammenfassung und Zeugnisnote</h4>
                    <textarea class="form-control notes-textarea" id="notes-summary-${index}" rows="4" placeholder="Zusammenfassung und Zeugnisnote..." oninput="saveStudentNotes(${index}, true)" onblur="saveStudentNotes(${index})">${summaryNotes}</textarea>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });

    // Entferne alte Event-Listener, bevor wir neue hinzufügen
    const oldListeners = container._zeugnisListeners;
    if (oldListeners) {
        if (oldListeners.keydown) {
            container.removeEventListener('keydown', oldListeners.keydown);
        }
    }
    
    // Neuer Event-Listener für automatische Aufzählungszeichen (Enter-Taste)
    const zeugnisListener = function(event) {
        if (event.target.matches('textarea[id^="notes-left-"], textarea[id^="notes-right-"], textarea[id^="notes-summary-"]')) {
            if (event.key === 'Enter') {
                const textarea = event.target;
                const studentIndex = getStudentIndexFromZeugnisTextareaId(textarea.id);
                if (studentIndex < 0) return;

                // Nur für linke/rechte Notizen Aufzählungszeichen hinzufügen
                if (textarea.id.includes('notes-left-') || textarea.id.includes('notes-right-')) {
                    event.preventDefault();
                    event.stopPropagation();

                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const value = textarea.value;
                    
                    const insertText = '\n- ';
                    textarea.value = value.substring(0, start) + insertText + value.substring(end);
                    
                    const newPos = start + insertText.length;
                    textarea.selectionStart = textarea.selectionEnd = newPos;

                    // Linke/rechte Notizen speichern wir direkt nach dem manuellen Zeilenumbruch.
                    saveStudentNotes(studentIndex);
                } else {
                    // In der Zusammenfassung die neue Zeile zuerst vom Browser einfügen lassen,
                    // dann den aktualisierten Text speichern.
                    setTimeout(() => saveStudentNotes(studentIndex), 0);
                }
            }
        }
    };
    
    container.addEventListener('keydown', zeugnisListener);
    container._zeugnisListeners = {
        keydown: zeugnisListener
    };
}

function scrollToTopOfZeugnisModule() {
    console.log("Scroll to top called");
    document.documentElement.scrollTop = 0; // Für Chrome, Firefox, IE und Opera
    document.body.scrollTop = 0; // Für Safari
    window.scrollTo({ top: 0, behavior: 'auto' }); 
}

// Notizen speichern
function saveStudentNotes(studentIndex, isDebounced = false) {
    const leftTextarea = safeGetElement(`notes-left-${studentIndex}`);
    const rightTextarea = safeGetElement(`notes-right-${studentIndex}`);
    const summaryTextarea = safeGetElement(`notes-summary-${studentIndex}`);
    if (!leftTextarea || !rightTextarea || !summaryTextarea) return;
    if (activeClassId === null || !classes[activeClassId] || !classes[activeClassId].students || !classes[activeClassId].students[studentIndex]) return;
    
    // KEIN .trim() beim Speichern, sonst werden Zeilenumbrüche am Ende (Enter) gelöscht
    const leftNotesText = leftTextarea.value;
    const rightNotesText = rightTextarea.value;
    const summaryNotesText = summaryTextarea.value;
    
    const student = classes[activeClassId].students[studentIndex];

    const hasChanges = student.leftNotes !== leftNotesText ||
                       student.rightNotes !== rightNotesText ||
                       student.summaryNotes !== summaryNotesText;
    if (!hasChanges) return;
    
    student.leftNotes = leftNotesText;
    student.rightNotes = rightNotesText;
    student.summaryNotes = summaryNotesText;
    
    // Wenn es ein Live-Update (oninput) ist, nutzen wir einen SEHR KURZEN debounced Sync (500ms)
    // Das verhält sich dann fast so "stark" wie bei den Noten, schont aber den Cursor beim Tippen.
    if (isDebounced) {
        // Lokale Persistenz (localStorage) sofort aktualisieren
        window.classes = classes;
        localStorage.setItem('classes', JSON.stringify(classes));
        
        // Cloud-Sync SEHR SCHNELL anstoßen (500ms statt 2000ms)
        if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.triggerCloudSyncDebounced === 'function') {
            window.triggerCloudSyncDebounced(500, studentIndex);
        }
    } else {
        // Bei onblur oder manuellem Enter: Sofortiges ERZWUNGENES Speichern (exakt wie bei Noten)
        saveData(studentIndex);
    }
}

// Schüler-Karteikarte exportieren
function exportStudentCard(studentIndex) {
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;
    
    // Sammle Daten
    let gradesHtml = '';
    let averageText = '';
    if (student.projects && student.projects.length > 0) {
        gradesHtml = student.projects.map(project => {
            const grade = project.grade || '-';
            if (grade !== '-') {
                const gradeValue = convertGrade(grade);
                const gradeClass = getGradeColorClass(gradeValue);
                return `<li>${project.name}: <span class="grade-badge ${gradeClass}">${grade}</span></li>`;
            } else {
                return `<li>${project.name}: ${grade}</li>`;
            }
        }).join('');
        
        // Durchschnittsnote berechnen
        if (AppState.zeugnisViewMode === 'average') {
            const average = calculateProjectAverage(student.projects);
            if (average) {
                averageText = `<li><strong>Durchschnittsnote: ${average.rounded} (${average.exact})</strong></li>`;
            }
        }
    } else {
        gradesHtml = '<li>Keine Noten vorhanden</li>';
    }
    
    const homework = student.homework || 0;
    const materials = student.materials || 0;
    const schulplaner = student.schulplaner || 0;
    const positive = student.participation ? student.participation.positive || 0 : 0;
    const negative = student.participation ? student.participation.negative || 0 : 0;
    
    const notes = student.notes || [];
    const notesText = notes.map(note => note.text).join('\n\n') || 'Keine Notizen';
    
    const leftNotes = student.leftNotes || '';
    const rightNotes = student.rightNotes || '';
    const summaryNotes = student.summaryNotes || '';
    
    // Erstelle HTML für Druck
    const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Zeugnis - ${student.name}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { text-align: left; margin-bottom: 20px; }
                .section { margin-bottom: 20px; }
                .section h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                ul { list-style-type: none; padding: 0; }
                .notes { white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <h1>${student.name}</h1>
            <div class="section">
                <h2>Schriftlich</h2>
                <ul>${gradesHtml}${averageText}</ul>
            </div>
            <div class="section">
                <h2>Sonstiges</h2>
                <ul>
                    <li>Hausaufgaben vergessen: ${homework}</li>
                    <li>Material vergessen: ${materials}</li>
                    <li>Positive Beteiligung: ${positive}</li>
                    <li>Negative Beteiligung: ${negative}</li>
                </ul>
            </div>
            <div class="section">
                <h2>Notizen</h2>
                <div class="notes">${leftNotes}</div>
                <div class="notes" style="margin-top: 20px;">${rightNotes}</div>
            </div>
            <div class="section">
                <h2>Zusammenfassung und Zeugnisnote</h2>
                <div class="notes">${summaryNotes}</div>
            </div>
        </body>
        </html>
    `;
    
    // Öffne in neuem Fenster
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    
    // Druckdialog öffnen
    printWindow.print();
}

// Alle Schüler-Karteikarten exportieren
function exportAllStudentCards() {
    if (!classes[activeClassId] || !classes[activeClassId].students || classes[activeClassId].students.length === 0) {
        alert('Keine Schüler vorhanden');
        return;
    }
    
    let allPrintHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Zeugnisse - Alle Schüler</title>
            <style>
                @media print {
                    @page { 
                        margin: 0;
                    }
                    body { 
                        margin: 0; 
                        padding: 0;
                    }
                    .student-page {
                        padding: 1.5cm;
                        page-break-after: always;
                    }
                }
                body { font-family: Arial, sans-serif; margin: 20px; }
                .student-page { page-break-after: always; margin-bottom: 40px; }
                h1 { text-align: left; margin-bottom: 10px; }
                .section { margin-bottom: 5px; }
                .section h2 { border-bottom: 1px solid #ccc; padding-bottom: 2px; }
                h3 { margin-top: 5px; margin-bottom: 5px; }
                ul { list-style-type: none; padding: 0; }
                .notes { white-space: pre-wrap; }
                .grade-badge { font-weight: bold; }
                .grade-text { font-weight: bold; }
            </style>
        </head>
        <body>
    `;
    
    classes[activeClassId].students.forEach(student => {
        // Sammle Daten für jeden Schüler
        let gradesHtml = '';
        let averageText = '';
        if (student.projects && student.projects.length > 0) {
            gradesHtml = student.projects.map(project => {
                const grade = project.grade || '-';
                if (grade !== '-') {
                    const gradeValue = convertGrade(grade);
                    const gradeClass = getGradeColorClass(gradeValue);
                    return `<li>${project.name}: <span class="grade-badge ${gradeClass}">${grade}</span></li>`;
                } else {
                    return `<li>${project.name}: <span class="grade-text">${grade}</span></li>`;
                }
            }).join('');
            
            // Durchschnittsnote berechnen
            if (AppState.zeugnisViewMode === 'average') {
                const average = calculateProjectAverage(student.projects);
                if (average) {
                    averageText = `<li><strong>Durchschnittsnote: <span class="grade-text">${average.rounded} (${average.exact})</span></strong></li>`;
                }
            }
        } else {
            gradesHtml = '<li>Keine Noten vorhanden</li>';
        }
        
        const homework = student.homework || 0;
        const materials = student.materials || 0;
        const schulplaner = student.schulplaner || 0;
        const positive = student.participation ? student.participation.positive || 0 : 0;
        const negative = student.participation ? student.participation.negative || 0 : 0;
        
        const notes = student.notes || [];
        const notesText = notes.map(note => note.text).join('\n\n') || 'Keine Notizen';
        
        const leftNotes = student.leftNotes || '';
        const rightNotes = student.rightNotes || '';
        const summaryNotes = student.summaryNotes || '';
        
        allPrintHtml += `
            <div class="student-page">
                <h1>${student.name}</h1>
                <div class="section">
                    <h2>Schriftlich</h2>
                    <ul>${gradesHtml}${averageText}</ul>
                </div>
                <div class="section">
                    <h2>Sonstiges</h2>
                    <ul>
                        <li>Hausaufgaben vergessen: ${homework}</li>
                        <li>Material vergessen: ${materials}</li>
                        <li>Positive Beteiligung: ${positive}</li>
                        <li>Negative Beteiligung: ${negative}</li>
                    </ul>
                </div>
                <div class="section">
                    <h2>Notizen</h2>
                    <div class="notes">${leftNotes}</div>
                    <div class="notes" style="margin-top: 20px;">${rightNotes}</div>
                </div>
                <div class="section">
                    <h2>Zusammenfassung und Zeugnisnote</h2>
                    <div class="notes">${summaryNotes}</div>
                </div>
            </div>
        `;
    });
    
    allPrintHtml += `
        </body>
        </html>
    `;
    
    // Öffne in neuem Fenster
    const printWindow = window.open('', '_blank');
    printWindow.document.write(allPrintHtml);
    printWindow.document.close();
    printWindow.focus();
    
    // Druckdialog öffnen
    printWindow.print();
}


// Modal für letzte Eingabe rückgängig machen öffnen
function openUndoModal(desk) {
    const student = classes[activeClassId].students[desk.studentIndex];
    const lastType = deskClickHistory[desk.id].lastClickType;
    if (!lastType) return; // Keine letzte Eingabe
    
    safeGetElement('undo-student-name').textContent = student.name;
    safeGetElement('undo-type').textContent = lastType === 'positive' ? '+' : '-' ;
    
    window.currentUndoDesk = desk;
    showModal('undo-last-modal');
}

// Letzte Eingabe rückgängig machen
function undoLastEntry() {
    const desk = window.currentUndoDesk;
    const lastType = deskClickHistory[desk.id].lastClickType;
    if (lastType) {
        updateParticipation(desk.studentIndex, lastType, -1);
        deskClickHistory[desk.id].lastClickType = null;
        hideModal();
    }
}
