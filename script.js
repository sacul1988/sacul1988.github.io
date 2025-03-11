// Globale Variablen
let classes = [];
let activeClassId = null;
let activeModule = 'schueler'; // Standardmodul auf 'schueler' geändert
let activeListId = null;
let currentPage = 'home';

// Backup-bezogene globale Variablen
let backups = [];
let autoBackupEnabled = false;
let maxAutoBackups = 5;
let autoBackupInterval = null;
let currentBackupToRestore = null;

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

// Hilfs-Funktion: Sicheres Abrufen eines DOM-Elements
function safeGetElement(id) {
    const element = document.getElementById(id);
    return element;
}

// Funktion zum Konvertieren eines Notenstrings in eine ganze Note (z.B. "1-" -> 1, "2+" -> 2)
function convertToWholeGrade(gradeStr) {
    if (!gradeStr) return 0;
    
    // Extrahiere nur die erste Ziffer der Note
    const wholeGrade = parseInt(gradeStr.charAt(0));
    return isNaN(wholeGrade) ? 0 : wholeGrade;
}

// Seitennavigation
function showPage(page, classId = null) {
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
    
    // Breadcrumb aktualisieren
    const breadcrumbActive = safeGetElement('breadcrumb-active');
    if (breadcrumbActive) {
        if (page === 'home') {
            breadcrumbActive.innerHTML = '';
        } else if (page === 'class' && classId !== null && classes[classId]) {
            activeClassId = classId;
            const className = classes[classId].name;
            breadcrumbActive.innerHTML = `
                <span class="separator">/</span>
                <span>${className}</span>
            `;
            
            // Standardmodul laden
            showModule('schueler');
        }
    }
    
    // Inhalte aktualisieren
    if (page === 'home') {
        renderClassesGrid();
        renderBackupList(); // Backup-Liste aktualisieren, wenn auf Startseite
    } else if (page === 'class') {
        renderModuleContent();
    }
}

// Modulnavigation
function showModule(module) {
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
    renderModuleContent();
}

// Modal anzeigen/verstecken
function showModal(modalId) {
    const modalContainer = safeGetElement('modal-container');
    if (!modalContainer) return;
    
    modalContainer.style.display = 'flex';
    
    // Alle Modals ausblenden
    const modals = document.querySelectorAll('.modal');
    if (modals) {
        modals.forEach(m => m.style.display = 'none');
    }
    
    // Gewünschtes Modal anzeigen
    const targetModal = safeGetElement(modalId);
    if (targetModal) {
        targetModal.style.display = 'block';
    }
}

function hideModal() {
    const modalContainer = safeGetElement('modal-container');
    if (modalContainer) {
        modalContainer.style.display = 'none';
    }
}

// Funktion zum Schließen des Modals bei Klick außerhalb
function closeModalOnOutsideClick(event) {
    // Wenn auf den Modal-Container geklickt wurde (nicht auf ein Modal selbst)
    if (event.target === event.currentTarget) {
        hideModal();
    }
}

// Daten im localStorage speichern
function saveData() {
    try {
        localStorage.setItem('classes', JSON.stringify(classes));
        const oralWeightElement = safeGetElement('oralWeightValue');
        if (oralWeightElement) {
            localStorage.setItem('oralWeight', oralWeightElement.innerText);
        }
        
        // Backup-Einstellungen speichern
        localStorage.setItem('backups', JSON.stringify(backups));
        localStorage.setItem('autoBackupEnabled', JSON.stringify(autoBackupEnabled));
        localStorage.setItem('maxAutoBackups', maxAutoBackups.toString());
        
        // Letztes automatisches Backup-Datum speichern, falls vorhanden
        const autoBackups = backups.filter(backup => backup.type === 'auto');
        if (autoBackups.length > 0) {
            const latestAutoBackup = autoBackups.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            localStorage.setItem('lastAutoBackupDate', latestAutoBackup.date);
        }
    } catch (error) {
        console.error('Fehler beim Speichern der Daten:', error);
        // Optional: Fehlermeldung für den Benutzer anzeigen
    }
}

