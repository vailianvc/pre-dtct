# Pre-DTCT Form Generator

Digital Timetabling Coordination Tool (DTCT) - Pre-submission Form Generator

## Overview

The Pre-DTCT Form Generator is a web-based application that allows lecturers to input academic scheduling information and generate standardised Excel files for timetabling coordination.

## Features

- **User-friendly web interface** with searchable dropdowns
- **Multi-selection support** for courses, groups, and faculty
- **Automatic row expansion** based on Cartesian product of selections
- **Unique ID generation** with timestamp and running numbers
- **Form validation** to ensure data integrity
- **Excel file generation** in standardised format
- **Cyberjaya University-inspired modern UI theme**

## System Requirements

- **Operating System:** Windows 10/11, Linux, or macOS
- **Python:** 3.11 or higher (for development)
- **Browser:** Modern web browser (Chrome, Firefox, Edge, Safari)

## Installation & Setup

### For Developers

1. **Clone or download the project**
   ```bash
   cd dtct2
   ```

2. **Create a virtual environment**
   ```bash
   python3 -m venv venv
   ```

3. **Activate the virtual environment**
   - **Linux/macOS:**
     ```bash
     source venv/bin/activate
     ```
   - **Windows:**
     ```bash
     venv\Scripts\activate
     ```

4. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run the application**
   ```bash
   python main.py
   ```

6. **Access the application**
   - Open your browser and navigate to: `http://127.0.0.1:5000`
   - Or wait for the browser to open automatically

### For End Users (Standalone Executable)

1. **Extract the PreDTCT folder** to your desired location

2. **Ensure folder structure:**
   ```
   PreDTCT/
   ├── PreDTCT.exe          # Main executable
   ├── data/
   │   └── glossary/        # Excel glossary files
   └── output/              # Generated files will appear here
   ```

3. **Double-click PreDTCT.exe** to start the application

4. **Browser will open automatically** to the form page

5. **Fill in the form and click "Generate"**

6. **Find your generated Excel file** in the `output/` folder

## Usage Guide

### Multi-Entry Workflow (New!)

The application now supports adding **multiple entries** before generating a single Excel file. Each entry gets its own unique FormID.

**Workflow:**
1. **Fill the form** with all required fields
2. **Click "Add Entry"** to add it to the list (don't click Generate yet!)
3. **Repeat** steps 1-2 to add more entries
4. **Review entries** in the table below the form
5. **Edit or Delete** entries as needed
6. **Click "Generate Excel File"** when ready
7. **Download** the Excel file containing all entries

**Each entry will have:**
- Unique FormID (900001, 900002, 900003, etc.)
- All multi-selections expanded via Cartesian product
- Same timestamp but different row IDs

### Form Fields

**Required Fields:**
1. **Academic Session Code** - Select from dropdown
2. **Programme Code** - Select from dropdown
3. **Class Commencement** - Choose from available dates (9-13 Feb 2026)
4. **Duration** - Number of hours (integer, default: 0)
5. **Activity Code** - Select from dropdown
6. **Capacity** - Maximum student capacity (integer, default: 0)
7. **Course Code(s)** - Select one or more courses (multi-select)
8. **Group Code(s)** - Select one or more groups (multi-select)
9. **Faculty Code(s)** - Select one or more faculty members (multi-select)
10. **Recurring Until Week** - Number of weeks (integer, default: 14)

**Optional Fields:**
- **Request Special Room Code** - Select if special room required

### How Multi-Selection Works

When you select multiple items in Course, Group, or Faculty fields, the application automatically generates all possible combinations (Cartesian product).

**Single Entry Example:**
- Courses: DIT1314
- Groups: UOC00001, UOC00002
- Faculty: UATL3

**Result:** 2 rows with same FormID (900001):
1. FormID 900001: DIT1314, UOC00001, UATL3
2. FormID 900001: DIT1314, UOC00002, UATL3

**Multi-Entry Example:**

*Entry 1:*
- Programme: DOSH
- Courses: DIT1314
- Groups: UOC00001, UOC00002
- Faculty: UATL3

*Entry 2:*
- Programme: DIA
- Courses: MCP5043
- Groups: BBET00022
- Faculty: UOC256

**Result:** 3 rows in single Excel file:
1. FormID 900001: DIT1314, UOC00001, UATL3
2. FormID 900001: DIT1314, UOC00002, UATL3
3. FormID 900002: MCP5043, BBET00022, UOC256

### Generated Excel File

**Filename format:** `Pre-DTCT_{ProgrammeCode}_{Timestamp}.xlsx`

**Columns:**
- ID - Unique row identifier (YYYYMMDD-HHMM-NNNNNN)
- FormID - Form submission identifier (900001, 900002, etc.)
- AcademicSessionCode
- ProgrammeCode
- ClassCommencement
- Duration
- ActivityCode
- Capacity
- CourseCode
- GroupCode
- FacultyCode
- RequestSpecialRoomCode
- RecurringUntilWeek

## Building Standalone Executable

To create a standalone executable for distribution:

1. **Install PyInstaller**
   ```bash
   pip install pyinstaller
   ```

2. **Run the build script**
   ```bash
   python build_exe.py
   ```

3. **Find the executable in `dist/PreDTCT/`**

4. **Distribute the entire `dist/PreDTCT` folder** to users

## Project Structure

```
dtct2/
├── app/
│   ├── __init__.py              # Flask app initialisation
│   ├── routes.py                # Web routes/API endpoints
│   ├── models.py                # Database models
│   ├── services/
│   │   ├── excel_reader.py      # Read glossary Excel files
│   │   ├── excel_generator.py   # Generate output Excel
│   │   ├── form_processor.py    # Process form data
│   │   └── id_generator.py      # Generate IDs
│   ├── static/
│   │   ├── css/style.css        # Cyberjaya theme CSS
│   │   └── js/form.js           # Frontend logic
│   └── templates/
│       ├── base.html            # Base template
│       └── form.html            # Main form
├── data/
│   ├── glossary/                # Excel glossary files
│   └── dtct.db                  # SQLite database (auto-created)
├── output/                      # Generated Excel files
├── config.py                    # Configuration
├── main.py                      # Application entry point
├── requirements.txt             # Python dependencies
├── build_exe.py                 # PyInstaller build script
└── README.md                    # This file
```

## Troubleshooting

### Application won't start
- Ensure Python 3.11+ is installed
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify glossary Excel files exist in `data/glossary/`

### Browser doesn't open automatically
- Manually open your browser and navigate to `http://127.0.0.1:5000`

### Dropdowns are empty
- Check that glossary Excel files are present in `data/glossary/`
- Verify database was created successfully (`data/dtct.db`)
- Restart the application

### Generated file not found
- Check the `output/` folder in the application directory
- Ensure you have write permissions to the output folder

### Port 5000 already in use
- Close other applications using port 5000
- Or modify `main.py` to use a different port

## Technical Details

**Technology Stack:**
- **Backend:** Python 3.11+ with Flask
- **Frontend:** HTML, CSS, JavaScript with Bootstrap 5 and Select2
- **Database:** SQLite
- **Excel Processing:** openpyxl
- **Packaging:** PyInstaller

**Browser Compatibility:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Support

For issues or questions, please contact the development team.

## Version

Version 1.0.0 - December 2025

## Licence

Copyright © 2025 Pre-DTCT Form Generator
