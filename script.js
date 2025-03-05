// Globale Variablen
let classes = [];
let activeClassId = null;
let activeModule = 'schueler'; // Standardmodul auf 'schueler' geändert
let activeListId = null;
let currentPage = 'home';

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

// Daten im localStorage speichern
function saveData() {
    try {
        localStorage.setItem('classes', JSON.stringify(classes));
        const oralWeightElement = safeGetElement('oralWeightValue');
        if (oralWeightElement) {
            localStorage.setItem('oralWeight', oralWeightElement.innerText);
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
                        
                        // Projekte mit Unterschrift-Eigenschaft erweitern
                        if (student.projects) {
                            student.projects.forEach(project => {
                                if (project.signatureProvided === undefined) {
                                    project.signatureProvided = false;
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
    } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
        // Fallback: Leere Daten verwenden
        classes = [];
    }
    
    renderClassesGrid();
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
                    <button class="btn btn-sm btn-danger" onclick="deleteStudent(${index})">
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
            plannerMaterials: [false, false, false]
        });
        
        saveData();
        renderModuleContent();
    }
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
                plannerMaterials: [false, false, false]
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

// Hausaufgaben und Material Modul rendern
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
        
        // Details-Bereich mit einer gemeinsamen Zeile für alle Zähler
        const hwDetails = document.createElement('div');
        hwDetails.id = `hwDetails-${index}`;
        hwDetails.className = `hw-details ${student.isExpandedHW ? 'show' : ''}`;
        
        // Gemeinsame Zeile für alle Zähler
        const hwControlRow = document.createElement('div');
        hwControlRow.className = 'hw-control-row';
        
        // Alle Zähler in einer Reihe anordnen
        const controlsGroup = document.createElement('div');
        controlsGroup.className = 'hw-controls-group';
        
        // HA Vollständig Zähler
        const fullHwControls = document.createElement('div');
        fullHwControls.className = 'hw-buttons';
        fullHwControls.innerHTML = `
            <span>HA vollständig:</span>
            <button class="btn btn-sm btn-primary" onclick="incrementHomework(${index})">
                <i class="fas fa-plus"></i>
            </button>
            <span class="hw-count-value ${homework > 0 ? 'warning' : ''}">${homework}</span>
            <button class="btn btn-sm btn-warning" onclick="decrementHomework(${index})" ${homework <= 0 ? 'disabled' : ''}>
                <i class="fas fa-minus"></i>
            </button>
        `;
        
        // HA Teilweise Zähler
        const partialHwControls = document.createElement('div');
        partialHwControls.className = 'hw-buttons';
        partialHwControls.innerHTML = `
            <span>HA teilweise:</span>
            <button class="btn btn-sm btn-primary" onclick="incrementPartialHomework(${index})">
                <i class="fas fa-plus"></i>
            </button>
            <span class="hw-count-value ${homeworkPartial > 0 ? 'warning' : ''}">${homeworkPartial}</span>
            <button class="btn btn-sm btn-warning" onclick="decrementPartialHomework(${index})" ${homeworkPartial <= 0 ? 'disabled' : ''}>
                <i class="fas fa-minus"></i>
            </button>
        `;
        
        // Material Zähler
        const materialControls = document.createElement('div');
        materialControls.className = 'hw-buttons';
        materialControls.innerHTML = `
            <span>Material:</span>
            <button class="btn btn-sm btn-primary" onclick="incrementMaterials(${index})">
                <i class="fas fa-plus"></i>
            </button>
            <span class="hw-count-value ${materials > 0 ? 'warning' : ''}">${materials}</span>
            <button class="btn btn-sm btn-warning" onclick="decrementMaterials(${index})" ${materials <= 0 ? 'disabled' : ''}>
                <i class="fas fa-minus"></i>
            </button>
        `;
        
        // Alle Zähler zur Gruppe hinzufügen
        controlsGroup.appendChild(fullHwControls);
        controlsGroup.appendChild(partialHwControls);
        controlsGroup.appendChild(materialControls);
        
        // Gruppe zur Zeile hinzufügen
        hwControlRow.appendChild(controlsGroup);
        
        // Zeile zum Details-Bereich hinzufügen
        hwDetails.appendChild(hwControlRow);
        
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

// Planner Checkboxen aktualisieren
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

// Hausaufgaben-Zähler inkrementieren
function incrementHomework(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    if (classes[activeClassId].students[originalIndex].homework === undefined) {
        classes[activeClassId].students[originalIndex].homework = 0;
    }
    
    classes[activeClassId].students[originalIndex].homework++;
    saveData();
    renderHomeworkModule();
}

// Teilweise Hausaufgaben-Zähler inkrementieren
function incrementPartialHomework(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    if (classes[activeClassId].students[originalIndex].homeworkPartial === undefined) {
        classes[activeClassId].students[originalIndex].homeworkPartial = 0;
    }
    
    classes[activeClassId].students[originalIndex].homeworkPartial++;
    saveData();
    renderHomeworkModule();
}

// Hausaufgaben-Zähler dekrementieren
function decrementHomework(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    if (classes[activeClassId].students[originalIndex].homework === undefined) {
        classes[activeClassId].students[originalIndex].homework = 0;
    }
    
    if (classes[activeClassId].students[originalIndex].homework > 0) {
        classes[activeClassId].students[originalIndex].homework--;
        saveData();
        renderHomeworkModule();
    }
}

// Teilweise Hausaufgaben-Zähler dekrementieren
function decrementPartialHomework(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    if (classes[activeClassId].students[originalIndex].homeworkPartial === undefined) {
        classes[activeClassId].students[originalIndex].homeworkPartial = 0;
    }
    
    if (classes[activeClassId].students[originalIndex].homeworkPartial > 0) {
        classes[activeClassId].students[originalIndex].homeworkPartial--;
        saveData();
        renderHomeworkModule();
    }
}

// Material-Zähler inkrementieren
function incrementMaterials(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    if (classes[activeClassId].students[originalIndex].materials === undefined) {
        classes[activeClassId].students[originalIndex].materials = 0;
    }
    
    classes[activeClassId].students[originalIndex].materials++;
    saveData();
    renderHomeworkModule();
}

// Material-Zähler dekrementieren
function decrementMaterials(studentIndex) {
    if (!classes[activeClassId] || !classes[activeClassId].students) return;
    
    const studentsArray = getSortedHomeworkStudents();
    if (studentIndex < 0 || studentIndex >= studentsArray.length) return;
    
    const student = studentsArray[studentIndex];
    const originalIndex = classes[activeClassId].students.findIndex(s => s.name === student.name);
    
    if (originalIndex === -1) return;
    
    if (classes[activeClassId].students[originalIndex].materials === undefined) {
        classes[activeClassId].students[originalIndex].materials = 0;
    }
    
    if (classes[activeClassId].students[originalIndex].materials > 0) {
        classes[activeClassId].students[originalIndex].materials--;
        saveData();
        renderHomeworkModule();
    }
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

// Noten Modul rendern
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
        sortBtn.onclick = () => toggleSortStudents();
    }
    
    // Sortierte oder unsortierte Schülerliste
    const studentsToRender = getSortedStudents();
    
    studentsToRender.forEach((student, studentIndex) => {
        if (!student.projects) {
            student.projects = [];
        }
        
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
        
        // Details-Bereich - Rechenweg-Button entfernt aus der action-buttons Gruppe
        let studentDetails = `
            <div id="studentDetails-${studentIndex}" class="student-details ${student.isExpanded ? 'show' : ''}">
                <div class="form-row">
                    <div>
                        <label><i class="fas fa-comment"></i> Mündliche Note:</label>
                        <select class="form-control" onchange="updateOralGrade(${studentIndex}, this.value)">
                            <option value="">Keine mündliche Note</option>
                            ${Object.keys(gradeConversion).map(grade => `
                                <option value="${grade}" ${student.oralGrade === grade ? 'selected' : ''}>${grade}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
        `;
        
        // Projekte-Sektion
        studentDetails += `
            <div style="margin-top: 15px;">
                <label><i class="fas fa-tasks"></i> Projekte:</label>
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
                            <div class="signature-checkbox">
                                <label class="signature-label">
                                    <input 
                                        type="checkbox" 
                                        ${project.signatureProvided ? 'checked' : ''} 
                                        onchange="toggleSignature(${studentIndex}, ${projectIndex})"
                                    >
                                    Unterschrift
                                </label>
                            </div>
                            <div style="flex: 0 0 auto;">
                                <button class="btn btn-sm btn-danger btn-icon" onclick="deleteProject(${studentIndex}, ${projectIndex})">
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

// Funktion zur Berechnung und Anzeige der Projektstatistiken - Geändert für ganze Noten
function updateProjectStatistics() {
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
        grade: '',
        signatureProvided: false
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
    
    classes[activeClassId].students[originalIndex].projects[projectIndex].name = value;
    saveData();
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

// Unterschrift-Status aktualisieren
function toggleSignature(studentIndex, projectIndex) {
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
    
    classes[activeClassId].students[originalIndex].projects[projectIndex].signatureProvided = 
        !classes[activeClassId].students[originalIndex].projects[projectIndex].signatureProvided;
    
    saveData();
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
    
    swal({
        title: "Projekt löschen?",
        text: "Möchtest du dieses Projekt wirklich löschen?",
        icon: "warning",
        buttons: ["Abbrechen", "Löschen"],
        dangerMode: true,
    })
    .then((willDelete) => {
        if (willDelete) {
            classes[activeClassId].students[originalIndex].projects.splice(projectIndex, 1);
            saveData();
            renderGradesModule();
            // Projekt-Auswahloptionen aktualisieren
            updateProjectSelectionOptions();
            // Projektstatistiken aktualisieren
            updateProjectStatistics();
        }
    });
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

// Endnote berechnen
function calculateFinalGrade(projects, oralGrade, oralWeight) {
    if (!projects) projects = [];
    
    const weightValue = parseInt(oralWeight) || 50;
    
    // Statt alle Notenwerte verwenden wir hier ganze Noten
    const writtenGrades = projects
        .map(project => convertToWholeGrade(project.grade))
        .filter(grade => grade > 0);

    if (writtenGrades.length === 0) {
        return {
            rounded: 'Keine Noten',
            exact: 'Keine Noten',
            numeric: 0
        };
    }

    const writtenAverage = writtenGrades.reduce((sum, grade) => sum + grade, 0) / writtenGrades.length;

    if (!oralGrade || oralGrade === '') {
        return {
            rounded: roundGrade(writtenAverage),
            exact: writtenAverage.toFixed(3),
            numeric: writtenAverage
        };
    } else {
        // Auch für mündliche Note ganze Noten verwenden
        const oralGradeConverted = convertToWholeGrade(oralGrade);
        const finalGrade = (writtenAverage * (100 - weightValue) + oralGradeConverted * weightValue) / 100;
        return {
            rounded: roundGrade(finalGrade),
            exact: finalGrade.toFixed(3),
            numeric: finalGrade
        };
    }
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

// Rechenweg anzeigen - Angepasst für ganze Noten
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
    
    const writtenGrades = student.projects
        .map(project => ({
            name: project.name || '',
            grade: convertToWholeGrade(project.grade)
        }))
        .filter(grade => grade.grade > 0);

    if (writtenGrades.length === 0) {
        calculationDiv.innerHTML = 'Keine Noten vorhanden.';
        return;
    }

    const writtenGradeValues = writtenGrades.map(g => g.grade);
    const writtenAverage = writtenGradeValues.reduce((sum, grade) => sum + grade, 0) / writtenGradeValues.length;
    const oralGradeConverted = student.oralGrade ? convertToWholeGrade(student.oralGrade) : null;

    let calculationText = "Schriftliche Noten (nur ganze Noten):\n";
    writtenGrades.forEach(g => {
        calculationText += "- " + (g.name || 'Unbenanntes Projekt') + ": " + g.grade + "\n";
    });
    
    calculationText += "\nDurchschnitt schriftlich: ";
    calculationText += "(" + writtenGradeValues.join(" + ") + ") / " + writtenGradeValues.length + " = " + writtenAverage.toFixed(3) + "\n";

    if (oralGradeConverted !== null) {
        calculationText += "\nMündliche Note (ganze Note): " + oralGradeConverted + "\n";
        calculationText += "\nGewichtung: " + oralWeight + "% mündlich, " + (100 - oralWeight) + "% schriftlich\n";
        calculationText += "\nBerechnung: " + "(" + writtenAverage.toFixed(3) + " * " + (100 - oralWeight) / 100 + " + " + oralGradeConverted + " * " + oralWeight / 100 + ") = " + calculateFinalGrade(student.projects, student.oralGrade, oralWeight).exact + "\n";
        calculationText += "\nGerundete Endnote: " + calculateFinalGrade(student.projects, student.oralGrade, oralWeight).rounded;
    } else {
        calculationText += "\nKeine mündliche Note vorhanden.\n";
        calculationText += "\nEndnote (nur schriftlich): " + writtenAverage.toFixed(3) + "\n";
        calculationText += "\nGerundete Endnote: " + roundGrade(writtenAverage);
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
                <button class="btn btn-danger btn-icon" onclick="deleteList(${listIndex})">
                    <i class="fas fa-trash"></i> Löschen
                </button>
                <button class="btn btn-warning btn-icon" onclick="editList(${listIndex})">
                    <i class="fas fa-edit"></i> Liste umbenennen
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

// Übersicht Modul rendern
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
        
        const finalGrade = calculateFinalGrade(student.projects, student.oralGrade, oralWeight);
        const homework = student.homework || 0;
        const homeworkPartial = student.homeworkPartial || 0;
        const totalHw = homework + (homeworkPartial / 2);
        const materials = student.materials || 0;
        
        const tr = document.createElement('tr');
        
        // Schülername
        tr.innerHTML = `<td>${student.name}</td>`;
        
        // Mündliche Note
        if (student.oralGrade) {
            const oralGradeClass = getGradeColorClass(convertGrade(student.oralGrade));
            tr.innerHTML += `<td><span class="badge ${oralGradeClass}">${student.oralGrade}</span></td>`;
        } else {
            tr.innerHTML += `<td><span class="badge badge-secondary">Keine</span></td>`;
        }
        
        // Projekte - Hier jetzt mit ganzen Noten
        const projectGrades = student.projects
            .map(project => convertToWholeGrade(project.grade))
            .filter(grade => grade > 0);
        
        if (projectGrades.length > 0) {
            const projectAverage = projectGrades.reduce((sum, grade) => sum + grade, 0) / projectGrades.length;
            const projectGradeClass = getGradeColorClass(projectAverage);
            const roundedProjectGrade = Math.round(projectAverage);
            tr.innerHTML += `<td><span class="badge ${projectGradeClass}">${roundedProjectGrade}</span> (${projectAverage.toFixed(2)})</td>`;
        } else {
            tr.innerHTML += `<td><span class="badge badge-secondary">Keine</span></td>`;
        }
        
        // Berechnete Note (jetzt vor Hausaufgaben)
        if (finalGrade.numeric > 0) {
            const gradeClass = getGradeColorClass(finalGrade.numeric);
            tr.innerHTML += `<td><span class="badge ${gradeClass}">${finalGrade.rounded}</span> (${finalGrade.exact})</td>`;
        } else {
            tr.innerHTML += `<td><span class="badge badge-secondary">Keine</span></td>`;
        }
        
        // Hausaufgaben
        tr.innerHTML += `<td>${totalHw.toFixed(1)}</td>`;
        
        // Material
        tr.innerHTML += `<td>${materials}</td>`;
        
        // Individuelle Note
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
        
        // Aktionen
        tr.innerHTML += `
            <td>
                <button class="btn btn-sm btn-primary" onclick="showIndividualGradeModal(${studentIndex})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        
        overviewTable.appendChild(tr);
    });
}

// Sortierung der Übersichtsliste umschalten
function toggleSortOverview() {
    if (!classes[activeClassId]) return;
    
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

// Übersicht als Text exportieren
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
    
    // Schülerdaten - jetzt mit umfassenderen Informationen
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
        
        // Mündliche Note
        text += `Mündliche Note: ${student.oralGrade || 'Keine'}\n`;
        
        // Projekte detailliert auflisten
        text += `\nProjekte:\n`;
        if (student.projects.length === 0) {
            text += `  Keine Projekte vorhanden\n`;
        } else {
            student.projects.forEach(project => {
                const projectName = project.name || 'Unbenanntes Projekt';
                const projectGrade = project.grade || 'Keine Note';
                const signature = project.signatureProvided ? 'Ja' : 'Nein';
                text += `  - ${projectName}: ${projectGrade} (Unterschrift: ${signature})\n`;
            });
            
            // Projekt-Durchschnitt berechnen - mit ganzen Noten
            const projectGrades = student.projects
                .map(project => convertToWholeGrade(project.grade))
                .filter(grade => grade > 0);
            
            if (projectGrades.length > 0) {
                const avg = projectGrades.reduce((sum, grade) => sum + grade, 0) / projectGrades.length;
                text += `\nProjekt-Durchschnitt (ganze Noten): ${Math.round(avg)} (${avg.toFixed(2)})\n`;
            }
        }
        
        // Rechenweg für die Endnote - angepasst für ganze Noten
        text += `\nRechenweg für die Endnote (mit ganzen Noten):\n`;
        if (finalGrade.numeric > 0) {
            // Hier den gleichen Rechenweg wie in showCalculation() verwenden
            const writtenGrades = student.projects
                .map(project => ({
                    name: project.name || 'Unbenanntes Projekt',
                    grade: convertToWholeGrade(project.grade)
                }))
                .filter(grade => grade.grade > 0);
            
            const writtenGradeValues = writtenGrades.map(g => g.grade);
            const writtenAverage = writtenGradeValues.length > 0 ? 
                writtenGradeValues.reduce((sum, grade) => sum + grade, 0) / writtenGradeValues.length : 0;
            const oralGradeConverted = student.oralGrade ? convertToWholeGrade(student.oralGrade) : null;

            text += `  Schriftliche Noten (ganze Noten): ${writtenGradeValues.join(", ") || "Keine"}\n`;
            text += `  Durchschnitt schriftlich: ${writtenAverage.toFixed(3)}\n`;

            if (oralGradeConverted !== null) {
                text += `  Mündliche Note (ganze Note): ${oralGradeConverted}\n`;
                text += `  Gewichtung: ${oralWeight}% mündlich, ${100 - oralWeight}% schriftlich\n`;
                text += `  Berechnung: (${writtenAverage.toFixed(3)} * ${(100 - oralWeight) / 100} + ${oralGradeConverted} * ${oralWeight / 100}) = ${finalGrade.exact}\n`;
            } else {
                text += `  Keine mündliche Note vorhanden.\n`;
                text += `  Endnote (nur schriftlich): ${writtenAverage.toFixed(3)}\n`;
            }

            text += `  Gerundete Endnote: ${finalGrade.rounded}\n`;
        } else {
            text += `  Keine ausreichenden Noten für Berechnung vorhanden.\n`;
        }
        
        // Hausaufgaben und Material
        text += `\nHausaufgaben und Material:\n`;
        text += `  Vergessene Hausaufgaben: ${totalHw.toFixed(1)}\n`;
        text += `  Vergessenes Material: ${materials}\n`;
        
        // Individuelle Note mit Begründung
        text += `\nIndividuelle Note: `;
        if (student.individualGrade) {
            text += `${student.individualGrade}\n`;
            if (student.individualGradeComment) {
                text += `Begründung: ${student.individualGradeComment}\n`;
            }
        } else {
            text += `Keine\n`;
        }
        
        text += `\n\n`;
    });
    
    // Zusammenfassung der Klasse
    text += "\n=======================================\n";
    text += "KLASSENZUSAMMENFASSUNG\n";
    text += "=======================================\n\n";
    
    const totalStudents = cls.students.length;
    text += `Anzahl der Schüler: ${totalStudents}\n`;
    
    // Durchschnittliche mündliche Note - mit ganzen Noten
    const oralGrades = cls.students
        .filter(s => s.oralGrade)
        .map(s => convertToWholeGrade(s.oralGrade));
    
    if (oralGrades.length > 0) {
        const avgOralGrade = oralGrades.reduce((sum, grade) => sum + grade, 0) / oralGrades.length;
        text += `Durchschnittliche mündliche Note (ganze Noten): ${avgOralGrade.toFixed(2)}\n`;
    }
    
    // Durchschnittliche Projektnote - mit ganzen Noten
    const allProjectGrades = [];
    cls.students.forEach(student => {
        if (student.projects) {
            student.projects.forEach(project => {
                if (project.grade) {
                    const gradeValue = convertToWholeGrade(project.grade);
                    if (gradeValue > 0) {
                        allProjectGrades.push(gradeValue);
                    }
                }
            });
        }
    });
    
    if (allProjectGrades.length > 0) {
        const avgProjectGrade = allProjectGrades.reduce((sum, grade) => sum + grade, 0) / allProjectGrades.length;
        text += `Durchschnittliche Projektnote (ganze Noten): ${avgProjectGrade.toFixed(2)}\n`;
    }
    
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
                const noteDate = new Date(note.date);
                formattedDate = noteDate.toLocaleDateString('de-DE') + ' ' + noteDate.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'});
            } catch (error) {
                formattedDate = 'Datum unbekannt';
                console.error("Fehler beim Formatieren des Datums:", error);
            }
            
            noteItem.innerHTML = `
                <div class="class-note-title">
                    ${note.title || 'Unbenannte Notiz'}
                    <div class="class-note-actions">
                        <button class="btn btn-sm btn-danger" onclick="deleteClassNote(${index})">
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
    
    const titleInput = safeGetElement('new-class-note-title');
    const contentTextarea = safeGetElement('new-class-note-content');
    
    if (!titleInput || !contentTextarea) return;
    
    const title = titleInput.value.trim();
    const content = contentTextarea.value.trim();
    
    if (!title) {
        swal("Fehler", "Bitte gib einen Titel für die Notiz ein", "error");
        return;
    }
    
    if (!content) {
        swal("Fehler", "Bitte gib einen Inhalt für die Notiz ein", "error");
        return;
    }
    
    // Neue Notiz erstellen
    const newNote = {
        title: title,
        content: content,
        date: new Date().toISOString()
    };
    
    // Sicherstellen, dass classNotes initialisiert ist
    if (!classes[activeClassId].classNotes) {
        classes[activeClassId].classNotes = [];
    }
    
    // Notiz hinzufügen
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
    const existingTemplates = container.querySelectorAll('.template-btn-container');
    if (existingTemplates) {
        existingTemplates.forEach(el => el.remove());
    }

    // Überschrift hinzufügen, falls sie noch nicht da ist
    if (!container.querySelector('h2')) {
        const heading = document.createElement('h2');
        heading.textContent = 'Gespeicherte Vorlagen';
        container.appendChild(heading);
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
        deleteBtn.textContent = '×';
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

// Event-Listener für Dokumentenladung
document.addEventListener('DOMContentLoaded', function() {
    // Icons und deren Beschriftungen definieren
    const moduleLabels = {
        'schueler': 'Schüler',
        'hausaufgaben': 'Hausaufgaben',
        'noten': 'Noten',
        'uebersicht': 'Übersicht',
        'sitzplan': 'Sitzplan',
        'listen': 'Listen',
        'zaehlen': 'Zählen',
        'klassennotizen': 'Notizen',
        'punkteverteilung': 'Punkte'
    };
    
    // Modulnavigation mit Texten ergänzen
    const moduleNavItems = document.querySelectorAll('.module-nav-item');
    if (moduleNavItems) {
        moduleNavItems.forEach(item => {
            if (!item || !item.dataset || !item.dataset.module) return;
            
            const moduleId = item.dataset.module;
            const button = item.querySelector('.btn');
            
            if (!button) return;
            
            const icon = button.innerHTML;
            
            // Icon und Text hinzufügen
            if (moduleLabels[moduleId]) {
                button.innerHTML = icon + `<span>${moduleLabels[moduleId]}</span>`;
            }
        });
    }
});

// Initialisierungsfunktion erweitern
function initExtended() {
    // Daten laden
    loadData();
    
    // Eventlistener für Enter-Taste in Modals
    const newClassNameInput = safeGetElement('new-class-name');
    if (newClassNameInput) {
        newClassNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createClass();
            }
        });
    }
    
    const newListNameInput = safeGetElement('new-list-name');
    if (newListNameInput) {
        newListNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createList();
            }
        });
    }
    
    // Neuer Eventlistener für Klassennotiz-Modal
    const newClassNoteTitleInput = safeGetElement('new-class-note-title');
    const newClassNoteContentTextarea = safeGetElement('new-class-note-content');
    
    if (newClassNoteTitleInput && newClassNoteContentTextarea) {
        newClassNoteTitleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                newClassNoteContentTextarea.focus();
            }
        });
    }
    
    // Modals schließen bei Klick außerhalb
    const modalContainer = safeGetElement('modal-container');
    if (modalContainer) {
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                hideModal();
            }
        });
    }
    
    // ESC-Taste schließt Modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalContainer && modalContainer.style.display === 'flex') {
            hideModal();
        }
    });
    
    // Event-Listener für Projekt-Statistiken
    const projectNumberSelect = safeGetElement('project-number-select');
    if (projectNumberSelect) {
        projectNumberSelect.addEventListener('change', updateProjectStatistics);
    }

    // Event-Listener für Punkteverteilung Tab
    const totalPointsInput = safeGetElement('totalPoints');
    if (totalPointsInput) {
        totalPointsInput.addEventListener('change', calculate);
        
        for (let i = 1; i <= CONFIG.GRADES_COUNT; i++) {
            const input = safeGetElement(`gradeThreshold${i}`);
            if (input) {
                input.addEventListener('change', calculate);
            }
        }
    }
}

// Seite initialisieren (überschreibt die ursprüngliche init-Funktion)
window.onload = initExtended;