// Daten aus dem localStorage laden
function loadData() {
    try {
        const savedClasses = localStorage.getItem('classes');
        const savedOralWeight = localStorage.getItem('oralWeight');
        const savedBackups = localStorage.getItem('backups');
        const savedAutoBackupEnabled = localStorage.getItem('autoBackupEnabled');
        const savedMaxAutoBackups = localStorage.getItem('maxAutoBackups');

        if (savedClasses) {
            classes = JSON.parse(savedClasses);
            
            // Kompatibilität mit alten Daten sicherstellen
            classes.forEach(cls => {
                // Module-Daten initialisieren, falls nicht vorhanden
                if (!cls.homework) cls.homework = {};
                if (!cls.homeworkPartial) cls.homeworkPartial = {};
                if (!cls.materials) cls.materials = {};
                if (!cls.seatingChart) cls.seatingChart = null;
                if (!cls.lists) cls.lists = [];
                if (!cls.alphabeticallySorted) cls.alphabeticallySorted = false;
                if (!cls.homeworkSorted) cls.homeworkSorted = false;
                if (!cls.listsSorted) cls.listsSorted = false;
                if (!cls.attendanceSorted) cls.attendanceSorted = false;
                if (!cls.notes) cls.notes = [];
                // Neue Felder für die neuen Module initialisieren
                if (!cls.studentsListSorted) cls.studentsListSorted = false;
                if (!cls.classNotes) cls.classNotes = [];
                if (!cls.attachments) cls.attachments = [];
                // Neue Felder für die Übersicht-Sortierung
                if (!cls.overviewSorted) cls.overviewSorted = false;
                
                // Sicherstellen, dass alle Schüler die erweiterten Eigenschaften haben
                if (cls.students) {
                    cls.students.forEach(student => {
                        if (!student.homework) student.homework = 0;
                        if (!student.homeworkPartial) student.homeworkPartial = 0;
                        if (!student.materials) student.materials = 0;
                        if (!student.individualGrade) student.individualGrade = null;
                        if (!student.individualGradeComment) student.individualGradeComment = '';
                        if (!student.attendance) student.attendance = 'none'; // none, present, absent
                        if (!student.plannerHW) student.plannerHW = [false, false, false]; // Schulplaner Hausaufgaben
                        if (!student.plannerMaterials) student.plannerMaterials = [false, false, false]; // Schulplaner Material
                        if (!student.isExpanded) student.isExpanded = false; // Für Noten-Tab
                        if (!student.isExpandedHW) student.isExpandedHW = false; // Für Hausaufgaben-Tab
                        
                        // Neu: Schülernotizen initialisieren
                        if (!student.notes) student.notes = [];
                        
                        // NEU: Hausaufgaben-Verlaufseinträge initialisieren
                        if (!student.hwHistory) student.hwHistory = [];
                        
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
        }
        
        if (savedOralWeight) {
            const oralWeightElement = safeGetElement('oralWeightValue');
            if (oralWeightElement) {
                oralWeightElement.innerText = savedOralWeight;
                
                // Aktiven Button markieren
                const weightButtons = document.querySelectorAll('.weight-btn');
                if (weightButtons) {
                    weightButtons.forEach(btn => {
                        btn.classList.remove('active-weight');
                    });
                    
                    const weightButton = document.querySelector(`.weight-btn[onclick="setWeight(${savedOralWeight})"]`);
                    if (weightButton) {
                        weightButton.classList.add('active-weight');
                    }
                }
            }
        }
        
        // Backups laden
        if (savedBackups) {
            backups = JSON.parse(savedBackups);
        } else {
            backups = [];
        }
        
        // Auto-Backup-Einstellungen laden
        if (savedAutoBackupEnabled !== null) {
            autoBackupEnabled = JSON.parse(savedAutoBackupEnabled);
            
            // UI aktualisieren
            const autoBackupCheckbox = safeGetElement('auto-backup-enabled');
            if (autoBackupCheckbox) {
                autoBackupCheckbox.checked = autoBackupEnabled;
            }
        }
        
        if (savedMaxAutoBackups) {
            maxAutoBackups = parseInt(savedMaxAutoBackups);
            
            // UI aktualisieren
            const maxAutoBackupsSelect = safeGetElement('max-auto-backups');
            if (maxAutoBackupsSelect) {
                maxAutoBackupsSelect.value = maxAutoBackups.toString();
            }
        }
        
        // Backup-Informationen aktualisieren
        updateBackupInfo();
        
        // Automatisches Backup bei Bedarf aktivieren
        if (autoBackupEnabled) {
            scheduleNextAutoBackup();
        }
    } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
        // Fallback: Leere Daten verwenden
        classes = [];
        backups = [];
    }
    
    renderClassesGrid();
    renderBackupList();
}
// Diese Funktion dient als Verzweigung zu den verschiedenen Modulen
function renderModuleContent() {
    if (activeClassId === null || !classes[activeClassId]) return;
    
    switch (activeModule) {
        case 'schueler':
            renderStudentsModule();
            break;
        case 'hausaufgaben':
            renderHomeworkModule();
            break;
        case 'noten':
            renderGradesModule();
            updateProjectSelectionOptions();
            updateProjectStatistics();
            break;
        case 'uebersicht':
            renderOverviewModule();
            break;
        case 'sitzplan':
            renderSeatingModule();
            break;
        case 'listen':
            renderListsModule();
            break;
        case 'zaehlen':
            renderAttendanceModule();
            break;
        case 'klassennotizen':
            renderClassNotesModule();
            break;
        case 'punkteverteilung':
            renderPunkteverteilungModule();
            break;
    }
}
// Startseite: Klassen-Grid rendern
function renderClassesGrid() {
    const classesGrid = safeGetElement('classes-grid');
    if (!classesGrid) return;
    
    classesGrid.innerHTML = '';
    
    if (!classes || classes.length === 0) {
        classesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-school"></i>
                <p>Keine Klassen vorhanden</p>
                <p>Füge eine neue Klasse hinzu, um zu beginnen</p>
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
        const hwCount = cls.students.reduce((sum, student) => {
            const homework = student.homework || 0;
            const homeworkPartial = student.homeworkPartial || 0;
            return sum + homework + homeworkPartial / 2;
        }, 0);
        const materialsCount = cls.students.reduce((sum, student) => sum + (student.materials || 0), 0);
        
        const classCard = document.createElement('div');
        classCard.className = 'class-card';
        classCard.innerHTML = `
            <div class="class-card-header">
                <span>${cls.name}</span>
                <span class="badge badge-light">${studentCount} Schüler</span>
            </div>
            <div class="class-card-body">
                <div class="class-stats">
                    <div class="class-stat">
                        <div class="number">${hwCount.toFixed(1)}</div>
                        <div class="label">Hausaufgaben</div>
                    </div>
                    <div class="class-stat">
                        <div class="number">${materialsCount}</div>
                        <div class="label">Material</div>
                    </div>
                </div>
                <div class="module-buttons">
                    <button class="btn btn-primary btn-block" onclick="showPage('class', ${index})">
                        <i class="fas fa-eye"></i> Öffnen
                    </button>
                    <div class="class-card-actions">
                        <button class="btn btn-primary btn-icon-only" onclick="editClass(${index})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-secondary btn-icon-only" onclick="showCloneModal(${index})">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-danger btn-icon-only" onclick="deleteClass(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        classesGrid.appendChild(classCard);
    });
}

// Klasse erstellen
function createClass() {
    const classNameInput = safeGetElement('new-class-name');
    const subjectInput = safeGetElement('new-class-subject');
    
    if (!classNameInput) return;
    
    const className = classNameInput.value.trim();
    const subject = subjectInput ? subjectInput.value.trim() : '';
    
    if (!className) {
        swal("Fehler", "Bitte gib einen Klassennamen ein", "error");
        return;
    }
    
    const newClass = {
        name: className,
        subject: subject,
        students: [],
        homework: {},
        homeworkPartial: {},
        materials: {},
        seatingChart: null,
        lists: [],
        attendance: {},
        alphabeticallySorted: false,
        homeworkSorted: false,
        listsSorted: false,
        attendanceSorted: false,
        notes: [],
        studentsListSorted: false,
        classNotes: [],
        attachments: [],
        overviewSorted: false
    };
    
    classes.push(newClass);
    saveData();
    hideModal();
    
    // Felder zurücksetzen
    if (classNameInput) classNameInput.value = '';
    if (subjectInput) subjectInput.value = '';
    
    renderClassesGrid();
    
    swal("Erfolg", `Klasse "${className}" wurde erstellt`, "success");
}
// Klasse klonen - Zeige Modal
function showCloneModal(classId) {
    if (classId === null || classId === undefined || !classes[classId]) return;
    
    const cls = classes[classId];
    const cloneNameElement = safeGetElement('clone-class-name');
    const cloneNewNameInput = safeGetElement('clone-class-new-name');
    const cloneModal = safeGetElement('clone-class-modal');
    
    if (!cloneModal) return;
    
    // Modal-Felder aktualisieren
    if (cloneNameElement) {
        cloneNameElement.textContent = `Klasse: ${cls.name}`;
    }
    
    if (cloneNewNameInput) {
        cloneNewNameInput.value = `${cls.name} Kopie`;
    }
    
    // Checkboxen zurücksetzen (nur Schüler standardmäßig ausgewählt)
    const checkSchueler = safeGetElement('clone-schueler');
    const checkHausaufgaben = safeGetElement('clone-hausaufgaben');
    const checkNoten = safeGetElement('clone-noten');
    const checkSitzplan = safeGetElement('clone-sitzplan');
    const checkListen = safeGetElement('clone-listen');
    const checkNotizen = safeGetElement('clone-klassennotizen');
    
    if (checkSchueler) checkSchueler.checked = true;
    if (checkHausaufgaben) checkHausaufgaben.checked = false;
    if (checkNoten) checkNoten.checked = false;
    if (checkSitzplan) checkSitzplan.checked = false;
    if (checkListen) checkListen.checked = false;
    if (checkNotizen) checkNotizen.checked = false;
    
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

    // Tab-Auswahl auslesen
    const checkSchueler = safeGetElement('clone-schueler');
    const checkHausaufgaben = safeGetElement('clone-hausaufgaben');
    const checkNoten = safeGetElement('clone-noten');
    const checkSitzplan = safeGetElement('clone-sitzplan');
    const checkListen = safeGetElement('clone-listen');
    const checkNotizen = safeGetElement('clone-klassennotizen');
    
    const cloneStudents = checkSchueler && checkSchueler.checked;
    const cloneHomework = checkHausaufgaben && checkHausaufgaben.checked;
    const cloneGrades = checkNoten && checkNoten.checked;
    const cloneSeatingChart = checkSitzplan && checkSitzplan.checked;
    const cloneLists = checkListen && checkListen.checked;
    const cloneNotes = checkNotizen && checkNotizen.checked;
    
    // Neue Klasse erstellen mit grundlegenden Eigenschaften
    const newClass = {
        name: newName,
        subject: originalClass.subject,
        students: cloneStudents ? JSON.parse(JSON.stringify(originalClass.students || [])) : [],
        homework: {},
        homeworkPartial: {},
        materials: {},
        seatingChart: cloneSeatingChart ? originalClass.seatingChart : null,
        lists: cloneLists ? JSON.parse(JSON.stringify(originalClass.lists || [])) : [],
        alphabeticallySorted: originalClass.alphabeticallySorted || false,
        homeworkSorted: originalClass.homeworkSorted || false,
        listsSorted: originalClass.listsSorted || false,
        attendanceSorted: originalClass.attendanceSorted || false,
        studentsListSorted: originalClass.studentsListSorted || false,
        notes: [],
        classNotes: cloneNotes ? JSON.parse(JSON.stringify(originalClass.classNotes || [])) : [],
        attachments: cloneNotes ? JSON.parse(JSON.stringify(originalClass.attachments || [])) : [],
        overviewSorted: originalClass.overviewSorted || false
    };
    
    // Hausaufgaben und Material zurücksetzen, wenn nicht übernommen werden sollen
    if (!cloneHomework && cloneStudents && newClass.students) {
        newClass.students.forEach(student => {
            student.homework = 0;
            student.homeworkPartial = 0;
            student.materials = 0;
            student.plannerHW = [false, false, false];
            student.plannerMaterials = [false, false, false];
            student.isExpandedHW = false;
            student.hwHistory = []; // Auch Verlauf zurücksetzen
        });
    }
    
    // Noten zurücksetzen, wenn nicht übernommen werden sollen
    if (!cloneGrades && cloneStudents && newClass.students) {
        newClass.students.forEach(student => {
            student.projects = [];
            student.oralGrade = '';
            student.individualGrade = null;
            student.individualGradeComment = '';
            student.isExpanded = false;
        });
    }
    
    classes.push(newClass);
    saveData();
    hideModal();
    renderClassesGrid();
    
    swal("Erfolg", `Klasse "${newName}" wurde erstellt`, "success");
}

// Klasse bearbeiten
function editClass(classId) {
    if (classId === null || classId === undefined || !classes[classId]) return;
    
    const cls = classes[classId];
    
    swal({
        title: "Klasse bearbeiten",
        text: "Neuer Name für die Klasse:",
        content: {
            element: "input",
            attributes: {
                placeholder: "Klassenname",
                value: cls.name
            }
        },
        buttons: ["Abbrechen", "Speichern"],
    })
    .then((newName) => {
        if (newName) {
            cls.name = newName.trim();
            saveData();
            renderClassesGrid();
            
            // Falls aktive Klasse, Breadcrumb aktualisieren
            if (currentPage === 'class' && activeClassId === classId) {
                const breadcrumbActive = safeGetElement('breadcrumb-active');
                if (breadcrumbActive) {
                    breadcrumbActive.innerHTML = `
                        <span class="separator">/</span>
                        <span>${cls.name}</span>
                    `;
                }
            }
        }
    });
}

// Klasse löschen
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
            saveData();
            
            // Falls aktive Klasse gelöscht wurde, zurück zur Startseite
            if (currentPage === 'class' && activeClassId === classId) {
                showPage('home');
            } else if (currentPage === 'class' && activeClassId > classId) {
                // Index anpassen, wenn eine Klasse davor gelöscht wurde
                activeClassId--;
            }
            
            renderClassesGrid();
            swal("Gelöscht", "Die Klasse wurde erfolgreich gelöscht", "success");
        }
    });
}

// Schüler Modul rendern
function renderStudentsModule() {
    const studentsTable = safeGetElement('students-list-table');
    if (!studentsTable) return;
    
    studentsTable.innerHTML = '';
    
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        classes[activeClassId].students = [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.students.length === 0) {
        studentsTable.innerHTML = `
            <tr>
                <td colspan="3">
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
            <td>${student.name}</td>
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
        
        studentsTable.appendChild(row);
    });
}

// Schüler hinzufügen
function addStudent() {
    if (!classes[activeClassId]) return;
    
    const studentName = prompt("Name des Schülers:");
    
    if (studentName && studentName.trim()) {
        if (!classes[activeClassId].students) {
            classes[activeClassId].students = [];
        }
        
        classes[activeClassId].students.push({
            name: studentName.trim(),
            projects: [],
            oralGrade: '',
            homework: 0,
            homeworkPartial: 0,
            materials: 0,
            individualGrade: null,
            individualGradeComment: '',
            attendance: 'none',
            isExpanded: false,
            isExpandedHW: false,
            plannerHW: [false, false, false],
            plannerMaterials: [false, false, false],
            notes: [], // Feld für Schülernotizen
            hwHistory: [] // NEU: Feld für Hausaufgaben-Verlauf
        });
        
        saveData();
        renderModuleContent();
    }
}

// Funktion zum Bearbeiten eines Schülernamens
function editStudentName(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const student = classes[activeClassId].students[studentIndex];
    if (!student) return;
    
    swal({
        title: "Schüler bearbeiten",
        text: "Neuer Name für den Schüler:",
        content: {
            element: "input",
            attributes: {
                placeholder: "Schülername",
                value: student.name
            }
        },
        buttons: ["Abbrechen", "Speichern"],
    })
    .then((newName) => {
        if (newName) {
            classes[activeClassId].students[studentIndex].name = newName.trim();
            saveData();
            renderModuleContent();
        }
    });
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
                homework: 0,
                homeworkPartial: 0,
                materials: 0,
                individualGrade: null,
                individualGradeComment: '',
                attendance: 'none',
                isExpanded: false,
                isExpandedHW: false,
                plannerHW: [false, false, false],
                plannerMaterials: [false, false, false],
                notes: [], // Feld für Schülernotizen
                hwHistory: [] // NEU: Feld für Hausaufgaben-Verlauf
            });
            importedCount++;
        }
    });
    
    if (importedCount > 0) {
        saveData();
        if (importNamesTextarea) importNamesTextarea.value = '';
        renderModuleContent();
        swal("Erfolg", `${importedCount} Schüler wurden importiert`, "success");
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
                classes[activeClassId].students.splice(originalIndex, 1);
                saveData();
                renderModuleContent();
                
                swal("Gelöscht", `${student.name} wurde erfolgreich gelöscht`, "success");
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

// Alphabetische Sortierung umschalten
function toggleSortStudents() {
    if (!classes[activeClassId]) return;
    
    classes[activeClassId].alphabeticallySorted = !classes[activeClassId].alphabeticallySorted;
    saveData();
    renderGradesModule();
}
// Sortierte Hausaufgaben-Schülerliste erhalten
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

// Sortierung der Hausaufgabenliste umschalten
function toggleSortHomework() {
    if (!classes[activeClassId]) return;
    
    classes[activeClassId].homeworkSorted = !classes[activeClassId].homeworkSorted;
    saveData();
    renderHomeworkModule();
}

// Hausaufgaben und Material Modul rendern - GEÄNDERT für Verlauf-Button
function renderHomeworkModule() {
    const hwList = safeGetElement('hw-list');
    if (!hwList) return;
    
    hwList.innerHTML = '';
    
    if (!classes[activeClassId]) return;
    const cls = classes[activeClassId];
    
    // Sort-Button aktualisieren
    const sortBtn = safeGetElement('sort-hw-btn');
    if (sortBtn) {
        sortBtn.innerHTML = `
            <i class="fas fa-sort-alpha-down"></i> ${cls.homeworkSorted ? 'Sortierung aufheben' : 'Alphabetisch sortieren'}
        `;
        // Farbklasse hinzufügen oder entfernen je nach Zustand
        if (cls.homeworkSorted) {
            sortBtn.classList.add('active-sort');
        } else {
            sortBtn.classList.remove('active-sort');
        }
    }
    
    if (!cls.students || cls.students.length === 0) {
        hwList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-graduate"></i>
                <p>Keine Schüler in dieser Klasse</p>
            </div>
        `;
        return;
    }
    
    // Sortierte oder unsortierte Schülerliste
    const studentsToRender = getSortedHomeworkStudents();
    
    studentsToRender.forEach((student, index) => {
        const homework = student.homework || 0;
        const homeworkPartial = student.homeworkPartial || 0;
        const totalHw = homework + homeworkPartial / 2;
        const materials = student.materials || 0;
        
        // Anzahl der Notizen für Anzeige von Badge
        const notesCount = student.notes ? student.notes.filter(note => note.important).length : 0;
        
        const hwItem = document.createElement('li');
        hwItem.className = 'hw-item';
        
        // Text für vergessene Hausaufgaben und Material
        let forgottenText = '';
        if (totalHw > 0 || materials > 0) {
            let parts = [];
            if (totalHw > 0) {
                parts.push(`${totalHw.toFixed(1)}x Hausaufgaben vergessen`);
            }
            if (materials > 0) {
                parts.push(`${materials}x Material vergessen`);
            }
            forgottenText = parts.join(', ');
        } else {
            forgottenText = 'Keine Einträge';
        }
        
        // Header mit Name und Zusammenfassung
        const hwHeader = document.createElement('div');
        hwHeader.className = 'hw-header';
        hwHeader.onclick = () => toggleHomeworkDetails(index);
        hwHeader.innerHTML = `
            <div class="hw-name">
                ${student.name}
                <i id="hwToggleIcon-${index}" class="fas fa-chevron-down toggle-icon ${student.isExpandedHW ? 'rotate' : ''}"></i>
            </div>
            <div class="hw-status">${forgottenText}</div>
        `;
        
        // Details-Bereich mit einer Zeile für die Zähler und +/- Buttons
        const hwDetails = document.createElement('div');
        hwDetails.id = `hwDetails-${index}`;
        hwDetails.className = `hw-details ${student.isExpandedHW ? 'show' : ''}`;
        
        const hwCounters = document.createElement('div');
        hwCounters.className = 'hw-counters-row';
        
        // NEU: Notizen-Button und Verlauf-Button hinzufügen
        hwCounters.innerHTML = `
            <div class="hw-action-buttons">
                <button class="notes-btn" onclick="showStudentNotesModal(${index}, 'homework')">
                    <i class="fas fa-thumbtack"></i> Notizen
                </button>
                <button class="hw-history-button" onclick="showHWHistoryModal(${index})">
                    <i class="fas fa-history"></i> Verlauf
                </button>
            </div>
            <div class="hw-counter-buttons">
                <button class="btn btn-sm btn-primary" onclick="showCounterIncreaseModal(${index})">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="btn btn-sm btn-warning" onclick="showCounterDecreaseModal(${index})">
                    <i class="fas fa-minus"></i>
                </button>
            </div>
        `;
        
        hwDetails.appendChild(hwCounters);
        
        // Alles zusammensetzen
        hwItem.appendChild(hwHeader);
        hwItem.appendChild(hwDetails);
        hwList.appendChild(hwItem);
    });
}

// Ein-/Ausklappen der Hausaufgabendetails
function toggleHomeworkDetails(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Zustand umschalten
    classes[activeClassId].students[originalIndex].isExpandedHW = !classes[activeClassId].students[originalIndex].isExpandedHW;
    
    // UI aktualisieren
    const detailsDiv = safeGetElement(`hwDetails-${studentIndex}`);
    const toggleIcon = safeGetElement(`hwToggleIcon-${studentIndex}`);
    
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
}

// Alle Hausaufgaben einklappen
function collapseAllHomework() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Alle Schüler auf nicht ausgeklappt setzen
    classes[activeClassId].students.forEach(student => {
        student.isExpandedHW = false;
    });
    
    // UI aktualisieren
    const sortedStudents = getSortedHomeworkStudents();
    sortedStudents.forEach((student, index) => {
        const detailsDiv = safeGetElement(`hwDetails-${index}`);
        const toggleIcon = safeGetElement(`hwToggleIcon-${index}`);
        
        if (detailsDiv && toggleIcon) {
            detailsDiv.classList.remove('show');
            toggleIcon.classList.remove('rotate');
        }
    });
    
    saveData();
}

// NEU: Studentenindex für die Modal-Operation
let counterModalStudentIndex = null;

// NEU: Modal zum Erhöhen eines Zählers anzeigen
function showCounterIncreaseModal(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    
    // Studentennamen im Modal setzen
    const studentNameElement = safeGetElement('hw-counter-student-name');
    if (studentNameElement) {
        studentNameElement.textContent = `Schüler: ${student.name}`;
    }
    
    // Studentenindex für spätere Verwendung speichern
    counterModalStudentIndex = studentIndex;
    
    // Modal anzeigen
    showModal('hw-counter-increase-modal');
}

// NEU: Modal zum Verringern eines Zählers anzeigen
function showCounterDecreaseModal(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    
    // Studentennamen im Modal setzen
    const studentNameElement = safeGetElement('hw-counter-student-name-decrease');
    if (studentNameElement) {
        studentNameElement.textContent = `Schüler: ${student.name}`;
    }
    
    // Studentenindex für spätere Verwendung speichern
    counterModalStudentIndex = studentIndex;
    
    // Modal anzeigen
    showModal('hw-counter-decrease-modal');
}

// NEU: Erhöhung eines Zählers bestätigen mit Verlaufseintrag
function confirmIncreaseCounter() {
    if (counterModalStudentIndex === null || !classes[activeClassId] || !classes[activeClassId].students) {
        hideModal();
        return;
    }
    
    const studentsArray = getSortedHomeworkStudents();
    if (counterModalStudentIndex < 0 || counterModalStudentIndex >= studentsArray.length) {
        hideModal();
        return;
    }
    
    const student = studentsArray[counterModalStudentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) {
        hideModal();
        return;
    }
    
    // Ausgewählten Zählertyp ermitteln
    const radioHomework = safeGetElement('increase-option-homework');
    const radioPartial = safeGetElement('increase-option-partial');
    const radioMaterials = safeGetElement('increase-option-materials');
    
    let counterType = 'homework'; // Standard-Wert
    
    if (radioPartial && radioPartial.checked) {
        counterType = 'partial';
    } else if (radioMaterials && radioMaterials.checked) {
        counterType = 'materials';
    }
    
    // Entsprechenden Zähler erhöhen
    if (counterType === 'homework') {
        if (classes[activeClassId].students[originalIndex].homework === undefined) {
            classes[activeClassId].students[originalIndex].homework = 0;
        }
        classes[activeClassId].students[originalIndex].homework++;
    } else if (counterType === 'partial') {
        if (classes[activeClassId].students[originalIndex].homeworkPartial === undefined) {
            classes[activeClassId].students[originalIndex].homeworkPartial = 0;
        }
        classes[activeClassId].students[originalIndex].homeworkPartial++;
    } else if (counterType === 'materials') {
        if (classes[activeClassId].students[originalIndex].materials === undefined) {
            classes[activeClassId].students[originalIndex].materials = 0;
        }
        classes[activeClassId].students[originalIndex].materials++;
    }
    
    // NEU: Verlaufseintrag hinzufügen
    if (!classes[activeClassId].students[originalIndex].hwHistory) {
        classes[activeClassId].students[originalIndex].hwHistory = [];
    }
    
    const historyEntry = {
        id: Date.now().toString(), // Timestamp als eindeutige ID
        date: new Date().toISOString(),
        type: counterType
    };
    
    classes[activeClassId].students[originalIndex].hwHistory.push(historyEntry);
    
    // Daten speichern und UI aktualisieren
    saveData();
    hideModal();
    renderHomeworkModule();
}
// NEU: Verringerung eines Zählers bestätigen mit Verlaufseintrag-Entfernung
function confirmDecreaseCounter() {
    if (counterModalStudentIndex === null || !classes[activeClassId] || !classes[activeClassId].students) {
        hideModal();
        return;
    }
    
    const studentsArray = getSortedHomeworkStudents();
    if (counterModalStudentIndex < 0 || counterModalStudentIndex >= studentsArray.length) {
        hideModal();
        return;
    }
    
    const student = studentsArray[counterModalStudentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) {
        hideModal();
        return;
    }
    
    // Ausgewählten Zählertyp ermitteln
    const radioHomework = safeGetElement('decrease-option-homework');
    const radioPartial = safeGetElement('decrease-option-partial');
    const radioMaterials = safeGetElement('decrease-option-materials');
    
    let counterType = 'homework'; // Standard-Wert
    
    if (radioPartial && radioPartial.checked) {
        counterType = 'partial';
    } else if (radioMaterials && radioMaterials.checked) {
        counterType = 'materials';
    }
    
    // Prüfen, ob der Zähler größer als 0 ist, und entsprechend verringern
    if (counterType === 'homework') {
        if (classes[activeClassId].students[originalIndex].homework === undefined) {
            classes[activeClassId].students[originalIndex].homework = 0;
        }
        if (classes[activeClassId].students[originalIndex].homework > 0) {
            classes[activeClassId].students[originalIndex].homework--;
            
            // NEU: Letzten passenden Verlaufseintrag entfernen
            if (classes[activeClassId].students[originalIndex].hwHistory) {
                // Von den neuesten Einträgen beginnend suchen
                const entries = classes[activeClassId].students[originalIndex].hwHistory;
                for (let i = entries.length - 1; i >= 0; i--) {
                    if (entries[i].type === counterType) {
                        // Passenden Eintrag gefunden, entfernen
                        entries.splice(i, 1);
                        break; // Nur einen Eintrag entfernen
                    }
                }
            }
        }
    } else if (counterType === 'partial') {
        if (classes[activeClassId].students[originalIndex].homeworkPartial === undefined) {
            classes[activeClassId].students[originalIndex].homeworkPartial = 0;
        }
        if (classes[activeClassId].students[originalIndex].homeworkPartial > 0) {
            classes[activeClassId].students[originalIndex].homeworkPartial--;
            
            // NEU: Letzten passenden Verlaufseintrag entfernen
            if (classes[activeClassId].students[originalIndex].hwHistory) {
                // Von den neuesten Einträgen beginnend suchen
                const entries = classes[activeClassId].students[originalIndex].hwHistory;
                for (let i = entries.length - 1; i >= 0; i--) {
                    if (entries[i].type === counterType) {
                        // Passenden Eintrag gefunden, entfernen
                        entries.splice(i, 1);
                        break; // Nur einen Eintrag entfernen
                    }
                }
            }
        }
    } else if (counterType === 'materials') {
        if (classes[activeClassId].students[originalIndex].materials === undefined) {
            classes[activeClassId].students[originalIndex].materials = 0;
        }
        if (classes[activeClassId].students[originalIndex].materials > 0) {
            classes[activeClassId].students[originalIndex].materials--;
            
            // NEU: Letzten passenden Verlaufseintrag entfernen
            if (classes[activeClassId].students[originalIndex].hwHistory) {
                // Von den neuesten Einträgen beginnend suchen
                const entries = classes[activeClassId].students[originalIndex].hwHistory;
                for (let i = entries.length - 1; i >= 0; i--) {
                    if (entries[i].type === counterType) {
                        // Passenden Eintrag gefunden, entfernen
                        entries.splice(i, 1);
                        break; // Nur einen Eintrag entfernen
                    }
                }
            }
        }
    }
    
    // Daten speichern und UI aktualisieren
    saveData();
    hideModal();
    renderHomeworkModule();
}

// NEU: Funktion zum Anzeigen des Hausaufgaben-Verlauf-Modals
function showHWHistoryModal(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
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
    
    // Modal anzeigen
    showModal('hw-history-modal');
}

// NEU: Funktion zum Rendern des Hausaufgaben-Verlaufs
function renderHWHistory(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students ||
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    const historyList = safeGetElement('hw-history-list');
    const emptyState = safeGetElement('hw-history-empty');
    
    if (!historyList || !emptyState) return;
    
    historyList.innerHTML = '';
    
    if (!student.hwHistory || student.hwHistory.length === 0) {
        historyList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    historyList.style.display = 'block';
    emptyState.style.display = 'none';
    
    // Einträge nach Datum sortieren (neueste zuerst)
    const sortedEntries = [...student.hwHistory].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    sortedEntries.forEach(entry => {
        const entryDate = new Date(entry.date);
        const formattedDate = entryDate.toLocaleDateString('de-DE');
        
        // Text je nach Typ bestimmen
        let typeText = 'Hausaufgaben vollständig vergessen';
        if (entry.type === 'partial') {
            typeText = 'Hausaufgaben teilweise vergessen';
        } else if (entry.type === 'materials') {
            typeText = 'Material vergessen';
        }
        
        const historyItem = document.createElement('div');
        historyItem.className = `hw-history-item ${entry.type}`;
        historyItem.innerHTML = `
            <div class="hw-history-content">
                <span class="hw-history-date">${formattedDate}</span> - ${typeText}
            </div>
            <button class="hw-history-delete" onclick="deleteHWHistoryEntry(${studentIndex}, '${entry.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        historyList.appendChild(historyItem);
    });
}

