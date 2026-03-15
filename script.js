document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const yourIdInput = document.getElementById('your-id');
    const yourPwInput = document.getElementById('your-password');
    const partnerIdInput = document.getElementById('partner-id');
    const partnerPwInput = document.getElementById('partner-password');
    const connectBtn = document.getElementById('connect-btn');
    const generatePwBtn = document.getElementById('generate-pw-btn');
    const activateStealthBtn = document.getElementById('activate-stealth-btn');
    const stealthHint = document.getElementById('stealth-hint');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const navItems = document.querySelectorAll('.nav-item');
    const fakeUpdateScreen = document.getElementById('fake-update-screen');
    const updatePercent = document.getElementById('update-percent');

    // Remote View Elements
    const remoteContainer = document.getElementById('remote-container');
    const remoteCanvas = document.getElementById('remote-canvas');
    const closeRemoteBtn = document.getElementById('close-remote');
    const ctx = remoteCanvas.getContext('2d');

    let socket = null;

    // 1. Generate Random Credentials
    function generateCredentials() {
        const id = Math.floor(10000000 + Math.random() * 90000000);
        const pw = Math.floor(1000 + Math.random() * 9000);
        
        yourIdInput.value = formatId(id.toString());
        yourPwInput.value = pw;
    }

    function formatId(id) {
        return id.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3');
    }

    generateCredentials();

    // 2. Password Regeneration
    generatePwBtn.addEventListener('click', () => {
        const pw = Math.floor(1000 + Math.random() * 9000);
        yourPwInput.value = pw;
        showToast('New password generated');
    });

    // 3. Partner ID Formatting
    partnerIdInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.slice(0, 8);
        e.target.value = formatId(value);
        
        // Enable password field if ID is valid
        if (value.length === 8) {
            document.querySelector('.password-group').classList.remove('disabled');
            partnerPwInput.disabled = false;
        } else {
            document.querySelector('.password-group').classList.add('disabled');
            partnerPwInput.disabled = true;
        }
    });

    // 4. Functional Connect Logic
    connectBtn.addEventListener('click', () => {
        const partnerId = partnerIdInput.value.replace(/\s/g, '');
        if (partnerId.length < 8) {
            showToast('Please enter a valid Partner ID', true);
            return;
        }

        const serverUrl = document.getElementById('server-url').value;
        
        connectBtn.disabled = true;
        connectBtn.innerHTML = '<div class="spinner-small"></div> Initializing Agent...';

        // Connect to Socket.IO server with Auth
        const partnerPw = partnerPwInput.value;
        socket = io(serverUrl, {
            auth: {
                id: partnerId,
                password: partnerPw
            }
        });

        socket.on('connect', () => {
            showToast('Agent Connected');
            remoteContainer.classList.remove('hidden');
            
            // Show stealth activation button once connected
            activateStealthBtn.classList.remove('hidden');
        });

        socket.on('connect_error', (error) => {
            showToast('Connection Refused. Check ID/Password.', true);
            console.error('Connection Error:', error);
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<span>Connect to Partner</span> <i class="fa-solid fa-arrow-right"></i>';
        });

        // 5. Screen Frame Handling
        let nextFrame = null;
        socket.on('screen_frame', (data) => {
            nextFrame = 'data:image/jpeg;base64,' + data.image;
            requestAnimationFrame(drawFrame);
        });

        // 5.1 System Metrics Handling
        socket.on('system_metrics', (data) => {
            const osEl = document.getElementById('info-os');
            const cpuEl = document.getElementById('info-cpu');
            const ramEl = document.getElementById('info-ram');
            
            if (osEl) osEl.innerText = data.os;
            if (cpuEl) cpuEl.innerText = `${data.cpu}% (${data.cpu_name})`;
            if (ramEl) ramEl.innerText = `${data.ram_percent}% (${data.ram_used} / ${data.ram_total})`;
        });

        socket.on('chat_message', (data) => {
            addMessage(data.text, 'received');
        });

        function drawFrame() {
            if (!nextFrame) return;
            const img = new Image();
            img.onload = () => {
                remoteCanvas.width = img.width;
                remoteCanvas.height = img.height;
                ctx.drawImage(img, 0, 0);
            };
            img.src = nextFrame;
            nextFrame = null;
        }

        // 6. Remote Input Transmission
        remoteCanvas.addEventListener('mousemove', (e) => {
            if (!socket || !socket.connected) return;
            const rect = remoteCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            socket.emit('mouse_move', { x, y });
        });

        remoteCanvas.addEventListener('mousedown', (e) => {
            if (!socket || !socket.connected) return;
            const rect = remoteCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const button = e.button === 0 ? 'left' : (e.button === 2 ? 'right' : 'middle');
            socket.emit('mouse_click', { x, y, button });
        });

        window.addEventListener('keydown', (e) => {
            if (!socket || !socket.connected || remoteContainer.classList.contains('hidden')) return;
            
            // Prevent default for system keys when in remote session
            if (['Tab', 'Backspace', 'Escape'].includes(e.key)) e.preventDefault();
            
            socket.emit('key_press', { 
                key: e.key,
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey
            });
        });

        // Disable right-click context menu on canvas
        remoteCanvas.oncontextmenu = (e) => e.preventDefault();
    });
    // 8.2 File Transfer Logic
    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');

    dropZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    function handleFiles(files) {
        Array.from(files).forEach(uploadFile);
    }

    async function uploadFile(file) {
        if (!socket || !socket.connected) return showToast('Connect to an agent first', true);

        const CHUNK_SIZE = 1024 * 100; // 100KB chunks
        const fileId = Math.random().toString(36).substr(2, 9);
        
        // Create UI element
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <i class="fa-solid fa-file"></i>
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <div class="file-progress-bar"><div id="prog-${fileId}" class="file-progress-fill"></div></div>
            </div>
        `;
        fileList.appendChild(item);

        const progFill = document.getElementById(`prog-${fileId}`);

        socket.emit('file_start', { name: file.name, size: file.size, id: fileId });

        const reader = new FileReader();
        let offset = 0;

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
            socket.emit('file_chunk', { 
                id: fileId, 
                chunk: e.target.result,
                offset: offset
            });

            offset += e.target.result.byteLength;
            const percent = (offset / file.size) * 100;
            progFill.style.width = percent + '%';

            if (offset < file.size) {
                readNextChunk();
            } else {
                socket.emit('file_end', { id: fileId });
                showToast(`File ${file.name} uploaded successfully`);
            }
        };

        readNextChunk();
    }

    // 8. Navigation Switching
    const sections = document.querySelectorAll('.dashboard > section');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const tabName = item.querySelector('span').innerText;
            document.querySelector('.header-left h1').innerText = tabName;

            // Hide all dashboard sections
            sections.forEach(s => s.classList.add('hidden'));

            // Show relevant section
            if (tabName === 'Remote Control') {
                sections.forEach(s => {
                    if (s.id !== 'system-info-section' && s.id !== 'chat-section' && s.id !== 'file-transfer-section' && s.id !== 'settings-section') s.classList.remove('hidden');
                });
            } else if (tabName === 'About') {
                document.getElementById('system-info-section').classList.remove('hidden');
            } else if (tabName === 'Chat Room') {
                document.getElementById('chat-section').classList.remove('hidden');
            } else if (tabName === 'File Transfer') {
                document.getElementById('file-transfer-section').classList.remove('hidden');
            } else if (tabName === 'Settings') {
                document.getElementById('settings-section').classList.remove('hidden');
            } else {
                showToast(tabName + ' module is coming soon!', false);
            }
        });
    });

    // 8.1 Chat Logic
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const chatMessages = document.getElementById('chat-messages');

    function addMessage(text, type = 'sent') {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;
        msgDiv.innerText = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendChatBtn.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (text && socket && socket.connected) {
            socket.emit('chat_message', { text });
            addMessage(text, 'sent');
            chatInput.value = '';
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatBtn.click();
    });

    // 9. Clipboard Helper
    window.copyToClipboard = (elementId) => {
        const input = document.getElementById(elementId);
        input.select();
        document.execCommand('copy');
        showToast('Copied: ' + input.value);
    };

    // 10. Toast Helper
    function showToast(message, isError = false) {
        toastMessage.innerText = message;
        toast.classList.remove('hidden');
        toast.style.borderLeftColor = isError ? '#ef4444' : '#10b981';
        toast.querySelector('i').className = isError ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
        toast.querySelector('i').style.color = isError ? '#ef4444' : '#10b981';
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
    }
});

// Add spinner CSS dynamically
const style = document.createElement('style');
style.textContent = `
    .spinner-small {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
