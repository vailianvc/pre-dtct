from flask import Blueprint, render_template, jsonify, request, send_file
from app.services import excel_reader

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    """Render main form page"""
    return render_template('form.html')

@bp.route('/api/glossary/<glossary_type>')
def get_glossary(glossary_type):
    """Get glossary data for dropdowns"""
    valid_types = ['academicsession', 'programme', 'course', 'group', 'faculty', 'activity', 'specialroom']

    if glossary_type not in valid_types:
        return jsonify({'error': 'Invalid glossary type'}), 400

    data = excel_reader.get_glossary_data(glossary_type)
    return jsonify(data)

@bp.route('/api/generate-multiple', methods=['POST'])
def generate_multiple_excel():
    """Process multiple entries and generate single Excel file"""
    try:
        request_data = request.get_json()
        entries = request_data.get('entries', [])

        if not entries or len(entries) == 0:
            return jsonify({'error': 'No entries provided'}), 400

        # Import services when needed
        from app.services import form_processor, excel_generator

        all_rows = []
        form_ids = []
        programme_code = None

        # Generate all FormIDs upfront to avoid duplicates
        from app.services import id_generator
        start_form_id = id_generator.get_last_form_id() + 1

        for idx in range(len(entries)):
            form_ids.append(f"{start_form_id + idx:06d}")

        # Process each entry
        for idx, entry in enumerate(entries):
            # Validate required fields
            required_fields = ['academic_session_code', 'programme_code', 'class_commencement',
                              'duration', 'activity_code', 'capacity', 'course_codes',
                              'group_codes', 'faculty_codes', 'recurring_until_week']

            for field in required_fields:
                if field not in entry or entry[field] is None or entry[field] == '':
                    if field in ['course_codes', 'group_codes', 'faculty_codes']:
                        if not entry.get(field) or len(entry.get(field, [])) == 0:
                            return jsonify({'error': f'Entry is missing required field: {field}'}), 400
                    else:
                        return jsonify({'error': f'Entry is missing required field: {field}'}), 400

            # Store first programme code for filename
            if programme_code is None:
                programme_code = entry['programme_code']

            # Process and expand rows for this entry
            expanded_rows = form_processor.process_form(entry)

            # Get pre-generated FormID for this entry
            form_id = form_ids[idx]

            # Add FormID to each row
            for row in expanded_rows:
                row['form_id_temp'] = form_id
                all_rows.append(row)

        # Generate single Excel file with all entries
        file_path = excel_generator.generate_excel_file_multiple(all_rows, programme_code, form_ids)

        return jsonify({
            'success': True,
            'file_path': file_path,
            'form_ids': form_ids,
            'row_count': len(all_rows),
            'entry_count': len(entries)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/download/<path:filename>')
def download_file(filename):
    """Download generated Excel file"""
    import os
    from flask import current_app

    file_path = os.path.join(current_app.config['OUTPUT_DIR'], filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    else:
        return jsonify({'error': 'File not found'}), 404
