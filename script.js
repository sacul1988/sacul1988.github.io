document.addEventListener('DOMContentLoaded', () => {
    const budgetInput = document.getElementById('budget-input');
    const budgetModal = document.getElementById('budget-modal');
    const openBudgetModalBtn = document.getElementById('open-budget-modal-btn');
    const closeBudgetModalBtn = document.getElementById('close-budget-modal-btn');
    const expenseInput = document.getElementById('expense-input');
    const expenseTitle = document.getElementById('expense-title');
    const expenseModal = document.getElementById('expense-modal');
    const openExpenseModalBtn = document.getElementById('open-expense-modal-btn');
    const closeExpenseModalBtn = document.getElementById('close-expense-modal-btn');
    const calculateBtn = document.getElementById('calculate-btn');
    const addExpenseBtn = document.getElementById('add-expense-btn');
    const resetBtn = document.getElementById('reset-btn');
    const showHistoryBtn = document.getElementById('show-history-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const historyModal = document.getElementById('history-modal');
    const historyList = document.getElementById('history-list');

    const dailyBudgetEl = document.getElementById('daily-budget');
    const accumulatedBudgetEl = document.getElementById('accumulated-budget');
    const dailySavingsRateEl = document.getElementById('daily-savings-rate');
    const savingsStartInfoEl = document.getElementById('savings-start-info');
    const savingsDisplay = document.getElementById('savings-display');
    const currentAmountDisplay = document.getElementById('current-amount-display');
    const displayBudgetAmountEl = document.getElementById('display-budget-amount');
    const currentDateEl = document.getElementById('current-date');

    // Aktuelles Datum anzeigen
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.innerText = now.toLocaleDateString('de-DE', options);

    // Initialisierung: Letzten gespeicherten Wert laden
    const savedAmount = localStorage.getItem('budgetAmount');
    if (savedAmount) {
        budgetInput.value = savedAmount;
        // Beim Laden nur den gespeicherten Tagesbudget-Wert anzeigen
        const savedDailyBudget = localStorage.getItem('currentDailyBudget');
        if (savedDailyBudget) {
            dailyBudgetEl.innerText = `€ ${parseFloat(savedDailyBudget).toFixed(2)}`;
        } else {
            calculateBudget();
        }
        checkSavingsStatus();
    } else {
        updateDaysRemaining();
    }

    openBudgetModalBtn.addEventListener('click', () => {
        budgetModal.style.display = 'flex';
        budgetInput.focus();
        
        // Initialer Check beim Öffnen
        const amount = budgetInput.value;
        const savedAmount = localStorage.getItem('budgetAmount');
        calculateBtn.disabled = (amount === savedAmount || amount === "");
    });

    closeBudgetModalBtn.addEventListener('click', () => {
        budgetModal.style.display = 'none';
        budgetInput.value = localStorage.getItem('budgetAmount') || '';
    });

    budgetInput.addEventListener('input', () => {
        const amount = budgetInput.value;
        const savedAmount = localStorage.getItem('budgetAmount');
        // Button nur aktivieren, wenn der Wert sich vom gespeicherten unterscheidet und nicht leer ist
        calculateBtn.disabled = (amount === savedAmount || amount === "");
    });

    calculateBtn.addEventListener('click', () => {
        const amount = parseFloat(budgetInput.value);
        if (amount && amount > 0) {
            const oldAmount = parseFloat(localStorage.getItem('budgetAmount')) || amount;
            const difference = oldAmount - amount;
            
            // Wenn gespart wird
            if (localStorage.getItem('savingsStartDate')) {
                let currentAdjustment = parseFloat(localStorage.getItem('savingsAdjustment')) || 0;
                localStorage.setItem('savingsAdjustment', (currentAdjustment + difference).toString());
            }

            localStorage.setItem('budgetAmount', amount.toString());
            saveToHistory(amount);
            
            // Tagesbudget berechnen und FEST speichern
            const remainingDays = updateDaysRemaining();
            const newDailyRate = amount / remainingDays;
            localStorage.setItem('currentDailyBudget', newDailyRate.toString());
            
            // Spar-Zuwachs ebenfalls an diesen neuen Wert koppeln
            if (localStorage.getItem('savingsStartDate')) {
                localStorage.setItem('savingDailyRate', newDailyRate.toString());
            }

            dailyBudgetEl.innerText = `€ ${newDailyRate.toFixed(2)}`;
            
            // Automatischer Sparmodus-Start, falls noch nicht aktiv
            if (!localStorage.getItem('savingsStartDate')) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                localStorage.setItem('savingsStartDate', today.getTime().toString());
                localStorage.setItem('savingsAdjustment', "0");
                localStorage.setItem('savingDailyRate', newDailyRate.toString());
            }

            checkSavingsStatus();
            budgetModal.style.display = 'none'; // Modal schließen
        } else {
            alert('Bitte gib einen gültigen Betrag ein.');
        }
    });

    openExpenseModalBtn.addEventListener('click', () => {
        expenseModal.style.display = 'flex';
        expenseInput.focus();
    });

    closeExpenseModalBtn.addEventListener('click', () => {
        expenseModal.style.display = 'none';
        expenseInput.value = '';
        expenseTitle.value = '';
    });

    addExpenseBtn.addEventListener('click', () => {
        const expense = parseFloat(expenseInput.value);
        const title = expenseTitle.value.trim();
        if (expense && expense > 0) {
            const currentAmount = parseFloat(localStorage.getItem('budgetAmount')) || 0;
            const newAmount = Math.max(0, currentAmount - expense);
            
            // Logik: Da "Ausgabe abziehen" direkt den verfügbaren Betrag ändert,
            // verhält es sich wie eine manuelle Änderung des Budgets (calculateBtn).
            // Wir ziehen die Differenz (die Ausgabe) auch vom Spar-Adjustment ab/auf.
            if (localStorage.getItem('savingsStartDate')) {
                let currentAdjustment = parseFloat(localStorage.getItem('savingsAdjustment')) || 0;
                // Da der Betrag sinkt, steigt das "Adjustment" (verbrauchtes Geld)
                localStorage.setItem('savingsAdjustment', (currentAdjustment + expense).toString());
            }

            localStorage.setItem('budgetAmount', newAmount.toString());
            budgetInput.value = newAmount.toFixed(2);
            
            // Historie speichern (als Ausgabe markiert mit optionalem Titel)
            const historyNote = title ? `${title}: -€${expense.toFixed(2)}` : `Ausgabe: -€${expense.toFixed(2)}`;
            saveToHistory(newAmount, historyNote);
            
            // Neues Budget pro Tag berechnen
            const remainingDays = updateDaysRemaining();
            const newDailyRate = newAmount / remainingDays;
            localStorage.setItem('currentDailyBudget', newDailyRate.toString());
            
            // Auch hier: täglich Sparrate anpassen
            if (localStorage.getItem('savingsStartDate')) {
                localStorage.setItem('savingDailyRate', newDailyRate.toString());
            }

            dailyBudgetEl.innerText = `€ ${newDailyRate.toFixed(2)}`;
            checkSavingsStatus();
        } else {
            alert('Bitte gib einen gültigen Ausgabebetrag ein.');
        }
    });

    resetBtn.addEventListener('click', () => {
        if (confirm('Willst du wirklich alle Daten zurücksetzen? Dein Verlauf und Spar-Fortschritt gehen verloren.')) {
            localStorage.clear();
            location.reload();
        }
    });

    showHistoryBtn.addEventListener('click', () => {
        updateHistoryDisplay();
        historyModal.style.display = 'flex';
    });

    closeHistoryBtn.addEventListener('click', () => {
        historyModal.style.display = 'none';
    });

    function saveToHistory(amount, note = "") {
        let history = JSON.parse(localStorage.getItem('budgetHistory')) || [];
        const entry = {
            date: new Date().toLocaleString('de-DE'),
            amount: amount,
            note: note
        };
        history.unshift(entry); // Neueste oben
        localStorage.setItem('budgetHistory', JSON.stringify(history.slice(0, 20))); // Max 20 Einträge
    }

    window.deleteHistoryEntry = (index) => {
        if (confirm('Diesen Eintrag wirklich löschen? Das Budget wird auf den Wert dieses Zeitpunkts zurückgesetzt.')) {
            let history = JSON.parse(localStorage.getItem('budgetHistory')) || [];
            const entryToDelete = history[index];
            
            // Wenn wir einen Eintrag löschen, setzen wir das aktuelle Budget auf den 
            // Betrag zurück, der im NÄCHSTEN (darunterliegenden) Eintrag steht.
            // Falls es der letzte Eintrag war, müssen wir entscheiden, was passiert.
            
            history.splice(index, 1);
            localStorage.setItem('budgetHistory', JSON.stringify(history));

            if (history.length > 0) {
                // Den nun an oberster Stelle stehenden Betrag als aktuell setzen
                const newCurrentAmount = history[0].amount;
                updateBudgetPostDeletion(newCurrentAmount);
            } else {
                // Wenn alles gelöscht wurde, Reset oder auf 0?
                updateBudgetPostDeletion(0);
            }

            updateHistoryDisplay();
        }
    };

    function updateBudgetPostDeletion(newAmount) {
        // 1. Internen Betrag updaten
        localStorage.setItem('budgetAmount', newAmount.toString());
        budgetInput.value = newAmount.toFixed(2);

        // 2. Tagesbudget neu berechnen
        const remainingDays = updateDaysRemaining();
        const newDailyRate = newAmount / remainingDays;
        localStorage.setItem('currentDailyBudget', newDailyRate.toString());
        
        // 3. Wenn Sparmodus aktiv ist, Adjustment anpassen
        // Da wir das Budget auf einen "alten" Stand setzen, müssen wir das Adjustment
        // eigentlich basierend auf der Historie neu kalkulieren oder anpassen.
        // Einfachste Logik: Wir passen die Sparrate an das neue Budget an.
        if (localStorage.getItem('savingsStartDate')) {
            localStorage.setItem('savingDailyRate', newDailyRate.toString());
            // Das adjustment lassen wir hier bewusst so, da es die Summe der manuellen 
            // Abweichungen ist. Durch das Zurücksetzen des Hauptbetrags korrigiert sich 
            // die Kalkulation in checkSavingsStatus() indirekt über die neue Rate.
        }

        dailyBudgetEl.innerText = `€ ${newDailyRate.toFixed(2)}`;
        checkSavingsStatus();
    }

    function updateHistoryDisplay() {
        const history = JSON.parse(localStorage.getItem('budgetHistory')) || [];
        historyList.innerHTML = history.map((item, index) => `
            <li style="border-bottom: 1px solid #eee; padding: 10px 0; display: flex; flex-direction: column; gap: 2px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-right: 35px;">
                    <span style="font-size: 13px; color: #8e8e93;">${item.date}</span>
                    <span style="font-weight: 600;">€ ${item.amount.toFixed(2)}</span>
                </div>
                ${item.note ? `<span style="font-size: 11px; color: #ff9500; font-weight: 500;">${item.note}</span>` : ''}
                <button onclick="deleteHistoryEntry(${index})" style="position: absolute; right: 0; top: 8px; background: none; color: #ff3b30; border: none; padding: 5px; font-size: 18px; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
            </li>
        `).join('') || '<li style="padding: 20px 0; text-align: center; color: #8e8e93;">Noch keine Einträge</li>';
    }

    function checkSavingsStatus() {
        const startTimestamp = localStorage.getItem('savingsStartDate');
        const dailyRate = parseFloat(localStorage.getItem('savingDailyRate'));
        const adjustment = parseFloat(localStorage.getItem('savingsAdjustment')) || 0;
        
        if (startTimestamp && dailyRate) {
            const startDate = new Date(parseInt(startTimestamp));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const diffTime = today - startDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            // Ergebnis: (Rate * Tage) - verbrauchte Differenzen
            const accumulated = (dailyRate * diffDays) - adjustment;
            
            savingsDisplay.style.display = 'flex';
            openExpenseModalBtn.style.display = 'flex'; // Button außerhalb anzeigen
            currentAmountDisplay.style.display = 'block'; // Betrag-Anzeige anzeigen
            showHistoryBtn.style.display = 'block'; // Verlauf-Button anzeigen
            
            accumulatedBudgetEl.innerText = `€ ${accumulated.toFixed(2)}`;
            dailySavingsRateEl.innerText = `(+ € ${dailyRate.toFixed(2)} / Tag)`;

            const currentAmount = parseFloat(localStorage.getItem('budgetAmount')) || 0;
            displayBudgetAmountEl.innerText = `€ ${currentAmount.toFixed(2)}`;
            
            const formattedDate = startDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            savingsStartInfoEl.innerText = `Gespart seit ${formattedDate} (${diffDays} Tage)`;
        }
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function updateDaysRemaining() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        
        const lastDay = getDaysInMonth(year, month);
        const remaining = lastDay - day + 1;
        
        dailyBudgetEl.innerText = dailyBudgetEl.innerText; // Keep current if exists
        return remaining;
    }

    function calculateBudget() {
        const amount = parseFloat(budgetInput.value);
        const remainingDays = updateDaysRemaining();
        
        if (remainingDays > 0) {
            const dailyBudget = amount / remainingDays;
            dailyBudgetEl.innerText = `€ ${dailyBudget.toFixed(2)}`;
        }
    }
});
