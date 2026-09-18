# 🎟️ Ticket Scanner Mobile

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![WebSockets](https://img.shields.io/badge/WebSockets-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![WebNFC](https://img.shields.io/badge/WebNFC-008080?style=for-the-badge&logo=nfc&logoColor=white)](https://w3c.github.io/web-nfc/)

**Ticket Scanner Mobile** is a responsive, web-based mobile companion application designed for real-time **QR code ticket verification**, **member attendance logging**, and **WebNFC tag reading**. It pairs seamlessly with desktop event management and ticket processing applications via real-time WebSocket connections.

---

## 🌟 Key Features

| Feature | Description |
| :--- | :--- |
| 🎟️ **Ticket Verification** | Instantly scans and validates single/multi-use QR code tickets (`TKT-XXXXXX`). |
| 📋 **Member Attendance** | Logs entry/exit for registered members with automated status detection & voice readouts. |
| 💳 **WebNFC Reader Mode** | Reads NDEF formatted NFC cards/tags directly via mobile Chrome (`NDEFReader`). |
| 🔄 **Real-Time Sync** | Keeps low-latency bidirectional WebSocket connection to the host desktop software. |
| 🗣️ **Text-to-Speech & Audio** | Native voice synthesis for member names & audio cues (`granted`, `used`, `invalid`). |
| 🔐 **Pairing Security** | URL parameter token authentication (`?token=...`) with persistent hardware device ID. |
| 🔒 **HTTPS & Flag Guide** | Built-in guide for enabling Chrome camera flags (`chrome://flags/#unsafely-treat-insecure-origin-as-secure`). |

---

## 🏗️ Architecture & Data Flow

```
 +-------------------------------------------------------+
 |               Mobile Companion (Web Browser)          |
 |  [ QR Scanner (html5-qrcode) ]  |  [ WebNFC Reader ] |
 +-------------------------------------------------------+
                            |
                     WebSocket JSON
                     Payload Stream
                            |
                            v
 +-------------------------------------------------------+
 |            Host Desktop Application Server            |
 |         (Validates Ticket / Member DB Record)          |
 +-------------------------------------------------------+
                            |
                     WebSocket Response
                       (scan_result)
                            |
                            v
 +-------------------------------------------------------+
 |           Mobile UI Render & Audio Feedback           |
 |  [ Audio Playback ] [ TTS Voice ] [ Access Cards ]    |
 +-------------------------------------------------------+
```

---

## 🚀 Modes of Operation

### 1. 🎟️ Ticket Verification Mode
- Scans QR codes containing standard ticket formats (`TKT-XXXXXX` or JSON objects).
- Extracts ticket ID, quantity, unit price, date, holder email, and phone.
- Displays calculated total price and verification state (*Access Granted* or *Access Denied*).

### 2. 📋 Member Attendance Mode
- Scans member badges / dynamic QR codes containing member IDs.
- Tracks **Entry** (`fa-right-to-bracket`) and **Exit** (`fa-right-from-bracket`) events.
- Features **Text-to-Speech (TTS)** voice readouts: *"Member Name, Entry Recorded"*.
- Displays member profile picture or styled initials avatar with expiration date checks.

### 3. 💳 WebNFC Mode
- Integrates W3C WebNFC API (`NDEFReader`).
- Displays animated pulse overlay during active tag detection.
- Decodes JSON and text NDEF payload records with haptic vibration feedback.

---

## 🛠️ Installation & Setup

### Prerequisites
- Any modern web browser (Google Chrome / Android Chrome recommended for camera & WebNFC support).
- A host desktop application running a WebSocket server on the local network.

### Serving the Application
Serve the static files (`index.html`, `js/`, `css/`, `assets/`) using any web server or host directly via desktop HTTP server (e.g. ASP.NET Core `UseStaticFiles()`, Nginx, or `http-server`):

```bash
# Using Node.js http-server
npx http-server ./wwwroot -p 8080
```

### Pairing with Host Application
Open the application URL on your mobile browser with the required pairing token:

```
http://<host-ip>:<port>/?token=YOUR_PAIRING_TOKEN
```

---

## 🔒 Security & Camera Access (HTTP Setup)

Modern mobile browsers restrict camera and NFC access to secure contexts (**HTTPS**). If testing over local HTTP (`http://192.168.x.x`):

1. Open Chrome on your mobile device.
2. Navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
3. Add your host URL (e.g., `http://192.168.1.100:8080`).
4. Change the toggle to **Enabled** and relaunch Chrome.

---

## 📡 WebSocket Protocol Specification

### Handshake Payload (Client -> Server)
```json
{
  "type": "handshake",
  "id": "DEV-X89K2P1A",
  "name": "Mozilla Mobile",
  "token": "YOUR_PAIRING_TOKEN",
  "mac": "00:00:00:00:00:00"
}
```

### Scan Request Payload (Client -> Server)
```json
{
  "type": "scan",
  "code": "TKT-84920482",
  "mode": "ticket",
  "timestamp": "2026-09-18T11:15:00.000Z"
}
```

### Scan Result Response (Server -> Client)
```json
{
  "type": "scan_result",
  "success": true,
  "scanType": "ticket",
  "message": "Access Granted",
  "data": {
    "name": "VIP Conference Pass",
    "email": "user@example.com",
    "phone": "+123456789",
    "quantity": 2,
    "price": 50.00,
    "used_at": "2026-09-18T11:15:00.000Z"
  }
}
```

---

## 🛠️ Project Structure

```
wwwroot/
├── index.html               # Main responsive single-page HTML UI
├── css/
│   ├── bootstrap.min.css    # Responsive layout framework
│   └── all.min.css          # FontAwesome icons
├── js/
│   ├── app.js               # Core application logic & WebSocket handler
│   ├── html5-qrcode.min.js  # QR code scanner library
│   └── fontawesome.min.js   # FontAwesome icon library
├── assets/
│   ├── access_granted.mp3   # Success sound cue
│   ├── already_used.mp3     # Warning sound cue
│   └── invalid_ticket.mp3   # Failure sound cue
└── webfonts/                # FontAwesome webfont assets
```

---

## 📬 Contact & Support

For support, inquiries, or collaboration, feel free to reach out across any of these channels:

- 📧 **Email:** [technicguy@gmail.com](mailto:technicguy@gmail.com)
- 🌐 **Website:** [https://esanshar.com.np/](https://esanshar.com.np/)
- 📞 **Phone:** [+977 986 445 0173](tel:+9779864450173)
- 💬 **WhatsApp:** [+977 984 470 7950](https://wa.me/9779844707950)
- 💼 **LinkedIn:** [linkedin.com/in/technicguy](https://www.linkedin.com/in/technicguy/)
- 👤 **Facebook:** [facebook.com/imakashgc](https://www.facebook.com/imakashgc)
- 📺 **YouTube Channels:**
  - 🎵 **Sound & Frequency:** [Mystic Sound Journeys](https://www.youtube.com/@MysticSoundJourneys?sub_confirmation=1)
  - 👶 **Kids Content:** [MummaBaba](https://www.youtube.com/@MummaBaba?sub_confirmation=1)
