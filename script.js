document.addEventListener('DOMContentLoaded', () => {
    // 0. Live Background Animation
    const bgCanvas = document.getElementById('live-bg-canvas');
    const bgCtx = bgCanvas.getContext('2d');
    let particles = [];

    function initBackground() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
        particles = [];
        for (let i = 0; i < 80; i++) {
            particles.push({
                x: Math.random() * bgCanvas.width,
                y: Math.random() * bgCanvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2
            });
        }
    }

    function animateBackground() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgCtx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        bgCtx.strokeStyle = 'rgba(59, 130, 246, 0.1)';

        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > bgCanvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > bgCanvas.height) p.vy *= -1;

            bgCtx.beginPath();
            bgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            bgCtx.fill();

            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    bgCtx.beginPath();
                    bgCtx.moveTo(p.x, p.y);
                    bgCtx.lineTo(p2.x, p2.y);
                    bgCtx.stroke();
                }
            }
        });
        requestAnimationFrame(animateBackground);
    }

    window.addEventListener('resize', initBackground);
    initBackground();
    animateBackground();

    // DOM Elements
    const yourIdInput = document.getElementById('your-id');
    const yourPwInput = document.getElementById('your-password');
    const partnerIdInput = document.getElementById('partner-id');
    const partnerPwInput = document.getElementById('partner-password');
    const connectBtn = document.getElementById('connect-btn');
    const generatePwBtn = document.getElementById('generate-pw-btn');
    const activateStealthBtn = document.getElementById('activate-stealth-btn');
    const fakeUpdateScreen = document.getElementById('fake-update-screen');
    const updatePercentEl = document.getElementById('update-percent');
    const remoteContainer = document.getElementById('remote-container');
    const remoteCanvas = document.getElementById('remote-canvas');
    const closeRemoteBtn = document.getElementById('close-remote');
    const navItems = document.querySelectorAll('.nav-item');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const ctx = remoteCanvas.getContext('2d');

    let socket = null;
    let updateInterval = null;

    // 1. Initial State
    function generateCredentials() {
        // Generating 9-digit ID and 5-digit PW to match Agent update
        const id = Math.floor(100000000 + Math.random() * 899999999);
        const pw = Math.floor(10000 + Math.random() * 89999);
        yourIdInput.value = formatId(id.toString());
        yourPwInput.value = pw;
    }

    function formatId(id) {
        return id.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    }

    generateCredentials();

    generatePwBtn.addEventListener('click', () => {
        generateCredentials();
        showToast('New credentials generated');
    });

    // 2. Partner ID Logic
    partnerIdInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 9) val = val.slice(0, 9);
        e.target.value = formatId(val);
        
        if (val.length === 9) {
             document.querySelector('.password-group').classList.remove('disabled');
             partnerPwInput.disabled = false;
        } else {
             document.querySelector('.password-group').classList.add('disabled');
             partnerPwInput.disabled = true;
        }
    });

    // 3. Connection Logic
    connectBtn.addEventListener('click', () => {
        const id = partnerIdInput.value.replace(/\s/g, '');
        const serverUrl = document.getElementById('server-url').value;
        const pw = partnerPwInput.value;

        if (id.length < 9) return showToast('Invalid Partner ID', true);

        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';

        socket = io(serverUrl, { auth: { id, password: pw } });

        socket.on('connect', () => {
            showToast('Connected to Partner');
            remoteContainer.classList.remove('hidden');
            activateStealthBtn.classList.remove('hidden');
        });

        socket.on('connect_error', () => {
            showToast('Connection Refused', true);
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<i class="fa-solid fa-play"></i> Connect to partner';
        });

        // 4. Stream Handling
        let nextFrame = null;
        socket.on('screen_frame', (data) => {
            nextFrame = 'data:image/jpeg;base64,' + data.image;
            requestAnimationFrame(() => {
                if (!nextFrame) return;
                const img = new Image();
                img.onload = () => {
                    remoteCanvas.width = img.width;
                    remoteCanvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                };
                img.src = nextFrame;
                nextFrame = null;
            });
        });

        // Input Injection
        remoteCanvas.addEventListener('mousemove', (e) => {
            if (!socket || !socket.connected) return;
            const rect = remoteCanvas.getBoundingClientRect();
            socket.emit('mouse_move', {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height
            });
        });

        remoteCanvas.addEventListener('mousedown', (e) => {
            if (!socket || !socket.connected) return;
            const rect = remoteCanvas.getBoundingClientRect();
            socket.emit('mouse_click', {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height,
                button: e.button === 0 ? 'left' : 'right'
            });
        });

        // Chat listener
        socket.on('chat_message', (data) => addMessage(data.text, 'received'));
    });

    closeRemoteBtn.addEventListener('click', () => {
        remoteContainer.classList.add('hidden');
        if (socket) socket.disconnect();
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fa-solid fa-play"></i> Connect to partner';
    });

    // 5. Stealth Mode
    function activateStealth() {
        document.body.classList.add('stealth-active');
        fakeUpdateScreen.classList.remove('hidden');
        
        let percent = 0;
        updatePercentEl.innerText = percent;
        updateInterval = setInterval(() => {
            if (percent < 99) {
                percent += Math.floor(Math.random() * 3);
                if (percent > 99) percent = 99;
                updatePercentEl.innerText = percent;
            }
        }, 15000);
        showToast('Stealth Mode Active');
    }

    function deactivateStealth() {
        document.body.classList.remove('stealth-active');
        fakeUpdateScreen.classList.add('hidden');
        if (updateInterval) clearInterval(updateInterval);
        showToast('Normal Mode Restored');
    }

    activateStealthBtn.addEventListener('click', activateStealth);

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
            if (document.body.classList.contains('stealth-active')) deactivateStealth();
        }
        
        // Remote keys
        if (socket && socket.connected && !remoteContainer.classList.contains('hidden')) {
            socket.emit('key_press', { key: e.key, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey });
        }
    });

    // 6. Sidebar Navigation
    const panels = ['remote-control-section', 'chat-section', 'file-transfer-section', 'settings-section'];
    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.classic-panel').forEach(p => p.classList.add('hidden'));
            
            if (index === 0) {
                document.getElementById('remote-control-section').classList.remove('hidden');
                document.getElementById('control-panel-section').classList.remove('hidden');
            } else {
                const targetPanelId = panels[index];
                if (targetPanelId) document.getElementById(targetPanelId).classList.remove('hidden');
            }
        });
    });

    // 7. Menu Functionality
    document.getElementById('menu-file').addEventListener('click', () => {
        showToast('File menu clicked - Checking for updates...');
    });

    document.getElementById('menu-settings').addEventListener('click', () => {
        // Switch to settings panel
        navItems[3].click();
        showToast('Settings opened');
    });

    document.getElementById('menu-help').addEventListener('click', () => {
        showToast('Help: Press F1 for remote support');
    });

    // 8. Helpers
    function showToast(msg, isError = false) {
        toast.innerText = msg;
        toast.style.display = 'block';
        toast.style.background = isError ? '#cc0000' : '#333';
        setTimeout(() => toast.style.display = 'none', 3000);
    }

    // Chat Logic
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const chatMessages = document.getElementById('chat-messages');

    function addMessage(text, type) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.style.margin = '5px 0';
        div.style.padding = '8px';
        div.style.background = type === 'sent' ? '#e1f5fe' : '#f5f5f5';
        div.style.textAlign = type === 'sent' ? 'right' : 'left';
        div.innerText = text;
        chatMessages.appendChild(div);
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
});
