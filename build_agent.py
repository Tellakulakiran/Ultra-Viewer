import os
import subprocess
import sys

def build():
    print("--- Packaging UltraViewer Agent ---")
    
    # 1. Ensure all requirements are installed in the current environment
    requirements = [
        "pyinstaller", 
        "mss", 
        "pyautogui", 
        "opencv-python", 
        "numpy", 
        "flask", 
        "flask-socketio", 
        "eventlet",
        "psutil"
    ]
    
    print("Checking/Installing dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install"] + requirements)

    # 2. Cleanup old build directories
    for folder in ["build", "dist"]:
        if os.path.exists(folder):
            import shutil
            shutil.rmtree(folder)
            print(f"Cleaned up {folder}/")

    # 3. Build command
    # We include hidden imports for tricky libraries like eventlet
    cmd = [
        "pyinstaller",
        "--onefile",
        "--name", "agent",
        "--hidden-import", "eventlet.hubs.epolls",
        "--hidden-import", "eventlet.hubs.kqueue",
        "--hidden-import", "eventlet.hubs.selects",
        "--hidden-import", "engineio.async_drivers.eventlet",
        "--hidden-import", "dns",
        "--hidden-import", "mss",
        "agent.py"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd)

    if result.returncode == 0:
        print("\n--- Success! ---")
        print("Your executable is located in: " + os.path.join(os.getcwd(), "dist", "agent.exe"))
        print("\nTo run it, type: .\\dist\\agent.exe")
    else:
        print("\n--- Build Failed ---")
        print("Please check the error messages above.")

if __name__ == "__main__":
    build()
