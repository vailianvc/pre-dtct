# Pre-DTCT Form Application - Implementation Plan

## Technology Stack Recommendation

### Core Technologies
- **Backend/Framework:** Python 3.11+ with Flask
- **Frontend:** HTML/CSS/JavaScript with Bootstrap 5 and Select2 (searchable dropdowns)
- **Database:** SQLite (file-based, bundled with Python)
- **Excel Processing:** openpyxl (read/write Excel files)
- **Packaging:** PyInstaller (create standalone executable)

### Why This Stack?
1. **Easy Distribution:** PyInstaller packages everything into a single .exe file users can double-click
2. **Excel Excellence:** Python's openpyxl library handles Excel files natively
3. **Simple Deployment:** Flask runs a local web server automatically, users access via `http://localhost:5000`
4. **No Installation Needed:** Packaged exe includes Python, dependencies, and web server
5. **SQLite Built-in:** No separate database installation required
6. **Familiar UI:** Bootstrap provides professional forms, Select2 enables searchable dropdowns

## Project Structure

```
dtct2/
├── app/
│   ├── __init__.py                 # Flask app initialization
│   ├── routes.py                   # Web routes/endpoints
│   ├── models.py                   # Database models
│   ├── services/
│   │   ├── excel_reader.py         # Read glossary Excel files
│   │   ├── excel_generator.py      # Generate output Excel file
│   │   ├── form_processor.py       # Process form data and expand rows
│   │   └── id_generator.py         # Generate ID and FormID
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css           # Custom styles
│   │   └── js/
│   │       └── form.js             # Frontend form logic
│   └── templates/
│       ├── base.html               # Base template
│       └── form.html               # Main form page
├── data/
│   ├── glossary/                   # Excel glossary files (read-only)
│   │   ├── glossary_dtct_activitycode.xlsx
│   │   ├── glossary_dtct_specialroomcode.xlsx
│   │   ├── glossary_sgcm_academicsessioncode.xlsx
│   │   ├── glossary_sgcm_coursecode.xlsx
│   │   ├── glossary_sgcm_facultycode.xlsx
│   │   ├── glossary_sgcm_groupcode.xlsx
│   │   └── glossary_sgcm_programmecode.xlsx
│   └── dtct.db                     # SQLite database (auto-created)
├── output/                         # Generated Excel files
├── config.py                       # Configuration settings
├── main.py                         # Application entry point
├── requirements.txt                # Python dependencies
├── build_exe.py                    # PyInstaller build script
└── README.md                       # User instructions
```

## Database Schema

### Tables

```sql
-- Cache glossary data for faster dropdown loading
CREATE TABLE glossary_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    glossary_type TEXT NOT NULL,  -- 'academicsession', 'programme', 'course', etc.
    code TEXT NOT NULL,
    description TEXT,
    UNIQUE(glossary_type, code)
);

-- Store form submissions for tracking
CREATE TABLE form_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id TEXT NOT NULL,        -- FormID (900001, 900002, etc.)
    timestamp TEXT NOT NULL,
    programme_code TEXT NOT NULL,
    generated_file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Store generated rows for auditing
CREATE TABLE generated_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER,
    row_id TEXT NOT NULL,         -- Full ID (20251226-1517-100001)
    form_id TEXT NOT NULL,
    academic_session_code TEXT,
    programme_code TEXT,
    class_commencement TEXT,
    duration INTEGER,
    activity_code TEXT,
    capacity INTEGER,
    course_code TEXT,
    group_code TEXT,
    faculty_code TEXT,
    request_special_room_code TEXT,
    recurring_until_week INTEGER,
    FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
);
```

## Implementation Phases

### Phase 1: Project Setup
**Files to create:**
- `main.py` - Flask app entry point with auto-browser launcher
- `config.py` - Configuration (paths, default values)
- `requirements.txt` - Dependencies list
- `app/__init__.py` - Flask initialization and database setup

**Key tasks:**
1. Initialize Flask application
2. Configure SQLite database connection
3. Set up folder structure
4. Create database initialization script

### Phase 2: Excel Glossary Processing
**Files to create:**
- `app/services/excel_reader.py`
- `app/models.py`

