import math
from itertools import product
from datetime import datetime, timedelta


def calculate_recurring_dates(start_date_str, week_count, excluded_dates):
    """
    Calculate recurring dates based on start date, week count, and exclusions.

    Supports both old format (list of date strings) and new format (list of objects
    with 'date' and 'replacement' keys) for backward compatibility.

    If a date is excluded with a replacement, the replacement date is used.
    If a date is excluded without a replacement, that week is skipped entirely
    (no additional week is added to compensate).

    Args:
        start_date_str: Start date in YYYY-MM-DD format
        week_count: Number of weeks to iterate through
        excluded_dates: List of dates to skip or objects with replacement dates
            Old format: ["2026-02-09", "2026-02-16"]
            New format: [{"date": "2026-02-09", "replacement": "2026-03-01"}, ...]

    Returns:
        List of date strings in YYYY-MM-DD format (using replacement dates where specified)
    """
    result = []

    if not start_date_str or week_count < 1:
        return result

    # Build lookup for excluded dates and their replacements
    # Handle both old format (list of strings) and new format (list of objects)
    excluded_map = {}
    for item in (excluded_dates or []):
        if isinstance(item, str):
            # Old format: just a date string, no replacement
            excluded_map[item] = None
        elif isinstance(item, dict) and 'date' in item:
            # New format: object with date and replacement
            excluded_map[item['date']] = item.get('replacement')

    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    current_date = start_date

    # Iterate through exactly week_count weeks
    for _ in range(week_count):
        date_str = current_date.strftime('%Y-%m-%d')

        if date_str in excluded_map:
            # This date is excluded
            replacement = excluded_map[date_str]
            if replacement:
                # Use replacement date instead
                result.append(replacement)
            # If no replacement, skip this week entirely (don't add to result)
        else:
            result.append(date_str)

        # Move to next week
        current_date += timedelta(days=7)

    return result


def normalise_week_venue_details(details):
    """Convert old flat format to new sessions/venues format.

    Old format: { "2026-03-30": { "faculty_code": "FAC001", ... } }
    New format: { "2026-03-30": { "sessions": [{ "venues": [{ "faculty_code": "FAC001", ... }] }] } }
    """
    normalised = {}
    for date_key, detail in details.items():
        if 'sessions' in detail:
            normalised[date_key] = detail
        else:
            normalised[date_key] = {
                'sessions': [{'venues': [detail]}]
            }
        # Migrate date-level start_time/end_time to session level
        date_start = detail.get('start_time', '')
        date_end = detail.get('end_time', '')
        if date_start or date_end:
            for session in normalised[date_key]['sessions']:
                session.setdefault('start_time', date_start)
                session.setdefault('end_time', date_end)
    return normalised


def expand_rows(form_data):
    """
    Expand multi-select fields into separate rows using Cartesian product.
    Expands by recurring weeks, sessions, and venues.

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

    # Get week venue details and normalise to new format
    week_venue_details = normalise_week_venue_details(
        form_data.get('week_venue_details', {})
    )
    excluded_dates = form_data.get('excluded_dates', [])

    # Calculate or use pre-calculated recurring dates
    recurring_dates = form_data.get('recurring_dates', None)
    if not recurring_dates:
        start_date = form_data.get('class_commencement')
        week_count = int(form_data.get('recurring_until_week', 1))
        recurring_dates = calculate_recurring_dates(start_date, week_count, excluded_dates)
    else:
        # Extract just the date strings if full objects passed
        recurring_dates = [d['date'] if isinstance(d, dict) else d for d in recurring_dates]

    # Create Cartesian product of courses, groups, AND dates
    combinations = list(product(courses, groups, recurring_dates))

    # Build rows with all combinations
    rows = []
    group_capacities = form_data.get('group_capacities', {})

    # Calculate total capacity across all groups
    total_capacity = sum(group_capacities.values())

    # Generate CourseGroupID mapping for unique course-group combinations
    course_group_map = {}
    course_group_counter = 1
    for course, group in product(courses, groups):
        key = (course, group)
        if key not in course_group_map:
            course_group_map[key] = course_group_counter
            course_group_counter += 1

    for course, group, date_str in combinations:
        # Get capacity for this specific group
        group_capacity = group_capacities.get(group, 0)

        # Get session/venue details for this date
        date_detail = week_venue_details.get(date_str, {})
        sessions = date_detail.get('sessions', [{'venues': [{}]}])

        for session in sessions:
            start_time = session.get('start_time', '')
            end_time = session.get('end_time', '')
            venues = session.get('venues', [{}])
            num_venues = len(venues)

            for v_idx, venue in enumerate(venues):
                faculty_code = venue.get('faculty_code', '')
                faculty_code2 = venue.get('faculty_code2', '')
                special_room_code = venue.get('special_room_code', '')

                # TotalCapacity split across venues: first `remainder` venues get one extra
                if num_venues > 1:
                    base = total_capacity // num_venues
                    remainder = total_capacity % num_venues
                    split_total = base + 1 if v_idx < remainder else base
                else:
                    split_total = total_capacity

                row = {
                    'academic_session_code': form_data['academic_session_code'],
                    'programme_code': form_data.get('programme_code', ''),
                    'class_commencement': form_data['class_commencement'],
                    'scheduled_date': date_str,
                    'start_time': start_time,
                    'end_time': end_time,
                    'duration': int(form_data['duration']),
                    'activity_code': form_data['activity_code'],
                    'group_code_capacity': int(group_capacity),
                    'total_capacity': int(split_total),
                    'course_code': course,
                    'course_name': course_name_map.get(course, ''),
                    'group_code': group,
                    'faculty_code': faculty_code,
                    'faculty_code2': faculty_code2,
                    'request_special_room_code': special_room_code,
                    'recurring_until_week': int(form_data['recurring_until_week']),
                    'course_group_seq': course_group_map[(course, group)]
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
