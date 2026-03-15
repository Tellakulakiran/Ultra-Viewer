import os
import subprocess
import sys

def build():
    print("--- Packaging UltraViewer Agent ---")
    
    # Check for PyInstaller
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # Build command
    # --onefile: single .exe
    # --windowed: no console window (optional, remove if you want to see logs)
    # --name: final filename
    cmd = [
        "pyinstaller",
        "--onefile",
        "--name", "agent",
        "--hidden-import", "eventlet.hubs.epolls",
        "--hidden-import", "eventlet.hubs.kqueue",
        "--hidden-import", "eventlet.hubs.selects",
        "agent.py"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd)

    print("\n--- Success! ---")
    print("Your executable is located in: " + os.path.join(os.getcwd(), "dist", "agent.exe"))

if __name__ == "__main__":
    build()
