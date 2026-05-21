// ===== APP STATE =====
const AppState = {
    classes: [],
    activeClassId: null,
    activeModule: 'sitzplan',
    currentPage: 'home',
    currentEvaluationStudentIndex: null,
    zeugnisViewMode: 'individual', // 'individual' or 'average'
    isInitialSyncComplete: false, // Neu: Sperre für Cloud-Sync beim Start
    termine: []
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
let currentPage = AppState.currentPage;

// Für Sitzplan-Evaluation
let currentEvaluationStudentIndex = AppState.currentEvaluationStudentIndex;

// Funktion zum globalen Aktualisieren der Klassen-Daten (wird von Firestore aufgerufen)
window.setClasses = function(newClasses) {
    if (Array.isArray(newClasses)) {
        classes = newClasses;
        AppState.classes = newClasses;
        window.classes = newClasses;
    }
};

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
        
        // Hausaufgaben
        'homework': 'Hausaufgaben',
        'materials': 'Material',
        'planner': 'Eintrag',
        'forgottenHomework': 'Hausaufgaben vergessen',
        'forgottenMaterials': 'Material vergessen',
        'forgottenPlanner': 'Einträge in den Schulplaner',
        'noEntries': 'Keine Einträge',
        'notes': 'Notizen',
        'history': 'Verlauf',
        'entry': 'Eintrag',
        
        // Noten
        'grades': 'Noten',
        'noGrades': 'Keine Noten',
        'noProjects': 'Keine Projekte',
        'projects': 'Projekte',
        'allProjects': 'Alle Projekte',
        
        // Übersicht
        'overview': 'Übersicht',
        'none': 'Keine',
        
        // Modal-Titel und -Texte
        'addClass': 'Klasse hinzufügen',
        'cloneClass': 'Klasse klonen',
        'newClassName': 'Neuer Klassenname',
        'cloneOptions': 'Klon-Optionen',
        'includeStudents': 'Schüler einbeziehen',
        'includeHomework': 'Hausaufgaben einbeziehen',
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
        renderModuleContent();
    }
}

// Modul wechseln
function showModule(module) {
    // Vor dem Modulwechsel offene Zeugnis-Eingaben sichern.
    saveFocusedZeugnisTextarea();

    if (module === 'planung') {
        loadPlanung();
    }

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

// Diese Funktion dient als Verzweigung zu den verschiedenen Modulen
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
        // Spezielle Behandlung für Verlauf-Modal im Sitzplan
        const hwHistoryModal = safeGetElement('hw-history-modal');
        if (hwHistoryModal && hwHistoryModal.style.display !== 'none' && activeModule === 'sitzplan') {
            returnToEvaluationModal();
        } else {
            hideModal();
        }
    }
}

