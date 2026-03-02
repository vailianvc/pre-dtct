import json
import os
from datetime import datetime
from flask import Blueprint, render_template, jsonify, request, send_file, current_app
from werkzeug.utils import secure_filename
from app import db
from app.models import SavedSession, GlossaryMeta, GlossaryCache
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
            # Support legacy single capacity field for backwards compatibility
            if 'capacity' in entry and 'group_capacities' not in entry:
                single_capacity = entry['capacity']
                group_codes = entry.get('group_codes', [])
                entry['group_capacities'] = {group: single_capacity for group in group_codes}

            # V4: Validate required fields (removed programme_code and faculty_code)
            required_fields = ['academic_session_code', 'class_commencement',
                              'duration', 'activity_code', 'group_capacities', 'course_codes',
                              'group_codes', 'recurring_until_week']

            for field in required_fields:
                if field not in entry or entry[field] is None or entry[field] == '':
                    if field in ['course_codes', 'group_codes']:
                        if not entry.get(field) or len(entry.get(field, [])) == 0:
                            return jsonify({'error': f'Entry is missing required field: {field}'}), 400
                    else:
                        return jsonify({'error': f'Entry is missing required field: {field}'}), 400

            # V4: Validate week_venue_details
            week_venue_details = entry.get('week_venue_details', {})
            if not week_venue_details or len(week_venue_details) == 0:
                return jsonify({'error': 'Week venue and lecturer details are required'}), 400

            # Validate each week has a faculty code (supports both old and new format)
            for date_key, detail in week_venue_details.items():
                if 'sessions' in detail:
                    for session in detail['sessions']:
                        for venue in session.get('venues', []):
                            if not venue.get('faculty_code'):
                                return jsonify({'error': f'Faculty code missing for date: {date_key}'}), 400
                else:
                    if not detail.get('faculty_code'):
                        return jsonify({'error': f'Faculty code missing for date: {date_key}'}), 400

            # Validate group_capacities structure
            group_capacities = entry.get('group_capacities', {})
            group_codes = entry.get('group_codes', [])

            if not isinstance(group_capacities, dict):
                return jsonify({'error': 'group_capacities must be an object'}), 400

            # Verify all selected groups have capacity values
            for group_code in group_codes:
                if group_code not in group_capacities:
                    return jsonify({'error': f'Missing capacity for group: {group_code}'}), 400

                capacity_value = group_capacities[group_code]
                if not isinstance(capacity_value, int) or capacity_value < 0:
                    return jsonify({'error': f'Invalid capacity value for group {group_code}'}), 400

            # Verify no extra groups in capacities
            for group_code in group_capacities.keys():
                if group_code not in group_codes:
                    return jsonify({'error': f'Capacity specified for unselected group: {group_code}'}), 400

            # Store first programme code for filename (V4: may be empty)
            if programme_code is None:
                programme_code = entry.get('programme_code', '') or 'GENERAL'

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

@bp.route('/api/sessions', methods=['POST'])
def save_session():
    """Save or overwrite a named session"""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        entries = data.get('entries')
        entry_counter = data.get('entry_counter', 1)

        if not name:
            return jsonify({'error': 'Session name is required'}), 400
        if len(name) > 200:
            return jsonify({'error': 'Session name must be 200 characters or fewer'}), 400
        if not entries or not isinstance(entries, list) or len(entries) == 0:
            return jsonify({'error': 'At least one entry is required'}), 400
        if not isinstance(entry_counter, int) or entry_counter < 1:
            return jsonify({'error': 'Invalid entry counter'}), 400

        entries_json = json.dumps(entries)
        existing = SavedSession.query.filter_by(name=name).first()
        overwritten = False

        if existing:
            existing.entries_json = entries_json
            existing.entry_counter = entry_counter
            existing.updated_at = datetime.utcnow()
            overwritten = True
        else:
            session = SavedSession(
                name=name,
                entries_json=entries_json,
                entry_counter=entry_counter
            )
            db.session.add(session)

        db.session.commit()
        return jsonify({'success': True, 'overwritten': overwritten})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/sessions', methods=['GET'])
def list_sessions():
    """List all saved sessions (summary only)"""
    try:
        sessions = SavedSession.query.order_by(SavedSession.updated_at.desc()).all()
        return jsonify([s.to_dict() for s in sessions])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/sessions/<int:session_id>', methods=['GET'])
def get_session(session_id):
    """Load a session with full entries data"""
    try:
        session = SavedSession.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        return jsonify({
            'id': session.id,
            'name': session.name,
            'entries': json.loads(session.entries_json),
            'entry_counter': session.entry_counter
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a saved session"""
    try:
        session = SavedSession.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        db.session.delete(session)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/glossaries')
def glossaries():
    """Render glossary management page"""
    glossary_descriptions = current_app.config.get('GLOSSARY_DESCRIPTIONS', {})
    glossary_files = current_app.config.get('GLOSSARY_FILES', {})

    categories = []
    for gtype in glossary_files.keys():
        meta = GlossaryMeta.query.filter_by(glossary_type=gtype).first()
        desc = glossary_descriptions.get(gtype, {})
        count = GlossaryCache.query.filter_by(glossary_type=gtype).count()
        categories.append({
            'type': gtype,
            'label': desc.get('label', gtype.title()),
            'icon': desc.get('icon', 'bi-file-earmark'),
            'description': desc.get('description', ''),
            'entry_count': count,
            'last_uploaded_at': meta.last_uploaded_at if meta else None,
            'original_filename': meta.original_filename if meta else None
        })

    return render_template('glossaries.html', categories=categories)

def _allowed_file(filename):
    """Check if uploaded file has an allowed extension"""
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in current_app.config.get('ALLOWED_EXTENSIONS', set())

@bp.route('/api/glossary/<glossary_type>/upload', methods=['POST'])
def upload_glossary(glossary_type):
    """Upload a new glossary Excel file for a given type"""
    glossary_files = current_app.config.get('GLOSSARY_FILES', {})

    if glossary_type not in glossary_files:
        return jsonify({'error': 'Invalid glossary type'}), 400

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not _allowed_file(file.filename):
        allowed = ', '.join(current_app.config.get('ALLOWED_EXTENSIONS', set()))
        return jsonify({'error': f'Invalid file type. Allowed: {allowed}'}), 400

    # Save file using the configured glossary filename (overwrites existing)
    target_filename = glossary_files[glossary_type]
    glossary_dir = current_app.config['GLOSSARY_DIR']
    target_path = os.path.join(glossary_dir, target_filename)

    original_filename = secure_filename(file.filename)

    try:
        file.save(target_path)
    except Exception as e:
        return jsonify({'error': f'Failed to save file: {e}'}), 500

    # Reload glossary data from the new file
    result = excel_reader.reload_single_glossary(glossary_type, target_path)

    if not result['success']:
        return jsonify({'error': result.get('error', 'Failed to reload glossary')}), 500

    # Update metadata
    meta = GlossaryMeta.query.filter_by(glossary_type=glossary_type).first()
    if not meta:
        meta = GlossaryMeta(glossary_type=glossary_type)
        db.session.add(meta)
    meta.entry_count = result['count']
    meta.last_uploaded_at = datetime.utcnow()
    meta.original_filename = original_filename

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update metadata: {e}'}), 500

    return jsonify({
        'success': True,
        'count': result['count'],
        'last_uploaded_at': meta.last_uploaded_at.strftime('%d %b %Y, %H:%M'),
        'original_filename': original_filename
    })
