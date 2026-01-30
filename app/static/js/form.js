// Global array to store entries
let entries = [];
let entryCounter = 1;

// Global state for group capacities
let groupCapacities = {}; // { "GROUP001": 30, "GROUP002": 45, ... }
let capacitiesConfigured = false; // Tracks whether capacities have been set

// V4: Global state for excluded dates
// Array of objects: [{ date: "2026-02-09", replacement: "2026-03-01" }, { date: "2026-02-16", replacement: null }]
let excludedDates = [];

// V4: Global state for week venue and lecturer details
let weekVenueDetails = {}; // { "2026-01-01": { faculty_code: "FAC001", special_room_code: "" }, ... }
let weekDetailsConfigured = false; // Tracks whether week details have been set

// V4.1: Global cache for academic session commencement weeks
let academicSessionData = {}; // { "EXMS-2026-268": { week1: "09.02.2026", week2: "16.02.2026" }, ... }

$(document).ready(function() {
    // Initialize Select2 for all dropdowns
    initializeSelect2();

    // Load glossary data for all dropdowns
    loadGlossaries();

    // Handle form submission (Add Entry)
    $('#dtctForm').on('submit', handleAddEntry);

    // V4.1: Handle Academic Session change to update Class Commencement options
    $('#academic_session_code').on('change', updateClassCommencementOptions);

    // Handle Clear Form button
    $('#clearFormBtn').on('click', clearForm);

    // Handle Generate All button
    $('#generateAllBtn').on('click', handleGenerateAll);

    // Handle group selection changes
    $('#group_codes').on('change', handleGroupSelectionChange);

    // Handle capacity button click
    $('#setCapacityBtn').on('click', openCapacityModal);

    // Handle save capacities
    $('#saveCapacitiesBtn').on('click', saveGroupCapacities);

    // Real-time total calculation in modal
    $(document).on('input', '.capacity-input', updateModalTotal);

    // V4: Exclude Dates handlers
    $('#setExcludeDatesBtn').on('click', openExcludeDatesModal);
    $('#saveExcludeDatesBtn').on('click', saveExcludeDates);

    // V4: Week Venue handlers
    $('#setWeekVenueBtn').on('click', openWeekVenueModal);
    $('#saveWeekVenueBtn').on('click', saveWeekVenueDetails);
    $('#applyToAllWeeksBtn').on('click', applyToAllWeeks);

    // V4: Trigger updates when relevant fields change
    $('#class_commencement').on('change', function() {
        updateExcludeDatesButtonState();
        updateWeekVenueButtonState();
    });
    $('#recurring_until_week').on('change input', function() {
        updateExcludeDatesButtonState();
        updateWeekVenueButtonState();
    });
});

function initializeSelect2() {
    // Single select dropdowns
    $('.select2-single').select2({
        theme: 'bootstrap-5',
        placeholder: 'Select an option',
        allowClear: true,
        width: '100%'
    });

    // Multi-select dropdowns
    $('.select2-multiple').select2({
        theme: 'bootstrap-5',
        placeholder: 'Select one or more options',
        allowClear: true,
        width: '100%',
        closeOnSelect: false
    });
}

function loadGlossaries() {
    // Load all glossary types
    const glossaryTypes = [
        { type: 'academicsession', elementId: 'academic_session_code' },
        { type: 'programme', elementId: 'programme_code' },
        { type: 'activity', elementId: 'activity_code' },
        { type: 'specialroom', elementId: 'request_special_room_code' },
        { type: 'course', elementId: 'course_codes' },
        { type: 'group', elementId: 'group_codes' },
        { type: 'faculty', elementId: 'faculty_code' }
    ];

    glossaryTypes.forEach(glossary => {
        loadGlossaryData(glossary.type, glossary.elementId);
    });
}

function loadGlossaryData(glossaryType, elementId) {
    $.ajax({
        url: `/api/glossary/${glossaryType}`,
        method: 'GET',
        success: function(data) {
            const select = $(`#${elementId}`);

            // Keep the first option (placeholder) if it exists
            const hasPlaceholder = select.find('option:first').val() === '';

            // Clear existing options except placeholder
            if (hasPlaceholder) {
                select.find('option:not(:first)').remove();
            } else {
                select.empty();
            }

            // Add new options
            data.forEach(item => {
                const optionText = item.description
                    ? `${item.code} - ${item.description}`
                    : item.code;

                select.append(new Option(optionText, item.code, false, false));

                // V4.1: Cache academic session commencement weeks
                if (glossaryType === 'academicsession') {
                    academicSessionData[item.code] = {
                        week1: item.commencement_week_1 || '',
                        week2: item.commencement_week_2 || ''
                    };
                }
            });

            // Refresh Select2
            select.trigger('change');
        },
        error: function(error) {
            console.error(`Error loading ${glossaryType} glossary:`, error);
            showError(`Failed to load ${glossaryType} data. Please refresh the page.`);
        }
    });
}