// NEU: Funktion zum Löschen eines Verlaufseintrags
function deleteHWHistoryEntry(studentIndex, entryId) {
    if (!classes[activeClassId] || !classes[activeClassId].students || 
        studentIndex < 0 || studentIndex >= classes[activeClassId].students.length) return;
    
    const student = classes[activeClassId].students[studentIndex];
    
    if (!student.hwHistory) return;
    
    // Eintrag finden
    const entryIndex = student.hwHistory.findIndex(entry => entry.id === entryId);
    
    if (entryIndex === -1) return;
    
    // Typ des Eintrags merken, bevor er gelöscht wird
    const entryType = student.hwHistory[entryIndex].type;
    
    swal({
        title: "Eintrag löschen?",
        text: "Möchtest du diesen Verlaufseintrag wirklich löschen?",
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            // Eintrag entfernen
            student.hwHistory.splice(entryIndex, 1);
            
            // Entsprechenden Zähler reduzieren
            if (entryType === 'homework') {
                if (student.homework > 0) {
                    student.homework--;
                }
            } else if (entryType === 'partial') {
                if (student.homeworkPartial > 0) {
                    student.homeworkPartial--;
                }
            } else if (entryType === 'materials') {
                if (student.materials > 0) {
                    student.materials--;
                }
            }
            
            // Daten speichern und UI aktualisieren
            saveData();
            renderHWHistory(studentIndex);
            renderHomeworkModule();
        }
    });
}

// Planner Checkboxen aktualisieren - NICHT MEHR BENÖTIGT, IN NEUEM DESIGN ENTFERNT
function togglePlannerHW(studentIndex, checkboxIndex, checked) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass plannerHW existiert
    if (!classes[activeClassId].students[originalIndex].plannerHW) {
        classes[activeClassId].students[originalIndex].plannerHW = [false, false, false];
    }
    
    classes[activeClassId].students[originalIndex].plannerHW[checkboxIndex] = checked;
    saveData();
}

function togglePlannerMaterials(studentIndex, checkboxIndex, checked) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass plannerMaterials existiert
    if (!classes[activeClassId].students[originalIndex].plannerMaterials) {
        classes[activeClassId].students[originalIndex].plannerMaterials = [false, false, false];
    }
    
    classes[activeClassId].students[originalIndex].plannerMaterials[checkboxIndex] = checked;
    saveData();
}
// Sortierte Anwesenheitsliste
function getSortedAttendanceStudents() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        return [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.attendanceSorted) {
        return [...cls.students].sort((a, b) => {
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
        });
    }
    
    return cls.students;
}

// Funktion zur Bestimmung der Notenfarbe
function getGradeColorClass(grade) {
    const numericGrade = typeof grade === 'number' ? grade : convertGrade(grade);
    if (numericGrade <= 1.5) return 'grade-excellent';
    if (numericGrade <= 2.5) return 'grade-good';
    if (numericGrade <= 3.5) return 'grade-average';
    if (numericGrade <= 4.0) return 'grade-poor';
    if (numericGrade <= 5.0) return 'grade-bad';
    return 'grade-very-bad';
}

// Hilfsfunktion zur Bestimmung der Farbe basierend auf dem Notenwert
function getGradeColor(grade) {
    if (grade <= 1.5) return '#38b000'; // Sehr gut
    if (grade <= 2.5) return '#70e000'; // Gut
    if (grade <= 3.5) return '#ffdd00'; // Befriedigend
    if (grade <= 4.0) return '#ff9500'; // Ausreichend
    if (grade <= 5.0) return '#ff0a54'; // Mangelhaft
    return '#8B0000'; // Ungenügend
}

