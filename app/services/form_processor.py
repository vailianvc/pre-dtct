from itertools import product

def expand_rows(form_data):
    """
    Expand multi-select fields into separate rows using Cartesian product

    Args:
        form_data: Dictionary containing form fields including multi-select arrays

    Returns:
        List of row dictionaries with expanded combinations
    """
    courses = form_data.get('course_codes', [])
    groups = form_data.get('group_codes', [])
    faculties = form_data.get('faculty_codes', [])

    # Ensure all are lists
    if not isinstance(courses, list):
        courses = [courses]
    if not isinstance(groups, list):
        groups = [groups]
    if not isinstance(faculties, list):
        faculties = [faculties]

    # Create Cartesian product of all combinations
    combinations = list(product(courses, groups, faculties))

    # Build rows with all combinations
    rows = []
    group_capacities = form_data.get('group_capacities', {})

    # Calculate total capacity across all groups
    total_capacity = sum(group_capacities.values())

    for course, group, faculty in combinations:
        # Get capacity for this specific group
        group_capacity = group_capacities.get(group, 0)

        row = {
            'academic_session_code': form_data['academic_session_code'],
            'programme_code': form_data['programme_code'],
            'class_commencement': form_data['class_commencement'],
            'duration': int(form_data['duration']),
            'activity_code': form_data['activity_code'],
            'group_code_capacity': int(group_capacity),  # Capacity for this specific group
            'total_capacity': int(total_capacity),  # Total capacity across all groups
            'course_code': course,
            'group_code': group,
            'faculty_code': faculty,
            'request_special_room_code': form_data.get('request_special_room_code', ''),
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
