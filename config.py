import os

# Base directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Paths
GLOSSARY_DIR = os.path.join(BASE_DIR, 'data', 'glossary')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
DATABASE_PATH = os.path.join(BASE_DIR, 'data', 'dtct.db')

# Database URI
SQLALCHEMY_DATABASE_URI = f'sqlite:///{DATABASE_PATH}'
SQLALCHEMY_TRACK_MODIFICATIONS = False

# Flask settings
SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
DEBUG = False

# Glossary files mapping
GLOSSARY_FILES = {
    'academicsession': 'glossary_sgcm_academicsessioncode.xlsx',
    'programme': 'glossary_sgcm_programmecode.xlsx',
    'course': 'glossary_sgcm_coursecode.xlsx',
    'group': 'glossary_sgcm_groupcode.xlsx',
    'faculty': 'glossary_sgcm_facultycode.xlsx',
    'activity': 'glossary_dtct_activitycode.xlsx',
    'specialroom': 'glossary_dtct_specialroomcode.xlsx'
}

# Default form values
DEFAULT_DURATION = 0
DEFAULT_CAPACITY = 0
DEFAULT_RECURRING_UNTIL_WEEK = 14

# Date range for ClassCommencement (hardcoded for now)
CLASS_COMMENCEMENT_START = '2026-02-09'
CLASS_COMMENCEMENT_END = '2026-02-20'
