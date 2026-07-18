# ArenaMind 🏟️

**ArenaMind** is an AI-powered Smart Venue Operations Platform designed to streamline stadium logistics, volunteer coordination, and the overall spectator experience during the **FIFA World Cup 2026**. 

Built with a high-fidelity glassmorphic dark mode interface, ArenaMind functions as a unified "decision-making layer," connecting fans, volunteers, medical staff, and organizers through real-time operational intelligence.

---

## 🌟 Core Features & AI Modules

1. **AI Matchday Assistant (RAG Chatbot)**: Evaluates fan queries (e.g. queue waits, food vendors, transportation, accessibility gates) and retrieves accurate answers from a local Vector-style index, rendering highlight paths on the interactive stadium map.
2. **AI Operations Copilot (What-If Scenario Simulator)**: Allows organizers to model critical events (e.g., Gate C congestion, heavy storms, accessibility elevator outages). The Copilot generates dynamic risk briefs, staff allocation models, and drafts broadcast warnings.
3. **AI Incident Analyzer (Smart Dispatch)**: Automates field incident reports for volunteers. As volunteers describe an issue (e.g., *"slippery floor from soda spill near escalator"*), the AI scans and auto-classifies the incident category (Medical, Security, Congestion, Facility), assesses severity, and displays immediate Standard Operating Procedure (SOP) response guidelines.
4. **GenAI Multilingual Announcement Drafts**: Instantly translates stadium P.A. announcements across 6 languages (English, Spanish, French, Portuguese, Arabic, and German) in under 50 words, allowing organizers to broadcast them to the public rolling ticker banner.
5. **Interactive Accessibility Wayfinder**: Offers interactive SVG blueprints showing crowd sensor metrics and toggles accessibility-friendly routing (wheelchair step-free paths) directly on the floor map.
6. **GreenGoal Sustainability Tracker**: Calculates travel carbon footprints, provides rank classifications, and downloads digital ECO Fan passes for low-emission choices.

---

## 🔒 Cyber Security & Access Controls

To protect venue command servers from unauthorized access or threat injections, the platform implements a robust security layer:
* **Role-Based Access Control (RBAC)**: Unlocks dashboard configurations based on credentials (e.g., volunteers see task dispatches, organizers control broadcasts, administrators manage database structures).
* **Two-Factor Authentication (MFA)**: Challenges staff logins with a dynamic 6-digit verification code.
* **Firewall Rate-Limiter**: Temporarily locks the login screen for 10 seconds after 3 consecutive failed login attempts, writing alerts to the security event log.
* **XSS Content Protection**: Sanitizes custom text entries in chatbot fields and incident reports to prevent malicious script injection.
* **Secure Session Memory**: Retains authorization tokens in local runtime memory (rather than vulnerable `localStorage` strings) to prevent token harvesting.

---

## 🔑 Hackathon Demo Credentials

Access the secure staff and administrative dashboards using the credentials below:

| Persona | Username | Password | MFA Key | Dashboards Access |
| :--- | :--- | :--- | :--- | :--- |
| **Volunteer** | `vol2026` | `steward` | Dynamic | Incident Reporting, Assigned Tasks, SOP Copilot |
| **Organizer** | `opsdir2026` | `worldcup` | Dynamic | AI Copilot Scenarios, Incident Dispatch, Announcement Hub, Dials |
| **Admin** | `admin2026` | `admin` | Dynamic | Vector Document Indexer, User DB Editor, Security Logs Terminal |

*Note: fans do not require a login. Select "Fan Portal" directly from the navigation header.*

---

## 📂 Project Architecture

```text
arenamind/
│
├── index.html        # Semantic HTML5 Layout (Landing, Login dialog, Dashboards)
├── styles.css        # Premium Glassmorphic design system, CSS grids, dials, and animations
├── app.js            # Core Controller: local RAG database, security lockout, translation engine, telemetry
└── README.md         # Setup and walkthrough guidelines
```

---

## 🚀 Running the Application Locally

Follow these commands to configure and run the application on any PC or IDE:

### 1. Open Terminal & Navigate to the Project Folder
```bash
cd "/path/to/Challenge 4"
```

### 2. Set Up Virtual Environment & Dependencies

#### **On macOS / Linux:**
```bash
# Create a virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install required packages
pip install flask flask-cors
```

#### **On Windows:**
```powershell
# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
.venv\Scripts\activate

# Install required packages
pip install flask flask-cors
```