// Noten Modul rendern - GEÄNDERT für Notizen-Button
function renderGradesModule() {
    const studentsList = safeGetElement('students-list');
    if (!studentsList) return;
    
    studentsList.innerHTML = '';
    
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
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
    const sortBtn = safeGetElement('sort-students-btn');
    if (sortBtn) {
        sortBtn.innerHTML = `
            <i class="fas fa-sort-alpha-down"></i> ${cls.alphabeticallySorted ? 'Sortierung aufheben' : 'Alphabetisch sortieren'}
        `;
        // Farbklasse hinzufügen oder entfernen je nach Zustand
        if (cls.alphabeticallySorted) {
            sortBtn.classList.add('active-sort');
        } else {
            sortBtn.classList.remove('active-sort');
        }
        sortBtn.onclick = () => toggleSortStudents();
    }
    
    // Sortierte oder unsortierte Schülerliste
    const studentsToRender = getSortedStudents();
    
    studentsToRender.forEach((student, studentIndex) => {
        if (!student.projects) {
            student.projects = [];
        }
        
        // Anzahl der wichtigen Notizen für Badge
        const notesCount = student.notes ? student.notes.filter(note => note.important).length : 0;
        
        const studentCard = document.createElement('div');
        studentCard.className = 'student-card fade-in';
        
        // Endnote berechnen
        const finalGrade = calculateFinalGrade(student.projects, student.oralGrade, oralWeight);
        
        // Studentenkopf mit Namen und Endnote
        let studentHeader = `
            <div class="student-header" onclick="toggleStudentDetails(${studentIndex})">
                <div class="student-name">
                    <i class="fas fa-user"></i> ${student.name}
                    <i id="toggleIcon-${studentIndex}" class="fas fa-chevron-down toggle-icon ${student.isExpanded ? 'rotate' : ''}"></i>
                </div>
        `;
        
        // Endnoten-Anzeige
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
        
        // Details-Bereich - Mit Notizen-Button neben mündlicher Note
        let studentDetails = `
            <div id="studentDetails-${studentIndex}" class="student-details ${student.isExpanded ? 'show' : ''}">
                <div class="form-row-with-notes">
                    <div>
                        <label>Mündliche Note:</label>
                        <select class="form-control" onchange="updateOralGrade(${studentIndex}, this.value)">
                            <option value="">Keine mündliche Note</option>
                            ${Object.keys(gradeConversion).map(grade => `
                                <option value="${grade}" ${student.oralGrade === grade ? 'selected' : ''}>${grade}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <button class="notes-btn" onclick="showStudentNotesModal(${studentIndex}, 'grades')" style="width: 85px;">
                            <i class="fas fa-thumbtack"></i> Notizen
                        </button>
                    </div>
                </div>
        `;
        
        // Projekte-Sektion
        studentDetails += `
            <div style="margin-top: 15px;">
                <label>Projekte:</label>
        `;
        
        if (student.projects.length === 0) {
            studentDetails += `
                <div class="empty-state" style="padding: 20px 0;">
                    <p>Keine Projekte vorhanden</p>
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
                                <select class="form-control" onchange="updateProjectGrade(${studentIndex}, ${projectIndex}, this.value)">
                                    <option value="">Note eingeben</option>
                                    ${Object.keys(gradeConversion).map(grade => `
                                        <option value="${grade}" ${project.grade === grade ? 'selected' : ''}>${grade} ${projectGrade > 0 ? `(${projectGrade.toFixed(2)})` : ''}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div style="flex: 0 0 auto;">
                                <button class="btn btn-sm btn-danger btn-icon btn-square" onclick="deleteProject(${studentIndex}, ${projectIndex})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        // Projekt-Tools mit Projekt hinzufügen und Rechenweg Button
        studentDetails += `
            <div class="project-tools">
                <button class="btn btn-sm btn-success btn-icon" onclick="addProject(${studentIndex})">
                    <i class="fas fa-plus"></i> Projekt hinzufügen
                </button>
                <button class="btn btn-sm btn-warning btn-icon" onclick="toggleCalculation(${studentIndex})">
                    <i class="fas fa-calculator"></i> Rechenweg
                </button>
            </div>
        `;
        
        studentDetails += `</div>`;
        
        // Rechenweg
        studentDetails += `
            <div id="calculation-${studentIndex}" class="calculation"></div>
        `;
        
        studentDetails += `</div>`;
        
        studentCard.innerHTML = studentHeader + studentDetails;
        studentsList.appendChild(studentCard);
    });
}
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

// Funktion für die Punkteverteilung - Calculation Panel umschalten
function toggleCalculationPanel() {
    const content = safeGetElement('calculation-content');
    const toggleIcon = safeGetElement('calculation-toggle-icon');
    
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

// Funktion für die Punkteverteilung - Templates Panel umschalten
function toggleTemplatesPanel() {
    const content = safeGetElement('templates-content');
    const toggleIcon = safeGetElement('templates-toggle-icon');
    
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

// Funktion zur Berechnung und Anzeige der Projektstatistiken - Geändert für ganze Noten
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
        // Keine Noten vorhanden
        averageElement.textContent = '-';
        distributionElement.innerHTML = '';
        emptyStateElement.style.display = 'block';
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
// Projekt hinzufügen
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
    
    classes[activeClassId].students[originalIndex].projects.push({
        name: '',
        grade: ''
    });
    
    saveData();
    renderGradesModule();
    // Projekt-Auswahloptionen aktualisieren
    updateProjectSelectionOptions();
}
// Projektname aktualisieren
function updateProjectName(studentIndex, projectIndex, value) {
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
    
    // Speichere den alten Projektnamen
    const oldProjectName = classes[activeClassId].students[originalIndex].projects[projectIndex].name;
    
    // Aktualisiere den Projektnamen
    classes[activeClassId].students[originalIndex].projects[projectIndex].name = value;
    
    // Wenn das Projekt einen Namen bekommen hat, frage ob es für alle übernommen werden soll
    if (value && value.trim() !== '' && (!oldProjectName || oldProjectName.trim() === '')) {
        swal({
            title: "Projekt für alle übernehmen?",
            text: `Möchtest du das Projekt "${value}" für alle Schüler anlegen?`,
            icon: "question",
            buttons: ["Nein, nur für diesen Schüler", "Ja, für alle Schüler"],
        })
        .then((applyToAll) => {
            if (applyToAll) {
                applyProjectToAllStudents(projectIndex, value);
            }
            saveData();
            renderGradesModule();
        });
    } else {
        saveData();
    }
}
// Projekt für alle Schüler anlegen/aktualisieren
function applyProjectToAllStudents(projectIndex, projectName) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Für jeden Schüler in der Klasse
    classes[activeClassId].students.forEach(student => {
        // Stelle sicher, dass das projects-Array existiert
        if (!student.projects) {
            student.projects = [];
        }
        
        // Wenn der Schüler noch nicht genügend Projekte hat, füge leere Projekte hinzu
        while (student.projects.length <= projectIndex) {
            student.projects.push({
                name: '',
                grade: ''
            });
        }
        
        // Aktualisiere den Projektnamen
        student.projects[projectIndex].name = projectName;
    });
    
    saveData();
    swal("Erfolg", `Projekt "${projectName}" wurde für alle Schüler angelegt.`, "success");
}

// Projektnote aktualisieren
function updateProjectGrade(studentIndex, projectIndex, value) {
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
    
    classes[activeClassId].students[originalIndex].projects[projectIndex].grade = value;
    saveData();
    renderGradesModule();
    // Projektstatistiken aktualisieren, wenn eine Note geändert wird
    updateProjectStatistics();
}

// Projekt löschen
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
                text: "Nur für diesen Schüler",
                value: "one",
            },
            deleteAll: {
                text: "Für alle Schüler",
                value: "all",
            }
        },
        dangerMode: true,
    })
    .then((value) => {
        if (value === "one") {
            // Nur für diesen Schüler löschen
            classes[activeClassId].students[originalIndex].projects.splice(projectIndex, 1);
            saveData();
            renderGradesModule();
            updateProjectSelectionOptions();
            updateProjectStatistics();
            swal("Gelöscht", `Das Projekt wurde für ${student.name} gelöscht.`, "success");
        } else if (value === "all") {
            // Für alle Schüler löschen
            deleteProjectForAllStudents(projectIndex);
        }
    });
}

// Projekt für alle Schüler löschen
function deleteProjectForAllStudents(projectIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Für jeden Schüler in der Klasse
    classes[activeClassId].students.forEach(student => {
        // Stelle sicher, dass das projects-Array existiert
        if (!student.projects) {
            student.projects = [];
        }
        
        // Wenn der Schüler das Projekt hat, lösche es
        if (projectIndex < student.projects.length) {
            student.projects.splice(projectIndex, 1);
        }
    });
    
    saveData();
    renderGradesModule();
    updateProjectSelectionOptions();
    updateProjectStatistics();
    
    swal("Gelöscht", "Das Projekt wurde für alle Schüler gelöscht.", "success");
}
// Mündliche Note aktualisieren
function updateOralGrade(studentIndex, value) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    classes[activeClassId].students[originalIndex].oralGrade = value;
    saveData();
    renderGradesModule();
}

// Funktion zur Umrechnung von Noten
function convertGrade(grade) {
    return gradeConversion[grade] ?? 0;
}

// Endnote berechnen - GEÄNDERT: Berücksichtigt jetzt auch den Fall, wenn nur eine mündliche Note vorhanden ist
function calculateFinalGrade(projects, oralGrade, oralWeight) {
    if (!projects) projects = [];
    
    const weightValue = parseInt(oralWeight) || 50;
    
    // Wenn es eine mündliche Note gibt, aber keine schriftlichen Noten
    if (oralGrade && oralGrade !== '') {
        const oralGradeConverted = convertGrade(oralGrade);
        
        // Präzise Kommanoten für schriftliche Noten verwenden
        const writtenGrades = projects
            .map(project => convertGrade(project.grade))
            .filter(grade => grade > 0);

        // Wenn keine Projektnoten vorhanden sind, nimm die mündliche Note als Endnote
        if (writtenGrades.length === 0) {
            return {
                rounded: roundGrade(oralGradeConverted),
                exact: oralGradeConverted.toFixed(3),
                numeric: oralGradeConverted
            };
        }

        // Wenn Projektnoten vorhanden sind, berechne den Durchschnitt
        const writtenAverage = writtenGrades.reduce((sum, grade) => sum + grade, 0) / writtenGrades.length;
        const finalGrade = (writtenAverage * (100 - weightValue) + oralGradeConverted * weightValue) / 100;
        return {
            rounded: roundGrade(finalGrade),
            exact: finalGrade.toFixed(3),
            numeric: finalGrade
        };
    }
    
    // Präzise Kommanoten für schriftliche Noten verwenden
    const writtenGrades = projects
        .map(project => convertGrade(project.grade))
        .filter(grade => grade > 0);
    
    // Wenn es gar keine Noten gibt (weder mündlich noch schriftlich)
    if (writtenGrades.length === 0) {
        return {
            rounded: 'Keine Noten',
            exact: 'Keine Noten',
            numeric: 0
        };
    }

    // Wenn es nur schriftliche Noten gibt, aber keine mündliche Note
    const writtenAverage = writtenGrades.reduce((sum, grade) => sum + grade, 0) / writtenGrades.length;
    return {
        rounded: roundGrade(writtenAverage),
        exact: writtenAverage.toFixed(3),
        numeric: writtenAverage
    };
}

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

// Rechenweg anzeigen - Geändert für das neue Format
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

// Funktion zur Rundung der Endnote
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

    // Sicherstellen, dass ein gültiger Schlüssel zurückgegeben wird
    return reverseGradeConversion[closestGrade] || 'Keine Note';
}

// Ein-/Ausklappen der Schülerdetails
function toggleStudentDetails(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Zustand umschalten
    classes[activeClassId].students[originalIndex].isExpanded = !classes[activeClassId].students[originalIndex].isExpanded;
    
    // UI aktualisieren
    const detailsDiv = safeGetElement(`studentDetails-${studentIndex}`);
    const toggleIcon = safeGetElement(`toggleIcon-${studentIndex}`);
    
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
}
// Alle Schülerdetails einklappen
function collapseAllStudents() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    // Alle Schüler auf nicht ausgeklappt setzen
    classes[activeClassId].students.forEach(student => {
        student.isExpanded = false;
    });
    
    // UI aktualisieren
    const sortedStudents = getSortedStudents();
    sortedStudents.forEach((student, index) => {
        const detailsDiv = safeGetElement(`studentDetails-${index}`);
        const toggleIcon = safeGetElement(`toggleIcon-${index}`);
        
        if (detailsDiv && toggleIcon) {
            detailsDiv.classList.remove('show');
            toggleIcon.classList.remove('rotate');
        }
    });
    
    saveData();
}

// Funktion zum Setzen der Gewichtung
function setWeight(weight) {
    // Alte aktive Klasse entfernen
    const weightButtons = document.querySelectorAll('.weight-btn');
    if (weightButtons) {
        weightButtons.forEach(btn => {
            btn.classList.remove('active-weight');
        });
    }
    
    // Neue aktive Klasse setzen
    const weightButton = document.querySelector(`.weight-btn[onclick="setWeight(${weight})"]`);
    if (weightButton) {
        weightButton.classList.add('active-weight');
    }
    
    // Wert aktualisieren
    const oralWeightValue = safeGetElement('oralWeightValue');
    if (oralWeightValue) {
        oralWeightValue.innerText = weight;
    }
    
    // Speichern
    localStorage.setItem('oralWeight', weight);
    
    // UI aktualisieren, falls nötig
    if (activeModule === 'noten') {
        renderGradesModule();
        updateProjectStatistics();
    } else if (activeModule === 'uebersicht') {
        renderOverviewModule();
    }
}

// Funktion zum Ein- und Ausblenden der Notentabelle
function toggleGradeTable() {
    const gradeTable = safeGetElement('gradeTable');
    if (!gradeTable) return;
    
    if (gradeTable.style.display === 'none') {
        gradeTable.style.display = 'table';
    } else {
        gradeTable.style.display = 'none';
    }
}
// Anwesenheit Modul rendern
function renderAttendanceModule() {
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    const attendanceList = safeGetElement('attendance-list');
    const presentCount = safeGetElement('present-count');
    const totalCount = safeGetElement('total-count');
    
    if (!attendanceList || !presentCount || !totalCount) return;
    
    // Sort-Button aktualisieren
    const sortBtn = safeGetElement('sort-attendance-btn');
    if (sortBtn) {
        sortBtn.innerHTML = `
            <i class="fas fa-sort-alpha-down"></i> ${cls.attendanceSorted ? 'Sortierung aufheben' : 'Alphabetisch sortieren'}
        `;
        // Farbklasse hinzufügen oder entfernen je nach Zustand
        if (cls.attendanceSorted) {
            sortBtn.classList.add('active-sort');
        } else {
            sortBtn.classList.remove('active-sort');
        }
    }
    
    attendanceList.innerHTML = '';
    
    // Sicherstellen, dass Schüler existieren
    if (!cls.students) {
        cls.students = [];
    }
    
    if (cls.students.length === 0) {
        attendanceList.innerHTML = `
            <li class="empty-state">
                <i class="fas fa-user-graduate"></i>
                <p>Keine Schüler in dieser Klasse</p>
            </li>
        `;
        
        // Zähler aktualisieren
        presentCount.textContent = "0";
        totalCount.textContent = "0";
        
        return;
    }
    
    // Sortierte oder unsortierte Schülerliste
    const studentsToRender = getSortedAttendanceStudents();
    
    // Anwesenheitszähler zurücksetzen
    let presentCounter = 0;
    let totalCounter = 0; // Nur Schüler zählen, die nicht als abwesend markiert sind
    
    studentsToRender.forEach((student, studentIndex) => {
        // Falls noch kein Attendance-Status, initialisieren
        if (!student.attendance) student.attendance = 'none';
        
        if (student.attendance === 'present') {
            presentCounter++;
            totalCounter++; // Anwesende werden gezählt
        } else if (student.attendance !== 'absent') {
            // Nur Nicht-Abwesende werden zu totalCounter hinzugefügt
            totalCounter++;
        }
        
        const attendanceItem = document.createElement('li');
        attendanceItem.className = `attendance-item ${student.attendance}`;
        
        attendanceItem.innerHTML = `
            <div class="name">
                <span class="attendance-badge">${studentIndex + 1}</span> ${student.name}
            </div>
            <div class="attendance-actions">
                <button class="btn btn-sm ${student.attendance === 'present' ? 'btn-success' : 'btn-light'}" 
                        onclick="markAttendance(${studentIndex}, 'present')">
                    <i class="fas fa-check"></i> Anwesend
                </button>
                <button class="btn btn-sm ${student.attendance === 'absent' ? 'btn-danger' : 'btn-light'}" 
                        onclick="markAttendance(${studentIndex}, 'absent')">
                    <i class="fas fa-times"></i> Abwesend
                </button>
            </div>
        `;
        
        attendanceList.appendChild(attendanceItem);
    });
    
    // Zähler aktualisieren
    presentCount.textContent = presentCounter.toString();
    totalCount.textContent = totalCounter.toString();
}

// Sortierung der Anwesenheitsliste umschalten
function toggleSortAttendance() {
    if (!classes[activeClassId]) return;
    
    classes[activeClassId].attendanceSorted = !classes[activeClassId].attendanceSorted;
    saveData();
    renderAttendanceModule();
}
// Anwesenheit markieren - Geändert für die abwesend-zu-anwesend Bestätigung
function markAttendance(studentIndex, status) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedAttendanceStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    // Sicherstellen, dass attendance-Eigenschaft existiert
    if (!classes[activeClassId].students[originalIndex].attendance) {
        classes[activeClassId].students[originalIndex].attendance = 'none';
    }
    
    const currentStatus = classes[activeClassId].students[originalIndex].attendance;
    
    // Wenn der Schüler bereits den gewünschten Status hat
    if (currentStatus === status) {
        // Wenn auf "abwesend" geklickt wird und der Schüler bereits abwesend ist, Bestätigung verlangen
        if (status === 'absent') {
            swal({
                title: "Anwesenheit zurücksetzen?",
                text: `Möchtest du den Status von ${student.name} wirklich zurücksetzen?`,
                icon: "warning",
                buttons: ["Abbrechen", "Ja, zurücksetzen"],
                dangerMode: false,
            })
            .then((willChange) => {
                if (willChange) {
                    classes[activeClassId].students[originalIndex].attendance = 'none';
                    saveData();
                    renderAttendanceModule();
                }
            });
        } else if (status === 'present') {
            // Für anwesende Schüler, direkt zurücksetzen ohne Bestätigung
            classes[activeClassId].students[originalIndex].attendance = 'none';
            saveData();
            renderAttendanceModule();
        }
    } else {
        // Wenn von "abwesend" zu "anwesend" gewechselt werden soll, Bestätigung verlangen
        if (currentStatus === 'absent' && status === 'present') {
            swal({
                title: "Auf Anwesend setzen?",
                text: `Bist du sicher, dass ${student.name} jetzt anwesend ist?`,
                icon: "question",
                buttons: ["Abbrechen", "Ja, anwesend"],
                dangerMode: false,
            })
            .then((willChange) => {
                if (willChange) {
                    classes[activeClassId].students[originalIndex].attendance = status;
                    saveData();
                    renderAttendanceModule();
                }
            });
        } else {
            // In allen anderen Fällen direkt ändern
            classes[activeClassId].students[originalIndex].attendance = status;
            saveData();
            renderAttendanceModule();
        }
    }
}

// Schnelles Zurücksetzen der Anwesenheit (nur Anwesende zurücksetzen)
function quickResetAttendance() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    classes[activeClassId].students.forEach(student => {
        if (student.attendance === 'present') {
            student.attendance = 'none';
        }
    });
    saveData();
    renderAttendanceModule();
}

// Vollständiges Zurücksetzen der Anwesenheit
function fullResetAttendance() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    swal({
        title: "Vollständig zurücksetzen?",
        text: "Möchtest du alle Anwesenheiten zurücksetzen? Auch die abwesenden Schüler werden auf 'unbekannt' gesetzt.",
        icon: "warning",
        buttons: ["Abbrechen", "Zurücksetzen"],
        dangerMode: true,
    })
    .then((willReset) => {
        if (willReset) {
            classes[activeClassId].students.forEach(student => {
                student.attendance = 'none';
            });
            saveData();
            renderAttendanceModule();
        }
    });
}

// Sitzplan Modul rendern
function renderSeatingModule() {
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    const seatingChart = safeGetElement('seating-chart');
    
    if (!seatingChart) return;
    
    if (cls.seatingChart) {
        seatingChart.innerHTML = `
            <img src="${cls.seatingChart}" alt="Sitzplan" />
            <div style="text-align: center; margin-top: 15px;">
                <button class="btn btn-danger btn-icon" onclick="deleteSeatingChart()">
                    <i class="fas fa-trash"></i> Sitzplan löschen
                </button>
            </div>
        `;
    } else {
        seatingChart.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chair"></i>
                <p>Kein Sitzplan vorhanden</p>
            </div>
        `;
    }
}

// Funktion zum Löschen des Sitzplans
function deleteSeatingChart() {
    if (!classes[activeClassId]) return;
    
    swal({
        title: "Sitzplan löschen?",
        text: "Möchtest du den aktuellen Sitzplan wirklich löschen?",
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            classes[activeClassId].seatingChart = null;
            saveData();
            renderSeatingModule();
            
            swal("Gelöscht", "Der Sitzplan wurde erfolgreich gelöscht", "success");
        }
    });
}

// Sitzplan hochladen
function uploadSeatingChart(event) {
    if (!classes[activeClassId]) return;
    if (!event || !event.target || !event.target.files || !event.target.files[0]) return;
    
    const file = event.target.files[0];
    
    if (!file.type.startsWith('image/')) {
        swal("Fehler", "Bitte wähle ein Bild aus (JPG, PNG, etc.)", "error");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        if (!e || !e.target || !e.target.result) return;
        
        classes[activeClassId].seatingChart = e.target.result;
        saveData();
        renderSeatingModule();
        
        swal("Erfolg", "Sitzplan wurde hochgeladen", "success");
    };
    reader.readAsDataURL(file);
}
// Sortierte Listen
function getSortedLists() {
    if (!classes[activeClassId] || !classes[activeClassId].lists) {
        return [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.listsSorted) {
        return [...cls.lists].sort((a, b) => {
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
        });
    }
    
    return cls.lists;
}

// Sortierte Schüler für Listen (wenn Listeneinträge sortiert werden sollen)
function getSortedListStudents() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        return [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.listsSorted) {
        return [...cls.students].sort((a, b) => {
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
        });
    }
    
    return cls.students;
}

// Listen Modul rendern
function renderListsModule() {
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    const listsTabNav = safeGetElement('lists-tab-nav');
    const listsContainer = safeGetElement('lists-container');
    
    if (!listsTabNav || !listsContainer) return;
    
    // Sort-Button aktualisieren
    const sortBtn = safeGetElement('sort-lists-btn');
    if (sortBtn) {
        sortBtn.innerHTML = `
            <i class="fas fa-sort-alpha-down"></i> ${cls.listsSorted ? 'Sortierung aufheben' : 'Alphabetisch sortieren'}
        `;
        // Farbklasse hinzufügen oder entfernen je nach Zustand
        if (cls.listsSorted) {
            sortBtn.classList.add('active-sort');
        } else {
            sortBtn.classList.remove('active-sort');
        }
    }
    
    listsTabNav.innerHTML = '';
    listsContainer.innerHTML = '';
    
    // Sicherstellen, dass Listen existieren
    if (!cls.lists) {
        cls.lists = [];
    }
    
    if (cls.lists.length === 0) {
        listsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <p>Keine Listen vorhanden</p>
            </div>
        `;
        return;
    }
    
    // Sortierte oder unsortierte Listen
    const listsToRender = getSortedLists();
    
    // Tabs für jede Liste erstellen
    listsToRender.forEach((list, listIndex) => {
        const tabLink = document.createElement('a');
        tabLink.href = 'javascript:void(0)';
        tabLink.className = `tab-link ${activeListId === listIndex ? 'active' : ''}`;
        tabLink.textContent = list.name;
        tabLink.onclick = () => showList(listIndex);
        
        listsTabNav.appendChild(tabLink);
        
        // Listen-Content erstellen
        const listContent = document.createElement('div');
        listContent.id = `list-${listIndex}`;
        listContent.className = `tab-content ${activeListId === listIndex ? 'active' : ''}`;
        
        let listHtml = `
            <div class="list-actions">
                <button class="btn btn-primary btn-icon btn-square" onclick="editList(${listIndex})">
                    <i class="fas fa-edit"></i>
                </button>
                 <button class="btn btn-danger btn-icon btn-square" onclick="deleteList(${listIndex})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Checkliste erstellen
        listHtml += `<ul class="checklist">`;
        
        if (!cls.students || cls.students.length === 0) {
            listHtml += `
                <li class="empty-state" style="padding: 20px 0;">
                    <p>Keine Schüler in dieser Klasse</p>
                </li>
            `;
        } else {
            // Sortierte oder unsortierte Schülerliste für den Listeninhalt
            const studentsToRender = getSortedListStudents();
            
            studentsToRender.forEach((student) => {
                const checked = list.checked && list.checked[student.name];
                
                listHtml += `
                    <li class="checklist-item ${checked ? 'checked' : ''}">
                        <label>
                            <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleChecklistItem('${list.name}', '${student.name}', this.checked)">
                            ${student.name}
                        </label>
                    </li>
                `;
            });
        }
        
        listHtml += `</ul>`;
        
        listContent.innerHTML = listHtml;
        listsContainer.appendChild(listContent);
    });
    
    // Falls keine aktive Liste, die erste anzeigen
    if (activeListId === null || !cls.lists[activeListId]) {
        if (cls.lists.length > 0) {
            showList(0);
        } else {
            activeListId = null;
        }
    }
}
// Liste anzeigen
function showList(listIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].lists) return;
    
    const listsToRender = getSortedLists();
    if (listIndex < 0 || listIndex >= listsToRender.length) return;
    
    // Aktive Tabs und Inhalte deaktivieren
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (tabLinks) {
        tabLinks.forEach(tab => tab.classList.remove('active'));
    }
    
    if (tabContents) {
        tabContents.forEach(content => content.classList.remove('active'));
    }
    
    // Neue aktive Elemente aktivieren
    const listToShow = listsToRender[listIndex];
    const originalIndex = classes[activeClassId].lists.findIndex(list => list.name === listToShow.name);
    
    const newActiveTab = document.querySelector(`.tab-link:nth-child(${listIndex + 1})`);
    const newActiveContent = safeGetElement(`list-${listIndex}`);
    
    if (newActiveTab) {
        newActiveTab.classList.add('active');
    }
    
    if (newActiveContent) {
        newActiveContent.classList.add('active');
    }
    
    activeListId = originalIndex;
}

