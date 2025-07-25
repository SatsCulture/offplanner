/*
 * Offplanner – Urlaubsplaner mit Brückentagen
 *
 * Dieser JavaScript-Code implementiert die Logik zur Berechnung
 * deutscher Feiertage (national und regional) sowie zur Ermittlung
 * der optimalen Brückentage. Anwender können über das Formular ein
 * Jahr und ein Bundesland auswählen, um passende Urlaubsvorschläge
 * zu erhalten.
 */

// Mapping of Bundesländer codes to display names
const STATE_NAMES = {
    DE: 'Alle Bundesländer',
    BW: 'Baden-Württemberg',
    BY: 'Bayern',
    BE: 'Berlin',
    BB: 'Brandenburg',
    HB: 'Bremen',
    HH: 'Hamburg',
    HE: 'Hessen',
    MV: 'Mecklenburg-Vorpommern',
    NI: 'Niedersachsen',
    NW: 'Nordrhein-Westfalen',
    RP: 'Rheinland-Pfalz',
    SL: 'Saarland',
    SN: 'Sachsen',
    ST: 'Sachsen-Anhalt',
    SH: 'Schleswig-Holstein',
    TH: 'Thüringen'
};

// Populate the state select dropdown
function populateStateSelect() {
    const stateSelect = document.getElementById('stateSelect');
    // Remove existing options
    stateSelect.innerHTML = '';
    for (const code of Object.keys(STATE_NAMES)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = STATE_NAMES[code];
        stateSelect.appendChild(option);
    }
}

// Global month names for German calendar (used for grouping in table headings)
const MONTH_NAMES = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// Tooltip element for calendar hover
let tooltipEl = null;

/**
 * Initialisiert das Tooltip-Element und fügt es dem DOM hinzu.
 */
function initTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'tooltip';
    tooltipEl.className = 'tooltip';
    document.body.appendChild(tooltipEl);
}

/**
 * Zeigt das Tooltip an der Cursorposition mit dem angegebenen Inhalt an.
 * @param {MouseEvent} event - Das Mouseover-Event
 * @param {string} content - Der anzuzeigende Text
 */
function showTooltip(event, content) {
    if (!tooltipEl) return;
    tooltipEl.innerHTML = content;
    tooltipEl.style.left = (event.pageX + 10) + 'px';
    tooltipEl.style.top = (event.pageY + 15) + 'px';
    tooltipEl.style.display = 'block';
}

/**
 * Aktualisiert die Position des Tooltips (z. B. während Mousemove).
 * @param {MouseEvent} event
 */
function moveTooltip(event) {
    if (!tooltipEl || tooltipEl.style.display === 'none') return;
    tooltipEl.style.left = (event.pageX + 10) + 'px';
    tooltipEl.style.top = (event.pageY + 15) + 'px';
}

/**
 * Verbirgt das Tooltip.
 */
function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.style.display = 'none';
}

// Speichert den zuletzt berechneten Plan global für Export und Erinnerungen
let latestPlan = [];

/**
 * Exportiert die ausgewählten Urlaubstage als iCalendar (.ics)-Datei.
 * Es wird für jeden Urlaubstag ein eigenes ganztägiges Ereignis erstellt.
 * @param {Array} plan - Liste der ausgewählten Brückentagssuggestionen
 */
