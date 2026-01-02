from flask import Flask
import os
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app(config_name=None):
    app = Flask(__name__)

    # Load configuration
    app.config.from_object('config')

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

    return app