// Neue Liste erstellen
function createList() {
    if (!classes[activeClassId]) return;
    
    const listNameInput = safeGetElement('new-list-name');
    if (!listNameInput) return;
    
    const listName = listNameInput.value.trim();
    
    if (!listName) {
        swal("Fehler", "Bitte gib einen Namen für die Liste ein", "error");
        return;
    }
    
    // Sicherstellen, dass das lists-Array existiert
    if (!classes[activeClassId].lists) {
        classes[activeClassId].lists = [];
    }
    
    const newList = {
        name: listName,
        checked: {}
    };
    
    classes[activeClassId].lists.push(newList);
    saveData();
    hideModal();
    
    // Feld zurücksetzen
    listNameInput.value = '';
    
    // Listen neu rendern und neue Liste anzeigen
    activeListId = classes[activeClassId].lists.length - 1;
    renderListsModule();
    
    swal("Erfolg", `Liste "${listName}" wurde erstellt`, "success");
}

// Liste bearbeiten
function editList(listIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].lists) return;
    
    const listsToRender = getSortedLists();
    if (listIndex < 0 || listIndex >= listsToRender.length) return;
    
    const list = listsToRender[listIndex];
    const originalIndex = classes[activeClassId].lists.findIndex(l => l.name === list.name);
    
    if (originalIndex === -1) return;
    
    swal({
        title: "Liste umbenennen",
        text: "Neuer Name für die Liste:",
        content: {
            element: "input",
            attributes: {
                placeholder: "Listenname",
                value: list.name
            }
        },
        buttons: ["Abbrechen", "Speichern"],
    })
    .then((newName) => {
        if (newName) {
            classes[activeClassId].lists[originalIndex].name = newName.trim();
            saveData();
            renderListsModule();
        }
    });
}

// Liste löschen
function deleteList(listIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].lists) return;
    
    const listsToRender = getSortedLists();
    if (listIndex < 0 || listIndex >= listsToRender.length) return;
    
    const list = listsToRender[listIndex];
    const originalIndex = classes[activeClassId].lists.findIndex(l => l.name === list.name);
    
    if (originalIndex === -1) return;
    
    swal({
        title: "Liste löschen?",
        text: `Möchtest du die Liste "${list.name}" wirklich löschen?`,
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            classes[activeClassId].lists.splice(originalIndex, 1);
            
            // Falls keine Listen mehr vorhanden, activeListId zurücksetzen
            if (classes[activeClassId].lists.length === 0) {
                activeListId = null;
            } else if (activeListId >= classes[activeClassId].lists.length) {
                activeListId = classes[activeClassId].lists.length - 1;
            }
            
            saveData();
            renderListsModule();
            
            swal("Gelöscht", "Die Liste wurde erfolgreich gelöscht", "success");
        }
    });
}