function updateClassCommencementOptions() {
    /**
     * V4.1: Dynamically populate Class Commencement dropdown based on selected Academic Session.
     * Generates dates from Commencement Week 1 (+6 days) and Commencement Week 2 (+6 days).
     * Skips Sundays only (Saturday is allowed).
     */
    const selectedCode = $('#academic_session_code').val();
    const select = $('#class_commencement');

    // Clear existing options except placeholder
    select.find('option:not(:first)').remove();

    // Reset dependent fields when academic session changes
    excludedDates = [];
    weekVenueDetails = {};
    weekDetailsConfigured = false;
    updateExcludeDatesButtonState();
    updateWeekVenueButtonState();

    if (!selectedCode || !academicSessionData[selectedCode]) {
        select.trigger('change');
        return;
    }

    const sessionData = academicSessionData[selectedCode];
    const week1 = sessionData.week1;
    const week2 = sessionData.week2;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /**
     * Parse DD.MM.YYYY date string and generate 7 days of options (skipping Sundays)
     */
    function addWeekOptions(dateStr) {
        if (!dateStr) return;

        // Parse DD.MM.YYYY format manually to avoid timezone issues
        const parts = dateStr.split('.');
        if (parts.length !== 3) return;

        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // month is 0-indexed
        const year = parseInt(parts[2], 10);

        let currentDate = new Date(year, month, day);

        // Generate 7 days (start date + 6 days)
        for (let i = 0; i < 7; i++) {
            const dayOfWeek = currentDate.getDay();

            // Skip Sunday (0) only - Saturday (6) is allowed
            if (dayOfWeek !== 0) {
                const dayName = dayNames[dayOfWeek];
                const d = currentDate.getDate();
                const m = monthNames[currentDate.getMonth()];
                const y = currentDate.getFullYear();

                const displayText = `${dayName}, ${d} ${m} ${y}`;

                // Format value as YYYY-MM-DD using local date methods
                const valueYear = currentDate.getFullYear();
                const valueMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
                const valueDay = String(currentDate.getDate()).padStart(2, '0');
                const value = `${valueYear}-${valueMonth}-${valueDay}`;

                select.append(new Option(displayText, value, false, false));
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    // Add options from both weeks
    addWeekOptions(week1);
    addWeekOptions(week2);

    // Refresh Select2
    select.trigger('change');
}

function handleAddEntry(e) {
    e.preventDefault();

    // Hide previous messages
    $('#resultMessage').addClass('d-none');
    $('#errorMessage').addClass('d-none');

    // Validate form
    if (!validateForm()) {
        return;
    }

    // Collect form data
    const formData = collectFormData();

    // Assign entry number
    formData.entryNumber = entryCounter++;

    // Add to entries array
    entries.push(formData);

    // Update table
    updateEntriesTable();

    // Show entries section
    $('#entriesSection').removeClass('d-none');

    // Clear form for next entry
    clearForm();

    // Scroll to entries table
    $('html, body').animate({
        scrollTop: $('#entriesSection').offset().top - 100
    }, 500);

    showSuccess('Entry added successfully! You can add more entries or click "Generate Excel File".');

    // Auto-hide success message after 3 seconds
    setTimeout(() => {
        $('#resultMessage').addClass('d-none');
    }, 3000);
}

function collectFormData() {
    const commencementDate = $('#class_commencement').val();
    const recurringWeeks = parseInt($('#recurring_until_week').val());

    // V4: Calculate recurring dates (for backend processing)
    const recurringDates = calculateRecurringDates(commencementDate, recurringWeeks, excludedDates);

    return {
        academic_session_code: $('#academic_session_code').val(),
        academic_session_text: $('#academic_session_code option:selected').text(),
        programme_code: $('#programme_code').val() || '', // V4: Now optional
        programme_text: $('#programme_code option:selected').text() || '',
        class_commencement: commencementDate,
        class_commencement_text: $('#class_commencement option:selected').text(),
        duration: parseInt($('#duration').val()),
        activity_code: $('#activity_code').val(),
        activity_text: $('#activity_code option:selected').text(),
        group_capacities: { ...groupCapacities }, // Clone the object
        course_codes: $('#course_codes').val(),
        course_texts: $('#course_codes option:selected').map((i, el) => $(el).text()).get(),
        group_codes: $('#group_codes').val(),
        group_texts: $('#group_codes option:selected').map((i, el) => $(el).text()).get(),
        recurring_until_week: recurringWeeks,

        // V4: New fields
        excluded_dates: [...excludedDates],
        week_venue_details: { ...weekVenueDetails },
        recurring_dates: recurringDates // Pre-calculated dates for backend
    };
}

function updateEntriesTable() {
    const tbody = $('#entriesTableBody');
    tbody.empty();

    entries.forEach((entry, index) => {
        // V4: Calculate excluded dates display with replacement count
        const excludedArr = entry.excluded_dates || [];
        const excludedCount = excludedArr.length;
        const replacementCount = excludedArr.filter(e => e && e.replacement).length;
        let excludedText = '-';
        if (excludedCount > 0) {
            excludedText = `${excludedCount} excluded`;
            if (replacementCount > 0) {
                excludedText += `, ${replacementCount} replaced`;
            }
        }

        const row = `
            <tr>
                <td>
                    <div class="formid-badge">Entry ${entry.entryNumber}</div>
                </td>
                <td><small>${entry.academic_session_code}</small></td>
                <td><small>${entry.programme_code || '-'}</small></td>
                <td><small>${entry.class_commencement}</small></td>
                <td>${entry.duration}h</td>
                <td><small>${entry.activity_code}</small></td>
                <td>${calculateTotalCapacity(entry.group_capacities)}</td>
                <td>${formatCourseInfo(entry.course_codes, entry.course_texts)}</td>
                <td>${formatArrayBadges(entry.group_codes)}</td>
                <td>${entry.recurring_until_week}</td>
                <td><small>${excludedText}</small></td>
                <td>
                    <button class="btn btn-action btn-edit me-1" onclick="editEntry(${index})">Edit</button>
                    <button class="btn btn-action btn-delete" onclick="deleteEntry(${index})">Delete</button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });

    // Update count
    $('#entryCount').text(entries.length);
}

function formatArrayBadges(arr) {
    if (!arr || arr.length === 0) return '-';
    return arr.map(item => `<span class="value-badge">${item}</span>`).join('');
}

function formatCourseInfo(codes, texts) {
    if (!codes || codes.length === 0) return '-';
    return codes.map((code, index) => {
        const text = texts && texts[index] ? texts[index] : code;
        // Extract course name (after " - ") if available
        let displayText = code;
        if (text.includes(' - ')) {
            const parts = text.split(' - ');
            displayText = `${parts[0]}<br><small class="text-muted">${parts[1]}</small>`;
        }
        return `<span class="value-badge">${displayText}</span>`;
    }).join('');
}

function editEntry(index) {
    const entry = entries[index];

    // Populate form with entry data
    $('#academic_session_code').val(entry.academic_session_code).trigger('change');
    $('#programme_code').val(entry.programme_code).trigger('change');
    $('#class_commencement').val(entry.class_commencement).trigger('change');
    $('#duration').val(entry.duration);
    $('#activity_code').val(entry.activity_code).trigger('change');
    $('#course_codes').val(entry.course_codes).trigger('change');
    $('#group_codes').val(entry.group_codes).trigger('change');
    $('#recurring_until_week').val(entry.recurring_until_week);

    // Restore group capacities
    groupCapacities = { ...entry.group_capacities };
    capacitiesConfigured = true;

    // V4: Restore exclude dates
    excludedDates = [...(entry.excluded_dates || [])];

    // V4: Restore week venue details
    weekVenueDetails = { ...(entry.week_venue_details || {}) };
    weekDetailsConfigured = Object.keys(weekVenueDetails).length > 0;

    // Trigger group change to update UI (after groups are set)
    setTimeout(() => {
        handleGroupSelectionChange();
        updateExcludeDatesButtonState();
        updateWeekVenueButtonState();
    }, 100);

    // Remove the entry from list
    entries.splice(index, 1);
    updateEntriesTable();

    // Scroll to form
    $('html, body').animate({
        scrollTop: $('.form-container').offset().top - 100
    }, 500);

    // Hide entries section if no entries
    if (entries.length === 0) {
        $('#entriesSection').addClass('d-none');
    }
}

function deleteEntry(index) {
    if (confirm('Are you sure you want to delete this entry?')) {
        entries.splice(index, 1);
        updateEntriesTable();

        // Hide entries section if no entries
        if (entries.length === 0) {
            $('#entriesSection').addClass('d-none');
        }
    }
}

function clearForm() {
    $('#dtctForm')[0].reset();
    $('.select2-single').val(null).trigger('change');
    $('.select2-multiple').val(null).trigger('change');
    $('#duration').val(0);
    $('#recurring_until_week').val(14);

    // Clear capacity data
    groupCapacities = {};
    capacitiesConfigured = false;
    $('#setCapacityBtn').prop('disabled', true).html('<i class="bi bi-pencil-square"></i> Select groups first');
    $('#capacityStatusDisplay').addClass('d-none');

    // V4: Clear exclude dates
    excludedDates = [];
    $('#setExcludeDatesBtn').prop('disabled', true).html('<i class="bi bi-calendar-x"></i> <span id="excludeDatesBtnText">Set commencement date first</span>');
    $('#setExcludeDatesBtn').removeClass('btn-warning').addClass('btn-outline-primary');

    // V4: Clear week venue details
    weekVenueDetails = {};
    weekDetailsConfigured = false;
    updateWeekVenueButtonState();
}

function handleGenerateAll() {
    if (entries.length === 0) {
        showError('Please add at least one entry before generating.');
        return;
    }

    // Hide previous messages
    $('#resultMessage').addClass('d-none');
    $('#errorMessage').addClass('d-none');

    // Show loading
    showGenerateLoading(true);

    // Send all entries to backend
    $.ajax({
        url: '/api/generate-multiple',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ entries: entries }),
        success: function(response) {
            showGenerateLoading(false);
            showSuccess(`Excel file generated successfully!<br>
                        Total entries: ${entries.length}<br>
                        Total rows generated: ${response.row_count}<br>
                        Form IDs: ${response.form_ids.join(', ')}`);

            $('#downloadLink').attr('href', `/download/${response.file_path}`);

            // Clear entries after successful generation
            entries = [];
            entryCounter = 1;
            updateEntriesTable();
            $('#entriesSection').addClass('d-none');
        },
        error: function(xhr) {
            showGenerateLoading(false);
            const errorMsg = xhr.responseJSON?.error || 'An error occurred while generating the file.';
            showError(errorMsg);
        }
    });
}

// ===== Group Capacity Handler Functions =====

function handleGroupSelectionChange() {
    const selectedGroups = $('#group_codes').val() || [];
    const setCapacityBtn = $('#setCapacityBtn');

    if (selectedGroups.length === 0) {
        // No groups selected
        setCapacityBtn.prop('disabled', true);
        setCapacityBtn.html('<i class="bi bi-pencil-square"></i> Select groups first');
        setCapacityBtn.removeClass('btn-warning').addClass('btn-outline-primary');
        $('#capacityStatusDisplay').addClass('d-none');
        capacitiesConfigured = false;
        groupCapacities = {};
    } else {
        // Groups selected
        setCapacityBtn.prop('disabled', false);

        // Check if selection changed after capacities were set
        const currentGroupSet = new Set(selectedGroups);
        const configuredGroupSet = new Set(Object.keys(groupCapacities));

        const groupsMatch = currentGroupSet.size === configuredGroupSet.size &&
                           [...currentGroupSet].every(g => configuredGroupSet.has(g));

        if (!capacitiesConfigured || !groupsMatch) {
            // Groups changed or not yet configured
            setCapacityBtn.html('<i class="bi bi-exclamation-triangle"></i> Set Group Capacities');
            setCapacityBtn.removeClass('btn-outline-primary').addClass('btn-warning');
            capacitiesConfigured = false;

            // Preserve existing capacity values for groups still selected
            const newCapacities = {};
            selectedGroups.forEach(group => {
                newCapacities[group] = groupCapacities[group] || 0;
            });
            groupCapacities = newCapacities;

            $('#capacityStatusDisplay').addClass('d-none');
        } else {
            // Capacities already configured for current selection
            setCapacityBtn.html('<i class="bi bi-check-circle"></i> Edit Group Capacities');
            setCapacityBtn.removeClass('btn-warning').addClass('btn-outline-primary');
            updateCapacityStatusDisplay();
        }
    }
}

function openCapacityModal() {
    const selectedGroups = $('#group_codes').val() || [];
    const tableBody = $('#capacityTableBody');
    tableBody.empty();

    // Get display text for each group
    const groupTexts = {};
    $('#group_codes option:selected').each(function() {
        const code = $(this).val();
        groupTexts[code] = $(this).text();
    });

    // Populate table rows
    selectedGroups.forEach((groupCode, index) => {
        const capacity = groupCapacities[groupCode] || 0;
        const row = `
            <tr>
                <td>
                    <strong>${groupCode}</strong>
                    <br>
                    <small class="text-muted">${groupTexts[groupCode]}</small>
                </td>
                <td>
                    <input type="number"
                           class="form-control capacity-input"
                           data-group-code="${groupCode}"
                           value="${capacity}"
                           min="0"
                           required
                           placeholder="Enter capacity">
                </td>
            </tr>
        `;
        tableBody.append(row);
    });

    updateModalTotal();

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('capacityModal'));
    modal.show();
}

function updateModalTotal() {
    let total = 0;
    $('.capacity-input').each(function() {
        const value = parseInt($(this).val()) || 0;
        total += value;
    });
    $('#modalTotalCapacity').text(total);
}

function saveGroupCapacities() {
    // Validate all fields are filled with valid numbers
    let isValid = true;
    const newCapacities = {};

    $('.capacity-input').each(function() {
        const input = $(this);
        const groupCode = input.data('group-code');
        const value = parseInt(input.val());

        if (isNaN(value) || value < 0) {
            isValid = false;
            input.addClass('is-invalid');
        } else {
            input.removeClass('is-invalid');
            newCapacities[groupCode] = value;
        }
    });

    if (!isValid) {
        showError('Please enter valid capacity values (0 or greater) for all groups.');
        return;
    }

    // Hide any previous error message
    $('#errorMessage').addClass('d-none');

    // Save to global state
    groupCapacities = newCapacities;
    capacitiesConfigured = true;

    // Update button and display
    $('#setCapacityBtn').html('<i class="bi bi-check-circle"></i> Edit Group Capacities');
    $('#setCapacityBtn').removeClass('btn-warning').addClass('btn-outline-primary');
    updateCapacityStatusDisplay();

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('capacityModal')).hide();

    // Show brief success message
    showSuccess('Group capacities saved successfully!');
    setTimeout(() => {
        $('#resultMessage').addClass('d-none');
    }, 2000);
}

function updateCapacityStatusDisplay() {
    const total = Object.values(groupCapacities).reduce((sum, cap) => sum + cap, 0);
    const groupCount = Object.keys(groupCapacities).length;

    $('#totalCapacityDisplay').text(total);
    $('#groupCountDisplay').text(groupCount);
    $('#capacityStatusDisplay').removeClass('d-none');
}

function calculateTotalCapacity(groupCapacities) {
    if (!groupCapacities) return 0;
    return Object.values(groupCapacities).reduce((sum, cap) => sum + cap, 0);
}

function validateForm() {
    // Check if group capacities are configured
    if (!capacitiesConfigured || Object.keys(groupCapacities).length === 0) {
        showError('Please set capacities for all selected groups.');
        $('#setCapacityBtn').focus();
        return false;
    }

    // Verify capacities match current group selection
    const selectedGroups = $('#group_codes').val() || [];
    const groupsMatch = selectedGroups.length === Object.keys(groupCapacities).length &&
                       selectedGroups.every(g => groupCapacities.hasOwnProperty(g));

    if (!groupsMatch) {
        showError('Group selection has changed. Please update group capacities.');
        $('#setCapacityBtn').focus();
        return false;
    }

    // V4: Check if week venue details are configured
    if (!weekDetailsConfigured || Object.keys(weekVenueDetails).length === 0) {
        showError('Please configure week venue and lecturer details.');
        $('#setWeekVenueBtn').focus();
        return false;
    }

    // V4: Verify week details match current dates
    const commencementDate = $('#class_commencement').val();
    const recurringWeeks = parseInt($('#recurring_until_week').val());
    const expectedDates = calculateRecurringDates(commencementDate, recurringWeeks, excludedDates);

    const datesMatch = expectedDates.length === Object.keys(weekVenueDetails).length &&
                      expectedDates.every(d => weekVenueDetails.hasOwnProperty(d.date));

    if (!datesMatch) {
        showError('Date configuration has changed. Please update week venue details.');
        $('#setWeekVenueBtn').focus();
        return false;
    }

    // Check required fields (V4: removed programme_code and faculty_code)
    const requiredFields = [
        { id: 'academic_session_code', name: 'Academic Session Code' },
        { id: 'class_commencement', name: 'Class Commencement' },
        { id: 'duration', name: 'Duration' },
        { id: 'activity_code', name: 'Activity Code' },
        { id: 'recurring_until_week', name: 'Recurring Until Week' }
    ];

    for (const field of requiredFields) {
        const value = $(`#${field.id}`).val();
        if (!value || value === '') {
            showError(`${field.name} is required.`);
            $(`#${field.id}`).focus();
            return false;
        }
    }

    // Check multi-select fields
    const multiSelectFields = [
        { id: 'course_codes', name: 'Course Code(s)' },
        { id: 'group_codes', name: 'Group Code(s)' }
    ];

    for (const field of multiSelectFields) {
        const value = $(`#${field.id}`).val();
        if (!value || value.length === 0) {
            showError(`At least one ${field.name} must be selected.`);
            $(`#${field.id}`).select2('open');
            return false;
        }
    }

    // Validate integer fields
    const duration = parseInt($('#duration').val());
    const recurringWeek = parseInt($('#recurring_until_week').val());

    if (duration < 0) {
        showError('Duration must be 0 or greater.');
        $('#duration').focus();
        return false;
    }

    if (recurringWeek < 1) {
        showError('Recurring Until Week must be at least 1.');
        $('#recurring_until_week').focus();
        return false;
    }

    return true;
}

function showGenerateLoading(isLoading) {
    const btn = $('#generateAllBtn');
    const btnText = $('#genBtnText');
    const btnSpinner = $('#genBtnSpinner');

    if (isLoading) {
        btn.prop('disabled', true);
        btnText.text('Generating...');
        btnSpinner.removeClass('d-none');
    } else {
        btn.prop('disabled', false);
        btnText.text('Generate Excel File');
        btnSpinner.addClass('d-none');
    }
}

function showSuccess(message) {
    $('#resultText').html(message);
    $('#resultMessage').removeClass('d-none');

    // Scroll to result
    $('html, body').animate({
        scrollTop: $('#resultMessage').offset().top - 100
    }, 500);
}

function showError(message) {
    $('#errorText').text(message);
    $('#errorMessage').removeClass('d-none');

    // Scroll to error
    $('html, body').animate({
        scrollTop: $('#errorMessage').offset().top - 100
    }, 500);
}

// ===== V4: Date Calculation Functions =====

function calculateRecurringDates(startDateStr, weekCount, excludedDatesArr) {
    /**
     * Calculate recurring dates based on start date, week count, and exclusions.
     * If a date is excluded and has a replacement, use the replacement date.
     * If a date is excluded without replacement, skip it entirely (no additional week added).
     *
     * @param {string} startDateStr - Start date in YYYY-MM-DD format
     * @param {number} weekCount - Number of weeks to iterate through
     * @param {Array<{date: string, replacement: string|null}>} excludedDatesArr - Array of exclusion objects
     * @returns {Array<{date: string, weekNumber: number, displayDate: string, isReplacement: boolean}>} - Array of date objects
     */
    const result = [];

    if (!startDateStr || weekCount < 1) {
        return result;
    }

    // Build lookup for excluded dates and their replacements
    // Handle both old format (array of strings) and new format (array of objects)
    const excludedMap = new Map();
    (excludedDatesArr || []).forEach(item => {
        if (typeof item === 'string') {
            // Old format: just a date string, no replacement
            excludedMap.set(item, null);
        } else if (item && item.date) {
            // New format: object with date and replacement
            excludedMap.set(item.date, item.replacement || null);
        }
    });

    // Parse the date string manually to avoid timezone issues
    const [year, month, day] = startDateStr.split('-').map(Number);
    let currentDate = new Date(year, month - 1, day); // month is 0-indexed

    // Iterate through exactly weekCount weeks
    for (let weekNumber = 1; weekNumber <= weekCount; weekNumber++) {
        // Format date as YYYY-MM-DD using local date methods
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (excludedMap.has(dateStr)) {
            // This date is excluded
            const replacement = excludedMap.get(dateStr);
            if (replacement) {
                // Use replacement date instead
                result.push({
                    date: replacement,
                    weekNumber: weekNumber,
                    displayDate: formatDateForDisplay(replacement),
                    isReplacement: true,
                    originalDate: dateStr
                });
            }
            // If no replacement, skip this week entirely (don't add to result)
        } else {
            result.push({
                date: dateStr,
                weekNumber: weekNumber,
                displayDate: formatDateForDisplay(dateStr),
                isReplacement: false
            });
        }

        // Move to next week
        currentDate.setDate(currentDate.getDate() + 7);
    }

    return result;
}

function formatDateForDisplay(dateStr) {
    // Parse manually to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
}

// ===== V4: Exclude Dates Functions =====

function updateExcludeDatesButtonState() {
    const commencementDate = $('#class_commencement').val();
    const recurringWeeks = parseInt($('#recurring_until_week').val()) || 0;
    const btn = $('#setExcludeDatesBtn');

    if (!commencementDate || recurringWeeks < 1) {
        btn.prop('disabled', true);
        btn.html('<i class="bi bi-calendar-x"></i> <span id="excludeDatesBtnText">Set commencement date first</span>');
        btn.removeClass('btn-warning').addClass('btn-outline-primary');
    } else {
        btn.prop('disabled', false);
        updateExcludeDatesDisplay();
    }
}

function openExcludeDatesModal() {
    const commencementDate = $('#class_commencement').val();
    const recurringWeeks = parseInt($('#recurring_until_week').val()) || 0;

    if (!commencementDate || recurringWeeks < 1) {
        showError('Please select a Class Commencement date and set Recurring Until Week first.');
        return;
    }

    // Generate all possible recurring dates (without exclusions applied)
    const allDates = calculateAllRecurringDates(commencementDate, recurringWeeks);

    // Render checkboxes
    renderExcludeDatesCheckboxes(allDates);

    const modal = new bootstrap.Modal(document.getElementById('excludeDatesModal'));
    modal.show();
}

function calculateAllRecurringDates(startDateStr, weekCount) {
    /**
     * Calculate all recurring dates without applying exclusions.
     * Used for showing checkboxes in the exclude dates modal.
     */
    const result = [];

    if (!startDateStr || weekCount < 1) {
        return result;
    }

    const [year, month, day] = startDateStr.split('-').map(Number);
    let currentDate = new Date(year, month - 1, day);

    for (let i = 0; i < weekCount; i++) {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        result.push({
            date: dateStr,
            weekNumber: i + 1,
            displayDate: formatDateForDisplay(dateStr)
        });

        currentDate.setDate(currentDate.getDate() + 7);
    }

    return result;
}

function renderExcludeDatesCheckboxes(dates) {
    const container = $('#excludeDatesListContainer');
    container.empty();

    if (dates.length === 0) {
        container.html('<p class="text-muted text-center">No recurring dates available.</p>');
        return;
    }

    const table = `
        <table class="table table-bordered">
            <thead class="table-light">
                <tr>
                    <th width="10%">Exclude</th>
                    <th width="12%">Week</th>
                    <th width="28%">Date</th>
                    <th width="50%">Replacement Date</th>
                </tr>
            </thead>
            <tbody id="excludeDatesTableBody">
            </tbody>
        </table>
    `;
    container.html(table);

    const tbody = $('#excludeDatesTableBody');

    // Build set of all recurring dates for validation
    const allRecurringDates = new Set(dates.map(d => d.date));

    dates.forEach((dateObj) => {
        // Find existing exclusion data if any
        const existingExclusion = excludedDates.find(e => e.date === dateObj.date);
        const isExcluded = !!existingExclusion;
        const replacementValue = existingExclusion ? (existingExclusion.replacement || '') : '';

        const row = `
            <tr data-date="${dateObj.date}">
                <td class="text-center">
                    <input type="checkbox" class="form-check-input exclude-date-checkbox"
                           data-date="${dateObj.date}" ${isExcluded ? 'checked' : ''}>
                </td>
                <td class="text-center"><strong>Week ${dateObj.weekNumber}</strong></td>
                <td>${dateObj.displayDate}</td>
                <td>
                    <input type="date" class="form-control replacement-date-input"
                           data-date="${dateObj.date}"
                           value="${replacementValue}"
                           ${isExcluded ? '' : 'disabled'}>
                    <div class="replacement-error text-danger small mt-1 d-none"></div>
                </td>
            </tr>
        `;
        tbody.append(row);
    });

    // Bind checkbox toggle handlers
    bindExcludeDateCheckboxHandlers();

    // Bind replacement date validation handlers
    bindReplacementDateValidationHandlers(allRecurringDates);
}

function bindExcludeDateCheckboxHandlers() {
    $('.exclude-date-checkbox').off('change').on('change', function() {
        const checkbox = $(this);
        const dateValue = checkbox.data('date');
        const row = checkbox.closest('tr');
        const replacementInput = row.find('.replacement-date-input');
        const errorDiv = row.find('.replacement-error');

        if (checkbox.is(':checked')) {
            replacementInput.prop('disabled', false);
        } else {
            replacementInput.prop('disabled', true);
            replacementInput.val('');
            replacementInput.removeClass('is-invalid');
            errorDiv.addClass('d-none').text('');
        }

        // Clear global validation error
        $('#excludeDatesValidationError').addClass('d-none');
    });
}

function bindReplacementDateValidationHandlers(allRecurringDates) {
    $('.replacement-date-input').off('change input').on('change input', function() {
        const input = $(this);
        const excludedDate = input.data('date');
        const replacementDate = input.val();
        const errorDiv = input.siblings('.replacement-error');

        // Clear previous error
        input.removeClass('is-invalid');
        errorDiv.addClass('d-none').text('');
        $('#excludeDatesValidationError').addClass('d-none');

        if (!replacementDate) {
            return; // Empty is valid
        }

        // Validate replacement date
        const validationResult = validateReplacementDate(replacementDate, excludedDate, allRecurringDates);
        if (!validationResult.valid) {
            input.addClass('is-invalid');
            errorDiv.removeClass('d-none').text(validationResult.message);
        }
    });
}

function validateReplacementDate(replacementDate, excludedDate, allRecurringDates) {
    /**
     * Validate a replacement date.
     *
     * Rules:
     * 1. Replacement date cannot equal the excluded date
     * 2. Replacement date cannot be an existing recurring date
     * 3. Replacement date cannot duplicate another replacement date
     */

    // Rule 1: Cannot equal the excluded date
    if (replacementDate === excludedDate) {
        return { valid: false, message: 'Replacement date cannot be the same as the excluded date.' };
    }

    // Rule 2: Cannot be an existing recurring date
    if (allRecurringDates.has(replacementDate)) {
        return { valid: false, message: 'Replacement date cannot be an existing recurring date.' };
    }

    // Rule 3: Cannot duplicate another replacement date
    const otherReplacements = [];
    $('.replacement-date-input').each(function() {
        const input = $(this);
        const inputDate = input.data('date');
        if (inputDate !== excludedDate && input.val()) {
            otherReplacements.push(input.val());
        }
    });

    if (otherReplacements.includes(replacementDate)) {
        return { valid: false, message: 'This replacement date is already used for another exclusion.' };
    }

    return { valid: true, message: '' };
}

function saveExcludeDates() {
    // Build set of all recurring dates for validation
    const commencementDate = $('#class_commencement').val();
    const recurringWeeks = parseInt($('#recurring_until_week').val()) || 0;
    const allDates = calculateAllRecurringDates(commencementDate, recurringWeeks);
    const allRecurringDates = new Set(allDates.map(d => d.date));

    // Collect all checked dates with replacement values
    const newExcludedDates = [];
    const errors = [];
    const replacementDatesSeen = new Set();

    $('.exclude-date-checkbox:checked').each(function() {
        const checkbox = $(this);
        const excludedDate = checkbox.data('date');
        const row = checkbox.closest('tr');
        const replacementInput = row.find('.replacement-date-input');
        const replacementDate = replacementInput.val() || null;

        // Validate replacement date if provided
        if (replacementDate) {
            const validationResult = validateReplacementDate(replacementDate, excludedDate, allRecurringDates);
            if (!validationResult.valid) {
                errors.push(`${formatDateForDisplay(excludedDate)}: ${validationResult.message}`);
                replacementInput.addClass('is-invalid');
                row.find('.replacement-error').removeClass('d-none').text(validationResult.message);
            } else if (replacementDatesSeen.has(replacementDate)) {
                errors.push(`${formatDateForDisplay(excludedDate)}: This replacement date is already used for another exclusion.`);
                replacementInput.addClass('is-invalid');
                row.find('.replacement-error').removeClass('d-none').text('This replacement date is already used for another exclusion.');
            } else {
                replacementDatesSeen.add(replacementDate);
            }
        }

        newExcludedDates.push({
            date: excludedDate,
            replacement: replacementDate
        });
    });

    // Show validation errors if any
    if (errors.length > 0) {
        $('#excludeDatesValidationError')
            .removeClass('d-none')
            .html('<strong>Please fix the following errors:</strong><ul class="mb-0 mt-2">' +
                errors.map(e => `<li>${e}</li>`).join('') + '</ul>');
        return;
    }

    // Sort by date
    newExcludedDates.sort((a, b) => a.date.localeCompare(b.date));
    excludedDates = newExcludedDates;

    updateExcludeDatesDisplay();
    bootstrap.Modal.getInstance(document.getElementById('excludeDatesModal')).hide();

    // Trigger recalculation of week details
    updateWeekVenueButtonState();
}

function updateExcludeDatesDisplay() {
    const btn = $('#setExcludeDatesBtn');

    if (excludedDates.length === 0) {
        btn.html('<i class="bi bi-calendar-x"></i> <span id="excludeDatesBtnText">No dates excluded</span>');
        btn.removeClass('btn-warning').addClass('btn-outline-primary');
    } else {
        // Count how many have replacement dates
        const replacementCount = excludedDates.filter(e => e.replacement).length;
        let displayText = `${excludedDates.length} excluded`;
        if (replacementCount > 0) {
            displayText += `, ${replacementCount} replaced`;
        }
        btn.html('<i class="bi bi-calendar-x"></i> <span id="excludeDatesBtnText">' + displayText + '</span>');
        btn.removeClass('btn-outline-primary').addClass('btn-warning');
    }
}

// ===== V4: Week Venue and Lecturer Details Functions =====

function updateWeekVenueButtonState() {
    const commencementDate = $('#class_commencement').val();
    const recurringWeeks = parseInt($('#recurring_until_week').val()) || 0;
    const btn = $('#setWeekVenueBtn');

    if (!commencementDate || recurringWeeks < 1) {
        btn.prop('disabled', true);
        btn.html('<i class="bi bi-calendar-week"></i> <span id="weekVenueBtnText">Set commencement date and weeks first</span>');
        btn.removeClass('btn-warning').addClass('btn-outline-primary');
        $('#weekVenueStatusDisplay').addClass('d-none');
        weekDetailsConfigured = false;
    } else {
        btn.prop('disabled', false);

        // Check if dates have changed
        const newDates = calculateRecurringDates(commencementDate, recurringWeeks, excludedDates);
        const newDateSet = new Set(newDates.map(d => d.date));
        const existingDateSet = new Set(Object.keys(weekVenueDetails));

        const datesMatch = newDateSet.size === existingDateSet.size &&
                          [...newDateSet].every(d => existingDateSet.has(d));

        if (!datesMatch && Object.keys(weekVenueDetails).length > 0) {
            // Dates changed - preserve matching entries
            const preservedDetails = {};
            newDates.forEach(dateObj => {
                if (weekVenueDetails[dateObj.date]) {
                    preservedDetails[dateObj.date] = weekVenueDetails[dateObj.date];
                }
            });
            weekVenueDetails = preservedDetails;
            weekDetailsConfigured = Object.keys(preservedDetails).length === newDates.length;
        }

        if (!weekDetailsConfigured) {
            btn.html('<i class="bi bi-exclamation-triangle"></i> <span id="weekVenueBtnText">Configure Week Details</span>');
            btn.removeClass('btn-outline-primary').addClass('btn-warning');
            $('#weekVenueStatusDisplay').addClass('d-none');
        } else {
            btn.html('<i class="bi bi-check-circle"></i> <span id="weekVenueBtnText">Edit Week Details</span>');
            btn.removeClass('btn-warning').addClass('btn-outline-primary');
            updateWeekVenueStatusDisplay();
        }
    }
}

function openWeekVenueModal() {
    const commencementDate = $('#class_commencement').val();
    const recurringWeeks = parseInt($('#recurring_until_week').val()) || 0;

    if (!commencementDate || recurringWeeks < 1) {
        showError('Please select a Class Commencement date and set Recurring Until Week first.');
        return;
    }

    // Calculate the recurring dates
    const dates = calculateRecurringDates(commencementDate, recurringWeeks, excludedDates);

    // Populate the table
    populateWeekVenueTable(dates);

    // Populate the "Apply to All" dropdowns
    populateApplyAllDropdowns();

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('weekVenueModal'));
    modal.show();
}

function populateWeekVenueTable(dates) {
    const tableBody = $('#weekVenueTableBody');
    tableBody.empty();

    dates.forEach((dateObj, index) => {
        // Show replacement indicator if this is a replacement date
        let dateDisplay = dateObj.displayDate;
        let rowClass = '';
        if (dateObj.isReplacement) {
            dateDisplay = `<span class="replacement-indicator">${dateObj.displayDate}</span>
                          <br><small class="text-muted">Replaces: ${formatDateForDisplay(dateObj.originalDate)}</small>`;
            rowClass = 'replacement-row';
        }

        const row = `
            <tr data-date="${dateObj.date}" class="${rowClass}">
                <td class="text-center"><strong>Week ${index + 1}</strong></td>
                <td>${dateDisplay}</td>
                <td>
                    <select class="form-select week-faculty-select" data-date="${dateObj.date}">
                        <option value="">Select Faculty</option>
                    </select>
                </td>
                <td>
                    <select class="form-select week-faculty2-select" data-date="${dateObj.date}">
                        <option value="">None (Optional)</option>
                    </select>
                </td>
                <td>
                    <select class="form-select week-special-room-select" data-date="${dateObj.date}">
                        <option value="">None (Optional)</option>
                    </select>
                </td>
            </tr>
        `;
        tableBody.append(row);
    });

    // Populate the select options from glossary
    populateWeekSelectOptions(dates);
}

function populateWeekSelectOptions(dates) {
    // Fetch faculty data
    $.ajax({
        url: '/api/glossary/faculty',
        method: 'GET',
        success: function(data) {
            $('.week-faculty-select').each(function() {
                const select = $(this);
                const dateKey = select.data('date');
                select.find('option:not(:first)').remove();
                data.forEach(item => {
                    const optionText = item.description
                        ? `${item.code} - ${item.description}`
                        : item.code;
                    select.append(new Option(optionText, item.code));
                });
                // Set existing value if available
                const existingDetail = weekVenueDetails[dateKey];
                if (existingDetail && existingDetail.faculty_code) {
                    select.val(existingDetail.faculty_code);
                }
            });

            // Initialize Select2 on faculty selects after populating
            $('.week-faculty-select').select2({
                theme: 'bootstrap-5',
                placeholder: 'Select Faculty',
                allowClear: true,
                width: '100%',
                dropdownParent: $('#weekVenueModal')
            });

            // Populate Faculty Code 2 (Sparring) selects with same data
            $('.week-faculty2-select').each(function() {
                const select = $(this);
                const dateKey = select.data('date');
                select.find('option:not(:first)').remove();
                data.forEach(item => {
                    const optionText = item.description
                        ? `${item.code} - ${item.description}`
                        : item.code;
                    select.append(new Option(optionText, item.code));
                });
                // Set existing value if available
                const existingDetail = weekVenueDetails[dateKey];
                if (existingDetail && existingDetail.faculty_code2) {
                    select.val(existingDetail.faculty_code2);
                }
            });

            // Initialize Select2 on faculty2 selects after populating
            $('.week-faculty2-select').select2({
                theme: 'bootstrap-5',
                placeholder: 'None (Optional)',
                allowClear: true,
                width: '100%',
                dropdownParent: $('#weekVenueModal')
            });
        }
    });

    // Fetch special room data
    $.ajax({
        url: '/api/glossary/specialroom',
        method: 'GET',
        success: function(data) {
            $('.week-special-room-select').each(function() {
                const select = $(this);
                const dateKey = select.data('date');
                select.find('option:not(:first)').remove();
                data.forEach(item => {
                    const optionText = item.description
                        ? `${item.code} - ${item.description}`
                        : item.code;
                    select.append(new Option(optionText, item.code));
                });
                // Set existing value if available
                const existingDetail = weekVenueDetails[dateKey];
                if (existingDetail && existingDetail.special_room_code) {
                    select.val(existingDetail.special_room_code);
                }
            });

            // Initialize Select2 on special room selects after populating
            $('.week-special-room-select').select2({
                theme: 'bootstrap-5',
                placeholder: 'None (Optional)',
                allowClear: true,
                width: '100%',
                dropdownParent: $('#weekVenueModal')
            });
        }
    });
}

function populateApplyAllDropdowns() {
    // Faculty dropdown
    $.ajax({
        url: '/api/glossary/faculty',
        method: 'GET',
        success: function(data) {
            const select = $('#applyAllFaculty');
            select.find('option:not(:first)').remove();
            data.forEach(item => {
                const optionText = item.description
                    ? `${item.code} - ${item.description}`
                    : item.code;
                select.append(new Option(optionText, item.code));
            });

            // Initialize Select2
            select.select2({
                theme: 'bootstrap-5',
                placeholder: 'Select Faculty',
                allowClear: true,
                width: '100%',
                dropdownParent: $('#weekVenueModal')
            });

            // Also populate Faculty Code 2 dropdown
            const select2 = $('#applyAllFaculty2');
            select2.find('option:not(:first)').remove();
            data.forEach(item => {
                const optionText = item.description
                    ? `${item.code} - ${item.description}`
                    : item.code;
                select2.append(new Option(optionText, item.code));
            });

            // Initialize Select2 for Faculty Code 2
            select2.select2({
                theme: 'bootstrap-5',
                placeholder: 'None (Optional)',
                allowClear: true,
                width: '100%',
                dropdownParent: $('#weekVenueModal')
            });
        }
    });

    // Special room dropdown
    $.ajax({
        url: '/api/glossary/specialroom',
        method: 'GET',
        success: function(data) {
            const select = $('#applyAllSpecialRoom');
            select.find('option:not(:first)').remove();
            data.forEach(item => {
                const optionText = item.description
                    ? `${item.code} - ${item.description}`
                    : item.code;
                select.append(new Option(optionText, item.code));
            });

            // Initialize Select2
            select.select2({
                theme: 'bootstrap-5',
                placeholder: 'None (Optional)',
                allowClear: true,
                width: '100%',
                dropdownParent: $('#weekVenueModal')
            });
        }
    });
}

function applyToAllWeeks() {
    const facultyVal = $('#applyAllFaculty').val();
    const faculty2Val = $('#applyAllFaculty2').val();
    const specialRoomVal = $('#applyAllSpecialRoom').val();

    if (facultyVal) {
        $('.week-faculty-select').val(facultyVal).trigger('change');
    }
    // Always apply faculty2 (even if empty - user may want to clear all)
    $('.week-faculty2-select').val(faculty2Val).trigger('change');
    // Always apply special room (even if empty - user may want to clear all)
    $('.week-special-room-select').val(specialRoomVal).trigger('change');
}

function saveWeekVenueDetails() {
    // Validate that all faculty codes are set
    let isValid = true;
    const newDetails = {};

    $('.week-faculty-select').each(function() {
        const select = $(this);
        const dateKey = select.data('date');
        const facultyValue = select.val();

        // Get the Select2 container for this select
        const select2Container = select.next('.select2-container');

        if (!facultyValue) {
            isValid = false;
            select2Container.addClass('select2-invalid');
        } else {
            select2Container.removeClass('select2-invalid');
        }

        const faculty2Select = $(`.week-faculty2-select[data-date="${dateKey}"]`);
        const faculty2Value = faculty2Select.val() || '';

        const specialRoomSelect = $(`.week-special-room-select[data-date="${dateKey}"]`);
        const specialRoomValue = specialRoomSelect.val() || '';

        newDetails[dateKey] = {
            faculty_code: facultyValue,
            faculty_code2: faculty2Value,
            special_room_code: specialRoomValue
        };
    });

    if (!isValid) {
        showError('Please select a Faculty Code for all weeks.');
        return;
    }

    // Hide any previous error message
    $('#errorMessage').addClass('d-none');

    // Save to global state
    weekVenueDetails = newDetails;
    weekDetailsConfigured = true;

    // Update button and display
    updateWeekVenueButtonState();
    updateWeekVenueStatusDisplay();

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('weekVenueModal')).hide();

    showSuccess('Week venue and lecturer details saved successfully!');
    setTimeout(() => {
        $('#resultMessage').addClass('d-none');
    }, 2000);
}

function updateWeekVenueStatusDisplay() {
    const weekCount = Object.keys(weekVenueDetails).length;
    $('#weekVenueCountDisplay').text(weekCount);
    $('#weekVenueStatusDisplay').removeClass('d-none');
}
