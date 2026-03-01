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

// Track which entry is being edited (null = adding new, index = editing existing)
let editingEntryIndex = null;

// Cached session names for overwrite warning
let existingSessionNames = [];

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

    // Session save/load handlers
    $('#saveSessionBtn').on('click', openSaveSessionModal);
    $('#confirmSaveSessionBtn').on('click', function() {
        var isOverwrite = !$('#saveSessionOverwriteWarning').hasClass('d-none');
        saveSession(isOverwrite);
    });
    $('#sessionNameInput').on('input', function() {
        $('#saveSessionOverwriteWarning').addClass('d-none');
        $('#confirmSaveSessionBtn').find('#saveSessionBtnText').text('Save Session');
    });
    $('#loadSessionBtnForm').on('click', openLoadSessionModal);

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

    if (editingEntryIndex !== null) {
        // Editing existing entry — preserve original entry number
        formData.entryNumber = entries[editingEntryIndex].entryNumber;
        entries[editingEntryIndex] = formData;
        editingEntryIndex = null;
        $('#addBtnText').text('Add Entry');
    } else {
        // Adding new entry
        formData.entryNumber = entryCounter++;
        entries.push(formData);
    }

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
        week_venue_details: JSON.parse(JSON.stringify(weekVenueDetails)),
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
                    <button class="btn btn-action btn-copy me-1" onclick="copyEntry(${index})">Copy</button>
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

    // Track which entry is being edited
    editingEntryIndex = index;
    $('#addBtnText').text('Update Entry');

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

    // V4: Restore week venue details (normalise old format)
    weekVenueDetails = normaliseWeekVenueDetails(entry.week_venue_details || {});
    weekDetailsConfigured = Object.keys(weekVenueDetails).length > 0;

    // Trigger group change to update UI (after groups are set)
    setTimeout(() => {
        handleGroupSelectionChange();
        updateExcludeDatesButtonState();
        updateWeekVenueButtonState();
    }, 100);

    // Scroll to form
    $('html, body').animate({
        scrollTop: $('.form-container').offset().top - 100
    }, 500);
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

function copyEntry(index) {
    const copy = JSON.parse(JSON.stringify(entries[index]));
    copy.entryNumber = entryCounter++;
    entries.push(copy);
    updateEntriesTable();
}