// Checklisteneintrag umschalten
function toggleChecklistItem(listName, studentName, checked) {
    if (!classes[activeClassId] || !classes[activeClassId].lists) return;
    
    const listIndex = classes[activeClassId].lists.findIndex(list => list.name === listName);
    
    if (listIndex === -1) return;
    
    // Sicherstellen, dass das checked-Objekt existiert
    if (!classes[activeClassId].lists[listIndex].checked) {
        classes[activeClassId].lists[listIndex].checked = {};
    }
    
    classes[activeClassId].lists[listIndex].checked[studentName] = checked;
    saveData();
    
    // UI-Update ohne vollständiges Neurendern
    try {
        // Finde den passenden Index in der sortierten Liste
        const sortedLists = getSortedLists();
        const sortedIndex = sortedLists.findIndex(list => list.name === listName);
        
        if (sortedIndex !== -1) {
            // Finde das Element im DOM
            const listContentElement = safeGetElement(`list-${sortedIndex}`);
            if (listContentElement) {
                // Suche alle li-Elemente, die den studentName enthalten
                const items = listContentElement.querySelectorAll('.checklist-item');
                
                if (items) {
                    for (const item of items) {
                        const label = item.querySelector('label');
                        if (label && label.textContent.trim() === studentName) {
                            // Klasse aktualisieren
                            if (checked) {
                                item.classList.add('checked');
                            } else {
                                item.classList.remove('checked');
                            }
                            break;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Fehler beim UI-Update:", error);
        // Fallback: Vollständig neu rendern
        renderListsModule();
    }
}

// Sortierung der Listenliste umschalten
function toggleSortLists() {
    if (!classes[activeClassId]) return;
    
    classes[activeClassId].listsSorted = !classes[activeClassId].listsSorted;
    
    // Aktualisiere den Button-Stil sofort
    const sortBtn = safeGetElement('sort-lists-btn');
    if (sortBtn) {
        if (classes[activeClassId].listsSorted) {
            sortBtn.classList.add('active-sort');
        } else {
            sortBtn.classList.remove('active-sort');
        }
    }
    
    saveData();
    renderListsModule();
}

// Sortierte Übersichtsliste
function getSortedOverviewStudents() {
    if (!classes[activeClassId] || !classes[activeClassId].students) {
        return [];
    }
    
    const cls = classes[activeClassId];
    
    if (cls.overviewSorted) {
        return [...cls.students].sort((a, b) => {
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
        });
    }
    
    return cls.students;
}

// Übersicht Modul rendern - GEÄNDERT für neue Tabellenstruktur
function renderOverviewModule() {
    if (!classes[activeClassId]) return;
    
    const overviewTable = safeGetElement('overview-table-body');
    const emptyState = safeGetElement('overview-empty-state');
    
    if (!overviewTable || !emptyState) return;
    
    overviewTable.innerHTML = '';
    
    const cls = classes[activeClassId];
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    // Sort-Button aktualisieren
    const sortBtn = safeGetElement('sort-overview-btn');
    if (sortBtn) {
        sortBtn.innerHTML = `
            <i class="fas fa-sort-alpha-down"></i> ${cls.overviewSorted ? 'Sortierung aufheben' : 'Alphabetisch sortieren'}
        `;
        // Farbklasse hinzufügen oder entfernen je nach Zustand
        if (cls.overviewSorted) {
            sortBtn.classList.add('active-sort');
        } else {
            sortBtn.classList.remove('active-sort');
        }
    }
    
    if (!cls.students || cls.students.length === 0) {
        // Empty state außerhalb der Tabelle anzeigen
        emptyState.style.display = 'block';
        return;
    } else {
        emptyState.style.display = 'none';
    }
    
    // Sortierte oder unsortierte Schülerliste
    const studentsToRender = getSortedOverviewStudents();
    
    studentsToRender.forEach((student, studentIndex) => {
        if (!student.projects) {
            student.projects = [];
        }
        
        // Anzahl der wichtigen Notizen für Badge
        const notesCount = student.notes ? student.notes.filter(note => note.important).length : 0;
        
        const finalGrade = calculateFinalGrade(student.projects, student.oralGrade, oralWeight);
        const homework = student.homework || 0;
        const homeworkPartial = student.homeworkPartial || 0;
        const totalHw = homework + (homeworkPartial / 2);
        const materials = student.materials || 0;
        
        const tr = document.createElement('tr');
        
        // 1. Spalte: Schülername
        tr.innerHTML = `<td>${student.name}</td>`;
        
        // 2. Spalte: GEÄNDERT - Alle einzelnen Projektnoten mit Zeilenumbruch
        let projectsHtml = '';
        if (student.projects && student.projects.length > 0) {
            student.projects.forEach((project, idx) => {
                if (project.grade) {
                    const numericGrade = convertGrade(project.grade);
                    const gradeClass = getGradeColorClass(numericGrade);
                    // Jedes Projekt in einer neuen Zeile
                    projectsHtml += `
                        <div class="project-grade-item">
                            ${project.name || `P${idx+1}`}: <span class="badge ${gradeClass}">${project.grade}</span> (${numericGrade.toFixed(2)})
                        </div>
                    `;
                }
            });
        }
        
        if (projectsHtml === '') {
            projectsHtml = '<span class="badge badge-secondary">Keine</span>';
        }
        
        tr.innerHTML += `<td class="overview-projects-cell">${projectsHtml}</td>`;
        
        // 3. Spalte: GEÄNDERT - Projekte Durchschnitt
        if (student.projects && student.projects.length > 0) {
            const projectGrades = student.projects
                .map(project => convertGrade(project.grade))
                .filter(grade => grade > 0);
            
            if (projectGrades.length > 0) {
                const projectAverage = projectGrades.reduce((sum, grade) => sum + grade, 0) / projectGrades.length;
                const projectGradeClass = getGradeColorClass(projectAverage);
                const roundedProjectGrade = roundGrade(projectAverage);
                tr.innerHTML += `<td><span class="badge ${projectGradeClass}">${roundedProjectGrade}</span> (${projectAverage.toFixed(2)})</td>`;
            } else {
                tr.innerHTML += `<td><span class="badge badge-secondary">Keine</span></td>`;
            }
        } else {
            tr.innerHTML += `<td><span class="badge badge-secondary">Keine</span></td>`;
        }
        
        // 4. Spalte: GEÄNDERT - Notizen Button (zentriert)
        tr.innerHTML += `
            <td class="text-center">
                <button class="notes-overview-btn" onclick="showStudentNotesModal(${studentIndex}, 'overview')" style="position:relative;margin:0 auto;">
                    <i class="fas fa-thumbtack"></i>
                </button>
            </td>
        `;
        
        // 5. Spalte: Mündliche Note
        if (student.oralGrade) {
            const oralGradeValue = convertGrade(student.oralGrade);
            const oralGradeClass = getGradeColorClass(oralGradeValue);
            tr.innerHTML += `<td><span class="badge ${oralGradeClass}">${student.oralGrade}</span> (${oralGradeValue.toFixed(2)})</td>`;
        } else {
            tr.innerHTML += `<td><span class="badge badge-secondary">Keine</span></td>`;
        }
        
        // 6. Spalte: Berechnete Note
if (finalGrade.numeric > 0) {
    const gradeClass = getGradeColorClass(finalGrade.numeric);
    tr.innerHTML += `
        <td>
            <span class="badge ${gradeClass}">${finalGrade.rounded}</span> (${finalGrade.exact})
        </td>
    `;
} else {
    tr.innerHTML += `<td><span class="badge badge-secondary">Keine</span></td>`;
}

// 7. Spalte: Rechenweg (NEU)
if (finalGrade.numeric > 0) {
    tr.innerHTML += `
        <td>
            <button class="btn-calc-path" onclick="showCalculationPathModal(${studentIndex})">
                <i class="fas fa-calculator"></i>
            </button>
        </td>
    `;
} else {
    tr.innerHTML += `<td>-</td>`;
}
        
        // 8. Spalte: Hausaufgaben
        tr.innerHTML += `<td>${totalHw.toFixed(1)}</td>`;
        
        // 9. Spalte: Material
        tr.innerHTML += `<td>${materials}</td>`;
        
        // 10. Spalte: Individuelle Note
        if (student.individualGrade) {
            const indGradeClass = getGradeColorClass(convertGrade(student.individualGrade));
            tr.innerHTML += `
                <td>
                    <span class="badge ${indGradeClass}">${student.individualGrade}</span>
                    ${student.individualGradeComment ? `<i class="fas fa-info-circle" title="${student.individualGradeComment}"></i>` : ''}
                </td>
            `;
        } else {
            tr.innerHTML += `<td><span class="badge badge-secondary">Keine</span></td>`;
        }
        
        // 11. Spalte: Aktionen
        tr.innerHTML += `
            <td>
                <button class="btn btn-sm btn-primary btn-square" style="width: 36px; height: 36px;" onclick="showIndividualGradeModal(${studentIndex})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        
        overviewTable.appendChild(tr);
    });
}

// NEU: Funktion zum Anzeigen des Rechenweg-Modals in der Übersicht
function showCalculationPathModal(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedOverviewStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    
    // Studentennamen im Modal setzen
    const studentNameElement = safeGetElement('calculation-path-student-name');
    if (studentNameElement) {
        studentNameElement.textContent = `Schüler: ${student.name}`;
    }
    
    // Rechenweg-Inhalt bestimmen und setzen
    const calculationContent = safeGetElement('calculation-path-content');
    if (calculationContent) {
        // Nutze die vorhandene Funktion mit einer Adaption für die Übersicht
        // Aber passe den Index entsprechend an (vom sortierten zum originalen Index)
        const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
        if (originalIndex !== -1) {
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
                calculationContent.innerHTML = 'Keine Noten vorhanden.';
            } else {
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

                calculationContent.innerHTML = calculationText;
            }
        }
    }
    
    // Modal anzeigen
    showModal('calculation-path-modal');
}

// Sortierung der Übersichtsliste umschalten
function toggleSortOverview(event) {
    if (!classes[activeClassId]) return;
    
    // Verhindern, dass das Ereignis weiter propagiert
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    
    classes[activeClassId].overviewSorted = !classes[activeClassId].overviewSorted;
    saveData();
    renderOverviewModule();
}
// Individuelle Note Modal anzeigen
function showIndividualGradeModal(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedOverviewStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    
    // Modal-Felder aktualisieren
    const studentNameElement = safeGetElement('individual-grade-student-name');
    const gradeSelect = safeGetElement('individual-grade-select');
    const commentTextarea = safeGetElement('individual-grade-comment');
    const modalElement = safeGetElement('individual-grade-modal');
    
    if (!studentNameElement || !gradeSelect || !commentTextarea || !modalElement) return;
    
    studentNameElement.textContent = `Schüler: ${student.name}`;
    gradeSelect.value = student.individualGrade || '';
    commentTextarea.value = student.individualGradeComment || '';
    
    // Index für späteren Gebrauch speichern
    modalElement.dataset.studentIndex = studentIndex;
    
    showModal('individual-grade-modal');
}

// Individuelle Note speichern
function saveIndividualGrade() {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const modalElement = safeGetElement('individual-grade-modal');
    if (!modalElement) return;
    
    const studentIndex = modalElement.dataset.studentIndex;
    if (studentIndex === undefined) return;
    
    const studentsArray = getSortedOverviewStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    const gradeSelect = safeGetElement('individual-grade-select');
    const commentTextarea = safeGetElement('individual-grade-comment');
    
    if (!gradeSelect || !commentTextarea) return;
    
    const gradeValue = gradeSelect.value;
    const gradeComment = commentTextarea.value;
    
    classes[activeClassId].students[originalIndex].individualGrade = gradeValue || null;
    classes[activeClassId].students[originalIndex].individualGradeComment = gradeComment;
    
    saveData();
    hideModal();
    renderOverviewModule();
}
// NEU: Modal für Schülernotizen anzeigen
function showStudentNotesModal(studentIndex, sourceTab) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    let studentsArray;
    
    // Je nach Tab die richtige sortierte Schülerliste verwenden
    if (sourceTab === 'homework') {
        studentsArray = getSortedHomeworkStudents();
    } else if (sourceTab === 'grades') {
        studentsArray = getSortedStudents();
    } else if (sourceTab === 'overview') {
        studentsArray = getSortedOverviewStudents();
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
    
    // Wenn vom Übersichtstab aufgerufen, Eingabeformular verstecken
    const notesForm = document.querySelector('.student-notes-form');
    if (notesForm) {
        notesForm.style.display = sourceTab === 'overview' ? 'none' : 'block';
    }
    
    showModal('student-notes-modal');
}

// NEU: Notizen für einen Schüler rendern - GEÄNDERT: Ausrufezeichen statt Reißzwecke
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

// NEU: Notiz zu einem Schüler hinzufügen
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
    if (sourceTab === 'homework') {
        renderHomeworkModule();
    } else if (sourceTab === 'grades') {
        renderGradesModule();
    } else if (sourceTab === 'overview') {
        renderOverviewModule();
    }
}

// NEU: Notizvorlage verwenden
function useNoteTemplate(templateText) {
    const newNoteTextarea = safeGetElement('new-student-note-content');
    if (newNoteTextarea) {
        newNoteTextarea.value = templateText;
        newNoteTextarea.focus();
    }
}

// NEU: Wichtigkeit einer Notiz umschalten
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
    
    // UI in allen Modulen aktualisieren
    if (activeModule === 'hausaufgaben') {
        renderHomeworkModule();
    } else if (activeModule === 'noten') {
        renderGradesModule();
    } else if (activeModule === 'uebersicht') {
        renderOverviewModule();
    }
}

// NEU: Notiz löschen
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
            
            // UI in allen Modulen aktualisieren
            if (activeModule === 'hausaufgaben') {
                renderHomeworkModule();
            } else if (activeModule === 'noten') {
                renderGradesModule();
            } else if (activeModule === 'uebersicht') {
                renderOverviewModule();
            }
            
            swal("Gelöscht", "Die Notiz wurde erfolgreich gelöscht", "success");
        }
    });
}
// Übersicht als Text exportieren - GEÄNDERT für neues Format
function exportOverviewAsText() {
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    const oralWeightElement = safeGetElement('oralWeightValue');
    const oralWeight = oralWeightElement ? parseInt(oralWeightElement.innerText) : 50;
    
    if (!cls.students || cls.students.length === 0) return;
    
    // Text-Überschrift und Datum
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE');
    let text = `Klassenübersicht: ${cls.name}\nDatum: ${dateStr}\n\n`;
    
    // Schülerdaten nach neuem Format
    cls.students.forEach(student => {
        if (!student.projects) {
            student.projects = [];
        }
        
        const finalGrade = calculateFinalGrade(student.projects, student.oralGrade, oralWeight);
        const homework = student.homework || 0;
        const homeworkPartial = student.homeworkPartial || 0;
        const totalHw = homework + (homeworkPartial / 2);
        const materials = student.materials || 0;
        
        // Schüler-Header
        text += `=======================================\n`;
        text += `SCHÜLER: ${student.name}\n`;
        text += `=======================================\n\n`;
        
        // Projekt-Noten auflisten
        text += `Projekt - Noten:\n`;
        if (student.projects.length === 0) {
            text += `Keine Projekte vorhanden\n\n`;
        } else {
            student.projects.forEach(project => {
                const projectName = project.name || 'Unbenanntes Projekt';
                const projectGrade = project.grade || 'Keine Note';
                const numericGrade = convertGrade(project.grade);
                if (numericGrade > 0) {
                    text += `- ${projectName}: ${projectGrade} (${numericGrade.toFixed(2)})\n`;
                } else {
                    text += `- ${projectName}: ${projectGrade}\n`;
                }
            });
            text += `\n`;
            
            // Projekt-Durchschnitt berechnen - mit präzisen Kommanoten
            const projectGrades = student.projects
                .map(project => convertGrade(project.grade))
                .filter(grade => grade > 0);
            
            if (projectGrades.length > 0) {
                const writtenAverage = projectGrades.reduce((sum, grade) => sum + grade, 0) / projectGrades.length;
                const roundedProjectAverage = roundGrade(writtenAverage);
                
                text += `Projekt - Durchschnitt: (${projectGrades.map(g => g.toFixed(2)).join(' + ')}) / ${projectGrades.length} = ${writtenAverage.toFixed(3)}\n`;
                text += `Gerundeter Projekt-Durchschnitt: ${roundedProjectAverage}\n`;
                
                // Mündliche Note - wenn vorhanden
                if (student.oralGrade) {
                    const oralGradeConverted = convertGrade(student.oralGrade);
                    text += `Mündliche Note: ${student.oralGrade} (${oralGradeConverted.toFixed(2)})\n`;
                    text += `Gewichtung: ${oralWeight}% mündlich, ${100 - oralWeight}% schriftlich\n`;
                    
                    // Berechnung der Endnote
                    const finalGradeValue = (writtenAverage * (100 - oralWeight) / 100 + oralGradeConverted * oralWeight / 100);
                    text += `Berechnung: (${writtenAverage.toFixed(3)} * ${(100 - oralWeight) / 100} + ${oralGradeConverted.toFixed(2)} * ${oralWeight / 100}) = ${finalGradeValue.toFixed(3)}\n`;
                    text += `Gerundete Endnote: ${roundGrade(finalGradeValue)}\n`;
                } else {
                    text += `Keine mündliche Note vorhanden.\n`;
                    text += `Gerundete Endnote: ${roundedProjectAverage}\n`;
                }
            }
        }
        
        text += `\nHausaufgaben und Material:\n`;
        text += `  Vergessene Hausaufgaben: ${totalHw.toFixed(1)}\n`;
        text += `  Vergessenes Material: ${materials}\n\n`;
        
        // Individuelle Note
        text += `Individuelle Note: `;
        if (student.individualGrade) {
            text += `${student.individualGrade}\n`;
            if (student.individualGradeComment) {
                text += `Begründung: ${student.individualGradeComment}\n`;
            }
        } else {
            text += `Keine\n`;
        }
        
        // NEU: Notizen hinzufügen
        if (student.notes && student.notes.length > 0) {
            text += `\nNotizen:\n`;
            student.notes.forEach(note => {
                const noteDate = new Date(note.date);
                const formattedDate = noteDate.toLocaleDateString('de-DE');
                text += `- ${formattedDate}: ${note.content}${note.important ? ' [WICHTIG]' : ''}\n`;
            });
        }
        
        text += `\n\n`;
    });
    
    // Download anbieten
    try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cls.name}_Übersicht.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Fehler beim Erstellen des Exports:", error);
        swal("Fehler", "Beim Exportieren ist ein Fehler aufgetreten.", "error");
    }
}

// Klassennotizen Modul rendern
function renderClassNotesModule() {
    if (!classes[activeClassId]) return;
    
    const cls = classes[activeClassId];
    const notesContainer = safeGetElement('class-notes-container');
    const attachmentsContainer = safeGetElement('class-attachments-container');
    
    if (!notesContainer || !attachmentsContainer) return;
    
    // Notizen-Container leeren
    notesContainer.innerHTML = '';
    
    // Sicherstellen, dass die classNotes existieren
    if (!cls.classNotes) {
        cls.classNotes = [];
    }
    
    // Klassennotizen anzeigen oder Empty State
    if (cls.classNotes.length > 0) {
        cls.classNotes.forEach((note, index) => {
            const noteItem = document.createElement('div');
            noteItem.className = 'class-note-item';
            
            // Datum formatieren
            let formattedDate = '';
            try {
                const noteDate
                = new Date(note.date);
                formattedDate = noteDate.toLocaleDateString('de-DE') + ' ' + noteDate.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'});
            } catch (error) {
                formattedDate = 'Datum unbekannt';
                console.error("Fehler beim Formatieren des Datums:", error);
            }
            
            noteItem.innerHTML = `
                <div class="class-note-title">
                    ${note.title || 'Unbenannte Notiz'}
                    <div class="class-note-actions">
                        <button class="btn btn-sm btn-danger btn-square" onclick="deleteClassNote(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="class-note-content">${note.content || ''}</div>
                <div class="class-note-meta">
                    <span>${formattedDate}</span>
                </div>
            `;
            
            notesContainer.appendChild(noteItem);
        });
    } else {
        notesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sticky-note"></i>
                <p>Keine Notizen vorhanden</p>
            </div>
        `;
    }
    
    // Anhänge-Container leeren
    attachmentsContainer.innerHTML = '';
    
    // Sicherstellen, dass die attachments existieren
    if (!cls.attachments) {
        cls.attachments = [];
    }
    
    // Anhänge anzeigen oder Empty State
    if (cls.attachments.length > 0) {
        cls.attachments.forEach((attachment, index) => {
            const attachmentItem = document.createElement('div');
            attachmentItem.className = 'attachment-item';
            
            // Datum formatieren
            let formattedDate = '';
            try {
                const attachmentDate = new Date(attachment.date);
                formattedDate = attachmentDate.toLocaleDateString('de-DE');
            } catch (error) {
                formattedDate = 'Datum unbekannt';
                console.error("Fehler beim Formatieren des Datums:", error);
            }
            
            attachmentItem.innerHTML = `
                <img src="${attachment.data}" alt="Anhang" />
                <div class="attachment-overlay">
                    <div class="attachment-name">${formattedDate}</div>
                    <div class="attachment-actions">
                        <button class="btn btn-sm btn-danger" onclick="deleteClassAttachment(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            attachmentsContainer.appendChild(attachmentItem);
        });
    } else {
        attachmentsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-image"></i>
                <p>Keine Bilder hochgeladen</p>
            </div>
        `;
    }
}
// Klassennotiz hinzufügen - Modal anzeigen
function addClassNote() {
    // Modal-Felder zurücksetzen
    const titleInput = safeGetElement('new-class-note-title');
    const contentTextarea = safeGetElement('new-class-note-content');
    
    if (titleInput) titleInput.value = '';
    if (contentTextarea) contentTextarea.value = '';
    
    showModal('add-class-note-modal');
}

// Klassennotiz speichern
function saveClassNote() {
    if (!classes[activeClassId]) return;
    
    const contentTextarea = safeGetElement('new-class-note-content');
    
    if (!contentTextarea) return;
    
    const content = contentTextarea.value.trim();
    
    if (!content) {
        swal("Fehler", "Bitte gib einen Inhalt für die Notiz ein", "error");
        return;
    }
    
    // Create formatted date with leading zeros
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = now.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;
    
    // Create new note with the properly formatted date as title
    const newNote = {
        title: formattedDate,
        content: content,
        date: now.toISOString()
    };
    
    // Ensure classNotes array exists
    if (!classes[activeClassId].classNotes) {
        classes[activeClassId].classNotes = [];
    }
    
    // Add note to the beginning of the array
    classes[activeClassId].classNotes.unshift(newNote);
    
    saveData();
    hideModal();
    renderClassNotesModule();
    
    swal("Erfolg", "Notiz wurde gespeichert", "success");
}

// Klassennotiz löschen
function deleteClassNote(noteIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].classNotes) return;
    if (noteIndex < 0 || noteIndex >= classes[activeClassId].classNotes.length) return;
    
    swal({
        title: "Notiz löschen?",
        text: "Möchtest du diese Notiz wirklich löschen?",
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            classes[activeClassId].classNotes.splice(noteIndex, 1);
            saveData();
            renderClassNotesModule();
            
            swal("Gelöscht", "Die Notiz wurde erfolgreich gelöscht", "success");
        }
    });
}

// Klassenbild hochladen
function uploadClassAttachment(event) {
    if (!classes[activeClassId]) return;
    if (!event || !event.target || !event.target.files || !event.target.files[0]) return;
    
    const file = event.target.files[0];
    
    if (!file.type.startsWith('image/')) {
        swal("Fehler", "Bitte wähle ein Bild aus (JPG, PNG, etc.)", "error");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        if (!e || !e.target || !e.target.result) return;
        
        const newAttachment = {
            data: e.target.result,
            date: new Date().toISOString()
        };
        
        // Sicherstellen, dass attachments initialisiert ist
        if (!classes[activeClassId].attachments) {
            classes[activeClassId].attachments = [];
        }
        
        // Bild hinzufügen
        classes[activeClassId].attachments.unshift(newAttachment);
        
        saveData();
        renderClassNotesModule();
        
        swal("Erfolg", "Bild wurde hochgeladen", "success");
    };
    reader.readAsDataURL(file);
}

// Klassenbild löschen
function deleteClassAttachment(attachmentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].attachments) return;
    if (attachmentIndex < 0 || attachmentIndex >= classes[activeClassId].attachments.length) return;
    
    swal({
        title: "Bild löschen?",
        text: "Möchtest du dieses Bild wirklich löschen?",
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            classes[activeClassId].attachments.splice(attachmentIndex, 1);
            saveData();
            renderClassNotesModule();
            
            swal("Gelöscht", "Das Bild wurde erfolgreich gelöscht", "success");
        }
    });
}
// Konfiguration für Punkteverteilung
const CONFIG = {
    GRADES_COUNT: 6,
    STANDARD_THRESHOLDS: [92, 80, 65, 50, 20, 0],
    LOCAL_STORAGE_KEY: 'gradeDistributionTemplates'
};

// Punkteverteilung Modul rendern
function renderPunkteverteilungModule() {
    // Schwellenwerte-Eingaben initialisieren, wenn sie noch nicht initialisiert wurden
    initializeGradeThresholdInputs();
    
    // Vorlagen laden
    loadTemplates();
    
    // Standard-Preset wählen
    selectPreset('standard');
    
    // Initialen Punkteverteilungsplan berechnen
    calculate();
    
    // Buttons im konsistenten Design halten
    updatePunkteverteilungButtons();
}

// Funktion zum Aktualisieren der Punkteverteilung-Buttons
function updatePunkteverteilungButtons() {
    // Standard/Custom Buttons mit den allgemeinen Klassen versehen
    const btnStandard = safeGetElement('btnStandard');
    const btnCustom = safeGetElement('btnCustom');
    
    if (btnStandard && btnCustom) {
        // Aktuelle Klassen entfernen
        const removeClassList = ['active', 'btn-primary', 'btn-secondary'];
        removeClassList.forEach(className => {
            btnStandard.classList.remove(className);
            btnCustom.classList.remove(className);
        });
        
        // Passende Klassen hinzufügen
        btnStandard.classList.add('btn');
        btnCustom.classList.add('btn');
        
        // Die aktive Klasse ermitteln und Styling anpassen
        if (btnStandard.textContent.trim() === 'Standard') {
            btnStandard.classList.add('btn-primary');
            btnCustom.classList.add('btn-secondary');
        } else {
            btnStandard.classList.add('btn-secondary');
            btnCustom.classList.add('btn-primary');
        }
    }
    
    // Berechnen-Button und Speichern-Button
    const calculateButton = document.querySelector('#punkteverteilung-module button[onclick="calculate()"]');
    const saveTemplateButton = document.querySelector('#punkteverteilung-module button[onclick="saveTemplate()"]');
    
    if (calculateButton) {
        calculateButton.className = 'btn btn-primary';
    }
    
    if (saveTemplateButton) {
        saveTemplateButton.className = 'btn btn-secondary';
    }
}

// Grade threshold inputs generieren
function initializeGradeThresholdInputs() {
    const container = safeGetElement('gradeThresholdInputs');
    if (!container) return;
    
    container.innerHTML = ''; // Container leeren

    for (let i = 1; i <= CONFIG.GRADES_COUNT; i++) {
        const div = document.createElement('div');
        div.classList.add('input-group');
        
        const label = document.createElement('label');
        label.htmlFor = `gradeThreshold${i}`;
        label.textContent = `Note ${i} ab (%):`;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `gradeThreshold${i}`;
        input.min = '0';
        input.max = '100';
        input.step = '0.1';
        input.className = 'form-control';
        
        div.appendChild(label);
        div.appendChild(input);
        container.appendChild(div);
    }
}

// Preset auswählen
function selectPreset(type) {
    const standardBtn = safeGetElement('btnStandard');
    const customBtn = safeGetElement('btnCustom');
    
    if (!standardBtn || !customBtn) return;

    if (type === 'standard') {
        standardBtn.classList.add('active');
        customBtn.classList.remove('active');
        
        // Standard-Werte laden
        for (let i = 0; i < CONFIG.STANDARD_THRESHOLDS.length; i++) {
            const input = safeGetElement(`gradeThreshold${i + 1}`);
            if (input) {
                input.value = CONFIG.STANDARD_THRESHOLDS[i];
            }
        }
    } else {
        standardBtn.classList.remove('active');
        customBtn.classList.add('active');
        
        // Alle Werte auf 0 setzen
        for (let i = 1; i <= CONFIG.GRADES_COUNT; i++) {
            const input = safeGetElement(`gradeThreshold${i}`);
            if (input) {
                input.value = 0;
            }
        }
    }

    calculate();
    
    // UI-Elemente aktualisieren
    updatePunkteverteilungButtons();
}

// Vorlage speichern
function saveTemplate() {
    const templateNameInput = safeGetElement('templateName');
    if (!templateNameInput) return;
    
    const templateName = templateNameInput.value.trim();
    
    if (!templateName) {
        swal("Fehler", "Bitte geben Sie einen Namen für die Vorlage ein.", "error");
        return;
    }

    // Aktuelle Schwellenwerte sammeln
    const currentThresholds = [];
    for (let i = 1; i <= CONFIG.GRADES_COUNT; i++) {
        const thresholdInput = safeGetElement(`gradeThreshold${i}`);
        if (!thresholdInput) continue;
        
        const threshold = parseFloat(thresholdInput.value);
        
        if (isNaN(threshold)) {
            swal("Fehler", `Bitte geben Sie einen gültigen Wert für Note ${i} ein.`, "error");
            return;
        }
        
        currentThresholds.push(threshold);
    }

    // Vorlagen aus Local Storage abrufen
    let savedTemplates = {};
    try {
        const storedTemplates = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
        if (storedTemplates) {
            savedTemplates = JSON.parse(storedTemplates);
        }
    } catch (error) {
        console.error("Fehler beim Laden der Vorlagen:", error);
        savedTemplates = {};
    }

    // Gesamtpunktzahl ermitteln
    const totalPointsInput = safeGetElement('totalPoints');
    const totalPoints = totalPointsInput ? totalPointsInput.value : '100';

    // Neue Vorlage hinzufügen
    savedTemplates[templateName] = {
        thresholds: currentThresholds,
        totalPoints: totalPoints
    };

    // Zurück in Local Storage speichern
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(savedTemplates));
    } catch (error) {
        console.error("Fehler beim Speichern der Vorlagen:", error);
        swal("Fehler", "Die Vorlage konnte nicht gespeichert werden.", "error");
        return;
    }

    // Vorlagen neu laden
    loadTemplates();

    // Eingabefeld leeren
    templateNameInput.value = '';

    swal("Erfolg", `Vorlage "${templateName}" erfolgreich gespeichert!`, "success");
}

