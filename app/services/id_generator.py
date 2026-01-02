from datetime import datetime
from app import db
from app.models import FormSubmission, GeneratedRow

def generate_id_prefix():
    """
    Generate YYYYMMDD-HHMM prefix for row IDs

    Returns:
        String in format YYYYMMDD-HHMM
    """
    now = datetime.now()
    return now.strftime('%Y%m%d-%H%M')

def get_last_running_number(prefix):
    """
    Get the last running number used for a specific prefix

    Args:
        prefix: Date-time prefix (YYYYMMDD-HHMM)

    Returns:
        Integer of last running number, or 0 if none exist
    """
    # Query for rows with this prefix
    last_row = GeneratedRow.query.filter(
        GeneratedRow.row_id.like(f'{prefix}%')
    ).order_by(GeneratedRow.row_id.desc()).first()

    if last_row:
        # Extract running number from row_id (last 6 digits)
        try:
            running_num = int(last_row.row_id.split('-')[-1])
            return running_num
        except:
            return 100000

    return 100000

def generate_row_ids(num_rows):
    """
    Generate unique row IDs with running numbers

    Args:
        num_rows: Number of IDs to generate

    Returns:
        List of row ID strings
    """
    prefix = generate_id_prefix()
    start_num = get_last_running_number(prefix) + 1

    return [f"{prefix}-{i:06d}" for i in range(start_num, start_num + num_rows)]

def get_last_form_id():
    """
    Get the last FormID used

    Returns:
        Integer of last FormID number, or 900000 if none exist
    """
    last_submission = FormSubmission.query.order_by(
        FormSubmission.form_id.desc()
    ).first()

    if last_submission:
        try:
            return int(last_submission.form_id)
        except:
            return 900000

    return 900000

def generate_form_id():
    """
    Generate next FormID in sequence (900001, 900002, etc.)

    Returns:
        String FormID
    """
    last_id = get_last_form_id()
    next_id = last_id + 1
    return f"{next_id:06d}"
