// Global array to store entries
let entries = [];
let entryCounter = 1;

$(document).ready(function() {
    // Initialize Select2 for all dropdowns
    initializeSelect2();

    // Load glossary data for all dropdowns
    loadGlossaries();

    // Generate date options for Class Commencement
    generateDateOptions();

    // Handle form submission (Add Entry)
    $('#dtctForm').on('submit', handleAddEntry);

    // Handle Clear Form button
    $('#clearFormBtn').on('click', clearForm);

    // Handle Generate All button
    $('#generateAllBtn').on('click', handleGenerateAll);
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
        { type: 'faculty', elementId: 'faculty_codes' }
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

function generateDateOptions() {
    const startDate = new Date('2026-02-09');
    const endDate = new Date('2026-02-13');
    const select = $('#class_commencement');

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayName = dayNames[currentDate.getDay()];
        const day = currentDate.getDate();
        const month = monthNames[currentDate.getMonth()];
        const year = currentDate.getFullYear();

        const displayText = `${dayName}, ${day} ${month} ${year}`;
        const value = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format

        select.append(new Option(displayText, value, false, false));

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
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
    return {
        academic_session_code: $('#academic_session_code').val(),
        academic_session_text: $('#academic_session_code option:selected').text(),
        programme_code: $('#programme_code').val(),
        programme_text: $('#programme_code option:selected').text(),
        class_commencement: $('#class_commencement').val(),
        class_commencement_text: $('#class_commencement option:selected').text(),
        duration: parseInt($('#duration').val()),
        activity_code: $('#activity_code').val(),
        activity_text: $('#activity_code option:selected').text(),
        capacity: parseInt($('#capacity').val()),
        course_codes: $('#course_codes').val(),
        course_texts: $('#course_codes option:selected').map((i, el) => $(el).text()).get(),
        group_codes: $('#group_codes').val(),
        group_texts: $('#group_codes option:selected').map((i, el) => $(el).text()).get(),
        faculty_codes: $('#faculty_codes').val(),
        faculty_texts: $('#faculty_codes option:selected').map((i, el) => $(el).text()).get(),
        request_special_room_code: $('#request_special_room_code').val() || '',
        request_special_room_text: $('#request_special_room_code option:selected').text(),
        recurring_until_week: parseInt($('#recurring_until_week').val())
    };
}

function updateEntriesTable() {
    const tbody = $('#entriesTableBody');
    tbody.empty();

    entries.forEach((entry, index) => {
        const row = `
            <tr>
                <td>
                    <div class="formid-badge">Entry ${entry.entryNumber}</div>
                </td>
                <td><small>${entry.academic_session_code}</small></td>
                <td><small>${entry.programme_code}</small></td>
                <td><small>${entry.class_commencement}</small></td>
                <td>${entry.duration}h</td>
                <td><small>${entry.activity_code}</small></td>
                <td>${entry.capacity}</td>
                <td>${formatArrayBadges(entry.course_codes)}</td>
                <td>${formatArrayBadges(entry.group_codes)}</td>
                <td>${formatArrayBadges(entry.faculty_codes)}</td>
                <td><small>${entry.request_special_room_code || '-'}</small></td>
                <td>${entry.recurring_until_week}</td>
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

function editEntry(index) {
    const entry = entries[index];

    // Populate form with entry data
    $('#academic_session_code').val(entry.academic_session_code).trigger('change');
    $('#programme_code').val(entry.programme_code).trigger('change');
    $('#class_commencement').val(entry.class_commencement).trigger('change');
    $('#duration').val(entry.duration);
    $('#activity_code').val(entry.activity_code).trigger('change');
    $('#capacity').val(entry.capacity);
    $('#course_codes').val(entry.course_codes).trigger('change');
    $('#group_codes').val(entry.group_codes).trigger('change');
    $('#faculty_codes').val(entry.faculty_codes).trigger('change');
    $('#request_special_room_code').val(entry.request_special_room_code).trigger('change');
    $('#recurring_until_week').val(entry.recurring_until_week);

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
    $('#capacity').val(0);
    $('#recurring_until_week').val(14);
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

function validateForm() {
    // Check required fields
    const requiredFields = [
        { id: 'academic_session_code', name: 'Academic Session Code' },
        { id: 'programme_code', name: 'Programme Code' },
        { id: 'class_commencement', name: 'Class Commencement' },
        { id: 'duration', name: 'Duration' },
        { id: 'activity_code', name: 'Activity Code' },
        { id: 'capacity', name: 'Capacity' },
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
        { id: 'group_codes', name: 'Group Code(s)' },
        { id: 'faculty_codes', name: 'Faculty Code(s)' }
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
    const capacity = parseInt($('#capacity').val());
    const recurringWeek = parseInt($('#recurring_until_week').val());

    if (duration < 0) {
        showError('Duration must be 0 or greater.');
        $('#duration').focus();
        return false;
    }

    if (capacity < 0) {
        showError('Capacity must be 0 or greater.');
        $('#capacity').focus();
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
