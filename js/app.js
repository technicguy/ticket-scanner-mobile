/**
 * Ticket System - Mobile Companion App
 * Real-time WebSocket connection to Desktop Application
 */

const app = {
    socket: null,
    html5QrScanner: null,
    nfcController: null,
    currentMode: 'ticket', // 'ticket', 'attendance', 'nfc'
    deviceId: null,
    pairingToken: null,
    serverUrl: null,
    reconnectInterval: 3000,
    isProcessing: false,
    scanCooldown: false,
    lastScanTime: 0,
    minScanInterval: 2000, // Minimum 2 seconds between scans

    init() {
        console.log("Initializing Mobile Companion...");

        // 1. Get Token and Server Config
        const urlParams = new URLSearchParams(window.location.search);
        this.pairingToken = urlParams.get('token');
        this.serverUrl = `ws://${window.location.host}`;
        document.getElementById('host-url').innerText = window.location.origin;

        // 2. Initialize Device ID
        this.deviceId = localStorage.getItem('mobile_device_id');
        if (!this.deviceId) {
            this.deviceId = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            localStorage.setItem('mobile_device_id', this.deviceId);
        }

        // 3. Setup Bottom Nav
        document.getElementById('btn-tickets').addEventListener('click', () => this.setMode('ticket'));
        document.getElementById('btn-attendance').addEventListener('click', () => this.setMode('attendance'));
        document.getElementById('btn-nfc').addEventListener('click', () => this.setMode('nfc'));

        // 4. Setup Actions
        document.getElementById('init-scanner').addEventListener('click', () => this.startScanner());
        document.getElementById('close-scanner').addEventListener('click', () => this.stopScanner());
        document.getElementById('switch-to-qr-attendance').addEventListener('click', () => this.setMode('attendance'));
        document.getElementById('cancel-nfc').addEventListener('click', () => this.stopNfc());

        document.querySelectorAll('.scan-next-btn').forEach(btn => {
            btn.addEventListener('click', () => this.resetAndShowScanner());
        });

        // 5. Connect WebSocket
        this.connect();
    },

    setMode(mode) {
        this.currentMode = mode;
        const labels = {
            'ticket': 'Ticket Verification',
            'attendance': 'Member Attendance',
            'nfc': 'NFC Scan Mode'
        };
        document.getElementById('current-mode-label').innerText = labels[mode];

        // Update UI
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(`btn-${mode}`).classList.add('active');

        this.resetAndShowScanner();
    },

    resetAndShowScanner() {
        this.showView('scanner-view');
        this.isProcessing = false;
        this.scanCooldown = false;
        if (this.html5QrScanner && typeof this.html5QrScanner.resume === 'function') {
            try { this.html5QrScanner.resume(); } catch (e) { }
        }
    },

    connect() {
        console.log(`Connecting to ${this.serverUrl}...`);
        this.socket = new WebSocket(this.serverUrl);

        this.socket.onopen = () => {
            console.log("WebSocket Connected!");
            this.updateStatus(true);
            this.handshake();
        };

        this.socket.onclose = () => {
            console.log("WebSocket Disconnected. Retrying...");
            this.updateStatus(false);
            setTimeout(() => this.connect(), this.reconnectInterval);
        };

        this.socket.onerror = (err) => {
            console.error("WebSocket Error:", err);
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (e) {
                console.error("Message Processing Error:", e);
            }
        };
    },

    updateStatus(online) {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (online) {
            dot.classList.add('online');
            text.innerText = 'Connected';
        } else {
            dot.classList.remove('online');
            text.innerText = 'Disconnected';
        }
    },

    handshake() {
        const payload = {
            type: 'handshake',
            id: this.deviceId,
            name: navigator.userAgent.split(' ')[0] + ' Mobile',
            token: this.pairingToken,
            mac: '00:00:00:00:00:00' // Placeholder as web can't get MAC
        };
        this.socket.send(JSON.stringify(payload));
    },

    handleMessage(msg) {
        console.log("Received:", msg);

        if (msg.type === 'scan_result') {
            if (msg.success) {
                // Reset Processing flag - successful scans are transitioned to result views
                this.isProcessing = false;

                if (msg.scanType === 'attendance') {
                    // Smart Mode Voice Feedback
                    const statusText = msg.message.split(':')[0]; // e.g. "Entry Recorded"
                    this.playSound('speech', msg.data.full_name + ", " + statusText);
                    this.showAttendanceResult(msg.data, statusText);
                } else {
                    this.playSound('granted');
                    this.showTicketResult(msg.data);
                }
            } else {
                // Error Logic: Prevent immediate re-scan loop by adding a cooldown
                if (msg.message && msg.message.toLowerCase().includes('already used')) {
                    this.playSound('used');
                } else if (msg.message && msg.message.toLowerCase().includes('30s')) {
                    // Anti-spam warning
                } else {
                    this.playSound('invalid');
                }

                this.showError(msg.message);

                // For errors, wait 3 seconds before allowing another scan 
                // and auto-resuming the scanner so user can try again
                setTimeout(() => {
                    this.isProcessing = false;
                    if (this.html5QrScanner && typeof this.html5QrScanner.resume === 'function') {
                        try { this.html5QrScanner.resume(); } catch (e) { }
                    }
                }, 3000);
            }
        } else {
            this.isProcessing = false;
        }
    },

    playSound(type, text = "") {
        try {
            if (type === 'speech') {
                if ('speechSynthesis' in window) {
                    // Cancel current speech to prevent overlapping/looping feel
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    window.speechSynthesis.speak(utterance);
                }
            } else {
                const audio = document.getElementById(`sound-${type}`);
                if (audio) {
                    // Ensure it starts from beginning and isn't looping
                    audio.pause();
                    audio.currentTime = 0;
                    audio.loop = false; // Explicitly disable looping
                    audio.play().catch(e => console.log("Audio play failed:", e));
                }
            }
        } catch (e) {
            console.error("Sound Error:", e);
        }
    },

    async startScanner() {
        // Check for NFC mode
        if (this.currentMode === 'nfc') {
            if ('NDEFReader' in window) {
                this.startNfcScan();
                return;
            } else {
                this.showView('nfc-unsupported-view');
                return;
            }
        }

        // Start QR Scanner
        document.getElementById('camera-access-needed').style.display = 'none';
        document.getElementById('scanner-active').style.display = 'block';

        this.html5QrScanner = new Html5Qrcode("qr-reader");
        const config = {
            fps: 20, // Increased for smoother detection
            qrbox: { width: 280, height: 280 }, // Slightly larger box
            aspectRatio: 1.0,
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        };

        this.html5QrScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => this.onScanSuccess(decodedText)
        ).catch(err => {
            console.error("Camera Error:", err);
            document.getElementById('camera-access-needed').style.display = 'block';
            document.getElementById('scanner-active').style.display = 'none';
            alert("Could not access camera. Ensure you are using HTTPS or have enabled the Chrome flag.");
        });
    },

    async startNfcScan() {
        if (!('NDEFReader' in window)) {
            this.showView('nfc-unsupported-view');
            return;
        }

        // Show NFC Overlay with fade-in animation
        const overlay = document.getElementById('nfc-overlay');
        overlay.style.display = 'block';
        setTimeout(() => overlay.style.opacity = '1', 10);

        this.nfcController = new AbortController();

        try {
            const ndef = new NDEFReader();
            await ndef.scan({ signal: this.nfcController.signal });

            ndef.onreading = event => {
                // Vibrate on scan
                if (window.navigator.vibrate) {
                    window.navigator.vibrate(200);
                }

                const decoder = new TextDecoder();
                for (const record of event.message.records) {
                    let memberData = null;

                    if (record.recordType === "json" || record.mediaType === "application/json") {
                        try {
                            memberData = JSON.parse(decoder.decode(record.data));
                        } catch (e) {
                            console.error("JSON Parse Error:", e);
                        }
                    } else if (record.recordType === "text") {
                        const text = decoder.decode(record.data);
                        memberData = this.parseMemberData(text);
                    }

                    if (memberData && memberData.id) {
                        // Hide NFC overlay before processing
                        this.stopNfc();
                        // Process NFC scan
                        this.onScanSuccess(JSON.stringify(memberData));
                        break;
                    }
                }
            };

            ndef.onerror = (err) => {
                console.error("NFC Error:", err);
                this.showError('Failed to read NFC tag');
                this.stopNfc();
            };

        } catch (err) {
            console.error("NFC Scan Error:", err);
            this.showError('NFC scan failed: ' + err.message);
            this.stopNfc();
        }
    },

    stopNfc() {
        if (this.nfcController) {
            this.nfcController.abort();
            this.nfcController = null;
        }

        // Hide NFC Overlay with fade-out animation
        const overlay = document.getElementById('nfc-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
        }
    },

    stopScanner() {
        if (this.html5QrScanner) {
            this.html5QrScanner.stop().then(() => {
                document.getElementById('camera-access-needed').style.display = 'block';
                document.getElementById('scanner-active').style.display = 'none';
                this.html5QrScanner = null;
            }).catch(err => {
                console.error("Stop scanner error:", err);
            });
        }
        this.stopNfc();
    },

    onScanSuccess(code) {
        if (this.isProcessing) return;

        let parsedCode = code;
        let mode = this.currentMode;

        // Identification Logic as per specs
        if (mode === 'ticket') {
            parsedCode = this.parseTicketId(code);
        } else if (mode === 'attendance' || mode === 'nfc') {
            parsedCode = this.parseMemberData(code);
            if (!parsedCode) {
                console.warn("Invalid member data scanned:", code);
                return;
            }
        }

        this.isProcessing = true;

        // STOP SCANNER: Immediately release camera resource as requested
        this.stopScanner();

        const payload = {
            type: 'scan',
            code: parsedCode,
            mode: mode,
            timestamp: new Date().toISOString()
        };

        console.log("Sending parsed scan:", payload);
        this.socket.send(JSON.stringify(payload));

        // Temporary feedback on UI (Initializes button is visible after stopScanner)
        const initBtn = document.getElementById('init-scanner');
        if (initBtn) {
            initBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            // Restore text after timeout (or view switch will hide it)
            setTimeout(() => {
                initBtn.innerHTML = '<i class="fa-solid fa-circle-check me-2"></i> Initialize Scanner';
            }, 2000);
        }
    },

    parseTicketId(data) {
        try {
            // 1. Try JSON
            const json = JSON.parse(data);
            if (json.ticket_id) return json.ticket_id;
        } catch (e) { }

        // 2. Regex Pattern TKT-[A-Z0-9-]+
        const regex = /TKT-[A-Z0-9-]+/;
        const match = data.match(regex);
        if (match) return match[0];

        // 3. Fallback to raw string
        return data;
    },

    parseMemberData(data) {
        try {
            // 1. Try JSON
            const json = JSON.parse(data);
            if (json.id) return json.id.toString();
        } catch (e) { }

        // 2. Extract numeric ID from string
        const match = data.match(/(\d+)/);
        return match ? match[0] : null;
    },

    showView(viewId) {
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        window.scrollTo(0, 0);
    },

    showScanner() {
        this.showView('scanner-view');

        // Ensure scanner is cleared for next use and resumed if it was paused
        this.isProcessing = false;
        if (this.html5QrScanner && typeof this.html5QrScanner.resume === 'function') {
            try { this.html5QrScanner.resume(); } catch (e) { }
        }
    },

    showTicketResult(ticket) {
        document.getElementById('ticket-name').innerText = ticket.name || 'Single Use Ticket';
        document.getElementById('ticket-email').innerText = ticket.email || 'N/A';
        document.getElementById('ticket-phone').innerText = ticket.phone || 'N/A';
        document.getElementById('ticket-qty').innerText = ticket.quantity || '1';

        // Calculate total price (quantity × unit price)
        const quantity = parseInt(ticket.quantity) || 1;
        const unitPrice = parseFloat(ticket.price) || 0;
        const totalPrice = quantity * unitPrice;
        document.getElementById('ticket-price').innerText = totalPrice.toFixed(2);

        // Show date (Used timestamp or Created timestamp)
        const dateStr = ticket.used_at || ticket.created_at || new Date().toISOString();
        document.getElementById('ticket-date').innerText = new Date(dateStr).toLocaleString();

        this.showView('ticket-success-view');
    },

    showAttendanceResult(member, statusText = "Access Granted") {
        document.getElementById('member-name').innerText = member.full_name;
        document.getElementById('member-status').innerText = member.status || 'Active';
        document.getElementById('member-expires').innerText = member.expire_date ? new Date(member.expire_date).toLocaleDateString() : 'N/A';
        document.getElementById('member-email').innerText = member.email || 'N/A';
        document.getElementById('member-phone').innerText = member.phone || 'N/A';

        // Update Status Alert
        const statusLabel = document.getElementById('attendance-status-text');
        const statusIcon = document.getElementById('attendance-status-icon');
        const statusAlert = document.getElementById('attendance-status-alert');

        statusLabel.innerText = statusText;
        if (statusText.toLowerCase().includes('exit')) {
            statusIcon.className = "fa-solid fa-right-from-bracket me-2";
            statusAlert.className = "alert alert-warning d-flex align-items-center justify-content-center py-3 mb-4 border-0";
        } else {
            statusIcon.className = "fa-solid fa-right-to-bracket me-2";
            statusAlert.className = "alert alert-success d-flex align-items-center justify-content-center py-3 mb-4 border-0";
        }

        // Initials
        const initials = member.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('member-initials').innerText = initials;

        // Photo if available
        const avatarContainer = document.getElementById('member-avatar-container');
        if (member.profile_picture) {
            avatarContainer.innerHTML = `<img src="/api/photo?id=${member.id}" class="avatar" alt="Member Photo">`;
        } else {
            avatarContainer.innerHTML = `<div class="avatar-placeholder">${initials}</div>`;
        }

        this.showView('attendance-success-view');
    },

    showError(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerHTML = `
            <i class="fa-solid fa-circle-xmark text-danger fs-4"></i>
            <div>
                <div class="fw-bold text-danger small">Access Denied</div>
                <div class="small text-muted">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => app.init());
