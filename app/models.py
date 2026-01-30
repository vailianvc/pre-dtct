from datetime import datetime
from app import db

class GlossaryCache(db.Model):
    __tablename__ = 'glossary_cache'

    id = db.Column(db.Integer, primary_key=True)
    glossary_type = db.Column(db.String(50), nullable=False)
    code = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    commencement_week_1 = db.Column(db.String(20))  # DD.MM.YYYY format
    commencement_week_2 = db.Column(db.String(20))  # DD.MM.YYYY format

    __table_args__ = (
        db.UniqueConstraint('glossary_type', 'code', name='unique_glossary_code'),
    )

    def to_dict(self):
        result = {
            'code': self.code,
            'description': self.description or ''
        }
        if self.glossary_type == 'academicsession':
            result['commencement_week_1'] = self.commencement_week_1 or ''
            result['commencement_week_2'] = self.commencement_week_2 or ''
        return result

class FormSubmission(db.Model):
    __tablename__ = 'form_submissions'

    id = db.Column(db.Integer, primary_key=True)
    form_id = db.Column(db.String(10), nullable=False)
    timestamp = db.Column(db.String(20), nullable=False)
    programme_code = db.Column(db.String(50), nullable=False)
    generated_file_path = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    rows = db.relationship('GeneratedRow', backref='submission', lazy=True, cascade='all, delete-orphan')

class GeneratedRow(db.Model):
    __tablename__ = 'generated_rows'

    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('form_submissions.id'))
    row_id = db.Column(db.String(30), nullable=False)
    form_id = db.Column(db.String(10), nullable=False)
    academic_session_code = db.Column(db.String(50))
    programme_code = db.Column(db.String(50))
    class_commencement = db.Column(db.String(20))
    duration = db.Column(db.Integer)
    activity_code = db.Column(db.String(50))
    capacity = db.Column(db.Integer)
    course_code = db.Column(db.String(50))
    group_code = db.Column(db.String(50))
    faculty_code = db.Column(db.String(50))
    request_special_room_code = db.Column(db.String(50))
    recurring_until_week = db.Column(db.Integer)