**Key logic:**
1. Read all glossary Excel files on app startup
2. Parse columns (typically: Code, Description)
3. Cache data in SQLite `glossary_cache` table
4. Provide API to fetch glossary data for dropdowns

**Excel reading approach:**
```python
# Using openpyxl to read Excel files
from openpyxl import load_workbook

def load_glossary(file_path, glossary_type):
    wb = load_workbook(file_path, read_only=True)
    ws = wb.active
    data = []
    for row in ws.iter_rows(min_row=2, values_only=True):  # Skip header
        code, description = row[0], row[1] if len(row) > 1 else ''
        data.append({'code': code, 'description': description})
    return data
```

### Phase 3: Frontend Form Implementation
**Files to create:**
- `app/templates/base.html` - Base layout with Bootstrap and Select2
- `app/templates/form.html` - Main form with all fields
- `app/static/css/style.css` - Custom styling (Cyberjaya University theme)
- `app/static/js/form.js` - Form validation and interaction

**UI Design Theme (Cyberjaya University inspired):**

**Color Scheme:**
- Primary: Dark purple/navy `#1C0F33`
- Secondary: Cyan/blue `#0693e3`
- Accent: White `#ffffff`
- Background: Dark purple gradient with white text
- Buttons: Dark background `#32373c` with white text
- Form inputs: White background with dark borders

**Typography:**
- Clean, modern sans-serif fonts (system font stack)
- Large headings for hierarchy
- Clear, readable body text

**Design Elements:**
- Fully rounded buttons (`border-radius: 9999px`)
- Professional, corporate-academic aesthetic
- Clean, modern layout with good spacing
- Responsive design for all screen sizes
- Smooth transitions and hover effects

**Layout:**
- Clean header with application title
- Centered form container with card-style design
- Well-spaced form fields with clear labels
- Prominent "Generate" button at bottom
- Footer with copyright/info

**Form fields implementation:**
1. **Dropdowns with search:** Use Select2 for all dropdowns
   - AcademicSessionCode, ProgrammeCode, ActivityCode, RequestSpecialRoomCode (optional)

2. **Multi-select dropdowns:** Select2 with `multiple: true`
   - CourseCode, GroupCode, FacultyCode

3. **Date dropdown:** Generate dates 9-13 Feb 2026 with day names
   ```javascript
   // Monday, 9 Feb 2026
   // Tuesday, 10 Feb 2025
   // etc.
   ```

4. **Integer fields with validation:**
   - Duration (default: 0, min: 0)
   - Capacity (default: 0, min: 0)
   - RecurringUntilWeek (default: 14, min: 1)

5. **Client-side validation:**
   - Required fields check
   - Integer validation
   - Multi-select minimum selection check

**CSS Theme Implementation Example:**
```css
/* app/static/css/style.css - Cyberjaya University Theme */
:root {
    --primary-color: #1C0F33;
    --secondary-color: #0693e3;
    --accent-color: #ffffff;
    --button-bg: #32373c;
}

body {
    background: linear-gradient(135deg, #1C0F33 0%, #2a1a4d 100%);
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-height: 100vh;
}

.form-container {
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    border-radius: 15px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    max-width: 900px;
    margin: 2rem auto;
}

.btn-primary {
    background: var(--button-bg);
    border: none;
    border-radius: 9999px;
    padding: 0.75rem 2rem;
    color: white;
    font-weight: 500;
    transition: all 0.3s ease;
}

.btn-primary:hover {
    background: var(--secondary-color);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(6, 147, 227, 0.4);
}

.app-header {
    background: var(--primary-color);
    color: white;
    padding: 1.5rem;
    text-align: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.form-label {
    color: var(--primary-color);
    font-weight: 500;
    margin-bottom: 0.5rem;
}

.select2-container--default .select2-selection--single,
.select2-container--default .select2-selection--multiple {
    border: 2px solid #ddd;
    border-radius: 8px;
    min-height: 42px;
}

.select2-container--default .select2-selection--single:focus,
.select2-container--default .select2-selection--multiple:focus {
    border-color: var(--secondary-color);
}
```

