from itertools import product
from datetime import datetime, timedelta


def calculate_recurring_dates(start_date_str, week_count, excluded_dates):
    """
    Calculate recurring dates based on start date, week count, and exclusions.

    Args:
        start_date_str: Start date in YYYY-MM-DD format
        week_count: Number of weeks to generate
        excluded_dates: List of dates to skip (YYYY-MM-DD format)

    Returns:
        List of date strings in YYYY-MM-DD format
    """
    result = []
    excluded_set = set(excluded_dates or [])

    if not start_date_str or week_count < 1:
        return result

    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    current_date = start_date

    while len(result) < week_count:
        date_str = current_date.strftime('%Y-%m-%d')

        if date_str not in excluded_set:
            result.append(date_str)

        # Move to next week
        current_date += timedelta(days=7)

    return result


def expand_rows(form_data):
    """
    Expand multi-select fields into separate rows using Cartesian product
    V4: Now also expands by recurring weeks

    Args:
        form_data: Dictionary containing form fields including multi-select arrays

    Returns:
        List of row dictionaries with expanded combinations
    """
    courses = form_data.get('course_codes', [])
    groups = form_data.get('group_codes', [])

    # Ensure courses and groups are lists
    if not isinstance(courses, list):
        courses = [courses]
    if not isinstance(groups, list):
        groups = [groups]

    # Create mappings from codes to texts
    course_texts = form_data.get('course_texts', [])
    if not isinstance(course_texts, list):
        course_texts = [course_texts]

    course_name_map = {}
    for i, code in enumerate(courses):
        if i < len(course_texts):
            # Extract just the name part (after " - ") if format is "CODE - Name"
            text = course_texts[i]
            if ' - ' in text:
                course_name_map[code] = text.split(' - ', 1)[1]
            else:
                course_name_map[code] = text
        else:
            course_name_map[code] = ''

    # V4: Get week venue details
    week_venue_details = form_data.get('week_venue_details', {})
    excluded_dates = form_data.get('excluded_dates', [])

    # V4: Calculate or use pre-calculated recurring dates
    recurring_dates = form_data.get('recurring_dates', None)
    if not recurring_dates:
        start_date = form_data.get('class_commencement')
        week_count = int(form_data.get('recurring_until_week', 1))
        recurring_dates = calculate_recurring_dates(start_date, week_count, excluded_dates)
    else:
        # Extract just the date strings if full objects passed
        recurring_dates = [d['date'] if isinstance(d, dict) else d for d in recurring_dates]

    # V4: Create Cartesian product of courses, groups, AND dates
    combinations = list(product(courses, groups, recurring_dates))

    # Build rows with all combinations
    rows = []
    group_capacities = form_data.get('group_capacities', {})

    # Calculate total capacity across all groups
    total_capacity = sum(group_capacities.values())

    for course, group, date_str in combinations:
        # Get capacity for this specific group
        group_capacity = group_capacities.get(group, 0)

        # V4: Get week-specific faculty and special room
        week_detail = week_venue_details.get(date_str, {})
        faculty_code = week_detail.get('faculty_code', '')
        special_room_code = week_detail.get('special_room_code', '')

        row = {
            'academic_session_code': form_data['academic_session_code'],
            'programme_code': form_data.get('programme_code', ''),  # V4: Now optional
            'class_commencement': date_str,  # V4: Per-week date instead of single date
            'duration': int(form_data['duration']),
            'activity_code': form_data['activity_code'],
            'group_code_capacity': int(group_capacity),  # Capacity for this specific group
            'total_capacity': int(total_capacity),  # Total capacity across all groups
            'course_code': course,
            'course_name': course_name_map.get(course, ''),
            'group_code': group,
            'faculty_code': faculty_code,  # V4: Per-week faculty
            'request_special_room_code': special_room_code,  # V4: Per-week special room
            'recurring_until_week': int(form_data['recurring_until_week'])
        }
        rows.append(row)

    return rows


def process_form(form_data):
    """
    Main form processing function

    Args:
        form_data: Dictionary containing all form fields

    Returns:
        List of expanded row dictionaries ready for Excel generation
    """
    return expand_rows(form_data)
