import webbrowser
import threading
from app import create_app

def open_browser():
    """Open browser automatically after a short delay"""
    import time
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')

if __name__ == '__main__':
    app = create_app()

    # Start browser in background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Run Flask app
    print("Starting Pre-DTCT Form Application v2...")
    print("Browser will open automatically at http://127.0.0.1:5000")
    print("Press Ctrl+C to stop the application")

    app.run(host='127.0.0.1', port=5000, debug=False)