### Phase 4: Backend Routes and API
**Files to create:**
- `app/routes.py`

**Endpoints:**
1. `GET /` - Render form page
2. `GET /api/glossary/<type>` - Fetch glossary data for dropdowns
   - Returns JSON: `[{code: 'X', description: 'Y'}, ...]`
3. `POST /api/generate` - Process form and generate Excel file
   - Validate input
   - Generate IDs
   - Expand multi-select rows
   - Create Excel file
   - Return download link

### Phase 5: Form Processing Logic
**Files to create:**
- `app/services/form_processor.py`
- `app/services/id_generator.py`

**ID Generation Logic:**
```python
from datetime import datetime

def generate_id_prefix():
    """Generate YYYYMMDD-HHMM prefix"""
    now = datetime.now()
    return now.strftime('%Y%m%d-%H%M')

def generate_row_ids(num_rows):
    """Generate full IDs with running numbers"""
    prefix = generate_id_prefix()
    # Get last used running number from database for this prefix
    start_num = get_last_running_number(prefix) + 1
    return [f"{prefix}-{100000 + i:06d}" for i in range(start_num, start_num + num_rows)]

def generate_form_id():
    """Generate FormID (900001, 900002, etc.)"""
    # Get last FormID from database
    last_id = get_last_form_id()
    return f"{900000 + last_id + 1:06d}"
```

**Row Expansion Algorithm:**
```python
def expand_rows(form_data):
    """
    Expand multi-select fields into separate rows

    Example:
    Input: {
        ...,
        'course_codes': ['DIT1314'],
        'group_codes': ['UOC00001', 'UOC00002'],
        'faculty_codes': ['UATL3']
    }

    Output: 2 rows
    Row 1: DIT1314, UOC00001, UATL3
    Row 2: DIT1314, UOC00002, UATL3
    """
    from itertools import product

    # Get all multi-select fields
    courses = form_data['course_codes']
    groups = form_data['group_codes']
    faculties = form_data['faculty_codes']

    # Create cartesian product
    combinations = list(product(courses, groups, faculties))

    # Build rows
    rows = []
    for course, group, faculty in combinations:
        row = form_data.copy()
        row['course_code'] = course
        row['group_code'] = group
        row['faculty_code'] = faculty
        rows.append(row)

    return rows
```

### Phase 6: Excel File Generation
**Files to create:**
- `app/services/excel_generator.py`

**Generation process:**
1. Receive expanded rows from form processor
2. Generate IDs for each row
3. Assign FormID (same for all rows from one form submission)
4. Create Excel workbook with openpyxl
5. Write headers and data rows
6. Format cells (dates, integers)
7. Save to `output/Pre-DTCT_{programmecode}_{timestamp}.xlsx`
8. Store submission in database

**Excel writing approach:**
```python
from openpyxl import Workbook
from datetime import datetime

def generate_excel(rows, programme_code):
    wb = Workbook()
    ws = wb.active
    ws.title = "Pre-DTCT"

    # Headers
    headers = ['ID', 'FormID', 'AcademicSessionCode', 'ProgrammeCode',
               'ClassCommencement', 'Duration', 'ActivityCode', 'Capacity',
               'CourseCode', 'GroupCode', 'FacultyCode',
               'RequestSpecialRoomCode', 'RecurringUntilWeek']
    ws.append(headers)

    # Data rows
    for row in rows:
        ws.append([
            row['id'], row['form_id'], row['academic_session_code'],
            row['programme_code'], row['class_commencement'],
            row['duration'], row['activity_code'], row['capacity'],
            row['course_code'], row['group_code'], row['faculty_code'],
            row['request_special_room_code'], row['recurring_until_week']
        ])

    # Generate filename
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    filename = f"Pre-DTCT_{programme_code}_{timestamp}.xlsx"
    filepath = f"output/{filename}"

    wb.save(filepath)
    return filepath
```

### Phase 7: Packaging for Distribution
**Files to create:**
- `build_exe.py` - PyInstaller configuration
- `README.md` - User guide