// Funktion zum Zurückkehren zum Bewertungsmodal aus Untermodals
function returnToEvaluationModal() {
    // Aktuelles Modal schließen
    hideModal();
    
    // Nach kurzer Verzögerung das Bewertungsmodal wieder öffnen und aktualisieren
    requestAnimationFrame(() => {
        if (selectedDesk) {
            showEvaluationPanel(selectedDesk);
        } else {
            showModal('evaluation-modal');
        }
    });
}

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

        if (savedClasses) {
            const parsedClasses = JSON.parse(savedClasses);

            // Grundlegende Validierung der geladenen Daten
            if (Array.isArray(parsedClasses)) {
                classes = parsedClasses;
                AppState.classes = classes; // AppState synchron halten

                // Stelle sicher, dass alle erforderlichen Eigenschaften vorhanden sind
                classes.forEach(cls => {
                    // Module-Daten initialisieren, falls nicht vorhanden
                    if (!cls.homework) cls.homework = {};
                    if (!cls.materials) cls.materials = {};
                    if (!cls.alphabeticallySorted) cls.alphabeticallySorted = false;
                    if (!cls.homeworkSorted) cls.homeworkSorted = false;
                    // Neue Felder für die neuen Module initialisieren
                    if (!cls.studentsListSorted) cls.studentsListSorted = false;

                    // Sitzplan-Daten initialisieren
                    if (!cls.sitzplan) cls.sitzplan = { desks: [], currentMode: 'evaluation' };

                    // Sicherstellen, dass alle Schüler die erweiterten Eigenschaften haben
                    if (cls.students) {
                        cls.students.forEach(student => {
                            if (!student.homework) student.homework = 0;
                            if (!student.materials) student.materials = 0;

                            if (!student.isExpanded) student.isExpanded = false; // Für Noten-Tab

                            // NEU: Hausaufgaben-Verlaufseinträge initialisieren
                            if (!student.hwHistory) student.hwHistory = [];

                            // NEU: Tägliche Beteiligung initialisieren
                            if (!student.dailyParticipation) {
                                const today = new Date().toISOString().split('T')[0];
                                student.dailyParticipation = { date: today, positive: 0, negative: 0 };
                            }

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
        
        classCard.innerHTML = `
            <div class="class-card-header">
                <span>${cls.name}</span>
                <span class="badge">${studentCount} Schüler</span>
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

// Drag & Drop Funktionen für Schüler-Sortierung
let draggedStudentIndex = null;
let dragIndicator = null;

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
    if (!classNameInput) return;

    const className = classNameInput.value.trim();
    const subject = subjectInput ? subjectInput.value.trim() : '';

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
        students: [],
        homework: {},
        materials: {},
        alphabeticallySorted: false,
        homeworkSorted: false,
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

    // Neue Klasse erstellen – nur Schüler werden übernommen, Noten und Hausaufgaben zurückgesetzt
    const newClass = {
        name: newName,
        subject: originalClass.subject,
        students: JSON.parse(JSON.stringify(originalClass.students || [])),
        homework: {},
        materials: {},
        alphabeticallySorted: originalClass.alphabeticallySorted || false,
        homeworkSorted: originalClass.homeworkSorted || false,
        studentsListSorted: originalClass.studentsListSorted || false,
        sitzplan: originalClass.sitzplan ? JSON.parse(JSON.stringify(originalClass.sitzplan)) : { desks: [], currentMode: 'evaluation' }
    };
    
    // Hausaufgaben, Material und Noten zurücksetzen
    if (newClass.students) {
        newClass.students.forEach(student => {
            student.homework = 0;
            student.materials = 0;
            student.hwHistory = [];
            student.projects = [];
            student.isExpanded = false;
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
    
    showModal('edit-class-modal');
}

// Klasse speichern nach Bearbeitung
function saveEditedClass() {
    const input = safeGetElement('edit-class-input');
    if (!input || classToEditId === null) return;

    const newName = input.value.trim();
    if (newName) {
        classes[classToEditId].name = newName;
        saveData();
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
function initFlatpickr() {
    if (typeof flatpickr === 'undefined') return;
    const locale = (flatpickr.l10ns && flatpickr.l10ns.de) ? flatpickr.l10ns.de : 'de';
    const fpConfig = {
        locale: locale,
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd.m.Y',
        disableMobile: true,
        onChange: function() { autoGeneratePlanungTable(); },
        onOpen: function(selectedDates, dateStr, instance) {
            setTimeout(function() {
                const cal = instance.calendarContainer;
                cal.style.position = 'fixed';
                cal.style.top = '50%';
                cal.style.left = '50%';
                cal.style.transform = 'translate(-50%, -50%)';
                cal.style.zIndex = '999999';
                cal.style.marginTop = '0';
            }, 0);
        }
    };
    const terminConfig = Object.assign({}, fpConfig);
    delete terminConfig.onChange;

    const startEl = document.getElementById('planung-start-date');
    const endEl = document.getElementById('planung-end-date');
    const terminEl = document.getElementById('termin-date-input');
    if (startEl) flatpickr(startEl, fpConfig);
    if (endEl) flatpickr(endEl, fpConfig);
    if (terminEl) flatpickr(terminEl, terminConfig);
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialisierungsfunktion rufen
    initFlatpickr();
    loadData();
    loadTermine();
    loadPlanung();
    
    // Add styles for the project grades preview
    addProjectGradesPreviewStyles();
    
    // Execute immediately if we're already on the grades tab
    if (activeModule === 'noten') {
        // Wait a short time to ensure the original module has fully rendered
        requestAnimationFrame(() => {
            showProjectGradesInCollapsedView();
        });
    }
    
    // Wochentag-Checkboxen: Tabelle automatisch aktualisieren
    document.querySelectorAll('.planung-day-cb').forEach(cb => {
        cb.addEventListener('change', autoGeneratePlanungTable);
    });

    // Event-Listener für Navigation
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('home');
        });
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
                <td colspan="5">
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
                homework: 0,
                materials: 0,
                isExpanded: false,
                hwHistory: []
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
    
    // renderStudentsModule() nutzt die unsortierte Reihenfolge, deshalb hier den direkten Index verwenden
    if (studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const originalIndex = studentIndex;
    
    // Prüfen, ob der Förderschwerpunkt deaktiviert werden soll
    const currentStatus = classes[activeClassId].students[originalIndex].learningSupport;
    
    if (currentStatus) {
        // Checkbox zurücksetzen (visuell)
        checkbox.checked = true;
        
        // Bestätigung anfordern, wenn Förderschwerpunkt deaktiviert werden soll
        swal({
            title: "Förderschwerpunkt deaktivieren?",
            text: `Möchtest du den Förderschwerpunkt "Lernen" für ${classes[activeClassId].students[originalIndex].name} wirklich deaktivieren?`,
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

function getSortedHomeworkStudents() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        return [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.homeworkSorted) {
        return [...cls.students].sort((a, b) => {
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
        });
    }
    
    return cls.students;
}

// Funktion zum direkten Erhöhen eines Zählers ohne Modal
function increaseHomeworkCounter(studentIndex, counterType) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    let studentsArray;
    let originalIndex;
    
    // Unterschiedliche Behandlung je nach Modul
    if (activeModule === 'sitzplan') {
        // Im Sitzplan verwenden wir den direkten Index (keine Sortierung)
        studentsArray = classes[activeClassId].students;
        originalIndex = studentIndex;
    } else {
        studentsArray = getSortedHomeworkStudents();
        if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
        
        const student = studentsArray[studentIndex];
        originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    }
    
    if (originalIndex === -1) return;
    
    // Entsprechenden Zähler erhöhen
    let newValue;
    if (counterType === 'homework') {
        if (typeof classes[activeClassId].students[originalIndex].homework !== 'number') {
            classes[activeClassId].students[originalIndex].homework = 0;
        }
        classes[activeClassId].students[originalIndex].homework++;
        newValue = classes[activeClassId].students[originalIndex].homework;
    } else if (counterType === 'materials') {
        if (typeof classes[activeClassId].students[originalIndex].materials !== 'number') {
            classes[activeClassId].students[originalIndex].materials = 0;
        }
        classes[activeClassId].students[originalIndex].materials++;
        newValue = classes[activeClassId].students[originalIndex].materials;
    } else if (counterType === 'schulplaner') {
        if (typeof classes[activeClassId].students[originalIndex].schulplaner !== 'number') {
            classes[activeClassId].students[originalIndex].schulplaner = 0;
        }
        classes[activeClassId].students[originalIndex].schulplaner++;
        newValue = classes[activeClassId].students[originalIndex].schulplaner;
    }
    
    // Prüfen, ob ein Hinweis für Eintrag angezeigt werden soll
    if ((counterType === 'homework' || counterType === 'materials') && [3,6,9,12,15].includes(newValue)) {
        const counterName = counterType === 'homework' ? 'Hausaufgaben' : 'Material';
        const student = classes[activeClassId].students[originalIndex];
        setTimeout(() => {
            swal({
                title: `${student.name}: ${newValue}x ${counterName} vergessen`,
                text: `Soll ein Eintrag für ${student.name} gegeben werden?`,
                icon: "question",
                buttons: ["Nein", "Ja"],
                dangerMode: false,
            }).then((willGiveEntry) => {
                if (willGiveEntry) {
                    // Automatisch Eintrag erhöhen
                    increaseHomeworkCounter(originalIndex, 'schulplaner');
                }
            });
        }, 100); // Kleiner Timeout, um sicherzustellen, dass die UI aktualisiert ist
    }
    
    // Verlaufseintrag hinzufügen
    if (!classes[activeClassId].students[originalIndex].hwHistory) {
        classes[activeClassId].students[originalIndex].hwHistory = [];
    }
    
    const historyEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: counterType
    };
    
    classes[activeClassId].students[originalIndex].hwHistory.push(historyEntry);
    
    // Daten speichern und UI aktualisieren
    saveData();
    
    // Modal-Statistiken aktualisieren, falls das Evaluationsmodal geöffnet ist
    const modal = safeGetElement('evaluation-modal');
    if (modal && modal.style.display !== 'none') {
        const statsHomework = safeGetElement(`stats-homework-${originalIndex}`);
        const statsMaterials = safeGetElement(`stats-materials-${originalIndex}`);
        const statsSchulplaner = safeGetElement(`stats-schulplaner-${originalIndex}`);
        
        if (statsHomework) {
            statsHomework.textContent = classes[activeClassId].students[originalIndex].homework || 0;
        }
        if (statsMaterials) {
            statsMaterials.textContent = classes[activeClassId].students[originalIndex].materials || 0;
        }
        if (statsSchulplaner) {
            statsSchulplaner.textContent = classes[activeClassId].students[originalIndex].schulplaner || 0;
        }
    }
    
    // Schulplaner-Punkte im Sitzplan aktualisieren, falls ein Schulplaner-Eintrag war
    if (counterType === 'schulplaner') {
        updateSchulplanerDotsForStudent(originalIndex);
    }
}



// ===== HAUSAUFGABEN VERLAUF =====

// Funktion zum Anzeigen des Hausaufgaben-Verlauf-Modals
function showHWHistoryModal(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Für Sitzplan verwenden wir den direkten Index, da keine Sortierung
    let studentsArray;
    if (activeModule === 'sitzplan') {
        studentsArray = classes[activeClassId].students;
    } else {
        studentsArray = getSortedHomeworkStudents();
    }
    
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass hwHistory existiert
    if (!classes[activeClassId].students[originalIndex].hwHistory) {
        classes[activeClassId].students[originalIndex].hwHistory = [];
    }
    
    // Studentennamen im Modal setzen
    const studentNameElement = safeGetElement('hw-history-student-name');
    if (studentNameElement) {
        studentNameElement.textContent = `Schüler: ${student.name}`;
    }
    
    // Verlauf anzeigen
    renderHWHistory(originalIndex);
    
    // Wenn aus dem Sitzplan, Schließen-Button anpassen
    if (activeModule === 'sitzplan') {
        const modalElement = safeGetElement('hw-history-modal');
        if (modalElement) {
            const closeButton = modalElement.querySelector('.btn-light[onclick="hideModal()"]');
            if (closeButton) {
                closeButton.setAttribute('onclick', 'returnToEvaluationModal()');
            }
        }
    } else {
        // Für andere Tabs (wie Hausaufgaben) sicherstellen, dass der Button hideModal() aufruft
        const modalElement = safeGetElement('hw-history-modal');
        if (modalElement) {
            const closeButton = modalElement.querySelector('.btn-light');
            if (closeButton) {
                closeButton.setAttribute('onclick', 'hideModal()');
            }
        }
    }
    
    // Modal anzeigen
    showModal('hw-history-modal');
}

// Funktion zum Rendern des Hausaufgaben-Verlaufs
function renderHWHistory(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students ||
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    const historyList = safeGetElement('hw-history-list');
    const emptyState = safeGetElement('hw-history-empty');
    
    if (!historyList || !emptyState) return;
    
    historyList.innerHTML = '';
    
    // Sammle alle Einträge: hwHistory und relevante Notizen
    let allEntries = [];
    
    // hwHistory Einträge
    if (student.hwHistory) {
        student.hwHistory.forEach(entry => {
            allEntries.push({
                ...entry,
                source: 'hwHistory'
            });
        });
    }
    
    if (allEntries.length === 0) {
        historyList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    historyList.style.display = 'block';
    emptyState.style.display = 'none';
    
    // Einträge nach Datum sortieren (neueste zuerst)
    const sortedEntries = allEntries.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    sortedEntries.forEach(entry => {
        const entryDate = new Date(entry.date);
        const formattedDate = entryDate.toLocaleDateString('de-DE');
        
        // Text je nach Typ bestimmen
        let typeText = 'Hausaufgaben';
        if (entry.type === 'materials') {
            typeText = 'Material';
        } else if (entry.type === 'schulplaner') {
            typeText = 'Schulplaner';
        } else if (entry.type === 'eintrag') {
            typeText = 'Eintrag';
        } else if (entry.type === 'abschreibtext') {
            typeText = 'Konsequenz';
        } else if (entry.type === 'nachsitzen') {
            typeText = 'Konsequenz';
        }
        
        const historyItem = document.createElement('div');
        historyItem.className = `hw-history-item ${entry.type}`;
        let actionsHtml = `
                <button class="hw-history-delete" onclick="deleteHWHistoryEntry(${studentIndex}, '${entry.id}')">
                    <i class="fas fa-times"></i>
                </button>
        `;
        if (entry.type === 'schulplaner' && entry.active !== false) {
            actionsHtml += `
                <button class="btn btn-sm btn-warning" onclick="deactivateSchulplanerEntry(${studentIndex}, '${entry.id}')">
                    Markierung entfernen
                </button>
            `;
        }
        if (entry.type === 'abschreibtext' && entry.active !== false) {
            actionsHtml += `
                <button class="btn btn-sm btn-warning" onclick="deactivateAbschreibtextEntry(${studentIndex}, '${entry.id}')">
                    Markierung entfernen
                </button>
            `;
        }
        historyItem.innerHTML = `
            <div class="hw-history-content">
                <span class="hw-history-date">${formattedDate}</span> - ${typeText}
            </div>
            <div class="hw-history-actions">
                ${actionsHtml}
            </div>
        `;
        
        historyList.appendChild(historyItem);
    });
}

// Funktion zum Löschen eines Verlaufseintrags
// Variable zur Vermeidung von Mehrfach-Löschvorgängen (Lösch-Sperre)
let isDeletingEntry = false;

function deleteHWHistoryEntry(studentIndex, entryId) {
    if (isDeletingEntry) return; // Verhindert Doppelklicks
    
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    
    if (entryId.startsWith('note-')) {
        // Legacy-Notiz: ignorieren
        return;
    } else {
        // Normaler hwHistory Eintrag
        if (!student.hwHistory) return;
        
        // Eintrag finden
        const entryIndex = student.hwHistory.findIndex(entry => entry.id === entryId);
        
        if (entryIndex === -1) return;
        
        isDeletingEntry = true;
        swal({
            title: "Eintrag löschen?",
            text: "Möchtest du diesen Verlaufseintrag wirklich löschen?",
            icon: "warning",
            buttons: ["Abbrechen", "Löschen"],
            dangerMode: true,
        })
        .then((willDelete) => {
            if (willDelete) {
                // Eintrag erneut suchen, da sich das Array durch Mehrfachklicks verschoben haben könnte
                const currentIndex = student.hwHistory.findIndex(e => e.id === entryId);
                if (currentIndex === -1) {
                    isDeletingEntry = false;
                    return;
                }

                const entry = student.hwHistory[currentIndex];
                const entryType = entry.type;

                // Spezielle Behandlung für aktive Markierungen
                if (entryType === 'schulplaner' && entry.active !== false) {
                    // Schulplaner Markierung deaktivieren
                } else if (entryType === 'abschreibtext' && entry.active !== false) {
                    // Abschreibtext Markierung deaktivieren
                    student.abschreibtextActive = false;
                }
                
                // Eintrag entfernen
                student.hwHistory.splice(currentIndex, 1);
                
                // Entsprechenden Zähler reduzieren
                if (entryType === 'homework') {
                    if (student.homework > 0) {
                        student.homework--;
                    }
                } else if (entryType === 'materials') {
                    if (student.materials > 0) {
                        student.materials--;
                    }
                } else if (entryType === 'schulplaner') {
                    if (student.schulplaner > 0) {
                        student.schulplaner--;
                    }
                }
                
                // Daten speichern und UI aktualisieren
                saveData();
                renderHWHistory(studentIndex);
                
                // Sitzplan-Visualisierung (Blau-Färbung) aktualisieren
                if (activeModule === 'sitzplan') {
                    updateSchulplanerDotsForStudent(studentIndex);
                }
                
                // Modal-Statistiken aktualisieren (auch wenn das Modal ausgeblendet ist)
                const statsHomework = safeGetElement(`stats-homework-${studentIndex}`);
                const statsMaterials = safeGetElement(`stats-materials-${studentIndex}`);
                const statsSchulplaner = safeGetElement(`stats-schulplaner-${studentIndex}`);
                
                if (statsHomework) {
                    statsHomework.textContent = student.homework || 0;
                }
                if (statsMaterials) {
                    statsMaterials.textContent = student.materials || 0;
                }
                if (statsSchulplaner) {
                    statsSchulplaner.textContent = student.schulplaner || 0;
                }
                
                // Schulplaner-Punkte im Sitzplan aktualisieren
                updateSchulplanerDotsForStudent(studentIndex);
                
                // Tische neu rendern für Markierungsänderungen
                if (activeModule === 'sitzplan') {
                    renderSitzplanModule();
                }
            }
            isDeletingEntry = false;
        });
    }
}

// Funktion zum Deaktivieren eines Schulplaner-Eintrags (Markierung entfernen)
function deactivateSchulplanerEntry(studentIndex, entryId) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    
    if (entryId.startsWith('note-')) {
        // Es ist eine Notiz - nicht unterstützen für Deaktivierung
        return;
    }
    
    // Eintrag finden
    const entryIndex = student.hwHistory.findIndex(entry => entry.id === entryId);
    if (entryIndex === -1) return;
    
    const entry = student.hwHistory[entryIndex];
    if (entry.type !== 'schulplaner') return;
    
    // Eintrag deaktivieren
    entry.active = false;
    
    // Daten speichern
    saveData();
    
    // UI aktualisieren
    renderHWHistory(studentIndex);
    
    // Schulplaner-Punkte im Sitzplan aktualisieren
    updateSchulplanerDotsForStudent(studentIndex);
}

// Funktion zum Deaktivieren eines Abschreibtext-Eintrags (Markierung entfernen)
function deactivateAbschreibtextEntry(studentIndex, entryId) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    
    // Eintrag finden
    const entryIndex = student.hwHistory.findIndex(entry => entry.id === entryId);
    if (entryIndex === -1) return;
    
    const entry = student.hwHistory[entryIndex];
    if (entry.type !== 'abschreibtext') return;
    
    // Eintrag deaktivieren
    entry.active = false;
    
    // abschreibtextActive zurücksetzen
    student.abschreibtextActive = false;
    
    // Daten speichern
    saveData();
    
    // UI aktualisieren
    renderHWHistory(studentIndex);
    
    // Tische neu rendern
    if (activeModule === 'sitzplan') {
        renderSitzplanModule();
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

// Endnote berechnen (Durchschnitt der Projektnoten)
function calculateFinalGrade(projects) {
    if (!projects) projects = [];
    
    const writtenGrades = projects
        .map(project => convertGrade(project.grade))
        .filter(grade => grade > 0);

    if (writtenGrades.length === 0) {
        return {
            rounded: 'Keine Noten',
            exact: 'Keine Noten',
            numeric: 0
        };
    }

    const average = writtenGrades.reduce((sum, grade) => sum + grade, 0) / writtenGrades.length;
    return {
        rounded: roundGrade(average),
        exact: average.toFixed(3),
        numeric: average
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

    // Projektnoten in der Kopfzeile aktualisieren
    showProjectGradesInCollapsedView();
    
    // Sicherstellen, dass die globale Referenz für Cloud-Sync aktuell ist
    window.classes = classes;
    
    // Daten speichern
    saveData();
}

// Ein-/Ausklappen der Schülerdetails
function toggleStudentDetails(modul, studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Zustand umschalten
    classes[activeClassId].students[originalIndex].notenExpanded = !classes[activeClassId].students[originalIndex].notenExpanded;
    
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
    
    // Alle Schüler auf nicht ausgeklappt setzen
    classes[activeClassId].students.forEach(student => {
        student.notenExpanded = false;
    });
    
    // UI aktualisieren
    const sortedStudents = getSortedStudents();
    sortedStudents.forEach((student, index) => {
        const modulPrefix = 'noten';
        const detailsDiv = safeGetElement(`${modulPrefix}studentDetails-${index}`);
        const toggleIcon = safeGetElement(`${modulPrefix}toggleIcon-${index}`);
        
        if (detailsDiv && toggleIcon) {
            detailsDiv.classList.remove('show');
            toggleIcon.classList.remove('rotate');
        }
    });
    
    saveData();
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
    const studentDetails = document.getElementById(`notenstudentDetails-${studentIndex}`);
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
                            ${['1', '1-', '2+', '2', '2-', '3+', '3', '3-', '4+', '4', '4-', '5+', '5', '5-', '6+', '6'].map(grade => `
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
    
    // Speichern
    saveData();
    
    // Modul neu rendern für sofortige Aktualisierung
    renderGradesModule();
    
    // Statistiken aktualisieren
    updateProjectSelectionOptions();
    updateProjectStatistics();
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
    
    // Projektnoten in der Kopfzeile aktualisieren
    showProjectGradesInCollapsedView();
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



// ===== IMPORT/EXPORT-FUNKTIONEN =====

// Alle Daten exportieren - Mit Event-Parameter für stopPropagation
function exportAllData(event) {
    // Verhindern, dass das Event den toggleBackupPanel auslöst
    if (event && event.stopPropagation) {
        event.stopPropagation();
    }

    try {
        // Alle Daten in einem Objekt zusammenfassen
        const exportData = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            classes: classes
        };
        
        // Als JSON konvertieren
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Als Datei herunterladen
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const filename = `${month}.${day}.${year}_${hours}.${minutes}.${seconds}_Schulverwaltung.json`;
        
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Fehler beim Exportieren der Daten:", error);
        swal("Fehler", "Die Daten konnten nicht exportiert werden.", "error");
    }
}

// Funktion zum Öffnen des Dateiauswahl-Dialogs für den Import
function handleImportButtonClick(event) {
    // Verhindern, dass das Event den toggleBackupPanel auslöst
    if (event && event.stopPropagation) {
        event.stopPropagation();
    }

    // Klick auf den versteckten Input simulieren
    const importFileInput = safeGetElement('import-backup-file');
    if (importFileInput) {
        importFileInput.click();
    }
}

// Backup-Datei importieren
function importBackupFile(event) {
    if (!event || !event.target || !event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    
    // Sicherstellen, dass es sich um eine JSON-Datei handelt
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        swal("Fehler", "Bitte wähle eine JSON-Datei aus.", "error");
        return;
    }
    
    // Datei lesen
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // Inhalt als JSON parsen
            const importData = JSON.parse(e.target.result);
            
            // Validieren, dass es sich um gültige Daten handelt
            if (!importData.version || !importData.classes || !Array.isArray(importData.classes)) {
                throw new Error("Ungültiges Datenformat");
            }
            
            // Bestätigung anfordern
            swal({
                title: "Daten importieren?",
                text: "Möchtest du die Daten wirklich importieren? Alle aktuellen Daten werden überschrieben.",
                icon: "warning",
                buttons: ["Abbrechen", "Importieren"],
                dangerMode: true,
            })
            .then((willImport) => {
                if (willImport) {
                    // Daten übernehmen
                    classes = importData.classes;
                    AppState.classes = importData.classes;
                    window.classes = importData.classes;
                    
                    // In localStorage speichern
                    localStorage.setItem('classes', JSON.stringify(classes));
                    
                    // UI aktualisieren und Cloud-Sync triggern
                    renderClassesGrid();
                    
                    if (typeof triggerCloudSync === 'function') {
                        triggerCloudSync();
                    }
                    
                    swal("Erfolg", "Daten wurden erfolgreich importiert!", "success");
                    showPage('home');
                }
            });
        } catch (error) {
            console.error("Fehler beim Importieren der Daten:", error);
            swal("Fehler", "Die Datei enthält keine gültigen Daten.", "error");
        }
    };
    
    reader.readAsText(file);
}

// ===== SITZPLAN MODUL =====

// Globale Variablen für den Sitzplan
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
        // Alte document-level Listener via AbortController aufräumen
        if (existingDesk._deskAbortController) {
            existingDesk._deskAbortController.abort();
        }
        existingDesk.remove();
    }
    
    // AbortController für document-level Listener dieses Tisches
    const deskAbortController = new AbortController();
    const deskSignal = deskAbortController.signal;
    
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
        
        deskContent = `<div class="desk-label ${student.learningSupport ? 'learning-support' : ''} ${student.eseSupport ? 'ese-support' : ''} ${highNegatives ? 'high-negatives-name' : ''}">${student.name}${participationHtml}</div>`;
    } else {
        // Leerer Tisch
        deskContent = `<div class="desk-label">Leer</div>`;
    }
    
    deskElement.innerHTML = deskContent;
    
    // AbortController am Element speichern für späteres Cleanup
    deskElement._deskAbortController = deskAbortController;
    
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
    }, { signal: deskSignal });
    
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
    }, { signal: deskSignal });
    
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
    }, { signal: deskSignal });
    
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
    }, { signal: deskSignal });
    
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
        const mode = classes[activeClassId]?.sitzplan?.currentMode;
        if ((mode === 'oral' || mode === 'work') && desk.studentIndex !== null) {
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
        
        content.innerHTML = `
            <div class="evaluation-item">
                <h4>Schüler: ${student.name}</h4>
                <div class="homework-controls">
                    <button class="homework-btn btn btn-purple hausaufgaben-btn" onclick="increaseHomeworkCounter(${desk.studentIndex}, 'homework')">
                        Hausaufgaben
                    </button>
                    <button class="homework-btn btn btn-orange material-btn" onclick="increaseHomeworkCounter(${desk.studentIndex}, 'materials')">
                        Material
                    </button>
                </div>
            </div>
            <div class="student-stats">
                <div class="stats-grid">
                    <div class="stat-item stat-item-purple">
                        <button class="invisible-history-btn" onclick="showHWHistoryModal(currentEvaluationStudentIndex)"></button>
                        <div class="stat-value" id="stats-homework-${desk.studentIndex}">${typeof student.homework === 'number' ? student.homework : 0}</div>
                        <div>Hausaufgaben</div>
                    </div>
                    <div class="stat-item stat-item-orange">
                        <button class="invisible-history-btn" onclick="showHWHistoryModal(currentEvaluationStudentIndex)"></button>
                        <div class="stat-value" id="stats-materials-${desk.studentIndex}">${typeof student.materials === 'number' ? student.materials : 0}</div>
                        <div>Material</div>
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

// Modal für Abschreibtext anzeigen
function showAbschreibtextModal(studentIndex) {
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;
    
    // Setze die globale Variable für den Schüler
    currentEvaluationStudentIndex = studentIndex;
    
    // Verwende SweetAlert statt HTML-Modal
    swal({
        title: "Störungen",
        text: `Möchten Sie ${student.name} eine Konsequenz geben?`,
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
        title: "Störungen",
        text: `Möchten Sie ${student.name} eine Konsequenz geben?`,
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
    
    // Verlauf-Modal aktualisieren, falls geöffnet
    const historyModal = safeGetElement('hw-history-modal');
    if (historyModal && historyModal.style.display !== 'none') {
        renderHWHistory(currentEvaluationStudentIndex);
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
    
    // Verlauf-Modal aktualisieren, falls geöffnet
    const historyModal = safeGetElement('hw-history-modal');
    if (historyModal && historyModal.style.display !== 'none') {
        renderHWHistory(currentEvaluationStudentIndex);
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
    
    // Ursprüngliche Größe des Workspace speichern
    const originalWidth = workspace.style.width;
    const originalHeight = workspace.style.height;
    
    // Berechne die Bounding Box aller Tische
    const desks = workspace.querySelectorAll('.desk');
    
    // Hintergrundfarben der Tische temporär entfernen für sauberen Export
    const originalBackgrounds = [];
    const removedClasses = [];
    const classesToRemove = ['has-schulplaner-entry', 'learning-support', 'ese-support', 'has-abschreibtext-entry', 'has-both-entries', 'high-negatives-name'];
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
    if (!classes[activeClassId]) return;
    
    // Suchfeld schließen
    const searchContainer = document.getElementById(`search-container-${module}`);
    if (searchContainer) {
        searchContainer.style.display = 'none';
    }
    
    // Zum Schüler scrollen basierend auf Modul
    let targetElement = null;
    
    switch (module) {
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
    if (!classes[activeClassId]) return;
    
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
        const positive = student.participation ? (typeof student.participation.positive === 'number' ? student.participation.positive : 0) : 0;
        const negative = student.participation ? (typeof student.participation.negative === 'number' ? student.participation.negative : 0) : 0;
        
        // Konsequenz zählen (ehemals Abschreibtext + Nachsitzen)
        const konsequenzCount = student.hwHistory ? student.hwHistory.filter(entry => entry.type === 'abschreibtext' || entry.type === 'nachsitzen').length : 0;
        
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
                            <div>Negative Beteiligung: ${negative}</div>
                            ${konsequenzCount > 0 ? `<div>Konsequenz: ${konsequenzCount}</div>` : ''}
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
        const positive = student.participation ? student.participation.positive || 0 : 0;
        const negative = student.participation ? student.participation.negative || 0 : 0;
        const printKonsequenzCount = student.hwHistory ? student.hwHistory.filter(entry => entry.type === 'abschreibtext' || entry.type === 'nachsitzen').length : 0;
        
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
                        <li>Negative Beteiligung: ${negative}</li>
                        ${printKonsequenzCount > 0 ? `<li>Konsequenz: ${printKonsequenzCount}</li>` : ''}
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

// ===== TERMINE =====

function loadTermine() {
    try {
        const saved = localStorage.getItem('termine');
        AppState.termine = saved ? JSON.parse(saved) : [];
    } catch (e) {
        AppState.termine = [];
    }

    if (AppState.termine.length > 0 && !localStorage.getItem('extraDataLastUpdate')) {
        localStorage.setItem('extraDataLastUpdate', new Date().toISOString());
    }
}

function saveTermine() {
    localStorage.setItem('termine', JSON.stringify(AppState.termine));
    localStorage.setItem('extraDataLastUpdate', new Date().toISOString());
    if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.triggerCloudSyncDebounced === 'function') {
        window.triggerCloudSyncDebounced(2500);
    }
}

function showTermineModal() {
    loadTermine();
    const dateInput = safeGetElement('termin-date-input');
    if (dateInput && !dateInput.value) {
        const today = localDateStr(new Date());
        if (dateInput._flatpickr) dateInput._flatpickr.setDate(today, false);
        else dateInput.value = today;
    }
    renderTermineList();
    showModal('termine-modal');
}

function renderTermineList() {
    const container = safeGetElement('termine-list-container');
    if (!container) return;

    const termine = AppState.termine || [];

    if (termine.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px 0;">
                <i class="fas fa-calendar"></i>
                <p>Keine Termine vorhanden</p>
            </div>
        `;
        return;
    }

    const sorted = [...termine].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Unterrichtstage der aktuellen Klasse ermitteln
    const p = AppState.planung;
    const hasPlanung = p && p.startDate && p.endDate && (p.selectedDays || []).length > 0;
    const teachingDates = new Set();
    if (hasPlanung) {
        const cur = new Date(p.startDate + 'T00:00:00');
        const end = new Date(p.endDate + 'T00:00:00');
        while (cur <= end) {
            if (p.selectedDays.includes(cur.getDay())) teachingDates.add(localDateStr(cur));
            cur.setDate(cur.getDate() + 1);
        }
    }

    const hiddenTermine = (p && p.hiddenTermine) ? p.hiddenTermine : [];

    container.innerHTML = '';
    sorted.forEach(termin => {
        const isHidden = hiddenTermine.includes(termin.id);
        let statusClass = '';
        let statusIcon = '';
        if (hasPlanung) {
            if (teachingDates.has(termin.date)) {
                statusClass = ' termin-on-teaching-day';
                statusIcon = '<i class="fas fa-check-circle termin-status-icon" title="Fällt auf einen Unterrichtstag"></i>';
            } else {
                statusClass = ' termin-not-on-teaching-day';
                statusIcon = '<i class="fas fa-times-circle termin-status-icon" title="Kein Unterrichtstag"></i>';
            }
        }
        if (isHidden) statusClass += ' termin-ausgeblendet';

        const item = document.createElement('div');
        item.className = `termin-item${statusClass}`;
        item.id = `termin-item-${termin.id}`;

        const formattedDate = new Date(termin.date + 'T00:00:00').toLocaleDateString('de-DE', {
            weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
        });

        item.innerHTML = `
            <div class="termin-info">
                ${statusIcon}
                <div class="termin-info-text">
                    <span class="termin-date">${formattedDate}</span>
                    <span class="termin-title">${termin.title}</span>
                </div>
            </div>
            <div class="termin-actions">
                <label class="termin-ausblenden-label">
                    <input type="checkbox" ${isHidden ? 'checked' : ''} onchange="toggleTerminAusblenden('${termin.id}', this.checked)"> Ausblenden
                </label>
                <button class="btn btn-sm btn-primary btn-square" onclick="editTermin('${termin.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger btn-square" onclick="deleteTermin('${termin.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        container.appendChild(item);
    });
}

function addTermin() {
    const titleInput = safeGetElement('termin-title-input');
    const dateInput = safeGetElement('termin-date-input');

    if (!titleInput || !dateInput) return;

    const title = titleInput.value.trim();
    const date = dateInput.value;

    if (!title) {
        swal('Fehler', 'Bitte eine Bezeichnung eingeben', 'error');
        return;
    }
    if (!date) {
        swal('Fehler', 'Bitte ein Datum eingeben', 'error');
        return;
    }

    if (!AppState.termine) AppState.termine = [];

    const newId = Date.now().toString();
    AppState.termine.push({ id: newId, title: title, date: date });
    saveTermine();

    titleInput.value = '';
    renderTermineList();
    renderPlanungTable();
}


function deleteTermin(terminId) {
    swal({
        title: 'Termin löschen?',
        text: 'Möchtest du diesen Termin wirklich löschen?',
        icon: 'warning',
        buttons: ['Abbrechen', 'Löschen'],
        dangerMode: true,
    }).then((willDelete) => {
        if (willDelete) {
            AppState.termine = (AppState.termine || []).filter(t => t.id !== terminId);
            saveTermine();
            if (AppState.planung && AppState.planung.hiddenTermine) {
                AppState.planung.hiddenTermine = AppState.planung.hiddenTermine.filter(id => id !== terminId);
                savePlanung();
            }
            renderTermineList();
            renderPlanungTable();
        }
    });
}

function toggleTerminAusblenden(terminId, checked) {
    if (!AppState.planung) return;
    if (!AppState.planung.hiddenTermine) AppState.planung.hiddenTermine = [];
    if (checked) {
        if (!AppState.planung.hiddenTermine.includes(terminId))
            AppState.planung.hiddenTermine.push(terminId);
    } else {
        AppState.planung.hiddenTermine = AppState.planung.hiddenTermine.filter(id => id !== terminId);
    }
    savePlanung();
    renderTermineList();
    renderPlanungTable();
}

function editTermin(terminId) {
    const termin = (AppState.termine || []).find(t => t.id === terminId);
    if (!termin) return;

    const item = safeGetElement(`termin-item-${terminId}`);
    if (!item) return;

    item.className = 'termin-item termin-item-editing';
    item.innerHTML = `
        <div class="termin-edit-form">
            <div class="form-group">
                <input type="text" class="form-control" id="termin-edit-title-${terminId}" value="${termin.title}">
            </div>
            <div class="form-group">
                <input type="date" class="form-control" id="termin-edit-date-${terminId}" value="${termin.date}">
            </div>
            <div class="termin-edit-actions">
                <button class="btn btn-sm btn-light" onclick="renderTermineList()">Abbrechen</button>
                <button class="btn btn-sm btn-primary" onclick="saveEditedTermin('${terminId}')">Speichern</button>
            </div>
        </div>
    `;
    if (typeof flatpickr !== 'undefined') {
        const locale = (flatpickr.l10ns && flatpickr.l10ns.de) ? flatpickr.l10ns.de : 'de';
        const editDateEl = document.getElementById(`termin-edit-date-${terminId}`);
        if (editDateEl) flatpickr(editDateEl, {
            locale: locale,
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd.m.Y',
            disableMobile: true,
            defaultDate: termin.date,
            onOpen: function(selectedDates, dateStr, instance) {
                setTimeout(function() {
                    const cal = instance.calendarContainer;
                    cal.style.position = 'fixed';
                    cal.style.top = '50%';
                    cal.style.left = '50%';
                    cal.style.transform = 'translate(-50%, -50%)';
                    cal.style.zIndex = '999999';
                    cal.style.marginTop = '0';
                }, 0);
            }
        });
    }
}

function saveEditedTermin(terminId) {
    const titleInput = safeGetElement(`termin-edit-title-${terminId}`);
    const dateInput = safeGetElement(`termin-edit-date-${terminId}`);
    if (!titleInput || !dateInput) return;

    const title = titleInput.value.trim();
    const date = dateInput.value;

    if (!title || !date) {
        swal('Fehler', 'Bitte alle Felder ausfüllen', 'error');
        return;
    }

    const index = (AppState.termine || []).findIndex(t => t.id === terminId);
    if (index === -1) return;

    AppState.termine[index] = {
        ...AppState.termine[index],
        title: title,
        date: date
    };

    saveTermine();
    renderTermineList();
}

// ── Planung ─────────────────────────────────────────────────────────────────

const PLANUNG_DAY_NAMES = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

function planungStorageKey() {
    return activeClassId !== null ? `planung_${activeClassId}` : 'planung';
}

function loadPlanung() {
    try {
        const saved = localStorage.getItem(planungStorageKey());
        AppState.planung = saved ? JSON.parse(saved) : { startDate: '', endDate: '', selectedDays: [], entries: {} };
    } catch (e) {
        AppState.planung = { startDate: '', endDate: '', selectedDays: [], entries: {} };
    }

    const p = AppState.planung;
    if (!p.entries) p.entries = {};
    if (!p.hiddenTermine) p.hiddenTermine = [];
    const startEl = safeGetElement('planung-start-date');
    const endEl = safeGetElement('planung-end-date');
    if (startEl) {
        if (startEl._flatpickr) startEl._flatpickr.setDate(p.startDate || '', false);
        else startEl.value = p.startDate || '';
    }
    if (endEl) {
        if (endEl._flatpickr) endEl._flatpickr.setDate(p.endDate || '', false);
        else endEl.value = p.endDate || '';
    }

    document.querySelectorAll('.planung-day-cb').forEach(cb => {
        cb.checked = (p.selectedDays || []).includes(parseInt(cb.value));
    });

    renderPlanungTable();
}

function savePlanung() {
    localStorage.setItem(planungStorageKey(), JSON.stringify(AppState.planung));
    localStorage.setItem('extraDataLastUpdate', new Date().toISOString());
    if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.triggerCloudSyncDebounced === 'function') {
        window.triggerCloudSyncDebounced(2500);
    }
}

function exportPlanungTable() {
    const container = safeGetElement('planung-table-container');
    if (!container || !container.querySelector('table')) {
        swal('Hinweis', 'Es gibt keine Tabelle zum Exportieren.', 'info');
        return;
    }

    const rows = container.querySelectorAll('.planung-row');
    let tbodyHtml = '';
    rows.forEach(row => {
        const cells  = row.querySelectorAll('td');
        const nr     = cells[1].textContent.trim();
        const tagFull = cells[2].textContent.trim();
        const tagMap  = { 'Montag': 'Mo.', 'Dienstag': 'Di.', 'Mittwoch': 'Mi.', 'Donnerstag': 'Do.', 'Freitag': 'Fr.' };
        const tag     = tagMap[tagFull] || tagFull;
        const datum  = cells[3].textContent.trim();
        const inhalt = row.querySelector('textarea') ? row.querySelector('textarea').value : '';
        const terminText = row.querySelector('.planung-termin-text') ? row.querySelector('.planung-termin-text').textContent.trim() : '';
        const isTermin = row.classList.contains('planung-row-termin');
        const rowStyle = isTermin ? ' class="termin-row"' : '';
        const inhaltCell = terminText
            ? `<span class="termin-label">${terminText}</span>${inhalt ? ' ' + inhalt : ''}`
            : inhalt;
        tbodyHtml += `<tr${rowStyle}><td>${nr}</td><td>${tag}</td><td>${datum}</td><td>${inhaltCell}</td></tr>`;
    });

    const className = (activeClassId !== null && classes[activeClassId]) ? classes[activeClassId].name : '';
    const exportTitle = className ? `Planung - ${className}` : 'Planung';

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${exportTitle}</title><style>
        body { font-family: sans-serif; font-size: 13px; padding: 24px; }
        h2 { margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        col.col-nr    { width: 10%; }
        col.col-tag   { width: 8%; }
        col.col-datum { width: 17%; }
        col.col-inhalt{ width: 65%; }
        th { background: #4a6cf7; color: #fff; padding: 8px 12px; text-align: center; }
        td { padding: 10px 12px; border-bottom: 1px solid #dee2e6; vertical-align: middle; text-align: center; word-wrap: break-word; }
        td:last-child { text-align: left; }
        tr:nth-child(even) td { background: #f8f9fa; }
        tr.termin-row td { background: #fff8e1 !important; }
        .termin-label { font-weight: 600; }
        @media print { body { padding: 0; } }
    </style></head><body>
        <h2>${exportTitle}</h2>
        <table>
            <colgroup><col class="col-nr"><col class="col-tag"><col class="col-datum"><col class="col-inhalt"></colgroup>
            <thead><tr><th>Nr.</th><th>Tag</th><th>Datum</th><th>Inhalt</th></tr></thead>
            <tbody>${tbodyHtml}</tbody>
        </table>
        <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>`);
    win.document.close();
}

