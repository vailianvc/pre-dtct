import os

# Base directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Paths
GLOSSARY_DIR = os.path.join(BASE_DIR, 'data', 'glossary')
OUTPUT_DIR = os.environ.get('OUTPUT_DIR') or os.path.join(BASE_DIR, 'output')

# Database URI
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    # Railway provides postgres:// but SQLAlchemy requires postgresql://
    if DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
else:
    DATABASE_PATH = os.path.join(BASE_DIR, 'data', 'dtct.db')
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

# Upload settings
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

# Glossary descriptions for management page
GLOSSARY_DESCRIPTIONS = {
    'academicsession': {
        'label': 'Academic Session',
        'icon': 'bi-calendar-event',
        'description': 'Academic session codes with commencement week dates'
    },
    'programme': {
        'label': 'Programme',
        'icon': 'bi-mortarboard',
        'description': 'Programme codes and descriptions'
    },
    'course': {
        'label': 'Course',
        'icon': 'bi-book',
        'description': 'Course codes and titles'
    },
    'group': {
        'label': 'Group',
        'icon': 'bi-people',
        'description': 'Student group codes'
    },
    'faculty': {
        'label': 'Faculty / Lecturer',
        'icon': 'bi-person-badge',
        'description': 'Faculty and lecturer codes'
    },
    'activity': {
        'label': 'Activity',
        'icon': 'bi-clipboard-check',
        'description': 'Activity type codes (lecture, tutorial, etc.)'
    },
    'specialroom': {
        'label': 'Special Room',
        'icon': 'bi-door-open',
        'description': 'Special room/venue request codes'
    }
}

# Default form values
DEFAULT_DURATION = 0
DEFAULT_CAPACITY = 0
DEFAULT_RECURRING_UNTIL_WEEK = 14

# Date range for ClassCommencement (hardcoded for now)
CLASS_COMMENCEMENT_START = '2026-02-09'
CLASS_COMMENCEMENT_END = '2026-02-20'
