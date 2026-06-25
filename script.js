// ===== APP STATE =====
const AppState = {
    classes: [],
    activeClassId: null,
    activeModule: 'sitzplan',
    currentPage: 'home',
    currentEvaluationStudentIndex: null,
    zeugnisViewMode: localStorage.getItem('zeugnisViewMode') || 'individual', // 'individual' or 'average'
    isInitialSyncComplete: false, // Neu: Sperre für Cloud-Sync beim Start
    termine: [],
    contacts: JSON.parse(localStorage.getItem('contacts') || '[]'),
    dashboardNotes: JSON.parse(localStorage.getItem('dashboardNotes') || '[]')
};

// Start-Sperre setzen (3 Sekunden), damit Cloud-Daten Zeit zum Laden haben
setTimeout(() => {
    AppState.isInitialSyncComplete = true;
    console.log("App: Initial-Sync-Sperre aufgehoben.");
}, 3500);

window.AppState = AppState; // Für index.html (Firebase-Sync) zugänglich machen

// ===== GLOBALE VARIABLEN =====
// Einzige Quelle der Wahrheit: AppState. Die Namen `classes`, `contacts` und
// `dashboardNotes` (inkl. window.classes etc.) sind nur noch Aliasse, die per
// Getter/Setter direkt auf AppState zeigen. Dadurch können die drei Kopien
// nicht mehr auseinanderlaufen – egal welche Schreibweise im Code steht.
// (Klassisches, nicht-striktes Skript: nackte Bezeichner wie `classes` greifen
//  automatisch auf window.classes – und damit auf AppState – zu.)
['classes', 'contacts', 'dashboardNotes'].forEach((key) => {
    Object.defineProperty(window, key, {
        get() { return AppState[key]; },
        set(value) { AppState[key] = value; },
        configurable: true,
        enumerable: true,
    });
});
let activeClassId = AppState.activeClassId;
let activeModule = AppState.activeModule;
let currentPage = AppState.currentPage;

// Funktion zum globalen Aktualisieren der Notizen (wird von Firestore aufgerufen)
window.setDashboardNotes = function(newNotes) {
    if (Array.isArray(newNotes)) {
        AppState.dashboardNotes = newNotes;
    }
};

// Für Sitzplan-Evaluation
let currentEvaluationStudentIndex = AppState.currentEvaluationStudentIndex;

// Funktion zum globalen Aktualisieren der Klassen-Daten (wird von Firestore aufgerufen)
window.setClasses = function(newClasses) {
    if (Array.isArray(newClasses)) {
        AppState.classes = newClasses;
    }
};

// Notenumrechnungstabellen (gradeConversion / reverseGradeConversion) ausgelagert
// nach grades.js – dort als globale Konstanten definiert, hier weiter nutzbar.

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
        'forgottenHomework': 'Hausaufgaben',
        'forgottenMaterials': 'Material',
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

// convertGrade / roundGrade / getGradeColorClass sind nach grades.js ausgelagert
// (dort die echte Logik, global verfügbar). Utils.* bleibt davon unberührt.

// Hilfsfunktion zur Bestimmung der Farbe basierend auf dem Notenwert
function getGradeColor(grade) {
    return Utils.getGradeColor(grade);
}

// ===== NAVIGATION UND UI =====

// Seitennavigation
function showPage(page, classId = null, shouldPushState = true) {
    // Sitzplan-Vollbild beim Seitenwechsel sicher verlassen
    if (typeof exitSitzplanFullscreen === 'function') exitSitzplanFullscreen();
    const previousClassId = activeClassId;

    // Vor Seiten-/Klassenwechsel offene Zeugnis-Änderungen der aktuellen Klasse sichern.
    if (previousClassId !== null && (page !== 'class' || classId !== previousClassId)) {
        saveFocusedZeugnisTextarea(previousClassId);
    }

    if (shouldPushState) rememberCurrentHistoryScroll();

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
            showModule('sitzplan', false);
        }
    }
    
    // Inhalte aktualisieren
    if (page === 'home') {
        renderClassesGrid();
        renderDashboardNotes();
        renderDashboardCalendar();
    } else if (page === 'class') {
        renderModuleContent();
    }

    // Verlauf verwalten
    if (shouldPushState) {
        const state = { page: page, classId: classId, module: page === 'class' ? 'sitzplan' : null, toolWindow: null };
        if (page === 'home') {
            if (history.state && history.state.page !== 'home') {
                history.pushState(state, '');
            } else {
                history.replaceState(state, '');
            }
        } else {
            history.pushState(state, '');
        }
    }
}

function getCurrentPageScrollState() {
    const ztTileScrollEl = document.querySelector('#dashboard-zt-list .dashboard-zt-scroll');
    return {
        scrollX: window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
        scrollY: window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0,
        dashboardZtScrollTop: ztTileScrollEl ? ztTileScrollEl.scrollTop : null
    };
}

function rememberCurrentHistoryScroll() {
    if (!history.state) return;
    history.replaceState({ ...history.state, ...getCurrentPageScrollState() }, '');
}

function restoreHistoryScroll(state) {
    if (!state || (!Number.isFinite(state.scrollY) && !Number.isFinite(state.dashboardZtScrollTop))) return;

    const restore = () => {
        // Nicht in ein offenes Tool-Fenster hineinscrollen (verstellt dessen Scroll).
        if (window._activeToolWindow) return;
        if (Number.isFinite(state.dashboardZtScrollTop)) {
            const ztTileScrollEl = document.querySelector('#dashboard-zt-list .dashboard-zt-scroll');
            if (ztTileScrollEl) ztTileScrollEl.scrollTop = state.dashboardZtScrollTop;
        }

        if (Number.isFinite(state.scrollY)) {
            const x = Number.isFinite(state.scrollX) ? state.scrollX : 0;
            document.documentElement.scrollTop = state.scrollY;
            document.body.scrollTop = state.scrollY;
            window.scrollTo(x, state.scrollY);
        }
    };

    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 60);
    setTimeout(restore, 180);
    setTimeout(restore, 360);
}

// Vor einer Startseiten-Rückkehr (Browser-Zurück) die robuste Scroll-Wiederher-
// stellung „vorladen": renderClassesGrid ruft danach scheduleDashboardScrollRestore
// auf, das die Position über ~900 ms immer wieder setzt – auch während sich das
// Kachel-Layout (Masonry) erst einpendelt. Das verhindert das kleine Springen,
// besonders beim Schließen eines Tool-Fensters (Dokument-Scroll).
function seedDashboardScrollRestore(state) {
    if (!state || state.page !== 'home') return;
    window._dashboardScrollRestore = {
        x: Number.isFinite(state.scrollX) ? state.scrollX : 0,
        y: Number.isFinite(state.scrollY) ? state.scrollY : 0,
        tileScrollTop: Number.isFinite(state.dashboardZtScrollTop) ? state.dashboardZtScrollTop : null,
        until: Date.now() + 2000
    };
}

// Modul wechseln
function showModule(module, shouldPushState = true) {
    // Sitzplan-Vollbild beim Tab-Wechsel sicher verlassen
    exitSitzplanFullscreen();

    // Beim Verlassen des Noten-Tabs alle Schüler einklappen
    if (activeModule === 'noten' && module !== 'noten') {
        collapseAllStudents();
    }

    // Suchfelder bei Modulwechsel schließen und zurücksetzen
    document.querySelectorAll('.search-container').forEach(container => {
        container.style.display = 'none';
        const input = container.querySelector('.search-input');
        if (input) {
            input.value = '';
        }
        const suggestions = container.querySelector('.search-suggestions');
        if (suggestions) {
            suggestions.innerHTML = '';
            suggestions.style.display = 'none';
        }
    });

    // Vor dem Modulwechsel offene Zeugnis-Eingaben sichern.
    saveFocusedZeugnisTextarea();

    // Wenn wir den Zeugnis- oder Planung-Tab verlassen, sofortige Datensicherung erzwingen
    if ((activeModule === 'zeugnis' || activeModule === 'planung') && module !== activeModule) {
        console.log(`showModule: Verlasse Modul "${activeModule}". Erzwungener Cloud-Upload gestartet.`);
        if (typeof window.saveDataToCloud === 'function') {
            window.saveDataToCloud();
        }
    }

    // Wenn zum Zeugnis- oder Planung-Tab gewechselt wird, erst einmal die neuesten Daten aus der Cloud erzwingen
    if (module === 'zeugnis' || module === 'planung') {
        if (typeof window.forceRefreshFromCloud === 'function') {
            console.log(`showModule: Modul "${module}" aktiviert. Erzwungener Cloud-Sync gestartet.`);
            
            window.forceRefreshFromCloud().then(() => {
                console.log(`showModule: Refresh beendet, Ansicht für "${module}" wird aktualisiert.`);
                
                // Fokus-Verlust Schutz: Wenn der Nutzer bereits in ein Eingabefeld geklickt hat,
                // überspringen wir das erneute Rendern, um ihn beim Schreiben/Fokussieren nicht zu stören.
                const activeEl = document.activeElement;
                const isUserTyping = activeEl && (
                    (module === 'zeugnis' && typeof isZeugnisNotesTextarea === 'function' && isZeugnisNotesTextarea(activeEl)) ||
                    (module === 'planung' && activeEl.classList && activeEl.classList.contains('planung-inhalt-input'))
                );
                
                if (isUserTyping) {
                    console.log(`showModule: Nutzer editiert bereits in "${module}". Re-Render nach Cloud-Refresh übersprungen.`);
                    return;
                }

                if (module === 'planung') {
                    loadPlanung();
                }
                if (typeof renderModuleContent === 'function') {
                    renderModuleContent();
                }
            });
        } else {
            if (module === 'planung') {
                loadPlanung();
            }
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

    if (shouldPushState) {
        history.pushState({ page: currentPage, classId: activeClassId, module: module, toolWindow: null }, '');
    }
}

function isZeugnisNotesTextarea(element) {
    return !!(element &&
        (element.tagName === 'TEXTAREA' || element.tagName === 'DIV') &&
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
            // Kurze Verzögerung, damit der Browser den Workspace einblendet und getBoundingClientRect() korrekt misst.
            setTimeout(renderSitzplanModule, 50);
            break;
        case 'planung':
            // Klassen-Tab zeigt ausschließlich die Unterrichtsplanung (Listenansicht).
            // Die Kalenderansicht lebt jetzt im globalen Kalender-Fenster.
            AppState.planungViewMode = 'list';
            renderPlanung();
            break;
        case 'kontakte':
            renderContactsModule();
            break;
        case 'zeugnis-texte':
            renderZeugnisTTexteModule();
            break;
    }
}

// ===== Globale Werkzeuge: Tool-Fenster (Kalender, Adressbuch, Zeugnistexte) =====
// Die drei übergreifenden Bereiche werden einmalig aus dem Klassen-Layout in ein
// eigenständiges Overlay-Fenster verschoben und nur noch über die Startleisten-Symbole geöffnet.
function initToolWindows() {
    const body = document.getElementById('tool-window-body');
    if (!body || body._toolInit) return;
    body._toolInit = true;

    // Adressbuch- und Zeugnistexte-Modul ins Fenster verschieben
    ['kontakte-module', 'zeugnis-texte-module'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('module');
            el.classList.add('tool-window-panel');
            el.style.display = '';
            body.appendChild(el);
        }
    });

    // Kalenderansicht ins Kalender-Fenster einhängen (Unterrichtsplanung bleibt in der Klasse)
    const calHost = document.getElementById('kalender-window-calendar-host');
    const calContainer = document.getElementById('planung-calendar-container');
    if (calHost && calContainer) {
        calContainer.style.display = 'block';
        calHost.appendChild(calContainer);
    }
}

function openToolWindow(which, shouldPushState = true) {
    initToolWindows();
    const overlay = document.getElementById('tool-window-overlay');
    if (!overlay) return;
    if (shouldPushState) rememberCurrentHistoryScroll();

    overlay.querySelectorAll('.tool-window-panel').forEach(p => p.classList.remove('active'));

    let panel = null;
    if (which === 'kalender') {
        panel = document.getElementById('kalender-window-panel');
        prepareKalenderWindow();
    } else if (which === 'kontakte') {
        panel = document.getElementById('kontakte-module');
        if (typeof renderContactsModule === 'function') renderContactsModule();
    } else if (which === 'zeugnis-texte') {
        panel = document.getElementById('zeugnis-texte-module');
        if (typeof renderZeugnisTTexteModule === 'function') renderZeugnisTTexteModule();
    } else if (which === 'stundenplan') {
        panel = document.getElementById('stundenplan-module');
        if (typeof renderStundenplanModule === 'function') renderStundenplanModule();
    }
    if (!panel) return;

    panel.classList.add('active');
    window._activeToolWindow = which;
    window._toolWindowOrigin = currentPage;

    const titleEl = document.getElementById('tool-window-title');
    if (titleEl) {
        const titles = { kalender: 'Kalender', stundenplan: 'Stundenplan', kontakte: 'Adressbuch', 'zeugnis-texte': 'Zeugnistexte (Inklusion)' };
        titleEl.textContent = titles[which] || '';
    }

    overlay.classList.add('open');

    // Eine evtl. noch nachlaufende Startseiten-Scroll-Wiederherstellung abbrechen.
    // Sonst scrollt einer ihrer Timer (bis ~900 ms) das gerade geöffnete
    // Dokument-Scroll-Tool-Fenster nach unten und schiebt die Startleiste raus.
    window._dashboardScrollRestore = null;

    if (shouldPushState) {
        history.pushState({ page: currentPage, classId: activeClassId, module: activeModule, toolWindow: which }, '');
    }

    // Kalender & Adressbuch laufen im normalen Dokument-Scroll (wie die übrigen
    // Seiten), damit Safari die obere Leiste durchscheinen lässt. Der
    // Zeugnisgenerator bleibt ein fixiertes Vollbild mit gesperrtem Body-Scroll.
    const docScroll = (which === 'kalender' || which === 'stundenplan' || which === 'kontakte' || which === 'zeugnis-texte');
    const container = document.querySelector('.container');
    if (docScroll) {
        overlay.classList.add('doc-scroll');
        if (container) container.classList.add('tool-doc-scroll');
        window.scrollTo(0, 0);
    } else {
        overlay.classList.remove('doc-scroll');
        if (container) container.classList.remove('tool-doc-scroll');
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
    }

    const wbody = document.getElementById('tool-window-body');
    if (wbody) wbody.scrollTop = 0;
}

function closeToolWindow(options = {}) {
    const resetScroll = options.resetScroll !== false;
    const overlay = document.getElementById('tool-window-overlay');
    if (!overlay) return;

    // Generator-Entwurf beim Schließen in die Cloud sichern (no-op, wenn unverändert)
    if (window._activeToolWindow === 'zeugnis-texte' && typeof ztSyncDraftToCloud === 'function') {
        ztSyncDraftToCloud();
    }

    // Offene Zeugnis-/Kalender-Daten sichern (analog zum Modulwechsel)
    if (typeof window.saveDataToCloud === 'function' && window.firebaseAuth && window.firebaseAuth.currentUser) {
        window.saveDataToCloud();
    }

    const wasDocScroll = overlay.classList.contains('doc-scroll');
    overlay.classList.remove('open');
    overlay.classList.remove('doc-scroll');
    const container = document.querySelector('.container');
    if (container) container.classList.remove('tool-doc-scroll');
    window._activeToolWindow = null;

    // Beim Dokument-Scroll-Fenster den Seiten-Scroll zurücksetzen, damit die
    // wieder eingeblendete Ausgangsseite oben beginnt.
    if (wasDocScroll && resetScroll) window.scrollTo(0, 0);

    // modal-open nur entfernen, wenn kein normales Modal mehr offen ist
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer || modalContainer.style.display === 'none') {
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
    }
}

function closeToolWindowOnBackdrop(event) {
    if (event && event.target && event.target.id === 'tool-window-overlay') {
        closeToolWindow();
    }
}

function closeToolWindowBack() {
    // Wie der Browser-Zurück: denselben popstate-Pfad nehmen. Das schließt das
    // Overlay und stellt die Scroll-Position der darunterliegenden Seite
    // (Startseite oder Klasse) wieder her – statt hart nach oben zu springen.
    if (history.state && history.state.toolWindow) {
        history.back();
    } else {
        // Fallback: kein passender Verlaufseintrag -> regulär schließen.
        closeToolWindow({ resetScroll: true });
        showPage('home');
    }
}

// ===== Such-Modal =====
let _searchModalModule = null;

function openSearchModal(module) {
    _searchModalModule = module;
    const titles = { noten: 'Schüler suchen', zeugnis: 'Schüler suchen', kontakte: 'Kontakt suchen' };
    const titleEl = document.getElementById('search-modal-title');
    if (titleEl) titleEl.textContent = titles[module] || 'Suchen';
    const input = document.getElementById('search-modal-input');
    const suggestions = document.getElementById('search-modal-suggestions');
    if (input) input.value = '';
    if (suggestions) { suggestions.innerHTML = ''; suggestions.style.display = 'block'; }
    showModal('search-modal');
    handleSearchModalInput();
    requestAnimationFrame(() => { if (input) input.focus(); });
}

function handleSearchModalInput() {
    const module = _searchModalModule;
    const input = document.getElementById('search-modal-input');
    const suggestions = document.getElementById('search-modal-suggestions');
    if (!module || !input || !suggestions) return;
    const query = input.value.toLowerCase().trim();
    suggestions.innerHTML = '';

    let items = [];
    if (module === 'kontakte') {
        items = contacts
            .map((c, i) => ({ label: c.childName || '', index: i }));
        if (query) {
            items = items.filter(c => c.label.toLowerCase().includes(query));
        }
    } else {
        const students = (classes[activeClassId] && classes[activeClassId].students) ? classes[activeClassId].students : [];
        items = students
            .map((s, i) => ({ label: s.name, index: i }));
        if (query) {
            items = items.filter(s => s.label.toLowerCase().includes(query));
        }
    }

    if (items.length === 0) {
        const li = document.createElement('li');
        li.className = 'no-results';
        li.textContent = module === 'kontakte' ? 'Keine Kontakte gefunden' : 'Keine Schüler gefunden';
        suggestions.appendChild(li);
    } else {
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.label;
            li.onclick = () => selectFromSearchModal(item.index);
            suggestions.appendChild(li);
        });
    }
    suggestions.style.display = 'block';
}

function handleSearchModalKeydown(event) {
    const suggestions = document.getElementById('search-modal-suggestions');
    if (!suggestions) return;
    const items = Array.from(suggestions.querySelectorAll('li:not(.no-results)'));
    if (items.length === 0) return;
    const currentIndex = items.findIndex(li => li.classList.contains('highlighted'));
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = currentIndex + 1 < items.length ? currentIndex + 1 : 0;
        if (currentIndex !== -1) items[currentIndex].classList.remove('highlighted');
        items[next].classList.add('highlighted');
        items[next].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = currentIndex - 1 >= 0 ? currentIndex - 1 : items.length - 1;
        if (currentIndex !== -1) items[currentIndex].classList.remove('highlighted');
        items[prev].classList.add('highlighted');
        items[prev].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
        event.preventDefault();
        const target = currentIndex !== -1 ? items[currentIndex] : items[0];
        if (target) target.click();
    }
}

function selectFromSearchModal(index) {
    const module = _searchModalModule;
    _searchModalModule = null;
    hideModal();
    if (module === 'kontakte') {
        setTimeout(() => {
            const contact = contacts[index];
            if (!contact) return;
            const rows = document.querySelectorAll('#contacts-table-body tr');
            for (const row of rows) {
                if (row.textContent.includes(contact.childName || '')) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.style.backgroundColor = '#e3f2fd';
                    setTimeout(() => { row.style.backgroundColor = ''; }, 2000);
                    break;
                }
            }
        }, 200);
    } else {
        selectStudent(module, index);
    }
}

// Globalen Kalender-Zeitraum laden (klassenübergreifend) – auch ohne aktive Klasse nutzbar
function loadGlobalCalendarRange() {
    if (!AppState.planung) {
        AppState.planung = { startDate: '', endDate: '', selectedDays: [], entries: {}, hiddenTermine: [] };
    }
    if (!AppState.planung.entries) AppState.planung.entries = {};
    if (!AppState.planung.hiddenTermine) AppState.planung.hiddenTermine = [];

    let range = { startDate: '', endDate: '' };
    try {
        const s = localStorage.getItem('planung_global_calendar_range');
        if (s) range = JSON.parse(s);
    } catch (e) {
        console.warn("Fehler beim Laden von planung_global_calendar_range:", e);
    }

    AppState.planung.calendarStartDate = range.startDate || '';
    AppState.planung.calendarEndDate = range.endDate || '';

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (localStorage.getItem('calendarLastLoadedDay') !== todayStr) {
        AppState.planung.calendarStartDate = todayStr;
        localStorage.setItem('calendarLastLoadedDay', todayStr);
        localStorage.setItem('planung_global_calendar_range', JSON.stringify({
            startDate: todayStr,
            endDate: AppState.planung.calendarEndDate || ''
        }));
    }
}

function prepareKalenderWindow() {
    loadGlobalCalendarRange();
    AppState.planungViewMode = 'calendar';

    const cal = document.getElementById('planung-calendar-container');
    if (cal) cal.style.display = 'block';

    const p = AppState.planung || {};
    const startEl = safeGetElement('planung-start-date');
    const endEl = safeGetElement('planung-end-date');
    if (startEl) {
        if (startEl._flatpickr) startEl._flatpickr.setDate(p.calendarStartDate || '', false);
        else startEl.value = p.calendarStartDate || '';
    }
    if (endEl) {
        if (endEl._flatpickr) endEl._flatpickr.setDate(p.calendarEndDate || '', false);
        else endEl.value = p.calendarEndDate || '';
    }

    if (typeof renderPlanungCalendar === 'function') renderPlanungCalendar();
}

// ===== ICS-Kalender-Import (zentrale Termine) =====
function triggerIcsImport() {
    const input = document.getElementById('ics-import-input');
    if (input) input.click();
}

function unescapeIcs(s) {
    return String(s == null ? '' : s)
        .replace(/\\n/gi, ' ')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\')
        .trim();
}

function parseIcsDate(value) {
    // Akzeptiert: 20260612 | 20260612T100000 | 20260612T100000Z
    const m = String(value).match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/);
    if (!m) return null;
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    const time = (m[4] && m[5]) ? `${m[4]}:${m[5]}` : '';
    return { date, time };
}

function parseIcs(text) {
    // Gefaltete Zeilen (Fortsetzung beginnt mit Space/Tab) zusammenführen
    const rawLines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const lines = [];
    for (const line of rawLines) {
        if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
            lines[lines.length - 1] += line.slice(1);
        } else {
            lines.push(line);
        }
    }

    const events = [];
    let cur = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === 'BEGIN:VEVENT') { cur = {}; continue; }
        if (trimmed === 'END:VEVENT') {
            if (cur && cur.date) events.push(cur);
            cur = null;
            continue;
        }
        if (!cur) continue;
        const ci = line.indexOf(':');
        if (ci === -1) continue;
        const key = line.slice(0, ci).split(';')[0].toUpperCase();
        const value = line.slice(ci + 1);
        if (key === 'SUMMARY') {
            cur.title = unescapeIcs(value);
        } else if (key === 'DTSTART') {
            const dt = parseIcsDate(value);
            if (dt) { cur.date = dt.date; cur.timeStart = dt.time; }
        } else if (key === 'DTEND') {
            const dt = parseIcsDate(value);
            if (dt) { cur.timeEnd = dt.time; }
        }
    }
    return events;
}

function importIcsFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // Reset, damit dieselbe Datei erneut wählbar ist
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        let parsed;
        try {
            parsed = parseIcs(e.target.result);
        } catch (err) {
            console.error('ICS-Parse-Fehler:', err);
            swal('Fehler', 'Die Datei konnte nicht gelesen werden. Ist es eine gültige .ics-Datei?', 'error');
            return;
        }

        if (!parsed.length) {
            swal('Keine Termine gefunden', 'In der Datei wurden keine Termine (VEVENT) gefunden.', 'warning');
            return;
        }

        if (!AppState.termine) AppState.termine = [];

        const existing = new Set(AppState.termine.map(t => `${t.date}|${(t.title || '').toLowerCase()}|${t.timeStart || ''}`));
        let added = 0;
        let skipped = 0;
        const base = Date.now();

        parsed.forEach((ev, i) => {
            if (!ev.date) { skipped++; return; }
            const key = `${ev.date}|${(ev.title || '').toLowerCase()}|${ev.timeStart || ''}`;
            if (existing.has(key)) { skipped++; return; }
            existing.add(key);
            AppState.termine.push({
                id: (base + i).toString(),
                title: ev.title || 'Termin',
                date: ev.date,
                timeStart: ev.timeStart || '',
                timeEnd: ev.timeEnd || ''
            });
            added++;
        });

        if (added > 0) {
            // Kalender-Zeitraum so erweitern, dass die importierten Termine sichtbar werden
            if (!AppState.planung) AppState.planung = { entries: {}, hiddenTermine: [] };
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (!AppState.planung.calendarStartDate) AppState.planung.calendarStartDate = todayStr;
            const maxImported = parsed.reduce((m, ev) => (ev.date && ev.date > m) ? ev.date : m, '');
            if (maxImported && maxImported > (AppState.planung.calendarEndDate || '')) {
                AppState.planung.calendarEndDate = maxImported;
            }
            localStorage.setItem('planung_global_calendar_range', JSON.stringify({
                startDate: AppState.planung.calendarStartDate,
                endDate: AppState.planung.calendarEndDate || ''
            }));

            saveTermine();

            const startEl = safeGetElement('planung-start-date');
            const endEl = safeGetElement('planung-end-date');
            if (startEl) {
                if (startEl._flatpickr) startEl._flatpickr.setDate(AppState.planung.calendarStartDate, false);
                else startEl.value = AppState.planung.calendarStartDate;
            }
            if (endEl) {
                if (endEl._flatpickr) endEl._flatpickr.setDate(AppState.planung.calendarEndDate || '', false);
                else endEl.value = AppState.planung.calendarEndDate || '';
            }
            if (typeof renderPlanungCalendar === 'function') renderPlanungCalendar();
        }

        const msg = `${added} Termin(e) importiert.` + (skipped ? ` ${skipped} übersprungen (Duplikat oder ohne Datum).` : '');
        swal('Import abgeschlossen', msg, added ? 'success' : 'info');
    };
    reader.onerror = function() {
        swal('Fehler', 'Datei konnte nicht gelesen werden.', 'error');
    };
    reader.readAsText(file);
}

window.triggerIcsImport = triggerIcsImport;
window.importIcsFile = importIcsFile;
window.openToolWindow = openToolWindow;
window.closeToolWindow = closeToolWindow;
window.closeToolWindowOnBackdrop = closeToolWindowOnBackdrop;
window.closeToolWindowBack = closeToolWindowBack;
window.openSearchModal = openSearchModal;
window.handleSearchModalInput = handleSearchModalInput;
window.handleSearchModalKeydown = handleSearchModalKeydown;
window.selectFromSearchModal = selectFromSearchModal;
window.initToolWindows = initToolWindows;

/* ============================================================
   Sync-Status-Kreis + Modal (ersetzt die grüne Status-Leiste)
   ============================================================ */
// Letzter bekannter Sync-Zustand (vom unsichtbaren Status-Träger gespiegelt)
window._syncState = { state: 'synced', message: 'Alle Daten aktuell', updatedAt: null };

const SYNC_CIRCLE_ICONS = {
    synced:  '<i class="fas fa-circle-check"></i>',
    syncing: '<i class="fas fa-rotate fa-spin"></i>',
    error:   '<i class="fas fa-exclamation-triangle"></i>'
};

// Aus dem (versteckten) Status-Span Zustand + Klartext ableiten und auf den Kreis spiegeln
function reflectSyncStatus() {
    const src = document.querySelector('#cloud-status-bar span');
    const circle = document.getElementById('sync-status-circle');
    if (!src) return;
    const html = src.innerHTML || '';
    const text = (src.textContent || '').trim();
    let state = 'synced';
    if (/fa-spin/.test(html)) state = 'syncing';
    else if (/text-danger|exclamation|fehler/i.test(html + ' ' + text)) state = 'error';

    window._syncState = { state, message: text || window._syncState.message, updatedAt: new Date() };

    if (circle) {
        circle.dataset.state = state;
        // Symbol im inneren Icon-Span tauschen (Label im Button bleibt erhalten)
        const iconHost = document.getElementById('sync-status-icon') || circle;
        if (iconHost.innerHTML !== SYNC_CIRCLE_ICONS[state]) {
            iconHost.innerHTML = SYNC_CIRCLE_ICONS[state];
        }
    }
    // Falls das Modal gerade offen ist, live mitaktualisieren
    if (document.getElementById('sync-status-modal')?.offsetParent !== null) {
        renderSyncModalBody();
    }
}

function initSyncStatusMirror() {
    const src = document.querySelector('#cloud-status-bar span');
    if (!src || src._syncMirror) return;
    src._syncMirror = true;
    const obs = new MutationObserver(reflectSyncStatus);
    obs.observe(src, { childList: true, characterData: true, subtree: true });
    reflectSyncStatus();
}

function syncStateLabel(state) {
    if (state === 'syncing') return 'Synchronisiere…';
    if (state === 'error') return 'Synchronisierungsproblem';
    return 'Alle Daten aktuell';
}

function renderSyncModalBody() {
    const body = document.getElementById('sync-status-modal-body');
    if (!body) return;
    const { state, message, updatedAt } = window._syncState;
    const count = document.getElementById('sync-counter-value')?.textContent || '0';
    const timeStr = updatedAt
        ? updatedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '–';
    const detail = (message && message !== syncStateLabel(state)) ? message : '';

    body.innerHTML = `
        <div class="sync-modal-status" data-state="${state}">
            ${SYNC_CIRCLE_ICONS[state]}
            <span>${syncStateLabel(state)}</span>
        </div>
        ${detail ? `<p style="margin:-6px 2px 16px; color: var(--grey-color); font-size:0.9rem;">${detail}</p>` : ''}
        <div class="sync-modal-rows">
            <div class="sync-modal-row"><span class="label">Synchronisierungen heute</span><span class="value">${count}×</span></div>
            <div class="sync-modal-row"><span class="label">Letzte Aktualisierung</span><span class="value">${timeStr}</span></div>
        </div>
        ${state === 'error'
            ? '<p style="margin:16px 2px 0; color:#991b1b; font-size:0.88rem; text-align:center;"><i class="fas fa-circle-info"></i> Prüfe deine Internetverbindung. Deine Eingaben bleiben lokal gespeichert und werden automatisch hochgeladen, sobald die Verbindung wieder steht.</p>'
            : '<p style="margin:16px 2px 0; color: var(--grey-color); font-size:0.88rem; text-align:center;"><i class="fas fa-circle-info"></i> Alle Änderungen werden automatisch mit der Cloud synchronisiert.</p>'}
    `;
}

function openSyncModal() {
    reflectSyncStatus();
    renderSyncModalBody();
    showModal('sync-status-modal');
}

function confirmLogout() {
    if (typeof swal === 'function') {
        swal({
            title: 'Abmelden?',
            text: 'Möchtest du dich wirklich abmelden?',
            icon: 'warning',
            buttons: [false, 'Abmelden'],
            dangerMode: true
        }).then(ok => {
            if (ok && typeof window.handleLogout === 'function') window.handleLogout();
        });
    } else if (confirm('Möchtest du dich wirklich abmelden?') && typeof window.handleLogout === 'function') {
        window.handleLogout();
    }
}

window.reflectSyncStatus = reflectSyncStatus;
window.initSyncStatusMirror = initSyncStatusMirror;
window.openSyncModal = openSyncModal;
window.confirmLogout = confirmLogout;


// Modal anzeigen/verstecken
const APP_THEME_DEFAULT = '#f2f4fa';
const APP_THEME_LOGIN = '#1e293b';
const APP_THEME_MODAL = '#f2f4fa';

function setAppThemeColor(color) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', color);
}

function restoreAppThemeColor() {
    const modalOpen = !!document.querySelector('#modal-container.show, .app-dialog-overlay:not(.app-dialog-closing)');
    if (modalOpen) {
        setAppThemeColor(APP_THEME_MODAL);
    } else if (document.body.classList.contains('login-active') || document.documentElement.classList.contains('login-active')) {
        setAppThemeColor(APP_THEME_LOGIN);
    } else {
        setAppThemeColor(APP_THEME_DEFAULT);
    }
}

function showModal(modalId) {
    const modalContainer = safeGetElement('modal-container');
    if (!modalContainer) return;

    // Der alte Modal-Container liegt im Markup innerhalb der App-Fläche. Direkt
    // unter body deckt sein Backdrop auch iOS-Safe-Areas und den Root-Hintergrund ab.
    if (modalContainer.parentElement !== document.body) {
        document.body.appendChild(modalContainer);
    }

    // Scroll-Lock per position:fixed: friert den Hintergrund optisch GENAU an der
    // aktuellen Stelle ein -> kein Springen beim Öffnen/Schließen. Nur beim ersten
    // Öffnen anwenden (verschachtelte Modale nicht doppelt sperren).
    const _alreadyOpen = document.body.classList.contains('modal-open');

    // Alle Modale (inkl. Archiv im Zeugnistextgenerator) bekommen denselben
    // eingefärbten Backdrop.
    modalContainer.classList.remove('mobile-menu-active');
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');

    if (!_alreadyOpen) {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        window._preModalScrollY = y;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${y}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
    }

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
        if (targetModal.classList.contains('mitarbeit-modal') || modalId === 'search-modal') {
            targetModal.style.display = 'flex';
        } else {
            targetModal.style.display = 'block';
        }
        targetModal.setAttribute('aria-hidden', 'false');

        // Fokus auf das erste fokussierbare Element setzen.
        // preventScroll: true, damit das Fokussieren des (oben liegenden) Schließen-
        // Buttons nicht den Modal-Inhalt nach oben scrollt (sonst verliert z. B. die
        // Planungs-Liste ihre Scroll-Position beim Zurückkehren aus einem Untermodal).
        const focusableElement = targetModal.querySelector('input, button, select, textarea');
        if (focusableElement) {
            try { focusableElement.focus({ preventScroll: true }); }
            catch (e) { focusableElement.focus(); }
        }
    }

    // Sofort anzeigen (ohne Animation und ohne Verzögerung)
    modalContainer.style.display = 'flex';
    modalContainer.classList.add('show');
    modalContainer.setAttribute('aria-hidden', 'false');
    setAppThemeColor(APP_THEME_MODAL);
}

function hideModal() {
    const modalContainer = safeGetElement('modal-container');
    if (modalContainer) {
        modalContainer.classList.remove('show');
        modalContainer.setAttribute('aria-hidden', 'true');
        modalContainer.style.display = 'none';
        modalContainer.classList.remove('mobile-menu-active');
        
        // Alle Modals ausblenden
        const modals = document.querySelectorAll('.modal');
        if (modals) {
            modals.forEach(m => {
                m.setAttribute('aria-hidden', 'true');
            });
        }
    }

    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open-scroll-lock');
    document.body.classList.remove('modal-open-scroll-lock');
    restoreAppThemeColor();

    // position:fixed-Lock lösen und exakt zur vorherigen Scroll-Position springen
    // (synchron, daher kein sichtbares Springen) -> Ansicht bleibt z. B. beim
    // aktuellen Schüler im Zeugnis-Tab.
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    if (typeof window._preModalScrollY === 'number') {
        const y = window._preModalScrollY;
        window._preModalScrollY = null;
        window.scrollTo(0, y);
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

/* ============================================================
   Einheitliche Dialoge: eigener SweetAlert-Ersatz im App-Design.
   Bildet die genutzte swal()-API nach und gibt ein Promise zurück:
     swal('Titel', 'Text', 'icon')
     swal({ title, text, icon, button, buttons, dangerMode })
   buttons: [cancel, confirm] (Element false = ausgeblendet),
            { key: { text, value } } oder einzeln via button.
   ============================================================ */
const APP_DIALOG_ICONS = {
    success:  { cls: 'fa-circle-check',         color: '#16a34a' },
    error:    { cls: 'fa-circle-xmark',         color: '#e74c3c' },
    warning:  { cls: 'fa-triangle-exclamation', color: '#f39c12' },
    info:     { cls: 'fa-circle-info',          color: '#3b82f6' },
    question: { cls: 'fa-circle-question',      color: '#6b7280' }
};

let _appDialogState = null; // { overlay, resolve, keyHandler }

// Aus den Optionen die Button-Liste ableiten: [{ text, value, type }]
function _appDialogButtons(opts) {
    const danger = !!opts.dangerMode;
    const primaryType = danger ? 'danger' : 'primary';
    const list = [];

    // Einzel-Button (reiner Alert)
    if (opts.button !== undefined && opts.buttons === undefined) {
        if (opts.button === false) return list;
        const text = (typeof opts.button === 'object' && opts.button) ? (opts.button.text || 'OK')
                   : (opts.button === true ? 'OK' : String(opts.button));
        list.push({ text, value: true, type: primaryType });
        return list;
    }

    const b = opts.buttons;
    if (b === undefined) { list.push({ text: 'OK', value: true, type: primaryType }); return list; }
    if (b === true) {
        list.push({ text: 'Abbrechen', value: null, type: 'secondary' });
        list.push({ text: 'OK', value: true, type: primaryType });
        return list;
    }
    if (Array.isArray(b)) {
        const cancel = b[0];
        const confirm = b.length > 1 ? b[1] : true;
        if (cancel !== false) {
            list.push({ text: (cancel === true || cancel == null) ? 'Abbrechen' : String(cancel), value: null, type: 'secondary' });
        }
        if (confirm !== false) {
            list.push({ text: (confirm === true || confirm == null) ? 'OK' : String(confirm), value: true, type: primaryType });
        }
        return list;
    }
    if (typeof b === 'object') {
        const keys = Object.keys(b);
        keys.forEach((key, i) => {
            const cfg = b[key] || {};
            const isCancel = key === 'cancel';
            const isLast = i === keys.length - 1;
            const value = (cfg.value !== undefined) ? cfg.value : (isCancel ? null : key);
            const type = (!isCancel && (isLast || keys.length === 1)) ? primaryType : 'secondary';
            list.push({ text: cfg.text || key, html: cfg.html || '', className: cfg.className || '', title: cfg.title || '', value, type });
        });
        return list;
    }
    list.push({ text: 'OK', value: true, type: primaryType });
    return list;
}

function _closeAppDialog(value) {
    if (!_appDialogState) return;
    const { overlay, resolve, keyHandler } = _appDialogState;
    _appDialogState = null;
    document.removeEventListener('keydown', keyHandler, true);
    overlay.classList.add('app-dialog-closing');
    setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        restoreAppThemeColor();
    }, 120);
    resolve(value);
}

function swal() {
    const args = Array.prototype.slice.call(arguments);
    const opts = (args.length && typeof args[0] === 'object' && args[0] !== null)
        ? Object.assign({}, args[0])
        : { title: args[0], text: args[1], icon: args[2] };

    // Sequenziell: evtl. offenen Dialog vorher schließen
    if (_appDialogState) _closeAppDialog(null);

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';
        setAppThemeColor(APP_THEME_MODAL);

        const dialog = document.createElement('div');
        dialog.className = 'app-dialog';
        if (opts.dialogClass) dialog.classList.add(opts.dialogClass);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'app-dialog-close';
        closeBtn.setAttribute('aria-label', 'Schließen');
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => _closeAppDialog(null);
        dialog.appendChild(closeBtn);

        if (opts.icon && APP_DIALOG_ICONS[opts.icon]) {
            const ic = APP_DIALOG_ICONS[opts.icon];
            const iconEl = document.createElement('div');
            iconEl.className = 'app-dialog-icon';
            iconEl.style.color = ic.color;
            iconEl.innerHTML = `<i class="fas ${ic.cls}"></i>`;
            dialog.appendChild(iconEl);
        }
        if (opts.title) {
            const t = document.createElement('h2');
            t.className = 'app-dialog-title';
            t.textContent = opts.title;
            dialog.appendChild(t);
        }
        if (opts.text) {
            const p = document.createElement('p');
            p.className = 'app-dialog-text';
            p.textContent = opts.text;
            dialog.appendChild(p);
        }

        const btnRow = document.createElement('div');
        btnRow.className = 'app-dialog-buttons';
        _appDialogButtons(opts).forEach(desc => {
            const button = document.createElement('button');
            button.type = 'button';
            const typeClass = desc.type === 'danger' ? 'btn-danger' : (desc.type === 'secondary' ? 'btn-secondary' : 'btn-primary');
            button.className = `btn ${typeClass}${desc.className ? ' ' + desc.className : ''}`;
            if (desc.title) button.title = desc.title;
            if (desc.html) button.innerHTML = desc.html;
            else button.textContent = desc.text;
            button.onclick = () => _closeAppDialog(desc.value);
            btnRow.appendChild(button);
        });
        dialog.appendChild(btnRow);

        overlay.appendChild(dialog);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) _closeAppDialog(null); });

        const keyHandler = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); _closeAppDialog(null); }
            else if (e.key === 'Enter') {
                const primary = btnRow.querySelector('.btn-primary, .btn-danger') || btnRow.lastElementChild;
                if (primary) { e.preventDefault(); primary.click(); }
            }
        };
        document.addEventListener('keydown', keyHandler, true);

        document.body.appendChild(overlay);
        _appDialogState = { overlay, resolve, keyHandler };

        const focusBtn = btnRow.querySelector('.btn-primary, .btn-danger') || btnRow.firstElementChild;
        if (focusBtn) setTimeout(() => focusBtn.focus(), 30);
    });
}
swal.close = function(value) { _closeAppDialog(value === undefined ? null : value); };
window.swal = swal;

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
        if (typeof ztPlanungSyncClassTeacherCourse === 'function') {
            ztPlanungSyncClassTeacherCourse();
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

function normalizeClassTeacherFlags(preferredIndex = null) {
    if (!Array.isArray(classes)) return;
    let keeper = null;
    if (preferredIndex !== null && classes[preferredIndex] && classes[preferredIndex].classTeacher) {
        keeper = preferredIndex;
    }
    classes.forEach((cls, index) => {
        if (!cls) return;
        cls.classTeacher = !!cls.classTeacher;
        if (cls.classTeacher && keeper === null) keeper = index;
    });
    classes.forEach((cls, index) => {
        if (cls) cls.classTeacher = index === keeper;
    });
}

function setSingleClassTeacher(classIndex, enabled) {
    if (!Array.isArray(classes)) return;
    classes.forEach((cls, index) => {
        if (cls) cls.classTeacher = enabled && index === classIndex;
    });
}

async function confirmClassTeacherSwitch(targetName, targetIndex = null) {
    const currentIndex = Array.isArray(classes) ? classes.findIndex(cls => cls && cls.classTeacher) : -1;
    if (currentIndex < 0 || currentIndex === targetIndex) return true;
    if (typeof swal !== 'function') return true;

    const currentName = classes[currentIndex]?.name || 'die bisherige Klasse';
    return !!(await swal({
        title: 'Klassenlehrer wechseln?',
        text: `Bisher ist „${currentName}" als Klassenlehrer-Klasse markiert. Möchtest du stattdessen „${targetName}" verwenden?`,
        icon: 'warning',
        buttons: [false, 'Wechseln'],
        dangerMode: true
    }));
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
                    cls.classTeacher = !!cls.classTeacher;
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
                                    if (Object.prototype.hasOwnProperty.call(project, 'signatureProvided')) {
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
                normalizeClassTeacherFlags();
            } else {
                console.warn('Geladene Klassendaten sind kein Array, verwende leere Daten');
                classes = [];
            }
        }

        // Lade Kontakte und Notizen ebenfalls
        const savedContacts = localStorage.getItem('contacts');
        if (savedContacts) {
            contacts = JSON.parse(savedContacts);
            AppState.contacts = contacts;
            window.contacts = contacts;
        }

        const savedNotes = localStorage.getItem('dashboardNotes');
        if (savedNotes) {
            dashboardNotes = JSON.parse(savedNotes);
            AppState.dashboardNotes = dashboardNotes;
            window.dashboardNotes = dashboardNotes;
        }
    } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
        // Fallback: Leere Daten verwenden
        classes = [];
        if (typeof swal !== 'undefined') {
            swal('Warnung', 'Daten konnten nicht geladen werden. Neue Sitzung wird gestartet.', 'warning');
        }
    }

    // Zustands-Wiederherstellung entfernt für bessere Synchronisations-Stabilität beim Start.
    // Wir starten bei jedem Neuladen immer auf der Startseite – der initiale Render
    // passiert aber erst in DOMContentLoaded, NACHDEM auch Termine und Planung geladen
    // sind. Sonst rendert der Kalender zuerst ohne Termine, und diese erscheinen erst
    // nach dem Cloud-Abgleich verzögert ("Termine werden neu geladen").
}

// Startseite: Klassen-Grid rendern
function captureDashboardScrollRestore(tileScrollTop = null) {
    const scrollMap = {};
    const ztScroll = document.querySelector('#dashboard-zt-list .dashboard-zt-scroll');
    if (ztScroll) scrollMap['#dashboard-zt-list .dashboard-zt-scroll'] = ztScroll.scrollTop;
    else if (tileScrollTop !== null) scrollMap['#dashboard-zt-list .dashboard-zt-scroll'] = tileScrollTop;

    const notesScroll = document.querySelector('#dashboard-notes-list');
    if (notesScroll) scrollMap['#dashboard-notes-list'] = notesScroll.scrollTop;

    const calScroll = document.querySelector('#dashboard-calendar-list');
    if (calScroll) scrollMap['#dashboard-calendar-list'] = calScroll.scrollTop;

    window._dashboardScrollRestore = {
        x: window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
        y: window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0,
        tileScrollTop: tileScrollTop !== null ? tileScrollTop : (ztScroll ? ztScroll.scrollTop : null),
        scrollMap,
        until: Date.now() + 2000
    };
}

function applyDashboardScrollRestore() {
    const state = window._dashboardScrollRestore;
    if (!state) return;
    // Niemals den Seiten-Scroll setzen, während ein Tool-Fenster offen ist –
    // sonst würde dessen (Dokument-)Scroll verstellt und die Startleiste rausgeschoben.
    if (window._activeToolWindow) return;
    if (Date.now() > state.until) {
        window._dashboardScrollRestore = null;
        return;
    }
    if (state.scrollMap) {
        for (const [selector, scrollTop] of Object.entries(state.scrollMap)) {
            const el = document.querySelector(selector);
            if (el) el.scrollTop = scrollTop;
        }
    } else if (state.tileScrollTop !== null && state.tileScrollTop !== undefined) {
        const tileScrollEl = document.querySelector('#dashboard-zt-list .dashboard-zt-scroll');
        if (tileScrollEl) tileScrollEl.scrollTop = state.tileScrollTop;
    }
    document.documentElement.scrollTop = state.y;
    document.body.scrollTop = state.y;
    window.scrollTo(state.x, state.y);
}

// Sobald der Nutzer selbst scrollt (Rad/Touch/Tasten), die nachlaufende
// Wiederherstellung sofort abbrechen – sonst zieht sie kurz zurück = Stottern.
// (Auf 'scroll' lauschen wir bewusst NICHT, das löst ja unser eigenes scrollTo aus.)
function armDashboardScrollRestoreCancel() {
    if (window._dashboardScrollCancelArmed) return;
    window._dashboardScrollCancelArmed = true;
    let timer = null;
    const disarm = () => {
        window._dashboardScrollCancelArmed = false;
        window.removeEventListener('wheel', cancel);
        window.removeEventListener('touchmove', cancel);
        window.removeEventListener('keydown', onKey);
        if (timer) clearTimeout(timer);
    };
    const cancel = () => { window._dashboardScrollRestore = null; disarm(); };
    const onKey = (e) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(e.key)) cancel();
    };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchmove', cancel, { passive: true });
    window.addEventListener('keydown', onKey);
    timer = setTimeout(disarm, 1000);
}

function scheduleDashboardScrollRestore() {
    armDashboardScrollRestoreCancel();
    applyDashboardScrollRestore();
    requestAnimationFrame(applyDashboardScrollRestore);
    setTimeout(applyDashboardScrollRestore, 50);
    setTimeout(applyDashboardScrollRestore, 150);
    setTimeout(applyDashboardScrollRestore, 350);
    setTimeout(applyDashboardScrollRestore, 900);
}

function renderClassesGrid() {
    // Referenzen global verfügbar machen
    window.renderClassesGrid = renderClassesGrid;
    window.renderModuleContent = renderModuleContent;
    window.renderGradesModule = renderGradesModule;
    window.renderSitzplanModule = renderSitzplanModule;

    const classesGrid = safeGetElement('classes-grid');
    if (!classesGrid) return;

    // Schnellpfad: Kein visuelles Neu-Rendern wenn die auf der Startseite
    // sichtbaren Klassen-Daten identisch sind (verhindert Flash bei Sync).
    const _fp = JSON.stringify((classes || []).map(c =>
        [c.name, (c.students || []).length, !!c.classTeacher]
    ));
    if (classesGrid._classFp === _fp && classesGrid.children.length > 0) {
        return;
    }

    // Scrollpositionen und Höhe sichern, um Zucken/Springen zu verhindern
    if (typeof captureDashboardScrollRestore === 'function') {
        captureDashboardScrollRestore();
    }
    const currentHeight = classesGrid.offsetHeight;
    if (currentHeight > 0) {
        classesGrid.style.minHeight = currentHeight + 'px';
    }

    classesGrid.classList.add('masonry-prep');
    classesGrid.innerHTML = '';
    
    if (!classes || classes.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.style.gridColumn = '1 / -1'; // Spanne über alle Spalten
        emptyDiv.innerHTML = `
            <i class="fas fa-school"></i>
            <p>${t('noClasses')}</p>
            <p>${t('addNewClass')}</p>
        `;
        classesGrid.appendChild(emptyDiv);
    } else {
        classes.forEach((cls, index) => {
            // Fallback für fehlende students-Arrays
            if (!cls.students) {
                cls.students = [];
            }
            
            // Statistiken berechnen
            const studentCount = cls.students.length;
            
            const classCard = document.createElement('div');
            classCard.className = 'class-card';
            classCard.dataset.tileKey = 'class:' + cls.name;

            classCard.innerHTML = `
                <div class="class-card-header">
                    <span class="tile-head-left"><span class="tile-drag-grip" title="Verschieben"><span class="tile-drag-dots" aria-hidden="true"></span></span>${escapeHtml(cls.name)}</span>
                    <span class="tile-head-tools">
                        <button type="button" class="tile-header-action" title="Bearbeiten" onclick="event.stopPropagation(); editClass(${index})"><i class="fas fa-edit"></i></button>
                        <button type="button" class="tile-header-action" title="Duplizieren" onclick="event.stopPropagation(); showCloneModal(${index})"><i class="fas fa-copy"></i></button>
                        <button type="button" class="tile-header-action class-card-action-delete" title="Löschen" onclick="event.stopPropagation(); deleteClass(${index})"><i class="fas fa-trash"></i></button>
                    </span>
                </div>
                <div class="class-card-body">
                    <div class="module-buttons">
                        <button class="btn btn-green btn-block class-card-main-btn" onclick="showPage('class', ${index})">
                            <span class="class-card-main-label">${escapeHtml(cls.name)} (${studentCount})${cls.classTeacher ? '<span class="class-teacher-icon" title="Klassenlehrer"><i class="fas fa-chalkboard-user"></i></span>' : ''}</span>
                        </button>
                    </div>
                </div>
            `;
            
            classesGrid.appendChild(classCard);
        });
    }

    // Notizen-Kachel am Ende des Grids anhängen
    const notesCard = document.createElement('div');
    notesCard.className = 'class-card dashboard-notes-card';
    notesCard.dataset.tileKey = 'notes';
    notesCard.innerHTML = `
        <div class="class-card-header">
            <span class="tile-head-left"><span class="tile-drag-grip" title="Verschieben"><span class="tile-drag-dots" aria-hidden="true"></span></span>Notizen</span>
            <span class="tile-head-tools"><button type="button" class="tile-header-action" onclick="openDashboardNoteInput()" title="Notiz hinzufügen"><i class="fas fa-plus"></i></button><button type="button" class="tile-width-grip" title="Breite ziehen"><i class="fas fa-left-right"></i></button></span>
        </div>
        <div class="class-card-body" style="padding: 15px; display: flex; flex-direction: column; height: 100%;">
            <ul id="dashboard-notes-list" class="dashboard-notes-list" style="flex-grow: 1;">
                <!-- Hier werden die Notizen dynamisch eingefügt -->
            </ul>
        </div>
    `;
    classesGrid.appendChild(notesCard);
    
    // Notizen-Liste befüllen
    renderDashboardNotes();

    // Kalender-Kachel am Ende des Grids anhängen
    const calendarCard = document.createElement('div');
    calendarCard.className = 'class-card dashboard-calendar-card';
    calendarCard.dataset.tileKey = 'calendar';
    calendarCard.style.cursor = 'pointer';
    calendarCard.onclick = () => openToolWindow('kalender');
    calendarCard.innerHTML = `
        <div class="class-card-header">
            <span class="tile-head-left"><span class="tile-drag-grip" title="Verschieben"><span class="tile-drag-dots" aria-hidden="true"></span></span>Kalender</span>
            <span id="dashboard-calendar-today-badge" class="class-card-count">-</span>
        </div>
        <div class="class-card-body" style="padding: 15px; display: flex; flex-direction: column; height: 100%;">
            <ul id="dashboard-calendar-list" class="dashboard-calendar-list" style="flex-grow: 1;">
                <!-- Hier werden die Termine dynamisch eingefügt -->
            </ul>
        </div>
    `;
    classesGrid.appendChild(calendarCard);
    renderDashboardCalendar();

    // Stundenplan-Kachel (heutige Stunden) am Ende des Grids anhängen
    const stundenplanCard = document.createElement('div');
    stundenplanCard.className = 'class-card dashboard-stundenplan-card';
    stundenplanCard.dataset.tileKey = 'stundenplan';
    stundenplanCard.style.cursor = 'pointer';
    stundenplanCard.onclick = () => openToolWindow('stundenplan');
    stundenplanCard.innerHTML = `
        <div class="class-card-header">
            <span class="tile-head-left"><span class="tile-drag-grip" title="Verschieben"><span class="tile-drag-dots" aria-hidden="true"></span></span>Stundenplan</span>
            <span id="dashboard-sp-day" class="class-card-count">–</span>
        </div>
        <div class="class-card-body" style="padding: 12px; display: flex; flex-direction: column; flex-grow: 1;">
            <div id="dashboard-sp-list" style="flex-grow: 1; display: flex; flex-direction: column;"></div>
        </div>
    `;
    classesGrid.appendChild(stundenplanCard);
    if (typeof stundenplanRenderHomeTile === 'function') stundenplanRenderHomeTile();

    // Zeugnistexte-Kachel: Zuständigkeiten aus der Planung direkt auf der Startseite klären
    const ztPlanungCard = document.createElement('div');
    ztPlanungCard.className = 'class-card dashboard-zt-card';
    ztPlanungCard.dataset.tileKey = 'zeugnistexte';
    ztPlanungCard.innerHTML = `
        <div class="class-card-header dashboard-zt-header" onclick="if(!event.target.closest('.tile-drag-grip, .tile-width-grip')) ztPlanungOpenAtTop()">
            <span class="tile-head-left"><span class="tile-drag-grip" title="Verschieben"><span class="tile-drag-dots" aria-hidden="true"></span></span>Zeugnistexte</span>
            <span class="tile-head-tools"><span id="dashboard-zt-count" class="class-card-count">–</span><button type="button" class="tile-width-grip" title="Breite ziehen"><i class="fas fa-left-right"></i></button></span>
        </div>
        <div class="class-card-body" style="padding: 12px; display: flex; flex-direction: column; flex-grow: 1;">
            <div id="dashboard-zt-list" class="dashboard-zt-list"></div>
        </div>
    `;
    classesGrid.appendChild(ztPlanungCard);
    if (typeof renderDashboardZtPlanungTile === 'function') renderDashboardZtPlanungTile();

    // Gespeicherte Reihenfolge anwenden, dann Masonry sofort vor dem ersten sichtbaren Paint berechnen.
    applyDashboardTileOrder();
    applyDashboardTileVisibility();
    layoutDashboardMasonry();
    classesGrid.classList.remove('masonry-prep');
    
    // Nach dem Berechnen des Masonry-Layouts die temporäre Mindesthöhe wieder entfernen
    classesGrid.style.minHeight = '';
    
    initDashboardTileDnd();
    setupDashboardMasonry();
    scheduleDashboardScrollRestore();
    classesGrid._classFp = _fp;
}

// ===================================================================
// ===== Startseiten-Kacheln frei anordnen (Drag & Drop) =============
// ===================================================================
const DASHBOARD_TILE_ORDER_KEY = 'dashboardTileOrder';
const DASHBOARD_TILE_VISIBILITY_KEY = 'dashboardTileVisibilityLocal';
const DASHBOARD_TILE_WIDTH_KEY = 'dashboardTileWidthLocalV2';

function getDashboardTileVisibility() {
    try {
        const obj = JSON.parse(localStorage.getItem(DASHBOARD_TILE_VISIBILITY_KEY) || '{}');
        return obj && typeof obj === 'object' ? obj : {};
    } catch (e) {
        return {};
    }
}

function saveDashboardTileVisibility(settings) {
    localStorage.setItem(DASHBOARD_TILE_VISIBILITY_KEY, JSON.stringify(settings || {}));
}

function getDashboardTileWidths() {
    try {
        const obj = JSON.parse(localStorage.getItem(DASHBOARD_TILE_WIDTH_KEY) || '{}');
        return obj && typeof obj === 'object' ? obj : {};
    } catch (e) {
        return {};
    }
}

function saveDashboardTileWidths(widths) {
    localStorage.setItem(DASHBOARD_TILE_WIDTH_KEY, JSON.stringify(widths || {}));
}

function dashboardSetTileWidth(key, span) {
    if (key !== 'notes' && key !== 'zeugnistexte') return;
    const widths = getDashboardTileWidths();
    const grid = safeGetElement('classes-grid');
    const columns = grid ? dashboardColumnCount(grid) : 12;
    const minSpan = grid ? dashboardBaseTileSpan(grid) : 3;
    widths[key] = Math.max(minSpan, Math.min(columns, Number(span) || minSpan));
    saveDashboardTileWidths(widths);
    layoutDashboardMasonry();
}

function dashboardTileDefinitions() {
    const defs = [];
    (classes || []).forEach(cls => {
        const name = cls && cls.name ? String(cls.name) : 'Klasse';
        defs.push({
            key: 'class:' + name,
            label: name,
            group: 'Klassen',
            icon: 'fa-school'
        });
    });
    return defs.concat([
        { key: 'notes', label: 'Notizen', group: 'Kacheln', icon: 'fa-list-check' },
        { key: 'calendar', label: 'Kalender', group: 'Kacheln', icon: 'fa-calendar-alt' },
        { key: 'stundenplan', label: 'Stundenplan', group: 'Kacheln', icon: 'fa-clock' },
        { key: 'zeugnistexte', label: 'Zeugnistexte', group: 'Kacheln', icon: 'fa-list-check' }
    ]);
}

function applyDashboardTileVisibility() {
    const grid = safeGetElement('classes-grid');
    if (!grid) return;
    const visibility = getDashboardTileVisibility();
    Array.from(grid.children).forEach(card => {
        const key = card.dataset && card.dataset.tileKey;
        if (!key) return;
        card.classList.toggle('dashboard-tile-hidden', visibility[key] === false);
    });
}

function openDashboardTileSettings() {
    renderDashboardTileSettings();
    showModal('dashboard-tile-settings-modal');
}

function renderDashboardTileSettings() {
    const list = safeGetElement('dashboard-tile-settings-list');
    if (!list) return;
    const visibility = getDashboardTileVisibility();
    const defs = dashboardTileDefinitions();
    let lastGroup = '';
    list.innerHTML = defs.map(def => {
        const checked = visibility[def.key] !== false;
        const group = def.group !== lastGroup
            ? `<div class="dashboard-tile-settings-group">${escapeHtml(def.group)}</div>`
            : '';
        lastGroup = def.group;
        return `${group}
            <label class="dashboard-tile-settings-row">
                <span class="dashboard-tile-settings-name">
                    <i class="fas ${escapeHtml(def.icon)}"></i>
                    ${escapeHtml(def.label)}
                </span>
                <input type="checkbox" ${checked ? 'checked' : ''} onchange="dashboardTileSettingsToggle('${spJsAttr(def.key)}', this.checked)">
            </label>`;
    }).join('');
}

function dashboardTileSettingsToggle(key, visible) {
    const settings = getDashboardTileVisibility();
    if (visible) delete settings[key];
    else settings[key] = false;
    saveDashboardTileVisibility(settings);
    applyDashboardTileVisibility();
    layoutDashboardMasonry();
}

function dashboardTileSettingsShowAll() {
    saveDashboardTileVisibility({});
    renderDashboardTileSettings();
    applyDashboardTileVisibility();
    layoutDashboardMasonry();
}

function getDashboardTileOrder() {
    try {
        const arr = JSON.parse(localStorage.getItem(DASHBOARD_TILE_ORDER_KEY) || '[]');
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

function saveDashboardTileOrder() {
    const grid = safeGetElement('classes-grid');
    if (!grid) return;
    const order = Array.from(grid.children)
        .map(el => el.dataset && el.dataset.tileKey)
        .filter(Boolean);
    localStorage.setItem(DASHBOARD_TILE_ORDER_KEY, JSON.stringify(order));
}

// Karten gemäß gespeicherter Reihenfolge umsortieren; neue/unbekannte Kacheln ans Ende
function applyDashboardTileOrder() {
    const grid = safeGetElement('classes-grid');
    if (!grid) return;
    const order = getDashboardTileOrder();
    if (!order.length) return;
    const cards = Array.from(grid.children).filter(el => el.dataset && el.dataset.tileKey);
    const byKey = new Map();
    cards.forEach(c => byKey.set(c.dataset.tileKey, c));
    order.forEach(key => {
        const el = byKey.get(key);
        if (el) { grid.appendChild(el); byKey.delete(key); }
    });
    // übrig gebliebene (neue) Kacheln behalten ihre relative Reihenfolge
    cards.forEach(c => { if (byKey.has(c.dataset.tileKey)) grid.appendChild(c); });
}

let _tileDrag = null;
let _tileWidthDrag = null;
let _dashboardTileWidthPreview = null;
const TILE_VGAP = 15; // gewünschter vertikaler Abstand zwischen Kacheln

function tileRowSpan(grid, height) {
    const rowH = parseFloat(getComputedStyle(grid).gridAutoRows) || 1;
    return Math.max(1, Math.ceil((height + TILE_VGAP) / rowH));
}

function dashboardTileHeight(grid) {
    const raw = getComputedStyle(grid).getPropertyValue('--dashboard-tile-height').trim();
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
}

function dashboardClassTileHeight(grid) {
    const raw = getComputedStyle(grid).getPropertyValue('--dashboard-class-tile-height').trim();
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : dashboardTileHeight(grid) / 2;
}

function isClassTile(item) {
    return !!(item && item.dataset && typeof item.dataset.tileKey === 'string'
        && item.dataset.tileKey.indexOf('class:') === 0);
}

function dashboardBaseTileSpan(grid) {
    const raw = getComputedStyle(grid).getPropertyValue('--dashboard-base-span').trim();
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function dashboardColumnCount(grid) {
    const columns = getComputedStyle(grid).gridTemplateColumns;
    if (!columns || columns === 'none') return 1;
    return columns.split(/\s+/).filter(Boolean).length || 1;
}

function dashboardColumnWidth(grid) {
    const columns = dashboardColumnCount(grid);
    if (columns <= 1) return grid.getBoundingClientRect().width || 1;
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    return (grid.getBoundingClientRect().width - gap * (columns - 1)) / columns;
}

function dashboardCurrentTileSpan(card) {
    const match = String(card.style.gridColumn || '').match(/span\s+(\d+)/);
    return match ? Math.max(1, parseInt(match[1], 10) || 1) : 1;
}

function dashboardEffectiveTileWidths() {
    return Object.assign({}, getDashboardTileWidths(), _dashboardTileWidthPreview || {});
}

// Wie viele Spalten breit eine Kachel ist (Klassen = Basisbreite, Notizen/Zeugnis-
// texte dürfen breiter sein – gespeichert oder als Standard doppelt breit).
function computeTileColSpan(item, columns, baseSpan, widths) {
    const key = item.dataset.tileKey;
    const canBeWide = item.classList.contains('dashboard-notes-card') || item.classList.contains('dashboard-zt-card');
    let colSpan = Math.min(baseSpan, columns);
    if (canBeWide && columns > baseSpan) {
        if (widths[key]) {
            colSpan = Math.max(baseSpan, Math.min(columns, Number(widths[key]) || baseSpan));
        } else {
            colSpan = columns >= baseSpan * 2 ? baseSpan * 2 : baseSpan;
        }
    }
    return colSpan;
}

// Höhe einer Klassen-Kachel in Raster-Reihen = 1 "Slot". Eine volle Dashboard-
// Kachel ist genau 2 Slots hoch. So rastet alles auf demselben Slot-Gitter ein.
function dashboardSlotRows(grid) {
    return tileRowSpan(grid, dashboardClassTileHeight(grid));
}

function tileSlotSpan(item) {
    return isClassTile(item) ? 1 : 2;
}

// Freies Platzieren ist nur sinnvoll, wenn mehr Spalten als eine Kachelbreite da
// sind. Auf schmalen Bildschirmen (Handy: Basisbreite = Spaltenzahl) fällt das
// Layout auf einfaches Untereinander-Stapeln zurück.
function dashboardIsFreeMode(grid) {
    return dashboardColumnCount(grid) > dashboardBaseTileSpan(grid);
}

function visibleDashboardTiles(grid) {
    return Array.from(grid.children).filter(item =>
        item.dataset && item.dataset.tileKey
        && !item.classList.contains('tile-placeholder')
        && !item.classList.contains('dashboard-tile-hidden'));
}

const DASHBOARD_TILE_POS_KEY = 'dashboardTilePosLocalV1';

function getDashboardTilePositions() {
    try {
        const obj = JSON.parse(localStorage.getItem(DASHBOARD_TILE_POS_KEY) || '{}');
        return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
}

function saveDashboardTilePositions(pos) {
    localStorage.setItem(DASHBOARD_TILE_POS_KEY, JSON.stringify(pos || {}));
}

function dashboardSetTilePosition(key, col, slot) {
    if (!key) return;
    const pos = getDashboardTilePositions();
    pos[key] = { col: Math.max(1, Math.round(col)), slot: Math.max(0, Math.round(slot)) };
    saveDashboardTilePositions(pos);
    // Reihenfolge fürs Handy (Stapel-Fallback) aus den Positionen ableiten.
    syncDashboardOrderFromPositions();
}

// Aus den freien Positionen eine lineare Reihenfolge (oben→unten, links→rechts)
// ableiten und speichern – damit die schmale Handy-Ansicht der Anordnung folgt.
function syncDashboardOrderFromPositions() {
    const grid = safeGetElement('classes-grid');
    if (!grid) return;
    const pos = getDashboardTilePositions();
    const tiles = visibleDashboardTiles(grid).slice();
    tiles.sort((a, b) => {
        const pa = pos[a.dataset.tileKey] || { slot: 9999, col: 9999 };
        const pb = pos[b.dataset.tileKey] || { slot: 9999, col: 9999 };
        return (pa.slot - pb.slot) || (pa.col - pb.col);
    });
    localStorage.setItem(DASHBOARD_TILE_ORDER_KEY, JSON.stringify(tiles.map(t => t.dataset.tileKey)));
}

// Belegungsraster: occ[slot][col-1] = true, wächst nach unten bei Bedarf.
function makeTileOccupancy(columns) {
    const occ = [];
    const ensure = (s) => { while (occ.length <= s) occ.push(new Array(columns).fill(false)); };
    return {
        rows: () => occ.length,
        fits(col, slot, cspan, sspan) {
            if (col < 1 || col + cspan - 1 > columns || slot < 0) return false;
            for (let s = slot; s < slot + sspan; s++) {
                ensure(s);
                for (let c = col; c < col + cspan; c++) if (occ[s][c - 1]) return false;
            }
            return true;
        },
        mark(col, slot, cspan, sspan) {
            for (let s = slot; s < slot + sspan; s++) {
                ensure(s);
                for (let c = col; c < col + cspan; c++) occ[s][c - 1] = true;
            }
        }
    };
}

function layoutDashboardMasonry() {
    _masonryRaf = null;
    if (_tileDrag) return;
    const grid = safeGetElement('classes-grid');
    if (!grid) return;

    const columns = dashboardColumnCount(grid);
    const baseSpan = dashboardBaseTileSpan(grid);
    const tiles = visibleDashboardTiles(grid);

    if (!dashboardIsFreeMode(grid)) {
        // Schmaler Bildschirm: klassisches Untereinander-Stapeln (Reihenfolge zählt).
        grid.style.gridAutoFlow = '';
        const fullSpan = tileRowSpan(grid, dashboardTileHeight(grid));
        const classSpan = tileRowSpan(grid, dashboardClassTileHeight(grid));
        tiles.forEach(item => {
            item.style.minHeight = '';
            item.style.gridColumn = 'span ' + Math.min(baseSpan, columns);
            item.style.gridRow = '';
            item.style.gridRowEnd = 'span ' + (isClassTile(item) ? classSpan : fullSpan);
        });
        return;
    }

    // Freies Raster: jede Kachel bekommt eine explizite Spalten-/Slot-Position.
    grid.style.gridAutoFlow = 'row'; // kein dichtes Auffüllen -> Lücken bleiben erhalten
    const slotRows = dashboardSlotRows(grid);
    const widths = dashboardEffectiveTileWidths();
    const positions = getDashboardTilePositions();
    const occ = makeTileOccupancy(columns);

    const place = (item, col, slot) => {
        item.style.minHeight = '';
        item.style.gridColumn = col + ' / span ' + item._cspan;
        item.style.gridRow = (slot * slotRows + 1) + ' / span ' + (item._sspan * slotRows);
        occ.mark(col, slot, item._cspan, item._sspan);
    };

    // Spannen vorberechnen.
    tiles.forEach(item => {
        item._cspan = computeTileColSpan(item, columns, baseSpan, widths);
        item._sspan = tileSlotSpan(item);
    });

    // 1. Durchgang: gespeicherte Positionen anwenden (an die Spaltenzahl geklemmt).
    // Sortierung nach (slot, col) stellt sicher, dass frühere Positionen zuerst
    // bedient werden und keine spätere Kachel eine frühere verdrängt.
    // Mit Kollisionsprüfung – kollidierende Kacheln landen im zweiten Durchgang.
    const tilesForFirstPass = tiles.slice().sort((a, b) => {
        const pa = positions[a.dataset.tileKey];
        const pb = positions[b.dataset.tileKey];
        if (!pa && !pb) return 0;
        if (!pa) return 1;
        if (!pb) return -1;
        return pa.slot !== pb.slot ? pa.slot - pb.slot : pa.col - pb.col;
    });
    const deferred = [];
    tilesForFirstPass.forEach(item => {
        const p = positions[item.dataset.tileKey];
        if (p && Number.isFinite(p.col) && Number.isFinite(p.slot)) {
            const col = Math.max(1, Math.min(columns - item._cspan + 1, p.col));
            const slot = Math.max(0, p.slot);
            if (occ.fits(col, slot, item._cspan, item._sspan)) {
                place(item, col, slot);
            } else {
                deferred.push(item);
            }
            return;
        }
        deferred.push(item);
    });

    // 2. Durchgang: kollidierende Kacheln in ihrer ursprünglichen Reihenfolge
    // platzieren und dabei am gespeicherten Slot starten, um visuelle Ordnung zu wahren.
    deferred.sort((a, b) => {
        const pa = positions[a.dataset.tileKey] || { slot: 9999, col: 9999 };
        const pb = positions[b.dataset.tileKey] || { slot: 9999, col: 9999 };
        return pa.slot !== pb.slot ? pa.slot - pb.slot : pa.col - pb.col;
    });
    deferred.forEach(item => {
        const p = positions[item.dataset.tileKey];
        const startSlot = p ? Math.max(0, p.slot) : 0;
        for (let slot = startSlot; slot < startSlot + 1000; slot++) {
            let placed = false;
            for (let col = 1; col + item._cspan - 1 <= columns; col++) {
                if (occ.fits(col, slot, item._cspan, item._sspan)) { place(item, col, slot); placed = true; break; }
            }
            if (placed) break;
        }
    });
}

let _tileResizeObserver = null;
let _masonryRaf = null;

function setupDashboardMasonry() {
    if (_masonryRaf) cancelAnimationFrame(_masonryRaf);
    _masonryRaf = requestAnimationFrame(layoutDashboardMasonry);
    const grid = safeGetElement('classes-grid');
    if (!grid) return;
    if (typeof ResizeObserver === 'undefined') {
        if (!grid._masonryResizeBound) {
            grid._masonryResizeBound = true;
            window.addEventListener('resize', () => {
                if (_masonryRaf) cancelAnimationFrame(_masonryRaf);
                _masonryRaf = requestAnimationFrame(layoutDashboardMasonry);
            });
        }
        return;
    }
    if (!_tileResizeObserver) {
        _tileResizeObserver = new ResizeObserver(() => {
            if (_masonryRaf) cancelAnimationFrame(_masonryRaf);
            _masonryRaf = requestAnimationFrame(layoutDashboardMasonry);
        });
    }
    _tileResizeObserver.disconnect();
    Array.from(grid.children).forEach(item => {
        if (item.classList && item.classList.contains('tile-placeholder')) return;
        _tileResizeObserver.observe(item);
    });
}

function initDashboardTileDnd() {
    const grid = safeGetElement('classes-grid');
    if (!grid || grid._tileDndInit) return;
    grid._tileDndInit = true;
    grid.addEventListener('pointerdown', onTileWidthPointerDown);
    grid.addEventListener('pointerdown', onTilePointerDown);
    // Klick nach einem Zug (oder direkt auf dem Griff) unterdrücken, damit z. B.
    // die Kalender-/Stundenplan-Kachel sich nicht versehentlich öffnet.
    grid.addEventListener('click', (e) => {
        if (window._suppressTileClick || (e.target.closest && e.target.closest('.tile-drag-grip, .tile-width-grip'))) {
            e.preventDefault();
            e.stopPropagation();
            window._suppressTileClick = false;
        }
    }, true);
}

function onTileWidthPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    const grip = e.target.closest && e.target.closest('.tile-width-grip');
    if (!grip) return;
    const grid = safeGetElement('classes-grid');
    const card = grip.closest('.class-card');
    if (!grid || !card) return;
    if (dashboardColumnCount(grid) <= dashboardBaseTileSpan(grid)) return;
    const key = card.dataset && card.dataset.tileKey;
    if (key !== 'notes' && key !== 'zeugnistexte') return;

    e.preventDefault();
    e.stopPropagation();

    _tileWidthDrag = {
        grid,
        card,
        key,
        startX: e.clientX,
        startSpan: dashboardCurrentTileSpan(card),
        columnWidth: dashboardColumnWidth(grid),
        pendingSpan: dashboardCurrentTileSpan(card),
        label: null,
        changed: false
    };
    _dashboardTileWidthPreview = { [key]: _tileWidthDrag.startSpan };
    card.classList.add('tile-width-resizing');
    document.body.classList.add('tile-width-resizing-active');
    _tileWidthDrag.label = document.createElement('div');
    _tileWidthDrag.label.className = 'tile-width-preview-label';
    document.body.appendChild(_tileWidthDrag.label);
    updateTileWidthPreviewLabel(_tileWidthDrag, e.clientX, e.clientY);
    window.addEventListener('pointermove', onTileWidthPointerMove, { passive: false });
    window.addEventListener('pointerup', onTileWidthPointerUp);
    window.addEventListener('pointercancel', onTileWidthPointerUp);
}

function onTileWidthPointerMove(e) {
    const d = _tileWidthDrag;
    if (!d) return;
    e.preventDefault();
    const minSpan = dashboardBaseTileSpan(d.grid);
    const maxSpan = dashboardColumnCount(d.grid);
    const deltaColumns = Math.round((e.clientX - d.startX) / Math.max(1, d.columnWidth));
    const nextSpan = Math.max(minSpan, Math.min(maxSpan, d.startSpan + deltaColumns));
    updateTileWidthPreviewLabel(d, e.clientX, e.clientY, nextSpan);
    if (nextSpan === d.pendingSpan) return;
    d.changed = true;
    d.pendingSpan = nextSpan;
    _dashboardTileWidthPreview = { [d.key]: nextSpan };
    layoutDashboardMasonry();
}

function onTileWidthPointerUp() {
    const d = _tileWidthDrag;
    if (!d) return;
    _tileWidthDrag = null;
    _dashboardTileWidthPreview = null;
    d.card.classList.remove('tile-width-resizing');
    document.body.classList.remove('tile-width-resizing-active');
    if (d.label && d.label.parentNode) d.label.parentNode.removeChild(d.label);
    window.removeEventListener('pointermove', onTileWidthPointerMove);
    window.removeEventListener('pointerup', onTileWidthPointerUp);
    window.removeEventListener('pointercancel', onTileWidthPointerUp);
    if (d.changed) dashboardSetTileWidth(d.key, d.pendingSpan);
    else layoutDashboardMasonry();
    window._suppressTileClick = true;
    setTimeout(() => { window._suppressTileClick = false; }, 80);
}

function updateTileWidthPreviewLabel(d, x, y, span = d.pendingSpan) {
    if (!d || !d.label) return;
    const columns = dashboardColumnCount(d.grid);
    d.label.textContent = `Breite ${span}/${columns}`;
    d.label.style.left = Math.min(window.innerWidth - 120, x + 14) + 'px';
    d.label.style.top = Math.max(10, y - 38) + 'px';
}

// Raster-Maße (in Pixeln) für das freie Platzieren auf der Startseite.
function dashboardGridMetrics(grid) {
    const autoRowPx = parseFloat(getComputedStyle(grid).gridAutoRows) || 2;
    const slotRows = dashboardSlotRows(grid);
    const colGap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const colW = dashboardColumnWidth(grid);
    return {
        autoRowPx,
        slotRows,
        slotH: slotRows * autoRowPx,        // Höhe eines Slots inkl. Abstand
        colGap,
        colW,
        colStride: colW + colGap,           // Spaltenbreite inkl. Abstand
        columns: dashboardColumnCount(grid)
    };
}

// Viewport-Rechteck einer Rasterposition (col 1-basiert, slot 0-basiert).
function dashboardCellRect(grid, m, col, slot, cspan, sspan) {
    const gr = grid.getBoundingClientRect();
    return {
        left: gr.left + (col - 1) * m.colStride,
        top: gr.top + slot * m.slotH,
        width: cspan * m.colW + (cspan - 1) * m.colGap,
        height: sspan * m.slotH - TILE_VGAP
    };
}

// Footprint einer bereits platzierten Kachel aus ihren Grid-Styles ableiten.
function dashboardTileFootprint(item, slotRows) {
    const colM = String(item.style.gridColumn || '').match(/(\d+)\s*\/\s*span\s+(\d+)/);
    const rowM = String(item.style.gridRow || '').match(/(\d+)\s*\/\s*span\s+(\d+)/);
    if (!colM || !rowM) return null;
    return {
        col: parseInt(colM[1], 10),
        cspan: parseInt(colM[2], 10),
        slot: Math.round((parseInt(rowM[1], 10) - 1) / slotRows),
        sspan: Math.max(1, Math.round(parseInt(rowM[2], 10) / slotRows))
    };
}

// Belegung aus dem aktuellen DOM lesen (die gezogene Kachel ausgenommen).
function dashboardOccupancyFromDom(grid, exclude, columns, slotRows) {
    const occ = makeTileOccupancy(columns);
    visibleDashboardTiles(grid).forEach(item => {
        if (item === exclude) return;
        const fp = dashboardTileFootprint(item, slotRows);
        if (fp) occ.mark(fp.col, fp.slot, fp.cspan, fp.sspan);
    });
    return occ;
}

// Wunschzelle aus der Fingerposition; ist sie belegt, die nächste freie suchen.
function dashboardResolveDropCell(d) {
    const { grid, m, cspan, sspan } = d;
    const gr = grid.getBoundingClientRect();
    const cardLeft = d.px - d.offsetX;
    const cardTop = d.py - d.offsetY;
    let col = Math.round((cardLeft - gr.left) / m.colStride) + 1;
    let slot = Math.round((cardTop - gr.top) / m.slotH);
    col = Math.max(1, Math.min(m.columns - cspan + 1, col));
    slot = Math.max(0, slot);

    const occ = dashboardOccupancyFromDom(grid, d.card, m.columns, m.slotRows);
    if (occ.fits(col, slot, cspan, sspan)) return { col, slot, free: true };

    // Ringförmig nach außen die nächste freie Position suchen.
    for (let r = 1; r <= 40; r++) {
        for (let ds = -r; ds <= r; ds++) {
            for (let dc = -r; dc <= r; dc++) {
                if (Math.max(Math.abs(ds), Math.abs(dc)) !== r) continue;
                const c = Math.max(1, Math.min(m.columns - cspan + 1, col + dc));
                const s = Math.max(0, slot + ds);
                if (occ.fits(c, s, cspan, sspan)) return { col: c, slot: s, free: true };
            }
        }
    }
    return { col, slot, free: false };
}

// Sichtbares Hilfsraster: kleine Kästchen im freien Hintergrund einblenden.
function buildDashboardCellOverlay(grid, m, totalSlots) {
    const overlay = document.createElement('div');
    overlay.className = 'tile-grid-overlay';
    overlay.style.height = (totalSlots * m.slotH) + 'px';
    for (let s = 0; s < totalSlots; s++) {
        for (let c = 0; c < m.columns; c++) {
            const cell = document.createElement('div');
            cell.className = 'tile-grid-cell';
            cell.style.left = (c * m.colStride) + 'px';
            cell.style.top = (s * m.slotH) + 'px';
            cell.style.width = m.colW + 'px';
            cell.style.height = (m.slotH - TILE_VGAP) + 'px';
            overlay.appendChild(cell);
        }
    }
    return overlay;
}

function onTilePointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    if (_tileWidthDrag || (e.target.closest && e.target.closest('.tile-width-grip'))) return;
    const grip = e.target.closest && e.target.closest('.tile-drag-grip');
    if (!grip) return;
    const grid = safeGetElement('classes-grid');
    const card = grip.closest('.class-card');
    if (!grid || !card) return;
    e.preventDefault();
    e.stopPropagation();

    // Auf schmalen Bildschirmen (Stapel-Layout) bleibt das einfache Umsortieren.
    if (!dashboardIsFreeMode(grid)) { startTileReorderDrag(e, grid, card); return; }

    const rect = card.getBoundingClientRect();
    const m = dashboardGridMetrics(grid);
    const cspan = computeTileColSpan(card, m.columns, dashboardBaseTileSpan(grid), dashboardEffectiveTileWidths());
    const sspan = tileSlotSpan(card);
    // Ausgangszelle merken (für die Tausch-Mechanik beim Ablegen auf eine Kachel).
    const originFp = dashboardTileFootprint(card, m.slotRows);

    // Hilfsraster einblenden und genug Platz zum Ablegen nach unten schaffen.
    const totalSlots = Math.max(Math.ceil(grid.scrollHeight / m.slotH) + 2, 4);
    grid.style.minHeight = (totalSlots * m.slotH) + 'px';
    const overlay = buildDashboardCellOverlay(grid, m, totalSlots);
    grid.appendChild(overlay);
    grid.classList.add('tile-grid-active');

    // Sichtbares, frei schwebendes gestricheltes Feld zeigt die Zielposition.
    const box = document.createElement('div');
    box.className = 'tile-drop-indicator';
    box.innerHTML = '<span class="tile-drop-label">Hier ablegen</span>';
    box.style.transition = 'none';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    document.body.appendChild(box);
    requestAnimationFrame(() => { box.style.transition = ''; });

    // Kachel aus dem Fluss heben und an Position fixieren (folgt dann dem Finger)
    card.classList.add('tile-dragging');
    card.style.width = rect.width + 'px';
    card.style.height = rect.height + 'px';
    card.style.left = rect.left + 'px';
    card.style.top = rect.top + 'px';
    document.body.classList.add('tile-dragging-active');

    _tileDrag = {
        grid, card, box, overlay, m, cspan, sspan,
        originCol: originFp ? originFp.col : null,
        originSlot: originFp ? originFp.slot : null,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        lastX: e.clientX,
        lastY: e.clientY,
        px: e.clientX,
        py: e.clientY,
        target: null,
        dragged: false,
        scanRaf: null,
        scrollRaf: null
    };
    window.addEventListener('pointermove', onTilePointerMove, { passive: false });
    window.addEventListener('pointerup', onTilePointerUp);
    window.addEventListener('pointercancel', onTilePointerUp);
    _tileDrag.scrollRaf = requestAnimationFrame(tileAutoScrollTick);
}

// Auto-Scrollen: zieht man die Kachel an den oberen/unteren Bildschirmrand,
// scrollt die Seite mit – so sind auch Landeplätze außerhalb des sichtbaren
// Bereichs erreichbar (wichtig bei hohen Kacheln wie Notizen).
function tileAutoScrollTick() {
    const d = _tileDrag;
    if (!d) return;
    if (d.dragged) {
        const EDGE = 80, MAX = 22;
        const vh = window.innerHeight;
        let dy = 0;
        if (d.py < EDGE) dy = -MAX * (1 - d.py / EDGE);
        else if (d.py > vh - EDGE) dy = MAX * (1 - (vh - d.py) / EDGE);
        if (dy) {
            window.scrollBy(0, dy);
            updateDropIndicator(d); // viewport-relative Landeplätze neu berechnen
        }
    }
    d.scrollRaf = requestAnimationFrame(tileAutoScrollTick);
}

function onTilePointerMove(e) {
    if (!_tileDrag) return;
    e.preventDefault();
    const d = _tileDrag;
    // Kachel folgt dem Finger (jeden Frame, für flüssiges Mitziehen)
    d.card.style.left = (e.clientX - d.offsetX) + 'px';
    d.card.style.top = (e.clientY - d.offsetY) + 'px';

    // Erst reagieren, wenn wirklich gezogen wird (kleine Totzone gegen Wackler)
    if (!d.dragged) {
        if (Math.abs(e.clientX - d.lastX) <= 3 && Math.abs(e.clientY - d.lastY) <= 3) return;
        d.dragged = true;
    }

    // Indikator-Update gedrosselt per rAF
    d.px = e.clientX;
    d.py = e.clientY;
    if (d.scanRaf) return;
    d.scanRaf = requestAnimationFrame(() => {
        d.scanRaf = null;
        updateDropIndicator(d);
    });
}

// Kachel direkt unter dem Finger (für die Tausch-Mechanik). Die gezogene Karte
// ist pointer-events:none, daher trifft elementFromPoint die Kachel darunter.
function dashboardTileUnderPointer(d) {
    const el = document.elementFromPoint(d.px, d.py);
    const t = el && el.closest ? el.closest('.class-card') : null;
    if (!t || t === d.card || t.parentElement !== d.grid) return null;
    if (t.classList.contains('dashboard-tile-hidden')) return null;
    return t;
}

function setDropBox(d, left, top, width, height, swap) {
    d.box.classList.toggle('swap', !!swap);
    const label = d.box.querySelector('.tile-drop-label');
    if (label) label.textContent = swap ? 'Tauschen' : 'Hier ablegen';
    d.box.style.left = left + 'px';
    d.box.style.top = top + 'px';
    d.box.style.width = width + 'px';
    d.box.style.height = height + 'px';
}

// Über einer Kachel -> Tauschen; über freier Fläche -> frei ablegen (mit Lücke).
function updateDropIndicator(d) {
    if (!_tileDrag) return;
    const swapTile = dashboardTileUnderPointer(d);
    if (swapTile) {
        d.target = { mode: 'swap', tile: swapTile };
        const r = swapTile.getBoundingClientRect();
        setDropBox(d, r.left, r.top, r.width, r.height, true);
        return;
    }
    const cell = dashboardResolveDropCell(d);
    d.target = { mode: 'free', col: cell.col, slot: cell.slot };
    const r = dashboardCellRect(d.grid, d.m, cell.col, cell.slot, d.cspan, d.sspan);
    setDropBox(d, r.left, r.top, r.width, r.height, false);
}

function onTilePointerUp() {
    if (!_tileDrag) return;
    const d = _tileDrag;
    _tileDrag = null;
    const { grid, card, box, overlay, dragged } = d;
    if (d.scanRaf) cancelAnimationFrame(d.scanRaf);
    if (d.scrollRaf) cancelAnimationFrame(d.scrollRaf);
    window.removeEventListener('pointermove', onTilePointerMove);
    window.removeEventListener('pointerup', onTilePointerUp);
    window.removeEventListener('pointercancel', onTilePointerUp);

    // Ziel bestimmen: Tausch mit einer Kachel oder freies Ablegen auf einer Zelle.
    let tgt = d.target;
    if (!tgt) { const c = dashboardResolveDropCell(d); tgt = { mode: 'free', col: c.col, slot: c.slot }; }

    let landCol, landSlot;
    if (tgt.mode === 'swap' && tgt.tile && tgt.tile.parentElement === grid) {
        const tfp = dashboardTileFootprint(tgt.tile, d.m.slotRows);
        if (tfp && d.originCol != null) {
            landCol = tfp.col; landSlot = tfp.slot;
            if (dragged) {
                // Die getauschte Kachel wandert auf die Ausgangszelle der gezogenen.
                dashboardSetTilePosition(tgt.tile.dataset.tileKey, d.originCol, d.originSlot);
                dashboardSetTilePosition(card.dataset.tileKey, tfp.col, tfp.slot);
            }
        } else {
            // Footprint unbekannt -> wie freies Ablegen behandeln.
            const c = dashboardResolveDropCell(d);
            landCol = c.col; landSlot = c.slot;
            if (dragged) dashboardSetTilePosition(card.dataset.tileKey, landCol, landSlot);
        }
    } else {
        landCol = tgt.col; landSlot = tgt.slot;
        if (dragged) dashboardSetTilePosition(card.dataset.tileKey, landCol, landSlot);
    }

    // Karte sanft auf die Zielzelle gleiten lassen.
    const r = dashboardCellRect(grid, d.m, landCol, landSlot, d.cspan, d.sspan);
    card.style.transition = 'left 0.18s ease, top 0.18s ease, transform 0.18s ease';
    requestAnimationFrame(() => {
        card.style.left = r.left + 'px';
        card.style.top = r.top + 'px';
        card.style.transform = 'scale(1)';
    });

    let done = false;
    const finish = () => {
        if (done) return; done = true;
        card.removeEventListener('transitionend', finish);
        card.classList.remove('tile-dragging');
        ['width', 'height', 'left', 'top', 'transform', 'transition'].forEach(p => card.style.removeProperty(p));
        grid.classList.remove('tile-grid-active');
        grid.style.minHeight = '';
        if (overlay && overlay.parentElement) overlay.remove();
        if (box.parentElement) box.remove();
        document.body.classList.remove('tile-dragging-active');
        // Beim Neu-Anordnen die anderen Kacheln sanft an ihren Platz gleiten lassen
        // (z. B. die getauschte Kachel auf die freigewordene Zelle).
        const sibs = visibleDashboardTiles(grid).filter(c => c !== card);
        const before = new Map(sibs.map(c => [c, c.getBoundingClientRect()]));
        layoutDashboardMasonry();
        sibs.forEach(c => {
            const f = before.get(c);
            const l = c.getBoundingClientRect();
            const dx = f.left - l.left, dy = f.top - l.top;
            if (!dx && !dy) return;
            c.style.transition = 'none';
            c.style.transform = `translate(${dx}px, ${dy}px)`;
            requestAnimationFrame(() => {
                c.style.transition = 'transform 0.18s ease';
                c.style.transform = '';
            });
        });
        if (dragged) {
            window._suppressTileClick = true;
            setTimeout(() => { window._suppressTileClick = false; }, 60);
        }
    };
    card.addEventListener('transitionend', finish);
    setTimeout(finish, 280); // Fallback, falls keine Transition feuert
}

// Schmaler Bildschirm: simples Umsortieren (Kacheln stehen voll breit untereinander).
function startTileReorderDrag(e, grid, card) {
    const rect = card.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'tile-drop-indicator';
    box.innerHTML = '<span class="tile-drop-label">Hier ablegen</span>';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    document.body.appendChild(box);

    card.classList.add('tile-dragging');
    card.style.width = rect.width + 'px';
    card.style.height = rect.height + 'px';
    card.style.left = rect.left + 'px';
    card.style.top = rect.top + 'px';
    document.body.classList.add('tile-dragging-active');

    const state = {
        grid, card, box,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        refNode: card.nextSibling,
        dragged: false
    };

    const move = (ev) => {
        ev.preventDefault();
        card.style.left = (ev.clientX - state.offsetX) + 'px';
        card.style.top = (ev.clientY - state.offsetY) + 'px';
        state.dragged = true;
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        let target = under && under.closest ? under.closest('.class-card') : null;
        if (!target || target === card || target.parentElement !== grid) return;
        const r = target.getBoundingClientRect();
        const after = ev.clientY > r.top + r.height / 2;
        state.refNode = after ? target.nextSibling : target;
        box.style.left = (after ? r.left : r.left) + 'px';
        box.style.top = (after ? r.bottom - box.offsetHeight : r.top) + 'px';
        box.style.width = r.width + 'px';
    };
    const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        const ref = (state.refNode && state.refNode.parentElement === grid && state.refNode !== card) ? state.refNode : null;
        if (state.dragged) grid.insertBefore(card, ref);
        card.classList.remove('tile-dragging');
        ['width', 'height', 'left', 'top', 'transform', 'transition'].forEach(p => card.style.removeProperty(p));
        if (box.parentElement) box.remove();
        document.body.classList.remove('tile-dragging-active');
        layoutDashboardMasonry();
        if (state.dragged) {
            saveDashboardTileOrder();
            window._suppressTileClick = true;
            setTimeout(() => { window._suppressTileClick = false; }, 60);
        }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
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
let _addClassArt = 'hauptfach';

function addClassArtToggle(art) {
    _addClassArt = art;
    const h = document.getElementById('new-class-art-haupt');
    const n = document.getElementById('new-class-art-neben');
    if (h) h.classList.toggle('active', art === 'haupt');
    if (n) n.classList.toggle('active', art === 'neben');
}

async function createClass() {
    const classNameInput = safeGetElement('new-class-name');
    if (!classNameInput) return;

    const className = classNameInput.value.trim();
    const klasse = (safeGetElement('new-class-klasse') || {}).value?.trim() || '';
    const fach = (safeGetElement('new-class-fach') || {}).value?.trim() || '';
    const artEl = safeGetElement('new-class-art');
    const artVal = artEl ? artEl.value : '';
    const gewichtung = artVal === 'neben' ? 'nebenfach' : 'hauptfach';
    const classTeacherEl = safeGetElement('new-class-teacher');
    const isClassTeacher = !!(classTeacherEl && classTeacherEl.checked);

    if (!className) {
        if (typeof swal !== 'undefined') swal('Hinweis', 'Bitte einen Anzeigenamen eingeben.', 'info');
        return;
    }
    if (!klasse) {
        if (typeof swal !== 'undefined') swal('Hinweis', 'Bitte eine Klasse eingeben.', 'info');
        return;
    }
    if (!fach) {
        if (typeof swal !== 'undefined') swal('Hinweis', 'Bitte ein Fach eingeben.', 'info');
        return;
    }
    if (!artVal) {
        if (typeof swal !== 'undefined') swal('Hinweis', 'Bitte Hauptfach oder Nebenfach wählen.', 'info');
        return;
    }
    if (className.length > 50) {
        if (typeof swal !== 'undefined') swal('Fehler', 'Anzeigename ist zu lang (max. 50 Zeichen)', 'error');
        return;
    }
    if (classes.some(cls => cls.name.toLowerCase() === className.toLowerCase())) {
        if (typeof swal !== 'undefined') swal('Fehler', 'Eine Klasse mit diesem Anzeigenamen existiert bereits', 'error');
        return;
    }
    if (isClassTeacher && !(await confirmClassTeacherSwitch(className))) {
        return;
    }

    const newClass = {
        name: className,
        klasse: klasse,
        fach: fach,
        subject: '',
        gewichtung: gewichtung,
        students: [],
        homework: {},
        materials: {},
        alphabeticallySorted: false,
        homeworkSorted: false,
        studentsListSorted: false,
        classTeacher: false,
        sitzplan: { desks: [], currentMode: 'evaluation' }
    };

    if (isClassTeacher) setSingleClassTeacher(null, false);
    newClass.classTeacher = isClassTeacher;
    classes.push(newClass);
    window.classes = classes;
    saveData();
    hideModal();

    // Felder zurücksetzen
    classNameInput.value = '';
    const kEl = safeGetElement('new-class-klasse'); if (kEl) kEl.value = '';
    const fEl = safeGetElement('new-class-fach'); if (fEl) fEl.value = '';
    if (artEl) artEl.value = '';
    if (classTeacherEl) classTeacherEl.checked = false;

    renderClassesGrid();
    if (typeof swal !== 'undefined') swal('Erfolg', `Klasse „${className}" wurde erstellt`, 'success');
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
        classTeacher: false,
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

let _editClassArt = 'hauptfach';

function editClassArtToggle(art) {
    _editClassArt = art;
    const h = document.getElementById('edit-class-art-haupt');
    const n = document.getElementById('edit-class-art-neben');
    if (h) h.classList.toggle('active', art === 'haupt');
    if (n) n.classList.toggle('active', art === 'neben');
}

function editClass(classId) {
    if (classId === null || classId === undefined || !classes[classId]) return;

    classToEditId = classId;
    const cls = classes[classId];
    const input = safeGetElement('edit-class-input');
    if (input) input.value = cls.name;
    const kEl = safeGetElement('edit-class-klasse');
    if (kEl) kEl.value = cls.klasse || '';
    const fEl = safeGetElement('edit-class-fach');
    if (fEl) fEl.value = cls.fach || '';

    const artSel = document.getElementById('edit-class-art');
    if (artSel) artSel.value = cls.gewichtung === 'nebenfach' ? 'neben' : 'haupt';
    const classTeacherEl = document.getElementById('edit-class-teacher');
    if (classTeacherEl) classTeacherEl.checked = !!cls.classTeacher;

    showModal('edit-class-modal');
}

// Klasse speichern nach Bearbeitung
async function saveEditedClass() {
    const input = safeGetElement('edit-class-input');
    if (!input || classToEditId === null) return;

    const newName = input.value.trim();
    if (newName) {
        const classTeacherEl = safeGetElement('edit-class-teacher');
        if (classTeacherEl && classTeacherEl.checked && !(await confirmClassTeacherSwitch(newName, classToEditId))) {
            return;
        }

        classes[classToEditId].name = newName;
        const kEl = safeGetElement('edit-class-klasse');
        if (kEl) classes[classToEditId].klasse = kEl.value.trim();
        const fEl = safeGetElement('edit-class-fach');
        if (fEl) classes[classToEditId].fach = fEl.value.trim();
        const editArtEl = safeGetElement('edit-class-art');
        classes[classToEditId].gewichtung = (editArtEl && editArtEl.value === 'neben') ? 'nebenfach' : 'hauptfach';
        if (classTeacherEl && classTeacherEl.checked) {
            setSingleClassTeacher(classToEditId, true);
        } else {
            classes[classToEditId].classTeacher = false;
            normalizeClassTeacherFlags();
        }
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
        buttons: [false, "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            classes.splice(classId, 1);
            window.classes = classes;
            // Bewusste Löschung der letzten Klasse: Schutzsperre für diesen einen Upload aufheben
            if (classes.length === 0) window._allowEmptyClassesSync = true;
            saveData();
            
            // Falls aktive Klasse gelöscht wurde, zurück zur Startseite
            if (currentPage === 'class' && activeClassId === classId) {
                showPage('home');
            } else if (currentPage === 'class' && activeClassId > classId) {
                // Index anpassen, wenn eine Klasse davor gelöscht wurde
                activeClassId--;
                AppState.activeClassId = activeClassId;
                localStorage.setItem('activeClassId', activeClassId);
            }
            
            renderClassesGrid();
        }
    });
}

// ===== EVENT HANDLING =====

// Event-Listener für Dokumentenladung
function initFlatpickr() {
    setupZeitraumPickers();
}

// Zeitraum-Datumspicker passend zum aktuellen Format aufsetzen.
// Mobile (<= 600px, z. B. iPhone Hochformat) -> zwei Felder, Kalender öffnet
// erst beim Antippen (Popup, mittig). Ab 601px (Desktop UND iPad) -> zwei
// eingebettete Kalender nebeneinander. Wird beim Laden UND bei jedem Öffnen des
// Modals aufgerufen, damit die Ansicht immer zum tatsächlichen Format passt
// (auch nach Drehen / in der Responsive-Vorschau).
function setupZeitraumPickers() {
    if (typeof flatpickr === 'undefined') return;
    const locale = (flatpickr.l10ns && flatpickr.l10ns.de) ? flatpickr.l10ns.de : 'de';
    const twoCalendars = window.matchMedia('(min-width: 601px)').matches;
    const cfg = {
        locale: locale,
        dateFormat: 'Y-m-d',
        altInput: !twoCalendars,
        altFormat: 'd.m.Y',
        inline: twoCalendars,
        disableMobile: true,
        onChange: function() { autoGeneratePlanungTable(); },
        // Popup (Mobile) sofort mittig positionieren – ohne Verzögerung, kein Springen
        onOpen: function(selectedDates, dateStr, instance) {
            const cal = instance.calendarContainer;
            cal.style.position = 'fixed';
            cal.style.top = '50%';
            cal.style.left = '50%';
            cal.style.transform = 'translate(-50%, -50%)';
            cal.style.zIndex = '999999';
            cal.style.marginTop = '0';
        }
    };
    ['planung-start-date', 'planung-end-date'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        // bisher gewählten Wert merken, Picker neu aufsetzen, Wert zurücksetzen
        const prev = el._flatpickr ? el._flatpickr.selectedDates[0] : (el.value || '');
        if (el._flatpickr) el._flatpickr.destroy();
        const fp = flatpickr(el, cfg);
        if (prev) fp.setDate(prev, false);
    });
}
window.setupZeitraumPickers = setupZeitraumPickers;


document.addEventListener('DOMContentLoaded', function() {
    // Initialisierungsfunktion rufen
    initFlatpickr();

    // Scroll-Wiederherstellung selbst übernehmen: Sonst stellt der Browser bei
    // Zurück seine eigene (am gemeinsamen Dokument-Scroll gemerkte) Position wieder
    // her und kollidiert mit unserer -> sichtbares Springen, v. a. beim Schließen
    // eines Doc-Scroll-Tool-Fensters über die Startseite.
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // Ersten Zustand im Verlauf festlegen (Startseite)
    if (!history.state) {
        history.replaceState({ page: 'home', classId: null, module: null, toolWindow: null }, '');
    }

    // Crash-Recovery: Falls die Archiv-Ansicht (Zeitreise) zuvor unsauber verlassen
    // wurde (z. B. Reload während der Ansicht), liegen evtl. noch die alten Archiv-
    // Daten im localStorage. Dann die gesicherten Live-Daten zurückspielen und die
    // Sperre lösen, damit nie versehentlich Archiv-Daten hochgeladen werden.
    try {
        if (localStorage.getItem('__archiveViewActive') === '1') {
            const backupRaw = localStorage.getItem(ARCHIVE_LIVE_BACKUP_KEY);
            if (backupRaw) {
                try { ztApplySnapshotToApp(JSON.parse(backupRaw)); } catch (e) {}
            }
            localStorage.removeItem(ARCHIVE_LIVE_BACKUP_KEY);
            localStorage.removeItem('__archiveViewActive');
            window.__archiveViewMode = false;
        }
    } catch (e) { /* Recovery best effort */ }

    loadData();
    loadTermine();
    loadPlanung();
    // Startseite erst jetzt rendern – wenn Klassen, Termine UND Planung geladen sind.
    // So zeigt der Kalender die Termine sofort aus dem localStorage, ohne auf den
    // Cloud-Abgleich zu warten (kein verzögertes Nachladen beim Neuladen der Seite).
    showPage('home');

    // Event-Listener für Zurück-Navigation (Browser-Zurück, Maus-Zurück, PWA)
    window.addEventListener('popstate', function(event) {
        const modalContainer = document.getElementById('modal-container');
        const isModalOpen = modalContainer && modalContainer.style.display === 'flex';

        if (isModalOpen) {
            hideModal();
            // Zustand wiederherstellen, da nur das Modal geschlossen wurde
            history.pushState({ page: currentPage, classId: activeClassId, module: activeModule, toolWindow: window._activeToolWindow }, '');
            return;
        }
        
        const state = event.state;
        const toolWindowOverlay = document.getElementById('tool-window-overlay');
        const isToolWindowOpen = toolWindowOverlay && toolWindowOverlay.classList.contains('open');

        if (state) {
            if (state.toolWindow) {
                // Falls ein Tool-Window im neuen Zustand geöffnet sein soll
                openToolWindow(state.toolWindow, false);
            } else {
                // Kein Tool-Window im neuen Zustand -> falls eins offen ist, schließen
                if (isToolWindowOpen) {
                    closeToolWindow({ resetScroll: false });
                }
                if (state.page) {
                    // Robuste Scroll-Wiederherstellung vorladen, BEVOR die Startseite
                    // neu rendert (sonst greift sie beim Masonry-Einpendeln zu spät).
                    seedDashboardScrollRestore(state);
                    showPage(state.page, state.classId, false);
                    if (state.page === 'class' && state.module) {
                        showModule(state.module, false);
                    }
                    // Bei 'home' übernimmt bereits die vorgeladene, robuste
                    // Wiederherstellung (scheduleDashboardScrollRestore in
                    // renderClassesGrid). Doppeltes Setzen würde nur stottern.
                    if (state.page !== 'home') restoreHistoryScroll(state);
                }
            }
        } else {
            // Fallback auf Startseite
            if (isToolWindowOpen) {
                closeToolWindow({ resetScroll: false });
            }
            showPage('home', null, false);
        }
    });

    // Globale Werkzeuge-Fenster vorbereiten (Module einmalig ins Overlay verschieben)
    if (typeof initToolWindows === 'function') initToolWindows();
    if (typeof initSyncStatusMirror === 'function') initSyncStatusMirror();
    
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
            if (window._activeToolWindow) {
                closeToolWindow({ resetScroll: false });
            }
            showPage('home');
        });
    }

    // Verhindere das Scrollen des Hintergrunds bei Berührung des Modals (ausgenommen scrollbare Elemente)
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.addEventListener('touchmove', function(e) {
            let isScrollable = false;
            let el = e.target;
            while (el && el !== modalContainer) {
                const style = window.getComputedStyle(el);
                const overflowY = style.getPropertyValue('overflow-y');
                const isScrollableStyle = overflowY === 'auto' || overflowY === 'scroll';
                const hasScrollableContent = el.scrollHeight > el.clientHeight;
                if (isScrollableStyle && hasScrollableContent) {
                    isScrollable = true;
                    break;
                }
                el = el.parentNode;
            }
            if (!isScrollable) {
                e.preventDefault();
            }
        }, { passive: false });
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
            <td class="${student.learningSupport ? 'learning-support' : ''} ${student.eseSupport ? 'ese-support' : ''}">${escapeHtml(student.name)}</td>
            <td style="text-align: center;">
                <input type="checkbox" ${student.eseSupport ? 'checked' : ''} onclick="toggleEseSupport(${index}, this)">
            </td>
            <td style="text-align: center;">
                <input type="checkbox" ${student.learningSupport ? 'checked' : ''} onclick="toggleLearningSupport(${index}, this)">
            </td>
            <td>
                <div class="student-actions">
                    <button class="btn btn-sm btn-primary btn-circle-sm" onclick="editStudentName(${index})" title="Schüler bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-circle-sm" onclick="deleteStudent(${index})" title="Schüler löschen">
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
        buttons: [false, "Löschen"],
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
            buttons: [false, "Deaktivieren"],
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
            buttons: [false, "Deaktivieren"],
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
                icon: "warning",
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
            buttons: [false, "Löschen"],
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
                    <i class="fas fa-user"></i> ${escapeHtml(student.name)}
                    <i id="notentoggleIcon-${studentIndex}" class="fas fa-chevron-down toggle-icon ${student.notenExpanded ? 'rotate' : ''}"></i>
                </div>
                <div class="student-header-actions" style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                    <button class="btn-back-to-top-circle" onclick="event.stopPropagation(); collapseStudentAndScrollToTop('noten', ${studentIndex})" title="Suchen"><i class="fas fa-search"></i></button>
                </div>
            </div>
        `;
        
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
    
    const isExpanded = classes[activeClassId].students[originalIndex].notenExpanded;

    // Akkordeon: vor dem Aufklappen alle anderen einklappen
    if (!isExpanded) {
        const sortedStudents = getSortedStudents();
        classes[activeClassId].students.forEach(s => { s.notenExpanded = false; });
        sortedStudents.forEach((s, idx) => {
            const d = safeGetElement(`${modul}studentDetails-${idx}`);
            const ic = safeGetElement(`${modul}toggleIcon-${idx}`);
            if (d) d.classList.remove('show');
            if (ic) ic.classList.remove('rotate');
        });
    }

    // Zustand umschalten
    classes[activeClassId].students[originalIndex].notenExpanded = !isExpanded;

    // UI aktualisieren
    const detailsDiv = safeGetElement(`${modul}studentDetails-${studentIndex}`);
    const toggleIcon = safeGetElement(`${modul}toggleIcon-${studentIndex}`);

    if (detailsDiv && toggleIcon) {
        if (isExpanded) {
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
    
    // Optionen je Projekt – mit dem eingegebenen Projektnamen (Fallback: "Projekt N")
    for (let i = 0; i < maxProjects; i++) {
        let projectName = '';
        for (const student of cls.students) {
            if (student.projects && student.projects[i] && student.projects[i].name) {
                projectName = student.projects[i].name;
                break;
            }
        }
        const option = document.createElement('option');
        option.value = i;
        option.textContent = projectName || `Projekt ${i + 1}`;
        projectSelect.appendChild(option);
    }
    
    // Zuvor ausgewählten Wert wiederherstellen, wenn möglich
    if (currentValue && parseInt(currentValue) < maxProjects) {
        projectSelect.value = currentValue;
    }
}

// Funktion zum Ein- und Ausklappen der Projekt-Statistiken
// Projekt-Statistiken sind immer ausgeklappt (kein Toggle mehr).

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

    // Säulenfarben an den Notenfarben orientiert (1 blau, 2 grün, 3 gelb, 4 orange, 5 rot, 6 grau)
    const gradeBarColors = { '1': '#007bff', '2': '#28a745', '3': '#ffc107', '4': '#fd7e14', '5': '#dc143c', '6': '#6c757d' };

    sortedGrades.forEach(grade => {
        const count = distribution[grade];
        const height = Math.max(20, Math.round((count / maxCount) * 100));
        
        const bar = document.createElement('div');
        bar.className = 'distribution-bar';
        bar.style.height = `${height}%`;
        bar.innerHTML = `
            <div class="distribution-bar-value">${count}x</div>
            <div class="distribution-bar-label">${grade}</div>
        `;
        
        // Farbe basierend auf Note (Notenfarben wie im Rest der App)
        bar.style.backgroundColor = gradeBarColors[grade] || '#6c757d';
        
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
        buttons: [false, "Löschen"],
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
                
                // Add a separator after the last badge (between the last grade circle and the back-to-top button)
                const endSeparator = document.createElement('span');
                endSeparator.className = 'grade-separator';
                endSeparator.textContent = '•';
                gradesPreview.appendChild(endSeparator);
            }
        }
        
        // Add the preview to the student header
        const actions = studentHeader.querySelector('.student-header-actions');
        if (actions) {
            actions.insertBefore(gradesPreview, actions.firstChild);
        } else {
            studentHeader.appendChild(gradesPreview);
        }
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
            min-width: 32px;
            height: 32px;
            aspect-ratio: 1;
            text-align: center;
            border-radius: 50%;
            color: black;
            font-weight: bold;
            font-size: 0.85rem;
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

// Baut ein vollständiges Snapshot-Objekt aller App-Daten (gleiche Struktur wie
// der Datei-Export). Einzige Quelle der Wahrheit für Export, Halbjahr-Archiv und
// die lokale Live-Sicherung beim Betreten der Archiv-Ansicht.
function buildCurrentSnapshot() {
    const planungObj = {};
    if (Array.isArray(classes)) {
        classes.forEach((_, i) => {
            try {
                const p = localStorage.getItem(`planung_${i}`);
                if (p) planungObj[String(i)] = JSON.parse(p);
            } catch (e) { /* ungültiges JSON ignorieren */ }
        });
    }
    return {
        version: "1.1",
        timestamp: new Date().toISOString(),
        classes: classes,
        contacts: contacts,
        dashboardNotes: AppState.dashboardNotes || [],
        termine: (window.AppState && window.AppState.termine) ? window.AppState.termine : [],
        deletedTermineIds: JSON.parse(localStorage.getItem('deletedTermineIds') || '[]'),
        planung: planungObj,
        planung_global_calendar_range: JSON.parse(localStorage.getItem('planung_global_calendar_range') || '{}'),
        zeugnistexteArchiv: JSON.parse(localStorage.getItem('zeugnistexteArchiv') || '[]'),
        ztPlanung: JSON.parse(localStorage.getItem('ztPlanung') || '{"courses":[]}'),
        stundenplan: JSON.parse(localStorage.getItem('stundenplan') || '{"zeiten":[],"kacheln":{},"inklusionProKlasse":{}}'),
        zeugnisViewMode: localStorage.getItem('zeugnisViewMode') || 'individual',
        extraDataLastUpdate: localStorage.getItem('extraDataLastUpdate') || new Date().toISOString(),
        // Zusätzliche Felder für exakte Wiederherstellung (nicht im alten Export):
        lastUpdate: localStorage.getItem('lastUpdate') || '',
        ztInputDraft: localStorage.getItem('ztInputDraft') || ''
    };
}

// Alle Daten exportieren - Mit Event-Parameter für stopPropagation
function exportAllData(event) {
    // Verhindern, dass das Event den toggleBackupPanel auslöst
    if (event && event.stopPropagation) {
        event.stopPropagation();
    }

    try {
        // Alle Daten in einem Objekt zusammenfassen
        const exportData = buildCurrentSnapshot();

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
                buttons: [false, "Importieren"],
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
                    
                    // Kontakte übernehmen (falls vorhanden)
                    if (importData.contacts && Array.isArray(importData.contacts)) {
                        contacts = importData.contacts;
                        AppState.contacts = importData.contacts;
                        window.contacts = importData.contacts;
                        localStorage.setItem('contacts', JSON.stringify(contacts));
                    }

                    // Notizen übernehmen (falls vorhanden)
                    if (importData.dashboardNotes && Array.isArray(importData.dashboardNotes)) {
                        dashboardNotes = importData.dashboardNotes;
                        AppState.dashboardNotes = importData.dashboardNotes;
                        window.dashboardNotes = importData.dashboardNotes;
                        if (typeof window.setDashboardNotes === 'function') {
                            window.setDashboardNotes(importData.dashboardNotes);
                        }
                        localStorage.setItem('dashboardNotes', JSON.stringify(importData.dashboardNotes));
                    }

                    // Termine übernehmen (falls vorhanden)
                    if (importData.termine && Array.isArray(importData.termine)) {
                        if (window.AppState) window.AppState.termine = importData.termine;
                        localStorage.setItem('termine', JSON.stringify(importData.termine));
                    }
                    if (importData.deletedTermineIds && Array.isArray(importData.deletedTermineIds)) {
                        localStorage.setItem('deletedTermineIds', JSON.stringify(importData.deletedTermineIds));
                    }

                    // Planung übernehmen (falls vorhanden)
                    if (importData.planung && typeof importData.planung === 'object') {
                        // Zuerst alle alten Planungen löschen
                        const planungKeys = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('planung_')) {
                                planungKeys.push(key);
                            }
                        }
                        planungKeys.forEach(key => localStorage.removeItem(key));

                        // Neue Planungen einspielen
                        Object.keys(importData.planung).forEach(id => {
                            try {
                                localStorage.setItem(`planung_${id}`, JSON.stringify(importData.planung[id]));
                            } catch (e) {
                                // Ignorieren falls JSON-Stringify fehlschlägt
                            }
                        });
                    }
                    if (importData.planung_global_calendar_range && typeof importData.planung_global_calendar_range === 'object') {
                        localStorage.setItem('planung_global_calendar_range', JSON.stringify(importData.planung_global_calendar_range));
                    }

                    // Zeugnistexte Archiv übernehmen (falls vorhanden)
                    if (importData.zeugnistexteArchiv && Array.isArray(importData.zeugnistexteArchiv)) {
                        localStorage.setItem('zeugnistexteArchiv', JSON.stringify(importData.zeugnistexteArchiv));
                    }

                    // Inklusions-Planung (Zeugnistextgenerator) übernehmen.
                    // Zuerst setzen, da setStundenplan die verknüpften Kurse damit abgleicht.
                    if (importData.ztPlanung && typeof importData.ztPlanung === 'object') {
                        localStorage.setItem('ztPlanung', JSON.stringify(importData.ztPlanung));
                        if (typeof window.setZtPlanung === 'function') window.setZtPlanung(importData.ztPlanung);
                    }

                    // Stundenplan übernehmen (falls vorhanden)
                    if (importData.stundenplan && typeof importData.stundenplan === 'object') {
                        localStorage.setItem('stundenplan', JSON.stringify(importData.stundenplan));
                        if (typeof window.setStundenplan === 'function') window.setStundenplan(importData.stundenplan);
                    }

                    // Zeugnisansicht-Einstellung übernehmen
                    if (importData.zeugnisViewMode) {
                        if (window.AppState) window.AppState.zeugnisViewMode = importData.zeugnisViewMode;
                        localStorage.setItem('zeugnisViewMode', importData.zeugnisViewMode);
                    }

                    // Timestamps übernehmen
                    if (importData.extraDataLastUpdate) {
                        localStorage.setItem('extraDataLastUpdate', importData.extraDataLastUpdate);
                    }
                    
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

// ===== HALBJAHR-ARCHIV =====
// Am Ende eines Halbjahres kann der komplette Datenstand als EIN Snapshot in die
// Cloud archiviert und anschließend zurückgesetzt werden (Adressbuch, Kalender,
// Unterrichtszeiten und die Namen übernommener Klassen bleiben erhalten). Das
// Archiv lässt sich später read-only "ansehen" (Zeitreise-Modus) und löschen.
// Kein Wiederherstellen.

const ARCHIVE_LIVE_BACKUP_KEY = '__liveBackupBeforeArchive';

// Snapshot (Export-Struktur) in die App laden – OHNE Cloud-Sync auszulösen.
// Genutzt für die Archiv-Ansicht (Zeitreise) und das Zurückspielen der Live-Sicherung.
function ztApplySnapshotToApp(data) {
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data.classes)) {
        classes = data.classes;
        AppState.classes = data.classes;
        window.classes = data.classes;
        localStorage.setItem('classes', JSON.stringify(data.classes));
    }
    if (Array.isArray(data.contacts)) {
        contacts = data.contacts;
        AppState.contacts = data.contacts;
        window.contacts = data.contacts;
        localStorage.setItem('contacts', JSON.stringify(data.contacts));
    }
    if (Array.isArray(data.dashboardNotes)) {
        localStorage.setItem('dashboardNotes', JSON.stringify(data.dashboardNotes));
        if (typeof window.setDashboardNotes === 'function') window.setDashboardNotes(data.dashboardNotes);
        else { AppState.dashboardNotes = data.dashboardNotes; window.dashboardNotes = data.dashboardNotes; }
    }
    if (Array.isArray(data.termine)) {
        if (window.AppState) window.AppState.termine = data.termine;
        localStorage.setItem('termine', JSON.stringify(data.termine));
    }
    if (Array.isArray(data.deletedTermineIds)) {
        localStorage.setItem('deletedTermineIds', JSON.stringify(data.deletedTermineIds));
    }
    // Planung (pro Klasse): alte planung_*-Keys entfernen, neue setzen
    {
        const planungKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && /^planung_\d+$/.test(key)) planungKeys.push(key);
        }
        planungKeys.forEach(k => localStorage.removeItem(k));
        if (data.planung && typeof data.planung === 'object') {
            Object.keys(data.planung).forEach(id => {
                try { localStorage.setItem('planung_' + id, JSON.stringify(data.planung[id])); } catch (e) {}
            });
        }
    }
    if (data.planung_global_calendar_range && typeof data.planung_global_calendar_range === 'object') {
        localStorage.setItem('planung_global_calendar_range', JSON.stringify(data.planung_global_calendar_range));
    }
    if (Array.isArray(data.zeugnistexteArchiv)) {
        localStorage.setItem('zeugnistexteArchiv', JSON.stringify(data.zeugnistexteArchiv));
        if (typeof window.setZeugnistexteArchiv === 'function') window.setZeugnistexteArchiv(data.zeugnistexteArchiv);
    }
    if (data.ztPlanung && typeof data.ztPlanung === 'object') {
        localStorage.setItem('ztPlanung', JSON.stringify(data.ztPlanung));
        if (typeof window.setZtPlanung === 'function') window.setZtPlanung(data.ztPlanung);
    }
    if (data.stundenplan && typeof data.stundenplan === 'object') {
        localStorage.setItem('stundenplan', JSON.stringify(data.stundenplan));
        if (typeof window.setStundenplan === 'function') window.setStundenplan(data.stundenplan);
    }
    if (data.zeugnisViewMode) {
        if (window.AppState) window.AppState.zeugnisViewMode = data.zeugnisViewMode;
        localStorage.setItem('zeugnisViewMode', data.zeugnisViewMode);
    }
    if (typeof data.ztInputDraft === 'string') {
        localStorage.setItem('ztInputDraft', data.ztInputDraft);
    }
    if (data.extraDataLastUpdate) localStorage.setItem('extraDataLastUpdate', data.extraDataLastUpdate);
    if (typeof data.lastUpdate === 'string' && data.lastUpdate) localStorage.setItem('lastUpdate', data.lastUpdate);
}

// Re-render aller Hauptansichten nach einem Datenwechsel (Snapshot laden/verlassen).
function ztRerenderAfterDataSwap() {
    try { if (typeof showPage === 'function') showPage('home'); } catch (e) {}
    try { if (typeof renderClassesGrid === 'function') renderClassesGrid(); } catch (e) {}
    try { if (typeof renderDashboardNotes === 'function') renderDashboardNotes(); } catch (e) {}
    try { if (typeof renderDashboardCalendar === 'function') renderDashboardCalendar(); } catch (e) {}
}

// Schätzt einen sinnvollen Default-Namen aus dem aktuellen Datum.
function guessHalbjahrName() {
    const d = new Date();
    const m = d.getMonth(); // 0 = Januar
    const y = d.getFullYear();
    let half, startYear;
    if (m >= 7) { half = 1; startYear = y; }            // Aug–Dez
    else if (m === 0) { half = 1; startYear = y - 1; }    // Januar
    else { half = 2; startYear = y - 1; }                 // Feb–Jul
    const yy = String(startYear).slice(-2);
    const yy2 = String(startYear + 1).slice(-2);
    return `${half}. Halbjahr ${yy}/${yy2}`;
}

// Banner ein-/ausblenden
function showArchiveViewBanner(name) {
    const b = document.getElementById('archive-view-banner');
    const label = document.getElementById('archive-view-banner-label');
    if (label) label.textContent = 'Archiv-Ansicht: ' + (name || 'Halbjahr') + ' · nur Lesen';
    if (b) b.style.display = 'flex';
    document.body.classList.add('archive-view-active');
}
function hideArchiveViewBanner() {
    const b = document.getElementById('archive-view-banner');
    if (b) b.style.display = 'none';
    document.body.classList.remove('archive-view-active');
}

// --- Modal-Rendering ---
function openHalbjahrArchive() {
    // Während der Archiv-Ansicht: Button führt zurück zu den aktuellen Daten.
    if (window.__archiveViewMode) { exitHalbjahrArchiveView(); return; }
    ztRenderHalbjahrArchiveModal({ loading: true });
    showModal('halbjahr-archive-modal');
    (async () => {
        let entry = null;
        try {
            if (typeof window.loadHalbjahrArchiveFromCloud === 'function') {
                entry = await window.loadHalbjahrArchiveFromCloud();
            }
        } catch (e) { entry = null; }
        ztRenderHalbjahrArchiveModal({ entry });
    })();
}

function ztRenderHalbjahrArchiveModal(state) {
    const modal = document.getElementById('halbjahr-archive-modal');
    if (!modal) return;
    const head = `
        <div class="zt-modal-head">
            <span style="font-size:1.25rem;font-weight:700;">Halbjahr-Archiv</span>
            <button class="zt-modal-close" onclick="hideModal()" title="Schließen"><i class="fas fa-times"></i></button>
        </div>`;

    if (state && state.loading) {
        modal.innerHTML = head + `<div style="padding:24px 4px;text-align:center;color:var(--grey-color);"><i class="fas fa-spinner fa-spin"></i> Lade Archiv …</div>`;
        return;
    }

    const entry = state && state.entry;
    if (entry && entry.data) {
        let dateStr = '';
        if (entry.date) { try { dateStr = new Date(entry.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) {} }
        let sizeKb = 0;
        try { sizeKb = Math.round(JSON.stringify(entry.data).length / 1024); } catch (e) {}
        const nClasses = Array.isArray(entry.data.classes) ? entry.data.classes.length : 0;
        modal.innerHTML = head + `
            <div style="padding:4px 4px 0;">
                <div class="hja-entry">
                    <div class="hja-entry-main">
                        <div class="hja-entry-name">${escapeHtml(entry.name || 'Archiviertes Halbjahr')}</div>
                        <div class="hja-entry-meta">${dateStr ? 'archiviert am ' + dateStr + ' · ' : ''}${nClasses} ${nClasses === 1 ? 'Klasse' : 'Klassen'} · ~${sizeKb} KB</div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:16px;">
                    <button class="btn btn-primary btn-icon" style="flex:1;" onclick="enterHalbjahrArchiveView()"><i class="fas fa-eye"></i> Ansehen</button>
                    <button class="btn btn-danger btn-icon" style="flex:1;" onclick="ztDeleteHalbjahrArchive()"><i class="fas fa-trash"></i> Löschen</button>
                </div>
                <p style="color:var(--grey-color);font-size:13px;margin:16px 0 4px;">Es kann nur ein Halbjahr archiviert sein. Zum Archivieren eines neuen Halbjahres bitte zuerst dieses löschen.</p>
            </div>`;
        return;
    }

    // Kein Archiv vorhanden
    modal.innerHTML = head + `
        <div style="padding:4px 4px 0;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;font-size:13px;color:#1e40af;margin-bottom:16px;">
                Hier kannst du am Ende eines Halbjahres den kompletten Stand sichern und für das neue Halbjahr aufräumen. Das Archiv bleibt zum Ansehen erhalten, bis du es löschst.
            </div>
            <button class="btn btn-primary btn-icon btn-block" onclick="ztShowHalbjahrArchiveCreate()"><i class="fas fa-box-archive"></i> Aktuelles Halbjahr archivieren</button>
        </div>`;
}

function ztShowHalbjahrArchiveCreate() {
    const modal = document.getElementById('halbjahr-archive-modal');
    if (!modal) return;
    const guess = guessHalbjahrName();
    const classList = Array.isArray(classes) ? classes : [];
    const rows = classList.length
        ? classList.map((c, i) =>
            `<label class="hja-class-row"><input type="checkbox" class="hja-keep-class" value="${i}" checked> <span>${escapeHtml(c.name || ('Klasse ' + (i + 1)))}</span></label>`
          ).join('')
        : '<p style="color:var(--grey-color);margin:0;">Keine Klassen vorhanden.</p>';
    modal.innerHTML = `
        <div class="zt-modal-head">
            <span style="font-size:1.25rem;font-weight:700;">Halbjahr archivieren</span>
            <button class="zt-modal-close" onclick="hideModal()" title="Schließen"><i class="fas fa-times"></i></button>
        </div>
        <div style="padding:4px 4px 0;">
            <label style="font-weight:600;display:block;margin-bottom:4px;">Name fürs Archiv</label>
            <input id="hja-name" class="form-control" value="${escapeHtml(guess)}" style="margin-bottom:18px;">
            <label style="font-weight:600;display:block;margin-bottom:6px;">Welche Klassen ins neue Halbjahr übernehmen?</label>
            <p style="color:var(--grey-color);font-size:13px;margin:0 0 8px;">Angekreuzte Klassen bleiben – aber nur mit den Schülernamen. Noten, Hausaufgaben und Zeugnis-Daten werden geleert. Nicht angekreuzte Klassen werden entfernt.</p>
            <div class="hja-class-list">${rows}</div>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin:14px 0;font-size:13px;color:#9a3412;line-height:1.5;">
                <strong>Was passiert:</strong> Der komplette aktuelle Stand wird als Archiv gesichert. Danach werden Noten, Zeugnistexte, Zeugnis-Planung, Unterrichtsplanung, Startseiten-Notizen und die einzelnen Stundenplan-Stunden geleert.<br>
                <strong>Erhalten bleiben:</strong> Adressbuch, Kalender/Termine, Unterrichtszeiten und die Namen der übernommenen Klassen.
            </div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary btn-icon" style="flex:1;" onclick="openHalbjahrArchive()"><i class="fas fa-arrow-left"></i> Zurück</button>
                <button class="btn btn-primary btn-icon" style="flex:2;" onclick="ztConfirmHalbjahrArchive()"><i class="fas fa-box-archive"></i> Archivieren &amp; zurücksetzen</button>
            </div>
        </div>`;
}

async function ztConfirmHalbjahrArchive() {
    const nameEl = document.getElementById('hja-name');
    const name = (nameEl ? nameEl.value : '').trim() || guessHalbjahrName();
    const keepIndices = Array.from(document.querySelectorAll('.hja-keep-class:checked')).map(el => Number(el.value));

    const willDo = await swal({
        title: 'Halbjahr archivieren?',
        text: `„${name}" wird gesichert und der aktuelle Stand anschließend zurückgesetzt. Adressbuch, Kalender und Unterrichtszeiten bleiben erhalten.`,
        icon: 'warning',
        buttons: ['Abbrechen', 'Archivieren & zurücksetzen'],
        dangerMode: true
    });
    if (!willDo) return;

    // 1) Snapshot bauen und in die Cloud schreiben – ZUERST sichern, dann erst leeren.
    let snapshot;
    try { snapshot = buildCurrentSnapshot(); } catch (e) {
        swal('Fehler', 'Der aktuelle Stand konnte nicht gelesen werden. Es wurde nichts verändert.', 'error');
        return;
    }
    try {
        if (typeof window.saveHalbjahrArchiveToCloud !== 'function') throw new Error('Cloud nicht verfügbar');
        await window.saveHalbjahrArchiveToCloud(name, snapshot);
    } catch (e) {
        console.error('Archiv-Upload fehlgeschlagen:', e);
        swal('Fehler', 'Das Archiv konnte nicht in der Cloud gespeichert werden. Es wurde nichts zurückgesetzt.', 'error');
        return;
    }

    // 2) Live-Daten zurücksetzen
    try {
        resetForNewHalfYear(keepIndices);
    } catch (e) {
        console.error('Reset fehlgeschlagen:', e);
        swal('Fehler', 'Beim Zurücksetzen ist ein Fehler aufgetreten. Das Archiv wurde aber gespeichert.', 'error');
        return;
    }

    // 3) Den geleerten Stand in die Cloud schreiben. Leer-Schutz-Flags setzen,
    //    damit das beabsichtigte Leeren propagiert.
    window._allowEmptyClassesSync = true;
    window._allowEmptyDashboardNotesSync = true;
    window._allowEmptyStundenplanSync = true;
    try {
        if (typeof window.saveDataToCloud === 'function') await window.saveDataToCloud();
    } catch (e) { console.warn('Upload des zurückgesetzten Standes fehlgeschlagen:', e); }

    hideModal();
    ztRerenderAfterDataSwap();
    swal('Fertig', `„${name}" wurde archiviert. Der aktuelle Stand ist für das neue Halbjahr zurückgesetzt.`, 'success');
}

// Setzt den Live-Stand fürs neue Halbjahr zurück. Behält: Adressbuch, Termine,
// Unterrichtszeiten und die Namen der übernommenen Klassen.
function resetForNewHalfYear(keepIndices) {
    const keep = new Set((keepIndices || []).map(Number));
    const oldClasses = Array.isArray(classes) ? classes : [];
    const newClasses = [];
    oldClasses.forEach((c, i) => {
        if (!keep.has(i)) return; // nicht übernommene Klassen entfernen
        const students = Array.isArray(c.students) ? c.students.map(s => ({
            name: s.name,
            projects: [],
            homework: 0,
            materials: 0,
            isExpanded: false,
            hwHistory: []
        })) : [];
        newClasses.push({
            name: c.name,
            klasse: c.klasse,
            fach: c.fach,
            subject: c.subject || '',
            gewichtung: c.gewichtung,
            classTeacher: !!c.classTeacher,
            alphabeticallySorted: false,
            homeworkSorted: false,
            studentsListSorted: false,
            homework: {},
            materials: {},
            students: students,
            sitzplan: { desks: [], currentMode: 'evaluation' }
        });
    });
    classes = newClasses;
    AppState.classes = newClasses;
    window.classes = newClasses;
    localStorage.setItem('classes', JSON.stringify(newClasses));

    // Startseiten-Notizen leeren
    AppState.dashboardNotes = [];
    window.dashboardNotes = [];
    localStorage.setItem('dashboardNotes', JSON.stringify([]));
    if (typeof window.setDashboardNotes === 'function') window.setDashboardNotes([]);

    // Unterrichtsplanung (pro Klasse) entfernen
    const pk = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && /^planung_\d+$/.test(k)) pk.push(k);
    }
    pk.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('planung_global_calendar_range', JSON.stringify({}));

    // Zeugnistext-Archiv leeren
    localStorage.setItem('zeugnistexteArchiv', JSON.stringify([]));
    if (typeof window.setZeugnistexteArchiv === 'function') window.setZeugnistexteArchiv([]);

    // Zeugnis-Planung leeren
    const emptyZt = { courses: [] };
    localStorage.setItem('ztPlanung', JSON.stringify(emptyZt));
    if (typeof window.setZtPlanung === 'function') window.setZtPlanung(emptyZt);

    // Stundenplan: Unterrichtszeiten behalten, einzelne Stunden + Inklusionszuordnung leeren
    let sp = {};
    try { sp = JSON.parse(localStorage.getItem('stundenplan') || '{}') || {}; } catch (e) { sp = {}; }
    const newSp = { zeiten: Array.isArray(sp.zeiten) ? sp.zeiten : [], kacheln: {}, inklusionProKlasse: {} };
    localStorage.setItem('stundenplan', JSON.stringify(newSp));
    if (typeof window.setStundenplan === 'function') window.setStundenplan(newSp);

    // Generator-Entwurf leeren
    localStorage.removeItem('ztInputDraft');

    // Zeitstempel hochsetzen, damit der Reset als neuester Stand gilt (auch für Archiv-Propagierung)
    const now = new Date().toISOString();
    localStorage.setItem('extraDataLastUpdate', now);
    localStorage.setItem('lastUpdate', now);
}

// --- Archiv-Ansicht (Zeitreise, read-only) ---
async function enterHalbjahrArchiveView() {
    let entry = null;
    try {
        if (typeof window.loadHalbjahrArchiveFromCloud === 'function') entry = await window.loadHalbjahrArchiveFromCloud();
    } catch (e) { entry = null; }
    if (!entry || !entry.data) { swal('Kein Archiv', 'Es ist kein archiviertes Halbjahr vorhanden.', 'info'); return; }

    // 1) Aktuelle Live-Daten lokal sichern (für die Rückkehr – auch offline)
    try {
        localStorage.setItem(ARCHIVE_LIVE_BACKUP_KEY, JSON.stringify(buildCurrentSnapshot()));
    } catch (e) {
        swal('Fehler', 'Die aktuellen Daten konnten nicht gesichert werden. Ansicht abgebrochen.', 'error');
        return;
    }
    // 2) Cloud-Sync hart pausieren (kein Hochladen, kein Live-Listener)
    if (typeof window.pauseCloudSync === 'function') window.pauseCloudSync();
    else window.__archiveViewMode = true;
    // 3) Archiv-Daten laden und anzeigen
    ztApplySnapshotToApp(entry.data);
    showArchiveViewBanner(entry.name || 'Halbjahr');
    hideModal();
    ztRerenderAfterDataSwap();
}

function exitHalbjahrArchiveView() {
    let backup = null;
    try { backup = JSON.parse(localStorage.getItem(ARCHIVE_LIVE_BACKUP_KEY) || 'null'); } catch (e) { backup = null; }

    if (backup) {
        ztApplySnapshotToApp(backup);
    }
    localStorage.removeItem(ARCHIVE_LIVE_BACKUP_KEY);
    hideArchiveViewBanner();

    // Sync wieder einschalten (Listener neu aufsetzen)
    if (typeof window.resumeCloudSync === 'function') window.resumeCloudSync();
    else window.__archiveViewMode = false;

    // Falls keine lokale Sicherung vorhanden war: aktuellen Stand frisch aus der Cloud holen.
    if (!backup && typeof window.forceRefreshFromCloud === 'function') {
        window.forceRefreshFromCloud().then(() => ztRerenderAfterDataSwap());
    } else {
        ztRerenderAfterDataSwap();
    }
}

async function ztDeleteHalbjahrArchive() {
    const willDelete = await swal({
        title: 'Archiv löschen?',
        text: 'Das archivierte Halbjahr wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.',
        icon: 'warning',
        buttons: ['Abbrechen', 'Endgültig löschen'],
        dangerMode: true
    });
    if (!willDelete) return;
    try {
        if (typeof window.deleteHalbjahrArchiveFromCloud === 'function') await window.deleteHalbjahrArchiveFromCloud();
    } catch (e) {
        console.error('Archiv löschen fehlgeschlagen:', e);
        swal('Fehler', 'Das Archiv konnte nicht gelöscht werden.', 'error');
        return;
    }
    ztRenderHalbjahrArchiveModal({ entry: null });
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
        workspace.innerHTML = `<div id="workspace-pan" style="position: absolute; top: 0; left: 0; width: 3000px; height: 3000px; transform-origin: 0 0; will-change: transform;"></div>`;
        workspace._panX = AppState.sitzplanPanX || 0;
        workspace._panY = AppState.sitzplanPanY || 0;
        const existingPan = document.getElementById('workspace-pan');
        if (existingPan) {
            existingPan.style.transform = `translate(${workspace._panX}px, ${workspace._panY}px)`;
        }
        workspace.style.backgroundPosition = `${workspace._panX}px ${workspace._panY}px`;
        
        // Momentum helper
        let momentumRaf = null;
        const computePanBounds = () => {
            const desks = document.querySelectorAll('#workspace-pan .desk');
            if (!desks.length) return null;
            const buf = 60;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            desks.forEach(d => {
                const l = parseFloat(d.style.left) || 0;
                const t = parseFloat(d.style.top) || 0;
                const w = d.offsetWidth || 80;
                const h = d.offsetHeight || 80;
                minX = Math.min(minX, l);
                minY = Math.min(minY, t);
                maxX = Math.max(maxX, l + w);
                maxY = Math.max(maxY, t + h);
            });
            const ws = workspace;
            return {
                minX: ws.clientWidth - (maxX + buf),
                maxX: -(minX - buf),
                minY: ws.clientHeight - (maxY + buf),
                maxY: -(minY - buf),
            };
        };
        const applyPan = (x, y) => {
            const pan = document.getElementById('workspace-pan');
            if (!pan) return;
            const b = computePanBounds();
            if (b) {
                // Grenzen normalisieren: ist der Sitzplan kleiner als der Viewport
                // (z. B. im Vollbild), sind min/max invertiert – dann würde die
                // zentrierte Position weggeclamped. min/max korrekt sortieren.
                const loX = Math.min(b.minX, b.maxX), hiX = Math.max(b.minX, b.maxX);
                const loY = Math.min(b.minY, b.maxY), hiY = Math.max(b.minY, b.maxY);
                x = Math.min(hiX, Math.max(loX, x));
                y = Math.min(hiY, Math.max(loY, y));
            }
            workspace._panX = x;
            workspace._panY = y;
            AppState.sitzplanPanX = x;
            AppState.sitzplanPanY = y;
            pan.style.transform = `translate(${x}px, ${y}px)`;
            workspace.style.backgroundPosition = `${x}px ${y}px`;
        };
        // Für das Vollbild zugänglich machen
        workspace._applyPan = applyPan;
        // Sitzplan mittig in den (Vollbild-)Workspace rücken
        workspace._centerView = () => {
            const ds = document.querySelectorAll('#workspace-pan .desk');
            if (!ds.length) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            ds.forEach(d => {
                const l = parseFloat(d.style.left) || 0, t = parseFloat(d.style.top) || 0;
                const w = d.offsetWidth || 80, h = d.offsetHeight || 80;
                minX = Math.min(minX, l); minY = Math.min(minY, t);
                maxX = Math.max(maxX, l + w); maxY = Math.max(maxY, t + h);
            });
            const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            applyPan(workspace.clientWidth / 2 - cx, workspace.clientHeight / 2 - cy);
        };
        const startMomentum = (vx, vy) => {
            if (momentumRaf) cancelAnimationFrame(momentumRaf);
            const decay = 0.96;
            const step = () => {
                vx *= decay;
                vy *= decay;
                if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) return;
                applyPan(workspace._panX + vx, workspace._panY + vy);
                momentumRaf = requestAnimationFrame(step);
            };
            momentumRaf = requestAnimationFrame(step);
        };

        // Touch-Panning
        let isTouchPanning = false;
        let touchStartX, touchStartY, touchStartOffsetX, touchStartOffsetY;
        let touchLastX, touchLastY, touchVX, touchVY;
        let lastTouchTime = 0;

        workspace.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            // Modus FRISCH aus classes[activeClassId] lesen (nicht aus der ggf. durch
            // Cloud-Sync veralteten Closure-Variable cls) – sonst startet beim Ziehen
            // eines Tisches im Bearbeiten-Modus zusätzlich das Hintergrund-Panning.
            const cm = classes[activeClassId] && classes[activeClassId].sitzplan
                ? classes[activeClassId].sitzplan.currentMode : null;
            if (e.target.closest('.desk') && cm === 'edit') return;
            if (momentumRaf) cancelAnimationFrame(momentumRaf);
            isTouchPanning = true;
            touchStartX = touchLastX = e.touches[0].clientX;
            touchStartY = touchLastY = e.touches[0].clientY;
            touchStartOffsetX = workspace._panX || 0;
            touchStartOffsetY = workspace._panY || 0;
            touchVX = touchVY = 0;
            lastTouchTime = Date.now();
        }, { passive: true });

        workspace.addEventListener('touchmove', (e) => {
            if (!isTouchPanning || e.touches.length !== 1) return;
            e.preventDefault();
            const now = Date.now();
            const dx = e.touches[0].clientX - touchLastX;
            const dy = e.touches[0].clientY - touchLastY;
            
            // Dämpfung/Glättung über gleitenden Durchschnitt
            touchVX = touchVX * 0.4 + dx * 0.6;
            touchVY = touchVY * 0.4 + dy * 0.6;
            
            touchLastX = e.touches[0].clientX;
            touchLastY = e.touches[0].clientY;
            lastTouchTime = now;
            
            applyPan(
                touchStartOffsetX + (e.touches[0].clientX - touchStartX),
                touchStartOffsetY + (e.touches[0].clientY - touchStartY)
            );
        }, { passive: false });

        workspace.addEventListener('touchend', () => {
            if (!isTouchPanning) return;
            isTouchPanning = false;
            
            // Falls der Nutzer vor dem Loslassen kurz angehalten hat, kein Nachrollen ausführen
            const timeSinceLastMove = Date.now() - lastTouchTime;
            if (timeSinceLastMove > 80) {
                touchVX = 0;
                touchVY = 0;
            }
            
            // Geschwindigkeit begrenzen
            const maxV = 45;
            touchVX = Math.min(maxV, Math.max(-maxV, touchVX));
            touchVY = Math.min(maxV, Math.max(-maxV, touchVY));
            
            startMomentum(touchVX, touchVY);
        });

        // Maus-Pan
        let isPanning = false;
        let panStartX, panStartY, panStartOffsetX, panStartOffsetY;
        let mouseLastX, mouseLastY, mouseVX, mouseVY;

        workspace.addEventListener('mousedown', (e) => {
            if (e.target.closest('.desk')) return;
            if (momentumRaf) cancelAnimationFrame(momentumRaf);
            isPanning = true;
            panStartX = mouseLastX = e.clientX;
            panStartY = mouseLastY = e.clientY;
            panStartOffsetX = workspace._panX || 0;
            panStartOffsetY = workspace._panY || 0;
            mouseVX = mouseVY = 0;
            workspace.style.cursor = 'grabbing';
            e.preventDefault();
        });

        if (workspace._panMoveHandler) document.removeEventListener('mousemove', workspace._panMoveHandler);
        if (workspace._panUpHandler) document.removeEventListener('mouseup', workspace._panUpHandler);

        workspace._panMoveHandler = (e) => {
            if (!isPanning) return;
            mouseVX = e.clientX - mouseLastX;
            mouseVY = e.clientY - mouseLastY;
            mouseLastX = e.clientX;
            mouseLastY = e.clientY;
            applyPan(
                panStartOffsetX + (e.clientX - panStartX),
                panStartOffsetY + (e.clientY - panStartY)
            );
        };
        workspace._panUpHandler = () => {
            if (!isPanning) return;
            isPanning = false;
            workspace.style.cursor = 'grab';
            startMomentum(mouseVX, mouseVY);
        };

        document.addEventListener('mousemove', workspace._panMoveHandler);
        document.addEventListener('mouseup', workspace._panUpHandler);

        // Bestehende Tische rendern
        cls.sitzplan.desks.forEach(desk => {
            renderDesk(desk);
        });

        // Initialen Pan-Wert mit Begrenzung anwenden (nachdem die Tische im DOM sind)
        applyPan(workspace._panX, workspace._panY);
    }
    
    // UI für den aktuellen Modus aktualisieren
    const editBtn = safeGetElement('edit-mode-btn');
    const evaluationBtn = safeGetElement('evaluation-mode-btn');
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
    
    const workspace = safeGetElement('workspace');
    const workspaceRect = workspace ? workspace.getBoundingClientRect() : { width: 800, height: 600 };
    
    // Prüfen, ob wir ein valides Layout-Messergebnis haben (> 100px Breite/Höhe)
    const hasValidSize = workspaceRect && workspaceRect.width > 100 && workspaceRect.height > 100;
    const workspaceWidth = hasValidSize ? workspaceRect.width : 800;
    const workspaceHeight = hasValidSize ? workspaceRect.height : 600;
    
    // Mitte des Workspace berechnen
    const centerX = (workspaceWidth - 90) / 2; // Tischbreite abziehen
    const centerY = (workspaceHeight - 60) / 2; // Tischhöhe abziehen
    
    // Neue Tische für Schüler ohne Tisch erstellen
    cls.students.forEach((student, index) => {
        // Prüfen, ob bereits ein Tisch für diesen Schüler existiert
        const existingDesk = existingDesks.find(desk => desk.studentIndex === index);
        if (!existingDesk) {
            existingDesks.push({
                id: `desk-${index}`,
                studentIndex: index,
                x: centerX,
                y: centerY,
                name: student.name
            });
        } else {
            // Falls der Tisch ungültige/negative Koordinaten hat (z.B. durch 0-Layout beim Öffnen)
            // und wir jetzt eine valide Größe haben, korrigieren wir die Position zur Mitte.
            if (hasValidSize && (existingDesk.x < 0 || existingDesk.y < 0)) {
                existingDesk.x = centerX;
                existingDesk.y = centerY;
            }
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
    
    if (workBtn) {
        workBtn.classList.toggle('active', mode === 'work');
    }
    
    // Tische neu rendern, um Punkte basierend auf Modus anzuzeigen
    renderSitzplanModule();
}

// Sitzplan-Vollbild (In-App-Overlay) – funktioniert auch auf iPhone/iPad,
// wo echtes Element-Vollbild (Fullscreen-API) nicht unterstützt wird.
function toggleSitzplanFullscreen() {
    const moduleEl = document.getElementById('sitzplan-module');
    if (!moduleEl) return;
    const ws = document.getElementById('workspace');
    const isFs = moduleEl.classList.toggle('sitzplan-fullscreen');
    const btn = document.getElementById('sitzplan-fullscreen-btn');
    if (btn) {
        btn.innerHTML = isFs ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
        btn.title = isFs ? 'Vollbild schließen' : 'Vollbild';
    }
    if (ws) {
        if (isFs) {
            // Vorherige Pan-Position merken und im Vollbild auf den Sitzplan zentrieren
            // (nach dem Layout-Umbruch, damit die Vollbild-Maße schon stehen).
            ws._fsPrevPan = { x: ws._panX || 0, y: ws._panY || 0 };
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (typeof ws._centerView === 'function') ws._centerView();
            }));
        } else {
            // Normalansicht: ursprüngliche Pan-Position wiederherstellen
            const prev = ws._fsPrevPan;
            requestAnimationFrame(() => {
                if (prev && typeof ws._applyPan === 'function') ws._applyPan(prev.x, prev.y);
            });
        }
    }
}
window.toggleSitzplanFullscreen = toggleSitzplanFullscreen;

// Vollbild beim Verlassen des Sitzplans sicher zurücksetzen (z. B. Tab-/Seitenwechsel)
function exitSitzplanFullscreen() {
    const moduleEl = document.getElementById('sitzplan-module');
    if (moduleEl && moduleEl.classList.contains('sitzplan-fullscreen')) {
        moduleEl.classList.remove('sitzplan-fullscreen');
        const btn = document.getElementById('sitzplan-fullscreen-btn');
        if (btn) { btn.innerHTML = '<i class="fas fa-expand"></i>'; btn.title = 'Vollbild'; }
        // Vor dem Vollbild gemerkte Pan-Position wiederherstellen
        const ws = document.getElementById('workspace');
        if (ws && ws._fsPrevPan && typeof ws._applyPan === 'function') {
            ws._applyPan(ws._fsPrevPan.x, ws._fsPrevPan.y);
        }
    }
}
window.exitSitzplanFullscreen = exitSitzplanFullscreen;

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
        
        deskContent = `<div class="desk-label ${student.learningSupport ? 'learning-support' : ''} ${student.eseSupport ? 'ese-support' : ''} ${highNegatives ? 'high-negatives-name' : ''}">${escapeHtml(student.name)}${participationHtml}</div>`;
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
    }, { passive: false, signal: deskSignal });
    
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
    
    const pan = document.getElementById('workspace-pan');
    (pan || workspace).appendChild(deskElement);
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
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0;">Schüler: ${escapeHtml(student.name)}</h4>
                    <button class="wizard-close-btn" onclick="hideModal()">&times;</button>
                </div>
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
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="margin:0;">Dieser Tisch ist leer</h4>
                    <button class="wizard-close-btn" onclick="hideModal()">&times;</button>
                </div>
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
        icon: "warning",
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
        icon: "warning",
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
    const originalText = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) { exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportiere...'; exportBtn.disabled = true; }
    
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
            if (!printWindow) { swal('Hinweis', 'Bitte Popup-Blocker deaktivieren um zu exportieren.', 'info'); return; }
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
            if (exportBtn) exportBtn.innerHTML = originalText;
            if (exportBtn) exportBtn.disabled = false;
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
            if (exportBtn) exportBtn.innerHTML = originalText;
            if (exportBtn) exportBtn.disabled = false;
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
        if (exportBtn) exportBtn.innerHTML = originalText;
        if (exportBtn) exportBtn.disabled = false;
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
        if (exportBtn) exportBtn.innerHTML = originalText;
        if (exportBtn) exportBtn.disabled = false;
        
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
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;

    const suggestions = document.getElementById(`search-suggestions-${module}`);
    if (!suggestions) return;

    const items = Array.from(suggestions.querySelectorAll('li:not(.no-results)'));
    if (items.length === 0) return;

    const currentIndex = items.findIndex(item => item.classList.contains('highlighted'));

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        let nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
            nextIndex = 0;
        }
        
        if (currentIndex !== -1) {
            items[currentIndex].classList.remove('highlighted');
        }
        items[nextIndex].classList.add('highlighted');
        
        // Scroll target item into view
        items[nextIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = items.length - 1;
        }
        
        if (currentIndex !== -1) {
            items[currentIndex].classList.remove('highlighted');
        }
        items[prevIndex].classList.add('highlighted');
        
        // Scroll target item into view
        items[prevIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (currentIndex !== -1) {
            items[currentIndex].click();
        } else if (items[0]) {
            items[0].click();
        }
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
        case 'noten': {
            // In Noten-Modul: .student-card Element finden
            const studentsList = document.getElementById('students-list');
            if (studentsList) {
                const studentCards = studentsList.querySelectorAll('.student-card');
                if (studentCards[studentIndex]) {
                    targetElement = studentCards[studentIndex];
                }
            }
            break;
        }
            
        case 'zeugnis': {
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
        tableHtml += `<td style="width: 200px; padding: ${padding}px;">${escapeHtml(student.name)}</td>`;
        
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
// calculateProjectAverage ist nach grades.js ausgelagert (global verfügbar).

// Funktion zum Umschalten der Zeugnisansicht (Durchschnitt an/aus)
function toggleZeugnisView() {
    AppState.zeugnisViewMode = AppState.zeugnisViewMode === 'individual' ? 'average' : 'individual';
    localStorage.setItem('zeugnisViewMode', AppState.zeugnisViewMode);
    
    // Update button styling
    const btn = safeGetElement('zeugnis-view-toggle');
    if (btn) {
        if (AppState.zeugnisViewMode === 'average') {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-warning');
        } else {
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-primary');
        }
    }
    
    renderZeugnisModule();
}

function renderZeugnisModule() {
    // Update button styling based on persisted state
    const btn = safeGetElement('zeugnis-view-toggle');
    if (btn) {
        if (AppState.zeugnisViewMode === 'average') {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-warning');
        } else {
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-primary');
        }
    }

    const container = safeGetElement('zeugnis-container');
    if (!container) return;

    // Immer mit der Listenansicht starten – Sitzplan-Ansicht zurücksetzen
    _zeugnisSitzplanView = false;
    const _sitzC = safeGetElement('zeugnis-sitzplan-container');
    if (_sitzC) _sitzC.style.display = 'none';
    container.style.display = '';
    const _sbtn = safeGetElement('zeugnis-sitzplan-toggle');
    if (_sbtn) { _sbtn.classList.remove('btn-warning'); _sbtn.classList.add('btn-primary'); }

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
                    averageHtml = `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd;"><strong>Durchschnitt: <span class="grade-badge ${avgGradeClass}">${average.rounded}</span></strong></div>`;
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
        let leftNotes = student.leftNotes || '- ';
        const rightNotes = student.rightNotes || '- ';
        if (student.rightNotes && student.rightNotes !== '- ' && student.rightNotes.trim() !== '') {
            const cleanLeft = (leftNotes === '- ' || leftNotes.trim() === '') ? '' : leftNotes;
            const cleanRight = (student.rightNotes === '- ' || student.rightNotes.trim() === '') ? '' : student.rightNotes;
            if (cleanLeft && cleanRight) {
                leftNotes = cleanLeft + '<br>' + cleanRight;
            } else if (cleanRight) {
                leftNotes = cleanRight;
            }
            student.leftNotes = leftNotes;
            student.rightNotes = '';
            // Save data locally and sync
            saveData(index);
        }

        // Notizen vorhanden?
        const _notesTmp = document.createElement('div');
        _notesTmp.innerHTML = student.leftNotes || '';
        const notesText = _notesTmp.textContent.trim();
        const notesActive = notesText.length > 0 && notesText !== '-' && notesText !== '- ';

        card.innerHTML = `
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: nowrap; gap: 8px;">
                <h3 style="margin: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(student.name)}</h3>
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                    <button class="btn-back-to-top-circle${notesActive ? ' notes-btn-active' : ''}" onclick="event.stopPropagation(); openNotesModal(${index})" title="Notizen"><i class="fas fa-pen"></i></button>
                    <button class="btn-back-to-top-circle" onclick="event.stopPropagation(); jumpToStudentInSitzplan(${index})" title="Im Sitzplan zeigen"><i class="fas fa-chair"></i></button>
                    <button class="btn-back-to-top-circle" onclick="event.stopPropagation(); document.documentElement.scrollTop=0; document.body.scrollTop=0; window.scrollTo(0,0);" title="Nach oben"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn-back-to-top-circle" onclick="event.stopPropagation(); openSearchModal('zeugnis')" title="Suchen"><i class="fas fa-search"></i></button>
                </div>
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
                            <div>Hausaufgaben: ${homework}</div>
                            <div>Material: ${materials}</div>
                            <div>Störung: ${negative}</div>
                            ${konsequenzCount > 0 ? `<div>Konsequenz: ${konsequenzCount}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="zeugnis-section">
                    <div class="zn-inline" id="zn-inline-${index}">${zeugnisnoteInlineHtml(student, index)}</div>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

}

// ===== Zeugnisnote (KI-Notenvorschlag) – inline in der Schülerkarte =====
let _zeugnisnoteBusy = false;
let _zeugnisSitzplanView = false;  // false = Liste, true = Sitzplan-Ansicht (startet immer mit Liste)
let _znPendingQuestions = null;
let _znPendingMessages = null;
let _znPendingIndex = null;
let _znPendingRichtung = null;
let _znQuestionQueue = [];  // Durchlauf Variante B: Schüler-Indizes mit offenen Rückfragen

function formatKiGenerationError(error, fallback = 'Fehler beim Generieren.') {
    const message = String(error?.message || '').trim();
    const code = String(error?.code || '').toLowerCase();

    if (/zu lang|zu umfangreich|too long|too many/i.test(message) || code.includes('invalid-argument') || code.includes('invalid_argument')) {
        return 'Die Eingaben sind zu lang oder zu umfangreich. Bitte kürze den Text und versuche es erneut.';
    }
    if (/zu viele ki-anfragen|tageslimit|resource-exhausted|resource_exhausted/i.test(message) || code.includes('resource-exhausted') || code.includes('resource_exhausted')) {
        return message || 'Zu viele KI-Anfragen in kurzer Zeit. Bitte warte einen Moment und versuche es erneut.';
    }
    if (/nicht angemeldet|unauthenticated/i.test(message) || code.includes('unauthenticated')) {
        return 'Du bist nicht mehr angemeldet. Bitte melde dich erneut an.';
    }
    if (/network|failed to fetch|internet|fetch/i.test(message)) {
        return 'Die KI konnte gerade nicht erreicht werden. Bitte prüfe deine Internetverbindung und versuche es erneut.';
    }
    return message || fallback;
}

function getZeugnisnoteContext(student) {
    const schriftlicheNoten = (student.projects || [])
        .filter(p => p.grade && p.grade !== '-')
        .map(p => ({ name: p.name || 'Arbeit', grade: p.grade }));
    const avg = calculateProjectAverage(student.projects);
    return { schriftlicheNoten, durchschnitt: avg ? avg.exact : '', durchschnittNote: avg ? avg.rounded : '' };
}

// Liefert das komplette Inline-HTML des Zeugnisnote-Bereichs einer Karte
function zeugnisnoteInlineHtml(student, index) {
    const note = student.zeugnisnote || '';
    const text = student.zeugnisBegruendung || '';

    const circleClass = note ? Utils.getGradeColorClass(Utils.convertGrade(note)) : 'zn-grade-circle--empty';
    const circleContent = note || '';
    return `
        <div class="zn-top-row">
            <div class="zn-grade-circle ${circleClass}" onclick="znOpenGradePicker(event,${index})" title="Note manuell setzen" style="cursor:pointer;margin-left:auto;">${circleContent}</div>
        </div>
        <div class="zn-begruendung-wrap">
            <div class="zn-begruendung" contenteditable="true" id="zn-begruendung-${index}" oninput="saveZeugnisnoteBegruendung(${index})" onblur="zeugnisnoteBegruendungBlur(${index})" onkeydown="znBegruendungKeydown(event)">${escapeHtml(text || '• ')}</div>
            <button class="btn btn-primary btn-icon zn-wand-btn" onclick="znGenerateFromField(${index})" title="KI-Vorschlag generieren"><i class="fas fa-wand-magic-sparkles"></i></button>
        </div>`;
}

function znBegruendungKeydown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const newline = document.createTextNode('\n• ');
    range.insertNode(newline);
    range.setStartAfter(newline);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    newline.parentNode.dispatchEvent(new Event('input', { bubbles: true }));
}

const ZN_GRADES = ['','1','1-','2+','2','2-','3+','3','3-','4+','4','4-','5+','5'];

function znOpenGradePicker(e, index) {
    e.stopPropagation();
    document.querySelectorAll('.zn-grade-picker').forEach(el => el.remove());

    const picker = document.createElement('div');
    picker.className = 'zn-grade-picker';
    ZN_GRADES.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'zn-grade-picker-btn ' + (g ? Utils.getGradeColorClass(Utils.convertGrade(g)) : 'zn-grade-picker-btn--empty');
        btn.textContent = g;
        btn.onclick = (ev) => { ev.stopPropagation(); znSetGradeManually(index, g); picker.remove(); };
        picker.appendChild(btn);
    });

    const circle = e.currentTarget;
    circle.parentNode.style.position = 'relative';
    circle.parentNode.appendChild(picker);

    const close = (ev) => { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
}

function znSetGradeManually(index, newGrade) {
    const student = classes[activeClassId]?.students?.[index];
    if (!student) return;

    const oldGrade = (student.zeugnisnote || '').trim();
    student.zeugnisnote = newGrade;

    // Letztes Vorkommen der alten Note im Text ersetzen
    if (student.zeugnisBegruendung && oldGrade) {
        const oldPattern = `Note ${oldGrade}`;
        const newPattern = `Note ${newGrade}`;
        const lastIdx = student.zeugnisBegruendung.lastIndexOf(oldPattern);
        if (lastIdx !== -1) {
            student.zeugnisBegruendung =
                student.zeugnisBegruendung.substring(0, lastIdx) +
                newPattern +
                student.zeugnisBegruendung.substring(lastIdx + oldPattern.length);
        }
    }

    saveData();
    const c = document.getElementById(`zn-inline-${index}`);
    if (c) c.innerHTML = zeugnisnoteInlineHtml(student, index);
    // Notenkreis in der Sitzplan-Ansicht (falls offen) mit aktualisieren
    const sc = document.getElementById(`zn-sitz-circle-${index}`);
    if (sc) {
        const note2 = student.zeugnisnote || '';
        sc.className = 'zn-grade-circle ' + (note2 ? Utils.getGradeColorClass(Utils.convertGrade(note2)) : 'zn-grade-circle--empty');
        sc.textContent = note2;
    }
}

function znGenerateFromField(index) {
    if (activeClassId === null) return;
    const student = classes[activeClassId]?.students?.[index];
    if (!student) return;
    // Erst aktuellen DOM-Inhalt sichern, dann als Beobachtungen verwenden
    const el = document.getElementById(`zn-begruendung-${index}`);
    const rawContent = el?.innerText || student.zeugnisBegruendung || '';
    student.zeugnisBegruendung = rawContent;
    student.zeugnisSonstiges = rawContent.replace(/^•\s*/gm, '').replace(/•/g, '').trim();
    zeugnisnoteGenerate(index, null);
}

// ===== Zeugnis-Sitzplan-Ansicht (reduziert, scrollbar, Endnoten als Kreise) =====
function toggleZeugnisSitzplanView() {
    _zeugnisSitzplanView = !_zeugnisSitzplanView;
    _applyZeugnisView();
}

function _applyZeugnisView() {
    const listC = safeGetElement('zeugnis-container');
    const sitzC = safeGetElement('zeugnis-sitzplan-container');
    const btn = safeGetElement('zeugnis-sitzplan-toggle');
    if (_zeugnisSitzplanView) {
        if (listC) listC.style.display = 'none';
        if (sitzC) sitzC.style.display = 'block';
        if (btn) { btn.classList.remove('btn-primary'); btn.classList.add('btn-warning'); }
        renderZeugnisSitzplan();
    } else {
        if (sitzC) sitzC.style.display = 'none';
        if (listC) listC.style.display = '';
        if (btn) { btn.classList.remove('btn-warning'); btn.classList.add('btn-primary'); }
    }
}

function renderZeugnisSitzplan() {
    const container = safeGetElement('zeugnis-sitzplan-container');
    if (!container) return;
    const cls = classes[activeClassId];
    if (!cls || !cls.students || cls.students.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-chair"></i><p>Keine Schüler in dieser Klasse</p></div>`;
        return;
    }
    const desks = (cls.sitzplan && Array.isArray(cls.sitzplan.desks)) ? cls.sitzplan.desks : [];
    const placed = desks.filter(d => d && cls.students[d.studentIndex]);
    if (placed.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-chair"></i><p>Noch kein Sitzplan vorhanden. Lege ihn zuerst im Tab „Sitzplan" an.</p></div>`;
        return;
    }

    const TILE_W = 100, TILE_H = 86, PAD = 30, PAD_BOTTOM = 200;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    placed.forEach(d => {
        minX = Math.min(minX, d.x); minY = Math.min(minY, d.y);
        maxX = Math.max(maxX, d.x + TILE_W); maxY = Math.max(maxY, d.y + TILE_H);
    });
    const offX = PAD - minX, offY = PAD - minY;
    const canvasW = (maxX - minX) + PAD * 2;
    const canvasH = (maxY - minY) + PAD + PAD_BOTTOM;

    let tiles = '';
    placed.forEach(d => {
        const index = d.studentIndex;
        const student = cls.students[index];
        const note = student.zeugnisnote || '';
        const circleClass = note ? Utils.getGradeColorClass(Utils.convertGrade(note)) : 'zn-grade-circle--empty';
        const left = d.x + offX, top = d.y + offY;
        tiles += `
            <div class="zn-sitz-tile" id="zn-sitz-tile-${index}" style="left:${left}px; top:${top}px;" onclick="jumpToStudentInList(${index})" title="Zum Schüler in der Liste springen">
                <div class="zn-sitz-name">${escapeHtml(student.name)}</div>
                <div class="zn-sitz-circle-wrap" style="position:relative;">
                    <div class="zn-grade-circle ${circleClass}" id="zn-sitz-circle-${index}" onclick="znOpenGradePicker(event,${index})" title="Note setzen" style="cursor:pointer;">${note}</div>
                </div>
            </div>`;
    });

    container.innerHTML = `<div class="zn-sitzplan-canvas" style="width:${canvasW}px; height:${canvasH}px;">${tiles}</div>`;
}

// Vom Sitzplan zur Liste: zur Karte scrollen und das Textfeld fokussieren
function jumpToStudentInList(index) {
    _zeugnisSitzplanView = false;
    _applyZeugnisView();
    setTimeout(() => {
        const el = document.getElementById(`zn-begruendung-${index}`);
        const card = el ? el.closest('.student-card') : null;
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el) {
            el.focus();
            const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
            const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        }
    }, 60);
}

// Von der Liste zum Sitzplan: Ansicht wechseln und den Schüler kurz hervorheben
function jumpToStudentInSitzplan(index) {
    _zeugnisSitzplanView = true;
    _applyZeugnisView();
    setTimeout(() => {
        const tile = document.getElementById(`zn-sitz-tile-${index}`);
        if (tile) {
            tile.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            tile.classList.add('zn-sitz-highlight');
            setTimeout(() => tile.classList.remove('zn-sitz-highlight'), 2000);
        } else {
            swal('Hinweis', 'Für diesen Schüler gibt es noch keinen Platz im Sitzplan.', 'info');
        }
    }, 80);
}

window.toggleZeugnisSitzplanView = toggleZeugnisSitzplanView;
window.jumpToStudentInList = jumpToStudentInList;
window.jumpToStudentInSitzplan = jumpToStudentInSitzplan;

function openZeugnisnoteHinweisModal(index) {
    window.currentAdjustingStudentIndex = index;
    const textarea = document.getElementById('zeugnis-hinweis-textarea');
    if (textarea) {
        if (!window.temporaryAiHints) {
            window.temporaryAiHints = {};
        }
        textarea.value = window.temporaryAiHints[index] || '';
    }
    showModal('zeugnis-hinweis-modal');
}

function saveTemporaryAiHint() {
    const textarea = document.getElementById('zeugnis-hinweis-textarea');
    const index = window.currentAdjustingStudentIndex;
    if (textarea && index !== undefined && index !== null) {
        if (!window.temporaryAiHints) {
            window.temporaryAiHints = {};
        }
        window.temporaryAiHints[index] = textarea.value;
    }
}

async function zeugnisnoteGenerate(index, richtung, customMessages = null) {
    if (_zeugnisnoteBusy || activeClassId === null) return;
    const student = classes[activeClassId]?.students?.[index];
    if (!student) return;

    let hinweis = '';
    let apiRichtung = null;

    // Bestimme die Zielnote und den passenden Prompt-Hinweis für "besser" und "schlechter", wenn bereits eine Note existiert
    if ((richtung === 'besser' || richtung === 'schlechter') && student.zeugnisnote) {
        const allowedGrades = ["1", "1-", "2+", "2", "2-", "3+", "3", "3-", "4+", "4", "4-", "5+", "5"];
        const currentGrade = student.zeugnisnote.trim();
        const currentIndex = allowedGrades.indexOf(currentGrade);
        
        if (currentIndex !== -1) {
            let newIndex = currentIndex;
            if (richtung === 'besser') {
                newIndex = currentIndex - 1; // Besser -> Index verringern (Richtung 1)
            } else {
                newIndex = currentIndex + 1; // Schlechter -> Index erhöhen (Richtung 6)
            }

            if (newIndex >= 0 && newIndex < allowedGrades.length) {
                const newGrade = allowedGrades[newIndex];
                if (richtung === 'besser') {
                    hinweis = `WICHTIG: Die neue Endnote MUSS exakt "${newGrade}" sein (eine halbe Stufe besser als die vorherige Note "${currentGrade}"). Bitte formuliere den Begründungstext so um, dass er ganz leicht positiver/lobender ist und perfekt zu der Note "${newGrade}" passt.`;
                } else {
                    hinweis = `WICHTIG: Die neue Endnote MUSS exakt "${newGrade}" sein (eine halbe Stufe schlechter als die vorherige Note "${currentGrade}"). Bitte formuliere den Begründungstext so um, dass er ganz leicht kritischer bzw. weniger lobend ist und perfekt zu der Note "${newGrade}" passt.`;
                }
                apiRichtung = null; // Über den Hinweis steuern, um Doppel-Modifikatoren zu vermeiden
            }
        }
    } else if (richtung === 'hinweis') {
        const hinweisEl = document.getElementById('zeugnis-hinweis-textarea');
        hinweis = hinweisEl ? hinweisEl.value.trim() : '';
        if (!hinweis) { swal('Hinweis', 'Bitte gib einen Hinweis ein.', 'info'); return; }
        hideModal();
        apiRichtung = null;
    } else {
        apiRichtung = richtung;
    }

    const { schriftlicheNoten, durchschnitt, durchschnittNote } = getZeugnisnoteContext(student);
    const fachart = classes[activeClassId]?.gewichtung === 'nebenfach' ? 'nebenfach' : 'hauptfach';

    // Ladeansicht
    const container = document.getElementById(`zn-inline-${index}`);
    if (container) {
        const hasExisting = student.zeugnisnote && student.zeugnisBegruendung;
        if (hasExisting) {
            const begruendungEl = document.getElementById(`zn-begruendung-${index}`);
            if (begruendungEl) {
                // Aktuelle Höhe exakt einfrieren, damit das Feld beim Generieren
                // NICHT seine Größe ändert (sonst springt die Ansicht). offsetHeight
                // enthält Padding/Border – mit box-sizing:border-box bleibt die
                // sichtbare Höhe daher unverändert. Der neue Text füllt das Feld
                // danach ohnehin wieder (finally baut das Inline-HTML neu auf).
                const _lockH = begruendungEl.offsetHeight;
                begruendungEl.style.boxSizing = 'border-box';
                begruendungEl.style.height = _lockH + 'px';
                begruendungEl.style.minHeight = '0';
                begruendungEl.style.overflow = 'hidden';
                begruendungEl.style.display = 'flex';
                begruendungEl.style.alignItems = 'center';
                begruendungEl.style.justifyContent = 'center';
                begruendungEl.style.padding = '0';
                begruendungEl.innerHTML = `<i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>`;
            }
            const actionsEl = container.querySelector('.zn-actions');
            if (actionsEl) {
                actionsEl.style.opacity = '0.5';
                actionsEl.style.pointerEvents = 'none';
            }
            const triggerEl = container.querySelector('.zn-generate-trigger');
            if (triggerEl) {
                triggerEl.disabled = true;
            }
        } else {
            // Erstmaliges Erstellen: Platzhalter-Layout, damit die Karte nicht springt
            container.innerHTML = `
                <div class="zn-top-row">
                    <div class="zn-grade-circle zn-grade-circle--empty" style="margin-left:auto;"></div>
                </div>
                <div class="zn-begruendung-wrap">
                    <div class="zn-begruendung" id="zn-begruendung-${index}" style="display: flex; align-items: center; justify-content: center; min-height: 260px; padding: 0;">
                        <i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>
                    </div>
                </div>
            `;
        }
    }
    _zeugnisnoteBusy = true;

    // Baue die initialen Messages auf, falls nicht übergeben
    let activeMessages = customMessages;
    if (!activeMessages) {
        let userMsg = '';
        if (Array.isArray(schriftlicheNoten) && schriftlicheNoten.length > 0) {
            const liste = schriftlicheNoten.map(n => `${n.name || 'Arbeit'}: ${n.grade}`).join(', ');
            userMsg += `Schriftliche Einzelnoten (Name der Arbeit: Note): ${liste}\n`;
        } else {
            userMsg += `Es liegen keine schriftlichen Noten vor.\n`;
        }
        if (durchschnitt) {
            userMsg += `Schriftliche Durchschnittsnote: ${durchschnittNote}\n`;
        }
        userMsg += `Beobachtungen zur mündlichen Mitarbeit:\n\n${(student.zeugnisSonstiges || '').trim() || "Keine Angabe"}\n`;

        if (fachart === "nebenfach") {
            userMsg += `\nArt des Fachs: Nebenfach. Bei diesem Fach zählt die mündliche Leistung für die Endnote deutlich mehr als die schriftliche Leistung.\n`;
            const _fachName = (classes[activeClassId]?.name || '').trim();
            if (_fachName) {
                userMsg += `\nUnterrichtsfach: ${_fachName}\n`;
            }
            userMsg += `\nNUR FÜR DIESES NEBENFACH gilt zusätzlich folgende Vorgabe (sie überschreibt das entsprechende Verbot im System-Prompt):\n`;
            userMsg += `Reihenfolge der Stichpunkte im mitarbeit_text: zuerst die Stichpunkte zu den Beobachtungen. Danach als VORLETZTER Stichpunkt der Gewichtungshinweis, wörtlich (setze für FACH nur den Namen des Unterrichtsfachs ein, z. B. Musik – ohne Klassen- oder Jahrgangsangabe): "• Im Nebenfach FACH zählen deine mündlichen Beiträge, deine Arbeitshaltung und deine Motivation insgesamt mehr als die schriftlichen Noten." Als ALLERLETZTER Stichpunkt die Endnote (nur die Note, ohne Begründung).\n`;
        } else {
            userMsg += `\nArt des Fachs: Hauptfach. Bei diesem Fach zählen die schriftliche und die mündliche Leistung für die Endnote ungefähr gleich viel.\n`;
        }

        if (apiRichtung === "besser") {
            userMsg += `\nWICHTIG: Schlage eine etwas BESSERE Note vor als beim normalen Abwägen und passe die Begründung entsprechend an.`;
        } else if (apiRichtung === "schlechter") {
            userMsg += `\nWICHTIG: Schlage eine etwas SCHLECHTERE Note vor als beim normalen Abwägen und passe die Begründung entsprechend an.`;
        }
        if (hinweis && hinweis.trim()) {
            userMsg += `\nZusätzlicher Hinweis der Lehrkraft, den du berücksichtigen sollst: ${hinweis.trim()}`;
        }
        activeMessages = [{ role: 'user', content: userMsg }];
    }

    try {
        if (typeof window.callGenerateZeugnisnote !== 'function') {
            throw new Error('Funktion nicht verfügbar.');
        }
        const result = await window.callGenerateZeugnisnote({
            schriftlicheNoten,
            durchschnitt,
            durchschnittNote,
            sonstiges: student.zeugnisSonstiges || '',
            fachart,
            richtung: apiRichtung,
            hinweis: hinweis,
            fachContext: classes[activeClassId]?.name || '',
            messages: activeMessages
        });

        if (result && result.status === 'unclear' && Array.isArray(result.questions) && result.questions.length > 0) {
            _zeugnisnoteBusy = false;
            // Setze Ladeansicht zurück, falls es das erste Mal war und keine Note existiert
            if (!student.zeugnisnote && container) {
                container.innerHTML = zeugnisnoteInlineHtml(student, index);
            }
            showZnClarifyingQuestionsModal(result.questions, activeMessages, index, richtung);
            return;
        }

        if (!result || !result.note) {
            throw new Error('Kein gültiger Notenvorschlag erhalten.');
        }

        let noteToSet = result.note;
        let textToSet = result.begruendung || '';

        // Falls die KI trotz Hinweis eine andere Note generiert hat (Fallbacksicherung),
        // erzwingen wir die gewünschte Zielnote und korrigieren den Schlusssatz.
        if ((richtung === 'besser' || richtung === 'schlechter') && student.zeugnisnote) {
            const allowedGrades = ["1", "1-", "2+", "2", "2-", "3+", "3", "3-", "4+", "4", "4-", "5+", "5"];
            const currentGrade = student.zeugnisnote.trim();
            const currentIndex = allowedGrades.indexOf(currentGrade);
            if (currentIndex !== -1) {
                const targetIndex = richtung === 'besser' ? currentIndex - 1 : currentIndex + 1;
                if (targetIndex >= 0 && targetIndex < allowedGrades.length) {
                    const expectedGrade = allowedGrades[targetIndex];
                    if (noteToSet !== expectedGrade) {
                        console.warn(`KI gab Note ${noteToSet} statt ${expectedGrade} zurück. Erzwinge ${expectedGrade}.`);
                        noteToSet = expectedGrade;
                        const escapedOldGrade = result.note.replace(/[-+]/g, '\\$&');
                        const regex = new RegExp(`Note\\s+${escapedOldGrade}(?=\\s*\\.?\\s*$)`, 'i');
                        if (regex.test(textToSet)) {
                            textToSet = textToSet.replace(regex, `Note ${expectedGrade}`);
                        } else {
                            const lastIndex = textToSet.lastIndexOf(`Note ${result.note}`);
                            if (lastIndex !== -1) {
                                textToSet = textToSet.substring(0, lastIndex) + `Note ${expectedGrade}` + textToSet.substring(lastIndex + `Note ${result.note}`.length);
                            }
                        }
                      }
                  }
              }
          }

          // Note direkt setzen + speichern
          student.zeugnisnote = noteToSet;
          student.zeugnisBegruendung = textToSet;
          saveData(index);
          if (window.temporaryAiHints) {
              delete window.temporaryAiHints[index];
          }
      } catch (err) {
          console.error('Zeugnisnote-Fehler:', err);
          swal('Fehler', formatKiGenerationError(err), 'error');
      } finally {
          _zeugnisnoteBusy = false;
          const c = document.getElementById(`zn-inline-${index}`);
          if (c) c.innerHTML = zeugnisnoteInlineHtml(student, index);
      }
  }

  function showZnClarifyingQuestionsModal(questions, originalMessages, index, richtung) {
      const body = document.getElementById('zn-questions-body');
      if (!body) return;
      
      body.innerHTML = '';
      _znPendingQuestions = questions;
      _znPendingMessages = originalMessages;
      _znPendingIndex = index;
      _znPendingRichtung = richtung;
      
      questions.forEach((q, idx) => {
          const group = document.createElement('div');
          group.className = 'form-group';
          group.style.marginBottom = '15px';
          
          group.innerHTML = `
              <label style="font-weight: 600; margin-bottom: 5px; display: block;">${ztEsc(q)}</label>
              <textarea class="form-control zn-answer-input" rows="2" placeholder="Deine Antwort..." style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd; font-family:inherit;"></textarea>
          `;
          body.appendChild(group);
      });
      
      showModal('zn-questions-modal');
  }

  async function znSubmitAnswers() {
      const inputs = document.querySelectorAll('.zn-answer-input');
      const answers = [];
      inputs.forEach(input => {
          answers.push((input.value || '').trim());
      });
      
      const hasAtLeastOneAnswer = answers.some(ans => ans.length > 0);
      if (!hasAtLeastOneAnswer) {
          swal('Info', 'Bitte beantworte mindestens eine der Rückfragen.', 'info');
          return;
      }
      
      hideModal();
      
      const questions = _znPendingQuestions || [];
      let answerContent = 'Hier sind die Antworten auf deine Rückfragen:\n';
      questions.forEach((q, idx) => {
          const ans = answers[idx] || 'Keine Angabe';
          answerContent += `${idx + 1}. Frage: "${q}"\n   Antwort: "${ans}"\n`;
      });
      
      const KIQuestionsStr = JSON.stringify({ status: 'unclear', questions: questions });
      _znPendingMessages.push({ role: 'assistant', content: KIQuestionsStr });
      _znPendingMessages.push({ role: 'user', content: answerContent });

      const answeredIndex = _znPendingIndex;
      await zeugnisnoteGenerate(answeredIndex, _znPendingRichtung, _znPendingMessages);

      // Durchlauf Variante B: Wenn dieser Schüler jetzt eine Note hat (also nicht
      // erneut Rückfragen kamen) und noch weitere in der Warteschlange sind, weiter.
      const resolved = classes[activeClassId]?.students?.[answeredIndex];
      if (_znQuestionQueue.length > 0 && resolved && resolved.zeugnisnote) {
          _znProcessNextQuestion();
      }
  }

// Rückfragen-Modal schließen. Im Durchlauf (Variante B) wird der Schüler dabei
// übersprungen und der nächste Rückfragen-Fall aufgerufen.
function znCloseQuestions() {
    hideModal();
    if (_znQuestionQueue.length > 0) {
        _znProcessNextQuestion();
    }
}
window.znCloseQuestions = znCloseQuestions;

function saveZeugnisnoteBegruendung(index) {
    if (activeClassId === null) return;
    const el = document.getElementById(`zn-begruendung-${index}`);
    const student = classes[activeClassId]?.students?.[index];
    if (!el || !student) return;
    student.zeugnisBegruendung = el.innerText;
    saveData(index);
}

// Beim Verlassen des Begründungsfeldes: Ist der Text leer (auch nur Whitespace/\n
// aus einem geleerten contenteditable), wird die Endnote ebenfalls entfernt –
// ohne Begründungstext soll es keine Endnote geben. Es muss dann ein neuer Text
// generiert werden. Bewusst onblur statt oninput, damit das Kästchen nicht mitten
// im Bearbeiten wegspringt und den Fokus reißt.
function zeugnisnoteBegruendungBlur(index) {
    if (activeClassId === null) return;
    const el = document.getElementById(`zn-begruendung-${index}`);
    const student = classes[activeClassId]?.students?.[index];
    if (!el || !student) return;
    const txt = (el.innerText || '').trim().replace(/^•\s*$/, '');
    if (!txt) {
        student.zeugnisnote = '';
        student.zeugnisBegruendung = '';
        saveData(index);
        const c = document.getElementById(`zn-inline-${index}`);
        if (c) c.innerHTML = zeugnisnoteInlineHtml(student, index);
    }
}

// ===== Beobachtungen-Modal (Eingabe für KI-Notenvorschlag) =====
let _zeugnisInputIndex = null;

function openZeugnisnoteInput(index) {
    if (activeClassId === null) return;
    const student = classes[activeClassId]?.students?.[index];
    if (!student) return;
    _zeugnisInputIndex = index;
    const titleEl = document.getElementById('zeugnis-input-title');
    const ta = document.getElementById('zeugnis-input-textarea');
    if (titleEl) titleEl.textContent = `Beobachtungen (${student.name})`;
    // Vorausfüllen: gespeicherte Beobachtungen, sonst manuelle Notizen aus dem Textfeld
    const begruendungEl = document.getElementById(`zn-begruendung-${index}`);
    const manuelleNotizen = ((begruendungEl?.innerText || student.zeugnisBegruendung || '')
        .replace(/^•\s*/gm, '').replace(/•/g, '').trim());
    if (ta) ta.value = student.zeugnisSonstiges || manuelleNotizen;
    showModal('zeugnis-input-modal');
    if (ta) ta.focus();
}

function saveZeugnisInputLocal() {
    if (_zeugnisInputIndex === null || activeClassId === null) return;
    const ta = document.getElementById('zeugnis-input-textarea');
    const student = classes[activeClassId]?.students?.[_zeugnisInputIndex];
    if (!ta || !student) return;
    student.zeugnisSonstiges = ta.value;
    localStorage.setItem('classes', JSON.stringify(classes));
}

async function zeugnisInputGenerate() {
    if (_zeugnisInputIndex === null) return;
    const index = _zeugnisInputIndex;
    saveZeugnisInputLocal();
    hideModal();
    await zeugnisnoteGenerate(index, null);
}
window.openZeugnisnoteInput = openZeugnisnoteInput;
window.saveZeugnisInputLocal = saveZeugnisInputLocal;
window.zeugnisInputGenerate = zeugnisInputGenerate;

// ===== Durchlauf: Beobachtungen für mehrere Schüler nacheinander =====
let _zbOpenIndices = [];   // Schüler-Indizes (offen, Variante B: nicht Note UND Text)
let _zbPos = 0;            // Position innerhalb von _zbOpenIndices

// Ein Zeugnis gilt nur als fertig, wenn Note UND ein nicht-leerer Begründungstext da sind.
// .trim() ist wichtig: ein geleertes contenteditable-Feld hinterlässt oft Whitespace/\n,
// sonst würde ein gelöschter Text weiterhin als "fertig" zählen.
function zeugnisIstFertig(s) {
    return !!(s && String(s.zeugnisnote || '').trim() && String(s.zeugnisBegruendung || '').trim());
}

function openZeugnisBatch() {
    if (activeClassId === null) return;
    const students = classes[activeClassId]?.students || [];
    // Offen = Zeugnis noch nicht fertig (Note + Begründung)
    _zbOpenIndices = students
        .map((s, i) => i)
        .filter(i => !zeugnisIstFertig(students[i]));
    if (_zbOpenIndices.length === 0) {
        swal('Durchlauf', 'Alle Schüler haben bereits eine Zeugnisnote.', 'info');
        return;
    }
    _zbPos = 0;
    const footer = document.getElementById('zeugnis-batch-footer');
    if (footer) footer.style.display = '';
    showModal('zeugnis-batch-modal');
    renderZeugnisBatch();
}

function renderZeugnisBatch() {
    const body = document.getElementById('zeugnis-batch-body');
    if (!body || activeClassId === null) return;
    const total = _zbOpenIndices.length;
    const idx = _zbOpenIndices[_zbPos];
    const student = classes[activeClassId].students[idx];
    if (!student) return;
    body.innerHTML = `
        <div class="zeugnis-batch-counter">Schüler ${_zbPos + 1} von ${total} (offen) · <strong>${escapeHtml(student.name)}</strong></div>
        <textarea id="zeugnis-batch-textarea" class="form-control zeugnis-batch-textarea" placeholder="Sonstige Mitarbeit im Unterricht – z. B. beteiligt sich rege am Unterricht, hilft Mitschülern, arbeitet bei Experimenten sehr sorgfältig..." oninput="_zbSaveCurrentLocal()">${escapeHtml(student.zeugnisSonstiges || '')}</textarea>`;
    const prevBtn = document.getElementById('zb-prev');
    const nextBtn = document.getElementById('zb-next');
    if (prevBtn) prevBtn.disabled = _zbPos === 0;
    if (nextBtn) nextBtn.disabled = _zbPos === total - 1;
    _zbUpdateGenerateLabel();
    const ta = document.getElementById('zeugnis-batch-textarea');
    if (ta) ta.focus();
}

// Anzahl der Schüler mit eingegebenen Beobachtungen im Generieren-Button anzeigen
function _zbUpdateGenerateLabel() {
    const labelEl = document.getElementById('zb-generate-label');
    if (!labelEl || activeClassId === null) return;
    _zbReadCurrentToModel();
    const count = _zbOpenIndices.filter(i => {
        const s = classes[activeClassId].students[i];
        return s && (s.zeugnisSonstiges || '').trim();
    }).length;
    labelEl.textContent = count === 0 ? 'Erstellen'
        : count === 1 ? '1 Zeugnis erstellen'
        : `${count} Zeugnisse erstellen`;
}

function _zbReadCurrentToModel() {
    const ta = document.getElementById('zeugnis-batch-textarea');
    if (!ta || activeClassId === null) return;
    const student = classes[activeClassId]?.students?.[_zbOpenIndices[_zbPos]];
    if (student) student.zeugnisSonstiges = ta.value;
}

// Bei jedem Tastendruck: nur lokal (kein Cloud-Sync)
function _zbSaveCurrentLocal() {
    _zbReadCurrentToModel();
    localStorage.setItem('classes', JSON.stringify(classes));
    _zbUpdateGenerateLabel();
}

// Beim Blättern/Schließen: Cloud-Sync, damit man auf anderen Geräten weitermachen kann
function _zbSaveCloud() {
    _zbReadCurrentToModel();
    saveData(_zbOpenIndices[_zbPos]);
}

function zeugnisBatchNav(dir) {
    if (_zeugnisnoteBusy) return;
    const total = _zbOpenIndices.length;
    const next = _zbPos + dir;
    if (next < 0 || next >= total) return;
    _zbSaveCloud();
    _zbPos = next;
    renderZeugnisBatch();
}

function closeZeugnisBatch() {
    if (_zeugnisnoteBusy) return;
    _zbSaveCloud();
    hideModal();
}

async function zeugnisBatchGenerate() {
    if (_zeugnisnoteBusy || activeClassId === null) return;
    _zbReadCurrentToModel();
    // Zielschüler: offene mit nicht-leeren Beobachtungen
    const targets = _zbOpenIndices.filter(i => {
        const s = classes[activeClassId].students[i];
        return s && (s.zeugnisSonstiges || '').trim();
    });
    if (targets.length === 0) {
        swal('Durchlauf', 'Du hast bei keinem Schüler Beobachtungen eingegeben.', 'info');
        return;
    }

    _zeugnisnoteBusy = true;
    // Cloud-Realtime-Updates während des Durchlaufs pausieren. Sonst kann der
    // onSnapshot-Listener das classes-Objekt mitten in der Schleife austauschen,
    // wodurch bereits geschriebene Texte (außer dem ersten) verloren gehen.
    window._zeugnisBatchRunning = true;
    const body = document.getElementById('zeugnis-batch-body');
    const footer = document.getElementById('zeugnis-batch-footer');
    if (footer) footer.style.display = 'none';

    const fachart = classes[activeClassId]?.gewichtung === 'nebenfach' ? 'nebenfach' : 'hauptfach';
    let done = 0;
    const failed = [];
    const needQuestions = [];  // Variante B: Rückfragen-Fälle erst nach dem Durchlauf abarbeiten

    try {
        for (let k = 0; k < targets.length; k++) {
            const idx = targets[k];
            const student = classes[activeClassId].students[idx];
            if (!student) continue;
            if (body) {
                body.innerHTML = `<div class="zn-loading"><i class="fas fa-circle-notch fa-spin"></i><span>Generiere ${k + 1} von ${targets.length} …<br>${escapeHtml(student.name)}</span></div>`;
            }
            try {
                if (typeof window.callGenerateZeugnisnote !== 'function') throw new Error('Funktion nicht verfügbar.');
                const { schriftlicheNoten, durchschnitt, durchschnittNote } = getZeugnisnoteContext(student);
                const result = await window.callGenerateZeugnisnote({
                    schriftlicheNoten,
                    durchschnitt,
                    durchschnittNote,
                    sonstiges: student.zeugnisSonstiges || '',
                    fachart,
                    richtung: null,
                    hinweis: '',
                    fachContext: classes[activeClassId]?.name || ''
                });
                // Rückfrage der KI: nicht als Fehler behandeln, sondern für später vormerken
                if (result && result.status === 'unclear' && Array.isArray(result.questions) && result.questions.length > 0) {
                    needQuestions.push(idx);
                    continue;
                }
                if (!result || !result.note) throw new Error('Kein gültiger Notenvorschlag erhalten.');
                student.zeugnisnote = result.note;
                student.zeugnisBegruendung = result.begruendung || '';
                done++;
            } catch (err) {
                console.error('Durchlauf-Fehler bei', student.name, err);
                failed.push(student.name);
            }
        }
    } finally {
        window._zeugnisBatchRunning = false;
        _zeugnisnoteBusy = false;
    }

    // Erst jetzt einmal speichern – der Objekt-Tausch durch die Cloud ist vorbei.
    saveData();
    hideModal();
    if (typeof renderZeugnisModule === 'function' && activeModule === 'zeugnis') {
        renderZeugnisModule();
    }

    // Variante B: Schüler mit Rückfragen nacheinander interaktiv abarbeiten
    if (needQuestions.length > 0) {
        _znQuestionQueue = needQuestions.slice();
        let msg = `${done} Zeugnisnote${done === 1 ? '' : 'n'} erstellt.`;
        msg += `\n\nBei ${needQuestions.length} Schüler${needQuestions.length === 1 ? '' : 'n'} hat die KI Rückfragen. Du wirst jetzt nacheinander gefragt.`;
        if (failed.length) msg += `\n\nFehlgeschlagen (${failed.length}): ${failed.join(', ')}`;
        swal('Fast fertig', msg, 'info').then(() => _znProcessNextQuestion());
        return;
    }

    let msg = `${done} Zeugnisnote${done === 1 ? '' : 'n'} erstellt.`;
    if (failed.length) msg += `\n\nFehlgeschlagen (${failed.length}): ${failed.join(', ')}`;
    swal(failed.length ? 'Teilweise fertig' : 'Fertig', msg, failed.length ? 'warning' : 'success');
}

// Variante B: nächsten Rückfragen-Schüler aus der Warteschlange abarbeiten.
// Ruft die normale Einzel-Generierung auf, die bei Bedarf das Rückfragen-Modal zeigt.
// Löst der erneute Versuch den Fall direkt (ohne Rückfrage), geht es selbst weiter.
async function _znProcessNextQuestion() {
    if (!_znQuestionQueue || _znQuestionQueue.length === 0) return;
    const idx = _znQuestionQueue.shift();
    await zeugnisnoteGenerate(idx, null);
    const s = classes[activeClassId]?.students?.[idx];
    if (s && s.zeugnisnote) {
        // Ohne Rückfrage gelöst → nächsten Fall starten. Sonst ist das Modal offen
        // und znSubmitAnswers/znCloseQuestions treibt die Warteschlange weiter.
        _znProcessNextQuestion();
    }
}
window._znProcessNextQuestion = _znProcessNextQuestion;

window.openZeugnisBatch = openZeugnisBatch;
window.closeZeugnisBatch = closeZeugnisBatch;
window.zeugnisBatchNav = zeugnisBatchNav;
window.zeugnisBatchGenerate = zeugnisBatchGenerate;
window._zbSaveCurrentLocal = _zbSaveCurrentLocal;
window.znSubmitAnswers = znSubmitAnswers;

// ===== Notizen-Modal (Zeugnis-Tab) =====
let _notesModalStudentIndex = null;

function openNotesModal(studentIndex) {
    if (activeClassId === null) return;
    _notesModalStudentIndex = studentIndex;
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;
    const titleEl = document.getElementById('notes-modal-title');
    const ta = document.getElementById('notes-modal-textarea');
    if (titleEl) titleEl.textContent = `Notizen (${student.name})`;
    if (ta) ta.innerHTML = student.leftNotes || '';
    showModal('notes-modal');
    if (ta) { ta.focus(); const r = document.createRange(); r.selectNodeContents(ta); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
}

function closeNotesModal() {
    saveNotesModalLocal();
    hideModal();
    _notesModalStudentIndex = null;
    renderZeugnisModule();
}

function saveNotesModalLocal() {
    if (_notesModalStudentIndex === null || activeClassId === null) return;
    const ta = document.getElementById('notes-modal-textarea');
    const student = classes[activeClassId]?.students?.[_notesModalStudentIndex];
    if (!ta || !student) return;
    student.leftNotes = ta.innerHTML;
    saveData(_notesModalStudentIndex);
}

window.openNotesModal = openNotesModal;
window.closeNotesModal = closeNotesModal;
window.saveNotesModalLocal = saveNotesModalLocal;

window.zeugnisnoteGenerate = zeugnisnoteGenerate;
window.openZeugnisnoteHinweisModal = openZeugnisnoteHinweisModal;
window.saveZeugnisnoteBegruendung = saveZeugnisnoteBegruendung;
window.zeugnisnoteBegruendungBlur = zeugnisnoteBegruendungBlur;
window.saveTemporaryAiHint = saveTemporaryAiHint;


function collapseStudentAndScrollToTop(module, studentIndex) {
    if (module === 'noten' && classes[activeClassId] && classes[activeClassId].students) {
        const studentsArray = getSortedStudents();
        if (studentIndex >= 0 && studentIndex < studentsArray.length) {
            const student = studentsArray[studentIndex];
            const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
            if (originalIndex !== -1 && classes[activeClassId].students[originalIndex].notenExpanded) {
                toggleStudentDetails('noten', studentIndex);
            }
        }
    }
    scrollToTopAndFocusSearch(module);
}

function scrollToTopAndFocusSearch(module) {
    openSearchModal(module);
}

// Spantext bei Tastatureingabe aufteilen, damit der neu getippte Text immer in Standardschriftart (schwarz) ist
function splitSpanAtCaret(event) {
    const isEnter = event.key === 'Enter';
    const isPrintableChar = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!isEnter && !isPrintableChar) {
        return;
    }

    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const container = range.startContainer;

    // Suche nach einem übergeordneten, farbcodierten Span-Element
    let span = container.nodeType === 3 ? container.parentNode : container;
    while (span && span.tagName !== 'SPAN' && span !== event.currentTarget) {
        span = span.parentNode;
    }

    // Wenn der Cursor in einem farbigen Span steht, brechen wir aus diesem aus, damit der Text schwarz wird bzw. der Umbruch außerhalb stattfindet
    if (span && span.tagName === 'SPAN' && span.className.match(/phrase-color-(blue|green|orange|red|yellow)/)) {
        event.preventDefault();

        // Node erstellen: Entweder ein BR-Element (bei Enter) oder einen TextNode (bei Zeichen)
        let newInsertedNode;
        if (isEnter) {
            newInsertedNode = document.createElement('br');
        } else {
            newInsertedNode = document.createTextNode(event.key);
        }

        let textNode = null;
        let offset = 0;

        if (container.nodeType === 3) {
            textNode = container;
            offset = range.startOffset;
        } else {
            // Fallback falls der Cursor direkt auf dem Element positioniert ist
            if (container.childNodes && container.childNodes.length > 0) {
                const child = container.childNodes[Math.min(range.startOffset, container.childNodes.length - 1)];
                if (child && child.nodeType === 3) {
                    textNode = child;
                    offset = range.startOffset >= container.childNodes.length ? child.nodeValue.length : 0;
                }
            }
        }

        if (textNode) {
            const text = textNode.nodeValue;
            const leftText = text.substring(0, offset);
            const rightText = text.substring(offset);

            if (leftText === '') {
                // Am Anfang des Spans: davor einfügen
                span.parentNode.insertBefore(newInsertedNode, span);
            } else if (rightText === '') {
                // Am Ende des Spans: danach einfügen
                if (span.nextSibling) {
                    span.parentNode.insertBefore(newInsertedNode, span.nextSibling);
                } else {
                    span.parentNode.appendChild(newInsertedNode);
                }
            } else {
                // In der Mitte des Spans: Span aufteilen und Text/Umbruch dazwischen einfügen
                const rightSpan = span.cloneNode(false);
                rightSpan.textContent = rightText;
                
                textNode.nodeValue = leftText;
                
                span.parentNode.insertBefore(newInsertedNode, span.nextSibling);
                span.parentNode.insertBefore(rightSpan, newInsertedNode.nextSibling);
            }
        } else {
            // Fallback: Einfaches Einfügen nach dem Span
            if (span.nextSibling) {
                span.parentNode.insertBefore(newInsertedNode, span.nextSibling);
            } else {
                span.parentNode.appendChild(newInsertedNode);
            }
        }

        // Cursor direkt hinter das neu eingefügte Element (BR oder TextNode) setzen
        const newRange = document.createRange();
        newRange.setStartAfter(newInsertedNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        // Falls wir ein BR eingefügt haben, müssen wir bei manchen Browsern (z.B. Chrome/Safari) 
        // sicherstellen, dass nach einem BR am Ende eines contenteditable-Blocks ein unsichtbarer Umbruch 
        // für die Visualisierung vorhanden ist, damit die Zeile fokussierbar bleibt.
        if (isEnter) {
            const parent = newInsertedNode.parentNode;
            if (parent && parent.lastChild === newInsertedNode) {
                const extraBr = document.createElement('br');
                parent.appendChild(extraBr);
                
                // Cursor MUSS vor dem extraBr (also direkt nach unserem echten BR) bleiben
                newRange.setStartAfter(newInsertedNode);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
        }

        // input-Event manuell triggern, damit die Notizen gespeichert werden
        const inputEvent = new Event('input', { bubbles: true });
        event.currentTarget.dispatchEvent(inputEvent);
    }
}
window.splitSpanAtCaret = splitSpanAtCaret;

function saveStudentNotes(studentIndex, isDebounced = false) {
    const leftTextarea = safeGetElement(`notes-left-${studentIndex}`);
    if (!leftTextarea) return;
    if (activeClassId === null || !classes[activeClassId] || !classes[activeClassId].students || !classes[activeClassId].students[studentIndex]) return;
    
    // KEIN .trim() beim Speichern, sonst werden Zeilenumbrüche am Ende (Enter) gelöscht
    const leftNotesText = leftTextarea.innerHTML;
    
    const student = classes[activeClassId].students[studentIndex];

    const hasChanges = student.leftNotes !== leftNotesText;
    if (!hasChanges) return;
    
    student.leftNotes = leftNotesText;

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

// Hilfsfunktion zur Umwandlung von Kurznoten (z.B. "3+") in Textform für den Export (z.B. "befriedigend (plus)")
// getExportGradeWord ist nach grades.js ausgelagert (global verfügbar).

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
            <meta charset="UTF-8">
            <title>Zeugnisse</title>
            <style>
                @page { size: A4; margin: 1.2cm; }
                * { box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; }
                .zeugnis {
                    border: 1.5px solid #475569;
                    border-radius: 12px;
                    padding: 16px 22px 18px;
                    margin-bottom: 0.5cm;
                    page-break-inside: avoid;    /* ein Schüler wird nie umgebrochen */
                    break-inside: avoid;
                    display: flex;
                    flex-direction: column;
                }
                .zeugnis:not(:last-child) {
                    page-break-after: always;
                    break-after: page;
                }
                .zg-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 2px solid #1f2937; padding-bottom: 8px; margin-bottom: 14px; }
                .zg-name { font-size: 1.55rem; font-weight: 800; letter-spacing: -0.01em; }
                .zg-class { font-size: 0.95rem; color: #475569; font-weight: 600; white-space: nowrap; }
                .zg-cols { display: flex; gap: 32px; margin-bottom: 14px; }
                .zg-col { flex: 1; }
                .zg-col h3 { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin: 0 0 6px; font-weight: 700; }
                .zg-col ul { list-style: none; margin: 0; padding: 0; }
                .zg-col li { font-size: 0.92rem; padding: 2px 0; }
                .zg-avg { margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 0.92rem; }
                .zg-note { font-size: 1.05rem; margin-top: 14px; }
                .zg-note strong { font-size: 1.15rem; }
                .zg-text-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; margin-top: 16px; margin-bottom: 5px; }
                .zg-text { font-size: 0.95rem; line-height: 1.6; text-align: justify; white-space: pre-wrap; }
            </style>
        </head>
        <body>
    `;
    
    const className = classes[activeClassId].name || '';
 
    classes[activeClassId].students.forEach(student => {
        // Schriftliche Noten – schlichter Text (kein farbiger Kreis)
        let gradesHtml = '';
        let averageHtml = '';
        if (student.projects && student.projects.length > 0) {
            gradesHtml = student.projects.map(project => {
                const grade = project.grade || '-';
                return `<li>${escapeHtml(project.name)}: <strong>${escapeHtml(grade)}</strong></li>`;
            }).join('');
            const average = calculateProjectAverage(student.projects);
            if (average) {
                averageHtml = `<div class="zg-avg">Durchschnitt: <strong>${average.rounded}</strong></div>`;
            }
        } else {
            gradesHtml = '<li>Keine Noten vorhanden</li>';
        }
 
        // Sonstiges
        const homework = student.homework || 0;
        const materials = student.materials || 0;
        const negative = student.participation ? student.participation.negative || 0 : 0;
        const printKonsequenzCount = student.hwHistory ? student.hwHistory.filter(e => e.type === 'abschreibtext' || e.type === 'nachsitzen').length : 0;
 
        // Zeugnisnote + generierter Text (Notizen werden NICHT exportiert)
        const zeugnisnoteWort = getExportGradeWord(student.zeugnisnote || '');
        const zeugnisBegruendung = student.zeugnisBegruendung || '';
 
        allPrintHtml += `
            <div class="zeugnis">
                <div class="zg-head">
                    <span class="zg-name">${escapeHtml(student.name)}</span>
                    ${className ? `<span class="zg-class">${escapeHtml(className)}</span>` : ''}
                </div>
                <div class="zg-cols">
                    <div class="zg-col">
                        <h3>Schriftliche Leistungen</h3>
                        <ul>${gradesHtml}</ul>
                        ${averageHtml}
                    </div>
                    <div class="zg-col">
                        <h3>Sonstiges</h3>
                        <ul>
                            <li>Hausaufgaben: ${homework}</li>
                            <li>Material: ${materials}</li>
                            <li>Störung: ${negative}</li>
                            ${printKonsequenzCount > 0 ? `<li>Konsequenz: ${printKonsequenzCount}</li>` : ''}
                        </ul>
                    </div>
                </div>
                ${zeugnisBegruendung ? `<div class="zg-text-label">Beurteilung</div><div class="zg-text">${escapeHtml(zeugnisBegruendung)}</div>` : ''}
                ${zeugnisBegruendung ? `<div class="zg-note">Zeugnisnote: <strong>${zeugnisnoteWort}</strong></div>` : ''}
            </div>
        `;
    });
    
    allPrintHtml += `
        </body>
        </html>
    `;
    
    // Öffne in neuem Fenster
    const printWindow = window.open('', '_blank');
    if (!printWindow) { swal('Hinweis', 'Bitte Popup-Blocker deaktivieren um zu exportieren.', 'info'); return; }
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
        item.style.cursor = 'pointer';
        item.onclick = function(e) {
            toggleTerminAusblenden(termin.id, !isHidden);
        };

        const formattedDate = new Date(termin.date + 'T00:00:00').toLocaleDateString('de-DE', {
            weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
        });

        // Uhrzeiten im Termine-Modal nicht anzeigen (timeDisplay bleibt leer)
        const timeDisplay = '';

        item.innerHTML = `
            <div class="termin-info">
                ${statusIcon}
                <div class="termin-info-text">
                    <span class="termin-date">${formattedDate}${timeDisplay}</span>
                    <span class="termin-title">${termin.title}</span>
                </div>
            </div>
        `;

        container.appendChild(item);
    });
}

function deleteTermin(terminId) {
    swal({
        title: 'Termin löschen?',
        text: 'Möchtest du diesen Termin wirklich löschen?',
        icon: 'warning',
        buttons: [false, 'Löschen'],
        dangerMode: true,
    }).then((willDelete) => {
        if (willDelete) {
            const deletedIds = JSON.parse(localStorage.getItem('deletedTermineIds') || '[]');
            if (!deletedIds.includes(terminId)) deletedIds.push(terminId);
            localStorage.setItem('deletedTermineIds', JSON.stringify(deletedIds));
            AppState.termine = (AppState.termine || []).filter(t => t.id !== terminId);
            saveTermine();
            if (AppState.planung && AppState.planung.hiddenTermine) {
                AppState.planung.hiddenTermine = AppState.planung.hiddenTermine.filter(id => id !== terminId);
                savePlanung();
            }
            renderTermineList();
            renderPlanung();
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
    renderPlanung();
}

function editTermin(terminId) {
    const termin = (AppState.termine || []).find(t => t.id === terminId);
    if (!termin) return;

    const item = safeGetElement(`termin-item-${terminId}`);
    if (!item) return;

    item.className = 'termin-item termin-item-editing';
    item.innerHTML = `
        <div class="termin-edit-form" onclick="event.stopPropagation()">
            <div class="form-group">
                <input type="text" class="form-control" id="termin-edit-title-${terminId}" value="${termin.title}" placeholder="Bezeichnung">
            </div>
            <div class="form-group" style="display: flex; gap: 8px; margin-bottom: 10px;">
                <div style="flex: 1; display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 0.8rem; color: var(--grey-color);">Von:</span>
                    <input type="time" class="form-control" id="termin-edit-timestart-${terminId}" value="${termin.timeStart || ''}">
                </div>
                <div style="flex: 1; display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 0.8rem; color: var(--grey-color);">Bis:</span>
                    <input type="time" class="form-control" id="termin-edit-timeend-${terminId}" value="${termin.timeEnd || ''}">
                </div>
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
    const timeStartInput = safeGetElement(`termin-edit-timestart-${terminId}`);
    const timeEndInput = safeGetElement(`termin-edit-timeend-${terminId}`);
    if (!titleInput || !dateInput) return;

    const title = titleInput.value.trim();
    const date = dateInput.value;
    const timeStart = timeStartInput ? timeStartInput.value : '';
    const timeEnd = timeEndInput ? timeEndInput.value : '';

    if (!title || !date) {
        swal('Fehler', 'Bitte alle Felder ausfüllen', 'error');
        return;
    }

    const index = (AppState.termine || []).findIndex(t => t.id === terminId);
    if (index === -1) return;

    AppState.termine[index] = {
        ...AppState.termine[index],
        title: title,
        date: date,
        timeStart: timeStart,
        timeEnd: timeEnd
    };

    saveTermine();
    renderTermineList();
    renderPlanung();
}

// ===== ICS EXPORT HELPER FUNCTIONS =====

function generateICS(termine) {
    const now = new Date();
    const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Schulverwaltung//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];
    
    termine.forEach(t => {
        // Clean title for ICS (escape commas, semi-colons and newlines)
        const escapedTitle = t.title
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
            
        const formatDate = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}${m}${day}`;
        };
        
        const formatDateTime = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            return `${y}${m}${day}T${hh}${mm}${ss}`;
        };
        
        ics.push('BEGIN:VEVENT');
        ics.push(`UID:${t.id}@schulverwaltung`);
        ics.push(`DTSTAMP:${dtStamp}`);
        
        if (t.timeStart) {
            // Timed event
            const startDate = new Date(`${t.date}T${t.timeStart}:00`);
            let endDate;
            if (t.timeEnd) {
                endDate = new Date(`${t.date}T${t.timeEnd}:00`);
                if (endDate < startDate) {
                    endDate.setDate(endDate.getDate() + 1);
                }
            } else {
                endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // default +1 hour
            }
            ics.push(`DTSTART:${formatDateTime(startDate)}`);
            ics.push(`DTEND:${formatDateTime(endDate)}`);
        } else {
            // All-day event
            const startDate = new Date(t.date + 'T00:00:00');
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 1);
            ics.push(`DTSTART;VALUE=DATE:${formatDate(startDate)}`);
            ics.push(`DTEND;VALUE=DATE:${formatDate(endDate)}`);
        }
        
        ics.push(`SUMMARY:${escapedTitle}`);
        ics.push('DESCRIPTION:Termin aus der Schulverwaltung');
        ics.push('END:VEVENT');
    });
    
    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
}

function downloadICSFile(filename, content) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

window.exportAllTermineToICS = function() {
    const termine = AppState.termine || [];
    if (termine.length === 0) {
        swal('Fehler', 'Keine Termine vorhanden zum Exportieren.', 'error');
        return;
    }
    
    const icsContent = generateICS(termine);
    downloadICSFile('Termine_Schulverwaltung.ics', icsContent);
};

window.exportSingleTerminToICS = function(terminId) {
    const termin = (AppState.termine || []).find(t => t.id === terminId);
    if (!termin) return;
    
    const icsContent = generateICS([termin]);
    // Clean filename
    const safeTitle = termin.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    downloadICSFile(`Termin_${safeTitle}.ics`, icsContent);
};

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

    // Kalender-Zeitraum global laden (klassenübergreifend)
    let globalCalendarRange = { startDate: '', endDate: '' };
    try {
        const savedGlobal = localStorage.getItem('planung_global_calendar_range');
        if (savedGlobal) globalCalendarRange = JSON.parse(savedGlobal);
    } catch (e) {
        console.warn("Fehler beim Laden von planung_global_calendar_range:", e);
    }

    p.calendarStartDate = globalCalendarRange.startDate || '';
    p.calendarEndDate = globalCalendarRange.endDate || '';

    // View-Modus initialisieren – der Klassen-Tab zeigt die Unterrichtsplanung (Liste).
    // Die Kalenderansicht läuft separat über das globale Kalender-Fenster.
    AppState.planungViewMode = 'list';

    // Automatisch heutiges Datum als Startdatum nutzen, wenn ein neuer Tag anbricht oder die App geladen wird
    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    const lastDayKey = 'calendarLastLoadedDay';
    const lastLoadedDay = localStorage.getItem(lastDayKey);

    if (lastLoadedDay !== todayStr) {
        // Neuer Tag angebrochen → Startdatum auf heute zurücksetzen
        p.calendarStartDate = todayStr;
        localStorage.setItem(lastDayKey, todayStr);
        
        // Direkt global speichern
        const newGlobalRange = {
            startDate: todayStr,
            endDate: p.calendarEndDate || ''
        };
        localStorage.setItem('planung_global_calendar_range', JSON.stringify(newGlobalRange));
    }

    const isCalendar = AppState.planungViewMode === 'calendar';
    const initialStart = isCalendar ? (p.calendarStartDate || '') : (p.startDate || '');
    const initialEnd = isCalendar ? (p.calendarEndDate || '') : (p.endDate || '');

    const startEl = safeGetElement('planung-start-date');
    const endEl = safeGetElement('planung-end-date');
    if (startEl) {
        if (startEl._flatpickr) startEl._flatpickr.setDate(initialStart, false);
        else startEl.value = initialStart;
    }
    if (endEl) {
        if (endEl._flatpickr) endEl._flatpickr.setDate(initialEnd, false);
        else endEl.value = initialEnd;
    }

    document.querySelectorAll('.planung-day-cb').forEach(cb => {
        cb.checked = (p.selectedDays || []).includes(parseInt(cb.value));
    });

    if (AppState.calendarYear === undefined || AppState.calendarMonth === undefined) {
        const defaultStart = p.calendarStartDate || p.startDate || '';
        if (defaultStart) {
            const startDateParts = defaultStart.split('-');
            AppState.calendarYear = parseInt(startDateParts[0]);
            AppState.calendarMonth = parseInt(startDateParts[1]) - 1;
        } else {
            const today = new Date();
            AppState.calendarYear = today.getFullYear();
            AppState.calendarMonth = today.getMonth();
        }
    }

    renderPlanung();
}

function savePlanung() {
    // Kalender-Zeitraum global speichern (klassenübergreifend)
    const p = AppState.planung;
    if (p) {
        const globalRange = {
            startDate: p.calendarStartDate || '',
            endDate: p.calendarEndDate || ''
        };
        localStorage.setItem('planung_global_calendar_range', JSON.stringify(globalRange));
    }

    localStorage.setItem(planungStorageKey(), JSON.stringify(AppState.planung));
    localStorage.setItem('extraDataLastUpdate', new Date().toISOString());
    if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.triggerCloudSyncDebounced === 'function') {
        window.triggerCloudSyncDebounced(2500);
    }
}

function exportPlanungTable() {
    const viewMode = AppState.planungViewMode || 'calendar';
    if (viewMode === 'calendar') {
        exportPlanungCalendar();
        return;
    }

    const p = AppState.planung;
    if (!p || !p.startDate || !p.endDate || !(p.selectedDays || []).length) {
        swal('Hinweis', 'Bitte gib einen Planungszeitraum und Unterrichtstage ein, um die Planung zu exportieren.', 'info');
        return;
    }

    // Unterrichtstage aufbauen
    const visibleStartDate = p.startDate;
    const teachingDates = new Set();
    const rows = [];
    const current = new Date(visibleStartDate + 'T00:00:00');
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

    // Termine einarbeiten
    const termine = AppState.termine || [];
    const hiddenTermine = new Set(p.hiddenTermine || []);
    termine.forEach(termin => {
        if (hiddenTermine.has(termin.id)) return;
        if (termin.date < visibleStartDate || termin.date > p.endDate) return;
        if (teachingDates.has(termin.date)) {
            const row = rows.find(r => r.date === termin.date);
            if (row) row.termins.push(termin);
        } else {
            const d = new Date(termin.date + 'T00:00:00');
            rows.push({ date: termin.date, dow: d.getDay(), isTeaching: false, termins: [termin] });
        }
    });

    rows.sort((a, b) => a.date.localeCompare(b.date));

    if (!rows.length) {
        swal('Hinweis', 'Es gibt keine Planungsdaten zum Exportieren.', 'info');
        return;
    }

    let tbodyHtml = '';
    let nr = 0;
    rows.forEach(row => {
        if (row.isTeaching) nr++;
        const formattedDate = new Date(row.date + 'T00:00:00').toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const inhalt = (p.entries && p.entries[row.date]) ? p.entries[row.date] : '';
        const terminText = row.termins.map(t => t.title).join(', ');
        
        const nrText = row.isTeaching ? nr : '—';
        const tagText = row.isTeaching ? PLANUNG_DAY_NAMES[row.dow] : ALL_DAY_NAMES[row.dow];
        
        const tagMap = { 'Montag': 'Mo.', 'Dienstag': 'Di.', 'Mittwoch': 'Mi.', 'Donnerstag': 'Do.', 'Freitag': 'Fr.', 'Samstag': 'Sa.', 'Sonntag': 'So.' };
        const tagAbbr = tagMap[tagText] || tagText;

        const isTermin = row.termins.length > 0 || !row.isTeaching;
        const rowStyle = isTermin ? ' class="termin-row"' : '';
        
        const inhaltCell = terminText
            ? `<span class="termin-label">${escapeHtml(terminText)}</span>${inhalt ? ' ' + escapeHtml(inhalt) : ''}`
            : escapeHtml(inhalt);

        tbodyHtml += `<tr${rowStyle}><td>${nrText}</td><td>${tagAbbr}</td><td>${formattedDate}</td><td>${inhaltCell}</td></tr>`;
    });

    const className = (activeClassId !== null && classes[activeClassId]) ? classes[activeClassId].name : '';
    const exportTitle = className ? `Planung - ${className}` : 'Planung';

    const win = window.open('', '_blank');
    if (!win) { swal('Hinweis', 'Bitte Popup-Blocker deaktivieren um zu exportieren.', 'info'); return; }
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
        <script>window.onload = function(){ window.print(); }</script>
    </body></html>`);
    win.document.close();
}

function deletePlanungTable() {
    swal({
        title: 'Planung löschen?',
        text: 'Der gesamte Inhalt der Planungstabelle wird unwiderruflich gelöscht. Zeitraum und Einstellungen bleiben erhalten.',
        icon: 'warning',
        buttons: [false, 'Löschen'],
        dangerMode: true,
    }).then(willDelete => {
        if (!willDelete) return;
        if (!AppState.planung) AppState.planung = {};
        AppState.planung.entries = {};
        savePlanung();
        const container = safeGetElement('planung-table-container');
        if (container) container.innerHTML = '';
        autoGeneratePlanungTable();
    });
}

function autoGeneratePlanungTable() {
    const startEl = safeGetElement('planung-start-date');
    const endEl = safeGetElement('planung-end-date');
    if (!startEl || !endEl) return;
    const startDate = startEl.value;
    const endDate = endEl.value;
    if (!startDate || !endDate || startDate > endDate) return;

    if (AppState.planungViewMode === 'calendar') {
        if (!AppState.planung) AppState.planung = { entries: {}, hiddenTermine: [] };
        AppState.planung.calendarStartDate = startDate;
        AppState.planung.calendarEndDate = endDate;
        savePlanung();
        renderPlanungCalendar();
        return;
    }

    const selectedDays = [];
    document.querySelectorAll('.planung-day-cb:checked').forEach(cb => {
        selectedDays.push(parseInt(cb.value));
    });
    if (!selectedDays.length) {
        if (!AppState.planung) AppState.planung = { entries: {}, hiddenTermine: [] };
        AppState.planung.startDate = startDate;
        AppState.planung.endDate = endDate;
        AppState.planung.selectedDays = [];
        savePlanung();
        const container = safeGetElement('planung-table-container');
        if (container) container.innerHTML = '';
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
    renderPlanung();
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
    const todayStr = localDateStr(new Date());
    
    // Alle Unterrichtstage sammeln, um den aktuellen oder den letzten vorherigen Unterrichtstag zu ermitteln
    const allTeachingDates = [];
    const tempDate = new Date(p.startDate + 'T00:00:00');
    const tempEnd = new Date(p.endDate + 'T00:00:00');
    while (tempDate <= tempEnd) {
        if ((p.selectedDays || []).includes(tempDate.getDay())) {
            allTeachingDates.push(localDateStr(tempDate));
        }
        tempDate.setDate(tempDate.getDate() + 1);
    }

    let highlightDate = null;
    if (allTeachingDates.includes(todayStr)) {
        highlightDate = todayStr;
    } else {
        const pastTeachingDates = allTeachingDates.filter(d => d < todayStr);
        if (pastTeachingDates.length > 0) {
            highlightDate = pastTeachingDates[pastTeachingDates.length - 1];
        }
    }

    let visibleStartDate = p.startDate;

    const teachingDates = new Set();
    const rows = [];
    const current = new Date(visibleStartDate + 'T00:00:00');
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
        if (termin.date < visibleStartDate || termin.date > p.endDate) return;
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
        const highlightClass = row.date === highlightDate ? ' planung-row-highlight' : '';

        if (row.isTeaching) {
            return `<tr class="planung-row${terminText ? ' planung-row-termin' : ''}${highlightClass}" data-date="${row.date}">
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
            return `<tr class="planung-row planung-row-termin${highlightClass}" data-date="${row.date}">
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
        ta.addEventListener('mousedown', e => e.stopPropagation());
        ta.addEventListener('dragstart', e => e.stopPropagation());
    });

    let planungDragSource = null;
    container.querySelectorAll('.planung-row').forEach(row => {
        if (!row.dataset.date || !rows.find(r => r.date === row.dataset.date && r.isTeaching)) return;

        row.draggable = true;

        row.addEventListener('dragstart', e => {
            planungDragSource = row.dataset.date;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', planungDragSource);
            setTimeout(() => row.classList.add('planung-dragging'), 0);
        });

        row.addEventListener('dragend', () => {
            row.classList.remove('planung-dragging');
            container.querySelectorAll('.planung-row').forEach(r => r.classList.remove('planung-drag-over'));
            planungDragSource = null;
        });

        row.addEventListener('dragover', e => {
            if (!planungDragSource || row.dataset.date === planungDragSource) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            container.querySelectorAll('.planung-row').forEach(r => r.classList.remove('planung-drag-over'));
            row.classList.add('planung-drag-over');
        });

        row.addEventListener('dragleave', e => {
            if (!row.contains(e.relatedTarget)) row.classList.remove('planung-drag-over');
        });

        row.addEventListener('drop', e => {
            e.preventDefault();
            container.querySelectorAll('.planung-row').forEach(r => r.classList.remove('planung-drag-over'));
            const targetDate = row.dataset.date;
            if (!planungDragSource || planungDragSource === targetDate) return;

            const teachingRows = [...container.querySelectorAll('.planung-row[data-date]')]
                .filter(r => rows.find(pr => pr.date === r.dataset.date && pr.isTeaching));
            const dates = teachingRows.map(r => r.dataset.date);

            const srcIdx = dates.indexOf(planungDragSource);
            const tgtIdx = dates.indexOf(targetDate);
            if (srcIdx === -1 || tgtIdx === -1) return;

            const entries = { ...(AppState.planung.entries || {}) };
            const contents = dates.map(d => entries[d]);

            // Reorder: wie in Schülerverwaltung — verschieben, nicht tauschen
            const [moved] = contents.splice(srcIdx, 1);
            contents.splice(tgtIdx, 0, moved);

            dates.forEach((d, i) => {
                if (contents[i] !== undefined && contents[i] !== '') entries[d] = contents[i];
                else delete entries[d];
            });

            AppState.planung.entries = entries;
            planungDragSource = null;
            savePlanung();
            renderPlanung();
        });
    });
}

function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
    // Robust gegen null/undefined/Zahlen und maskiert auch ' (für HTML-Attribute),
    // damit Nutzereingaben (Klassen-/Schülernamen, Notizen ...) gefahrlos via
    // innerHTML eingefügt werden können.
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}



// ===== SPALTENKALENDER-ANSICHT (PLANUNG) =====

function setPlanungViewMode(mode) {
    AppState.planungViewMode = mode;
    localStorage.setItem('planungViewMode', mode);
    renderPlanung();
}

function togglePlanungView() {
    const current = AppState.planungViewMode || 'calendar';
    setPlanungViewMode(current === 'calendar' ? 'list' : 'calendar');
}

function openPlanungExport() {
    if ((AppState.planungViewMode || 'calendar') === 'list') {
        exportPlanungTable();
    } else {
        showModal('planung-export-modal');
    }
}

function togglePlanungZeitraum() {
    const mode = AppState.planungViewMode || 'calendar';
    const title = document.getElementById('planung-zeitraum-modal-title');
    if (title) title.textContent = 'Zeitraum';

    // Picker passend zum aktuellen Format neu aufsetzen (Felder mobil / Kalender Desktop/iPad)
    setupZeitraumPickers();

    // Aktuelle Werte in die Picker setzen (Monat/Markierung)
    const p = AppState.planung || {};
    const cs = mode === 'calendar' ? (p.calendarStartDate || '') : (p.startDate || '');
    const ce = mode === 'calendar' ? (p.calendarEndDate || '') : (p.endDate || '');
    const s = document.getElementById('planung-start-date');
    const e = document.getElementById('planung-end-date');
    if (s && s._flatpickr) s._flatpickr.setDate(cs, false);
    if (e && e._flatpickr) e._flatpickr.setDate(ce, false);

    showModal('planung-zeitraum-modal');

    // Desktop/iPad: eingebettete (inline) Kalender nach dem Einblenden neu zeichnen
    if (window.matchMedia('(min-width: 601px)').matches) {
        if (s && s._flatpickr) s._flatpickr.redraw();
        if (e && e._flatpickr) e._flatpickr.redraw();
    }
}

function renderPlanung() {
    const viewMode = AppState.planungViewMode || 'calendar';
    const listContainer = safeGetElement('planung-table-container');
    const calendarContainer = safeGetElement('planung-calendar-container');

    const p = AppState.planung || {};
    const startEl = safeGetElement('planung-start-date');
    const endEl = safeGetElement('planung-end-date');
    const currentStart = viewMode === 'calendar' ? (p.calendarStartDate || '') : (p.startDate || '');
    const currentEnd = viewMode === 'calendar' ? (p.calendarEndDate || '') : (p.endDate || '');

    if (startEl) {
        if (startEl._flatpickr) startEl._flatpickr.setDate(currentStart, false);
        else startEl.value = currentStart;
    }
    if (endEl) {
        if (endEl._flatpickr) endEl._flatpickr.setDate(currentEnd, false);
        else endEl.value = currentEnd;
    }
    
    const toggleBtn = safeGetElement('planung-view-toggle-btn');
    if (toggleBtn) {
        if (viewMode === 'calendar') {
            toggleBtn.innerHTML = '<i class="fas fa-list"></i> <span class="btn-text">Ansicht</span>';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-calendar-alt"></i> <span class="btn-text">Ansicht</span>';
        }
    }

    const listOnlyButtons = [
        safeGetElement('planung-unterrichtstage-btn'),
        safeGetElement('planung-termine-btn'),
        safeGetElement('planung-delete-btn')
    ];
    listOnlyButtons.forEach(btn => {
        if (btn) btn.style.display = viewMode === 'list' ? 'inline-flex' : 'none';
    });
    
    
    if (viewMode === 'calendar') {
        if (listContainer) listContainer.style.display = 'none';
        if (calendarContainer) {
            calendarContainer.style.display = 'block';
            renderPlanungCalendar();
        }
    } else {
        if (calendarContainer) calendarContainer.style.display = 'none';
        if (listContainer) {
            listContainer.style.display = 'block';
            renderPlanungTable();
        }
    }
}

const planungMonthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

function renderPlanungCalendar() {
    const container = safeGetElement('planung-calendar-container');
    if (!container) return;
    
    const p = AppState.planung;
    if (!p || !p.calendarStartDate || !p.calendarEndDate) {
        container.innerHTML = '<p class="planung-empty" style="text-align: center; padding: 40px;">Bitte gib oben einen Zeitraum ein, um den Kalender anzuzeigen.</p>';
        return;
    }
    
    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
    const visibleStartDate = p.calendarStartDate;
    if (visibleStartDate > p.calendarEndDate) {
        container.innerHTML = '<p class="planung-empty" style="text-align: center; padding: 40px;">Keine Tage im gewählten Zeitraum.</p>';
        return;
    }

    // Monatssuche startet ab dem sichtbaren Startdatum.
    const start = new Date(visibleStartDate + 'T00:00:00');
    const end = new Date(p.calendarEndDate + 'T00:00:00');
    
    // Zu rendernde Monate bestimmen
    const monthsToRender = [];
    
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (cur <= endLimit) {
        monthsToRender.push({ year: cur.getFullYear(), month: cur.getMonth() });
        cur.setMonth(cur.getMonth() + 1);
    }
    
    const weekdayInitials = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    let columnsHtml = '';
    
    monthsToRender.forEach(({ year, month }) => {
        const monthName = planungMonthNames[month];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let daysHtml = '';
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            // Prüfen, ob der Tag im sichtbaren Zeitraum liegt (heute bis Enddatum)
            const isWithinRange = dateStr >= visibleStartDate && dateStr <= p.calendarEndDate;
            
            if (isWithinRange) {
                const dateObj = new Date(dateStr + 'T00:00:00');
                const dow = dateObj.getDay(); // 0=Sunday, 6=Saturday
                
                let rowClasses = [];
                if (dow === 0) rowClasses.push('sunday');
                else if (dow === 6) rowClasses.push('saturday');
                
                const isToday = dateStr === todayStr;
                if (isToday) rowClasses.push('today');
                // Termine sammeln (alle Termine des Tages, keine Ausblendung im Kalender)
                const termine = AppState.termine || [];
                const dayTermine = termine.filter(t => t.date === dateStr);
                
                // HTML für Termine
                let appointmentsHtml = '';
                if (dayTermine.length > 0) {
                    appointmentsHtml = `<div class="calendar-day-appointments">` + 
                        dayTermine.map(t => `<span class="calendar-day-appointment-badge" title="${escapeHtml(t.title || '')}">${escapeHtml(t.title || '')}</span>`).join('') + 
                        `</div>`;
                }
                
                daysHtml += `
                    <div class="calendar-day-row ${rowClasses.join(' ')}" onclick="event.stopPropagation(); openCalendarDayDetails('${dateStr}')">
                        <div class="calendar-day-label">
                            <span class="day-num">${d}</span>
                            <span class="day-dow">${weekdayInitials[dow]}</span>
                        </div>
                        <div class="calendar-day-content">
                            ${appointmentsHtml}
                        </div>
                    </div>
                `;
            }
        }
        
        columnsHtml += `
            <div class="calendar-month-column">
                <div class="calendar-column-header">${monthName} ${year}</div>
                <div class="calendar-column-days">
                    ${daysHtml}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `
        <div class="calendar-columns-wrapper">
            ${columnsHtml}
        </div>
    `;
}

function openCalendarDayDetails(dateStr) {
    if (activeModule !== 'planung' && window._activeToolWindow !== 'kalender') return;
    if (openCalendarDayDetails._busy) return;
    openCalendarDayDetails._busy = true;
    setTimeout(() => { openCalendarDayDetails._busy = false; }, 800);

    AppState.activeCalendarDay = dateStr;
    AppState.editingCalendarDayTerminId = null;
    
    // Titel im Modal aktualisieren (Wochentag, DD.MM.YYYY)
    const dateObj = new Date(dateStr + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('calendar-day-date-title').textContent = formattedDate;
    
    // Neuen Termin Input und Zeit-Inputs zurücksetzen
    document.getElementById('calendar-day-new-termin-title').value = '';
    const timeStartEl = document.getElementById('calendar-day-new-termin-timestart');
    const timeEndEl = document.getElementById('calendar-day-new-termin-timeend');
    if (timeStartEl) timeStartEl.value = '';
    if (timeEndEl) timeEndEl.value = '';

    AppState.timeRangeStage = 1;

    updateCalendarDayFormUI();
    
    // Terminliste für diesen Tag rendern
    renderCalendarDayTermineList(dateStr);
    
    showModal('calendar-day-modal');
}

function renderCalendarDayTermineList(dateStr) {
    const listContainer = document.getElementById('calendar-day-termine-list');
    if (!listContainer) return;
    
    const dayTermine = (AppState.termine || []).filter(t => t.date === dateStr);
    
    if (dayTermine.length === 0) {
        listContainer.innerHTML = '<p style="color: var(--grey-color); font-size: 0.88rem; margin: 0; padding: 4px 0;">Keine Termine für diesen Tag.</p>';
    } else {
        listContainer.innerHTML = dayTermine.map(t => {
            const timeDisplay = t.timeStart ? ` <span style="font-weight: 500; font-size: 0.85rem; color: #64748b; margin-right: 6px;">(${t.timeStart}${t.timeEnd ? ' - ' + t.timeEnd : ''})</span>` : '';
            const isEditing = AppState.editingCalendarDayTerminId === t.id;
            const itemStyle = isEditing ? 'background: #eff6ff; border-color: #3b82f6;' : '';
            return `
                <div class="calendar-modal-termin-item" style="${itemStyle}">
                    <span>${timeDisplay}${escapeHtml(t.title || '')}</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-sm btn-primary btn-circle" onclick="editCalendarDayTermin('${t.id}')" title="Diesen Termin bearbeiten">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger btn-circle" onclick="deleteCalendarDayTermin('${t.id}')" title="Diesen Termin löschen">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function addCalendarDayTermin() {
    const dateStr = AppState.activeCalendarDay;
    if (!dateStr) return;
    
    const titleInput = document.getElementById('calendar-day-new-termin-title');
    const title = titleInput.value.trim();
    
    const timeStartInput = document.getElementById('calendar-day-new-termin-timestart');
    const timeEndInput = document.getElementById('calendar-day-new-termin-timeend');
    const timeStart = timeStartInput ? timeStartInput.value : '';
    const timeEnd = timeEndInput ? timeEndInput.value : '';
    
    if (!title) {
        swal('Fehler', 'Bitte eine Bezeichnung eingeben', 'error');
        return;
    }
    
    if (!AppState.termine) AppState.termine = [];
    
    if (AppState.editingCalendarDayTerminId) {
        // Bestehenden Termin bearbeiten
        const idx = AppState.termine.findIndex(t => t.id === AppState.editingCalendarDayTerminId);
        if (idx !== -1) {
            AppState.termine[idx].title = title;
            AppState.termine[idx].timeStart = timeStart;
            AppState.termine[idx].timeEnd = timeEnd;
        }
        AppState.editingCalendarDayTerminId = null;
    } else {
        // Neuen Termin hinzufügen
        const newId = Date.now().toString();
        AppState.termine.push({ id: newId, title: title, date: dateStr, timeStart: timeStart, timeEnd: timeEnd });
    }
    
    saveTermine();
    titleInput.value = '';
    if (timeStartInput) timeStartInput.value = '';
    if (timeEndInput) timeEndInput.value = '';
    
    AppState.timeRangeStage = 1;
    
    renderCalendarDayTermineList(dateStr);
    updateCalendarDayFormUI();
    renderPlanung();
}

function deleteCalendarDayTermin(id) {
    swal({
        title: 'Termin löschen?',
        text: 'Möchtest du diesen Termin wirklich löschen?',
        icon: 'warning',
        buttons: [false, 'Löschen'],
        dangerMode: true,
    }).then((willDelete) => {
        if (willDelete) {
            const deletedIds = JSON.parse(localStorage.getItem('deletedTermineIds') || '[]');
            if (!deletedIds.includes(id)) deletedIds.push(id);
            localStorage.setItem('deletedTermineIds', JSON.stringify(deletedIds));
            AppState.termine = (AppState.termine || []).filter(t => t.id !== id);
            
            if (AppState.editingCalendarDayTerminId === id) {
                AppState.editingCalendarDayTerminId = null;
                updateCalendarDayFormUI();
                
                // Inputs leeren
                document.getElementById('calendar-day-new-termin-title').value = '';
                const startIn = document.getElementById('calendar-day-new-termin-timestart');
                const endIn = document.getElementById('calendar-day-new-termin-timeend');
                if (startIn) startIn.value = '';
                if (endIn) endIn.value = '';
            }

            saveTermine();
            
            const dateStr = AppState.activeCalendarDay;
            renderCalendarDayTermineList(dateStr);
            renderPlanung();
        }
    });
}

// Binden an das window Objekt
window.setPlanungViewMode = setPlanungViewMode;
window.renderPlanung = renderPlanung;
window.renderPlanungCalendar = renderPlanungCalendar;

// Nach einem Cloud-Sync die offene Planungs-Liste (Klassen-Modul) neu rendern.
// Bewusst nur den Listen-Modus, um den Kalender-Ansichtsmodus nicht umzuschalten.
window.reloadPlanungIfActive = function() {
    try {
        if (typeof activeModule !== 'undefined' && activeModule === 'planung'
            && window._activeToolWindow !== 'kalender') {
            loadPlanung();
        }
    } catch (e) {
        console.warn('reloadPlanungIfActive Fehler:', e);
    }
};
window.openCalendarDayDetails = openCalendarDayDetails;
window.addCalendarDayTermin = addCalendarDayTermin;
window.deleteCalendarDayTermin = deleteCalendarDayTermin;

// Export der Kalenderansicht
function exportPlanungCalendar() {
    const container = safeGetElement('planung-calendar-container');
    if (!container) return;
    
    const p = AppState.planung;
    if (!p || !p.calendarStartDate || !p.calendarEndDate) {
        swal('Hinweis', 'Bitte gib einen Planungszeitraum ein, um den Kalender zu exportieren.', 'info');
        return;
    }

    const calendarHtml = container.innerHTML;
    const className = (activeClassId !== null && classes[activeClassId]) ? classes[activeClassId].name : '';
    const exportTitle = className ? `Planung (Kalender) - ${className}` : 'Planung (Kalender)';

    const win = window.open('', '_blank');
    if (!win) { swal('Hinweis', 'Bitte Popup-Blocker deaktivieren um zu exportieren.', 'info'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${exportTitle}</title><style>
        body { font-family: sans-serif; font-size: 11px; padding: 20px; background: #fff; color: #1e293b; }
        h2 { margin-bottom: 20px; text-align: center; font-size: 1.5rem; color: #0f172a; }
        
        .calendar-columns-wrapper {
            display: flex;
            gap: 12px;
            overflow: visible;
            flex-wrap: wrap;
            justify-content: flex-start;
        }
        
        .calendar-month-column {
            width: 190px;
            flex-shrink: 0;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            page-break-inside: avoid;
        }
        
        .calendar-column-header {
            background: #4a6cf7;
            color: #ffffff;
            padding: 10px 8px;
            text-align: center;
            font-weight: 700;
            font-size: 0.9rem;
            text-transform: uppercase;
            border-bottom: 2px solid rgba(0,0,0,0.1);
        }
        
        .calendar-day-row {
            min-height: 48px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            padding: 4px 8px;
            box-sizing: border-box;
            position: relative;
        }
        
        .calendar-day-row:last-child {
            border-bottom: none;
        }
        
        .calendar-day-row.empty-day {
            background-color: #f8fafc;
            opacity: 0.4;
            background-image: linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 50%, #cbd5e1 50%, #cbd5e1 75%, transparent 75%, transparent);
            background-size: 8px 8px;
        }
        
        .calendar-day-row.sunday,
        .calendar-day-row.saturday {
            background-color: #f1f5f9;
        }
        
        .calendar-day-row.today {
            border-left: 3px solid #4a6cf7;
        }
        
        .calendar-day-label {
            width: 48px;
            font-size: 0.75rem;
            font-weight: 600;
            color: #475569;
            display: flex;
            align-items: center;
            gap: 2px;
            flex-shrink: 0;
        }
        
        .calendar-day-label .day-num {
            width: 18px;
            text-align: right;
            display: inline-block;
        }
        
        .calendar-day-label .day-dow {
            color: #94a3b8;
            font-size: 0.7rem;
        }
        
        .calendar-day-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
            justify-content: center;
        }
        
        .calendar-day-appointments {
            display: flex;
            gap: 2px;
            flex-direction: column;
        }
        
        .calendar-day-appointment-badge {
            font-size: 0.78rem;
            font-weight: 700;
            color: #1e293b;
            display: block;
            border: none;
            background: none;
            box-shadow: none;
            padding: 1px 0;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
        }
        
        .calendar-day-entry-preview {
            font-size: 0.65rem;
            color: #475569;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        @media print {
            body { padding: 0; margin: 0; }
            .calendar-month-column { box-shadow: none; }
            @page { size: landscape; margin: 0.5cm; }
            
            .calendar-columns-wrapper {
                display: flex !important;
                flex-wrap: nowrap !important;
                width: 100% !important;
                gap: 4px !important;
            }
            
            .calendar-month-column {
                width: 0 !important;
                flex: 1 1 0% !important;
                margin-bottom: 0 !important;
                border-radius: 4px !important;
            }
            
            .calendar-column-header {
                font-size: 8px !important;
                padding: 6px 2px !important;
            }
            
            .calendar-day-row {
                min-height: 20px !important;
                height: 20px !important;
                padding: 1px 4px !important;
            }
            
            .calendar-day-label {
                width: 26px !important;
                font-size: 7px !important;
                gap: 1px !important;
            }
            
            .calendar-day-label .day-num {
                width: 10px !important;
            }
            
            .calendar-day-label .day-dow {
                font-size: 6px !important;
            }
            
            .calendar-day-appointment-badge {
                font-size: 7px !important;
                padding: 0 !important;
            }
        }
    </style></head><body>
        <h2>${exportTitle}</h2>
        ${calendarHtml}
        <script>window.onload = function(){ window.print(); }</script>
    </body></html>`);
    win.document.close();
}

window.exportPlanungCalendar = exportPlanungCalendar;

// ===== CALENDAR TIME QUICK SELECT =====

function editCalendarDayTermin(id) {
    const termin = (AppState.termine || []).find(t => t.id === id);
    if (!termin) return;
    
    AppState.editingCalendarDayTerminId = id;
    
    const titleInput = document.getElementById('calendar-day-new-termin-title');
    const startInput = document.getElementById('calendar-day-new-termin-timestart');
    const endInput = document.getElementById('calendar-day-new-termin-timeend');
    
    if (titleInput) titleInput.value = termin.title || '';
    if (startInput) startInput.value = termin.timeStart || '';
    if (endInput) endInput.value = termin.timeEnd || '';

    AppState.timeRangeStage = 1;

    renderCalendarDayTermineList(AppState.activeCalendarDay);
    updateCalendarDayFormUI();
}

function updateCalendarDayFormUI() {
    const isEditing = !!AppState.editingCalendarDayTerminId;
    const container = document.getElementById('calendar-day-add-btn-container');
    if (!container) return;
    
    if (isEditing) {
        container.innerHTML = `
            <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary" onclick="cancelEditCalendarDayTermin()">Abbrechen</button>
                <button class="btn btn-success" onclick="addCalendarDayTermin()">Speichern</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button class="btn btn-success btn-circle-sm" onclick="addCalendarDayTermin()" title="Hinzufügen"><i class="fas fa-check"></i></button>
        `;
    }
}

function cancelEditCalendarDayTermin() {
    AppState.editingCalendarDayTerminId = null;
    AppState.timeRangeStage = 1;
    
    const titleInput = document.getElementById('calendar-day-new-termin-title');
    const startInput = document.getElementById('calendar-day-new-termin-timestart');
    const endInput = document.getElementById('calendar-day-new-termin-timeend');
    
    if (titleInput) titleInput.value = '';
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    renderCalendarDayTermineList(AppState.activeCalendarDay);
    updateCalendarDayFormUI();
}

window.editCalendarDayTermin = editCalendarDayTermin;
window.updateCalendarDayFormUI = updateCalendarDayFormUI;
window.cancelEditCalendarDayTermin = cancelEditCalendarDayTermin;



// ===== CENTRALIZED CONTACTS (ADRESSBUCH) =====

let contactsInteractionLock = false;

function setContacts(newContacts) {
    contacts = newContacts || [];
    AppState.contacts = contacts;
    if (activeModule === 'kontakte' || window._activeToolWindow === 'kontakte') {
        renderContactsModule();
    }
}

function toggleSearchContacts() {
    const searchContainer = document.getElementById('search-container-kontakte');
    if (searchContainer) {
        const isVisible = searchContainer.style.display !== 'none';
        searchContainer.style.display = isVisible ? 'none' : 'block';
        const input = document.getElementById('search-input-kontakte');
        if (input) {
            input.value = '';
        }
        filterContacts();
        if (!isVisible && input) {
            input.focus();
        }
    }
}

function addPhoneRowInModal(label = '', number = '') {
    const container = document.getElementById('contact-phones-container');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'contact-phone-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginBottom = '8px';
    row.style.alignItems = 'center';
    
    row.innerHTML = `
        <input type="text" class="form-control phone-label" placeholder="z.B. Mutter" value="${escapeHtml(label)}" style="flex: 1;">
        <input type="text" class="form-control phone-number" placeholder="Telefonnummer" value="${escapeHtml(number)}" style="flex: 1.5;">
        <button type="button" class="btn btn-danger btn-circle-sm" onclick="this.parentElement.remove()" title="Entfernen">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(row);
}

function renderContactsModule() {
    const tbody = document.getElementById('contacts-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const filterText = (document.getElementById('search-input-kontakte')?.value || '').toLowerCase().trim();
    
    // Sort contacts by child name
    const sortedContacts = [...contacts].sort((a, b) => (a.childName || '').localeCompare(b.childName || ''));
    
    const filteredContacts = sortedContacts.filter(c => {
        const child = (c.childName || '').toLowerCase();
        
        if (child.includes(filterText)) return true;
        
        // Match multiple phone entries (including fallback for old format)
        const phoneList = c.phones || [
            { label: c.relation || '', number: c.phone || '' }
        ];
        
        return phoneList.some(p => {
            const label = (p.label || '').toLowerCase();
            const number = (p.number || '').toLowerCase();
            return label.includes(filterText) || number.includes(filterText);
        });
    });
    
    if (filteredContacts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" style="text-align: center; color: var(--grey-color); padding: 20px;">
                    Keine Kontakte vorhanden
                </td>
            </tr>
        `;
        return;
    }
    
    filteredContacts.forEach(c => {
        const tr = document.createElement('tr');
        
        const phoneList = c.phones || [
            { label: c.relation || '', number: c.phone || '' }
        ];
        
        let detailsHtml = '';
        const validPhones = phoneList.filter(p => p.label || p.number);
        if (validPhones.length > 0) {
            const parts = validPhones.map(p => {
                const label = escapeHtml(p.label || '');
                const number = escapeHtml(p.number || '');
                if (label && number) return `<span style="font-weight:500;">${label}:</span> ${number}`;
                if (label) return `<span style="font-weight:500;">${label}</span>`;
                return number;
            });
            detailsHtml = `<span style="color: var(--dark-color);">${parts.join('<span style="color: var(--border-color); margin: 0 8px;">|</span>')}</span>`;
        } else {
            detailsHtml = `<span style="color: var(--grey-color);">Keine Telefonnummern hinterlegt</span>`;
        }
        
        tr.innerHTML = `
            <td style="vertical-align: middle; cursor: pointer;" onclick="event.stopPropagation(); openContactPhonesModal('${c.id}')"><strong>${escapeHtml(c.childName || '-')}</strong></td>
            <td style="text-align: center; white-space: nowrap; vertical-align: middle;">
                <button onclick="openEditContactModal('${c.id}')" class="btn btn-primary btn-circle-sm" title="Bearbeiten" style="margin-right: 4px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteContact('${c.id}')" class="btn btn-danger btn-circle-sm" title="Löschen">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openContactPhonesModal(id) {
    if (activeModule !== 'kontakte' && window._activeToolWindow !== 'kontakte') return;
    if (contactsInteractionLock) return;
    contactsInteractionLock = true;
    setTimeout(() => { contactsInteractionLock = false; }, 800);

    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    document.getElementById('contact-phones-modal-title').textContent = contact.childName || '-';

    const phoneList = contact.phones || [{ label: contact.relation || '', number: contact.phone || '' }];
    const validPhones = phoneList.filter(p => p.label || p.number);

    const content = document.getElementById('contact-phones-modal-content');
    if (validPhones.length === 0) {
        content.innerHTML = `<p style="color: var(--grey-color);">Keine Telefonnummern hinterlegt</p>`;
    } else {
        content.innerHTML = validPhones.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0;">
                <span style="font-weight: 500; color: var(--dark-color);">${escapeHtml(p.label || '–')}</span>
                <button onclick="copyPhoneNumber('${escapeHtml(p.number || '')}', this)" style="background: none; border: none; cursor: pointer; color: var(--primary-color); font-size: 1rem; font-weight: 500; padding: 4px 0;" title="Nummer kopieren">
                    ${escapeHtml(p.number || '–')}
                </button>
            </div>
        `).join('');
    }

    showModal('contact-phones-modal');
}

function copyPhoneNumber(number, btn) {
    navigator.clipboard.writeText(number).then(() => {
        const original = btn.textContent.trim();
        btn.textContent = '✓ Kopiert';
        btn.style.color = 'var(--success-color)';
        btn.style.fontWeight = '700';
        setTimeout(() => {
            btn.textContent = original;
            btn.style.color = 'var(--primary-color)';
            btn.style.fontWeight = '500';
        }, 1500);
    }).catch(() => {
        btn.textContent = 'Fehler';
        setTimeout(() => { btn.textContent = number; }, 1500);
    });
}


function filterContacts() {
    renderContactsModule();
}

function openAddContactModal() {
    if (contactsInteractionLock) return;
    contactsInteractionLock = true;
    setTimeout(() => { contactsInteractionLock = false; }, 800);

    document.getElementById('contact-modal-title').textContent = 'Kontakt hinzufügen';
    document.getElementById('contact-edit-id').value = '';
    document.getElementById('contact-child-name').value = '';
    
    const container = document.getElementById('contact-phones-container');
    if (container) container.innerHTML = '';
    
    addPhoneRowInModal('', '');
    
    showModal('contact-modal');
}

function openEditContactModal(contactId) {
    if (contactsInteractionLock) return;
    contactsInteractionLock = true;
    setTimeout(() => { contactsInteractionLock = false; }, 800);

    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    document.getElementById('contact-modal-title').textContent = 'Kontakt bearbeiten';
    document.getElementById('contact-edit-id').value = contact.id;
    document.getElementById('contact-child-name').value = contact.childName || '';
    
    const container = document.getElementById('contact-phones-container');
    if (container) container.innerHTML = '';
    
    const phoneList = contact.phones || [
        { label: contact.relation || '', number: contact.phone || '' }
    ];
    
    phoneList.forEach(p => {
        addPhoneRowInModal(p.label, p.number);
    });
    
    if (phoneList.length === 0) {
        addPhoneRowInModal('', '');
    }
    
    showModal('contact-modal');
}

function saveContact() {
    const idInput = document.getElementById('contact-edit-id').value;
    const childName = document.getElementById('contact-child-name').value.trim();
    
    if (!childName) {
        swal('Fehler', 'Bitte gib den Namen des Kindes ein.', 'error');
        return;
    }
    
    const phoneRows = document.querySelectorAll('.contact-phone-row');
    const phones = [];
    phoneRows.forEach(row => {
        const label = (row.querySelector('.phone-label')?.value || '').trim();
        const number = (row.querySelector('.phone-number')?.value || '').trim();
        if (label || number) {
            phones.push({ label, number });
        }
    });
    
    if (idInput) {
        const contactIndex = contacts.findIndex(c => c.id === idInput);
        if (contactIndex > -1) {
            contacts[contactIndex].childName = childName;
            contacts[contactIndex].phones = phones;
            delete contacts[contactIndex].relation;
            delete contacts[contactIndex].phone;
        }
    } else {
        const newContact = {
            id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            childName: childName,
            phones: phones
        };
        contacts.push(newContact);
    }
    
    localStorage.setItem('contacts', JSON.stringify(contacts));
    AppState.contacts = contacts;
    saveData();
    renderContactsModule();
    hideModal();
}

function deleteContact(contactId) {
    if (contactsInteractionLock) return;
    contactsInteractionLock = true;
    setTimeout(() => { contactsInteractionLock = false; }, 800);

    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    swal({
        title: "Kontakt löschen?",
        text: `Möchtest du den Kontakt für "${contact.childName}" wirklich löschen?`,
        icon: "warning",
        buttons: [false, "Löschen"],
        dangerMode: true,
    }).then((willDelete) => {
        if (willDelete) {
            contacts = contacts.filter(c => c.id !== contactId);
            localStorage.setItem('contacts', JSON.stringify(contacts));
            AppState.contacts = contacts;
            saveData();
            renderContactsModule();
        }
    });
}

window.setContacts = setContacts;
window.renderContactsModule = renderContactsModule;
window.filterContacts = filterContacts;
window.openAddContactModal = openAddContactModal;
window.openEditContactModal = openEditContactModal;
window.saveContact = saveContact;
window.deleteContact = deleteContact;
window.toggleSearchContacts = toggleSearchContacts;
window.addPhoneRowInModal = addPhoneRowInModal;
window.scrollToTopAndFocusSearch = scrollToTopAndFocusSearch;
window.collapseStudentAndScrollToTop = collapseStudentAndScrollToTop;

// ===== ZEUGNIS TEXTE MODUL =====

const ZtState = {
    currentTyp: 'nebenfach',
    currentText: '',
    currentLabel: '',
    currentId: null,
    archive: [],
    initialized: false,
    pendingMessages: null,
    pendingQuestions: null,
    planungRef: null, // {courseId, studentId}: gemerkt beim Sprung aus der Planung -> nach Generierung auto-abhaken
    editingEntryId: null, // gesetzt von "Neu generieren": die nächste Generierung aktualisiert diesen Eintrag statt einen neuen anzulegen
    inlineMode: 'planung'
};

function renderZeugnisTTexteModule() {
    if (!ZtState.initialized) {
        ZtState.initialized = true;
        setZtTyp('nebenfach');
        ztInitArchive();
        ztPlanungInit();

        // Eingaben bei jeder Änderung automatisch sichern
        ZT_DRAFT_FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', ztSaveInputDraft);
                el.addEventListener('change', ztSaveInputDraft);
                el.addEventListener('blur', ztSyncDraftToCloud);
            }
        });

        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && (activeModule === 'zeugnis-texte' || window._activeToolWindow === 'zeugnis-texte')) {
                ztGenerate();
            }
        });
    }
    ztRestoreInputDraft();
    ztPlanungRenderInline();
    ZtState.inlineMode = 'planung';
    ztApplyInlineMode();
}

function ztOpenTextModal() {
    ZtState.inlineMode = 'text';
    ztApplyInlineMode();
}

function ztShowPlanningInline() {
    ZtState.inlineMode = 'planung';
    ztApplyInlineMode();
}

function ztShowArchiveInline() {
    ZtState.inlineMode = 'archive';
    ztApplyInlineMode();
}

function ztToggleTextInline() {
    ZtState.inlineMode = ZtState.inlineMode === 'text' ? 'planung' : 'text';
    ztApplyInlineMode();
}

function ztApplyInlineMode() {
    const planung = document.getElementById('zt-planung-inline');
    const archive = document.getElementById('zt-archive-inline');
    const stack = document.querySelector('#zeugnis-texte-module .zt-stack');
    const textBtn = document.getElementById('zt-open-text-inline-btn');
    const planungBtn = document.getElementById('zt-open-planung-inline-btn');
    const archiveBtn = document.getElementById('zt-open-archive-inline-btn');
    if (!planung || !stack) return;

    const mode = ZtState.inlineMode;
    const textActive = mode === 'text';
    const archiveActive = mode === 'archive';
    const planungActive = !textActive && !archiveActive;

    planung.style.display = planungActive ? '' : 'none';
    stack.style.display = textActive ? 'flex' : 'none';
    if (archive) archive.style.display = archiveActive ? '' : 'none';

    if (textBtn) textBtn.classList.toggle('is-active', textActive);
    if (planungBtn) planungBtn.classList.toggle('is-active', planungActive);
    if (archiveBtn) archiveBtn.classList.toggle('is-active', archiveActive);

    if (archiveActive) {
        ztRenderArchiveInline();
    } else if (planungActive) {
        // Planungs-Zusammenfassung im Header wiederherstellen
        const counts = ztPlanungCounts();
        ztPlanungRenderHeaderSummary(counts.total, counts.done, counts.open);
    }
}

function setZtTyp(typ) {
    ZtState.currentTyp = typ;
    const sel = document.getElementById('zt-typ');
    if (sel && sel.value !== typ) sel.value = typ;
    // Bei Arbeits-/Sozialverhalten entfallen Halbjahr, Fach und Themen
    const isSozial = typ === 'sozialverhalten';
    document.querySelectorAll('.zt-halbjahr-field, .zt-fach-field, .zt-themen-field').forEach(el => {
        el.style.display = isSozial ? 'none' : '';
    });
    const shHauptNeben = document.querySelector('.zt-schreibhilfe-hauptneben');
    const shSozial = document.querySelector('.zt-schreibhilfe-sozial');
    if (shHauptNeben) shHauptNeben.style.display = isSozial ? 'none' : '';
    if (shSozial) shSozial.style.display = isSozial ? '' : 'none';
}

// Eingaben des Generator-Formulars lokal sichern, damit der Inhalt (besonders
// "Beobachtungen & Gedanken") beim kurzen Schließen des Fensters nicht verloren geht.
const ZT_DRAFT_FIELDS = ['zt-halbjahr', 'zt-typ', 'zt-fach', 'zt-name', 'zt-themen', 'zt-beobachtungen'];

function ztSaveInputDraft() {
    try {
        const draft = {};
        ZT_DRAFT_FIELDS.forEach(id => { draft[id] = document.getElementById(id)?.value || ''; });
        localStorage.setItem('ztInputDraft', JSON.stringify(draft));
    } catch (e) { /* ignore */ }
}

function ztRestoreInputDraft(force) {
    let draft;
    try { draft = JSON.parse(localStorage.getItem('ztInputDraft') || 'null'); } catch (e) { draft = null; }
    if (!draft) return;
    // Auswahlfelder (Halbjahr/Art) direkt setzen; Textfelder normalerweise nur, wenn
    // sie leer sind – so wird aktuelles Tippen nie überschrieben. Mit force=true
    // werden auch die Textfelder gefüllt (z. B. nach einem Generierungs-Abbruch).
    if (draft['zt-typ']) { const t = document.getElementById('zt-typ'); if (t) { t.value = draft['zt-typ']; setZtTyp(draft['zt-typ']); } }
    if (draft['zt-halbjahr']) { const h = document.getElementById('zt-halbjahr'); if (h) h.value = draft['zt-halbjahr']; }
    ['zt-fach', 'zt-name', 'zt-themen', 'zt-beobachtungen'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || typeof draft[id] !== 'string') return;
        if (force || el.value == null || el.value === '') el.value = draft[id];
    });
}
window.ztRestoreInputDraft = ztRestoreInputDraft;

// Cloud-Sync des Entwurfs – nur bei tatsächlicher Änderung, ausgelöst beim
// Verlassen eines Feldes oder beim Schließen des Fensters (nicht pro Tastendruck).
let _ztDraftLastSynced = null;
function ztSyncDraftToCloud() {
    ztSaveInputDraft();
    const cur = localStorage.getItem('ztInputDraft') || '';
    if (cur === _ztDraftLastSynced) return;
    _ztDraftLastSynced = cur;
    try { localStorage.setItem('extraDataLastUpdate', new Date().toISOString()); } catch (e) { /* ignore */ }
    if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.saveDataToCloud === 'function') {
        window.saveDataToCloud();
    }
}

async function ztCallAPI(messages) {
    if (typeof window.callGenerateZeugnistext !== 'function') {
        throw new Error('Firebase Functions nicht initialisiert. Bitte einloggen.');
    }
    return await window.callGenerateZeugnistext(ZtState.currentTyp, messages);
}

// Macht aus dem KI-Text einen durchgehenden Fließtext: Zeilenumbrüche und
// Leerzeilen werden zu einem einzelnen Leerzeichen zusammengezogen.
function ztNormalizeText(text) {
    if (!text) return '';
    if (typeof text === 'object') text = text.text || '';
    return String(text).replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

function ztBuildUserMsg() {
    const name = (document.getElementById('zt-name')?.value || '').trim();
    const fach = (document.getElementById('zt-fach')?.value || '').trim();
    const halbjahr = document.getElementById('zt-halbjahr')?.value || 'ersten';
    const themen = (document.getElementById('zt-themen')?.value || '').trim();
    const beob = (document.getElementById('zt-beobachtungen')?.value || '').trim();
    return `Schüler/in: ${name}\n${fach ? 'Fach: ' + fach + '\n' : ''}${fach ? 'Halbjahr: ' + halbjahr + '\n' : ''}${themen ? 'Themen: ' + themen + '\n' : ''}Beobachtungen: ${beob}`;
}

function ztCloseResult() {
    const container = document.getElementById('zt-result-container');
    const inputContainer = document.getElementById('zt-input-container');
    if (container) container.style.display = 'none';
    if (inputContainer) inputContainer.style.display = '';
}

function ztBackToPlanung() {
    ztFlushSave();
    ztCloseResult();
    ZtState.inlineMode = 'planung';
    ztApplyInlineMode();
}

let ztSaveTimeout = null;
function ztFlushSave() {
    if (ztSaveTimeout) {
        clearTimeout(ztSaveTimeout);
        ztSaveTimeout = null;
        ztUpdateCurrentEntry();
    }
}

function ztOnTextEdited(val) {
    ZtState.currentText = val;
    if (ztSaveTimeout) clearTimeout(ztSaveTimeout);
    ztSaveTimeout = setTimeout(() => {
        ztUpdateCurrentEntry();
    }, 1000);
}

function ztNextStudent() {
    ztFlushSave();
    const nameEl = document.getElementById('zt-name');
    const beobEl = document.getElementById('zt-beobachtungen');
    
    if (nameEl) nameEl.value = '';
    if (beobEl) beobEl.value = '';

    ZtState.currentId = null;
    ZtState.currentText = '';
    ZtState.currentLabel = '';
    ZtState.editingEntryId = null;
    ztSaveInputDraft();

    ztCloseResult();
}

async function ztGenerate() {
    const name = (document.getElementById('zt-name')?.value || '').trim();
    const fach = (document.getElementById('zt-fach')?.value || '').trim();
    const themen = (document.getElementById('zt-themen')?.value || '').trim();
    const beob = (document.getElementById('zt-beobachtungen')?.value || '').trim();

    if (!name || !beob) {
        swal('Warnung', 'Bitte mindestens Name und Beobachtungen ausfüllen.', 'warning');
        return;
    }
    if (ZtState.currentTyp !== 'sozialverhalten' && (!fach || !themen)) {
        swal('Warnung', 'Bitte Fach und Themen ausfüllen.', 'warning');
        return;
    }

    const userMsg = ztBuildUserMsg();
    ZtState.currentLabel = ZtState.currentTyp === 'sozialverhalten' ? name : `${name} · ${fach}`;
    // "Neu generieren" setzt editingEntryId -> denselben Eintrag aktualisieren.
    // Sonst (frische Generierung) einen neuen Eintrag anlegen.
    ZtState.currentId = ZtState.editingEntryId || null;
    ZtState.editingEntryId = null;

    // Eingaben (besonders Beobachtungen) vor dem langen Request sichern, damit sie
    // bei einem Abbruch / "Load failed" garantiert erhalten bleiben.
    ztSaveInputDraft();

    ztSetLoading();

    try {
        const initialMessages = [{ role: 'user', content: userMsg }];
        const apiResult = await ztCallAPI(initialMessages);

        if (apiResult.questions && apiResult.questions.length > 0) {
            showClarifyingQuestionsModal(apiResult.questions, initialMessages);
        } else {
            ZtState.currentText = ztNormalizeText(apiResult.text);
            ztFinalizeGeneratedText();
            ztRenderResult();
        }
    } catch(e) {
        // Generierung abgebrochen: Eingabeformular wieder anzeigen UND die
        // gesicherten Eingaben aktiv zurückholen, damit nichts neu getippt werden muss.
        ztCloseResult();
        ztRestoreInputDraft(true);
        swal('Fehler', formatKiGenerationError(e, 'Fehler beim Generieren. Bitte erneut versuchen.'), 'error');
    }
}

async function ztRegenerate() {
    ztFlushSave();
    const userMsg = ztBuildUserMsg();
    ztSetLoading();
    try {
        ZtState.currentText = ztNormalizeText(await ztCallAPI([
            { role: 'user', content: userMsg },
            { role: 'assistant', content: ZtState.currentText },
            { role: 'user', content: 'Schreibe einen neuen, anders formulierten Text mit denselben Inhalten.' }
        ]));
        ztUpdateCurrentEntry();
        ztRenderResult();
    } catch(e) {
        ztRenderResult();
        swal('Fehler', formatKiGenerationError(e, 'Fehler beim Generieren.'), 'error');
    }
}

async function ztShortenText() {
    ztFlushSave();
    ztSetLoading();
    try {
        ZtState.currentText = ztNormalizeText(await ztCallAPI([
            { role: 'user', content: ZtState.currentText },
            { role: 'user', content: 'Kürze diesen Text um ca. zwei Sätze. Behalte den Stil und alle wichtigen Informationen bei.' }
        ]));
        ztUpdateCurrentEntry();
        ztRenderResult();
    } catch(e) {
        ztRenderResult();
        swal('Fehler', formatKiGenerationError(e, 'Fehler beim Kürzen.'), 'error');
    }
}

async function ztLengthenText() {
    ztFlushSave();
    ztSetLoading();
    try {
        ZtState.currentText = ztNormalizeText(await ztCallAPI([
            { role: 'user', content: ZtState.currentText },
            { role: 'user', content: 'Verlängere diesen Text um ca. zwei Sätze. Füge sinnvolle, passende Informationen hinzu und behalte den Stil bei.' }
        ]));
        ztUpdateCurrentEntry();
        ztRenderResult();
    } catch(e) {
        ztRenderResult();
        swal('Fehler', formatKiGenerationError(e, 'Fehler beim Verlängern.'), 'error');
    }
}

// Eigene Anweisung zum Verbessern (z.B. nur einen Satz ändern)
async function ztRefineText() {
    ztFlushSave();
    const input = document.getElementById('zt-refine-input');
    const instruction = (input?.value || '').trim();
    if (!instruction) return;
    ztSetLoading();
    try {
        ZtState.currentText = ztNormalizeText(await ztCallAPI([
            { role: 'user', content: ZtState.currentText },
            { role: 'user', content: 'Überarbeite den vorigen Zeugnistext nach dieser Anweisung und gib den vollständigen, überarbeiteten Text zurück: ' + instruction }
        ]));
        ztUpdateCurrentEntry();
        ztRenderResult();
    } catch(e) {
        ztRenderResult();
        swal('Fehler', formatKiGenerationError(e, 'Fehler beim Verfeinern. Bitte erneut versuchen.'), 'error');
    }
}

function ztEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ztTypLabel(typ) {
    if (typ === 'hauptfach') return 'Hauptfach';
    if (typ === 'sozialverhalten') return 'Arbeits-/Sozialverhalten';
    if (typ === 'nebenfach') return 'Nebenfach';
    return '';
}

function ztSetLoading() {
    const container = document.getElementById('zt-result-container');
    const inputContainer = document.getElementById('zt-input-container');
    if (!container) return;

    if (inputContainer) inputContainer.style.display = 'none';
    container.style.display = '';

    container.innerHTML = `
        <div class="zt-panel-body">
            <div class="zt-modal-head">
                <span class="zt-result-badge"><i class="fas fa-file-alt"></i> ${ztEsc(ZtState.currentLabel || 'Zeugnistext')}</span>
                <button class="zt-modal-close" onclick="ztCloseResult()" title="Schließen"><i class="fas fa-times"></i></button>
            </div>
            <div class="zt-result-loading">
                <div class="zt-spinner"></div>
                <p>Text wird erstellt…</p>
            </div>
        </div>`;
}

function ztRenderResult() {
    const container = document.getElementById('zt-result-container');
    const inputContainer = document.getElementById('zt-input-container');
    if (!container) return;

    if (inputContainer) inputContainer.style.display = 'none';
    container.style.display = '';

    ZtState.currentText = ztNormalizeText(ZtState.currentText);
    container.innerHTML = `
        <div class="zt-panel-body">
            <div class="zt-modal-head">
                <span class="zt-result-badge"><i class="fas fa-file-alt"></i> ${ztEsc(ZtState.currentLabel)}</span>
            </div>
            <div class="zt-result-grid-desktop">
                <div class="zt-result-left">
                    <textarea class="zt-result-text" oninput="ztOnTextEdited(this.value)">${ztEsc(ZtState.currentText)}</textarea>
                </div>
                <div class="zt-result-right">
                    <div class="zt-result-actions">
                        <button class="btn btn-primary btn-icon" onclick="ztBackToInputForm()"><i class="fas fa-sync"></i> <span class="btn-text">Neu generieren</span></button>
                        <button class="btn btn-primary btn-icon zt-copy-btn" onclick="ztCopyText(this)"><i class="fas fa-copy"></i> <span class="btn-text">Kopieren</span></button>
                    </div>
                </div>
            </div>
        </div>`;
}

function ztCopyText(btn) {
    ztFlushSave();
    navigator.clipboard.writeText(ZtState.currentText);
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> <span class="btn-text">Kopiert!</span>';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
}

// Füllt die Eingabemaske aus einem Archiv-Eintrag. Bei älteren Einträgen ohne
// separate Felder wird Name/Fach aus dem Label ("Name · Fach") abgeleitet.
function ztFillFormFromEntry(entry) {
    if (!entry) return;
    if (entry.typ) setZtTyp(entry.typ);
    // Name/Fach: bevorzugt gespeicherte Felder, sonst aus dem Label parsen
    let name = typeof entry.name === 'string' ? entry.name : '';
    let fach = typeof entry.fach === 'string' ? entry.fach : '';
    if ((!name || (!fach && entry.typ !== 'sozialverhalten')) && entry.label) {
        const parts = String(entry.label).split(' · ');
        if (!name) name = parts[0] || '';
        if (!fach && parts.length > 1) fach = parts[1] || '';
    }
    const set = (id, val) => { const el = document.getElementById(id); if (el && typeof val === 'string') el.value = val; };
    if (typeof entry.halbjahr === 'string' && entry.halbjahr) set('zt-halbjahr', entry.halbjahr);
    set('zt-fach', fach);
    set('zt-name', name);
    set('zt-themen', typeof entry.themen === 'string' ? entry.themen : '');
    set('zt-beobachtungen', typeof entry.beobachtungen === 'string' ? entry.beobachtungen : '');
}

// "Neu generieren" aus der Ergebnisansicht: zurück zur Eingabemaske mit allen
// bereits gemachten Eingaben. Die nächste Generierung aktualisiert denselben
// Archiv-Eintrag (statt einen zweiten anzulegen).
function ztBackToInputForm() {
    ztFlushSave();
    let entry = null;
    if (ZtState.currentId) entry = ZtState.archive.find(a => a.id === ZtState.currentId);
    if (entry) {
        ztFillFormFromEntry(entry);
        ZtState.editingEntryId = entry.id;
        // courseId/-Name dieses Eintrags fürs Auto-Abhaken nicht erneut auslösen
        ZtState.planungRef = null;
    } else {
        // Frisch generierter Text ohne Eintrag: Felder sind bereits ausgefüllt.
        ZtState.editingEntryId = ZtState.currentId || null;
    }
    ztSaveInputDraft();
    ztCloseResult();
    const beobEl = document.getElementById('zt-beobachtungen');
    if (beobEl) { try { beobEl.focus({ preventScroll: true }); } catch (e) {} }
}

// Zeigt die zum Text gespeicherten Beobachtungen & Gedanken an (aus dem Archiv-
// Eintrag; Fallback auf das aktuell ausgefüllte Eingabefeld).
function ztShowBeobachtungen() {
    let beob = '';
    let themen = '';
    if (ZtState.currentId) {
        const entry = ZtState.archive.find(a => a.id === ZtState.currentId);
        if (entry && typeof entry.beobachtungen === 'string') beob = entry.beobachtungen;
        if (entry && typeof entry.themen === 'string') themen = entry.themen;
    }
    if (!beob) beob = (document.getElementById('zt-beobachtungen')?.value || '');
    if (!themen) themen = (document.getElementById('zt-themen')?.value || '');

    const modal = document.getElementById('zt-beob-modal');
    if (!modal) {
        swal('Neu generieren', beob || 'Für diesen Text wurden keine Beobachtungen gespeichert.', 'info');
        return;
    }
    const showThemen = ZtState.currentTyp !== 'sozialverhalten';
    modal.innerHTML = `
        <div class="zt-modal-head">
            <span style="font-size:1.25rem;font-weight:700;">Neu generieren</span>
            <button class="zt-modal-close" onclick="hideModal()" title="Schließen"><i class="fas fa-times"></i></button>
        </div>
        <div style="padding:4px 4px 0;">
            ${showThemen ? `<label style="font-weight:600;margin-bottom:4px;display:block;">Themen</label>
            <textarea id="zt-beob-themen" class="form-control" style="width:100%; min-height:80px; resize:vertical; margin-bottom:14px;">${ztEsc(themen)}</textarea>` : ''}
            <label style="font-weight:600;margin-bottom:4px;display:block;">Beobachtungen &amp; Gedanken</label>
            <textarea id="zt-beob-edit" class="form-control" style="width:100%; min-height:220px; resize:vertical;">${ztEsc(beob)}</textarea>
            <div style="margin-top:14px;">
                <button class="btn btn-primary btn-icon btn-block" onclick="ztRegenerateFromBeob()"><i class="fas fa-sync"></i> <span class="btn-text">Neu generieren</span></button>
            </div>
        </div>`;
    showModal('zt-beob-modal');
    const ta = document.getElementById('zt-beob-edit');
    if (ta) { try { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* ignore */ } }
}

// Beobachtungen aus dem Modal übernehmen und den Text damit neu generieren.
async function ztRegenerateFromBeob() {
    const ta = document.getElementById('zt-beob-edit');
    const newBeob = ta ? ta.value.trim() : '';
    if (!newBeob) {
        swal('Warnung', 'Bitte gib Beobachtungen ein.', 'warning');
        return;
    }
    // Aktualisierte Themen (falls Feld vorhanden) ins Formular übernehmen
    const themenModal = document.getElementById('zt-beob-themen');
    if (themenModal) {
        const themenEl = document.getElementById('zt-themen');
        if (themenEl) themenEl.value = themenModal.value;
        if (ZtState.currentId) {
            const entry = ZtState.archive.find(a => a.id === ZtState.currentId);
            if (entry) entry.themen = themenModal.value;
        }
    }
    // Aktualisierte Beobachtungen ins Formular, in den Entwurf und in den Archiv-Eintrag übernehmen
    const beobEl = document.getElementById('zt-beobachtungen');
    if (beobEl) beobEl.value = newBeob;
    ztSaveInputDraft();
    if (ZtState.currentId) {
        const entry = ZtState.archive.find(a => a.id === ZtState.currentId);
        if (entry) entry.beobachtungen = newBeob;
    }
    hideModal();
    ztSetLoading();
    try {
        // Frische Generierung mit den neuen Beobachtungen (gleiche Themen/Fach/Halbjahr)
        const initialMessages = [{ role: 'user', content: ztBuildUserMsg() }];
        const apiResult = await ztCallAPI(initialMessages);
        if (apiResult.questions && apiResult.questions.length > 0) {
            showClarifyingQuestionsModal(apiResult.questions, initialMessages);
        } else {
            ZtState.currentText = ztNormalizeText(apiResult.text);
            ztUpdateCurrentEntry();
            ztRenderResult();
        }
    } catch (e) {
        ztRenderResult();
        swal('Fehler', formatKiGenerationError(e, 'Fehler beim Generieren.'), 'error');
    }
}

// ===== Archiv (dauerhaft, Cloud-synchronisiert, sofort gespeichert) =====
function ztInitArchive() {
    try {
        const raw = localStorage.getItem('zeugnistexteArchiv');
        ZtState.archive = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(ZtState.archive)) ZtState.archive = [];
    } catch (e) { ZtState.archive = []; }
    ztUpdateArchiveBadge();
}

function ztUpdateArchiveBadge() {
    const badge = document.getElementById('zt-archive-badge');
    if (!badge) return;
    if (ZtState.archive.length) {
        badge.textContent = ZtState.archive.length;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

function ztPersistArchive() {
    try {
        localStorage.setItem('zeugnistexteArchiv', JSON.stringify(ZtState.archive));
        localStorage.setItem('extraDataLastUpdate', new Date().toISOString());
    } catch (e) {
        console.warn("Fehler beim Speichern von zeugnistexteArchiv:", e);
    }
    ztUpdateArchiveBadge();
    if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.saveDataToCloud === 'function') {
        window.saveDataToCloud();
    }
}

// Neue Generierung -> sofort einen Archiv-Eintrag anlegen
function ztCreateArchiveEntry() {
    const beob = (document.getElementById('zt-beobachtungen')?.value || '').trim();
    const themen = (document.getElementById('zt-themen')?.value || '').trim();
    const halbjahr = (document.getElementById('zt-halbjahr')?.value || '').trim();
    const fach = (document.getElementById('zt-fach')?.value || '').trim();
    const name = (document.getElementById('zt-name')?.value || '').trim();
    // Kursbezug aus der Planung übernehmen, damit der Text im Archiv unter
    // demselben Kurs gruppiert wird wie in der Planungsliste.
    let courseId = '';
    let courseName = '';
    if (ZtState.planungRef && ZtState.planungRef.courseId && typeof ZtPlanungState !== 'undefined') {
        courseId = ZtState.planungRef.courseId;
        const refCourse = (ZtPlanungState.courses || []).find(c => c.id === courseId);
        if (refCourse) courseName = refCourse.name || refCourse.fach || '';
    }
    const entry = {
        id: 'zt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        label: ZtState.currentLabel || 'Zeugnistext',
        typ: ZtState.currentTyp,
        text: ZtState.currentText,
        beobachtungen: beob,
        themen: themen,
        halbjahr: halbjahr,
        fach: fach,
        name: name,
        courseId: courseId,
        courseName: courseName,
        date: new Date().toISOString()
    };
    ZtState.archive.unshift(entry);
    if (ZtState.archive.length > 50) ZtState.archive = ZtState.archive.slice(0, 50);
    ZtState.currentId = entry.id;
    ztPersistArchive();
    // Wenn aus der Planung gesprungen wurde: Schüler automatisch als erledigt markieren
    ztPlanungMarkRefDone();
}

// Bearbeitung (Kürzen/Verlängern/Anweisung/Neu) -> bestehenden Eintrag aktualisieren.
// Aktualisiert NUR Text/Label/Typ – die Eingabefelder werden hier bewusst NICHT
// gelesen (beim direkten Bearbeiten eines geöffneten Archiv-Eintrags enthalten die
// Felder nicht zwingend dessen Werte). Die Eingaben werden gezielt in ztGenerate
// (Regenerieren-Pfad) mitgeschrieben.
function ztUpdateCurrentEntry() {
    if (!ZtState.currentId) { ztCreateArchiveEntry(); return; }
    const entry = ZtState.archive.find(a => a.id === ZtState.currentId);
    if (!entry) { ztCreateArchiveEntry(); return; }
    entry.text = ZtState.currentText;
    entry.label = ZtState.currentLabel;
    entry.typ = ZtState.currentTyp;
    entry.date = new Date().toISOString();
    ztPersistArchive();
}

// Schreibt die aktuellen Eingabefelder in einen Archiv-Eintrag (nur im
// Regenerieren-Pfad, wo die Felder garantiert zum Eintrag passen).
function ztUpdateEntryInputs(entry) {
    if (!entry) return;
    const beobEl = document.getElementById('zt-beobachtungen');
    const themenEl = document.getElementById('zt-themen');
    const halbjahrEl = document.getElementById('zt-halbjahr');
    const fachEl = document.getElementById('zt-fach');
    const nameEl = document.getElementById('zt-name');
    if (beobEl) entry.beobachtungen = beobEl.value.trim();
    if (themenEl) entry.themen = themenEl.value.trim();
    if (halbjahrEl) entry.halbjahr = halbjahrEl.value.trim();
    if (fachEl) entry.fach = fachEl.value.trim();
    if (nameEl) entry.name = nameEl.value.trim();
}

// Nach erfolgreicher Generierung: bestehenden Eintrag aktualisieren (Regenerieren)
// oder einen neuen anlegen (frische Generierung).
function ztFinalizeGeneratedText() {
    if (ZtState.currentId) {
        const entry = ZtState.archive.find(a => a.id === ZtState.currentId);
        if (entry) {
            entry.text = ZtState.currentText;
            entry.label = ZtState.currentLabel;
            entry.typ = ZtState.currentTyp;
            entry.date = new Date().toISOString();
            ztUpdateEntryInputs(entry);
            ztPersistArchive();
            ztPlanungMarkRefDone();
            return;
        }
    }
    ztCreateArchiveEntry();
}

// Rückwärtskompatibel: Archiv wird jetzt inline statt im Modal geöffnet.
function ztOpenArchiveModal() {
    ztShowArchiveInline();
}

// HTML eines einzelnen Archiv-Eintrags – visuell wie eine Planungslisten-Zeile.
function ztArchiveItemHtml(item) {
    const d = item.date ? new Date(item.date) : null;
    const dateStr = d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const typLabel = ztTypLabel(item.typ);
    return `
        <li class="zt-plan-student zt-archive-row" onclick="ztOpenArchive('${item.id}')">
            <div class="zt-archive-row-main">
                <span class="zt-plan-student-name">${ztEsc(item.label)}</span>
                ${typLabel ? `<span class="zt-archive-typ">${typLabel}</span>` : ''}
            </div>
            <span class="zt-archive-date">${dateStr}</span>
            <div class="zt-archive-actions">
                <button class="btn btn-sm btn-primary btn-circle-sm" title="Öffnen / Bearbeiten" onclick="event.stopPropagation();ztOpenArchive('${item.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger btn-circle-sm" title="Löschen" onclick="event.stopPropagation();ztDeleteArchive('${item.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </li>`;
}

// Archiv-Einträge nach Kurs gruppiert und sortiert – wie die Planungsliste.
function ztArchiveGroupedHtml(items) {
    const groups = new Map(); // courseId -> { name, items }
    items.forEach(item => {
        const key = item.courseId || '';
        if (!groups.has(key)) {
            let name = '';
            if (key && typeof ZtPlanungState !== 'undefined') {
                const c = (ZtPlanungState.courses || []).find(x => x.id === key);
                if (c) name = c.name || c.fach || '';
            }
            if (!name) name = item.courseName || '';
            groups.set(key, { name, items: [] });
        }
        groups.get(key).items.push(item);
    });
    const sortInfo = (name) => {
        const m = (name || '').match(/(\d+)\s*([a-zA-Z])/);
        return m ? { num: parseInt(m[1], 10), letter: m[2].toLowerCase() } : { num: 9999, letter: '' };
    };
    const keys = [...groups.keys()].sort((a, b) => {
        if (!a) return 1;   // "Ohne Kurs" ans Ende
        if (!b) return -1;
        const ga = groups.get(a), gb = groups.get(b);
        const ka = sortInfo(ga.name), kb = sortInfo(gb.name);
        if (ka.num !== kb.num) return ka.num - kb.num;
        if (ka.letter !== kb.letter) return ka.letter.localeCompare(kb.letter);
        return (ga.name || '').localeCompare(gb.name || '', 'de');
    });
    return '<div class="zt-archive-list">' + keys.map(k => {
        const g = groups.get(k);
        const headLabel = k ? (g.name || 'Kurs') : 'Ohne Kurs';
        const count = g.items.length;
        return `<div class="zt-plan-course">
            <div class="zt-plan-course-head">
                <div class="zt-plan-course-title">
                    <span class="zt-plan-course-name">${ztEsc(headLabel)}</span>
                    <span class="zt-plan-course-progress">${count} ${count === 1 ? 'Eintrag' : 'Einträge'}</span>
                </div>
            </div>
            <ul class="zt-plan-students">${g.items.map(ztArchiveItemHtml).join('')}</ul>
        </div>`;
    }).join('') + '</div>';
}

// Archiv als Inline-Ansicht (füllt – wie die Planungsliste – den Bereich unten
// und scrollt natürlich mit der Seite, kein Modal).
function ztRenderArchiveInline() {
    const container = document.getElementById('zt-archive-inline');
    if (!container) return;
    const items = ZtState.archive;
    const isEmpty = !items.length;
    const body = isEmpty
        ? `<div class="zt-plan-empty">
                <i class="fas fa-box-open"></i>
                <p>Noch keine Texte im Archiv.</p>
                <p>Generierte Zeugnistexte werden hier automatisch gespeichert.</p>
           </div>`
        : ztArchiveGroupedHtml(items);
    container.classList.toggle('zt-planung-empty-state', isEmpty);
    container.innerHTML = body;
    // Header-Zusammenfassung auf Archiv-Anzahl setzen
    const summary = document.getElementById('zt-planung-header-summary');
    if (summary && ZtState.inlineMode === 'archive') {
        const n = items.length;
        summary.innerHTML = `<span class="zt-plan-inline-open">${n} ${n === 1 ? 'Eintrag' : 'Einträge'}</span>`;
    }
}

function ztOpenArchive(id) {
    const item = ZtState.archive.find(a => a.id === id);
    if (!item) return;
    ZtState.currentText = item.text;
    ZtState.currentLabel = item.label;
    ZtState.currentId = item.id;
    ZtState.editingEntryId = null;
    if (item.typ) setZtTyp(item.typ);
    hideModal();
    // In die Text-/Generator-Ansicht wechseln – sonst bleibt die zt-stack (mit dem
    // Ergebnis-Panel) ausgeblendet und man sieht weiterhin die Klassen-Liste.
    ZtState.inlineMode = 'text';
    ztApplyInlineMode();
    ztRenderResult();
}

function ztDeleteArchive(id) {
    const item = ZtState.archive.find(a => a.id === id);
    if (!item) return;
    swal({
        title: 'Eintrag löschen?',
        text: `„${item.label}" wird dauerhaft aus dem Archiv entfernt.`,
        icon: 'warning',
        buttons: [false, 'Löschen'],
        dangerMode: true
    }).then(willDelete => {
        if (!willDelete) return;
        ZtState.archive = ZtState.archive.filter(a => a.id !== id);
        if (ZtState.currentId === id) ZtState.currentId = null;
        ztPersistArchive();
        ztRenderArchiveInline();
    });
}

// Wird vom Cloud-Sync (index.html) aufgerufen, wenn das Archiv von einem
// anderen Gerät aktualisiert wurde.
window.setZeugnistexteArchiv = function(arr) {
    ZtState.archive = Array.isArray(arr) ? arr : [];
    ztUpdateArchiveBadge();
    if (ZtState.inlineMode === 'archive') ztRenderArchiveInline();
};

function showClarifyingQuestionsModal(questions, originalMessages) {
    const body = document.getElementById('zt-questions-body');
    if (!body) return;
    
    body.innerHTML = '';
    ZtState.pendingQuestions = questions;
    ZtState.pendingMessages = originalMessages;
    
    questions.forEach((q, index) => {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.marginBottom = '15px';
        
        group.innerHTML = `
            <label style="font-weight: 600; margin-bottom: 5px; display: block;">${ztEsc(q)}</label>
            <textarea class="form-control zt-answer-input" rows="2" placeholder="Deine Antwort..." style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd; font-family:inherit;"></textarea>
        `;
        body.appendChild(group);
    });
    
    ztCloseResult();
    showModal('zt-questions-modal');
}

async function ztSubmitAnswers() {
    const inputs = document.querySelectorAll('.zt-answer-input');
    const answers = [];
    inputs.forEach(input => {
        answers.push((input.value || '').trim());
    });
    
    const hasAtLeastOneAnswer = answers.some(ans => ans.length > 0);
    if (!hasAtLeastOneAnswer) {
        swal('Info', 'Bitte beantworte mindestens eine der Rückfragen.', 'info');
        return;
    }
    
    hideModal();
    ztSetLoading();
    
    const questions = ZtState.pendingQuestions || [];
    let answerContent = 'Hier sind die Antworten auf deine Rückfragen:\n';
    questions.forEach((q, idx) => {
        const ans = answers[idx] || 'Keine Angabe';
        answerContent += `${idx + 1}. Frage: "${q}"\n   Antwort: "${ans}"\n`;
    });
    
    const KIQuestionsStr = JSON.stringify({ status: 'unclear', questions: questions });
    ZtState.pendingMessages.push({ role: 'assistant', content: KIQuestionsStr });
    ZtState.pendingMessages.push({ role: 'user', content: answerContent });
    
    try {
        const apiResult = await ztCallAPI(ZtState.pendingMessages);
        if (apiResult.questions && apiResult.questions.length > 0) {
            showClarifyingQuestionsModal(apiResult.questions, ZtState.pendingMessages);
        } else {
            ZtState.currentText = ztNormalizeText(apiResult.text);
            ztFinalizeGeneratedText();
            ztRenderResult();
        }
    } catch(e) {
        ztCloseResult();
        swal('Fehler', formatKiGenerationError(e, 'Fehler beim Generieren. Bitte erneut versuchen.'), 'error');
    }
}

window.setZtTyp = setZtTyp;
window.ztOpenTextModal = ztOpenTextModal;
window.ztShowPlanningInline = ztShowPlanningInline;
window.ztShowArchiveInline = ztShowArchiveInline;
window.ztToggleTextInline = ztToggleTextInline;
window.ztGenerate = ztGenerate;
window.ztRegenerate = ztRegenerate;
window.ztBackToInputForm = ztBackToInputForm;
window.ztShortenText = ztShortenText;
window.ztLengthenText = ztLengthenText;
window.ztRefineText = ztRefineText;
window.ztCopyText = ztCopyText;
window.ztShowBeobachtungen = ztShowBeobachtungen;
window.ztOpenArchiveModal = ztOpenArchiveModal;
window.ztOpenArchive = ztOpenArchive;
window.ztDeleteArchive = ztDeleteArchive;
window.ztCloseResult = ztCloseResult;
window.ztNextStudent = ztNextStudent;
window.ztBackToPlanung = ztBackToPlanung;
window.ztOnTextEdited = ztOnTextEdited;
window.ztOnTextEdited = ztOnTextEdited;
window.ztSubmitAnswers = ztSubmitAnswers;

// ===== ZEUGNIS TEXTE: PLANUNG =====
// Übersicht, für welche Schüler noch Texte geschrieben werden müssen.
// Kurse bündeln gemeinsame Infos (Halbjahr, Art, Fach, Themen) für mehrere Schüler.
const ZtPlanungState = {
    courses: [],
    initialized: false,
    formCourseId: null, // null = neuer Kurs, sonst Bearbeitung
    formDraft: null     // { halbjahr, typ, fach, themen, students: [{id, name, done}] }
};

function ztPlanungInit() {
    if (ZtPlanungState.initialized) return;
    try {
        const raw = localStorage.getItem('ztPlanung');
        const parsed = raw ? JSON.parse(raw) : null;
        ZtPlanungState.courses = (parsed && Array.isArray(parsed.courses)) ? parsed.courses : [];
    } catch (e) { ZtPlanungState.courses = []; }
    ZtPlanungState.initialized = true;
    ztPlanungSyncClassTeacherCourse();
    ztPlanungUpdateBadge();
}

function ztPlanungPersist() {
    try {
        localStorage.setItem('ztPlanung', JSON.stringify({ courses: ZtPlanungState.courses }));
        localStorage.setItem('extraDataLastUpdate', new Date().toISOString());
    } catch (e) {
        console.warn('Fehler beim Speichern von ztPlanung:', e);
    }
    ztPlanungUpdateBadge();
    ztPlanungRenderInline();
    if (typeof renderDashboardZtPlanungTile === 'function') renderDashboardZtPlanungTile();
    if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.saveDataToCloud === 'function') {
        window.saveDataToCloud();
    }
}

function ztPlanungStudentKey(name) {
    return String(name || '').trim().toLowerCase();
}

function ztPlanungAutoStudentId(classIndex, studentName) {
    return 'kl_' + classIndex + '_' + ztPlanungStudentKey(studentName).replace(/[^a-z0-9]+/g, '_');
}

function ztPlanungClassTeacherCourseName(cls) {
    return [(cls.klasse || cls.name || '').trim(), 'Arbeits und Sozialverhalten'].filter(Boolean).join(' ');
}

function ztPlanungSyncClassTeacherCourse() {
    if (typeof ztPlanungInit === 'function') ztPlanungInit();
    if (typeof ZtPlanungState === 'undefined' || !Array.isArray(classes)) return false;

    const classIndex = classes.findIndex(cls => cls && cls.classTeacher);
    if (classIndex < 0) return false;

    const cls = classes[classIndex];
    const learningStudents = (cls.students || []).filter(student => student && student.learningSupport && (student.name || '').trim());
    if (!learningStudents.length) return false;

    const courseId = 'klassenlehrer:' + classIndex;
    let course = ZtPlanungState.courses.find(c => c.id === courseId);
    let changed = false;

    if (!course) {
        course = {
            id: courseId,
            source: 'klassenlehrer',
            name: ztPlanungClassTeacherCourseName(cls),
            halbjahr: 'ersten',
            typ: 'sozialverhalten',
            fach: '',
            themen: '',
            textResponsible: 'me',
            students: []
        };
        ZtPlanungState.courses.push(course);
        changed = true;
    }

    const desiredName = ztPlanungClassTeacherCourseName(cls);
    if (course.name !== desiredName) {
        course.name = desiredName;
        changed = true;
    }

    if (!course.textResponsible && !course.delegatedToTeacher && !course.customResponsibleName) {
        course.textResponsible = 'me';
        changed = true;
    }

    if (!Array.isArray(course.students)) course.students = [];
    const existingNames = new Set(course.students.map(s => ztPlanungStudentKey(s.name)));
    learningStudents.forEach(student => {
        const key = ztPlanungStudentKey(student.name);
        if (!key || existingNames.has(key)) return;
        course.students.push({
            id: ztPlanungAutoStudentId(classIndex, student.name),
            name: student.name.trim(),
            done: !!course.delegatedToTeacher
        });
        existingNames.add(key);
        changed = true;
    });

    if (changed) {
        try {
            localStorage.setItem('ztPlanung', JSON.stringify({ courses: ZtPlanungState.courses }));
            localStorage.setItem('extraDataLastUpdate', new Date().toISOString());
        } catch (e) {
            console.warn('Fehler beim automatischen Ergänzen der Klassenlehrer-Planung:', e);
        }
        ztPlanungUpdateBadge();
        ztPlanungRenderInline();
        const pm = document.getElementById('zt-planung-modal');
        if (pm && pm.style.display !== 'none') ztPlanungRenderList();
    }

    return changed;
}

function ztPlanungCounts() {
    let total = 0, done = 0;
    ZtPlanungState.courses.forEach(c => {
        (c.students || []).forEach(s => { total++; if (s.done) done++; });
    });
    return { total, done, open: total - done };
}

function ztPlanungUpdateBadge() {
    const badge = document.getElementById('zt-planung-badge');
    if (!badge) return;
    const { open } = ztPlanungCounts();
    if (open > 0) { badge.textContent = open; badge.style.display = ''; }
    else { badge.style.display = 'none'; }
}

// Wird vom Cloud-Sync (app.html) aufgerufen, wenn die Planung von einem anderen Gerät aktualisiert wurde.
window.setZtPlanung = function(obj) {
    ZtPlanungState.courses = (obj && Array.isArray(obj.courses)) ? obj.courses : [];
    ZtPlanungState.initialized = true;
    ztPlanungSyncClassTeacherCourse();
    ztPlanungUpdateBadge();
    ztPlanungRenderInline();
    if (typeof renderDashboardZtPlanungTile === 'function') renderDashboardZtPlanungTile();
    const m = document.getElementById('zt-planung-modal');
    if (m && m.style.display !== 'none') ztPlanungRenderList();
};

// ----- Listenansicht -----
function ztPlanungOpen(focusCourseId = null, options = {}) {
    ztPlanungInit();
    ztPlanungSyncClassTeacherCourse();
    ztPlanungRenderList();
    showModal('zt-planung-modal');
    if (Number.isFinite(options.scrollTop)) {
        const modal = document.getElementById('zt-planung-modal');
        if (modal) {
            modal.scrollTop = options.scrollTop;
            requestAnimationFrame(() => { modal.scrollTop = options.scrollTop; });
        }
    }
    if (focusCourseId) {
        requestAnimationFrame(() => ztPlanungFocusCourse(focusCourseId));
        setTimeout(() => ztPlanungFocusCourse(focusCourseId), 120);
    }
}

function ztPlanungOpenAtTop() {
    ztPlanungOpenInline(null, { scrollTop: 0 });
}

function ztPlanungFocusCourseIn(container, courseId) {
    if (!container) return;
    const card = Array.from(container.querySelectorAll('.zt-plan-course')).find(el => el.dataset.courseId === courseId);
    if (!card) return;
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    card.classList.add('zt-plan-course-focus');
    setTimeout(() => card.classList.remove('zt-plan-course-focus'), 1400);
}

function ztPlanungFocusCourse(courseId) {
    ztPlanungFocusCourseIn(document.getElementById('zt-planung-modal'), courseId);
}

function ztPlanungFocusInlineCourse(courseId) {
    ztPlanungFocusCourseIn(document.getElementById('zt-planung-inline'), courseId);
}

function ztPlanungOpenInline(focusCourseId = null, options = {}) {
    ztPlanungInit();
    ztPlanungSyncClassTeacherCourse();
    openToolWindow('zeugnis-texte');
    ZtState.inlineMode = 'planung';
    ztPlanungRenderInline();
    ztApplyInlineMode();

    const scrollToTarget = () => {
        if (Number.isFinite(options.scrollTop)) {
            const body = document.getElementById('tool-window-body');
            if (body) body.scrollTop = options.scrollTop;
            window.scrollTo({ top: options.scrollTop, behavior: 'auto' });
        }
        if (focusCourseId) ztPlanungFocusInlineCourse(focusCourseId);
    };

    requestAnimationFrame(scrollToTarget);
    setTimeout(scrollToTarget, 160);
}

function ztPlanungSortKey(course) {
    const label = (course.name || course.fach || '').trim();
    const m = label.match(/(\d+)\s*([a-zA-Z])/);
    if (m) return { num: parseInt(m[1], 10), letter: m[2].toLowerCase(), rest: label };
    return { num: 999, letter: '', rest: label };
}

function ztPlanungSortedCourses() {
    return [...ZtPlanungState.courses].sort((a, b) => {
        const ka = ztPlanungSortKey(a), kb = ztPlanungSortKey(b);
        if (ka.num !== kb.num) return ka.num - kb.num;
        if (ka.letter !== kb.letter) return ka.letter.localeCompare(kb.letter);
        return ka.rest.localeCompare(kb.rest, 'de');
    });
}

function ztPlanungDashboardCourses() {
    return [...ZtPlanungState.courses].sort((a, b) => {
        const ka = ztPlanungSortKey(a), kb = ztPlanungSortKey(b);
        if (ka.num !== kb.num) return ka.num - kb.num;
        if (ka.letter !== kb.letter) return ka.letter.localeCompare(kb.letter);
        return ka.rest.localeCompare(kb.rest, 'de');
    });
}

function ztPlanungRenderList() {
    const modal = document.getElementById('zt-planung-modal');
    if (!modal) return;
    // Scroll-Position der Liste über das Neuzeichnen (innerHTML) hinweg erhalten,
    // z. B. beim Abhaken eines Schülers. Beim Zurückkehren aus dem Kurs-Formular
    // ist das Modal kurz display:none (scrollTop = 0) -> dort übernimmt
    // ztPlanungCancelForm die Wiederherstellung aus ZtPlanungState.listScrollTop.
    const prevScroll = modal.scrollTop;
    const courses = ztPlanungSortedCourses();
    const { total, done } = ztPlanungCounts();
    const progressLabel = total ? `${done}/${total} erledigt` : '';

    const isEmpty = !courses.length;
    const body = isEmpty
        ? `<div class="zt-plan-empty">
                <i class="fas fa-clipboard-list"></i>
                <p>Noch keine Kurse geplant.</p>
                <p>Kurse werden automatisch aus dem Stundenplan übernommen.</p>
           </div>`
        : '<div class="zt-plan-list">' + courses.map(c => ztPlanungCourseCardHtml(c)).join('') + '</div>';

    modal.classList.toggle('zt-planung-empty-state', isEmpty);

    modal.innerHTML = `
        <div class="zt-modal-head">
            <span style="font-size:1.25rem;font-weight:700;display:flex;align-items:center;gap:8px;">
                Planung
                ${progressLabel ? `<span class="zt-archive-count" style="font-size:0.82rem;font-weight:400;color:var(--grey-color);background:var(--light-color);padding:2px 8px;border-radius:12px;margin-left:6px;">${progressLabel}</span>` : ''}
            </span>
            <button class="zt-modal-close" onclick="hideModal()" title="Schließen"><i class="fas fa-times"></i></button>
        </div>
        <div class="zt-plan-add-row zt-plan-toolbar">
            <button class="btn btn-secondary btn-icon" onclick="ztPlanungOpenForm()"><i class="fas fa-plus"></i> Klasse anlegen</button>
            <button class="btn btn-secondary btn-icon" onclick="ztPlanungPrintResponsibleList()"><i class="fas fa-print"></i> Planung drucken</button>
        </div>
        ${body}`;
    modal.scrollTop = prevScroll;
}

function ztPlanungRenderInline() {
    const container = document.getElementById('zt-planung-inline');
    if (!container) return;
    ztPlanungInit();
    ztPlanungSyncClassTeacherCourse();
    const courses = ztPlanungSortedCourses();
    const { total, done, open } = ztPlanungCounts();
    const isEmpty = !courses.length;
    const body = isEmpty
        ? `<div class="zt-plan-empty">
                <i class="fas fa-clipboard-list"></i>
                <p>Noch keine Kurse geplant.</p>
                <p>Kurse werden automatisch aus dem Stundenplan übernommen.</p>
           </div>`
        : '<div class="zt-plan-list">' + courses.map(c => ztPlanungCourseCardHtml(c)).join('') + '</div>';

    ztPlanungRenderHeaderSummary(total, done, open);
    container.classList.toggle('zt-planung-empty-state', isEmpty);
    container.innerHTML = body;
}

function ztPlanungRenderHeaderSummary(total, done, open) {
    const summary = document.getElementById('zt-planung-header-summary');
    if (!summary) return;
    const openLabel = total ? `${open} offen` : '0 offen';
    summary.innerHTML = `<span class="zt-plan-inline-open">${openLabel}</span>`;
}

function ztPlanungPrintResponsibleList() {
    ztPlanungInit();
    ztPlanungSyncClassTeacherCourse();
    const courses = ztPlanungSortedCourses();
    if (!courses.length) {
        swal('Hinweis', 'Es gibt keine Planungskurse zum Drucken.', 'info');
        return;
    }

    const rows = courses.map(course => {
        const courseName = course.name || course.fach || 'Kurs';
        const teacher = ztPlanungResponsibleName(course);
        return `
            <tr>
                <td class="course">${ztEsc(courseName)}</td>
                <td class="teacher">${ztEsc(teacher)}</td>
                <td class="me"></td>
            </tr>`;
    }).join('');

    const html = `<!doctype html>
        <html lang="de">
        <head>
            <meta charset="utf-8">
            <title>Planung Zuständigkeiten</title>
            <style>
                * { box-sizing: border-box; }
                body { font-family: Arial, sans-serif; margin: 18mm; color: #111827; }
                h1 { font-size: 18px; margin: 0 0 12px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid #9ca3af; padding: 6px 8px; vertical-align: middle; }
                th { background: #f3f4f6; text-align: left; font-weight: 700; }
                th.teacher, td.teacher { width: 26%; }
                th.me, td.me { width: 26%; }
                td.course { width: 48%; font-weight: 700; }
                td.teacher { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                @page { size: A4 portrait; margin: 12mm; }
            </style>
        </head>
        <body>
            <h1>Planung Zuständigkeiten</h1>
            <table>
                <thead>
                    <tr>
                        <th>Kurs</th>
                        <th class="teacher">Fachlehrer</th>
                        <th class="me">Ich</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <script>window.onload = function(){ window.print(); }</script>
        </body>
        </html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) { swal('Hinweis', 'Bitte Popup-Blocker deaktivieren um zu drucken.', 'info'); return; }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
}

function ztPlanungResponsibleName(course) {
    const responsible = course.textResponsible || (course.delegatedToTeacher ? 'teacher' : '');
    if (responsible === 'other') return (course.customResponsibleName || '').trim();
    return (course.fachlehrer || '').trim();
}

function ztPlanungPromptOtherResponsible(course) {
    return new Promise(resolve => {
        const current = (course.customResponsibleName || '').trim();
        const tileScrollEl = document.querySelector('#dashboard-zt-list .dashboard-zt-scroll');
        const tileScrollTop = tileScrollEl ? tileScrollEl.scrollTop : null;
        if (typeof captureDashboardScrollRestore === 'function') captureDashboardScrollRestore(tileScrollTop);
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';
        setAppThemeColor(APP_THEME_MODAL);

        const dialog = document.createElement('div');
        dialog.className = 'app-dialog zt-other-responsible-dialog';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'app-dialog-close';
        closeBtn.setAttribute('aria-label', 'Schließen');
        closeBtn.innerHTML = '&times;';

        const title = document.createElement('h2');
        title.className = 'app-dialog-title';
        title.textContent = 'Wer ist zuständig?';

        const text = document.createElement('p');
        text.className = 'app-dialog-text';
        text.textContent = 'Trage ein, wer die Texte übernimmt.';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control zt-other-responsible-input';
        input.placeholder = 'Name eingeben';
        input.value = current;

        const btnRow = document.createElement('div');
        btnRow.className = 'app-dialog-buttons';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = 'Speichern';
        btnRow.appendChild(saveBtn);

        function cleanup(result) {
            document.removeEventListener('keydown', keyHandler, true);
            overlay.classList.add('app-dialog-closing');
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                restoreAppThemeColor();
            }, 120);
            if (typeof scheduleDashboardScrollRestore === 'function') scheduleDashboardScrollRestore();
            resolve(result);
        }

        function save() {
            const trimmed = input.value.trim();
            if (!trimmed) {
                input.focus();
                input.classList.add('input-error');
                return;
            }
            course.customResponsibleName = trimmed;
            course.delegatedToTeacher = true;
            course.textResponsible = 'other';
            (course.students || []).forEach(s => { s.done = true; });
            cleanup(true);
        }

        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                save();
            }
        };

        closeBtn.onclick = () => cleanup(false);
        saveBtn.onclick = save;
        overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
        input.addEventListener('input', () => input.classList.remove('input-error'));
        document.addEventListener('keydown', keyHandler, true);

        dialog.appendChild(closeBtn);
        dialog.appendChild(title);
        dialog.appendChild(text);
        dialog.appendChild(input);
        dialog.appendChild(btnRow);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        setTimeout(() => {
            input.focus();
            input.select();
        }, 30);
    });
}

function ztPlanungCourseCardHtml(course) {
    const students = course.students || [];
    const total = students.length;
    const done = students.filter(s => s.done).length;
    const typLabel = ztTypLabel(course.typ);
    const isSozial = course.typ === 'sozialverhalten';
    const halbjahrLabel = isSozial ? '' : (course.halbjahr === 'zweiten' ? '2. Halbjahr' : '1. Halbjahr');
    const isLinked = course.source === 'stundenplan' || course.source === 'klassenlehrer';

    const title = course.name ? ztEsc(course.name) : (() => {
        const parts = [];
        if (!isSozial && course.fach) parts.push(ztEsc(course.fach));
        if (typLabel) parts.push(typLabel);
        if (halbjahrLabel) parts.push(halbjahrLabel);
        return parts.join(' · ') || 'Kurs';
    })();

    // Offene Schüler zuerst, erledigte ans Ende
    const sorted = [...students].sort((a, b) => (a.done === b.done) ? 0 : (a.done ? 1 : -1));

    const rows = sorted.map(s => `
        <li class="zt-plan-student ${s.done ? 'done' : ''}">
            <div class="zt-plan-check ${s.done ? 'checked' : ''}" onclick="ztPlanungToggleStudent('${course.id}','${s.id}')" title="Erledigt abhaken"><i class="fas fa-check"></i></div>
            <span class="zt-plan-student-name">${ztEsc(s.name)}</span>
            <button class="btn btn-sm btn-primary btn-circle-sm" onclick="ztPlanungWriteText('${course.id}','${s.id}')" title="Text schreiben"><i class="fas fa-wand-magic-sparkles"></i></button>
            ${isLinked ? '' : `<button class="zt-plan-del" onclick="ztPlanungDeleteStudent('${course.id}','${s.id}')" title="Schüler löschen"><i class="fas fa-trash"></i></button>`}
        </li>`).join('');

    const linkedBadge = course.source === 'stundenplan'
        ? `<span class="zt-plan-linked-badge" title="Automatisch aus dem Stundenplan"><i class="fas fa-clock"></i> Stundenplan</span>`
        : course.source === 'klassenlehrer'
            ? `<span class="zt-plan-linked-badge" title="Automatisch aus der Klassenlehrer-Klasse"><i class="fas fa-chalkboard-user"></i> Klassenlehrer</span>`
            : '';
    const fachlehrer = (course.fachlehrer || '').trim();
    const responsibleName = ztPlanungResponsibleName(course);
    const responsible = course.textResponsible || (course.delegatedToTeacher ? 'teacher' : '');
    const delegatedClass = (responsible === 'teacher' || responsible === 'other') ? ' delegated' : '';
    const teacherLabel = responsible === 'me'
        ? 'Zuständig'
        : (responsible === 'teacher' || responsible === 'other')
            ? `Nicht zuständig: ${ztEsc(responsibleName)}`
            : ztEsc(responsibleName);
    const fachlehrerHtml = (responsibleName || responsible === 'me')
        ? `<button type="button" class="zt-plan-course-teacher${delegatedClass}" onclick="ztPlanungChooseResponsible('${course.id}')" title="Zuständigkeit wählen">${teacherLabel}</button>`
        : '';
    const titleOnclick = `onclick="ztPlanungOpenForm('${course.id}')" title="Kurs bearbeiten"`;
    const actions = isLinked ? '' : `
                <div class="zt-plan-course-actions">
                    <button class="btn btn-sm btn-primary btn-circle-sm" title="Bearbeiten" onclick="ztPlanungOpenForm('${course.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger btn-circle-sm" title="Kurs löschen" onclick="ztPlanungDeleteCourse('${course.id}')"><i class="fas fa-trash"></i></button>
                </div>`;

    return `
        <div class="zt-plan-course ${isLinked ? 'linked' : ''}" data-course-id="${spJsAttr(course.id)}">
            <div class="zt-plan-course-head">
                <div class="zt-plan-course-title" ${titleOnclick}>
                    <span class="zt-plan-course-name">${title} ${linkedBadge}</span>
                    <span class="zt-plan-course-progress">${done}/${total} erledigt</span>
                </div>
                ${fachlehrerHtml}
                ${actions}
            </div>
            <ul class="zt-plan-students">${rows || '<li class="zt-plan-empty-students">Keine Schüler im Kurs</li>'}</ul>
        </div>`;
}

function ztPlanungToggleStudent(courseId, studentId) {
    const c = ZtPlanungState.courses.find(x => x.id === courseId);
    if (!c) return;
    const s = (c.students || []).find(x => x.id === studentId);
    if (!s) return;
    s.done = !s.done;
    ztPlanungPersist();
    ztPlanungRenderList();
}

function ztPlanungChooseResponsible(courseId) {
    const c = ZtPlanungState.courses.find(x => x.id === courseId);
    if (!c) return;
    const fachlehrer = (c.fachlehrer || '').trim();
    const isClassTeacherCourse = c.source === 'klassenlehrer';
    const buttons = {};
    if (!isClassTeacherCourse) {
        buttons.me = { text: 'Ich', value: 'me' };
    }
    if (!isClassTeacherCourse && fachlehrer) {
        buttons.teacher = { text: fachlehrer, value: 'teacher' };
    }
    buttons.other = { text: 'andere Person', title: 'Andere Person eintragen', value: 'other', className: 'zt-responsible-other-btn text-btn' };
    buttons.reset = { html: '<i class="fas fa-rotate-left"></i>', text: 'Zurücksetzen', title: 'Zurücksetzen', value: 'reset', className: 'zt-responsible-reset-btn' };
    swal({
        title: 'Wer ist zuständig?',
        text: isClassTeacherCourse
            ? 'Du bist standardmäßig zuständig. Optional kannst du eine andere Person eintragen.'
            : fachlehrer
            ? `Soll ${fachlehrer} die Zuständigkeit übernehmen oder bleibst du zuständig?`
            : 'Möchtest du zuständig bleiben oder eine andere Person eintragen?',
        icon: 'question',
        dialogClass: 'zt-responsible-dialog',
        buttons
    }).then(async choice => {
        if (choice === 'teacher') {
            (c.students || []).forEach(s => { s.done = true; });
            c.delegatedToTeacher = true;
            c.textResponsible = 'teacher';
            c.customResponsibleName = '';
            ztPlanungPersist();
            ztPlanungRenderList();
        } else if (choice === 'me') {
            c.delegatedToTeacher = false;
            c.textResponsible = 'me';
            ztPlanungPersist();
            ztPlanungRenderList();
        } else if (choice === 'other') {
            if (await ztPlanungPromptOtherResponsible(c)) {
                ztPlanungPersist();
                ztPlanungRenderList();
            }
        } else if (choice === 'reset') {
            (c.students || []).forEach(s => { s.done = false; });
            c.delegatedToTeacher = false;
            c.textResponsible = '';
            c.customResponsibleName = '';
            ztPlanungPersist();
            ztPlanungRenderList();
        }
    });
}

async function ztPlanungSetResponsible(courseId, responsible) {
    const c = ZtPlanungState.courses.find(x => x.id === courseId);
    if (!c) return;
    const tileScrollEl = document.querySelector('#dashboard-zt-list .dashboard-zt-scroll');
    const tileScrollTop = tileScrollEl ? tileScrollEl.scrollTop : 0;
    if (typeof captureDashboardScrollRestore === 'function') captureDashboardScrollRestore(tileScrollTop);

    if (responsible === 'teacher') {
        (c.students || []).forEach(s => { s.done = true; });
        c.delegatedToTeacher = true;
        c.textResponsible = 'teacher';
        c.customResponsibleName = '';
    } else if (responsible === 'me') {
        c.delegatedToTeacher = false;
        c.textResponsible = 'me';
    } else if (responsible === 'other') {
        if (!(await ztPlanungPromptOtherResponsible(c))) return;
    } else if (responsible === 'reset') {
        (c.students || []).forEach(s => { s.done = false; });
        c.delegatedToTeacher = false;
        c.textResponsible = '';
        c.customResponsibleName = '';
    } else {
        return;
    }

    ztPlanungPersist();
    const modal = document.getElementById('zt-planung-modal');
    if (modal && modal.style.display !== 'none') ztPlanungRenderList();
    if (typeof scheduleDashboardScrollRestore === 'function') scheduleDashboardScrollRestore();
}

function renderDashboardZtPlanungTile() {
    const list = document.getElementById('dashboard-zt-list');
    const count = document.getElementById('dashboard-zt-count');
    if (!list) return;

    ztPlanungInit();
    ztPlanungSyncClassTeacherCourse();
    const courses = ztPlanungDashboardCourses();
    const openResponsible = courses.filter(course => {
        const responsible = course.textResponsible || (course.delegatedToTeacher ? 'teacher' : '');
        return responsible !== 'me' && responsible !== 'teacher' && responsible !== 'other';
    }).length;
    if (count) count.textContent = String(openResponsible);

    if (!courses.length) {
        list.innerHTML = '<div class="sp-tile-empty">Keine Zeugnistexte geplant.</div>';
        return;
    }

    const rows = courses.map(course => {
        const responsible = course.textResponsible || (course.delegatedToTeacher ? 'teacher' : '');
        const fachlehrer = (course.fachlehrer || '').trim();
        const responsibleName = ztPlanungResponsibleName(course);
        const teacherLabel = responsibleName || fachlehrer || 'Fachlehrer';
        const teacherDisabled = (fachlehrer || responsible === 'other') ? '' : ' disabled';
        const courseName = course.name || course.fach || 'Kurs';
        return `
            <div class="dashboard-zt-row">
                <button type="button" class="dashboard-zt-course" onclick="ztPlanungOpenInline('${spJsAttr(course.id)}')" title="In Zeugnistexte anzeigen">${ztEsc(courseName)}</button>
                <button type="button" class="dashboard-zt-choice ${responsible === 'me' ? 'active' : ''}" onclick="ztPlanungSetResponsible('${spJsAttr(course.id)}','me')" title="Ich bin zuständig">Ich</button>
                <button type="button" class="dashboard-zt-choice teacher ${responsible === 'teacher' || responsible === 'other' ? 'active' : ''}" onclick="ztPlanungSetResponsible('${spJsAttr(course.id)}','teacher')" title="${ztEsc(teacherLabel)} ist zuständig"${teacherDisabled}>${ztEsc(teacherLabel)}</button>
                <button type="button" class="dashboard-zt-other" onclick="ztPlanungSetResponsible('${spJsAttr(course.id)}','other')" title="Andere Person eintragen"><i class="fas fa-plus"></i></button>
                <button type="button" class="dashboard-zt-reset" onclick="ztPlanungSetResponsible('${spJsAttr(course.id)}','reset')" title="Zurücksetzen"><i class="fas fa-rotate-left"></i></button>
            </div>`;
    }).join('');

    list.innerHTML = `<div class="dashboard-zt-scroll">${rows}</div>`;
    if (typeof scheduleDashboardScrollRestore === 'function') scheduleDashboardScrollRestore();
}

function ztPlanungDeleteStudent(courseId, studentId) {
    const c = ZtPlanungState.courses.find(x => x.id === courseId);
    if (!c) return;
    const s = (c.students || []).find(x => x.id === studentId);
    if (!s) return;
    hideModal();
    swal({
        title: 'Schüler löschen?',
        text: `„${s.name}" wird aus dem Kurs entfernt.`,
        icon: 'warning',
        buttons: [false, 'Löschen'],
        dangerMode: true
    }).then(ok => {
        if (ok) {
            c.students = (c.students || []).filter(x => x.id !== studentId);
            ztPlanungPersist();
        }
        ztPlanungOpen();
    });
}

function ztPlanungDeleteCourse(courseId) {
    const c = ZtPlanungState.courses.find(x => x.id === courseId);
    if (!c) return;
    const label = c.name || (c.typ === 'sozialverhalten' ? 'Arbeits-/Sozialverhalten' : (c.fach || 'Kurs'));
    hideModal();
    swal({
        title: 'Kurs löschen?',
        text: `„${label}" mit ${(c.students || []).length} Schüler(n) wird aus der Planung entfernt.`,
        icon: 'warning',
        buttons: [false, 'Löschen'],
        dangerMode: true
    }).then(ok => {
        if (ok) {
            ZtPlanungState.courses = ZtPlanungState.courses.filter(x => x.id !== courseId);
            ztPlanungPersist();
        }
        ztPlanungOpen();
    });
}

function ztPlanungClearAll() {
    if (!ZtPlanungState.courses.length) return;
    hideModal();
    swal({
        title: 'Gesamte Liste löschen?',
        text: 'Alle Kurse und Schüler in der Planung werden entfernt.',
        icon: 'warning',
        buttons: [false, 'Alles löschen'],
        dangerMode: true
    }).then(ok => {
        if (ok) {
            ZtPlanungState.courses = [];
            ztPlanungPersist();
        }
        ztPlanungOpen();
    });
}

// ----- Formular (Anlegen / Bearbeiten) -----
function ztPlanungOpenForm(courseId) {
    ztPlanungInit();
    // Scroll-Position der Liste merken, bevor showModal sie auf display:none setzt
    const listModal = document.getElementById('zt-planung-modal');
    ZtPlanungState.listScrollTop = listModal ? listModal.scrollTop : 0;
    if (courseId) {
        const c = ZtPlanungState.courses.find(x => x.id === courseId);
        if (!c) return;
        ZtPlanungState.formCourseId = courseId;
        ZtPlanungState.formDraft = {
            name: c.name || '',
            halbjahr: c.halbjahr || 'ersten',
            typ: c.typ || 'nebenfach',
            fach: c.fach || '',
            themen: c.themen || '',
            students: (c.students || []).map(s => ({ id: s.id, name: s.name, done: !!s.done }))
        };
    } else {
        ZtPlanungState.formCourseId = null;
        ZtPlanungState.formDraft = { name: '', halbjahr: 'ersten', typ: 'nebenfach', fach: '', themen: '', students: [] };
    }
    ztPlanungRenderForm();
    showModal('zt-planung-form-modal');
}

function ztPlanungFormStudentsHtml(isLinked) {
    const students = (ZtPlanungState.formDraft && ZtPlanungState.formDraft.students) || [];
    if (!students.length) return '';
    return students.map(s => `
        <li class="zt-plan-form-student">
            <span class="zt-plan-student-name">${ztEsc(s.name)}</span>
            ${!isLinked ? `<button class="zt-plan-del" onclick="ztPlanungFormRemoveStudent('${s.id}')" title="Entfernen"><i class="fas fa-times"></i></button>` : ''}
        </li>`).join('');
}

function ztPlanungRenderForm() {
    const modal = document.getElementById('zt-planung-form-modal');
    if (!modal) return;
    const d = ZtPlanungState.formDraft || { halbjahr: 'ersten', typ: 'nebenfach', fach: '', themen: '', students: [] };
    const isEdit = !!ZtPlanungState.formCourseId;
    const isSozial = d.typ === 'sozialverhalten';
    const editCourse = isEdit ? ZtPlanungState.courses.find(x => x.id === ZtPlanungState.formCourseId) : null;
    const isLinked = !!(editCourse && (editCourse.source === 'stundenplan' || editCourse.source === 'klassenlehrer'));

    const linkedNote = '';
    const ro = isLinked ? 'readonly' : '';
    const artTyp = d.typ === 'hauptfach' ? 'Hauptfach' : d.typ === 'sozialverhalten' ? 'Arbeits-/Sozialverhalten' : 'Nebenfach';

    modal.innerHTML = `
        <div class="zt-modal-head">
            <span style="font-size:1.25rem;font-weight:700;">${isEdit ? 'Klasse: ' + ztEsc((d.name || '').replace(' · ', ' ')) : 'Klasse anlegen'}</span>
            <button class="zt-modal-close" onclick="ztPlanungCancelForm()" title="Zurück"><i class="fas fa-times"></i></button>
        </div>
        <div class="zt-plan-form">
            ${linkedNote}
            ${!isLinked ? `<div class="form-group">
                <label for="zt-plan-form-name">Kursname</label>
                <input type="text" id="zt-plan-form-name" class="form-control" placeholder="z. B. 5a Mathe, Fördergruppe 2 ..." value="${ztEsc(d.name || '')}">
            </div>` : `<input type="hidden" id="zt-plan-form-name" value="${ztEsc(d.name || '')}">`}
            <div class="zt-plan-form-grid">
                <div class="form-group">
                    <label for="zt-plan-form-halbjahr">Halbjahr</label>
                    <select id="zt-plan-form-halbjahr" class="form-control">
                        <option value="ersten" ${d.halbjahr === 'ersten' ? 'selected' : ''}>1. Halbjahr</option>
                        <option value="zweiten" ${d.halbjahr === 'zweiten' ? 'selected' : ''}>2. Halbjahr</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Art</label>
                    ${isLinked
                        ? `<input class="form-control" value="${ztEsc(artTyp)}" readonly>`
                        : `<select id="zt-plan-form-typ" class="form-control" onchange="ztPlanungFormToggleTyp(this.value)">
                            <option value="nebenfach" ${d.typ === 'nebenfach' ? 'selected' : ''}>Nebenfach</option>
                            <option value="hauptfach" ${d.typ === 'hauptfach' ? 'selected' : ''}>Hauptfach</option>
                            <option value="sozialverhalten" ${d.typ === 'sozialverhalten' ? 'selected' : ''}>Arbeits- / Sozialverhalten</option>
                           </select>`}
                </div>
            </div>
            <div class="form-group zt-plan-form-fach" style="${isSozial ? 'display:none;' : ''}">
                <label for="zt-plan-form-fach">Fach</label>
                <input type="text" id="zt-plan-form-fach" class="form-control" value="${ztEsc(d.fach)}" ${ro}>
            </div>
            <div class="form-group zt-plan-form-themen" style="${isSozial ? 'display:none;' : ''}">
                <label for="zt-plan-form-themen">Behandelte Themen</label>
                <textarea id="zt-plan-form-themen" class="form-control" rows="3">${ztEsc(d.themen)}</textarea>
            </div>

            <div class="form-group">
                <label>Schüler im Kurs</label>
                ${!isLinked ? `<div style="margin-bottom:12px;">
                    <input type="text" id="zt-plan-form-student-input" class="form-control" placeholder="Name eingeben, Enter zum Hinzufügen..." onkeydown="if(event.key==='Enter'){event.preventDefault();ztPlanungFormAddStudent();}">
                </div>` : ''}
                <ul id="zt-plan-form-students" class="zt-plan-form-students-list">${ztPlanungFormStudentsHtml(isLinked)}</ul>
            </div>

            <div class="zt-plan-form-actions">
                <button class="btn btn-primary btn-icon zt-plan-form-submit" onclick="ztPlanungSaveCourse()"><i class="fas fa-check"></i> ${isEdit ? 'Speichern' : 'Erstellen'}</button>
            </div>
        </div>`;
}

// Liest die Info-Felder aus dem DOM in den Entwurf (damit sie beim Neu-Rendern der Schülerliste nicht verloren gehen)
function ztPlanungFormSyncInfo() {
    const d = ZtPlanungState.formDraft;
    if (!d) return;
    const nameEl = document.getElementById('zt-plan-form-name');
    const hj = document.getElementById('zt-plan-form-halbjahr');
    const typ = document.getElementById('zt-plan-form-typ');
    const fach = document.getElementById('zt-plan-form-fach');
    const themen = document.getElementById('zt-plan-form-themen');
    if (nameEl) d.name = nameEl.value;
    if (hj) d.halbjahr = hj.value;
    if (typ) d.typ = typ.value;
    if (fach) d.fach = fach.value;
    if (themen) d.themen = themen.value;
}

function ztPlanungFormToggleTyp(typ) {
    if (ZtPlanungState.formDraft) ZtPlanungState.formDraft.typ = typ;
    const isSozial = typ === 'sozialverhalten';
    document.querySelectorAll('#zt-planung-form-modal .zt-plan-form-fach, #zt-planung-form-modal .zt-plan-form-themen').forEach(el => {
        el.style.display = isSozial ? 'none' : '';
    });
}

function ztPlanungFormAddStudent() {
    const input = document.getElementById('zt-plan-form-student-input');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    ztPlanungFormSyncInfo();
    if (!ZtPlanungState.formDraft) ZtPlanungState.formDraft = { halbjahr: 'ersten', typ: 'nebenfach', fach: '', themen: '', students: [] };
    ZtPlanungState.formDraft.students.push({
        id: 'stud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: name,
        done: false
    });
    input.value = '';
    const ul = document.getElementById('zt-plan-form-students');
    if (ul) ul.innerHTML = ztPlanungFormStudentsHtml();
    input.focus();
}

function ztPlanungFormRemoveStudent(studentId) {
    if (!ZtPlanungState.formDraft) return;
    ZtPlanungState.formDraft.students = ZtPlanungState.formDraft.students.filter(s => s.id !== studentId);
    const ul = document.getElementById('zt-plan-form-students');
    if (ul) ul.innerHTML = ztPlanungFormStudentsHtml();
}

function ztPlanungSaveCourse() {
    ztPlanungFormSyncInfo();
    const d = ZtPlanungState.formDraft;
    if (!d) return;
    const isSozial = d.typ === 'sozialverhalten';

    if (!isSozial && !(d.fach || '').trim()) {
        swal('Hinweis', 'Bitte ein Fach angeben.', 'info');
        return;
    }
    if (!d.students.length) {
        swal('Hinweis', 'Bitte mindestens einen Schüler hinzufügen.', 'info');
        return;
    }

    if (ZtPlanungState.formCourseId) {
        const c = ZtPlanungState.courses.find(x => x.id === ZtPlanungState.formCourseId);
        if (c) {
            const linked = c.source === 'stundenplan';
            if (!linked) {
                c.name = (d.name || '').trim();
                c.typ = d.typ;
                c.fach = isSozial ? '' : (d.fach || '').trim();
                c.students = d.students.map(s => ({ id: s.id, name: (s.name || '').trim(), done: !!s.done }));
            }
            c.halbjahr = d.halbjahr;
            c.themen = isSozial ? '' : (d.themen || '').trim();
        }
    } else {
        ZtPlanungState.courses.push({
            id: 'course_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            name: (d.name || '').trim(),
            halbjahr: d.halbjahr,
            typ: d.typ,
            fach: isSozial ? '' : (d.fach || '').trim(),
            themen: isSozial ? '' : (d.themen || '').trim(),
            students: d.students.map(s => ({ id: s.id, name: (s.name || '').trim(), done: false }))
        });
    }

    ZtPlanungState.formCourseId = null;
    ZtPlanungState.formDraft = null;
    ztPlanungPersist();
    ztPlanungOpen(); // zurück zur Liste
    ztPlanungRestoreListScroll();
}

// Liste wieder an die vor dem Öffnen des Formulars gemerkte Stelle scrollen
// (showModal hat sie ausgeblendet und ztPlanungRenderList neu aufgebaut -> Scroll
// war 0). Synchron + im nächsten Frame, falls der Browser den Scroll verzögert.
function ztPlanungRestoreListScroll() {
    const y = ZtPlanungState.listScrollTop || 0;
    const restore = () => { const m = document.getElementById('zt-planung-modal'); if (m) m.scrollTop = y; };
    restore();
    requestAnimationFrame(restore);
}

function ztPlanungCancelForm() {
    ZtPlanungState.formCourseId = null;
    ZtPlanungState.formDraft = null;
    hideModal();
}

// ----- Sprung in die Texterstellung -----
function ztPlanungWriteText(courseId, studentId) {
    const c = ZtPlanungState.courses.find(x => x.id === courseId);
    if (!c) return;
    const s = (c.students || []).find(x => x.id === studentId);
    if (!s) return;

    hideModal();
    if (typeof ztCloseResult === 'function') ztCloseResult();

    const isSozial = c.typ === 'sozialverhalten';
    setZtTyp(c.typ || 'nebenfach');

    const hj = document.getElementById('zt-halbjahr');
    const fach = document.getElementById('zt-fach');
    const themen = document.getElementById('zt-themen');
    const name = document.getElementById('zt-name');
    const beob = document.getElementById('zt-beobachtungen');
    if (hj) hj.value = c.halbjahr || 'ersten';
    if (fach) fach.value = isSozial ? '' : (c.fach || '');
    if (themen) themen.value = isSozial ? '' : (c.themen || '');
    if (name) name.value = s.name || '';
    if (beob) { beob.value = ''; beob.focus(); }

    // Für Auto-Erledigt nach erfolgreicher Generierung merken
    ZtState.planungRef = { courseId: courseId, studentId: studentId };
    ZtState.editingEntryId = null;
    ztSaveInputDraft();
    ztOpenTextModal();
    if (beob) requestAnimationFrame(() => beob.focus());
}

function ztPlanungMarkRefDone() {
    const ref = ZtState.planungRef;
    if (!ref) return;
    const c = ZtPlanungState.courses.find(x => x.id === ref.courseId);
    if (c) {
        const s = (c.students || []).find(x => x.id === ref.studentId);
        if (s && !s.done) {
            s.done = true;
            ztPlanungPersist();
        }
    }
    ZtState.planungRef = null;
}

window.ztPlanungOpen = ztPlanungOpen;
window.ztPlanungOpenAtTop = ztPlanungOpenAtTop;
window.ztPlanungOpenInline = ztPlanungOpenInline;
window.ztPlanungRenderInline = ztPlanungRenderInline;
window.ztPlanungPrintResponsibleList = ztPlanungPrintResponsibleList;
window.ztPlanungOpenForm = ztPlanungOpenForm;
window.ztPlanungCancelForm = ztPlanungCancelForm;
window.ztPlanungSaveCourse = ztPlanungSaveCourse;
window.ztPlanungFormAddStudent = ztPlanungFormAddStudent;
window.ztPlanungFormRemoveStudent = ztPlanungFormRemoveStudent;
window.ztPlanungFormToggleTyp = ztPlanungFormToggleTyp;
window.ztPlanungToggleStudent = ztPlanungToggleStudent;
window.ztPlanungChooseResponsible = ztPlanungChooseResponsible;
window.ztPlanungSetResponsible = ztPlanungSetResponsible;
window.ztPlanungDeleteStudent = ztPlanungDeleteStudent;
window.ztPlanungDeleteCourse = ztPlanungDeleteCourse;
window.ztPlanungClearAll = ztPlanungClearAll;
window.ztPlanungWriteText = ztPlanungWriteText;
window.renderDashboardZtPlanungTile = renderDashboardZtPlanungTile;

// ===== DASHBOARD NOTES & CHECKLIST LOGIC =====
function renderDashboardNotes() {
    const list = safeGetElement('dashboard-notes-list');
    if (!list) return;
    list.innerHTML = '';
    
    const notes = AppState.dashboardNotes || [];
    if (notes.length === 0) {
        list.innerHTML = `
            <li class="empty-state dashboard-notes-empty">
                <i class="fas fa-clipboard-list"></i>
                <p>Keine Aufgaben vorhanden</p>
            </li>
        `;
        return;
    }
    
    // Sortiere: Unerledigte Aufgaben zuerst, erledigte ans Ende
    const sortedNotes = [...notes].sort((a, b) => {
        if (a.checked === b.checked) return 0;
        return a.checked ? 1 : -1;
    });
    
    sortedNotes.forEach((note) => {
        const item = document.createElement('li');
        item.className = 'dashboard-note-item';
        
        const checkboxClass = note.checked ? 'dashboard-note-checkbox checked' : 'dashboard-note-checkbox';
        const textClass = note.checked ? 'dashboard-note-text completed' : 'dashboard-note-text';
        
        item.innerHTML = `
            <div class="${checkboxClass}" onclick="toggleDashboardNote(${note.id})" title="Abhaken">
                <i class="fas fa-check"></i>
            </div>
            <span class="${textClass}">${escapeHtml(note.text)}</span>
            <button class="dashboard-note-edit" onclick="editDashboardNote(${note.id})" title="Bearbeiten">
                <i class="fas fa-edit"></i>
            </button>
            <button class="dashboard-note-delete" onclick="deleteDashboardNote(${note.id})" title="Löschen">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        list.appendChild(item);
    });
}

function openDashboardNoteInput() {
    if (_appDialogState) _closeAppDialog(null);
    const overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    setAppThemeColor(APP_THEME_MODAL);

    const dialog = document.createElement('div');
    dialog.className = 'app-dialog dashboard-note-dialog';
    dialog.innerHTML = `
        <button type="button" class="app-dialog-close" aria-label="Schließen">&times;</button>
        <h2 class="app-dialog-title">Neue Notiz</h2>
        <p class="app-dialog-text">Trage eine Aufgabe oder Erinnerung ein.</p>
        <input type="text" id="dashboard-note-dialog-input" class="form-control" placeholder="Notiz eingeben">
        <div class="app-dialog-buttons">
            <button type="button" class="btn btn-primary">Speichern</button>
        </div>`;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const input = dialog.querySelector('#dashboard-note-dialog-input');
    const close = (save) => {
        if (save) addDashboardNote(input ? input.value : '');
        overlay.classList.add('app-dialog-closing');
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            restoreAppThemeColor();
        }, 120);
    };
    dialog.querySelector('.app-dialog-close').onclick = () => close(false);
    dialog.querySelector('.btn-primary').onclick = () => close(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); close(true); }
            if (e.key === 'Escape') { e.preventDefault(); close(false); }
        });
        setTimeout(() => input.focus(), 30);
    }
}

function addDashboardNote(noteText = '') {
    const input = safeGetElement('dashboard-note-input');
    const text = String(noteText || (input ? input.value : '')).trim();
    if (!text) return;
    
    const notes = AppState.dashboardNotes || [];
    const newNote = {
        id: Date.now(),
        text: text,
        checked: false
    };
    
    notes.push(newNote);
    AppState.dashboardNotes = notes;
    localStorage.setItem('dashboardNotes', JSON.stringify(notes));
    
    if (input) input.value = '';
    renderDashboardNotes();
    saveData(); // Löst Cloud-Sync aus
}

function toggleDashboardNote(id) {
    const notes = AppState.dashboardNotes || [];
    const note = notes.find(n => n.id === id);
    if (note) {
        note.checked = !note.checked;
        AppState.dashboardNotes = notes;
        localStorage.setItem('dashboardNotes', JSON.stringify(notes));
        renderDashboardNotes();
        saveData(); // Löst Cloud-Sync aus
    }
}

function updateDashboardNoteText(id, newText) {
    const notes = AppState.dashboardNotes || [];
    const note = notes.find(n => n.id === id);
    if (note) {
        const textVal = (newText || '').trim();
        if (textVal) {
            // Nur aktualisieren, wenn sich der Text tatsächlich geändert hat
            if (note.text !== textVal) {
                note.text = textVal;
                AppState.dashboardNotes = notes;
                localStorage.setItem('dashboardNotes', JSON.stringify(notes));
                saveData(); // Löst Cloud-Sync aus
            }
        } else {
            // Wenn der Text leer ist, löschen wir die Notiz automatisch
            deleteDashboardNote(id);
        }
    }
}

function editDashboardNote(id) {
    const notes = AppState.dashboardNotes || [];
    const note = notes.find(n => n.id === id);
    if (!note) return;
    if (_appDialogState) _closeAppDialog(null);

    const overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    setAppThemeColor(APP_THEME_MODAL);

    const dialog = document.createElement('div');
    dialog.className = 'app-dialog dashboard-note-dialog';
    dialog.innerHTML = `
        <button type="button" class="app-dialog-close" aria-label="Schließen">&times;</button>
        <h2 class="app-dialog-title">Notiz bearbeiten</h2>
        <p class="app-dialog-text">Passe die Aufgabe oder Erinnerung an.</p>
        <input type="text" id="dashboard-note-dialog-input" class="form-control" placeholder="Notiz eingeben">
        <div class="app-dialog-buttons">
            <button type="button" class="btn btn-primary">Speichern</button>
        </div>`;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const input = dialog.querySelector('#dashboard-note-dialog-input');
    if (input) input.value = note.text;
    const close = (save) => {
        const val = input ? input.value.trim() : '';
        overlay.classList.add('app-dialog-closing');
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            restoreAppThemeColor();
            if (save && val) {
                updateDashboardNoteText(id, val);
                renderDashboardNotes();
            }
        }, 120);
    };
    dialog.querySelector('.app-dialog-close').onclick = () => close(false);
    dialog.querySelector('.btn-primary').onclick = () => close(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); close(true); }
            if (e.key === 'Escape') { e.preventDefault(); close(false); }
        });
        setTimeout(() => { input.focus(); input.select(); }, 30);
    }
}

function deleteDashboardNote(id) {
    const notes = AppState.dashboardNotes || [];
    const note = notes.find(n => n.id === id);
    if (!note) return;
    
    swal({
        title: "Aufgabe löschen?",
        text: `Möchtest du die Aufgabe "${note.text}" wirklich löschen?`,
        icon: "warning",
        buttons: [false, "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            let updatedNotes = AppState.dashboardNotes || [];
            updatedNotes = updatedNotes.filter(n => n.id !== id);
            AppState.dashboardNotes = updatedNotes;
            if (updatedNotes.length === 0) window._allowEmptyDashboardNotesSync = true;
            localStorage.setItem('dashboardNotes', JSON.stringify(updatedNotes));
            renderDashboardNotes();
            saveData(); // Löst Cloud-Sync aus
        }
    });
}

function renderDashboardCalendar() {
    const badge = safeGetElement('dashboard-calendar-today-badge');
    const textToday = safeGetElement('dashboard-calendar-today-text');
    const list = safeGetElement('dashboard-calendar-list');
    if (!list) return;
    
    // Aktuelles Datum in lokaler Zeitzone bestimmen
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    // Heutiges Datum formatieren
    const todayGermanShort = `${day}.${month}.${year}`;
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const todayFull = now.toLocaleDateString('de-DE', options);
    
    if (badge) badge.textContent = todayGermanShort;
    
    list.innerHTML = '';
    
    // Termine filtern und sortieren (nur ab heute)
    const termine = AppState.termine || [];
    const upcoming = termine.filter(t => t.date && t.date >= todayStr);
    
    if (upcoming.length === 0) {
        list.innerHTML = `
            <li class="empty-state" style="padding: 20px 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <i class="fas fa-calendar-xmark" style="font-size: 2rem; color: var(--grey-color); margin-bottom: 8px;"></i>
                <p style="font-size: 0.9rem; color: var(--grey-color); margin: 0;">Keine anstehenden Termine</p>
            </li>
        `;
        return;
    }
    
    // Chronologisch sortieren
    const sorted = [...upcoming].sort((a, b) => {
        if (a.date !== b.date) {
            return a.date.localeCompare(b.date);
        }
        const timeA = a.timeStart || '';
        const timeB = b.timeStart || '';
        return timeA.localeCompare(timeB);
    });
    
    // Auf die nächsten 5 Termine begrenzen
    const nextTermine = sorted.slice(0, 5);
    
    nextTermine.forEach(termin => {
        const item = document.createElement('li');
        item.className = 'dashboard-calendar-item';
        
        // Datum ins deutsche Format bringen
        const dateParts = termin.date.split('-');
        const germanDate = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : termin.date;
        
        item.innerHTML = `
            <span class="calendar-item-title" title="${escapeHtml(termin.title)}">${escapeHtml(termin.title)}</span>
            <span class="calendar-item-date">${germanDate}</span>
        `;
        list.appendChild(item);
    });
}

// Global verfügbar machen
window.renderDashboardNotes = renderDashboardNotes;
window.openDashboardNoteInput = openDashboardNoteInput;
window.addDashboardNote = addDashboardNote;
window.toggleDashboardNote = toggleDashboardNote;
window.updateDashboardNoteText = updateDashboardNoteText;
window.editDashboardNote = editDashboardNote;
window.deleteDashboardNote = deleteDashboardNote;
window.renderDashboardCalendar = renderDashboardCalendar;

// =====================================================================
// ============================ STUNDENPLAN ============================
// =====================================================================

const STUNDENPLAN_DAYS = [
    { key: 'Mo', label: 'Montag' },
    { key: 'Di', label: 'Dienstag' },
    { key: 'Mi', label: 'Mittwoch' },
    { key: 'Do', label: 'Donnerstag' },
    { key: 'Fr', label: 'Freitag' }
];
const STUNDENPLAN_COLORS = ['#fca5a5', '#fdba74', '#fcd34d', '#86efac', '#7dd3fc', '#a5b4fc', '#f0abfc', '#cbd5e1'];

const StundenplanState = {
    initialized: false,
    zeiten: [],
    kurse: [],
    kacheln: {},
    inklusionProKlasse: {},
    halbjahr: 'ersten',       // globales Halbjahr für alle Stunden
    cellDraft: null
};

function stundenplanGenId() {
    return 'sp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Sicher als Argument in onclick="...('HIER')..." (JS-String in HTML-Attribut)
function spJsAttr(s) {
    return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
}

function stundenplanInit() {
    if (StundenplanState.initialized) return;
    try {
        const parsed = JSON.parse(localStorage.getItem('stundenplan') || '{}');
        StundenplanState.zeiten = Array.isArray(parsed.zeiten) ? parsed.zeiten : [];
        StundenplanState.kurse = Array.isArray(parsed.kurse) ? parsed.kurse : [];
        StundenplanState.kacheln = (parsed.kacheln && typeof parsed.kacheln === 'object') ? parsed.kacheln : {};
        StundenplanState.inklusionProKlasse = (parsed.inklusionProKlasse && typeof parsed.inklusionProKlasse === 'object') ? parsed.inklusionProKlasse : {};
        StundenplanState.halbjahr = parsed.halbjahr || 'ersten';
    } catch (e) {
        StundenplanState.zeiten = []; StundenplanState.kurse = []; StundenplanState.kacheln = {}; StundenplanState.inklusionProKlasse = {};
    }
    StundenplanState.initialized = true;
}

function stundenplanPersist() {
    try {
        localStorage.setItem('stundenplan', JSON.stringify({
            zeiten: StundenplanState.zeiten,
            kurse: StundenplanState.kurse,
            kacheln: StundenplanState.kacheln,
            inklusionProKlasse: StundenplanState.inklusionProKlasse,
            halbjahr: StundenplanState.halbjahr
        }));
        // Zeitstempel ZUERST erhöhen (vor dem evtl. werfenden syncPlanungCourses),
        // damit andere Geräte die Änderung zuverlässig als "neuer" erkennen.
        localStorage.setItem('extraDataLastUpdate', new Date().toISOString());
        // Verknüpfte Planung-Kurse aktualisieren (schreibt localStorage ztPlanung, ohne eigenen Cloud-Push)
        stundenplanSyncPlanungCourses();
    } catch (e) {
        console.warn('Fehler beim Speichern des Stundenplans:', e);
    }
    if (window.firebaseAuth && window.firebaseAuth.currentUser && typeof window.saveDataToCloud === 'function') {
        window.saveDataToCloud();
    }
    stundenplanRenderHomeTile();
}

// Brücke für Cloud-Sync (kein eigener Cloud-Push, Daten kommen ja aus der Cloud)
window.setStundenplan = function (obj) {
    StundenplanState.zeiten = (obj && Array.isArray(obj.zeiten)) ? obj.zeiten : [];
    StundenplanState.kurse = (obj && Array.isArray(obj.kurse)) ? obj.kurse : [];
    StundenplanState.kacheln = (obj && obj.kacheln && typeof obj.kacheln === 'object') ? obj.kacheln : {};
    StundenplanState.inklusionProKlasse = (obj && obj.inklusionProKlasse && typeof obj.inklusionProKlasse === 'object') ? obj.inklusionProKlasse : {};
    StundenplanState.halbjahr = (obj && obj.halbjahr) || 'ersten';
    StundenplanState.initialized = true;
    stundenplanSyncPlanungCourses();
    stundenplanRenderHomeTile();
    if (window._activeToolWindow === 'stundenplan') renderStundenplanModule();
};

function stundenplanGetAppClass(name) {
    if (!name) return null;
    const key = String(name).trim().toLowerCase();
    const list = window.classes || (window.AppState ? window.AppState.classes : []) || [];
    return list.find(c =>
        (c.name || '').trim().toLowerCase() === key ||
        (c.klasse || '').trim().toLowerCase() === key
    ) || null;
}

// Löst eine Kachel auf: gibt { fach, name, klasse, fachlehrer, art } zurück (alle Formate)
function stundenplanResolveKachel(k) {
    if (!k) return null;
    // Neues direktes Format (name/fach/klasse/art direkt in der Kachel)
    if (k.fach || k.name) return { fach: k.fach || '', name: k.name || k.klasse || '', klasse: k.klasse || '', fachlehrer: k.fachlehrer || '', art: k.art || 'neben' };
    // Altes kursId-Format (Rückwärtskompatibilität)
    if (k.kursId) {
        const kurs = StundenplanState.kurse.find(x => x.id === k.kursId);
        if (!kurs) return null;
        return { fach: kurs.fach, name: kurs.name, klasse: kurs.klasse || kurs.name, fachlehrer: k.fachlehrer || '', art: kurs.art };
    }
    // Altes direktes Format (nur klasse, kein name)
    if (k.klasse) return { fach: k.fach || '', name: k.klasse, klasse: k.klasse, fachlehrer: k.fachlehrer || '', art: k.art || 'neben' };
    return null;
}

// ---- Kurse verwalten ------------------------------------------------

function stundenplanOpenKurse() {
    stundenplanInit();
    _spNewKursArt = 'haupt';
    stundenplanRenderKurseModal();
    showModal('stundenplan-kurse-modal');
}

function stundenplanRenderKurseModal() {
    const modal = document.getElementById('stundenplan-kurse-modal');
    if (!modal) return;

    const rows = StundenplanState.kurse.map(k => {
        const artLabel = k.art === 'haupt' ? 'Hauptfach' : 'Nebenfach';
        return `
            <div class="sp-kurs-row">
                <div class="sp-kurs-info">
                    <span class="sp-kurs-name">${ztEsc(k.name)}</span>
                    ${k.klasse ? `<span class="sp-kurs-klasse-badge">${ztEsc(k.klasse)}</span>` : ''}
                    <span class="sp-kurs-fach">${ztEsc(k.fach)}</span>
                    <span class="sp-kurs-art-badge">${artLabel}</span>
                </div>
                <button class="sp-zeit-del" onclick="stundenplanKursDelete('${k.id}')" title="Kurs löschen"><i class="fas fa-trash"></i></button>
            </div>`;
    }).join('');

    modal.innerHTML = `
        <div class="zt-modal-head">
            <span style="font-size:1.25rem;font-weight:700;">Kurse verwalten</span>
            <button class="zt-modal-close" onclick="hideModal()" title="Schließen"><i class="fas fa-times"></i></button>
        </div>
        <div class="sp-kurse-list">
            ${rows || '<p class="sp-hint">Noch keine Kurse. Lege deinen ersten Kurs an.</p>'}
        </div>
        <div class="sp-kurs-add-form">
            <p style="font-weight:700;margin:14px 0 10px;color:var(--dark-color);">Neuer Kurs</p>
            <div class="sp-kurs-add-rows">
                <div class="sp-kurs-add-row">
                    <label class="sp-kurs-add-label">Anzeigename</label>
                    <input type="text" id="sp-new-kurs-name" class="form-control" placeholder="z. B. Mathe 8c" onkeydown="if(event.key==='Enter'){document.getElementById('sp-new-kurs-klasse').focus();}">
                </div>
                <div class="sp-kurs-add-row">
                    <label class="sp-kurs-add-label">Klasse</label>
                    <input type="text" id="sp-new-kurs-klasse" class="form-control" placeholder="z. B. 8c" onkeydown="if(event.key==='Enter'){document.getElementById('sp-new-kurs-fach').focus();}">
                </div>
                <div class="sp-kurs-add-row">
                    <label class="sp-kurs-add-label">Fach</label>
                    <input type="text" id="sp-new-kurs-fach" class="form-control" placeholder="z. B. Mathematik" onkeydown="if(event.key==='Enter'){stundenplanKursAdd();}">
                </div>
                <div class="sp-kurs-add-row">
                    <label class="sp-kurs-add-label">Art</label>
                    <div class="sp-art-toggle">
                        <button type="button" id="sp-new-kurs-art-haupt" class="active" onclick="stundenplanKursArtToggle('haupt')">Hauptfach</button>
                        <button type="button" id="sp-new-kurs-art-neben" onclick="stundenplanKursArtToggle('neben')">Nebenfach</button>
                    </div>
                </div>
                <div class="sp-kurs-add-row sp-kurs-add-btn-row">
                    <button class="btn btn-primary btn-icon" onclick="stundenplanKursAdd()"><i class="fas fa-plus"></i> Anlegen</button>
                </div>
            </div>
        </div>`;
    setTimeout(() => { const el = document.getElementById('sp-new-kurs-name'); if (el) el.focus(); }, 80);
}

let _spNewKursArt = 'haupt';

function stundenplanKursArtToggle(art) {
    _spNewKursArt = art;
    const h = document.getElementById('sp-new-kurs-art-haupt');
    const n = document.getElementById('sp-new-kurs-art-neben');
    if (h) h.classList.toggle('active', art === 'haupt');
    if (n) n.classList.toggle('active', art === 'neben');
}

function stundenplanKursAdd() {
    const nameEl = document.getElementById('sp-new-kurs-name');
    const klasseEl = document.getElementById('sp-new-kurs-klasse');
    const fachEl = document.getElementById('sp-new-kurs-fach');
    const name = (nameEl ? nameEl.value : '').trim();
    const klasse = (klasseEl ? klasseEl.value : '').trim();
    const fach = (fachEl ? fachEl.value : '').trim();
    if (!name || !fach) { swal('Hinweis', 'Bitte Anzeigename und Fach eingeben.', 'info'); return null; }
    const newKurs = { id: stundenplanGenId(), name, klasse, fach, art: _spNewKursArt };
    StundenplanState.kurse.push(newKurs);
    stundenplanPersist();
    stundenplanRenderKurseModal();
    _spNewKursArt = 'haupt';
    return newKurs;
}

function stundenplanKursDelete(id) {
    const inUse = Object.values(StundenplanState.kacheln).some(k => k.kursId === id);
    if (inUse) { swal('Hinweis', 'Dieser Kurs ist noch im Stundenplan eingetragen. Bitte zuerst die Kachel(n) leeren.', 'info'); return; }
    StundenplanState.kurse = StundenplanState.kurse.filter(k => k.id !== id);
    stundenplanPersist();
    stundenplanRenderKurseModal();
}

// ---- Raster-Rendering ----------------------------------------------

function renderStundenplanModule() {
    stundenplanInit();
    const card = document.getElementById('stundenplan-card');
    if (!card) return;

    const hasStunden = StundenplanState.zeiten.some(z => z.typ === 'stunde');

    const header = `
        <div class="card-header">
            <h2>Stundenplan</h2>
            <div class="card-header-actions">
                <div class="desktop-header-buttons">
                    <button class="btn btn-secondary btn-icon" onclick="stundenplanOpenZeiten()">
                        <i class="fas fa-clock"></i> <span class="btn-text">Unterrichtszeiten</span>
                    </button>
                    <button class="btn btn-secondary btn-icon" onclick="stundenplanResetConfirm('stunden')">
                        <i class="fas fa-eraser"></i> <span class="btn-text">Stunden zurücksetzen</span>
                    </button>
                    <button class="btn btn-danger btn-icon" onclick="stundenplanResetConfirm('all')">
                        <i class="fas fa-trash"></i> <span class="btn-text">Stundenplan löschen</span>
                    </button>
                </div>
            </div>
        </div>`;

    if (!StundenplanState.zeiten.length) {
        card.innerHTML = header + `
            <div class="sp-empty">
                <i class="fas fa-table-cells"></i>
                <p>Noch kein Stundenplan angelegt.</p>
                <p>Lege zuerst deine Unterrichtszeiten fest.</p>
            </div>`;
        return;
    }

    card.innerHTML = header + (hasStunden
        ? stundenplanGridHtml()
        : `<div class="sp-empty"><i class="fas fa-clock"></i><p>Es sind nur Pausen eingetragen.</p><p>Füge unter „Unterrichtszeiten" mindestens eine Stunde hinzu.</p></div>`);
}

function stundenplanGridHtml() {
    const days = STUNDENPLAN_DAYS;
    let html = `<div class="sp-grid-wrap"><div class="sp-grid" style="grid-template-columns: 96px repeat(${days.length}, minmax(120px, 1fr));">`;

    // Kopfzeile
    html += `<div class="sp-corner"></div>`;
    days.forEach(d => { html += `<div class="sp-dayhead">${d.label}</div>`; });

    // Nur Stunden (Pausen werden aus Lücken berechnet)
    const stunden = StundenplanState.zeiten.filter(z => z.typ === 'stunde');
    stunden.forEach((z, idx) => {
        // Automatische Pause: Lücke > 5 Minuten zwischen vorheriger Stunde und dieser
        if (idx > 0) {
            const prev = stunden[idx - 1];
            if (prev.bis && z.von && prev.bis < z.von) {
                const [ph, pm] = prev.bis.split(':').map(Number);
                const [ch, cm] = z.von.split(':').map(Number);
                const diffMin = (ch * 60 + cm) - (ph * 60 + pm);
                if (diffMin > 5) {
                    html += `<div class="sp-pause-row">Pause · ${prev.bis}–${z.von}</div>`;
                }
            }
        }
        const stundeNr = idx + 1;
        const range = (z.von || z.bis) ? `${z.von || '?'}–${z.bis || '?'}` : 'Zeit fehlt';
        html += `<div class="sp-timecol"><span class="sp-timecol-nr">${stundeNr}.</span><span class="sp-timecol-time">${range}</span></div>`;
        days.forEach(d => {
            const key = d.key + '|' + z.id;
            const k = StundenplanState.kacheln[key];
            const resolved = stundenplanResolveKachel(k);
            if (resolved) {
                const bg = (k && k.farbe) ? k.farbe : '#eef2ff';
                const displayName = resolved.name || resolved.fach || '';
                const kinderKey = resolved.klasse || resolved.name;
                const kinderCount = (kinderKey && StundenplanState.inklusionProKlasse[kinderKey]) ? StundenplanState.inklusionProKlasse[kinderKey].length : 0;
                const artLabel = resolved.art === 'haupt' ? 'Hauptfach' : 'Nebenfach';
                const kinderBadge = kinderCount ? `<span class="sp-cell-kinder-badge"><i class="fas fa-child"></i>${kinderCount}</span>` : '';
                html += `
                    <div class="sp-cell filled" style="background:${bg};" onclick="stundenplanOpenCell('${d.key}','${z.id}')">
                        <span class="sp-cell-klasse">${ztEsc(displayName)}</span>
                        <span class="sp-cell-art-badge">${artLabel}${kinderBadge}</span>
                    </div>`;
            } else {
                html += `<div class="sp-cell empty" onclick="stundenplanOpenCell('${d.key}','${z.id}')"><i class="fas fa-plus"></i></div>`;
            }
        });
    });

    html += `</div></div>`;
    return html;
}

// ---- Unterrichtszeiten-Editor --------------------------------------

function stundenplanOpenZeiten() {
    stundenplanInit();
    if (!StundenplanState.zeiten.length) {
        StundenplanState.zeiten.push({ id: stundenplanGenId(), typ: 'stunde', von: '', bis: '' });
        StundenplanState.zeiten.push({ id: stundenplanGenId(), typ: 'stunde', von: '', bis: '' });
        stundenplanPersist();
    }
    stundenplanRenderZeiten();
    showModal('stundenplan-zeiten-modal');
}

function stundenplanRenderZeiten() {
    const modal = document.getElementById('stundenplan-zeiten-modal');
    if (!modal) return;

    const stunden = StundenplanState.zeiten.filter(z => z.typ === 'stunde');
    const rows = stunden.map((z, idx) => `
            <div class="sp-zeit-row">
                <span class="sp-zeit-label">${idx + 1}. Stunde</span>
                <input type="time" class="form-control sp-zeit-time" value="${z.von || ''}" onchange="stundenplanUpdateZeit('${z.id}','von',this.value)">
                <span class="sp-zeit-dash">–</span>
                <input type="time" class="form-control sp-zeit-time" value="${z.bis || ''}" onchange="stundenplanUpdateZeit('${z.id}','bis',this.value)">
                <button class="btn btn-sm btn-danger btn-circle-sm" onclick="stundenplanDeleteZeit('${z.id}')" title="Entfernen"><i class="fas fa-trash"></i></button>
            </div>`).join('');

    modal.innerHTML = `
        <div class="zt-modal-head">
            <span style="font-size:1.25rem;font-weight:700;">Unterrichtszeiten</span>
            <button class="zt-modal-close" onclick="stundenplanCloseZeiten()" title="Fertig"><i class="fas fa-times"></i></button>
        </div>
        <div class="sp-zeiten-list">
            ${rows || ''}
        </div>
        <div class="sp-zeiten-foot">
            <button class="btn btn-secondary btn-icon" onclick="stundenplanAddZeit()"><i class="fas fa-plus"></i> Stunde hinzufügen</button>
            <button class="btn btn-primary btn-icon" onclick="stundenplanCloseZeiten()"><i class="fas fa-check"></i> Fertig</button>
        </div>`;
}

function stundenplanAddZeit() {
    // Vorbelegung: an die letzte Stunden-Endzeit anschließen
    const stunden = StundenplanState.zeiten.filter(z => z.typ === 'stunde');
    const last = stunden[stunden.length - 1];
    const von = last && last.bis ? last.bis : '';
    StundenplanState.zeiten.push({ id: stundenplanGenId(), typ: 'stunde', von, bis: '' });
    stundenplanPersist();
    stundenplanRenderZeiten();
}

function stundenplanUpdateZeit(id, field, value) {
    const z = StundenplanState.zeiten.find(x => x.id === id);
    if (!z) return;
    z[field] = value;
    stundenplanPersist();
}

function stundenplanDeleteZeit(id) {
    const stunden = StundenplanState.zeiten.filter(z => z.typ === 'stunde');
    const idx = stunden.findIndex(z => z.id === id);
    const label = idx >= 0 ? `${idx + 1}. Stunde` : 'diese Stunde';
    swal({
        title: `${label} löschen?`,
        text: 'Alle eingetragenen Stunden für diesen Zeitslot werden ebenfalls entfernt.',
        icon: 'warning',
        buttons: { cancel: 'Abbrechen', confirm: { text: 'Löschen', className: 'swal-button--danger' } },
        dangerMode: true
    }).then(confirmed => {
        if (!confirmed) return;
        StundenplanState.zeiten = StundenplanState.zeiten.filter(x => x.id !== id);
        Object.keys(StundenplanState.kacheln).forEach(key => {
            if (key.endsWith('|' + id)) delete StundenplanState.kacheln[key];
        });
        stundenplanPersist();
        stundenplanRenderZeiten();
    });
}

function stundenplanMoveZeit(stundeIdx, dir) {
    // idx bezieht sich auf die gefilterte Stunden-Liste; im rohen Array tauschen
    const stunden = StundenplanState.zeiten.filter(z => z.typ === 'stunde');
    const niStunde = stundeIdx + dir;
    if (niStunde < 0 || niStunde >= stunden.length) return;
    const rawA = StundenplanState.zeiten.indexOf(stunden[stundeIdx]);
    const rawB = StundenplanState.zeiten.indexOf(stunden[niStunde]);
    if (rawA < 0 || rawB < 0) return;
    const tmp = StundenplanState.zeiten[rawA];
    StundenplanState.zeiten[rawA] = StundenplanState.zeiten[rawB];
    StundenplanState.zeiten[rawB] = tmp;
    stundenplanPersist();
    stundenplanRenderZeiten();
}

function stundenplanCloseZeiten() {
    hideModal();
    renderStundenplanModule();
}

// ---- Kachel-Editor --------------------------------------------------

function stundenplanOpenCell(dayKey, zeitId) {
    stundenplanInit();
    const key = dayKey + '|' + zeitId;
    const existing = StundenplanState.kacheln[key] || {};
    // Resolve aus altem kursId-Format falls nötig
    let resolved = null;
    if (existing.kursId) {
        const kurs = StundenplanState.kurse.find(x => x.id === existing.kursId);
        if (kurs) resolved = { name: kurs.name, klasse: kurs.klasse || '', fach: kurs.fach, art: kurs.art };
    }
    const name = existing.name || (resolved && resolved.name) || '';
    const klasse = existing.klasse || (resolved && resolved.klasse) || '';
    const fach = existing.fach || (resolved && resolved.fach) || '';
    const fachlehrer = existing.fachlehrer || '';
    const art = existing.art || (resolved && resolved.art) || 'neben';
    const kinderKey = klasse || name;
    const kinder = (kinderKey && StundenplanState.inklusionProKlasse[kinderKey]) ? [...StundenplanState.inklusionProKlasse[kinderKey]] : [];
    StundenplanState.cellDraft = { dayKey, zeitId, key, name, klasse, fach, fachlehrer, art, farbe: existing.farbe || '', kinder };
    stundenplanRenderCellModal();
    showModal('stundenplan-cell-modal');
}

function stundenplanRenderCellModal() {
    const modal = document.getElementById('stundenplan-cell-modal');
    const d = StundenplanState.cellDraft;
    if (!modal || !d) return;

    const dayLabel = (STUNDENPLAN_DAYS.find(x => x.key === d.dayKey) || {}).label || d.dayKey;
    const stunden = StundenplanState.zeiten.filter(z => z.typ === 'stunde');
    const stundeIdx = stunden.findIndex(z => z.id === d.zeitId);
    const stundeLabel = stundeIdx >= 0 ? `, ${stundeIdx + 1}. Stunde` : '';

    const swatches = STUNDENPLAN_COLORS.map(c =>
        `<button type="button" class="sp-swatch ${d.farbe === c ? 'active' : ''}" style="background:${c};" onclick="stundenplanCellSetColor('${c}')"></button>`
    ).join('');

    modal.innerHTML = `
        <div class="zt-modal-head">
            <span style="font-size:1.2rem;font-weight:700;">Stunde bearbeiten: ${dayLabel}${stundeLabel}</span>
            <button class="zt-modal-close" onclick="hideModal()" title="Schließen"><i class="fas fa-times"></i></button>
        </div>
        <div class="sp-cell-form">
            <div class="sp-cell-row2">
                <div class="sp-field sp-name-field">
                    <span>Anzeigename</span>
                    <input id="sp-cell-name" class="form-control" value="${ztEsc(d.name)}" onfocus="stundenplanCellNameFocused(this.value)" oninput="stundenplanCellNameChanged(this.value)" onblur="stundenplanCellNameBlurred()">
                    <div id="sp-cell-name-suggestions" class="sp-name-suggestions"></div>
                </div>
                <div class="sp-field">
                    <span>Fachlehrer</span>
                    <input id="sp-cell-fachlehrer" class="form-control" value="${ztEsc(d.fachlehrer || '')}">
                </div>
            </div>
            <div class="sp-cell-row2">
                <div class="sp-field">
                    <span>Klasse</span>
                    <input id="sp-cell-klasse" class="form-control" value="${ztEsc(d.klasse)}">
                </div>
                <div class="sp-field">
                    <span>Fach</span>
                    <input id="sp-cell-fach" class="form-control" value="${ztEsc(d.fach)}">
                </div>
            </div>
            <div class="sp-cell-row2">
                <div class="sp-field">
                    <span>Art</span>
                    <select id="sp-cell-art" class="form-control" onchange="stundenplanCellArtToggle(this.value)">
                        <option value="haupt" ${d.art === 'haupt' ? 'selected' : ''}>Hauptfach</option>
                        <option value="neben" ${d.art !== 'haupt' ? 'selected' : ''}>Nebenfach</option>
                    </select>
                </div>
                <div class="sp-field">
                    <span>Halbjahr</span>
                    <select id="sp-cell-halbjahr" class="form-control" onchange="stundenplanCellHalbjahrChanged(this.value)">
                        <option value="ersten" ${StundenplanState.halbjahr === 'ersten' ? 'selected' : ''}>1. Halbjahr</option>
                        <option value="zweiten" ${StundenplanState.halbjahr === 'zweiten' ? 'selected' : ''}>2. Halbjahr</option>
                    </select>
                </div>
            </div>
            <div class="sp-field sp-field-inline">
                <span>Farbe:</span>
                <div class="sp-swatches">
                    <button type="button" class="sp-swatch sp-swatch-none ${!d.farbe ? 'active' : ''}" onclick="stundenplanCellSetColor('')" title="Keine Farbe"><i class="fas fa-ban"></i></button>
                    ${swatches}
                </div>
            </div>
            <div class="sp-field">
                <span>Welche Kinder benötigen ein Textzeugnis?</span>
                <div id="sp-cell-kinder">${stundenplanCellKinderHtml()}</div>
            </div>
            <div class="sp-cell-foot">
                <button class="btn btn-danger btn-icon" onclick="stundenplanClearCell()"><i class="fas fa-trash"></i> Stunde löschen</button>
                <button class="btn btn-primary btn-icon" onclick="stundenplanSaveCell()"><i class="fas fa-check"></i> Speichern</button>
            </div>
        </div>`;
}

function stundenplanCellKinderHtml() {
    const d = StundenplanState.cellDraft;
    if (!d) return '';
    const kinder = d.kinder || [];

    let html = '';
    if (kinder.length) {
        html += '<div class="sp-freekids">' + kinder.map(n =>
            `<span class="sp-freekid">${ztEsc(n)} <i class="fas fa-times" onclick="stundenplanCellRemoveKid('${spJsAttr(n)}')"></i></span>`
        ).join('') + '</div>';
    }

    html += `<div class="sp-addkid">
                <input type="text" id="sp-cell-newkid" class="form-control" placeholder="Name eingeben, Enter zum Hinzufügen..." autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();stundenplanCellAddFreeKid();}">
             </div>`;
    return html;
}

function stundenplanRefreshKinderSection() {
    const host = document.getElementById('sp-cell-kinder');
    if (host) host.innerHTML = stundenplanCellKinderHtml();
}

function stundenplanCellAppClassSelected(idxStr) {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    // Aktuelle Freitext-Eingaben vor dem Re-Render sichern
    stundenplanCellDraftFromDom();
    const idx = parseInt(idxStr, 10);
    const appClasses = window.classes || [];
    const cls = (!isNaN(idx) && idx >= 0) ? appClasses[idx] : null;
    if (cls) {
        d._appClassIdx = idx;
        d.name = cls.name;
        d.klasse = cls.klasse || '';
        d.fach = cls.fach || '';
        d.art = cls.gewichtung === 'nebenfach' ? 'neben' : 'haupt';
        const kinderKey = d.klasse || d.name;
        d.kinder = (kinderKey && StundenplanState.inklusionProKlasse[kinderKey]) ? [...StundenplanState.inklusionProKlasse[kinderKey]] : [];
    } else {
        d._appClassIdx = undefined;
    }
    stundenplanRenderCellModal();
}

function stundenplanCellKursChanged(value) {
    stundenplanCellAppClassSelected(value);
}

function stundenplanGetKnownKacheln() {
    const d = StundenplanState.cellDraft;
    const seen = new Set();
    const known = [];
    Object.entries(StundenplanState.kacheln).forEach(([key, k]) => {
        if (d && key === d.key) return;
        const resolved = stundenplanResolveKachel(k);
        const name = (resolved?.name || '').trim();
        const klasse = (resolved?.klasse || '').trim();
        const fach = (resolved?.fach || '').trim();
        if (!name && !klasse && !fach) return;
        const label = name || klasse || fach;
        const identity = `${label}|${klasse}|${fach}`.toLowerCase();
        if (seen.has(identity)) return;
        seen.add(identity);
        known.push({ key, k, resolved, label, klasse, fach });
    });
    known.sort((a, b) => a.label.localeCompare(b.label, 'de'));
    return known;
}

function stundenplanHideNameSuggestions() {
    const host = document.getElementById('sp-cell-name-suggestions');
    if (!host) return;
    host.innerHTML = '';
    host.style.display = 'none';
}

function stundenplanRenderNameSuggestions(value, showAll = false) {
    const host = document.getElementById('sp-cell-name-suggestions');
    if (!host) return;
    const q = (value || '').trim().toLowerCase();
    if (!q && !showAll) {
        stundenplanHideNameSuggestions();
        return;
    }
    const matches = stundenplanGetKnownKacheln()
        .filter(item => !q || item.label.toLowerCase().includes(q));
    if (!matches.length) {
        stundenplanHideNameSuggestions();
        return;
    }
    host.innerHTML = matches.map(item => `
        <button type="button" class="sp-name-suggestion" onclick="stundenplanCellQuickSelect('${spJsAttr(item.key)}')">
            <span>${ztEsc(item.label)}</span>
            ${item.fach ? `<small>${ztEsc(item.fach)}</small>` : ''}
        </button>
    `).join('');
    host.style.display = 'flex';
}

function stundenplanCellNameFocused(value) {
    stundenplanRenderNameSuggestions(value, true);
}

function stundenplanCellNameBlurred() {
    setTimeout(stundenplanHideNameSuggestions, 120);
}

function stundenplanFindMatchingKachelByName(name) {
    const d = StundenplanState.cellDraft;
    const wanted = (name || '').trim().toLowerCase();
    if (!d || !wanted) return null;
    let match = null;
    Object.entries(StundenplanState.kacheln).some(([key, k]) => {
        if (key === d.key) return false;
        const resolved = stundenplanResolveKachel(k);
        const candidate = (resolved?.name || resolved?.klasse || '').trim().toLowerCase();
        if (candidate !== wanted) return false;
        match = { key, k, resolved };
        return true;
    });
    return match;
}

function stundenplanApplyKachelSuggestion(src) {
    const d = StundenplanState.cellDraft;
    if (!d || !src) return;
    const resolved = stundenplanResolveKachel(src) || src;
    d.name = resolved.name || d.name || '';
    d.klasse = resolved.klasse || '';
    d.fach = resolved.fach || '';
    d.fachlehrer = resolved.fachlehrer || '';
    d.art = resolved.art || 'neben';
    if (!d.farbe && src.farbe) d.farbe = src.farbe;
    const kinderKey = d.klasse || d.name;
    d.kinder = (kinderKey && StundenplanState.inklusionProKlasse[kinderKey]) ? [...StundenplanState.inklusionProKlasse[kinderKey]] : [];
}

function stundenplanCellNameChanged(value) {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    d.name = value;
    stundenplanRenderNameSuggestions(value, true);
    const match = stundenplanFindMatchingKachelByName(value);
    const matchKey = match ? match.key : '';
    if (!match || d._lastNameSuggestionKey === matchKey) return;
    d._lastNameSuggestionKey = matchKey;
    stundenplanApplyKachelSuggestion(match.k);
    const kEl = document.getElementById('sp-cell-klasse');
    const fEl = document.getElementById('sp-cell-fach');
    const flEl = document.getElementById('sp-cell-fachlehrer');
    const aEl = document.getElementById('sp-cell-art');
    if (kEl) kEl.value = d.klasse || '';
    if (fEl) fEl.value = d.fach || '';
    if (flEl) flEl.value = d.fachlehrer || '';
    if (aEl) aEl.value = d.art || 'neben';
    stundenplanRefreshKinderSection();
}

function stundenplanCellQuickSelect(key) {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    // Quell-Kachel direkt per Key (eindeutig je Kurs)
    const src = StundenplanState.kacheln[key];
    if (!src) return;
    stundenplanApplyKachelSuggestion(src);
    stundenplanRenderCellModal();
}

function stundenplanCellHalbjahrChanged(value) {
    const prev = StundenplanState.halbjahr;
    if (value === prev) return;
    const label = value === 'ersten' ? '1. Halbjahr' : '2. Halbjahr';
    swal({
        title: `Halbjahr wechseln?`,
        text: `Das gilt für alle Stunden im Stundenplan. Alle Planung-Kurse werden auf „${label}" umgestellt.`,
        icon: 'warning',
        buttons: { cancel: 'Abbrechen', confirm: { text: 'Ja, wechseln' } }
    }).then(ok => {
        if (!ok) {
            // Dropdown zurücksetzen
            const el = document.getElementById('sp-cell-halbjahr');
            if (el) el.value = prev;
            return;
        }
        StundenplanState.halbjahr = value;
        stundenplanPersist();
    });
}

function stundenplanCellArtToggle(art) {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    stundenplanCellDraftFromDom();
    d.art = art;
}

function stundenplanCellDraftFromDom() {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    const nEl = document.getElementById('sp-cell-name');
    const kEl = document.getElementById('sp-cell-klasse');
    const fEl = document.getElementById('sp-cell-fach');
    const flEl = document.getElementById('sp-cell-fachlehrer');
    const aEl = document.getElementById('sp-cell-art');
    if (nEl) d.name = nEl.value;
    if (kEl) d.klasse = kEl.value;
    if (fEl) d.fach = fEl.value;
    if (flEl) d.fachlehrer = flEl.value;
    if (aEl) d.art = aEl.value;
}

function stundenplanCellSetColor(color) {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    stundenplanCellDraftFromDom();
    d.farbe = color;
    // Nur Swatches aktualisieren, keine vollen Re-Render (würde Inputs leeren)
    document.querySelectorAll('.sp-swatch, .sp-swatch-none').forEach(btn => btn.classList.remove('active'));
    if (color) {
        document.querySelectorAll(`.sp-swatch[style*="${color}"]`).forEach(btn => btn.classList.add('active'));
    } else {
        const none = document.querySelector('.sp-swatch-none');
        if (none) none.classList.add('active');
    }
}

function stundenplanCellToggleRosterKid(name) {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    if (d.kinder.includes(name)) d.kinder = d.kinder.filter(n => n !== name);
    else d.kinder.push(name);
    stundenplanRefreshKinderSection();
}

function stundenplanCellAddFreeKid() {
    const d = StundenplanState.cellDraft;
    const input = document.getElementById('sp-cell-newkid');
    if (!d || !input) return;
    const name = input.value.trim();
    if (name && !d.kinder.includes(name)) d.kinder.push(name);
    input.value = '';
    stundenplanRefreshKinderSection();
    const again = document.getElementById('sp-cell-newkid');
    if (again) again.focus();
}

function stundenplanCellRemoveKid(name) {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    d.kinder = d.kinder.filter(n => n !== name);
    stundenplanRefreshKinderSection();
}

function stundenplanNormCoursePart(value) {
    return String(value || '').trim().toLowerCase();
}

function stundenplanIsSameCourse(target, candidate) {
    if (!target || !candidate) return false;
    const targetFach = stundenplanNormCoursePart(target.fach);
    const candidateFach = stundenplanNormCoursePart(candidate.fach);
    if (targetFach && candidateFach && targetFach !== candidateFach) return false;

    const targetKlasse = stundenplanNormCoursePart(target.klasse);
    const candidateKlasse = stundenplanNormCoursePart(candidate.klasse);
    if (targetKlasse && candidateKlasse) return targetKlasse === candidateKlasse;

    const targetName = stundenplanNormCoursePart(target.name);
    const candidateName = stundenplanNormCoursePart(candidate.name);
    if (targetName && candidateName) return targetName === candidateName;

    return false;
}

function stundenplanApplyFachlehrerToMatchingKacheln(sourceKey, target, fachlehrer) {
    if (!fachlehrer) return;
    Object.entries(StundenplanState.kacheln).forEach(([key, k]) => {
        if (key === sourceKey) return;
        const resolved = stundenplanResolveKachel(k);
        if (!stundenplanIsSameCourse(target, resolved)) return;
        k.fachlehrer = fachlehrer;
    });
}

function stundenplanSaveCell() {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    stundenplanCellDraftFromDom();
    const name = (d.name || '').trim();
    const fach = (d.fach || '').trim();
    const art = (d.art || '').trim();
    const fachlehrer = (d.fachlehrer || '').trim();
    if (!name) { swal('Hinweis', 'Bitte einen Anzeigenamen eingeben.', 'info'); return; }
    if (!fach) { swal('Hinweis', 'Bitte ein Fach eingeben.', 'info'); return; }
    if (!art) { swal('Hinweis', 'Bitte Hauptfach oder Nebenfach wählen.', 'info'); return; }
    const klasse = (d.klasse || '').trim();
    const kinderKey = klasse || name;

    const savedKachel = { name, klasse, fach, fachlehrer, art: d.art || 'neben', farbe: d.farbe };
    StundenplanState.kacheln[d.key] = savedKachel;
    stundenplanApplyFachlehrerToMatchingKacheln(d.key, savedKachel, fachlehrer);
    if (kinderKey) {
        if (d.kinder && d.kinder.length) StundenplanState.inklusionProKlasse[kinderKey] = [...d.kinder];
        else delete StundenplanState.inklusionProKlasse[kinderKey];
    }
    StundenplanState.cellDraft = null;
    stundenplanPersist();
    hideModal();
    renderStundenplanModule();
}

function stundenplanResetConfirm(mode) {
    const isAll = mode === 'all';
    swal({
        title: isAll ? 'Stundenplan löschen?' : 'Stunden zurücksetzen?',
        text: isAll
            ? 'Alle Stunden und Unterrichtszeiten werden unwiderruflich gelöscht.'
            : 'Alle eingetragenen Stunden werden gelöscht. Die Unterrichtszeiten bleiben erhalten.',
        icon: 'warning',
        buttons: { confirm: { text: isAll ? 'Löschen' : 'Zurücksetzen', className: 'swal-button--danger' } },
        dangerMode: true
    }).then(confirmed => {
        if (!confirmed) return;
        if (isAll) {
            StundenplanState.zeiten = [];
            StundenplanState.kurse = [];
            StundenplanState.kacheln = {};
            StundenplanState.inklusionProKlasse = {};
            window._allowEmptyStundenplanSync = true;
        } else {
            StundenplanState.kacheln = {};
            StundenplanState.inklusionProKlasse = {};
        }
        stundenplanPersist();
        renderStundenplanModule();
    });
}

function stundenplanClearCell() {
    const d = StundenplanState.cellDraft;
    if (!d) return;
    delete StundenplanState.kacheln[d.key];
    StundenplanState.cellDraft = null;
    stundenplanPersist();
    hideModal();
    renderStundenplanModule();
}

// ---- Verknüpfung zur Planung (Kurs pro Klasse + Fach) ---------------

function stundenplanSyncPlanungCourses() {
    if (typeof ztPlanungInit === 'function') ztPlanungInit();
    if (typeof ZtPlanungState === 'undefined') return;

    // Gewünschte verknüpfte Kurse aus den Kacheln ableiten
    const desired = {}; // id -> {klasse, fach, fachlehrer, art}
    Object.values(StundenplanState.kacheln).forEach(k => {
        const resolved = stundenplanResolveKachel(k);
        if (!resolved || !resolved.fach) return;
        const kinderKey = resolved.klasse || resolved.name;
        const kinder = StundenplanState.inklusionProKlasse[kinderKey] || [];
        if (!kinder.length) return;
        const id = 'sp:' + (kinderKey).toLowerCase().replace(/\s+/g, '_') + '__' + resolved.fach.toLowerCase().replace(/\s+/g, '_');
        if (!desired[id]) desired[id] = { klasse: kinderKey, fach: resolved.fach, fachlehrer: resolved.fachlehrer || '', art: resolved.art };
        else if (!desired[id].fachlehrer && resolved.fachlehrer) desired[id].fachlehrer = resolved.fachlehrer;
    });

    const before = JSON.stringify(ZtPlanungState.courses);
    // Bestehende verknüpfte Kurse zum Abgleich (done-Status erhalten)
    const existingLinked = {};
    ZtPlanungState.courses.forEach(c => { if (c.source === 'stundenplan') existingLinked[c.id] = c; });

    // Manuelle Kurse unangetastet behalten
    const manualCourses = ZtPlanungState.courses.filter(c => c.source !== 'stundenplan');

    // Verknüpfte Kurse neu aufbauen
    const linkedCourses = Object.keys(desired).map(id => {
        const info = desired[id];
        const old = existingLinked[id];
        const oldDone = {};
        if (old && Array.isArray(old.students)) old.students.forEach(s => { oldDone[s.name] = !!s.done; });
        const kinder = StundenplanState.inklusionProKlasse[info.klasse] || [];
        const delegatedToTeacher = !!(old && old.delegatedToTeacher);
        const textResponsible = old && old.textResponsible ? old.textResponsible : (delegatedToTeacher ? 'teacher' : '');
        const customResponsibleName = old && old.customResponsibleName ? old.customResponsibleName : '';
        const students = kinder.map(name => ({ id: stundenplanGenId(), name, done: delegatedToTeacher || !!oldDone[name] }));
        return {
            id,
            source: 'stundenplan',
            name: [info.klasse, info.fach].filter(Boolean).join(' '),
            halbjahr: StundenplanState.halbjahr || 'ersten',
            typ: info.art === 'haupt' ? 'hauptfach' : 'nebenfach',
            fach: info.fach,
            fachlehrer: info.fachlehrer || '',
            delegatedToTeacher,
            textResponsible,
            customResponsibleName,
            themen: (old && old.themen) || '',
            students
        };
    });

    ZtPlanungState.courses = [...manualCourses, ...linkedCourses];

    const after = JSON.stringify(ZtPlanungState.courses);
    if (before !== after) {
        // Nur localStorage aktualisieren – Cloud-Push übernimmt der Aufrufer (stundenplanPersist)
        try { localStorage.setItem('ztPlanung', JSON.stringify({ courses: ZtPlanungState.courses })); } catch (e) { console.warn('Fehler beim Speichern der Stundenplan-Planung:', e); }
        if (typeof ztPlanungUpdateBadge === 'function') ztPlanungUpdateBadge();
        // Falls das Planung-Modal gerade offen ist, neu zeichnen
        const pm = document.getElementById('zt-planung-modal');
        if (pm && pm.style.display !== 'none' && typeof ztPlanungRenderList === 'function') ztPlanungRenderList();
    }
}

// ---- Startseiten-Kachel: heutige Stunden ----------------------------

function stundenplanRenderHomeTile() {
    const list = document.getElementById('dashboard-sp-list');
    const dayBadge = document.getElementById('dashboard-sp-day');
    if (!list) return;
    stundenplanInit();

    const jsDay = new Date().getDay(); // 0=So ... 6=Sa
    const map = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr' };
    const todayKey = map[jsDay];
    const todayLabel = (STUNDENPLAN_DAYS.find(d => d.key === todayKey) || {}).label || '';
    if (dayBadge) dayBadge.textContent = todayLabel || 'Wochenende';

    if (!todayKey) {
        list.innerHTML = `
            <div class="sp-weekend-state">
                <div class="sp-weekend-icon"><i class="fas fa-smile"></i></div>
                <div class="sp-weekend-title">Wochenende</div>
                <div class="sp-weekend-text">Kein Unterricht geplant.</div>
                <div class="sp-weekend-meta">
                    <span><i class="fas fa-check-circle"></i> Unterrichtsfrei</span>
                    <span><i class="fas fa-clock"></i> Stundenplan pausiert</span>
                </div>
            </div>`;
        return;
    }

    let stundeNr = 0;
    const items = [];
    StundenplanState.zeiten.forEach(z => {
        if (z.typ !== 'stunde') return;
        stundeNr++;
        const k = StundenplanState.kacheln[todayKey + '|' + z.id];
        const resolved = stundenplanResolveKachel(k);
        const label = `${stundeNr}. Stunde`;
        if (resolved) {
            const bg = (k && k.farbe) ? k.farbe : '#e0e7ff';
            items.push(`
                <div class="sp-home-stunde" style="background:${bg};">
                    <span class="sp-home-stunde-time">${ztEsc(label)}</span>
                    <span class="sp-home-stunde-name">${ztEsc(resolved.name || resolved.fach || '')}</span>
                </div>`);
        } else {
            items.push(`
                <div class="sp-home-stunde sp-home-stunde-empty">
                    <span class="sp-home-stunde-time">${ztEsc(label)}</span>
                </div>`);
        }
    });

    list.innerHTML = items.length
        ? `<div class="sp-home-stunden">${items.join('')}</div>`
        : '<div class="sp-tile-empty">Heute keine Stunden eingetragen.</div>';
}

// Globale Verfügbarkeit (für onclick-Handler)
window.renderStundenplanModule = renderStundenplanModule;
window.stundenplanOpenZeiten = stundenplanOpenZeiten;
window.stundenplanAddZeit = stundenplanAddZeit;
window.stundenplanUpdateZeit = stundenplanUpdateZeit;
window.stundenplanDeleteZeit = stundenplanDeleteZeit;
window.stundenplanMoveZeit = stundenplanMoveZeit;
window.stundenplanCloseZeiten = stundenplanCloseZeiten;
window.stundenplanOpenKurse = stundenplanOpenKurse;
window.stundenplanKursArtToggle = stundenplanKursArtToggle;
window.stundenplanKursAdd = stundenplanKursAdd;
window.stundenplanKursDelete = stundenplanKursDelete;
window.stundenplanOpenCell = stundenplanOpenCell;
window.stundenplanCellKursChanged = stundenplanCellKursChanged;
window.stundenplanCellNameFocused = stundenplanCellNameFocused;
window.stundenplanCellNameChanged = stundenplanCellNameChanged;
window.stundenplanCellNameBlurred = stundenplanCellNameBlurred;
window.stundenplanCellQuickSelect = stundenplanCellQuickSelect;
window.stundenplanCellArtToggle = stundenplanCellArtToggle;
window.stundenplanCellHalbjahrChanged = stundenplanCellHalbjahrChanged;
window.stundenplanCellSetColor = stundenplanCellSetColor;
window.stundenplanCellToggleRosterKid = stundenplanCellToggleRosterKid;
window.stundenplanCellAddFreeKid = stundenplanCellAddFreeKid;
window.stundenplanCellRemoveKid = stundenplanCellRemoveKid;
window.stundenplanSaveCell = stundenplanSaveCell;
window.stundenplanClearCell = stundenplanClearCell;
window.stundenplanResetConfirm = stundenplanResetConfirm;
window.stundenplanRenderHomeTile = stundenplanRenderHomeTile;
window.StundenplanState = StundenplanState;