// Vorlagen laden
function loadTemplates() {
    const container = safeGetElement('templatesContainer');
    if (!container) return;
    
    let savedTemplates = {};
    try {
        const storedTemplates = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
        if (storedTemplates) {
            savedTemplates = JSON.parse(storedTemplates);
        }
    } catch (error) {
        console.error("Fehler beim Laden der Vorlagen:", error);
        savedTemplates = {};
    }

    // Vorherige Vorlagen entfernen
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Neue Vorlagen hinzufügen
    Object.entries(savedTemplates).forEach(([name, template]) => {
        const div = document.createElement('div');
        div.classList.add('template-btn-container');

        const loadBtn = document.createElement('button');
        loadBtn.textContent = name;
        loadBtn.classList.add('template-btn');
        loadBtn.onclick = () => loadTemplate(name);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.classList.add('template-delete-btn');
        deleteBtn.onclick = () => deleteTemplate(name);

        div.appendChild(loadBtn);
        div.appendChild(deleteBtn);

        container.appendChild(div);
    });
}
// Vorlage laden
function loadTemplate(name) {
    let savedTemplates = {};
    try {
        const storedTemplates = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
        if (storedTemplates) {
            savedTemplates = JSON.parse(storedTemplates);
        }
    } catch (error) {
        console.error("Fehler beim Laden der Vorlagen:", error);
        savedTemplates = {};
    }

    const template = savedTemplates[name];
    if (!template) return;

    // Schwellenwerte laden
    if (template.thresholds) {
        template.thresholds.forEach((threshold, index) => {
            const input = safeGetElement(`gradeThreshold${index + 1}`);
            if (input) {
                input.value = threshold;
            }
        });
    }

    // Gesamtpunktzahl laden
    const totalPointsInput = safeGetElement('totalPoints');
    if (totalPointsInput && template.totalPoints) {
        totalPointsInput.value = template.totalPoints;
    }

    // Berechnungen aktualisieren
    calculate();
}

// Vorlage löschen
function deleteTemplate(name) {
    // Bestätigungsdialog anzeigen
    swal({
        title: "Vorlage löschen?",
        text: `Möchtest du die Vorlage "${name}" wirklich löschen?`,
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            // Vorlage nur löschen, wenn bestätigt
            let savedTemplates = {};
            try {
                const storedTemplates = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
                if (storedTemplates) {
                    savedTemplates = JSON.parse(storedTemplates);
                }
            } catch (error) {
                console.error("Fehler beim Laden der Vorlagen:", error);
                savedTemplates = {};
            }

            if (savedTemplates[name]) {
                delete savedTemplates[name];
                
                try {
                    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(savedTemplates));
                } catch (error) {
                    console.error("Fehler beim Speichern der Vorlagen:", error);
                    swal("Fehler", "Die Vorlage konnte nicht gelöscht werden.", "error");
                    return;
                }
            }

            loadTemplates();
            swal("Gelöscht", `Vorlage "${name}" wurde gelöscht.`, "success");
        }
    });
}

// Berechnung durchführen
function calculate() {
    const totalPointsInput = safeGetElement('totalPoints');
    if (!totalPointsInput) return;
    
    const totalPoints = parseInt(totalPointsInput.value);
    
    if (isNaN(totalPoints) || totalPoints <= 0) {
        swal("Fehler", "Bitte geben Sie eine gültige Gesamtpunktzahl ein.", "error");
        return;
    }

    // Schwellenwerte sammeln und validieren
    const thresholds = [];
    for (let i = 1; i <= CONFIG.GRADES_COUNT; i++) {
        const thresholdInput = safeGetElement(`gradeThreshold${i}`);
        if (!thresholdInput) continue;
        
        const threshold = parseFloat(thresholdInput.value);
        
        if (isNaN(threshold)) {
            swal("Fehler", `Bitte geben Sie einen gültigen Wert für Note ${i} ein.`, "error");
            return;
        }
        
        thresholds.push(threshold / 100);
    }

    // Punktegrenzen berechnen
    const pointThresholds = thresholds.map(t => Math.ceil(t * totalPoints));

    // Ergebnistabelle generieren
    const resultTable = safeGetElement('resultTable');
    if (resultTable) {
        resultTable.innerHTML = `
            <table class="result-table">
                <thead>
                    <tr>
                        <th>Note</th>
                        <th>Punkte von</th>
                        <th>Punkte bis</th>
                        <th>Prozent von</th>
                        <th>Prozent bis</th>
                    </tr>
                </thead>
                <tbody>
                    ${generateTableRows(pointThresholds, totalPoints)}
                </tbody>
            </table>
        `;
    }
}

// Tabellenzeilen generieren
function generateTableRows(pointThresholds, totalPoints) {
    let rows = '';
    
    for (let grade = 1; grade <= CONFIG.GRADES_COUNT; grade++) {
        if (!pointThresholds[grade - 1] && pointThresholds[grade - 1] !== 0) continue;
        
        const pointFrom = pointThresholds[grade - 1];
        const pointTo = grade === 1 ? totalPoints : (pointThresholds[grade - 2] ? pointThresholds[grade - 2] - 1 : totalPoints);
        
        if (pointFrom === undefined || pointTo === undefined) continue;
        
        const percentFrom = ((pointFrom / totalPoints) * 100).toFixed(1);
        const percentTo = ((pointTo / totalPoints) * 100).toFixed(1);

        rows += `
            <tr>
                <td>${grade}</td>
                <td>${pointFrom}</td>
                <td>${pointTo}</td>
                <td>${percentFrom}%</td>
                <td>${percentTo}%</td>
            </tr>
        `;
    }

    return rows;
}

// ===== BACKUP-FUNKTIONEN =====