function deletePlanungTable() {
    swal({
        title: 'Tabelle löschen?',
        text: 'Alle Einträge und Einstellungen werden unwiderruflich gelöscht.',
        icon: 'warning',
        buttons: ['Abbrechen', 'Löschen'],
        dangerMode: true,
    }).then(willDelete => {
        if (!willDelete) return;
        AppState.planung = { startDate: '', endDate: '', selectedDays: [], entries: {}, hiddenTermine: [] };
        savePlanung();
        const startEl = safeGetElement('planung-start-date');
        const endEl = safeGetElement('planung-end-date');
        if (startEl) { if (startEl._flatpickr) startEl._flatpickr.clear(); else startEl.value = ''; }
        if (endEl) { if (endEl._flatpickr) endEl._flatpickr.clear(); else endEl.value = ''; }
        document.querySelectorAll('.planung-day-cb').forEach(cb => cb.checked = false);
        const container = safeGetElement('planung-table-container');
        if (container) container.innerHTML = '';
    });
}

function autoGeneratePlanungTable() {
    const startEl = safeGetElement('planung-start-date');
    const endEl = safeGetElement('planung-end-date');
    if (!startEl || !endEl) return;
    const startDate = startEl.value;
    const endDate = endEl.value;
    if (!startDate || !endDate || startDate > endDate) return;
    const selectedDays = [];
    document.querySelectorAll('.planung-day-cb:checked').forEach(cb => {
        selectedDays.push(parseInt(cb.value));
    });
    if (!selectedDays.length) {
        if (AppState.planung) AppState.planung.selectedDays = [];
        renderPlanungTable();
        return;
    }
    generatePlanungTable();
}

