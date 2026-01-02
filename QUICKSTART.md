# Quick Start Guide

## Running the Application

### Option 1: Using Python (Developers)

1. **Open terminal in the project folder**
   ```bash
   cd /path/to/dtct2
   ```

2. **Activate virtual environment**
   ```bash
   source venv/bin/activate   # Linux/macOS
   # or
   venv\Scripts\activate      # Windows
   ```

3. **Run the application**
   ```bash
   python main.py
   ```

4. **Open browser**
   - Go to: `http://127.0.0.1:5000`
   - Or wait for auto-open

### Option 2: Using Standalone Executable (End Users)

1. **Double-click `PreDTCT.exe`**

2. **Wait for browser to open**

3. **Fill in the form**

## Filling the Form (Multi-Entry Workflow)

### Step 1: Fill First Entry
1. Select **Academic Session Code**
2. Select **Programme Code**
3. Choose **Class Commencement** date
4. Enter **Duration** (hours)
5. Select **Activity Code**
6. Enter **Capacity** (number of students)
7. Select one or more **Course Codes**
8. Select one or more **Group Codes**
9. Select one or more **Faculty Codes**
10. (Optional) Select **Special Room Code**
11. Set **Recurring Until Week** (default: 14)

### Step 2: Add Entry to List
1. Click **"Add Entry"** button (not Generate!)
2. Entry appears in table below
3. Form clears automatically

### Step 3: Add More Entries (Optional)
1. Fill form again with different data
2. Click **"Add Entry"** again
3. Repeat as many times as needed

### Step 4: Review Entries
- View all entries in table
- **Edit**: Click to modify an entry
- **Delete**: Click to remove an entry

### Step 5: Generate Excel File
1. Click **"Generate Excel File"** button (in entries section)
2. Wait for success message
3. Click **Download Excel File**
4. Find file in `output/` folder

**Note:** Each entry gets a unique FormID (900001, 900002, etc.)

## Example

**Entry 1:**
- Academic Session: EXMS-2026-267
- Programme: DOSH
- Date: Monday, 9 Feb 2026
- Duration: 2
- Activity: ACTMTR0011
- Capacity: 50
- Courses: DIT1314
- Groups: UOC00001, UOC00002
- Faculty: UATL3
- Recurring: 14 weeks

Click "Add Entry"

**Entry 2:**
- Academic Session: EXMS-2026-267
- Programme: DIA
- Date: Monday, 9 Feb 2026
- Duration: 2
- Activity: ACTMTR0012
- Capacity: 10
- Courses: MCP5043
- Groups: BBET00022
- Faculty: UOC256
- Recurring: 14 weeks

Click "Add Entry", then click "Generate Excel File"

**Output:**
3 rows in single Excel file:
- FormID 900001: DIT1314, UOC00001, UATL3
- FormID 900001: DIT1314, UOC00002, UATL3
- FormID 900002: MCP5043, BBET00022, UOC256

## Tips

✓ Use the **search box** in dropdowns to find items quickly
✓ You can select **multiple items** in Course/Group/Faculty fields
✓ **Add multiple entries** before generating to save time
✓ Each entry gets a **unique FormID** (900001, 900002, etc.)
✓ **Edit entries** before generating if you need to make changes
✓ **Delete entries** you don't need anymore
✓ All fields marked with ***** are required
✓ Generated files are saved in the **output/** folder
✓ The form **clears automatically** after adding an entry

## Common Issues

**Q: Dropdowns are empty?**
A: Ensure glossary Excel files are in `data/glossary/` folder

**Q: Browser doesn't open?**
A: Manually open browser and go to `http://127.0.0.1:5000`

**Q: Can't find generated file?**
A: Check the `output/` folder in application directory

**Q: Port already in use?**
A: Close other applications or change port in `main.py`

## Need Help?

See full documentation in `README.md`