// Backup-Liste rendern
function renderBackupList() {
    const backupList = safeGetElement('backup-list');
    if (!backupList) return;
    
    // Backup-Infos aktualisieren
    updateBackupInfo();
    
    // Container leeren
    backupList.innerHTML = '';
    
    // Prüfen, ob Backups vorhanden sind
    if (!backups || backups.length === 0) {
        backupList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-save"></i>
                <p>Keine Backups vorhanden</p>
            </div>
        `;
        return;
    }
    
    // Backups sortieren (neueste zuerst)
    const sortedBackups = [...backups].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Backups anzeigen
    sortedBackups.forEach((backup, index) => {
        const isAutomatic = backup.type === 'auto';
        
        const backupDate = new Date(backup.date);
        const formattedDate = backupDate.toLocaleDateString('de-DE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        const formattedTime = backupDate.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const backupItem = document.createElement('div');
        backupItem.className = `backup-item ${isAutomatic ? 'auto' : 'manual'}`;
        
        // Backup-Typ (automatisch oder manuell)
        const backupTypeIcon = isAutomatic ? 'fa-clock' : 'fa-user';
        const backupTypeText = isAutomatic ? 'Automatisches Backup' : 'Manuelles Backup';
        
        // Schätzung der Größe (in KB)
        const dataSize = Math.round(backup.data.length / 1024);
        
        backupItem.innerHTML = `
            <div class="backup-header">
                <div class="backup-title">
                    <i class="fas ${backupTypeIcon}"></i> ${backupTypeText}
                </div>
            </div>
            <div class="backup-meta">
                <div><i class="fas fa-calendar"></i> ${formattedDate} ${formattedTime}</div>
                <div><i class="fas fa-database"></i> ${dataSize} KB</div>
                <div><i class="fas fa-users"></i> ${backup.classCount} Klassen</div>
            </div>
            <div class="backup-actions">
                <button class="btn btn-sm btn-primary" onclick="showRestoreBackupModal(${index})">
                    <i class="fas fa-undo"></i> Wiederherstellen
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteBackup(${index})">
                    <i class="fas fa-trash"></i> Löschen
                </button>
            </div>
        `;
        
        backupList.appendChild(backupItem);
    });
}

// Backup-Informationen aktualisieren
function updateBackupInfo() {
    // Letztes automatisches Backup anzeigen
    const lastAutoBackupElement = safeGetElement('last-auto-backup');
    if (lastAutoBackupElement) {
        const autoBackups = backups.filter(backup => backup.type === 'auto');
        if (autoBackups.length > 0) {
            // Neuestes automatisches Backup finden
            const latestAutoBackup = autoBackups.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const backupDate = new Date(latestAutoBackup.date);
            lastAutoBackupElement.textContent = backupDate.toLocaleDateString('de-DE', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            }) + ' ' + backupDate.toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            lastAutoBackupElement.textContent = 'Nie';
        }
    }
    
    // Nächstes automatisches Backup anzeigen
    const nextAutoBackupElement = safeGetElement('next-auto-backup');
    if (nextAutoBackupElement) {
        if (autoBackupEnabled) {
            // Nächstes geplantes Backup berechnen
            const nextBackupDate = getNextAutoBackupDate();
            if (nextBackupDate) {
                nextAutoBackupElement.textContent = nextBackupDate.toLocaleDateString('de-DE', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                }) + ' (ca. ' + nextBackupDate.toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit'
                }) + ')';
            } else {
                nextAutoBackupElement.textContent = 'Heute';
            }
        } else {
            nextAutoBackupElement.textContent = 'Deaktiviert';
        }
    }
    
    // Auto-Backup-Checkbox aktualisieren
    const autoBackupCheckbox = safeGetElement('auto-backup-enabled');
    if (autoBackupCheckbox) {
        autoBackupCheckbox.checked = autoBackupEnabled;
    }
    
    // Maximale Anzahl an Auto-Backups aktualisieren
    const maxAutoBackupsSelect = safeGetElement('max-auto-backups');
    if (maxAutoBackupsSelect) {
        maxAutoBackupsSelect.value = maxAutoBackups.toString();
    }
}

// Funktion zum Ein- und Ausklappen des Backup-Panels
function toggleBackupPanel() {
    const content = safeGetElement('backup-content');
    const toggleIcon = safeGetElement('backup-toggle-icon');
    
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

// Auto-Backup ein-/ausschalten
function toggleAutoBackup(enabled) {
    autoBackupEnabled = enabled;
    
    // Einstellungen speichern
    localStorage.setItem('autoBackupEnabled', JSON.stringify(autoBackupEnabled));
    
    // Auto-Backup aktivieren/deaktivieren
    if (autoBackupEnabled) {
        scheduleNextAutoBackup();
    } else if (autoBackupInterval) {
        clearTimeout(autoBackupInterval);
        autoBackupInterval = null;
    }
    
    // UI aktualisieren
    updateBackupInfo();
}

// Auto-Backup-Einstellungen aktualisieren
function updateAutoBackupSettings() {
    // Neue Einstellungen auslesen
    const maxAutoBackupsSelect = safeGetElement('max-auto-backups');
    if (maxAutoBackupsSelect) {
        maxAutoBackups = parseInt(maxAutoBackupsSelect.value) || 5;
    }
    
    // Einstellungen speichern
    localStorage.setItem('maxAutoBackups', maxAutoBackups.toString());
    
    // Alte Backups entfernen
    cleanupAutoBackups();
    
    // UI aktualisieren
    renderBackupList();
}

// Nächstes automatisches Backup planen
function scheduleNextAutoBackup() {
    // Falls bereits ein Timeout läuft, diesen beenden
    if (autoBackupInterval) {
        clearTimeout(autoBackupInterval);
        autoBackupInterval = null;
    }
    
    // Wenn Auto-Backup nicht aktiviert ist, nichts tun
    if (!autoBackupEnabled) return;
    
    // Datum des letzten automatischen Backups abrufen
    let lastAutoBackupDate = null;
    
    // Aus localStorage laden (falls vorhanden)
    const savedLastAutoBackupDate = localStorage.getItem('lastAutoBackupDate');
    if (savedLastAutoBackupDate) {
        lastAutoBackupDate = new Date(savedLastAutoBackupDate);
    } else {
        // Alternativ aus den Backups ermitteln
        const autoBackups = backups.filter(backup => backup.type === 'auto');
        if (autoBackups.length > 0) {
            const latestAutoBackup = autoBackups.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            lastAutoBackupDate = new Date(latestAutoBackup.date);
        }
    }
    
    // Nächstes Backup-Datum berechnen (24 Stunden nach dem letzten Backup oder sofort)
    const now = new Date();
    let nextBackupDate;
    
    if (lastAutoBackupDate) {
        // 24 Stunden nach dem letzten Backup
        nextBackupDate = new Date(lastAutoBackupDate);
        nextBackupDate.setDate(nextBackupDate.getDate() + 1);
        
        // Falls das nächste Backup in der Vergangenheit liegt, auf jetzt setzen
        if (nextBackupDate < now) {
            nextBackupDate = now;
        }
    } else {
        // Kein vorheriges Backup, sofort starten
        nextBackupDate = now;
    }
    
    // Timeout-Dauer in Millisekunden berechnen
    const timeoutDuration = Math.max(0, nextBackupDate.getTime() - now.getTime());
    
    // Timeout setzen
    autoBackupInterval = setTimeout(() => {
        // Backup erstellen
        createBackup(null, true);
        
        // Nächstes Backup planen
        scheduleNextAutoBackup();
    }, timeoutDuration);
    
    // UI aktualisieren
    updateBackupInfo();
}

// Nächstes Auto-Backup-Datum ermitteln
function getNextAutoBackupDate() {
    // Datum des letzten automatischen Backups abrufen
    let lastAutoBackupDate = null;
    
    // Aus localStorage laden (falls vorhanden)
    const savedLastAutoBackupDate = localStorage.getItem('lastAutoBackupDate');
    if (savedLastAutoBackupDate) {
        lastAutoBackupDate = new Date(savedLastAutoBackupDate);
    } else {
        // Alternativ aus den Backups ermitteln
        const autoBackups = backups.filter(backup => backup.type === 'auto');
        if (autoBackups.length > 0) {
            const latestAutoBackup = autoBackups.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            lastAutoBackupDate = new Date(latestAutoBackup.date);
        }
    }
    
    // Nächstes Backup-Datum berechnen (24 Stunden nach dem letzten Backup oder sofort)
    const now = new Date();
    let nextBackupDate;
    
    if (lastAutoBackupDate) {
        // 24 Stunden nach dem letzten Backup
        nextBackupDate = new Date(lastAutoBackupDate);
        nextBackupDate.setDate(nextBackupDate.getDate() + 1);
        
        // Falls das nächste Backup in der Vergangenheit liegt, auf jetzt setzen
        if (nextBackupDate < now) {
            return null;
        }
        
        return nextBackupDate;
    }
    
    // Kein vorheriges Backup, sofort starten
    return null;
}

// Alte automatische Backups löschen
function cleanupAutoBackups() {
    // Nur automatische Backups filtern
    const autoBackups = backups.filter(backup => backup.type === 'auto');
    
    // Wenn weniger als das Maximum vorhanden sind, nichts tun
    if (autoBackups.length <= maxAutoBackups) return;
    
    // Nach Datum sortieren (älteste zuerst)
    const sortedAutoBackups = [...autoBackups].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Überzählige Backups löschen
    const toDelete = sortedAutoBackups.length - maxAutoBackups;
    
    for (let i = 0; i < toDelete; i++) {
        const backupToDelete = sortedAutoBackups[i];
        const backupIndex = backups.findIndex(backup => backup.date === backupToDelete.date && backup.type === 'auto');
        
        if (backupIndex !== -1) {
            backups.splice(backupIndex, 1);
        }
    }
    
    // Änderungen speichern
    localStorage.setItem('backups', JSON.stringify(backups));
}

// Backup erstellen - GEÄNDERT: Mit Event-Parameter für stopPropagation
function createBackup(event, isAutomatic = false) {
    // Verhindern, dass das Event den toggleBackupPanel auslöst
    if (event && event.stopPropagation) {
        event.stopPropagation();
    }

    // Aktuelle Daten als JSON-String speichern
    const backupData = JSON.stringify(classes);
    
    // Neues Backup-Objekt erstellen
    const newBackup = {
        date: new Date().toISOString(),
        data: backupData,
        type: isAutomatic ? 'auto' : 'manual',
        classCount: classes.length
    };
    
    // Zum Backups-Array hinzufügen
    backups.push(newBackup);
    
    // Falls es ein automatisches Backup ist, alte Backups löschen
    if (isAutomatic) {
        cleanupAutoBackups();
    }
    
    // In localStorage speichern
    localStorage.setItem('backups', JSON.stringify(backups));
    if (isAutomatic) {
        localStorage.setItem('lastAutoBackupDate', newBackup.date);
    }
    
    // UI aktualisieren
    renderBackupList();
    
    // Meldung anzeigen (nur für manuelle Backups)
    if (!isAutomatic) {
        swal("Erfolg", "Backup wurde erstellt", "success");
    }
}

// Modal zum Wiederherstellen eines Backups anzeigen
function showRestoreBackupModal(backupIndex) {
    if (backupIndex < 0 || backupIndex >= backups.length) return;
    
    const backup = backups[backupIndex];
    const backupDate = new Date(backup.date);
    
    // Backup-Datum formatieren
    const formattedDate = backupDate.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    }) + ' ' + backupDate.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Modal-Inhalte aktualisieren
    const restoreBackupDateElement = safeGetElement('restore-backup-date');
    if (restoreBackupDateElement) {
        restoreBackupDateElement.textContent = formattedDate;
    }
    
    // Backup-Index für später speichern
    currentBackupToRestore = backupIndex;
    
    // Modal anzeigen
    showModal('restore-backup-modal');
}

// Backup wiederherstellen
function confirmRestoreBackup() {
    if (currentBackupToRestore === null || currentBackupToRestore < 0 || currentBackupToRestore >= backups.length) {
        hideModal();
        return;
    }
    
    try {
        // Backup-Daten abrufen
        const backup = backups[currentBackupToRestore];
        const backupData = backup.data;
        
        // Daten wiederherstellen
        classes = JSON.parse(backupData);
        
        // In localStorage speichern
        localStorage.setItem('classes', backupData);
        
        // Modal schließen
        hideModal();
        
        // Startseite anzeigen und UI aktualisieren
        showPage('home');
        
        // Bestätigung anzeigen
        swal("Erfolg", "Backup wurde wiederhergestellt", "success");
    } catch (error) {
        console.error("Fehler beim Wiederherstellen des Backups:", error);
        swal("Fehler", "Das Backup konnte nicht wiederhergestellt werden.", "error");
    }
}

// Backup löschen
function deleteBackup(backupIndex) {
    if (backupIndex < 0 || backupIndex >= backups.length) return;
    
    const backup = backups[backupIndex];
    const backupDate = new Date(backup.date);
    
    // Backup-Datum formatieren
    const formattedDate = backupDate.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
    
    // Bestätigung anfordern
    swal({
        title: "Backup löschen?",
        text: `Möchtest du das Backup vom ${formattedDate} wirklich löschen?`,
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            // Backup löschen
            backups.splice(backupIndex, 1);
            
            // In localStorage speichern
            localStorage.setItem('backups', JSON.stringify(backups));
            
            // UI aktualisieren
            renderBackupList();
            
            swal("Gelöscht", "Das Backup wurde erfolgreich gelöscht", "success");
        }
    });
}

// Alle Daten exportieren - GEÄNDERT: Mit Event-Parameter für stopPropagation
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
            classes: classes,
            oralWeight: document.getElementById('oralWeightValue').innerText
        };
        
        // Als JSON konvertieren
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Als Datei herunterladen
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schulverwaltung_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        swal("Erfolg", "Daten wurden exportiert", "success");
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
    if (!event || !event.target || !event.target.files || !event.target.files.length === 0) return;
    
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
                    
                    // In localStorage speichern
                    localStorage.setItem('classes', JSON.stringify(classes));
                    
                    // Mündliche Gewichtung übernehmen, falls vorhanden
                    if (importData.oralWeight) {
                        const oralWeightElement = safeGetElement('oralWeightValue');
                        if (oralWeightElement) {
                            oralWeightElement.innerText = importData.oralWeight;
                            
                            // Aktiven Button markieren
                            const weightButtons = document.querySelectorAll('.weight-btn');
                            if (weightButtons) {
                                weightButtons.forEach(btn => {
                                    btn.classList.remove('active-weight');
                                });
                                
                                const weightButton = document.querySelector(`.weight-btn[onclick="setWeight(${importData.oralWeight})"]`);
                                if (weightButton) {
                                    weightButton.classList.add('active-weight');
                                }
                            }
                            
                            localStorage.setItem('oralWeight', importData.oralWeight);
                        }
                    }
                    
                    // Startseite anzeigen und UI aktualisieren
                    showPage('home');
                    
                    swal("Erfolg", "Daten wurden importiert", "success");
                }
            });
        } catch (error) {
            console.error("Fehler beim Importieren der Daten:", error);
            swal("Fehler", "Die Datei enthält keine gültigen Daten.", "error");
        }
    };
    
    reader.readAsText(file);
}

// Event-Listener für Dokumentenladung
document.addEventListener('DOMContentLoaded', function() {
    // Initialisierungsfunktion rufen
    loadData();
});