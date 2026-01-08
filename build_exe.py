"""
PyInstaller build script for Pre-DTCT Form Application

This script packages the Flask application into a standalone executable
that can be distributed to users without requiring Python installation.

Usage:
    1. Install PyInstaller: pip install pyinstaller
    2. Run this script: python build_exe.py
    3. Find the executable in dist/PreDTCT/
"""

import PyInstaller.__main__
import os
import sys

# Ensure we're in the project directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("Building Pre-DTCT executable...")
print("This may take several minutes...\n")

PyInstaller.__main__.run([
    'main.py',
    '--name=PreDTCT',
    '--onedir',  # Create a directory with dependencies
    '--noconsole',  # No console window (Windows)
    '--add-data=app/templates:app/templates',
    '--add-data=app/static:app/static',
    '--add-data=data/glossary:data/glossary',
    '--hidden-import=flask',
    '--hidden-import=flask_sqlalchemy',
    '--hidden-import=openpyxl',
    '--hidden-import=sqlalchemy',
    '--hidden-import=config',  # Required for Flask config loading
    '--clean',
    '--noconfirm'
])

print("\n" + "="*60)
print("Build complete!")
print("="*60)
print("\nThe executable is located in: dist/PreDTCT/")
print("\nTo distribute:")
print("1. Copy the entire 'dist/PreDTCT' folder")
print("2. Ensure 'data/glossary' folder is included")
print("3. Create an 'output' folder in the same directory")
print("\nUsers can run PreDTCT.exe to start the application")
