import os
from datetime import datetime
from openpyxl import Workbook
from app import db
from app.models import FormSubmission, GeneratedRow
from app.services import id_generator

def generate_excel_file(rows, programme_code):
    """
    Generate Excel file from expanded row data

    Args:
        rows: List of row dictionaries with form data
        programme_code: Programme code for filename

    Returns:
        Tuple of (file_path, form_id)
    """
    # Generate FormID (same for all rows)
    form_id = id_generator.generate_form_id()

    # Generate unique row IDs
    row_ids = id_generator.generate_row_ids(len(rows))

    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Pre-DTCT"

    # Write headers
    headers = [
        'ID', 'FormID', 'AcademicSessionCode', 'ProgrammeCode',
        'ClassCommencement', 'Duration', 'ActivityCode', 'Capacity',
        'CourseCode', 'GroupCode', 'FacultyCode',
        'RequestSpecialRoomCode', 'RecurringUntilWeek'
    ]
    ws.append(headers)

    # Write data rows
    for i, row in enumerate(rows):
        row_id = row_ids[i]
        ws.append([
            row_id,
            form_id,
            row['academic_session_code'],
            row['programme_code'],
            row['class_commencement'],
            row['duration'],
            row['activity_code'],
            row['capacity'],
            row['course_code'],
            row['group_code'],
            row['faculty_code'],
            row['request_special_room_code'] or '',
            row['recurring_until_week']
        ])

    # Generate filename
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    filename = f"Pre-DTCT_{programme_code}_{timestamp}.xlsx"

    # Ensure output directory exists
    from flask import current_app
    output_dir = current_app.config['OUTPUT_DIR']
    os.makedirs(output_dir, exist_ok=True)

    file_path = os.path.join(output_dir, filename)

    # Save Excel file
    wb.save(file_path)
    wb.close()

    # Save to database
    submission = FormSubmission(
        form_id=form_id,
        timestamp=timestamp,
        programme_code=programme_code,
        generated_file_path=file_path
    )
    db.session.add(submission)
    db.session.flush()

    # Save generated rows
    for i, row in enumerate(rows):
        generated_row = GeneratedRow(
            submission_id=submission.id,
            row_id=row_ids[i],
            form_id=form_id,
            academic_session_code=row['academic_session_code'],
            programme_code=row['programme_code'],
            class_commencement=row['class_commencement'],
            duration=row['duration'],
            activity_code=row['activity_code'],
            capacity=row['capacity'],
            course_code=row['course_code'],
            group_code=row['group_code'],
            faculty_code=row['faculty_code'],
            request_special_room_code=row['request_special_room_code'],
            recurring_until_week=row['recurring_until_week']
        )
        db.session.add(generated_row)

    db.session.commit()

    return filename, form_id

def generate_excel_file_multiple(all_rows, programme_code, form_ids_list):
    """
    Generate Excel file from multiple entries with different FormIDs

    Args:
        all_rows: List of all row dictionaries from all entries (with form_id_temp)
        programme_code: Programme code for filename
        form_ids_list: List of FormIDs for each entry

    Returns:
        String filename of generated Excel file
    """
    # Generate unique row IDs for all rows
    row_ids = id_generator.generate_row_ids(len(all_rows))

    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Pre-DTCT"

    # Write headers
    headers = [
        'ID', 'FormID', 'AcademicSessionCode', 'ProgrammeCode',
        'ClassCommencement', 'Duration', 'ActivityCode', 'Capacity',
        'CourseCode', 'GroupCode', 'FacultyCode',
        'RequestSpecialRoomCode', 'RecurringUntilWeek'
    ]
    ws.append(headers)

    # Write data rows
    for i, row in enumerate(all_rows):
        row_id = row_ids[i]
        form_id = row.get('form_id_temp', '')  # Get the temporary FormID assigned earlier

        ws.append([
            row_id,
            form_id,
            row['academic_session_code'],
            row['programme_code'],
            row['class_commencement'],
            row['duration'],
            row['activity_code'],
            row['capacity'],
            row['course_code'],
            row['group_code'],
            row['faculty_code'],
            row['request_special_room_code'] or '',
            row['recurring_until_week']
        ])

    # Generate filename
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    filename = f"Pre-DTCT_{programme_code}_{timestamp}.xlsx"

    # Ensure output directory exists
    from flask import current_app
    output_dir = current_app.config['OUTPUT_DIR']
    os.makedirs(output_dir, exist_ok=True)

    file_path = os.path.join(output_dir, filename)

    # Save Excel file
    wb.save(file_path)
    wb.close()

    # Save to database
    # Create a submission for each FormID
    for form_id in form_ids_list:
        submission = FormSubmission(
            form_id=form_id,
            timestamp=timestamp,
            programme_code=programme_code,
            generated_file_path=file_path
        )
        db.session.add(submission)
        db.session.flush()

        # Save generated rows for this FormID
        for i, row in enumerate(all_rows):
            if row.get('form_id_temp') == form_id:
                generated_row = GeneratedRow(
                    submission_id=submission.id,
                    row_id=row_ids[i],
                    form_id=form_id,
                    academic_session_code=row['academic_session_code'],
                    programme_code=row['programme_code'],
                    class_commencement=row['class_commencement'],
                    duration=row['duration'],
                    activity_code=row['activity_code'],
                    capacity=row['capacity'],
                    course_code=row['course_code'],
                    group_code=row['group_code'],
                    faculty_code=row['faculty_code'],
                    request_special_room_code=row['request_special_room_code'],
                    recurring_until_week=row['recurring_until_week']
                )
                db.session.add(generated_row)

    db.session.commit()

    return filename