### 3. Start Backend API Server
Run the Flask server in your terminal:
```bash
python server.py
```
*(Runs on port `5001`. Keep this terminal tab running).*

### 4. Start Frontend Static Web Server
Open a **new terminal tab or window**, navigate to the project folder, activate the virtual environment, and run:
```bash
python -m http.server 5500
```
*(Runs on port `5500`).*

### 5. Launch the Application
Open your web browser and navigate to:
👉 **[http://localhost:5500](http://localhost:5500)**

---

## 📂 Project Architecture

```text
arenamind/
│
├── index.html            # Semantic UI Layout, Football Splash, and Mode toggles
├── styles.css            # Premium Orange Glassmorphic theme system, keyframes, and typing loaders
├── app.js                # Frontend controller, view router, telemetry, and fetch API connectors
├── server.py             # Python RAG Flask backend, file parsers, and Gemini REST callers
├── README.md             # Developer documentation
└── knowledge_base/       # Physical documents storage
    ├── stadium_rules.txt # Bag checks, entry gates, and security guidelines
    ├── volunteer_sop.txt # Emergency medical plans, congestion guides, and fire actions
    └── wayfinder_map.json# Coordinates, statuses, and wait times for MetLife, Azteca, and BC Place
```

---

## 📚 Citations & Data Origin
The default offline documents indexed in the RAG pipeline are compiled using the following blueprints:
1. **Stadium Operations & Safety SOPs**: Adapted from the public stadium directives of *MetLife Stadium Guest Services and Clear Bag Directives*.
2. **Transportation & Sustainability Plans**: Modelled on the *FIFA World Cup 2026 Sustainability Charter* outlining the zero-emission Meadowlands transit corridors.

---

## 🔗 Connecting Live Tournament API Timelines
To fetch live match scoring timelines instead of simulated schedule records:
1. Sign up for a free developer key at **[API-Football](https://www.api-football.com/)**.
2. Create a route `/api/scores` in `server.py` using `urllib.request` to query the live fixtures endpoint:
   ```python
   # Example Python API call
   url = "https://v3.football.api-sports.io/fixtures?live=all"
   headers = { "x-apisports-key": "YOUR_API_KEY" }
   ```
3. In `app.js`, add a polling interval `setInterval(() => this.updateLiveScores(), 30000)` to query `/api/scores` and update the UI card content dynamically.

---

## 🔒 Cybersecurity & MFA TOTP Design
To secure the Organizer & Admin panels against threat actors:
* **Hashed Credentials**: plain text passwords must never be stored in local databases. In production, passwords must be hashed using **bcrypt** on a protected Python server, and sessions managed via HTTPOnly secure cookies.
* **TOTP MFA Setup**: The demo generates simulated authenticator codes. To run a fully cryptographically secured local MFA:
  1. Install the `pyotp` python library: `pip install pyotp`.
  2. Generate a random base32 secret key on user registration: `secret = pyotp.random_base32()`.
  3. Generate a QR code for Google Authenticator: `pyotp.totp.TOTP(secret).provisioning_uri(name="ArenaMind admin", issuer_name="FIFA Operations")`.
  4. Prompt users to verify their code, and validate on server via `pyotp.totp.TOTP(secret).verify(code)`.

---

## 🚀 Deploy

Follow this plan to host the application for free on **Render** as a single Web Service:

### Phase 1: Make Codebase Portable
1. **Modify `server.py`**:
   Update the Flask app initialization to serve static files from the root directory:
   ```python
   app = Flask(__name__, static_folder='.', static_url_path='')
   ```
   Add a route to serve the root file:
   ```python
   @app.route('/')
   def serve_index():
       return app.send_static_file('index.html')
   ```

2. **Modify `app.js`**:
   Change all hardcoded API endpoint URLs (e.g., `http://localhost:5001/api/chat` or `http://localhost:5001/api/stadiums`) to relative paths (e.g., `/api/chat` or `/api/stadiums`).

3. **Add `requirements.txt`**:
   Create a `requirements.txt` in the root workspace directory with the following content:
   ```text
   Flask==3.0.2
   Flask-Cors==4.0.0
   gunicorn==21.2.0
   ```

### Phase 2: Deploy to Render
1. Create a GitHub repository and push your project workspace files there (excluding any virtual environments like `.venv`).
2. Log into [Render](https://render.com) using your GitHub account.
3. Click **New +** > **Web Service** and connect your GitHub repository.
4. Set the following configuration parameters:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app`
   - **Instance Type**: `Free`
5. Click **Deploy Web Service** and access your public site once the deployment finishes!