function clearForm() {
    // Reset editing state
    editingEntryIndex = null;
    $('#addBtnText').text('Add Entry');

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

// Cached glossary data for re-rendering rows without re-fetching
let _weekVenueFacultyData = null;
let _weekVenueRoomData = null;
let _weekVenueDates = []; // current dates array for re-rendering

function normaliseWeekVenueDetails(details) {
    /**
     * Convert old flat format to new sessions/venues format.
     * Old: { "2026-03-30": { faculty_code: "FAC001", ... } }
     * New: { "2026-03-30": { sessions: [{ venues: [{ faculty_code: "FAC001", ... }] }] } }
     */
    const normalised = {};
    for (const dateKey in details) {
        const detail = details[dateKey];
        if (detail && detail.sessions) {
            normalised[dateKey] = JSON.parse(JSON.stringify(detail));
        } else {
            normalised[dateKey] = {
                sessions: [{ venues: [Object.assign({}, detail)] }]
            };
        }
    }
    return normalised;
}

function populateWeekVenueTable(dates) {
    _weekVenueDates = dates;
    const tableBody = $('#weekVenueTableBody');
    tableBody.empty();

    // Fetch glossary data then render all rows
    const facultyPromise = $.ajax({ url: '/api/glossary/faculty', method: 'GET' });
    const roomPromise = $.ajax({ url: '/api/glossary/specialroom', method: 'GET' });

    $.when(facultyPromise, roomPromise).done(function(facResult, roomResult) {
        _weekVenueFacultyData = facResult[0];
        _weekVenueRoomData = roomResult[0];

        dates.forEach((dateObj, index) => {
            renderDateRows(dateObj.date, dateObj, index);
        });
    });
}

function renderDateRows(date, dateObj, weekIndex) {
    const tableBody = $('#weekVenueTableBody');

    // Remove existing rows for this date
    tableBody.find(`tr[data-date="${date}"]`).remove();

    // Get or create sessions structure for this date
    let dateDetail = weekVenueDetails[date];
    if (!dateDetail || !dateDetail.sessions) {
        dateDetail = { sessions: [{ venues: [{ faculty_code: '', faculty_code2: '', special_room_code: '' }] }] };
    }
    const sessions = dateDetail.sessions;

    // Build date display
    let dateDisplay = dateObj.displayDate;
    let baseRowClass = '';
    if (dateObj.isReplacement) {
        dateDisplay = `<span class="replacement-indicator">${dateObj.displayDate}</span>
                      <br><small class="text-muted">Replaces: ${formatDateForDisplay(dateObj.originalDate)}</small>`;
        baseRowClass = 'replacement-row';
    }

    const rows = [];

    sessions.forEach((session, sIdx) => {
        const venues = session.venues || [{ faculty_code: '', faculty_code2: '', special_room_code: '' }];

        venues.forEach((venue, vIdx) => {
            let weekCell = '';
            let dateCell = '';
            let rowClasses = [baseRowClass];
            let actionsHtml = '';

            // Show split capacity when session has multiple venues
            let capacityHtml = '';
            if (vIdx === 0 && venues.length > 1) {
                const totalCapacity = calculateTotalCapacity(groupCapacities);
                if (totalCapacity > 0) {
                    const base = Math.floor(totalCapacity / venues.length);
                    const remainder = totalCapacity % venues.length;
                    // First `remainder` venues get base+1, the rest get base
                    const parts = [];
                    for (let i = 0; i < venues.length; i++) {
                        parts.push(i < remainder ? base + 1 : base);
                    }
                    capacityHtml = `<br><small class="text-muted">Cap: ${parts.join(' + ')}</small>`;
                }
            }

            // Time inputs on first venue row of each session (vIdx===0)
            let startTimeCell = '';
            let endTimeCell = '';
            const existingStartTime = session.start_time || '';
            const existingEndTime = session.end_time || '';

            if (sIdx === 0 && vIdx === 0) {
                // Primary row
                weekCell = `<strong>Week ${weekIndex + 1}</strong>${capacityHtml}`;
                dateCell = dateDisplay;
                startTimeCell = `<input type="time" class="form-control form-control-sm week-start-time" data-date="${date}" data-session="${sIdx}" value="${existingStartTime}">`;
                endTimeCell = `<input type="time" class="form-control form-control-sm week-end-time" data-date="${date}" data-session="${sIdx}" value="${existingEndTime}">`;
                actionsHtml = `<div class="week-venue-actions">
                    <button type="button" class="btn-add-session" onclick="addSession('${date}')" title="Add session">+S</button>
                    <button type="button" class="btn-add-venue" onclick="addVenue('${date}', ${sIdx})" title="Add venue">+V</button>
                </div>`;
            } else if (sIdx > 0 && vIdx === 0) {
                // Additional session primary venue
                weekCell = `<span class="session-venue-label">Session ${sIdx + 1}</span>${capacityHtml}`;
                dateCell = '';
                startTimeCell = `<input type="time" class="form-control form-control-sm week-start-time" data-date="${date}" data-session="${sIdx}" value="${existingStartTime}">`;
                endTimeCell = `<input type="time" class="form-control form-control-sm week-end-time" data-date="${date}" data-session="${sIdx}" value="${existingEndTime}">`;
                rowClasses.push('session-sub-row');
                actionsHtml = `<div class="week-venue-actions">
                    <button type="button" class="btn-remove-session" onclick="removeSession('${date}', ${sIdx})" title="Remove session">&minus;S</button>
                    <button type="button" class="btn-add-venue" onclick="addVenue('${date}', ${sIdx})" title="Add venue">+V</button>
                </div>`;
            } else {
                // Additional venue row (any session)
                weekCell = `<span class="session-venue-label">${sIdx > 0 ? 'S' + (sIdx + 1) + ' ' : ''}Venue ${vIdx + 1}</span>`;
                dateCell = '';
                rowClasses.push('venue-sub-row');
                actionsHtml = `<div class="week-venue-actions">
                    <button type="button" class="btn-remove-venue" onclick="removeVenue('${date}', ${sIdx}, ${vIdx})" title="Remove venue">&minus;V</button>
                </div>`;
            }

            const rowHtml = `
                <tr data-date="${date}" data-session="${sIdx}" data-venue="${vIdx}" class="${rowClasses.join(' ')}">
                    <td class="text-center">${weekCell}</td>
                    <td>${dateCell}</td>
                    <td>${startTimeCell}</td>
                    <td>${endTimeCell}</td>
                    <td>
                        <select class="form-select week-faculty-select" data-date="${date}" data-session="${sIdx}" data-venue="${vIdx}">
                            <option value="">Select Faculty</option>
                        </select>
                    </td>
                    <td>
                        <select class="form-select week-faculty2-select" data-date="${date}" data-session="${sIdx}" data-venue="${vIdx}">
                            <option value="">None (Optional)</option>
                        </select>
                    </td>
                    <td>
                        <select class="form-select week-special-room-select" data-date="${date}" data-session="${sIdx}" data-venue="${vIdx}">
                            <option value="">None (Optional)</option>
                        </select>
                    </td>
                    <td>${actionsHtml}</td>
                </tr>
            `;
            rows.push(rowHtml);
        });
    });

    // Find the right insertion point (after any rows for previous dates)
    const allDateRows = tableBody.find('tr');
    let insertAfter = null;
    allDateRows.each(function() {
        const rowDate = $(this).data('date');
        if (rowDate && rowDate < date) {
            insertAfter = $(this);
        }
    });

    if (insertAfter && insertAfter.length) {
        // Find the last row belonging to insertAfter's date
        let lastPrev = insertAfter;
        insertAfter.nextAll(`tr[data-date="${insertAfter.data('date')}"]`).each(function() {
            lastPrev = $(this);
        });
        lastPrev.after(rows.join(''));
    } else if (allDateRows.length === 0) {
        tableBody.append(rows.join(''));
    } else {
        // This date is before all existing dates, prepend
        const existingDates = [];
        allDateRows.each(function() {
            const d = $(this).data('date');
            if (d && !existingDates.includes(d)) existingDates.push(d);
        });
        if (existingDates.length > 0 && date < existingDates[0]) {
            tableBody.prepend(rows.join(''));
        } else {
            tableBody.append(rows.join(''));
        }
    }

    // Populate selects and init Select2 for the newly added rows
    initSelectsForDate(date, sessions);
}

function initSelectsForDate(date, sessions) {
    sessions.forEach((session, sIdx) => {
        const venues = session.venues || [{}];
        venues.forEach((venue, vIdx) => {
            initSelectsForRow(date, sIdx, vIdx, venue);
        });
    });
}

function initSelectsForRow(date, sIdx, vIdx, existingVenue) {
    const selector = `tr[data-date="${date}"][data-session="${sIdx}"][data-venue="${vIdx}"]`;
    const $row = $(selector);
    if (!$row.length) return;

    const $faculty = $row.find('.week-faculty-select');
    const $faculty2 = $row.find('.week-faculty2-select');
    const $room = $row.find('.week-special-room-select');

    // Populate faculty options
    if (_weekVenueFacultyData) {
        $faculty.find('option:not(:first)').remove();
        $faculty2.find('option:not(:first)').remove();
        _weekVenueFacultyData.forEach(item => {
            const optionText = item.description ? `${item.code} - ${item.description}` : item.code;
            $faculty.append(new Option(optionText, item.code));
            $faculty2.append(new Option(optionText, item.code));
        });
        if (existingVenue && existingVenue.faculty_code) {
            $faculty.val(existingVenue.faculty_code);
        }
        if (existingVenue && existingVenue.faculty_code2) {
            $faculty2.val(existingVenue.faculty_code2);
        }
    }

    // Populate room options
    if (_weekVenueRoomData) {
        $room.find('option:not(:first)').remove();
        _weekVenueRoomData.forEach(item => {
            const optionText = item.description ? `${item.code} - ${item.description}` : item.code;
            $room.append(new Option(optionText, item.code));
        });
        if (existingVenue && existingVenue.special_room_code) {
            $room.val(existingVenue.special_room_code);
        }
    }

    // Destroy existing Select2 before re-initialising
    if ($faculty.hasClass('select2-hidden-accessible')) $faculty.select2('destroy');
    if ($faculty2.hasClass('select2-hidden-accessible')) $faculty2.select2('destroy');
    if ($room.hasClass('select2-hidden-accessible')) $room.select2('destroy');

    $faculty.select2({
        theme: 'bootstrap-5',
        placeholder: 'Select Faculty',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#weekVenueModal')
    });
    $faculty2.select2({
        theme: 'bootstrap-5',
        placeholder: 'None (Optional)',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#weekVenueModal')
    });
    $room.select2({
        theme: 'bootstrap-5',
        placeholder: 'None (Optional)',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#weekVenueModal')
    });
}

function captureCurrentDateValues(date) {
    /**
     * Read current select values from the DOM for a given date and update
     * weekVenueDetails in-place, so that re-rendering preserves user edits.
     * Builds the sessions structure on the fly from DOM rows, ensuring values
     * are captured even when weekVenueDetails[date] doesn't exist yet.
     */
    if (!weekVenueDetails[date]) {
        weekVenueDetails[date] = { sessions: [] };
    }
    if (!weekVenueDetails[date].sessions) {
        weekVenueDetails[date].sessions = [];
    }

    $(`#weekVenueTableBody tr[data-date="${date}"]`).each(function() {
        const $row = $(this);
        const sIdx = parseInt($row.data('session'));
        const vIdx = parseInt($row.data('venue'));
        const sessions = weekVenueDetails[date].sessions;

        // Grow arrays as needed
        while (sessions.length <= sIdx) {
            sessions.push({ venues: [] });
        }

        // Capture time values at session level (from first venue row of each session)
        const $startTime = $row.find('.week-start-time');
        const $endTime = $row.find('.week-end-time');
        if ($startTime.length) {
            sessions[sIdx].start_time = $startTime.val() || '';
        }
        if ($endTime.length) {
            sessions[sIdx].end_time = $endTime.val() || '';
        }
        while (sessions[sIdx].venues.length <= vIdx) {
            sessions[sIdx].venues.push({});
        }

        sessions[sIdx].venues[vIdx] = {
            faculty_code: $row.find('.week-faculty-select').val() || '',
            faculty_code2: $row.find('.week-faculty2-select').val() || '',
            special_room_code: $row.find('.week-special-room-select').val() || ''
        };
    });
}

function addSession(date) {
    // Capture current values before mutating (also ensures structure exists)
    captureCurrentDateValues(date);

    weekVenueDetails[date].sessions.push({
        start_time: '', end_time: '',
        venues: [{ faculty_code: '', faculty_code2: '', special_room_code: '' }]
    });

    const dateInfo = findDateInfo(date);
    if (dateInfo) {
        renderDateRows(date, dateInfo.dateObj, dateInfo.weekIndex);
    }
}

function removeSession(date, sessionIdx) {
    if (!weekVenueDetails[date] || !weekVenueDetails[date].sessions) return;
    if (sessionIdx === 0) return; // Cannot remove session 0

    captureCurrentDateValues(date);
    weekVenueDetails[date].sessions.splice(sessionIdx, 1);

    const dateInfo = findDateInfo(date);
    if (dateInfo) {
        renderDateRows(date, dateInfo.dateObj, dateInfo.weekIndex);
    }
}

function addVenue(date, sessionIdx) {
    // Capture current values before mutating (also ensures structure exists)
    captureCurrentDateValues(date);

    const sessions = weekVenueDetails[date].sessions;
    if (sessionIdx >= sessions.length) return;
    sessions[sessionIdx].venues.push({ faculty_code: '', faculty_code2: '', special_room_code: '' });

    const dateInfo = findDateInfo(date);
    if (dateInfo) {
        renderDateRows(date, dateInfo.dateObj, dateInfo.weekIndex);
    }
}

function removeVenue(date, sessionIdx, venueIdx) {
    if (!weekVenueDetails[date] || !weekVenueDetails[date].sessions) return;

    captureCurrentDateValues(date);
    const sessions = weekVenueDetails[date].sessions;
    if (sessionIdx >= sessions.length) return;
    const venues = sessions[sessionIdx].venues;

    // Cannot remove the only venue of session 0 if it's the only session
    if (venues.length <= 1 && sessionIdx === 0 && sessions.length === 1) return;

    // If removing the only venue, remove the whole session instead (unless it's session 0)
    if (venues.length <= 1 && sessionIdx > 0) {
        sessions.splice(sessionIdx, 1);
    } else {
        venues.splice(venueIdx, 1);
    }

    const dateInfo = findDateInfo(date);
    if (dateInfo) {
        renderDateRows(date, dateInfo.dateObj, dateInfo.weekIndex);
    }
}

function findDateInfo(date) {
    for (let i = 0; i < _weekVenueDates.length; i++) {
        if (_weekVenueDates[i].date === date) {
            return { dateObj: _weekVenueDates[i], weekIndex: i };
        }
    }
    return null;
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
    const startTimeVal = $('#applyAllStartTime').val();
    const endTimeVal = $('#applyAllEndTime').val();
    const facultyVal = $('#applyAllFaculty').val();
    const faculty2Val = $('#applyAllFaculty2').val();
    const specialRoomVal = $('#applyAllSpecialRoom').val();

    // Apply time values to all primary rows
    if (startTimeVal) {
        $('input.week-start-time').val(startTimeVal);
    }
    if (endTimeVal) {
        $('input.week-end-time').val(endTimeVal);
    }

    // Only apply to primary venues (session 0, venue 0)
    if (facultyVal) {
        $('select.week-faculty-select[data-session="0"][data-venue="0"]').val(facultyVal).trigger('change');
    }
    $('select.week-faculty2-select[data-session="0"][data-venue="0"]').val(faculty2Val).trigger('change');
    $('select.week-special-room-select[data-session="0"][data-venue="0"]').val(specialRoomVal).trigger('change');
}

function saveWeekVenueDetails() {
    // Build nested structure from all table rows
    let isValid = true;
    const newDetails = {};

    $('#weekVenueTableBody tr').each(function() {
        const $row = $(this);
        const dateKey = $row.data('date');
        const sIdx = parseInt($row.data('session'));
        const vIdx = parseInt($row.data('venue'));

        if (!dateKey && dateKey !== 0) return; // skip non-data rows

        // Ensure date structure exists
        if (!newDetails[dateKey]) {
            newDetails[dateKey] = { sessions: [] };
        }

        // Ensure session array is long enough
        while (newDetails[dateKey].sessions.length <= sIdx) {
            newDetails[dateKey].sessions.push({ venues: [] });
        }

        // Capture time values at session level (from first venue row of each session)
        const $startTime = $row.find('.week-start-time');
        const $endTime = $row.find('.week-end-time');
        if ($startTime.length) {
            newDetails[dateKey].sessions[sIdx].start_time = $startTime.val() || '';
        }
        if ($endTime.length) {
            newDetails[dateKey].sessions[sIdx].end_time = $endTime.val() || '';
        }

        const $faculty = $row.find('.week-faculty-select');
        const facultyValue = $faculty.val();

        // Validate faculty code is set
        const select2Container = $faculty.next('.select2-container');
        if (!facultyValue) {
            isValid = false;
            select2Container.addClass('select2-invalid');
        } else {
            select2Container.removeClass('select2-invalid');
        }

        const faculty2Value = $row.find('.week-faculty2-select').val() || '';
        const specialRoomValue = $row.find('.week-special-room-select').val() || '';

        // Ensure venue array is long enough
        while (newDetails[dateKey].sessions[sIdx].venues.length <= vIdx) {
            newDetails[dateKey].sessions[sIdx].venues.push({});
        }

        newDetails[dateKey].sessions[sIdx].venues[vIdx] = {
            faculty_code: facultyValue,
            faculty_code2: faculty2Value,
            special_room_code: specialRoomValue
        };
    });

    if (!isValid) {
        showError('Please select a Faculty Code for all venues.');
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

// ===== Session Save/Load Functions =====

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function openSaveSessionModal() {
    $('#sessionNameInput').val('');
    $('#saveSessionBtnText').text('Save Session');
    $('#saveSessionSpinner').addClass('d-none');
    $('#confirmSaveSessionBtn').prop('disabled', false);
    $('#saveSessionOverwriteWarning').addClass('d-none');

    // Fetch existing session names for overwrite warning
    $.ajax({
        url: '/api/sessions',
        method: 'GET',
        success: function(sessions) {
            existingSessionNames = sessions.map(function(s) { return s.name; });
        }
    });

    const modal = new bootstrap.Modal(document.getElementById('saveSessionModal'));
    modal.show();
    setTimeout(() => $('#sessionNameInput').focus(), 300);
}

function saveSession(confirmed) {
    const name = $('#sessionNameInput').val().trim();
    if (!name) {
        $('#sessionNameInput').addClass('is-invalid');
        $('#sessionNameInput').focus();
        return;
    }
    $('#sessionNameInput').removeClass('is-invalid');

    if (entries.length === 0) {
        alert('No entries to save. Please add at least one entry first.');
        return;
    }

    // Warn if name matches an existing session (unless already confirmed)
    if (!confirmed && existingSessionNames.some(function(n) { return n === name; })) {
        $('#saveSessionOverwriteWarning').removeClass('d-none');
        $('#confirmSaveSessionBtn').text('Overwrite');
        return;
    }

    $('#saveSessionOverwriteWarning').addClass('d-none');
    $('#confirmSaveSessionBtn').prop('disabled', true);
    $('#saveSessionBtnText').text('Saving...');
    $('#saveSessionSpinner').removeClass('d-none');

    $.ajax({
        url: '/api/sessions',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            name: name,
            entries: entries,
            entry_counter: entryCounter
        }),
        success: function(response) {
            bootstrap.Modal.getInstance(document.getElementById('saveSessionModal')).hide();
            const msg = response.overwritten
                ? `Session "<strong>${escapeHtml(name)}</strong>" updated successfully.`
                : `Session "<strong>${escapeHtml(name)}</strong>" saved successfully.`;
            showSuccess(msg);
            setTimeout(() => $('#resultMessage').addClass('d-none'), 3000);
        },
        error: function(xhr) {
            const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to save session';
            alert('Error: ' + errMsg);
        },
        complete: function() {
            $('#confirmSaveSessionBtn').prop('disabled', false);
            $('#saveSessionBtnText').text('Save Session');
            $('#saveSessionSpinner').addClass('d-none');
        }
    });
}

function openLoadSessionModal() {
    $('#sessionListLoading').removeClass('d-none');
    $('#sessionListContainer').addClass('d-none');
    $('#sessionListEmpty').addClass('d-none');

    const modal = new bootstrap.Modal(document.getElementById('loadSessionModal'));
    modal.show();

    $.ajax({
        url: '/api/sessions',
        method: 'GET',
        success: function(sessions) {
            $('#sessionListLoading').addClass('d-none');
            if (sessions.length === 0) {
                $('#sessionListEmpty').removeClass('d-none');
            } else {
                renderSessionList(sessions);
                $('#sessionListContainer').removeClass('d-none');
            }
        },
        error: function(xhr) {
            $('#sessionListLoading').addClass('d-none');
            const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to load sessions';
            $('#sessionListContainer').html(
                '<div class="alert alert-danger">' + escapeHtml(errMsg) + '</div>'
            ).removeClass('d-none');
        }
    });
}

function renderSessionList(sessions) {
    let html = '<div class="list-group">';
    sessions.forEach(function(s) {
        html += `
            <div class="list-group-item session-list-item" data-session-id="${s.id}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="session-info" style="cursor: pointer; flex: 1;" onclick="loadSession(${s.id}, '${escapeHtml(s.name).replace(/'/g, "\\'")}')">
                        <h6 class="mb-1">${escapeHtml(s.name)}</h6>
                        <small class="text-muted">
                            ${s.entry_count} ${s.entry_count === 1 ? 'entry' : 'entries'}
                            &middot; Updated ${escapeHtml(s.updated_at)}
                        </small>
                    </div>
                    <button type="button" class="btn btn-outline-danger btn-sm ms-2" onclick="deleteSession(${s.id}, '${escapeHtml(s.name).replace(/'/g, "\\'")}')" title="Delete session">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>`;
    });
    html += '</div>';
    $('#sessionListContainer').html(html);
}

function loadSession(id, name) {
    if (entries.length > 0) {
        if (!confirm('Loading a session will replace your current entries. Continue?')) {
            return;
        }
    }

    $.ajax({
        url: '/api/sessions/' + id,
        method: 'GET',
        success: function(data) {
            entries = data.entries;
            // Normalise week venue details in all loaded entries
            entries.forEach(function(entry) {
                if (entry.week_venue_details) {
                    entry.week_venue_details = normaliseWeekVenueDetails(entry.week_venue_details);
                }
            });
            entryCounter = data.entry_counter;
            updateEntriesTable();

            if (entries.length > 0) {
                $('#entriesSection').removeClass('d-none');
            } else {
                $('#entriesSection').addClass('d-none');
            }

            bootstrap.Modal.getInstance(document.getElementById('loadSessionModal')).hide();
            showSuccess('Session "<strong>' + escapeHtml(name) + '</strong>" loaded with ' + entries.length + ' entries.');
            setTimeout(() => $('#resultMessage').addClass('d-none'), 3000);

            if (entries.length > 0) {
                $('html, body').animate({
                    scrollTop: $('#entriesSection').offset().top - 50
                }, 500);
            }
        },
        error: function(xhr) {
            const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to load session';
            alert('Error: ' + errMsg);
        }
    });
}

function deleteSession(id, name) {
    if (!confirm('Delete session "' + name + '"? This cannot be undone.')) {
        return;
    }

    const $item = $(`.session-list-item[data-session-id="${id}"]`);
    $item.css('opacity', '0.5');

    $.ajax({
        url: '/api/sessions/' + id,
        method: 'DELETE',
        success: function() {
            $item.fadeOut(300, function() {
                $(this).remove();
                if ($('#sessionListContainer .session-list-item').length === 0) {
                    $('#sessionListContainer').addClass('d-none');
                    $('#sessionListEmpty').removeClass('d-none');
                }
            });
        },
        error: function(xhr) {
            $item.css('opacity', '1');
            const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Failed to delete session';
            alert('Error: ' + errMsg);
        }
    });
}
