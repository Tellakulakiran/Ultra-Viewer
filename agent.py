import mss
import pyautogui
import cv2
import numpy as np
import base64
from flask import Flask
from flask_socketio import SocketIO, emit
import eventlet
import os
import sys
import psutil
import platform
import socket as py_socket

# Initialize Flask and SocketIO
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Disable pyautogui safety features for faster response
pyautogui.PAUSE = 0
pyautogui.FAILSAFE = False

# --- Agent Credentials ---
AGENT_ID = str(np.random.randint(10000000, 99999999))
AGENT_PW = str(np.random.randint(1000, 9999))

print(f"======================================")
print(f" AGENT STARTED")
print(f" ID: {AGENT_ID}")
print(f" Password: {AGENT_PW}")
print(f"======================================")

@socketio.on('connect')
def handle_connect(auth):
    # simple auth check
    if not auth or auth.get('id') != AGENT_ID or auth.get('password') != AGENT_PW:
        print(f"Unauthorized connection attempt: {auth}")
        return False # Disconnect
    print(f"Client authorized and connected: {auth.get('id')}")

@socketio.on('chat_message')
def handle_chat_message(data):
    print(f"Chat from client: {data.get('text')}")
    # Echo back or send an automated reply for demo purposes
    reply = f"Agent: Message received! ('{data.get('text')[:20]}...')"
    socketio.emit('chat_message', {'text': reply})

# Dictionary to store file buffers
active_files = {}

@socketio.on('file_start')
def handle_file_start(data):
    file_id = data['id']
    file_name = data['name']
    print(f"File upload starting: {file_name} ({file_id})")
    active_files[file_id] = {
        'name': file_name,
        'buffer': bytearray()
    }

@socketio.on('file_chunk')
def handle_file_chunk(data):
    file_id = data['id']
    if file_id in active_files:
        active_files[file_id]['buffer'].extend(data['chunk'])

@socketio.on('file_end')
def handle_file_end(data):
    file_id = data['id']
    if file_id in active_files:
        file_info = active_files[file_id]
        file_path = os.path.join(os.getcwd(), file_info['name'])
        
        # Ensure we don't overwrite critical files
        if os.path.exists(file_path):
            name, ext = os.path.splitext(file_path)
            file_path = f"{name}_received{ext}"

        with open(file_path, 'wb') as f:
            f.write(file_info['buffer'])
        
        print(f"File saved: {file_path}")
        del active_files[file_id]
        
        # Notify client
        socketio.emit('chat_message', {'text': f"Agent: I've received your file: {file_info['name']}"})

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")

# --- System Metrics Logic ---
def stream_metrics():
    while True:
        try:
            cpu_percent = psutil.cpu_percent(interval=None)
            ram = psutil.virtual_memory()
            
            # Simple metadata (only send once or occasionally to save bandwidth)
            metrics = {
                'cpu': cpu_percent,
                'ram_percent': ram.percent,
                'ram_used': f"{ram.used / (1024**3):.1f} GB",
                'ram_total': f"{ram.total / (1024**3):.1f} GB",
                'os': f"{platform.system()} {platform.release()}",
                'cpu_name': platform.processor()
            }
            socketio.emit('system_metrics', metrics)
        except Exception as e:
            print(f"Error streaming metrics: {e}")
        
        socketio.sleep(2) # Update every 2 seconds

# --- Screen Capture Logic ---
def stream_screen():
    with mss.mss() as sct:
        monitor = sct.monitors[1]
        
        # We can adjust these based on network conditions
        jpeg_quality = 40 
        
        while True:
            # Capture
            screenshot = sct.grab(monitor)
            img = np.array(screenshot)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            
            # Sub-sampling or Resizing can be added here if needed
            # img = cv2.resize(img, (0, 0), fx=0.8, fy=0.8) 
            
            # Encode
            _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            
            # Emit
            socketio.emit('screen_frame', {'image': jpg_as_text})
            
            # Optimization: yield for other tasks
            socketio.sleep(0.05) # ~20 FPS

# --- Remote Input Logic ---
@socketio.on('mouse_move')
def handle_mouse_move(data):
    # Data contains normalized x, y (0 to 1)
    screen_width, screen_height = pyautogui.size()
    x = data['x'] * screen_width
    y = data['y'] * screen_height
    pyautogui.moveTo(x, y)

@socketio.on('mouse_click')
def handle_mouse_click(data):
    screen_width, screen_height = pyautogui.size()
    x = data['x'] * screen_width
    y = data['y'] * screen_height
    button = data.get('button', 'left')
    pyautogui.click(x, y, button=button)

@socketio.on('key_press')
def handle_key_press(data):
    key = data['key']
    modifiers = []
    if data.get('shift'): modifiers.append('shift')
    if data.get('ctrl'): modifiers.append('ctrl')
    if data.get('alt'): modifiers.append('alt')
    
    try:
        if len(key) == 1:
            # For single characters, shift is often implicit in the 'key' value
            # e.g. 'A' instead of 'a' + shift. Pyautogui handles this well.
            pyautogui.write(key)
        else:
            # For special keys (Enter, Backspace, etc.)
            key_name = key.lower()
            if modifiers:
                pyautogui.hotkey(*modifiers, key_name)
            else:
                pyautogui.press(key_name)
    except Exception as e:
        print(f"Error pressing key {key}: {e}")

if __name__ == '__main__':
    # Run background tasks
    socketio.start_background_task(stream_screen)
    socketio.start_background_task(stream_metrics)
    
    # Start the server
    print("Agent started on http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000)
