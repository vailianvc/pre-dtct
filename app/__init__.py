from flask import Flask
import os
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app(config_name=None):
    app = Flask(__name__)

    # Load configuration
    app.config.from_object('config')

    # Disable template caching for development
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    # Ensure required directories exist
    os.makedirs(app.config['OUTPUT_DIR'], exist_ok=True)
    os.makedirs(os.path.dirname(app.config['DATABASE_PATH']), exist_ok=True)

    # Initialize database
    db.init_app(app)

    # Create database tables
    with app.app_context():
        from . import models
        db.create_all()

        # Load glossary data on startup
        from .services import excel_reader
        excel_reader.load_all_glossaries(app)

    # Register routes
    from . import routes
    app.register_blueprint(routes.bp)

    # Add no-cache headers for development
    @app.after_request
    def add_no_cache_headers(response):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
        return response

    # Add context processor for current year
    @app.context_processor
    def inject_current_year():
        from datetime import datetime
        return {'current_year': datetime.now().year}

    return app
