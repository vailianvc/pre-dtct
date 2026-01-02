# Changelog

All notable changes to the Pre-DTCT Form Generator project are documented here.

## [1.1.0] - 2025-12-26

### Added - Multi-Entry Feature
- **Add Entry Button**: Users can now add multiple entries before generating Excel
- **Entry List Table**: Visual display of all added entries with entry numbers
- **Edit Entry**: Click Edit to load entry back into form for modification
- **Delete Entry**: Remove entries from list with confirmation dialogue
- **Entry Counter**: Each entry is numbered (Entry 1, Entry 2, etc.)
- **Unique FormIDs**: Each entry gets its own FormID (900001, 900002, 900003, etc.)
- **Generate All Button**: Process all entries together in a single Excel file

### Fixed
- **FormID Duplication Bug**: Fixed issue where multiple entries were getting the same FormID
  - Root cause: FormID generation was querying database in loop before commit
  - Solution: Pre-generate all FormIDs sequentially upfront to ensure uniqueness

### Changed
- **User Workflow**: Changed from single-entry to multi-entry workflow
  - Old: Fill form → Click Generate → Download
  - New: Fill form → Add Entry → (Repeat) → Generate All → Download
- **Button Labels**:
  - Main form button changed from "Generate" to "Add Entry"
  - New "Generate Excel File" button in entries section
- **API Endpoint**: New `/api/generate-multiple` endpoint for processing multiple entries

### Technical Details
- Frontend manages entries in JavaScript array
- Backend generates sequential FormIDs before database operations
- Single Excel file contains all entries with different FormIDs
- Each entry's multi-selections are expanded via Cartesian product
- Edit functionality removes entry from list and populates form
- Delete functionality removes entry with user confirmation

## [1.0.0] - 2025-12-26

### Initial Release
- Flask-based web application with Cyberjaya University theme
- Form with searchable dropdowns (Select2)
- Multi-selection fields for Courses, Groups, and Faculty
- Automatic row expansion using Cartesian product
- Unique ID generation (YYYYMMDD-HHMM-NNNNNN format)
- FormID generation (900001, 900002, etc.)
- Excel file generation with openpyxl
- SQLite database for glossary caching and audit trail
- Form validation (frontend and backend)
- 7,256 glossary entries from 7 Excel files
- Date range: 9-13 Feb 2026
- Responsive design with Bootstrap 5
- PyInstaller build script for standalone distribution

### Features
- Academic Session Code dropdown
- Programme Code dropdown
- Class Commencement date selector
- Duration, Capacity, Recurring Until Week integer fields
- Activity Code dropdown
- Course Codes multi-select
- Group Codes multi-select
- Faculty Codes multi-select
- Special Room Code dropdown (optional)
- Real-time form validation
- Excel file download
- Database audit trail

### Bug Fixes During Development
- Fixed duplicate entries in specialroom glossary (15 duplicates)
- Updated date range from 2025 to 2026
- Fixed browser auto-open on WSL/Linux
- Handled Excel file duplicate codes gracefully