function generatePlanungTable() {
    const startEl = safeGetElement('planung-start-date');
    const endEl = safeGetElement('planung-end-date');
    if (!startEl || !endEl) return;

    const startDate = startEl.value;
    const endDate = endEl.value;
    if (!startDate || !endDate || startDate > endDate) return;

    const selectedDays = [];
    document.querySelectorAll('.planung-day-cb:checked').forEach(cb => {
        selectedDays.push(parseInt(cb.value));
    });
    if (!selectedDays.length) return;

    if (!AppState.planung) AppState.planung = { entries: {}, hiddenTermine: [] };
    AppState.planung.startDate = startDate;
    AppState.planung.endDate = endDate;
    AppState.planung.selectedDays = selectedDays;
    if (!AppState.planung.entries) AppState.planung.entries = {};
    if (!AppState.planung.hiddenTermine) AppState.planung.hiddenTermine = [];

    savePlanung();
    renderPlanungTable();
}

const ALL_DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function renderPlanungTable() {
    const container = safeGetElement('planung-table-container');
    if (!container) return;

    const p = AppState.planung;
    if (!p || !p.startDate || !p.endDate || !(p.selectedDays || []).length) {
        container.innerHTML = '';
        return;
    }

    // Unterrichtstage aufbauen
    const teachingDates = new Set();
    const rows = [];
    const current = new Date(p.startDate + 'T00:00:00');
    const end = new Date(p.endDate + 'T00:00:00');

    while (current <= end) {
        const dow = current.getDay();
        if ((p.selectedDays || []).includes(dow)) {
            const dateStr = localDateStr(current);
            teachingDates.add(dateStr);
            rows.push({ date: dateStr, dow, isTeaching: true, termins: [] });
        }
        current.setDate(current.getDate() + 1);
    }

    // Termine einarbeiten – ausgeblendete Termine dieser Klasse überspringen
    const termine = AppState.termine || [];
    const hiddenTermine = new Set(p.hiddenTermine || []);
    termine.forEach(termin => {
        if (hiddenTermine.has(termin.id)) return;
        if (termin.date < p.startDate || termin.date > p.endDate) return;
        if (teachingDates.has(termin.date)) {
            rows.find(r => r.date === termin.date).termins.push(termin);
        } else {
            const d = new Date(termin.date + 'T00:00:00');
            rows.push({ date: termin.date, dow: d.getDay(), isTeaching: false, termins: [termin] });
        }
    });

    rows.sort((a, b) => a.date.localeCompare(b.date));

    if (!rows.length) {
        container.innerHTML = '<p class="planung-empty">Keine Unterrichtstage im gewählten Zeitraum.</p>';
        return;
    }

    let nr = 0;
    const tableRows = rows.map(row => {
        if (row.isTeaching) nr++;
        const formattedDate = new Date(row.date + 'T00:00:00').toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const inhalt = (p.entries && p.entries[row.date]) ? escapeHtml(p.entries[row.date]) : '';

        const terminText = row.termins.map(t => escapeHtml(t.title)).join(', ');

        if (row.isTeaching) {
            return `<tr class="planung-row${terminText ? ' planung-row-termin' : ''}" data-date="${row.date}">
                <td class="planung-col-handle"><i class="fas fa-grip-vertical"></i></td>
                <td class="planung-col-nr">${nr}</td>
                <td class="planung-col-tag">${PLANUNG_DAY_NAMES[row.dow]}</td>
                <td class="planung-col-datum">${formattedDate}</td>
                <td class="planung-col-inhalt">
                    <div class="planung-inhalt-cell">
                        ${terminText ? `<span class="planung-termin-text">${terminText}</span>` : ''}
                        <textarea class="planung-inhalt-input" data-date="${row.date}" rows="1">${inhalt}</textarea>
                    </div>
                </td>
            </tr>`;
        } else {
            return `<tr class="planung-row planung-row-termin" data-date="${row.date}">
                <td class="planung-col-handle"></td>
                <td class="planung-col-nr">—</td>
                <td class="planung-col-tag">${ALL_DAY_NAMES[row.dow]}</td>
                <td class="planung-col-datum">${formattedDate}</td>
                <td class="planung-col-inhalt">${terminText}</td>
            </tr>`;
        }
    }).join('');

    container.innerHTML = `
        <table class="planung-table">
            <thead>
                <tr>
                    <th class="planung-col-handle"></th>
                    <th class="planung-col-nr">Nr.</th>
                    <th class="planung-col-tag">Tag</th>
                    <th class="planung-col-datum">Datum</th>
                    <th class="planung-col-inhalt">Inhalt</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
    `;

    container.querySelectorAll('.planung-inhalt-input').forEach(ta => {
        ta.addEventListener('input', function() {
            if (!AppState.planung.entries) AppState.planung.entries = {};
            AppState.planung.entries[this.dataset.date] = this.value;
            savePlanung();
        });
    });

    let planungDragSource = null;

    container.querySelectorAll('.planung-row').forEach(row => {
        const handle = row.querySelector('.planung-col-handle');
        if (!handle || !row.dataset.date || !rows.find(r => r.date === row.dataset.date && r.isTeaching)) return;

        handle.addEventListener('mousedown', () => { row.draggable = true; });

        row.addEventListener('dragstart', e => {
            planungDragSource = row.dataset.date;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => row.classList.add('planung-dragging'), 0);
        });

        row.addEventListener('dragend', () => {
            row.draggable = false;
            row.classList.remove('planung-dragging');
            container.querySelectorAll('.planung-row').forEach(r => r.classList.remove('planung-drag-over'));
            planungDragSource = null;
        });

        row.addEventListener('dragover', e => {
            if (!planungDragSource || row.dataset.date === planungDragSource) return;
            e.preventDefault();
            container.querySelectorAll('.planung-row').forEach(r => r.classList.remove('planung-drag-over'));
            row.classList.add('planung-drag-over');
        });

        row.addEventListener('dragleave', e => {
            if (!row.contains(e.relatedTarget)) row.classList.remove('planung-drag-over');
        });

        row.addEventListener('drop', e => {
            e.preventDefault();
            const targetDate = row.dataset.date;
            if (!planungDragSource || planungDragSource === targetDate) return;

            const entries = AppState.planung.entries || {};
            const srcContent = entries[planungDragSource] || '';
            const tgtContent = entries[targetDate] || '';

            if (srcContent) entries[targetDate] = srcContent; else delete entries[targetDate];
            if (tgtContent) entries[planungDragSource] = tgtContent; else delete entries[planungDragSource];

            AppState.planung.entries = entries;
            planungDragSource = null;
            savePlanung();
            renderPlanungTable();
        });
    });
}

function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
