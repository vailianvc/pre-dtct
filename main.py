import webbrowser
import threading
import os
from app import create_app

def open_browser():
    """Open browser automatically after a short delay"""
    import time
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')

# Create app instance for WSGI servers (gunicorn, etc.)
app = create_app()

if __name__ == '__main__':
    # Only run development server when executed directly
    is_production = os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('PORT')

    if not is_production:
        # Development mode: open browser automatically
        threading.Thread(target=open_browser, daemon=True).start()
        print("Starting Pre-DTCT Form Application v2 (Development)...")
        print("Browser will open automatically at http://127.0.0.1:5000")
        print("Press Ctrl+C to stop the application")
        app.run(host='127.0.0.1', port=5000, debug=False)
    else:
        # Production mode: let gunicorn handle it
        port = int(os.environ.get('PORT', 5000))
        print(f"Starting Pre-DTCT Form Application v2 (Production) on port {port}...")
        app.run(host='0.0.0.0', port=port, debug=False)