**PyInstaller configuration:**
```python
# build_exe.py
import PyInstaller.__main__

PyInstaller.__main__.run([
    'main.py',
    '--name=PreDTCT',
    '--onefile',
    '--windowed',
    '--add-data=app/templates:app/templates',
    '--add-data=app/static:app/static',
    '--add-data=data/glossary:data/glossary',
    '--icon=icon.ico',  # Optional
    '--clean'
])
```

**Distribution package includes:**
1. `PreDTCT.exe` - Standalone executable
2. `data/glossary/` folder - All Excel glossary files
3. `output/` folder - Where generated files appear
4. `README.txt` - Instructions:
   - Double-click PreDTCT.exe
   - Browser opens automatically to http://localhost:5000
   - Fill form and click Generate
   - Find output in 'output' folder

**Build command:**
```bash
python build_exe.py
```

## Key Dependencies

```txt
Flask==3.0.0
openpyxl==3.1.2
Werkzeug==3.0.1
```

## Critical Files to Create/Modify

1. **Entry point:** `main.py`
2. **Flask app:** `app/__init__.py`, `app/routes.py`
3. **Services:** `app/services/excel_reader.py`, `app/services/excel_generator.py`, `app/services/form_processor.py`, `app/services/id_generator.py`
4. **Frontend:** `app/templates/form.html`, `app/static/js/form.js`
5. **Database:** `app/models.py`
6. **Build:** `build_exe.py`, `requirements.txt`

## Development Order

1. ✓ Set up Flask app and project structure
2. ✓ Implement Excel glossary reader and database caching
3. ✓ Create form HTML with all fields and Select2 dropdowns
4. ✓ Implement API endpoints for glossary data
5. ✓ Build form validation (frontend and backend)
6. ✓ Implement ID/FormID generation logic
7. ✓ Build row expansion algorithm for multi-select fields
8. ✓ Create Excel generator service
9. ✓ Test full workflow (form → process → Excel output)
10. ✓ **ENHANCED: Multi-entry feature with Add Entry button**
11. ✓ **ENHANCED: Entry list table with Edit/Delete functionality**
12. ✓ **ENHANCED: Each entry gets unique FormID (900001, 900002, etc.)**
13. ✓ **FIXED: FormID generation bug - sequential IDs now working correctly**
14. ✓ Package with PyInstaller
15. ✓ Create user documentation

## Multi-Entry Feature (Enhanced - Dec 2025)

### User Workflow
1. User fills form with entry details
2. Clicks "Add Entry" button to add entry to list (not Generate yet)
3. Entry appears in table below with Entry number badge
4. User can add more entries (repeat steps 1-3)
5. User can Edit or Delete entries from table
6. When ready, user clicks "Generate Excel File" button
7. All entries processed together in single Excel file
8. Each entry gets unique FormID (900001, 900002, 900003, etc.)

### Technical Implementation
- **Frontend**: JavaScript manages entries array in memory
- **Entry Counter**: Tracks entry numbers for display purposes
- **Edit Functionality**: Loads entry back into form and removes from list
- **Delete Functionality**: Removes entry from array with confirmation
- **Backend**: Generates FormIDs sequentially upfront to avoid duplicates
- **Excel Output**: Single file contains all entries with different FormIDs
- **FormID Fix**: Pre-generates all FormIDs before database operations to ensure uniqueness

### API Endpoint
- `POST /api/generate-multiple` - Processes multiple entries
- Accepts: `{ entries: [...] }` array of entry objects
- Returns: `{ file_path, form_ids[], row_count, entry_count }`

## Testing Approach

1. **Manual testing:** Fill form with various combinations
2. **Multi-select testing:** Test different numbers of selections
3. **Validation testing:** Try invalid inputs
4. **Excel output verification:** Check generated file matches examples in plan.txt
5. **ID generation testing:** Verify uniqueness and format
6. **Packaging testing:** Test .exe on clean machine

## Success Criteria

- ✓ Form loads with all searchable dropdowns populated from glossary files
- ✓ Validation prevents invalid submissions
- ✓ Multi-select creates correct number of expanded rows
- ✓ Generated Excel matches format in plan.txt examples
- ✓ IDs and FormIDs follow specified format
- ✓ Packaged .exe runs on any Windows machine without installation
- ✓ Users can distribute and run independently