function exportToIcs(plan) {
    if (!plan || plan.length === 0) {
        alert('Es sind keine Urlaubstage zum Exportieren vorhanden.');
        return;
    }
    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Offplanner//DE\r\n';
    plan.forEach((s) => {
        s.bridgingDays.forEach((d) => {
            const start = d;
            const end = new Date(d.getTime());
            end.setUTCDate(end.getUTCDate() + 1); // exklusives Enddatum
            const fmtDate = (dateObj) => {
                const y = dateObj.getUTCFullYear().toString().padStart(4, '0');
                const m = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
                const da = dateObj.getUTCDate().toString().padStart(2, '0');
                return `${y}${m}${da}`;
            };
            const dtStart = fmtDate(start);
            const dtEnd = fmtDate(end);
            const uid = `uid-${dtStart}-${Math.random().toString(36).substr(2, 9)}@offplanner`;
            const summary = `Urlaubstag: ${s.holiday}`;
            ics += 'BEGIN:VEVENT\r\n';
            ics += `UID:${uid}\r\n`;
            ics += `DTSTAMP:${dtStart}T000000Z\r\n`;
            ics += `DTSTART;VALUE=DATE:${dtStart}\r\n`;
            ics += `DTEND;VALUE=DATE:${dtEnd}\r\n`;
            ics += `SUMMARY:${summary}\r\n`;
            ics += 'END:VEVENT\r\n';
        });
    });
    ics += 'END:VCALENDAR';
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const year = document.getElementById('yearSelect').value;
    link.download = `urlaub_${year}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Wechselt den Dark-Mode-Zustand der Seite.
 */
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    // Nach dem Umschalten speichern
    saveSettings();
}

/**
 * Zeigt eine Übersicht der kommenden Urlaubsblöcke an.
 */
function showReminders() {
    if (!latestPlan || latestPlan.length === 0) {
        alert('Es liegen keine Urlaubsvorschläge vor.');
        return;
    }
    let msg = 'Geplante Urlaubsblöcke:\n\n';
    latestPlan.forEach((s) => {
        msg += `${s.holiday}: ${formatDate(s.breakStart)} bis ${formatDate(s.breakEnd)}\n`;
    });
    alert(msg);
}

/**
 * Speichert aktuelle Einstellungen (Jahr, Bundesland, verfügbare Tage, Dark Mode) im localStorage.
 */
function saveSettings() {
    const settings = {
        year: document.getElementById('yearSelect').value,
        state: document.getElementById('stateSelect').value,
        available: document.getElementById('vacationDaysInput').value,
        dark: document.body.classList.contains('dark')
    };
    try {
        localStorage.setItem('offplannerSettings', JSON.stringify(settings));
    } catch (e) {
        // localStorage kann deaktiviert sein; Fehler ignorieren
    }
}

/**
 * Lädt gespeicherte Einstellungen aus dem localStorage und wendet sie an.
 */
function loadSettings() {
    try {
        const data = localStorage.getItem('offplannerSettings');
        if (!data) return;
        const settings = JSON.parse(data);
        if (settings.year) {
            const yearInput = document.getElementById('yearSelect');
            if (yearInput) yearInput.value = settings.year;
        }
        if (settings.state) {
            const stateSelect = document.getElementById('stateSelect');
            if (stateSelect) stateSelect.value = settings.state;
        }
        if (settings.available) {
            const vacInput = document.getElementById('vacationDaysInput');
            if (vacInput) vacInput.value = settings.available;
        }
        if (settings.dark) {
            document.body.classList.add('dark');
        }
    } catch (e) {
        // ignore
    }
}

// Compute Easter Sunday for a given year (Gregorian calendar)
function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    // Return Date in UTC to avoid timezone shifts
    return new Date(Date.UTC(year, month - 1, day));
}

// Generate nationwide holidays for a year
function getHolidaysNational(year) {
    const holidays = {};
    // Fixed-date national holidays
    holidays[`${year}-01-01`] = 'Neujahr';
    holidays[`${year}-05-01`] = 'Tag der Arbeit';
    holidays[`${year}-10-03`] = 'Tag der Deutschen Einheit';
    holidays[`${year}-12-25`] = '1. Weihnachtstag';
    holidays[`${year}-12-26`] = '2. Weihnachtstag';
    // Easter-based national holidays
    const easter = easterSunday(year);
    // Helper to format date to ISO string (YYYY-MM-DD)
    function fmt(d) {
        return d.toISOString().split('T')[0];
    }
    // Karfreitag = Easter Sunday minus 2 days
    const goodFriday = new Date(easter.getTime());
    goodFriday.setUTCDate(easter.getUTCDate() - 2);
    holidays[fmt(goodFriday)] = 'Karfreitag';
    // Ostermontag = Easter Sunday plus 1 day
    const easterMonday = new Date(easter.getTime());
    easterMonday.setUTCDate(easter.getUTCDate() + 1);
    holidays[fmt(easterMonday)] = 'Ostermontag';
    // Christi Himmelfahrt = Easter Sunday plus 39 days
    const ascension = new Date(easter.getTime());
    ascension.setUTCDate(easter.getUTCDate() + 39);
    holidays[fmt(ascension)] = 'Christi Himmelfahrt';
    // Pfingstmontag = Easter Sunday plus 50 days
    const pentecostMonday = new Date(easter.getTime());
    pentecostMonday.setUTCDate(easter.getUTCDate() + 50);
    holidays[fmt(pentecostMonday)] = 'Pfingstmontag';
    return holidays;
}

// Compute Buß- und Bettag (Wednesday before 23 November)
function getBussUndBettag(year) {
    let date = new Date(Date.UTC(year, 10, 23)); // Nov = month 10 (zero-based)
    // 0 = Sunday, 3 = Wednesday; adjust until Wednesday (3)? Actually getUTCDay 3=Wednesday? Wait: 0=Sunday, 1=Monday...; So 3=Wednesday.
    while (date.getUTCDay() !== 3) {
        // subtract one day
        date.setUTCDate(date.getUTCDate() - 1);
    }
    return date;
}

// Generate full holiday list for a specific state code
function getHolidaysForState(year, state) {
    const holidays = { ...getHolidaysNational(year) };
    const sc = state.toUpperCase();
    if (sc === 'DE') {
        return holidays;
    }
    const easter = easterSunday(year);
    function fmt(d) {
        return d.toISOString().split('T')[0];
    }
    // Epiphany Jan 6 – BW, BY, ST【819254595201035†L120-L128】
    if (['BW', 'BY', 'ST'].includes(sc)) {
        holidays[`${year}-01-06`] = 'Heilige Drei Könige';
    }
    // International Women's Day Mar 8 – BE, MV【819254595201035†L129-L133】
    if (['BE', 'MV'].includes(sc)) {
        holidays[`${year}-03-08`] = 'Frauentag';
    }
    // Easter Sunday – Brandenburg【819254595201035†L134-L136】
    if (sc === 'BB') {
        holidays[fmt(easter)] = 'Ostersonntag';
    }
    // Whitsunday (Pfingstsonntag) – Brandenburg【819254595201035†L142-L144】
    if (sc === 'BB') {
        const pentecostSunday = new Date(easter.getTime());
        pentecostSunday.setUTCDate(easter.getUTCDate() + 49);
        holidays[fmt(pentecostSunday)] = 'Pfingstsonntag';
    }
    // Corpus Christi (Fronleichnam) – BW, BY, HE, NW, RP, SL【819254595201035†L146-L152】
    if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(sc)) {
        const corpusChristi = new Date(easter.getTime());
        corpusChristi.setUTCDate(easter.getUTCDate() + 60);
        holidays[fmt(corpusChristi)] = 'Fronleichnam';
    }
    // Assumption Day (Mariä Himmelfahrt) Aug 15 – BY, SL【819254595201035†L153-L155】
    if (['BY', 'SL'].includes(sc)) {
        holidays[`${year}-08-15`] = 'Mariä Himmelfahrt';
    }
    // World Children's Day (Weltkindertag) Sep 20 – TH【819254595201035†L156-L157】
    if (sc === 'TH') {
        holidays[`${year}-09-20`] = 'Weltkindertag';
    }
    // Reformation Day Oct 31 – BB, HB, HH, MV, NI, SN, ST, SH, TH【819254595201035†L160-L169】
    if (['BB','HB','HH','MV','NI','SN','ST','SH','TH'].includes(sc)) {
        holidays[`${year}-10-31`] = 'Reformationstag';
    }
    // All Saints' Day Nov 1 – BW, BY, NW, RP, SL【819254595201035†L170-L175】
    if (['BW','BY','NW','RP','SL'].includes(sc)) {
        holidays[`${year}-11-01`] = 'Allerheiligen';
    }
    // Buß- und Bettag – SN【819254595201035†L176-L177】
    if (sc === 'SN') {
        const bussDate = getBussUndBettag(year);
        holidays[fmt(bussDate)] = 'Buß- und Bettag';
    }
    return holidays;
}

// Compute bridging suggestions given year and state
function computeBridgingSuggestions(year, state) {
    const holidays = getHolidaysForState(year, state);
    // Convert holiday dates to a Set for quick lookup
    const holidayDates = new Set(Object.keys(holidays));
    const suggestions = [];
    // Iterate over holidays in chronological order
    const sortedDates = Object.keys(holidays).sort();
    for (const dateStr of sortedDates) {
        const hDate = new Date(dateStr + 'T00:00:00Z');
        const weekday = hDate.getUTCDay(); // 0=Sunday, 1=Monday, ... 6=Saturday
        // Skip weekend holidays
        if (weekday === 0 || weekday === 6) {
            continue;
        }
        const hName = holidays[dateStr];
        // Determine previous Saturday and next Sunday relative to the holiday
        // Convert getUTCDay (0=Sunday) to Monday=0 mapping used in Python logic
        const weekdayMonZero = (weekday === 0 ? 6 : weekday - 1);
        const startPre = new Date(hDate.getTime());
        startPre.setUTCDate(hDate.getUTCDate() - (weekdayMonZero + 2));
        const endPost = new Date(hDate.getTime());
        endPost.setUTCDate(hDate.getUTCDate() + (6 - weekdayMonZero));
        // Helper to iterate dates (excluding endpoints)
        function collectBridgingDates(start, end) {
            const list = [];
            const current = new Date(start.getTime());
            current.setUTCDate(current.getUTCDate() + 1);
            while (current.getTime() < end.getTime()) {
                const cStr = current.toISOString().split('T')[0];
                const day = current.getUTCDay();
                if (day !== 0 && day !== 6 && !holidayDates.has(cStr)) {
                    list.push(new Date(current.getTime()));
                }
                current.setUTCDate(current.getUTCDate() + 1);
            }
            return list;
        }
        // Bridging before holiday (connect previous weekend)
        const bridgingPreDates = collectBridgingDates(startPre, hDate);
        const bridgingPreCount = bridgingPreDates.length;
        const bridgingPreTotal = Math.round((hDate.getTime() - startPre.getTime()) / 86400000) + 1;
        // Bridging after holiday (connect next weekend)
        const bridgingPostDates = collectBridgingDates(hDate, endPost);
        const bridgingPostCount = bridgingPostDates.length;
        const bridgingPostTotal = Math.round((endPost.getTime() - hDate.getTime()) / 86400000) + 1;
        // Combined break across both weekends
        const bridgingFullDates = bridgingPreDates.concat(bridgingPostDates);
        const bridgingFullCount = bridgingFullDates.length;
        const bridgingFullTotal = Math.round((endPost.getTime() - startPre.getTime()) / 86400000) + 1;
        // Determine best suggestion
        let suggestion = null;
        if (bridgingPreCount === 0 && bridgingPostCount === 0) {
            continue;
        }
        // Monday holiday (bridgingPreCount = 0) or Friday holiday (bridgingPostCount = 0)
        if ((bridgingPreCount === 0 && bridgingPostCount > 0) || (bridgingPostCount === 0 && bridgingPreCount > 0)) {
            suggestion = {
                holiday: hName,
                date: new Date(hDate.getTime()),
                breakStart: new Date(startPre.getTime()),
                breakEnd: new Date(endPost.getTime()),
                bridgingDays: bridgingFullDates.slice(),
                vacationDays: bridgingFullCount,
                totalDays: bridgingFullTotal,
                type: 'Mit Brückentagen zu langem Wochenende'
            };
        } else {
            if (bridgingPreCount < bridgingPostCount) {
                suggestion = {
                    holiday: hName,
                    date: new Date(hDate.getTime()),
                    breakStart: new Date(startPre.getTime()),
                    breakEnd: new Date(hDate.getTime()),
                    bridgingDays: bridgingPreDates.slice(),
                    vacationDays: bridgingPreCount,
                    totalDays: bridgingPreTotal,
                    type: 'Vor dem Feiertag'
                };
            } else if (bridgingPostCount < bridgingPreCount) {
                suggestion = {
                    holiday: hName,
                    date: new Date(hDate.getTime()),
                    breakStart: new Date(hDate.getTime()),
                    breakEnd: new Date(endPost.getTime()),
                    bridgingDays: bridgingPostDates.slice(),
                    vacationDays: bridgingPostCount,
                    totalDays: bridgingPostTotal,
                    type: 'Nach dem Feiertag'
                };
            } else {
                // Equal counts: pick longer break
                if (bridgingPreTotal >= bridgingPostTotal) {
                    suggestion = {
                        holiday: hName,
                        date: new Date(hDate.getTime()),
                        breakStart: new Date(startPre.getTime()),
                        breakEnd: new Date(hDate.getTime()),
                        bridgingDays: bridgingPreDates.slice(),
                        vacationDays: bridgingPreCount,
                        totalDays: bridgingPreTotal,
                        type: 'Vor dem Feiertag'
                    };
                } else {
                    suggestion = {
                        holiday: hName,
                        date: new Date(hDate.getTime()),
                        breakStart: new Date(hDate.getTime()),
                        breakEnd: new Date(endPost.getTime()),
                        bridgingDays: bridgingPostDates.slice(),
                        vacationDays: bridgingPostCount,
                        totalDays: bridgingPostTotal,
                        type: 'Nach dem Feiertag'
                    };
                }
            }
        }
        suggestions.push(suggestion);
    }
    // Sort suggestions chronologically by date
    suggestions.sort((a, b) => a.date - b.date);
    return suggestions;
}

// Greedy selection of bridging suggestions based on available vacation days.
// Sorts suggestions by the ratio of total days to vacation days and selects
// non‑overlapping suggestions until die Urlaubsbudget aufgebraucht ist.
function computeRecommendedPlan(suggestions, availableDays) {
    let remaining = isNaN(availableDays) ? 0 : availableDays;
    const selected = [];
    const usedVacationDates = new Set();
    // Sort by the ratio of total free days to required vacation days (descending)
    const sorted = suggestions.slice().sort((a, b) => {
        const ratioA = a.totalDays / (a.vacationDays || 1);
        const ratioB = b.totalDays / (b.vacationDays || 1);
        return ratioB - ratioA;
    });
    sorted.forEach((s) => {
        if (s.vacationDays > remaining) {
            return;
        }
        // Prüfen, ob sich freie Tage überschneiden
        let conflict = false;
        for (const d of s.bridgingDays) {
            const key = d.toISOString().split('T')[0];
            if (usedVacationDates.has(key)) {
                conflict = true;
                break;
            }
        }
        if (conflict) {
            return;
        }
        // Akzeptieren
        selected.push(s);
        s.bridgingDays.forEach((d) => {
            const key = d.toISOString().split('T')[0];
            usedVacationDates.add(key);
        });
        remaining -= s.vacationDays;
    });
    return selected;
}

// Erzeugt eine Kalenderansicht und markiert Feiertage, Brückentage sowie komplette Urlaubsblöcke
function generateCalendar(year, state, selectedPlan) {
    const container = document.getElementById('calendarContainer');
    if (!container) return;
    // Clear existing calendar
    container.innerHTML = '';
    // Holiday list for the state
    const holidayMap = getHolidaysForState(year, state);
    const holidaySet = new Set(Object.keys(holidayMap));
    // Sammeln von Urlaubstagen und kompletten freien Tagen
    const vacationDates = new Set();
    const breakDates = new Set();
    selectedPlan.forEach((s) => {
        s.bridgingDays.forEach((d) => {
            const key = d.toISOString().split('T')[0];
            vacationDates.add(key);
            breakDates.add(key);
        });
        let current = new Date(s.breakStart);
        const end = new Date(s.breakEnd);
        while (current.getTime() <= end.getTime()) {
            const key = current.toISOString().split('T')[0];
            breakDates.add(key);
            current.setUTCDate(current.getUTCDate() + 1);
        }
    });
    // German month names and weekday abbreviations
    const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const weekdayShort = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    for (let m = 0; m < 12; m++) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'month';
        const header = document.createElement('h3');
        header.textContent = monthNames[m];
        monthDiv.appendChild(header);
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        weekdayShort.forEach((wd) => {
            const th = document.createElement('th');
            th.textContent = wd;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        const firstDay = new Date(Date.UTC(year, m, 1));
        const lastDay = new Date(Date.UTC(year, m + 1, 0));
        const numDays = lastDay.getUTCDate();
        let startOffset = (firstDay.getUTCDay() + 6) % 7;
        let row = document.createElement('tr');
        for (let i = 0; i < startOffset; i++) {
            row.appendChild(document.createElement('td'));
        }
        for (let day = 1; day <= numDays; day++) {
            const dateObj = new Date(Date.UTC(year, m, day));
            const dateStr = dateObj.toISOString().split('T')[0];
            const cell = document.createElement('td');
            cell.textContent = day;
            const weekday = dateObj.getUTCDay();
            const isWeekend = (weekday === 0 || weekday === 6);
            if (isWeekend) cell.classList.add('weekend');
            if (holidaySet.has(dateStr)) cell.classList.add('holiday');
            if (breakDates.has(dateStr)) cell.classList.add('break-day');
            if (vacationDates.has(dateStr)) cell.classList.add('vacation');
            // Tooltip-Informationen erzeugen
            const details = (() => {
                // Feiertag
                if (holidaySet.has(dateStr)) {
                    const name = holidayMap[dateStr];
                    return `${formatDate(dateObj)} – ${name} (Feiertag)`;
                }
                // Urlaubstag (Brückentag)
                if (vacationDates.has(dateStr)) {
                    return `${formatDate(dateObj)} – Urlaubstag`;
                }
                // Freier Tag im Urlaubspaket
                if (breakDates.has(dateStr)) {
                    return `${formatDate(dateObj)} – Freier Tag`;
                }
                // Wochenende
                if (isWeekend) {
                    return `${formatDate(dateObj)} – Wochenende`;
                }
                // Kein spezieller Tag
                return `${formatDate(dateObj)}`;
            })();
            // Event-Listener für Tooltip
            cell.addEventListener('mouseenter', (e) => {
                showTooltip(e, details);
            });
            cell.addEventListener('mousemove', (e) => {
                moveTooltip(e);
            });
            cell.addEventListener('mouseleave', hideTooltip);

            row.appendChild(cell);
            startOffset++;
            if (startOffset % 7 === 0) {
                tbody.appendChild(row);
                row = document.createElement('tr');
            }
        }
        if (row.children.length > 0) {
            while (row.children.length < 7) {
                row.appendChild(document.createElement('td'));
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        monthDiv.appendChild(table);
        container.appendChild(monthDiv);
    }
}

/*
 * Vorschläge für Reiseziele pro Monat. Die Einträge orientieren sich an einem
 * Artikel über Reiseziele in Europa für 2025【40811128156826†L304-L344】【40811128156826†L415-L439】【40811128156826†L520-L559】.
 */
const DESTINATIONS = {
    0: [
        { name: 'Karlovy Vary, Tschechien', description: 'Historische Kurstadt mit Thermalquellen und UNESCO‑Welterbe', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#january' }
    ],
    1: [
        { name: 'Andalusien, Spanien', description: 'Flamenco, maurische Architektur und warme Wintersonne', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#february' }
    ],
    2: [
        { name: 'Sizilien, Italien', description: 'Mediterrane Lebensfreude, antike Stätten und frühlingshaftes Wetter', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#march' }
    ],
    3: [
        { name: 'Prag, Wien & Budapest', description: 'Städetrip durch die kaiserlichen Hauptstädte Mitteleuropas', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#april' }
    ],
    4: [
        { name: 'Ljubljana, Slowenien', description: 'Kompakte Hauptstadt mit viel Charme, Kultur und Kulinarik', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#may' }
    ],
    5: [
        { name: 'Korčula, Kroatien', description: 'Insel im adriatischen Meer mit historischer Altstadt und türkisfarbenem Wasser', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#june' }
    ],
    6: [
        { name: 'Porto, Portugal', description: 'Charmante Küstenstadt mit Douro‑Fluss, Portwein und atemberaubenden Sonnenuntergängen', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#july' }
    ],
    7: [
        { name: 'Baltische Staaten (Riga, Vilnius, Tallinn)', description: 'Unbekannte Schönheiten im Norden Europas mit mittelalterlichen Altstädten', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#august' }
    ],
    8: [
        { name: 'Genf, Schweiz', description: 'Elegante Stadt am Genfersee mit Schokolade, Uhren und internationalem Flair', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#september' }
    ],
    9: [
        { name: 'Sardinien, Italien', description: 'Mittelmeerinsel mit einsamen Stränden, sardischer Kultur und weniger Touristen im Herbst', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#october' }
    ],
    10: [
        { name: 'Kreta, Griechenland', description: 'Größte griechische Insel mit antiken Stätten, mildem Novemberklima und authentischem Leben', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#november' }
    ],
    11: [
        { name: 'Straßburg, Frankreich', description: 'Weihnachtshauptstadt Europas mit berühmten Weihnachtsmärkten', link: 'https://jaywaytravel.com/blog/where-to-travel-in-2025-in-europe#december' }
    ]
};

// Aktualisiert die Liste der Reiseziele basierend auf den ausgewählten Urlauben
function generateDestinations(selectedPlan) {
    const listEl = document.getElementById('destinationsList');
    if (!listEl) return;
    listEl.innerHTML = '';
    const months = new Set();
    selectedPlan.forEach((s) => {
        const month = s.breakStart.getUTCMonth();
        months.add(month);
    });
    // Für jeden Monat bis zu drei Vorschläge anzeigen
    months.forEach((m) => {
        const suggestions = DESTINATIONS[m] || [];
        suggestions.slice(0, 3).forEach((item) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = item.link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = item.name;
            li.appendChild(a);
            if (item.description) {
                const span = document.createElement('span');
                span.textContent = ` – ${item.description}`;
                li.appendChild(span);
            }
            listEl.appendChild(li);
        });
    });
}

// Format a Date object into DD.MM.YYYY (German notation)
function formatDate(date) {
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();
    return `${dd}.${mm}.${yyyy}`;
}

// Format bridging days list into a human‑readable string (DD.MM.)
function formatBridgingList(dates) {
    return dates.map((d) => {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        return `${day}.${month}.`;
    }).join(', ');
}

// Get day of week in German for a Date
function weekdayName(date) {
    const names = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    return names[date.getUTCDay()];
}

// Aktualisiert Tabelle, Kalender und Reiseziele basierend auf den Eingaben
function updateTable() {
    const yearInput = document.getElementById('yearSelect');
    const stateSelect = document.getElementById('stateSelect');
    const vacationInput = document.getElementById('vacationDaysInput');
    const tableBody = document.querySelector('#suggestionTable tbody');
    const noMsg = document.getElementById('noSuggestions');
    const year = parseInt(yearInput.value, 10);
    const state = stateSelect.value;
    const availableDays = parseInt(vacationInput.value, 10);
    // Alle Brückentagssuggestionen berechnen
    const suggestions = computeBridgingSuggestions(year, state);
    // Optimale Auswahl basierend auf verfügbaren Urlaubstagen ermitteln
    const selectedPlan = computeRecommendedPlan(suggestions, availableDays);

    // Kombi-Vorschläge aus benachbarten Zeiträumen
    function findCombinedSuggestions(plan) {
        const kombis = [];
        for (let i = 0; i < plan.length - 1; i++) {
            const a = plan[i];
            const b = plan[i + 1];
            const endA = new Date(a.breakEnd);
            const startB = new Date(b.breakStart);
            const diffDays = (startB - endA) / (1000 * 60 * 60 * 24);
            if (diffDays >= -1 && diffDays <= 1) {
                kombis.push({
                    combined: true,
                    holidays: [a.holiday, b.holiday],
                    breakStart: new Date(a.breakStart),
                    breakEnd: new Date(b.breakEnd),
                    vacationDays: a.vacationDays + b.vacationDays,
                    totalDays: Math.round((b.breakEnd - a.breakStart) / (1000 * 60 * 60 * 24)) + 1,
                    bridgingDays: [...a.bridgingDays, ...b.bridgingDays],
                    original: [a, b]
                });
            }
        }
        return kombis;
    }

    const combinedSuggestions = findCombinedSuggestions(selectedPlan);
    // Tabelle leeren und neu füllen
    tableBody.innerHTML = '';
    // Sortiere die ausgewählten Vorschläge chronologisch nach Datum
    selectedPlan.sort((a, b) => {
        // date ist bereits ein Date-Objekt mit UTC-Zeit; direkte Subtraktion vergleicht Millisekunden
        return a.date - b.date;
    });
    if (selectedPlan.length === 0) {
        noMsg.style.display = 'block';
    } else {
        noMsg.style.display = 'none';
        // Gruppe nach Monaten: Erzeuge eine Überschriftszeile, wenn der Monat wechselt
        let lastMonth = null;
        selectedPlan.forEach((s) => {
            const d = s.date; // Date-Objekt
            const m = d.getUTCMonth();
            const y = d.getUTCFullYear();
            if (lastMonth === null || m !== lastMonth) {
                // Insert month heading row
                const headerRow = document.createElement('tr');
                headerRow.classList.add('month-header');
                headerRow.innerHTML = `<td colspan="7">${MONTH_NAMES[m]} ${y}</td>`;
                tableBody.appendChild(headerRow);
                lastMonth = m;
            }
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${s.holiday}</td>
                <td>${formatDate(s.date)}</td>
                <td>${weekdayName(s.date)}</td>
                <td>${s.type}</td>
                <td>${s.vacationDays}</td>
                <td>${s.totalDays}</td>
                <td>${s.vacationDays > 0 ? formatBridgingList(s.bridgingDays) : '–'}</td>
            `;
            tableBody.appendChild(row);
        });
    }
    // Zusammenfassung der verwendeten Urlaubstage anzeigen
    const summaryEl = document.getElementById('vacationSummary');
    if (summaryEl) {
        const totalUsed = selectedPlan.reduce((sum, s) => sum + s.vacationDays, 0);
        const available = isNaN(availableDays) ? 0 : availableDays;
        if (selectedPlan.length === 0) {
            summaryEl.textContent = '';
        } else {
            summaryEl.textContent = `Insgesamt verwendete Urlaubstage: ${totalUsed}` + (available ? ` von ${available}` : '');
        }
    }

    // Kombi-Vorschläge Tabelle anzeigen
    const comboTable = document.getElementById('comboSuggestions');
    if (comboTable) {
        comboTable.innerHTML = '';
        if (combinedSuggestions.length > 0) {
            combinedSuggestions.forEach((c) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${c.holidays.join(' + ')}</td>
                    <td>${formatDate(c.breakStart)}</td>
                    <td>${formatDate(c.breakEnd)}</td>
                    <td>${c.vacationDays}</td>
                    <td>${c.totalDays}</td>
                `;
                comboTable.appendChild(row);
            });
        }
    }
    // Aktualisiere Untertitel
    const subtitle = document.getElementById('subtitle');
    subtitle.textContent = `Urlaubsplaner mit Brückentagen für ${STATE_NAMES[state]} im Jahr ${year}`;
    // Kalender und Reiseziele generieren
    generateCalendar(year, state, selectedPlan);
    generateDestinations(selectedPlan);
    // Global speichern und Einstellungen sichern
    latestPlan = selectedPlan;
    saveSettings();
}

// Initialize the page
function init() {
    populateStateSelect();
    // Set default year/state/days and dark mode from saved settings if available
    const now = new Date();
    const yearInput = document.getElementById('yearSelect');
    const stateSelectEl = document.getElementById('stateSelect');
    const vacationInput = document.getElementById('vacationDaysInput');
    // Load saved settings
    loadSettings();
    // If still empty, fallback to defaults
    if (!yearInput.value) {
        yearInput.value = now.getUTCFullYear();
    }
    if (!stateSelectEl.value) {
        stateSelectEl.value = 'DE';
    }
    if (vacationInput && (vacationInput.value === '' || vacationInput.value === undefined)) {
        vacationInput.value = 20;
    }
    // Attach event listener to form submission
    const form = document.getElementById('controlForm');
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        updateTable();
    });
    // Event listener für Buttons
    const exportBtn = document.getElementById('exportButton');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportToIcs(latestPlan);
        });
    }
    const darkToggleBtn = document.getElementById('darkModeToggle');
    if (darkToggleBtn) {
        darkToggleBtn.addEventListener('click', () => {
            toggleDarkMode();
        });
    }
    const reminderBtn = document.getElementById('reminderButton');
    if (reminderBtn) {
        reminderBtn.addEventListener('click', () => {
            showReminders();
        });
    }
    // Initial table
    updateTable();
    // Tooltip initialisieren
    initTooltip();
}

// Run init after DOM content loaded
document.addEventListener('DOMContentLoaded', init);
