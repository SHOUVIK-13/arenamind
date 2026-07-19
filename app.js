/**
 * ArenaMind - Smart Venue Operations Platform
 * Core Javascript Controller & GenAI Simulation Engine
 */

class ArenaMindApp {
  constructor() {
    this.currentLanguage = 'en';
    this.currentStadium = 'metlife';
    this.currentView = 'view-landing';
    this.hasPredefinedKey = false;
    this.geminiApiKey = '';
    this.stadiumsData = null;
    this.apiUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '')
      ? 'http://localhost:5001'
      : 'https://arenamind-z69l.onrender.com';
    // Clear any previously saved session keys to prevent persistence on refresh
    sessionStorage.removeItem('vgpt_gemini_key');
    
    // In-memory Session State (Protects against token theft)
    this.session = {
      user: null,
      role: null,
      token: null
    };

    // Login rate limiting state
    this.loginAttempts = 0;
    this.isLockedOut = false;
    this.lockoutTimeRemaining = 0;

    // Local DB initializers
    this.initDatabase();

    // Bind Event Listeners
    document.addEventListener('DOMContentLoaded', () => this.initUI());
  }

  // Database initialization with sample data
  initDatabase() {
    // 1. Predefined users - Always force reset on load to prevent stale/incorrect credentials
    const defaultUsers = [
      { id: 'usr-1', name: 'John Steward', username: 'vol2026', password: 'steward', role: 'volunteer', language: 'en', mfa: 'active' },
      { id: 'usr-2', name: 'Sofia Rodriguez', username: 'opsdir2026', password: 'worldcup', role: 'organizer', language: 'es', mfa: 'active' },
      { id: 'usr-3', name: 'Chief Administrator', username: 'admin2026', password: 'admin', role: 'admin', language: 'en', mfa: 'active' }
    ];
    localStorage.setItem('vgpt_users', JSON.stringify(defaultUsers));
    if (!localStorage.getItem('vgpt_kb')) {
      const defaultKB = [
        {
          id: 'kb-1',
          title: 'Gate Information & Queue Speeds',
          keywords: ['gate', 'wait', 'queue', 'entry', 'gates', 'crowded', 'delay'],
          content: 'MetLife Stadium has 4 main entry points: Gate A (North - accessible), Gate B (East - escalators), Gate C (South - ticket booth), Gate D (West - stairs). Current average queue clearances: Gate A (2 min), Gate B (8 min), Gate C (22 min - heavy congestion, please redirect), Gate D (3 min).'
        },
        {
          id: 'kb-2',
          title: 'Accessibility & Step-Free Navigation Path',
          keywords: ['accessible', 'wheelchair', 'step-free', 'elevator', 'ramp', 'disabled', 'handicapped'],
          content: 'Main accessible entry is Gate A, which offers zero-step entry, low-slope ramps, and elevators to Concourses Level 1 and 2. Step-free wheelchair pathing is highlighted in GREEN on the venue map. Accessibility shuttle carts operate around Lot E & G. Access elevators near Section 112 are currently operational.'
        },
        {
          id: 'kb-3',
          title: 'Eco-Friendly Transportation & Sustainability',
          keywords: ['transport', 'transit', 'bus', 'train', 'rideshare', 'electric', 'eco', 'sustainability', 'green'],
          content: 'To support the FIFA 2026 Sustainability Goal, fans are encouraged to take the Meadowlands Rail Line B directly to the Light Rail Terminal (far left of venue). EV Charging stations are located in Lot C. Green Fan Passes can be unlocked by logging transit distances below 40 miles or utilizing train transit.'
        },
        {
          id: 'kb-4',
          title: 'Emergency Medical & Fire SOP',
          keywords: ['medical', 'emergency', 'hurt', 'injury', 'doctor', 'fire', 'smoke', 'first aid', 'accident'],
          content: 'MEDICAL ALERT SOP: In case of medical emergencies, volunteers must secure the area, report coordinates to the Organizer Console immediately, and guide EMT staff. First Aid centers are located near Section 109 and Section 215. Evacuation paths are directed away from incidents to the nearest open gate.'
        },
        {
          id: 'kb-5',
          title: 'Security and Prohibited Items SOP',
          keywords: ['bag', 'prohibited', 'weapons', 'camera', 'food', 'security', 'alert', 'rules'],
          content: 'SECURITY SOP: Prohibited items include bags larger than 12x6x12 (clear bags only), external food, glass containers, and weapons. For suspicious behavior, volunteers must maintain visual contact from a safe distance and notify supervisor on channel 2. Do not attempt direct containment.'
        }
      ];
      localStorage.setItem('vgpt_kb', JSON.stringify(defaultKB));
    }

    // 3. Incidents Database
    if (!localStorage.getItem('vgpt_incidents')) {
      const defaultIncidents = [
        {
          id: 'inc-1',
          category: 'congestion',
          severity: 'high',
          location: 'Gate C',
          description: 'Ticket scanner glitch causing gate bottleneck. Crowd building up on outer concourse.',
          status: 'pending',
          reported_by: 'Steward-14',
          timestamp: '19:12'
        },
        {
          id: 'inc-2',
          category: 'facility',
          severity: 'low',
          location: 'Section 220',
          description: 'Spilled beverage causing slippery floor near escalator. Housekeeping notified.',
          status: 'in-progress',
          reported_by: 'Steward-3',
          timestamp: '19:25'
        }
      ];
      localStorage.setItem('vgpt_incidents', JSON.stringify(defaultIncidents));
    }

    // 4. System Logs
    this.sysLogs = [
      { type: 'info', msg: 'System initialized. Loading vector index...', time: '19:09:15' },
      { type: 'info', msg: 'Firewall active. Rate limiting checks enabled.', time: '19:09:16' },
      { type: 'info', msg: 'RAG database connected: 5 documents, 214 chunks parsed.', time: '19:09:16' }
    ];
  }

  // DOM elements binding & Event listeners
  initUI() {
    this.logEvent('info', 'UI layout loaded. Binding event controllers.');

    // Dismiss Football Splash Screen after animation
    const splash = document.getElementById('splash-screen');
    if (splash) {
      document.body.classList.add('screen-shake');
      setTimeout(() => {
        splash.classList.add('fade-out');
        document.body.classList.remove('screen-shake');
        setTimeout(() => {
          splash.style.display = 'none';
        }, 500);
      }, 2500);
    }

    // Load theme on startup
    this.loadTheme();

    // Theme Toggle click
    document.getElementById('btn-theme-toggle').addEventListener('click', () => this.toggleTheme());

    // Language & Stadium selectors
    document.getElementById('lang-select').addEventListener('change', (e) => this.switchLanguage(e.target.value));
    document.getElementById('stadium-select').addEventListener('change', (e) => this.switchStadium(e.target.value));

    // Nav Switcher tabs
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target.getAttribute('data-target');
        this.switchView(target);
      });
    });

    // Login Modals
    document.getElementById('btn-login-trigger').addEventListener('click', () => this.showLoginModal());
    document.getElementById('hero-staff-login').addEventListener('click', () => this.showLoginModal());
    document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('btn-logout').addEventListener('click', () => this.handleLogout());

    // Check backend config dynamically on load
    this.checkBackendConfig();

    // Admin KB Uploader
    const uploaderBox = document.getElementById('kb-uploader-box');
    const fileInput = document.getElementById('kb-file-input');
    if (uploaderBox && fileInput) {
      uploaderBox.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.handleKbFileUpload(file);
        }
      });
    }

    // Fan Chatbot
    document.getElementById('fan-chat-form').addEventListener('submit', (e) => this.handleFanChat(e));

    // Volunteer Forms
    document.getElementById('incident-form').addEventListener('submit', (e) => this.handleIncidentSubmit(e));
    document.getElementById('inc-desc').addEventListener('input', (e) => this.handleIncidentTextInput(e.target.value));
    document.getElementById('sop-search-form').addEventListener('submit', (e) => this.handleSopSearch(e));

    // Custom Scenario Form
    document.getElementById('scenario-custom-form').addEventListener('submit', (e) => this.handleCustomScenarioSubmit(e));

    // Map overrides
    document.getElementById('btn-map-standard').addEventListener('click', () => this.switchMapRoute('standard'));
    document.getElementById('btn-map-accessible').addEventListener('click', () => this.switchMapRoute('accessible'));

    // Map Popover clicks repositioning
    this.initMapPopovers();

    // Admin KB & Users
    this.renderUsersAdmin();
    this.renderAdminDocuments();
    this.renderLogs();
    
    // Live update simulations
    this.startLiveTelemetry();
    this.syncIncidentBoards();
    this.startLiveMatchPolling();

    // Fetch and initialize stadium wayfinder RAG data
    this.loadStadiumsData();
  }

  // Load theme preference (default: system)
  loadTheme() {
    const savedTheme = localStorage.getItem('vgpt_theme') || 'system';
    const root = document.documentElement;
    const btn = document.getElementById('btn-theme-toggle');

    if (savedTheme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
      if (btn) btn.innerText = '☀️ Light Mode';
    } else if (savedTheme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
      if (btn) btn.innerText = '🌙 Dark Mode';
    } else {
      // System mode
      root.classList.remove('light-theme', 'dark-theme');
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (btn) btn.innerText = isSystemDark ? '🌗 System (Dark)' : '🌗 System (Light)';
    }
    this.logEvent('info', `Theme initialized to: [${savedTheme.toUpperCase()}]`);
  }

  // Toggle Theme loop: System -> Light -> Dark -> System
  toggleTheme() {
    const savedTheme = localStorage.getItem('vgpt_theme') || 'system';
    let nextTheme = 'system';

    if (savedTheme === 'system') {
      nextTheme = 'light';
    } else if (savedTheme === 'light') {
      nextTheme = 'dark';
    } else {
      nextTheme = 'system';
    }

    localStorage.setItem('vgpt_theme', nextTheme);
    this.loadTheme();
  }

  // Position HTML popover correctly relative to the SVG element on click
  // Position HTML popover correctly relative to the SVG element on click
  initMapPopovers() {
    document.querySelectorAll('.map-node').forEach(node => {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = node.getAttribute('id').replace('node-', 'popover-');
        const popover = document.getElementById(targetId);
        
        if (popover) {
          // Hide all other open popovers
          document.querySelectorAll('[popover]').forEach(p => {
            if (p !== popover) {
              try { p.hidePopover(); } catch(err) {}
            }
          });

          // Dynamic populate content from RAG JSON data
          this.populatePopoverContent(node.getAttribute('id'), popover);

          // Position popover
          const rect = node.getBoundingClientRect();
          popover.style.position = 'absolute';
          // Place popover centered above the node
          popover.style.left = `${rect.left + window.scrollX + rect.width / 2 - 140}px`; // 140 is half of max-width 280px
          popover.style.top = `${rect.top + window.scrollY - 140}px`; // 140px above

          try {
            popover.showPopover();
            this.logEvent('info', `Map Interaction: Displayed popover details for node "${node.getAttribute('id')}"`);
          } catch(err) {
            popover.style.display = 'block';
          }
        }
      });
    });

    // Close popovers if clicking outside map nodes
    document.addEventListener('click', () => {
      document.querySelectorAll('[popover]').forEach(p => {
        try { p.hidePopover(); } catch(err) {}
      });
    });
  }

  async loadStadiumsData() {
    try {
      const response = await fetch(`${this.apiUrl}/api/stadiums`);
      if (response.ok) {
        const data = await response.json();
        this.stadiumsData = data.stadiums;
        this.logEvent('info', 'Loaded stadium profiles from RAG backend database.');
      } else {
        throw new Error('Failed to load from RAG backend');
      }
    } catch (err) {
      console.warn("Could not fetch stadiums data from backend, using local fallback:", err);
      this.stadiumsData = this.getLocalStadiumsFallback();
    }
    // Update map immediately once loaded
    this.updateMapFromData();
  }

  updateMapFromData() {
    if (!this.stadiumsData || !this.stadiumsData[this.currentStadium]) return;
    const stadium = this.stadiumsData[this.currentStadium];

    // Update Chatbot welcome message based on stadium name
    const chatMsg = document.getElementById('fan-chat-messages');
    if (chatMsg && chatMsg.children.length === 1 && chatMsg.children[0].classList.contains('bot-message')) {
      chatMsg.children[0].innerText = `Hello! I am ArenaMind. I have direct access to ${stadium.name}'s knowledge base. How can I help you today?`;
    }

    // Toggle SVG Layout groups
    const layouts = ['metlife', 'azteca', 'bcplace'];
    layouts.forEach(lay => {
      const el = document.getElementById(`layout-${lay}`);
      if (el) {
        el.style.display = (lay === this.currentStadium) ? 'block' : 'none';
      }
    });

    // Shift map nodes dynamically
    const nodeCoords = {
      metlife: {
        'node-gateA': { cx: 120, cy: 90 },
        'node-gateB': { cx: 380, cy: 90 },
        'node-gateC': { cx: 380, cy: 310 },
        'node-gateD': { cx: 120, cy: 310 },
        'node-transit': { cx: 50, cy: 200 },
        'node-food': { cx: 430, cy: 200 },
        'node-ada-parking': { cx: 85, cy: 55 },
        'node-ev-charging': { cx: 85, cy: 345 },
        'node-rideshare': { cx: 415, cy: 55 },
        'node-guest-services': { cx: 250, cy: 100 },
        'node-first-aid': { cx: 250, cy: 300 },
        'node-fan-shop': { cx: 415, cy: 345 },
        'node-volunteer': { cx: 35, cy: 110 }
      },
      azteca: {
        'node-gateA': { cx: 100, cy: 100 },
        'node-gateB': { cx: 400, cy: 100 },
        'node-gateC': { cx: 400, cy: 300 },
        'node-gateD': { cx: 100, cy: 300 },
        'node-transit': { cx: 40, cy: 200 },
        'node-food': { cx: 445, cy: 200 },
        'node-ada-parking': { cx: 65, cy: 65 },
        'node-ev-charging': { cx: 65, cy: 335 },
        'node-rideshare': { cx: 435, cy: 65 },
        'node-guest-services': { cx: 250, cy: 110 },
        'node-first-aid': { cx: 250, cy: 290 },
        'node-fan-shop': { cx: 435, cy: 335 },
        'node-volunteer': { cx: 25, cy: 120 }
      },
      bcplace: {
        'node-gateA': { cx: 140, cy: 95 },
        'node-gateB': { cx: 360, cy: 95 },
        'node-gateC': { cx: 360, cy: 305 },
        'node-gateD': { cx: 140, cy: 305 },
        'node-transit': { cx: 60, cy: 200 },
        'node-food': { cx: 420, cy: 200 },
        'node-ada-parking': { cx: 105, cy: 65 },
        'node-ev-charging': { cx: 105, cy: 335 },
        'node-rideshare': { cx: 395, cy: 65 },
        'node-guest-services': { cx: 250, cy: 105 },
        'node-first-aid': { cx: 250, cy: 295 },
        'node-fan-shop': { cx: 395, cy: 335 },
        'node-volunteer': { cx: 45, cy: 115 }
      }
    };

    const activeCoords = nodeCoords[this.currentStadium] || nodeCoords.metlife;
    for (const [id, coords] of Object.entries(activeCoords)) {
      const node = document.getElementById(id);
      if (node) {
        const circle = node.querySelector('.node-circle');
        const rect = node.querySelector('.node-rect');
        const text = node.querySelector('.node-label');
        
        if (circle) {
          circle.setAttribute('cx', coords.cx);
          circle.setAttribute('cy', coords.cy);
        }
        if (rect) {
          const w = parseFloat(rect.getAttribute('width')) || 30;
          const h = parseFloat(rect.getAttribute('height')) || 40;
          rect.setAttribute('x', coords.cx - w / 2);
          rect.setAttribute('y', coords.cy - h / 2);
        }
        if (text) {
          text.setAttribute('x', coords.cx);
          text.setAttribute('y', coords.cy + 5);
        }
      }
    }

    // Dynamic routing paths
    const standardPaths = {
      metlife: "M 50 200 L 120 90 L 250 160",
      azteca: "M 40 200 L 100 100 L 250 160",
      bcplace: "M 60 200 L 140 95 L 250 160"
    };
    const accessiblePaths = {
      metlife: "M 50 200 L 120 200 L 120 310 L 250 240",
      azteca: "M 40 200 L 100 200 L 100 300 L 250 240",
      bcplace: "M 60 200 L 140 200 L 140 305 L 250 240"
    };
    const stdPath = document.getElementById('route-path-standard');
    if (stdPath) {
      stdPath.setAttribute('d', standardPaths[this.currentStadium] || standardPaths.metlife);
    }
    const accPath = document.getElementById('route-path-accessible');
    if (accPath) {
      accPath.setAttribute('d', accessiblePaths[this.currentStadium] || accessiblePaths.metlife);
    }

    // Update Transit Icon based on transit option
    const transitNode = document.getElementById('node-transit');
    if (transitNode) {
      const label = transitNode.querySelector('.node-label');
      if (label) {
        label.innerText = this.currentStadium === 'azteca' ? '🚇' : '🚊';
      }
    }

    // Update Gates status and wait times
    const gates = stadium.gates;
    for (const [gateName, gateData] of Object.entries(gates)) {
      const idPart = gateName.replace(' ', ''); // "GateA"
      const node = document.getElementById(`node-${idPart.charAt(0).toLowerCase() + idPart.slice(1)}`);
      if (node) {
        const circle = node.querySelector('.node-circle');
        if (circle) {
          circle.classList.remove('status-green', 'status-yellow', 'status-red', 'animate-pulse');
          const waitTime = gateData.wait_time_min;
          const statusLower = gateData.status.toLowerCase();
          if (waitTime >= 15 || statusLower.includes('congest')) {
            circle.classList.add('status-red', 'animate-pulse');
          } else if (waitTime >= 5 || statusLower.includes('moderat')) {
            circle.classList.add('status-yellow');
          } else {
            circle.classList.add('status-green');
          }
        }
      }
    }

    // Update Incident dropdown locations
    const incSelect = document.getElementById('inc-location');
    if (incSelect) {
      const locations = {
        metlife: [
          { value: "Gate A", text: "Gate A Entrance" },
          { value: "Gate B", text: "Gate B Escalators" },
          { value: "Gate C", text: "Gate C Ticket Booth" },
          { value: "Section 102", text: "Lower Bowl Section 102" },
          { value: "Section 220", text: "Concourse Level 2 Sec 220" },
          { value: "Food Court", text: "Central Concourse Food Court" }
        ],
        azteca: [
          { value: "Gate A", text: "Gate A Main North" },
          { value: "Gate B", text: "Gate B East Ramp" },
          { value: "Gate C", text: "Gate C South Tunnel" },
          { value: "Section 114", text: "Section 114 (North Entrance)" },
          { value: "Section 220", text: "Section 220 (Level 2)" },
          { value: "Food Court", text: "Tlalpan Concourse" }
        ],
        bcplace: [
          { value: "Gate A", text: "Gate A Pacific Blvd" },
          { value: "Gate B", text: "Gate B Terry Fox Plaza" },
          { value: "Gate C", text: "Gate C South Entrance" },
          { value: "Section 103", text: "Section 103 (Level 1)" },
          { value: "Section 236", text: "Section 236 (Level 2)" },
          { value: "Food Court", text: "Main Concourse Food Court" }
        ]
      };
      const activeLocs = locations[this.currentStadium] || locations.metlife;
      incSelect.innerHTML = activeLocs.map(loc => `<option value="${loc.value}">${loc.text}</option>`).join('');
    }

    // Update Organizer scenario suggestions
    const scenarioContainer = document.getElementById('scenario-suggestions-container');
    if (scenarioContainer) {
      const suggestions = {
        metlife: [
          { text: "⚡ Concourse Bottleneck", scenario: "Gate C Congestion Delay" },
          { text: "⛈️ Thunderstorm Delays", scenario: "Heavy Storm Alert & Match Delay" },
          { text: "♿ Access Elevator Defect", scenario: "Elevator Outage near Section 112" }
        ],
        azteca: [
          { text: "⚡ South Tunnel Bottleneck", scenario: "Gate C South Tunnel Bottleneck" },
          { text: "⛈️ Heavy Rain Delays", scenario: "Heavy Rain & Match Delay" },
          { text: "♿ Access Ramp B Obstruction", scenario: "Access Ramp B Obstruction" }
        ],
        bcplace: [
          { text: "⚡ West Entrance Bottleneck", scenario: "Gate D West Entrance Bottleneck" },
          { text: "🏟️ Retractable Roof Defect", scenario: "Retractable Roof Issue" },
          { text: "♿ Access Elevator B Defect", scenario: "Access Elevator Gate B Defect" }
        ]
      };
      const activeSugs = suggestions[this.currentStadium] || suggestions.metlife;
      scenarioContainer.innerHTML = activeSugs.map(sug => `
        <button class="btn btn-small btn-secondary" onclick="app.runScenario('${sug.scenario}')">${sug.text}</button>
      `).join('');
    }

    // Update transit telemetry labels
    const transitLabels = {
      metlife: "Train Wait Times",
      azteca: "Metro Wait Times",
      bcplace: "SkyTrain Wait Times"
    };
    const transLabel = document.getElementById('dial-transit-label');
    if (transLabel) {
      transLabel.innerText = transitLabels[this.currentStadium] || transitLabels.metlife;
    }

    // Update loaded document name in admin view
    const adminMapFilename = document.getElementById('admin-map-filename');
    if (adminMapFilename) {
      if (this.currentStadium === 'azteca') {
        adminMapFilename.innerText = 'Azteca_Stadium_Wayfinder_Map.json';
      } else if (this.currentStadium === 'bcplace') {
        adminMapFilename.innerText = 'BCPlace_Stadium_Wayfinder_Map.json';
      } else {
        adminMapFilename.innerText = 'MetLife_Stadium_Wayfinder_Map.json';
      }
    }
  }

  populatePopoverContent(nodeId, popover) {
    if (!this.stadiumsData || !this.stadiumsData[this.currentStadium]) return;
    const stadium = this.stadiumsData[this.currentStadium];

    let html = '';
    
    if (nodeId === 'node-gateA' || nodeId === 'node-gateB' || nodeId === 'node-gateC' || nodeId === 'node-gateD') {
      const gateKey = nodeId === 'node-gateA' ? 'Gate A' : 
                      nodeId === 'node-gateB' ? 'Gate B' : 
                      nodeId === 'node-gateC' ? 'Gate C' : 'Gate D';
      const gate = stadium.gates[gateKey];
      if (gate) {
        const statusColor = gate.status.toLowerCase().includes('congest') || gate.wait_time_min >= 15 ? 'red' : 
                            gate.status.toLowerCase().includes('moderat') || gate.wait_time_min >= 5 ? 'yellow' : 'green';
        const statusEmoji = statusColor === 'red' ? '🔴' : statusColor === 'yellow' ? '🟡' : '🟢';
        
        html = `
          <h4>🚪 ${gateKey} (${gate.location})</h4>
          <p><span class="popover-badge badge-${statusColor}">${statusEmoji} Status: ${gate.status}</span></p>
          <p>⏱️ <strong>Wait Time:</strong> ${gate.wait_time_min} mins</p>
          <p class="features-text">✨ <strong>Features:</strong> ${gate.features}</p>
        `;
      }
    } else if (nodeId === 'node-transit') {
      const transit = stadium.sustainability;
      html = `
        <h4>🚊 Sustainable Transit</h4>
        <p>🚄 <strong>Line:</strong> ${transit.transit_option}</p>
        <p>📍 <strong>Terminal:</strong> ${transit.station_location}</p>
        <p>ℹ️ <strong>Details:</strong> ${stadium.directions.by_train}</p>
        <p>💡 <em>${stadium.directions.by_bus}</em></p>
      `;
    } else if (nodeId === 'node-food') {
      const food = stadium.food_courts;
      html = `
        <h4>🍔 Concessions & Food Courts</h4>
        <p>🍕 <strong>Level 1:</strong> ${food.level_1}</p>
        <p>🌭 <strong>Level 2:</strong> ${food.level_2}</p>
        <p>🥗 <strong>Options:</strong> ${food.options}</p>
        <p>🍷 <strong>Premium:</strong> ${food.premium_dining}</p>
        <p>💧 <strong>Refill Stations:</strong> Sections ${food.water_refill}</p>
      `;
    } else if (nodeId === 'node-ada-parking') {
      const park = stadium.parking;
      html = `
        <h4>♿ Accessible & ADA Parking</h4>
        <p>🚗 <strong>ADA Lots:</strong> ${park.accessible_ada}</p>
        <p>⛳ <strong>Shuttle:</strong> Carts run constantly to/from Gate A for mobility assistance.</p>
      `;
    } else if (nodeId === 'node-ev-charging') {
      const park = stadium.parking;
      html = `
        <h4>⚡ EV Charging Stations</h4>
        <p>🔌 <strong>Chargers:</strong> ${park.ev_charging}</p>
        <p>🍃 <em>Reduce emissions and unlock your ECO Fan Pass!</em></p>
      `;
    } else if (nodeId === 'node-rideshare') {
      const park = stadium.parking;
      html = `
        <h4>🚖 Rideshare Pickup/Drop-off</h4>
        <p>📍 <strong>Zone:</strong> ${park.rideshare_pickup}</p>
        <p>ℹ️ <em>Follow the rideshare signs. Only official vehicles permitted in other zones.</em></p>
      `;
    } else if (nodeId === 'node-first-aid') {
      const keyLoc = stadium.key_locations;
      html = `
        <h4>🚨 First Aid & Medical</h4>
        <p>🏥 <strong>Locations:</strong> ${keyLoc.first_aid.join(' & ')}</p>
        <p>❤️ <strong>Emergency:</strong> Licensed EMTs are on duty. AEDs are located at every gate and concourse pillar.</p>
      `;
    } else if (nodeId === 'node-guest-services') {
      const keyLoc = stadium.key_locations;
      html = `
        <h4>ℹ️ Guest Services & Lost/Found</h4>
        <p>📍 <strong>Location:</strong> ${keyLoc.guest_services}</p>
        <p>📦 <strong>Lost & Found:</strong> Report lost items here. Items are held for 30 days.</p>
        <p>📶 <strong>WiFi:</strong> "${stadium.wifi.network}" (Speed: ${stadium.wifi.speed})</p>
      `;
    } else if (nodeId === 'node-fan-shop') {
      const keyLoc = stadium.key_locations;
      html = `
        <h4>🛍️ FIFA Fan Shops</h4>
        <p>🏟️ <strong>Locations:</strong> ${keyLoc.fan_shops.join(', ')}</p>
        <p>💳 <strong>Payment:</strong> Cashless only. Card and mobile payments accepted.</p>
      `;
    } else if (nodeId === 'node-volunteer') {
      const keyLoc = stadium.key_locations;
      html = `
        <h4>🙋 Volunteer & Staff Center</h4>
        <p>🏢 <strong>Check-in:</strong> ${keyLoc.volunteer_center}</p>
        <p>📋 <em>Volunteers must sign in here 15 mins before their shift begins.</em></p>
      `;
    }

    popover.innerHTML = html;
  }

  getLocalStadiumsFallback() {
    return {
      metlife: {
        name: "MetLife Stadium",
        full_name: "MetLife Stadium (NY/NJ)",
        address: "One MetLife Stadium Drive, East Rutherford, NJ 07073, USA",
        capacity: 82500,
        type: "Open-air",
        event: "FIFA World Cup 2026",
        directions: {
          by_train: "Take Meadowlands Rail Line B from Secaucus Junction or Hoboken Terminal. Trains run every 10 min on match days, starting 4 hours before kickoff. Alight at MetLife Stadium Light Rail Terminal (far left of venue).",
          by_bus: "NJ Transit Bus Route 160 from Port Authority Bus Terminal (Manhattan) directly to MetLife Stadium on match days.",
          by_car_from_manhattan: "Lincoln Tunnel → NJ Route 3 West → Meadowlands Sports Complex exit. Follow signs. ~30 min drive.",
          by_car_from_newark_airport: "NJ Turnpike North → Exit 16W → Route 3 East → Meadowlands exit. ~20 min drive.",
          by_rideshare: "Uber/Lyft drop-off zone in Lot K (northeast corner). Follow blue rideshare signs."
        },
        gates: {
          "Gate A": { "location": "North Concourse", "status": "Accessible", "wait_time_min": 2, "features": "Step-free entry, ADA accessible, VIP entrance, wheelchair ramps, automatic doors" },
          "Gate B": { "location": "East Concourse", "status": "Moderate", "wait_time_min": 8, "features": "Escalator access, standard entry" },
          "Gate C": { "location": "South Concourse", "status": "Heavy Congestion", "wait_time_min": 22, "features": "Ticket booth area, frequently congested — fans should use Gate A or D instead" },
          "Gate D": { "location": "West Concourse", "status": "Clear", "wait_time_min": 3, "features": "Stairs access, VIP entrance, fast entry, designated smoking area outside" }
        },
        parking: {
          general: "Lots A, B, D, E, G, J, K, L, P — $40 per vehicle (pre-purchase on Ticketmaster)",
          accessible_ada: "Lots E and G (closest to Gate A). Free for valid ADA permit holders.",
          ev_charging: "Lot C — 12 Tesla Superchargers, 8 universal Level 2 chargers. First-come, first-served.",
          rideshare_pickup: "Lot K (northeast corner)",
          tailgating: "Lots E, G, J, K, L. Charcoal and propane grills allowed."
        },
        sustainability: {
          transit_option: "Meadowlands Rail Line B",
          station_location: "Far Left Terminal",
          ev_parking: "Lot C",
          green_fan_pass: "Unlocked by logging transit distances below 40 miles or using train transit"
        },
        food_courts: {
          level_1: "Sections 101-140, main food court between Sections 115-120",
          level_2: "Sections 201-240",
          options: "American, Mexican, Asian, Halal, Kosher, Vegan/Vegetarian",
          premium_dining: "MetLife Club Restaurant (Sections 207-211, premium tickets only)",
          water_refill: "Free stations at Sections 105, 118, 130, 209, 225"
        },
        key_locations: {
          guest_services: "Section 116, Concourse Level 1",
          lost_and_found: "Section 116, Concourse Level 1",
          first_aid: ["Section 109 (Level 1)", "Section 215 (Level 2)"],
          family_restrooms: ["Section 109", "Section 125", "Section 205", "Section 220"],
          fan_shops: ["Gate A Plaza (outdoor)", "Section 110 (Level 1)", "Section 210 (Level 2)"],
          nursing_room: "Section 125 (Level 1)",
          volunteer_center: "Lot P (northwest corner)"
        },
        wifi: {
          network: "MetLife_FIFA2026",
          password: "None required",
          speed: "50 Mbps per device"
        }
      },
      azteca: {
        name: "Estadio Azteca",
        full_name: "Estadio Azteca (Mexico City)",
        address: "Calzada de Tlalpan 3465, Coyoacán, 04650 Mexico City, Mexico",
        capacity: 87523,
        type: "Open-air",
        event: "FIFA World Cup 2026",
        directions: {
          by_train: "Take Metro Line 2 (Blue) to Tasqueña station, then Light Rail (Tren Ligero) to Estadio Azteca station. ~5 min walk from station to Gate A.",
          by_bus: "Metrobús Line 1 to Doctor Gálvez stop, then 15 min walk south. Or take RTP buses from Chapultepec.",
          by_car_from_manhattan: "From Centro Histórico: Calzada de Tlalpan south for ~12 km. ~30 min drive.",
          by_car_from_newark_airport: "From Airport (MEX): Viaducto Miguel Alemán → Calzada de Tlalpan south. ~45 min drive.",
          by_rideshare: "Uber/DiDi drop-off at North Plaza (Gate A). Follow orange rideshare signs."
        },
        gates: {
          "Gate A": { "location": "Main North", "status": "Clear", "wait_time_min": 5, "features": "Main entrance, metro access, rideshare drop-off nearby" },
          "Gate B": { "location": "East Ramp", "status": "Accessible", "wait_time_min": 4, "features": "ADA accessible ramp entry, automatic sliding gates" },
          "Gate C": { "location": "South Tunnel", "status": "Moderate", "wait_time_min": 12, "features": "Tunnel entry, standard security screening" },
          "Gate D": { "location": "West Escalator", "status": "Clear", "wait_time_min": 6, "features": "Escalator and stairs access, VIP entry" }
        },
        parking: {
          general: "Lots 1-5 surrounding the stadium — 500 MXN per vehicle",
          accessible_ada: "Lot 2 (closest to Gate B accessible entrance). Free for permit holders.",
          ev_charging: "Lot 1 — 6 universal Level 2 chargers. First-come, first-served.",
          rideshare_pickup: "North Plaza (Gate A)",
          tailgating: "Lots 1 and 3. Propane grills allowed. No open flames after kickoff."
        },
        sustainability: {
          transit_option: "Azteca Light Rail Station",
          station_location: "North Plaza",
          ev_parking: "Lot 1",
          green_fan_pass: "Unlocked by taking Light Rail or using EV parking"
        },
        food_courts: {
          level_1: "Tlalpan Concourse (Sections 100-130)",
          level_2: "General Concourse (Sections 200-240)",
          options: "Mexican street food, tacos, tortas, standard American fare, vegan options",
          premium_dining: "Azteca Club Lounge (Sections 212-216, premium tickets only)",
          water_refill: "Free water stations near Sections 104, 122, 210"
        },
        key_locations: {
          guest_services: "Section 114, North Entrance",
          lost_and_found: "Section 114, North Entrance",
          first_aid: ["Section 102 (Level 1)", "Section 220 (Level 2)"],
          family_restrooms: ["Section 105", "Section 128", "Section 218"],
          fan_shops: ["North Plaza (outdoor)", "Section 112 (Level 1)", "Section 222 (Level 2)"],
          nursing_room: "Section 108 (Level 1)",
          volunteer_center: "Lot 5 (southwest corner)"
        },
        wifi: {
          network: "Azteca_FIFA2026",
          password: "None required",
          speed: "45 Mbps per device"
        }
      },
      bcplace: {
        name: "BC Place",
        full_name: "BC Place (Vancouver)",
        address: "777 Pacific Boulevard, Vancouver, BC V6B 4Y8, Canada",
        capacity: 54500,
        type: "Retractable roof (covered)",
        event: "FIFA World Cup 2026",
        directions: {
          by_train: "Take the Expo Line or Canada Line SkyTrain to Stadium-Chinatown Station. BC Place is a 2 min walk from the station exit.",
          by_bus: "Multiple TransLink bus routes stop at Pacific Boulevard. Routes 3, 8, 19 recommended.",
          by_car_from_manhattan: "Head south on Cambie Street → turn left on Pacific Boulevard. BC Place is on your right. ~10 min drive.",
          by_car_from_newark_airport: "Canada Line SkyTrain directly to Stadium-Chinatown (~25 min). By car: Grant McConachie Way → Highway 99 → Cambie Bridge → Pacific Boulevard. ~30 min drive.",
          by_rideshare: "Uber/Lyft drop-off at Terry Fox Plaza (Gate B area). Follow green rideshare signs."
        },
        gates: {
          "Gate A": { "location": "Pacific Boulevard", "status": "Clear", "wait_time_min": 3, "features": "Main entrance, closest to SkyTrain station, VIP lanes" },
          "Gate B": { "location": "Terry Fox Plaza", "status": "Accessible", "wait_time_min": 2, "features": "ADA accessible, rideshare drop-off nearby, step-free entry" },
          "Gate C": { "location": "South Entrance", "status": "Moderate", "wait_time_min": 9, "features": "Standard entry, escalator access" },
          "Gate D": { "location": "West Entrance", "status": "Heavy Congestion", "wait_time_min": 18, "features": "Frequently congested, stair-access only, fans should use Gate A or B instead" }
        },
        parking: {
          general: "Nearby parkades: Pacific Boulevard Parkade, Expo Lot — $25-40 CAD",
          accessible_ada: "Pacific Boulevard Parkade Level 1 (closest to Gate B accessible entrance)",
          ev_charging: "Lot G — 8 universal Level 2 chargers. First-come, first-served.",
          rideshare_pickup: "Terry Fox Plaza (Gate B area)",
          tailgating: "No tailgating allowed in BC Place parking areas due to city bylaws."
        },
        sustainability: {
          transit_option: "Stadium-Chinatown SkyTrain",
          station_location: "West Concourse Bridge",
          ev_parking: "Lot G",
          green_fan_pass: "Unlocked by SkyTrain transit or EV parking"
        },
        food_courts: {
          level_1: "Main Concourse (Sections 101-148)",
          level_2: "Suite Level (Sections 201-250)",
          options: "Canadian classics, poutine, Asian fusion, vegan, gluten-free",
          premium_dining: "BC Club Lounge (Sections 208-212, club tickets only)",
          water_refill: "Free water stations near Sections 102, 120, 138, 215"
        },
        key_locations: {
          guest_services: "Section 103, Concourse Level 1",
          lost_and_found: "Section 103, Concourse Level 1",
          first_aid: ["Section 114 (Level 1)", "Section 236 (Level 2)"],
          family_restrooms: ["Section 110", "Section 130", "Section 210", "Section 240"],
          fan_shops: ["Terry Fox Plaza (outdoor)", "Section 105 (Level 1)", "Section 225 (Level 2)"],
          nursing_room: "Section 118 (Level 1)",
          volunteer_center: "Lot G (northeast corner)"
        },
        wifi: {
          network: "BCPlace_FIFA2026",
          password: "None required",
          speed: "60 Mbps per device"
        }
      }
    };
  }

  // Log events to admin terminal
  logEvent(type, msg) {
    const timestamp = new Date().toLocaleTimeString();
    this.sysLogs.push({ type, msg, time: timestamp });
    this.renderLogs();
  }

  renderLogs() {
    const term = document.getElementById('system-logs-terminal');
    if (!term) return;
    term.innerHTML = this.sysLogs.map(log => {
      let cssClass = 'log-info';
      if (log.type === 'warn') cssClass = 'log-warn';
      if (log.type === 'error') cssClass = 'log-error';
      return `<div class="log-line"><span class="log-timestamp">[${log.time}]</span><span class="${cssClass}">[${log.type.toUpperCase()}]</span> ${this.sanitizeOutput(log.msg)}</div>`;
    }).join('');
    term.scrollTop = term.scrollHeight;
  }

  clearLogs() {
    this.sysLogs = [{ type: 'info', msg: 'System logs cleared by administrator.', time: new Date().toLocaleTimeString() }];
    this.renderLogs();
  }

  // Input Sanitizer to prevent XSS Injection in reports / chatbot
  sanitizeInput(text) {
    if (!text) return '';
    const temp = text.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
    const clean = temp.replace(/<\/?[^>]+(>|$)/g, "");
    if (clean !== text) {
      this.logEvent('warn', 'Security shield: Malicious markup filtered from user prompt.');
    }
    return clean;
  }

  sanitizeOutput(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Display toast alerts
  showToast(msg, type = 'success') {
    const toast = document.getElementById('toast-popover');
    const toastMsg = document.getElementById('toast-msg');
    toast.className = `glass-card toast-card text-center toast-${type}`;
    toastMsg.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 4000);
  }

  // Switch dashboards views
  switchView(viewId) {
    if (viewId === 'view-volunteer' && this.session.role !== 'volunteer' && this.session.role !== 'admin') {
      this.showToast('Access Denied. Authorization token missing.', 'error');
      this.showLoginModal('volunteer');
      return;
    }
    if (viewId === 'view-organizer' && this.session.role !== 'organizer' && this.session.role !== 'admin') {
      this.showToast('Access Denied. Administrative clearance required.', 'error');
      this.showLoginModal('organizer');
      return;
    }
    if (viewId === 'view-admin' && this.session.role !== 'admin') {
      this.showToast('Access Denied. Root privileges required.', 'error');
      this.showLoginModal('admin');
      return;
    }

    document.querySelectorAll('.viewport-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });

    const activeSec = document.getElementById(viewId);
    if (activeSec) activeSec.classList.add('active');

    const activeTab = Array.from(document.querySelectorAll('.mode-tab')).find(tab => tab.getAttribute('data-target') === viewId);
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.setAttribute('aria-selected', 'true');
    }

    this.currentView = viewId;
    this.logEvent('info', `Navigation: View shifted to ${viewId}.`);
  }

  switchStadium(stadium) {
    this.currentStadium = stadium;
    const names = {
      metlife: 'MetLife Stadium (NY/NJ)',
      azteca: 'Estadio Azteca (Mexico City)',
      bcplace: 'BC Place (Vancouver)'
    };
    this.logEvent('info', `Stadium profiles updated to ${names[stadium]}`);
    this.showToast(`Loading layout for ${names[stadium]}`, 'success');
    
    // Dynamically update the map nodes and popover data
    this.updateMapFromData();
    this.switchLanguage(this.currentLanguage);
  }

  // Switch language translations (Dictionary support)
  switchLanguage(lang) {
    this.currentLanguage = lang;
    this.logEvent('info', `UI language localized to [${lang.toUpperCase()}]`);

    const dicts = {
      en: {
        ticker: "🏆 Welcome to FIFA World Cup 2026! | 📢 Notice: {stadium} is operating at high occupancy. | 💡 Tip: Use transit line B for direct downtown access. | 🟢 Gate A is designated for step-free accessible entry.",
        hero_tag: "FIFA WORLD CUP 2026",
        hero_h2: "AI-Driven Operational Intelligence for Next-Gen Arenas",
        hero_desc: "ArenaMind bridges the gap between stadium operations, volunteers, and tournament attendees. Integrating semantic RAG search, live crowd intelligence, multilingual translation, and real-time incident routing.",
        lbl_login: "Staff Login",
        lbl_logout: "Logout",
        chat_welcome: "Hello! I am ArenaMind. I have direct access to {stadium}'s knowledge base. How can I help you today?",
        logo_title: "ArenaMind AI",
        logo_sub: "Smart Venue Operations",
        nav_home: "Home",
        nav_fan: "Fan Portal",
        nav_volunteer: "Volunteer",
        nav_organizer: "Organizer",
        nav_admin: "Admin",
        heading_chat_assistant: "🤖 AI Matchday Assistant",
        heading_wayfinder: "🗺️ Interactive Wayfinder",
        heading_matchday_info: "ℹ️ Matchday Information",
        heading_greengoal: "🍃 GreenGoal Sustainability Tracker",
        heading_report_incident: "📢 Report Local Field Incident",
        heading_task_assignments: "📋 Active Task Assignments",
        heading_sop_copilot: "📚 AI Volunteer SOP Copilot",
        heading_ops_copilot: "🎯 AI Operations Copilot (Decision Support)",
        heading_announcement_drafts: "📢 GenAI Multilingual Announcement Drafts",
        heading_incident_dispatch: "🚨 Active Incident Dispatch Board",
        heading_sensor_telemetry: "📈 Real-Time Sensor Telemetry",
        heading_admin_kb: "📂 RAG Knowledge Base Document Indexer",
        heading_admin_users: "👥 User Account Roles & Access Keys",
        heading_admin_logs: "🔒 Cyber Security & Firewall Event Terminal",
        title_auth: "🔒 Staff Authentication Portal",
        label_username: "Staff Username",
        label_password: "Password",
        label_role: "Assign Operating Role",
        label_mfa_challenge: "🛡️ Two-Factor authentication challenge active",
        label_mfa: "Enter 6-Digit MFA Verification Code",
        label_hackathon_creds: "💡 Hackathon Demo Login Credentials:",
        cred_role_volunteer: "Volunteer:",
        cred_role_organizer: "Organizer:",
        cred_role_admin: "Admin:"
      },
      es: {
        ticker: "🏆 ¡Bienvenido a la Copa Mundial de la FIFA 2026! | 📢 Aviso: {stadium} está operando a alta capacidad. | 💡 Consejo: Utilice la línea de autobús norte para el centro. | 🟢 La Puerta A está designada para entrada accesible.",
        hero_tag: "COPA MUNDIAL DE LA FIFA 2026",
        hero_h2: "Inteligencia Operativa basada en IA para Estadios del Futuro",
        hero_desc: "ArenaMind conecta las operaciones del estadio, los voluntarios y los fanáticos. Integra búsqueda semántica RAG, monitoreo de multitudes, traducción multilingüe y despacho de incidentes.",
        lbl_login: "Acceso Personal",
        lbl_logout: "Cerrar Sesión",
        chat_welcome: "¡Hola! Soy ArenaMind. Tengo acceso directo a la base de conocimientos de {stadium}. ¿Cómo puedo ayudarte hoy?",
        logo_title: "ArenaMind IA",
        logo_sub: "Operaciones Inteligentes del Estadio",
        nav_home: "Inicio",
        nav_fan: "Portal de Fanáticos",
        nav_volunteer: "Voluntario",
        nav_organizer: "Organizador",
        nav_admin: "Administrador",
        heading_chat_assistant: "🤖 Asistente de Partido IA",
        heading_wayfinder: "🗺️ Buscador de Caminos Interactivo",
        heading_matchday_info: "ℹ️ Información del Día de Partido",
        heading_greengoal: "🍃 Seguimiento de Sostenibilidad GreenGoal",
        heading_report_incident: "📢 Reportar Incidente de Campo Local",
        heading_task_assignments: "📋 Asignación de Tareas Activas",
        heading_sop_copilot: "📚 Copiloto IA de SOP para Voluntarios",
        heading_ops_copilot: "🎯 Copiloto de Operaciones IA",
        heading_announcement_drafts: "📢 Borradores de Anuncios Multilingües GenAI",
        heading_incident_dispatch: "🚨 Tablero de Despacho de Incidentes Activos",
        heading_sensor_telemetry: "📈 Telemetría de Sensores en Tiempo Real",
        heading_admin_kb: "📂 Indexador de Documentos RAG de Base de Conocimientos",
        heading_admin_users: "👥 Roles de Cuentas de Usuario y Llaves de Acceso",
        heading_admin_logs: "🔒 Terminal de Eventos de Ciberseguridad y Cortafuegos",
        title_auth: "🔒 Portal de Autenticación de Personal",
        label_username: "Usuario de Personal",
        label_password: "Contraseña",
        label_role: "Asignar Rol Operativo",
        label_mfa_challenge: "🛡️ Desafío de autenticación de dos factores activo",
        label_mfa: "Ingrese el código de verificación MFA de 6 dígitos",
        label_hackathon_creds: "💡 Credenciales de inicio de sesión de demostración de Hackathon:",
        cred_role_volunteer: "Voluntario:",
        cred_role_organizer: "Organizador:",
        cred_role_admin: "Admin:"
      },
      fr: {
        ticker: "🏆 Bienvenue à la Coupe du Monde de la FIFA 2026 ! | 📢 Note: {stadium} fonctionne à haute capacité. | 💡 Conseil: Utilisez le transport en commun ligne B pour le centre-ville. | 🟢 La porte A est réservée à l'entrée accessible.",
        hero_tag: "COUPE DU MONDE DE LA FIFA 2026",
        hero_h2: "Intelligence Opérationnelle par IA pour Arènes Modernes",
        hero_desc: "ArenaMind relie les opérations du stade, les bénévoles et les supporters. Intègre la recherche sémantique RAG, la gestion de foule, la traduction instantanée et le routage des incidents.",
        lbl_login: "Connexion Staff",
        lbl_logout: "Déconnexion",
        chat_welcome: "Bonjour ! Je suis ArenaMind. J'ai un accès direct aux procédures officielles de {stadium}. Comment puis-je vous aider aujourd'hui ?",
        logo_title: "ArenaMind IA",
        logo_sub: "Opérations Intelligentes du Stade",
        nav_home: "Accueil",
        nav_fan: "Portail des Supporters",
        nav_volunteer: "Bénévole",
        nav_organizer: "Organisateur",
        nav_admin: "Admin",
        heading_chat_assistant: "🤖 Assistant de Match IA",
        heading_wayfinder: "🗺️ Plan d'Orientation Interactif",
        heading_matchday_info: "ℹ️ Informations du Jour de Match",
        heading_greengoal: "🍃 Suivi de Durabilité GreenGoal",
        heading_report_incident: "📢 Signaler un Incident de Terrain",
        heading_task_assignments: "📋 Affectation des Tâches Actives",
        heading_sop_copilot: "📚 Copilote IA de SOP pour Bénévoles",
        heading_ops_copilot: "🎯 Copilote des Opérations IA",
        heading_announcement_drafts: "📢 Brouillons d'Annonces Multilingues GenAI",
        heading_incident_dispatch: "🚨 Tableau de Répartition des Incidents Actifs",
        heading_sensor_telemetry: "📈 Télémétrie des Capteurs en Temps Réel",
        heading_admin_kb: "📂 Indexeur de Documents RAG de Base de Connaissances",
        heading_admin_users: "👥 Rôles des Comptes d'Utilisateurs et Clés d'Accès",
        heading_admin_logs: "🔒 Terminal d'Événements de Cybersécurité et Pare-feu",
        title_auth: "🔒 Portail d'Authentification du Personnel",
        label_username: "Nom d'utilisateur du personnel",
        label_password: "Mot de passe",
        label_role: "Attribuer un rôle opérationnel",
        label_mfa_challenge: "🛡️ Défi d'authentification à deux facteurs actif",
        label_mfa: "Entrez le code de vérification MFA à 6 chiffres",
        label_hackathon_creds: "💡 Identifiants de connexion de démonstration du Hackathon :",
        cred_role_volunteer: "Bénévole :",
        cred_role_organizer: "Organisateur :",
        cred_role_admin: "Admin :"
      },
      pt: {
        ticker: "🏆 Bem-vindo à Copa do Mundo FIFA 2026! | 📢 Aviso: {stadium} com alta ocupação. | 💡 Dica: Use a linha B para acesso rápido ao centro. | 🟢 Portão A é designado para acesso acessível sem degraus.",
        hero_tag: "COPA DO MUNDO FIFA 2026",
        hero_h2: "Inteligência Operacional Baseada em IA para Próxima Geração",
        hero_desc: "O ArenaMind conecta operações, voluntários e torcedores. Integração de RAG, tradução instantânea e inteligência de multidão em tempo real.",
        lbl_login: "Acesso Staff",
        lbl_logout: "Sair",
        chat_welcome: "Olá! Eu sou o ArenaMind. Tenho acesso ao banco de dados de {stadium}. Como posso ajudar você hoje?",
        logo_title: "ArenaMind IA",
        logo_sub: "Operações Inteligentes de Arena",
        nav_home: "Início",
        nav_fan: "Portal do Torcedor",
        nav_volunteer: "Voluntário",
        nav_organizer: "Organizador",
        nav_admin: "Admin",
        heading_chat_assistant: "🤖 Assistente de Jogo IA",
        heading_wayfinder: "🗺️ Guia de Caminho Interativo",
        heading_matchday_info: "ℹ️ Informações do Dia do Jogo",
        heading_greengoal: "🍃 Rastreador de Sustentabilidade GreenGoal",
        heading_report_incident: "📢 Relatar Incidente de Campo Local",
        heading_task_assignments: "📋 Atribuições de Tarefas Activas",
        heading_sop_copilot: "📚 Copiloto IA de SOP para Voluntários",
        heading_ops_copilot: "🎯 Copiloto de Operações IA",
        heading_announcement_drafts: "📢 Esboços de Anúncios Multilíngues GenAI",
        heading_incident_dispatch: "🚨 Painel de Controle de Incidentes Activos",
        heading_sensor_telemetry: "📈 Telemetria de Sensores em Tempo Real",
        heading_admin_kb: "📂 Indexador de Documentos RAG de Base de Conhecimento",
        heading_admin_users: "👥 Funções de Conta de Usuário e Chaves de Acesso",
        heading_admin_logs: "🔒 Terminal de Eventos de Cibersegurança e Firewall",
        title_auth: "🔒 Portal de Autenticação de Pessoal",
        label_username: "Nome de usuário da equipe",
        label_password: "Senha",
        label_role: "Atribuir Função Operacional",
        label_mfa_challenge: "🛡️ Desafio de autenticação de dois fatores ativo",
        label_mfa: "Insira o código de verificação MFA de 6 dígitos",
        label_hackathon_creds: "💡 Credenciais de login de demonstração do Hackathon:",
        cred_role_volunteer: "Voluntário:",
        cred_role_organizer: "Organizador:",
        cred_role_admin: "Admin:"
      },
      ar: {
        ticker: "🏆 مرحبًا بكم في كأس العالم 2026! | 📢 تنبيه: {stadium} يعمل بكثافة جماهيرية عالية. | 💡 نصيحة: استخدم خط قطار B للوصول المباشر. | 🟢 البوابة A مخصصة للدخول الميسر لذوي الهمم.",
        hero_tag: "كأس العالم لكرة القدم 2026",
        hero_h2: "الذكاء التشغيلي المدعوم بالذكاء الاصطناعي للملاعب الذكية",
        hero_desc: "يسد ArenaMind الفجوة بين عمليات الاستاد والمتطوعين والجماهير من خلال البحث الدلالي ومراقبة الحشود والترجمة المباشرة.",
        lbl_login: "دخول الموظفين",
        lbl_logout: "خروج",
        chat_welcome: "مرحبًا! أنا ArenaMind. لدي وصول مباشر إلى قاعدة معلومات {stadium}. كيف يمكنني مساعدتك اليوم؟",
        logo_title: "ArenaMind بالذكاء الاصطناعي",
        logo_sub: "العمليات الذكية للملاعب",
        nav_home: "الرئيسية",
        nav_fan: "بوابة المشجعين",
        nav_volunteer: "متطوع",
        nav_organizer: "منظم",
        nav_admin: "مسؤول",
        heading_chat_assistant: "🤖 مساعد يوم المباراة بالذكاء الاصطناعي",
        heading_wayfinder: "🗺️ مرشد الطريق التفاعلي",
        heading_matchday_info: "ℹ️ معلومات يوم المباراة",
        heading_greengoal: "🍃 متتبع الاستدامة GreenGoal",
        heading_report_incident: "📢 الإبلاغ عن حادث ميداني محلي",
        heading_task_assignments: "📋 مهام العمل النشطة",
        heading_sop_copilot: "📚 مساعد إجراءات العمل للمتطوعين",
        heading_ops_copilot: "🎯 مساعد العمليات بالذكاء الاصطناعي",
        heading_announcement_drafts: "📢 مسودات الإعلانات متعددة اللغات",
        heading_incident_dispatch: "🚨 لوحة إدارة الحوادث النشطة",
        heading_sensor_telemetry: "📈 قياس أجهزة الاستشعار في الوقت الحقيقي",
        heading_admin_kb: "📂 مفهرس وثائق قاعدة المعرفة RAG",
        heading_admin_users: "👥 أدوار حسابات المستخدمين ومفاتيح الوصول",
        heading_admin_logs: "🔒 محطة أحداث الأمن السيبراني وجدار الحماية",
        title_auth: "🔒 بوابة مصادقة الموظفين",
        label_username: "اسم مستخدم الموظف",
        label_password: "كلمة المرور",
        label_role: "تعيين الدور التشغيلي",
        label_mfa_challenge: "🛡️ تحدي المصادقة الثنائية نشط",
        label_mfa: "أدخل رمز التحقق MFA المكون من 6 أرقام",
        label_hackathon_creds: "💡 بيانات اعتماد تسجيل الدخول التجريبية للماراثون البرمجي:",
        cred_role_volunteer: "متطوع:",
        cred_role_organizer: "منظم:",
        cred_role_admin: "مسؤول:"
      },
      de: {
        ticker: "🏆 Willkommen zur FIFA Fussball-Weltmeisterschaft 2026! | 📢 Hinweis: Hohe Stadionauslastung in {stadium}. | 💡 Tipp: Nutzen Sie Bahnlinie B für direkten Zugang. | 🟢 Tor A ist für barrierefreien Zugang reserviert.",
        hero_tag: "FIFA FUSSBALL-WELTMEISTERSCHAFT 2026",
        hero_h2: "KI-gestützte Betriebsintelligenz für moderne Arenen",
        hero_desc: "ArenaMind verbindet Stadionbetrieb, Freiwillige und Fans. Integration von RAG, Echtzeit-Übersetzungen und Vorfallsmanagement.",
        lbl_login: "Mitarbeiter Login",
        lbl_logout: "Logout",
        chat_welcome: "Hallo! Ich bin ArenaMind. Ich habe direkten Zugriff auf die Wissensdatenbank von {stadium}. Wie kann ich heute helfen?",
        logo_title: "ArenaMind KI",
        logo_sub: "Intelligenter Stadionbetrieb",
        nav_home: "Startseite",
        nav_fan: "Fan-Portal",
        nav_volunteer: "Freiwilliger",
        nav_organizer: "Organisator",
        nav_admin: "Admin",
        heading_chat_assistant: "🤖 KI-Spieltagsassistent",
        heading_wayfinder: "🗺️ Interaktiver Wegweiser",
        heading_matchday_info: "ℹ️ Spieltagsinformationen",
        heading_greengoal: "🍃 GreenGoal Nachhaltigkeitstracker",
        heading_report_incident: "📢 Lokalen Vorfall melden",
        heading_task_assignments: "📋 Aktive Aufgaben Zuweisungen",
        heading_sop_copilot: "📚 KI-Freiwilligen-SOP-Copilot",
        heading_ops_copilot: "🎯 KI-Betriebscopilot",
        heading_announcement_drafts: "📢 GenAI Mehrsprachige Durchsagen Entwürfe",
        heading_incident_dispatch: "🚨 Aktives Vorfall-Verteilungspanel",
        heading_sensor_telemetry: "📈 Echtzeit-Sensortelemetrie",
        heading_admin_kb: "📂 RAG Wissensdatenbank Dokumentenindexer",
        heading_admin_users: "👥 Benutzerkonten-Rollen & Zugriffsschlüssel",
        heading_admin_logs: "🔒 Cybersicherheits- & Firewall-Ereignisterminal",
        title_auth: "🔒 Mitarbeiter-Authentifizierungsportal",
        label_username: "Mitarbeiter-Benutzername",
        label_password: "Kennwort",
        label_role: "Betriebliche Rolle zuweisen",
        label_mfa_challenge: "🛡️ Zwei-Faktor-Authentifizierungs-Herausforderung aktiv",
        label_mfa: "Geben Sie den 6-stelligen MFA-Verifizierungscode ein",
        label_hackathon_creds: "💡 Hackathon-Demo-Login-Anmeldeinformationen:",
        cred_role_volunteer: "Freiwilliger:",
        cred_role_organizer: "Organisator:",
        cred_role_admin: "Admin:"
      }
    };

    const d = dicts[lang] || dicts.en;
    
    // Helper function to safely update texts
    const setT = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    const stadiumNames = {
      metlife: "MetLife Stadium",
      azteca: "Estadio Azteca",
      bcplace: "BC Place"
    };
    const name = stadiumNames[this.currentStadium] || "MetLife Stadium";

    // Update labels and navigation
    setT('system-ticker', d.ticker.replace('{stadium}', name));
    setT('logo-title', d.logo_title);
    setT('logo-sub', d.logo_sub);

    const heroSec = document.getElementById('view-landing');
    if (heroSec) {
      const tagline = heroSec.querySelector('.hero-tagline');
      const h2 = heroSec.querySelector('h2');
      const p = heroSec.querySelector('p');
      if (tagline) tagline.innerText = d.hero_tag;
      if (h2) h2.innerText = d.hero_h2;
      if (p) p.innerText = d.hero_desc;
    }
    
    const triggerBtn = document.getElementById('btn-login-trigger');
    if (triggerBtn && triggerBtn.style.display !== 'none') {
      triggerBtn.innerText = d.lbl_login;
    }

    setT('tab-landing', d.nav_home);
    setT('tab-fan', d.nav_fan);
    setT('tab-volunteer', d.nav_volunteer);
    setT('tab-organizer', d.nav_organizer);
    setT('tab-admin', d.nav_admin);

    setT('heading-chat-assistant', d.heading_chat_assistant);
    setT('heading-wayfinder', d.heading_wayfinder);
    setT('heading-matchday-info', d.heading_matchday_info);
    setT('heading-greengoal', d.heading_greengoal);
    setT('heading-report-incident', d.heading_report_incident);
    setT('heading-task-assignments', d.heading_task_assignments);
    setT('heading-sop-copilot', d.heading_sop_copilot);
    setT('heading-ops-copilot', d.heading_ops_copilot);
    setT('heading-announcement-drafts', d.heading_announcement_drafts);
    setT('heading-incident-dispatch', d.heading_incident_dispatch);
    setT('heading-sensor-telemetry', d.heading_sensor_telemetry);
    setT('heading-admin-kb', d.heading_admin_kb);
    setT('heading-admin-users', d.heading_admin_users);
    setT('heading-admin-logs', d.heading_admin_logs);

    setT('title-auth', d.title_auth);
    setT('label-username', d.label_username);
    setT('label-password', d.label_password);
    setT('label-role', d.label_role);
    setT('label-mfa-challenge', d.label_mfa_challenge);
    setT('label-mfa', d.label_mfa);
    setT('label-hackathon-creds', d.label_hackathon_creds);
    setT('cred-role-volunteer', d.cred_role_volunteer);
    setT('cred-role-organizer', d.cred_role_organizer);
    setT('cred-role-admin', d.cred_role_admin);

    // Translate chatbot initial text if no chat history
    const chatMsg = document.getElementById('fan-chat-messages');
    if (chatMsg && chatMsg.children.length === 1 && chatMsg.children[0].classList.contains('bot-message')) {
      chatMsg.children[0].innerText = d.chat_welcome.replace('{stadium}', name);
    }

    // Toggle RTL layout for Arabic
    if (lang === 'ar') {
      document.body.style.direction = 'rtl';
      document.body.style.textAlign = 'right';
    } else {
      document.body.style.direction = 'ltr';
      document.body.style.textAlign = 'left';
    }
  }

  // Modal displays
  showLoginModal(preferredRole = 'volunteer') {
    if (this.isLockedOut) {
      this.showToast(`Portal locked out. Please wait ${this.lockoutTimeRemaining}s.`, 'error');
      return;
    }
    const modal = document.getElementById('login-modal');
    document.getElementById('login-role').value = preferredRole;
    
    // Generate dynamic MFA code challenge code
    const challengePin = Math.floor(100000 + Math.random() * 900000);
    document.getElementById('mfa-challenge-pin').innerText = challengePin;
    document.getElementById('mfa-section').style.display = 'block';

    modal.showModal();
    this.logEvent('info', 'Security: Access login portal requested.');
  }

  closeLoginModal() {
    document.getElementById('login-modal').close();
  }

  // Handle staff login
  handleLogin(e) {
    e.preventDefault();
    if (this.isLockedOut) return;

    const rawUser = document.getElementById('login-username').value.trim();
    const rawPass = document.getElementById('login-password').value;

    // Proactive SQL/NoSQL Injection prevention filter
    const dangerousPatterns = /('|--|\bunion\b|\bselect\b|\bor\s+['"]?1['"]?\s*=\s*['"]?1['"]?)/gi;
    if (dangerousPatterns.test(rawUser) || dangerousPatterns.test(rawPass)) {
      this.logEvent('error', `ALERT: Blocked potential authentication injection vector from username: "${rawUser}".`);
      this.showToast('Security Alert: Malicious input patterns detected and blocked.', 'error');
      return;
    }

    const userInp = this.sanitizeInput(rawUser);
    const passInp = rawPass;
    const roleInp = document.getElementById('login-role').value;
    const mfaInp = document.getElementById('login-mfa').value.trim();
    const mfaChal = document.getElementById('mfa-challenge-pin').innerText.replace(/\s/g, '');

    const users = JSON.parse(localStorage.getItem('vgpt_users'));
    const matchedUser = users.find(u => u.username === userInp && u.password === passInp && u.role === roleInp);

    if (!matchedUser) {
      this.loginAttempts++;
      this.logEvent('error', `Login Failure: Invalid credentials for user "${userInp}". Attempt: ${this.loginAttempts}`);
      this.showToast('Invalid credentials or role mismatch!', 'error');

      if (this.loginAttempts >= 3) {
        this.triggerLockout();
      }
      return;
    }

    // Verify simulated MFA challenge
    if (mfaInp !== mfaChal) {
      this.logEvent('error', `Login Failure: MFA challenge mismatch for user "${userInp}".`);
      this.showToast('MFA verification code failed!', 'error');
      return;
    }

    // Success Authentication
    this.loginAttempts = 0;
    this.session.user = matchedUser.name;
    this.session.role = matchedUser.role;
    this.session.token = 'jwt_token_' + Math.random().toString(36).substr(2, 10);

    // Update UI headers
    document.getElementById('btn-login-trigger').style.display = 'none';
    document.getElementById('user-profile-badge').style.display = 'flex';
    document.getElementById('profile-role').innerText = matchedUser.role;
    
    // Unlock staff tabs
    document.querySelectorAll('.staff-only').forEach(tab => {
      tab.style.display = 'inline-block';
    });

    this.closeLoginModal();
    this.logEvent('info', `AUTH SUCCESS: User ${matchedUser.name} authenticated. Role: ${matchedUser.role}. Token generated.`);
    this.showToast(`Authorized as ${matchedUser.name}`, 'success');

    // Route to appropriate view
    if (matchedUser.role === 'volunteer') this.switchView('view-volunteer');
    if (matchedUser.role === 'organizer') this.switchView('view-organizer');
    if (matchedUser.role === 'admin') this.switchView('view-admin');
  }

  // Threat mitigation lockout simulator
  triggerLockout() {
    this.isLockedOut = true;
    this.lockoutBlocks = (this.lockoutBlocks || 0) + 1;
    this.lockoutTimeRemaining = 15 * this.lockoutBlocks; // Progressive cooldown: 15s, 30s, 45s...
    this.logEvent('error', `ALERT: Firewall lock active. IP rate-limited due to brute-force detection. Cooldown: ${this.lockoutTimeRemaining}s`);
    this.showToast(`Firewall Lock: Locked out for ${this.lockoutTimeRemaining}s.`, 'error');
    this.closeLoginModal();

    const interval = setInterval(() => {
      this.lockoutTimeRemaining--;
      if (this.lockoutTimeRemaining <= 0) {
        clearInterval(interval);
        this.isLockedOut = false;
        this.loginAttempts = 0;
        this.logEvent('info', 'Firewall rate-limiter released. Authentication gates open.');
      }
    }, 1000);
  }

  handleLogout() {
    this.logEvent('info', `SESSION CLOSED: User ${this.session.user} logged out.`);
    this.session = { user: null, role: null, token: null };
    
    document.getElementById('btn-login-trigger').style.display = 'inline-block';
    document.getElementById('user-profile-badge').style.display = 'none';
    
    document.querySelectorAll('.staff-only').forEach(tab => {
      tab.style.display = 'none';
    });

    this.switchLanguage(this.currentLanguage);
    this.switchView('view-landing');
    this.showToast('Logged out successfully', 'success');
  }

  // Local RAG Search simulation (Vector-style keyword score)
  simulateRAGSearch(prompt) {
    const kb = JSON.parse(localStorage.getItem('vgpt_kb'));
    const tokens = prompt.toLowerCase().split(/\W+/);
    
    let bestDoc = null;
    let maxScore = 0;

    kb.forEach(doc => {
      let score = 0;
      doc.keywords.forEach(keyword => {
        if (tokens.includes(keyword)) {
          score += 3; // exact token keyword match
        } else {
          tokens.forEach(t => {
            if (t.length > 3 && (keyword.includes(t) || t.includes(keyword))) {
              score += 1; // partial match
            }
          });
        }
      });

      if (score > maxScore) {
        maxScore = score;
        bestDoc = doc;
      }
    });

    this.logEvent('info', `RAG Query: Vector keyword matching complete. Top document score: ${maxScore}`);
    
    if (maxScore > 0 && bestDoc) {
      let content = bestDoc.content;
      // Dynamically substitute stadium-specific terms if we are on another stadium
      if (this.currentStadium === 'azteca') {
        content = content
          .replace(/MetLife Stadium/g, 'Estadio Azteca')
          .replace(/Gate A \(North - accessible\), Gate B \(East - escalators\), Gate C \(South - ticket booth\), Gate D \(West - stairs\)/g, 'Gate A (Main North - accessible), Gate B (East Ramp), Gate C (South Tunnel), Gate D (West Gate)')
          .replace(/Lot E & G/g, 'General Concourse')
          .replace(/Section 112/g, 'Section 114')
          .replace(/Meadowlands Rail Line B directly to the Light Rail Terminal \(far left of venue\)/g, 'Metro Line 2 and Tren Ligero directly to Estadio Azteca Station')
          .replace(/Lot C/g, 'North Parking')
          .replace(/Section 109 and Section 215/g, 'Section 115 and Section 224');
      } else if (this.currentStadium === 'bcplace') {
        content = content
          .replace(/MetLife Stadium/g, 'BC Place')
          .replace(/Gate A \(North - accessible\), Gate B \(East - escalators\), Gate C \(South - ticket booth\), Gate D \(West - stairs\)/g, 'Gate A (Pacific Blvd - accessible), Gate B (Terry Fox Plaza), Gate C (South Entrance), Gate D (West Gate)')
          .replace(/Lot E & G/g, 'Expo Lot')
          .replace(/Section 112/g, 'Section 103')
          .replace(/Meadowlands Rail Line B directly to the Light Rail Terminal \(far left of venue\)/g, 'SkyTrain Expo Line directly to Stadium-Chinatown Station')
          .replace(/Lot C/g, 'Pacific Boulevard Parkade')
          .replace(/Section 109 and Section 215/g, 'Section 103 and Section 236');
      }
      return {
        content: content,
        title: bestDoc.title
      };
    }

    return null;
  }

  // Fan Chatbot engine (RAG Rerouting & Map trigger)
  async handleFanChat(e) {
    e.preventDefault();
    const chatInp = document.getElementById('fan-chat-input');
    const query = this.sanitizeInput(chatInp.value.trim());
    if (!query) return;

    this.appendChatBubble(query, 'user');
    chatInp.value = '';

    let finalAnswer = "";
    
    // Add typing loader
    const loader = this.appendTypingIndicator();

    // Always route through the Python backend with Gemini LLM
    try {
      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: query, stadium: this.currentStadium })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      finalAnswer = data.response;
      this.logEvent('info', `RAG Query: retrieved context from '${data.context_source}' using ${data.ai_platform}`);
    } catch (err) {
      console.error('[ArenaMind] Gemini RAG fetch error:', err);
      this.logEvent('warn', `Python RAG backend error: ${err.message}. Falling back to browser Local RAG.`);
      this.showToast(`Backend error: ${err.message}. Using local index.`, 'error');
      finalAnswer = this.getLocalRagAnswer(query);
    }

    // Remove typing loader
    loader.remove();

    const lowerQuery = query.toLowerCase();
    
    // Normalize languages, gate aliases, and gate numbers
    let norm = lowerQuery
      .replace(/puerta|porte|porta|tor|بوابة/g, 'gate')
      .replace(/gate 1/g, 'gate a')
      .replace(/gate 2/g, 'gate b')
      .replace(/gate 3/g, 'gate c')
      .replace(/gate 4/g, 'gate d')
      .replace(/b gate/g, 'gate b')
      .replace(/a gate/g, 'gate a')
      .replace(/c gate/g, 'gate c')
      .replace(/d gate/g, 'gate d')
      .replace(/médico|medical|injury|paramedic|premiers secours|primeiros socorros|erste hilfe|إسعافات/g, 'first aid')
      .replace(/comida|concession|eat|dine|restaurant|nourriture|essen|طعام/g, 'food')
      .replace(/tránsito|transit|train|bus|rail|metro|skytrain|ônibus|zug|حافلة|باص/g, 'transit')
      .replace(/estacionamiento|parking|lot|parkplatz|مواقف/g, 'parking')
      .replace(/charging|ev|tesla/g, 'charging')
      .replace(/rideshare|uber|lyft|didi/g, 'rideshare')
      .replace(/shop|store|merch|boutique|loja|geschäft|laden|متجر/g, 'shop')
      .replace(/guest|lost|found|perdu|trouvé|perdido|achado|gefunden|مفقود/g, 'guest');

    // Switch map routes dynamically based on query context
    if (norm.includes('accessible') || norm.includes('wheelchair') || norm.includes('elevator') || norm.includes('step-free') || norm.includes('disabled') || norm.includes('ada')) {
      setTimeout(() => {
        this.switchMapRoute('accessible');
        this.showToast('Accessible Route highlighted on map.', 'success');
      }, 500);
    } else {
      setTimeout(() => {
        this.switchMapRoute('standard');
        this.showToast('Standard route highlighted on map as the primary navigation flow.', 'success');
      }, 500);
    }

    // Highlight and flash specific target node on the map
    let targetNodeId = null;
    if (norm.includes('gate a')) targetNodeId = 'node-gateA';
    else if (norm.includes('gate b')) targetNodeId = 'node-gateB';
    else if (norm.includes('gate c')) targetNodeId = 'node-gateC';
    else if (norm.includes('gate d')) targetNodeId = 'node-gateD';
    else if (norm.includes('transit') || norm.includes('train') || norm.includes('metro') || norm.includes('skytrain')) targetNodeId = 'node-transit';
    else if (norm.includes('food') || norm.includes('concession') || norm.includes('eat') || norm.includes('dine') || norm.includes('restaurant')) targetNodeId = 'node-food';
    else if (norm.includes('first aid') || norm.includes('medical') || norm.includes('injury') || norm.includes('paramedic')) targetNodeId = 'node-first-aid';
    else if (norm.includes('charging') || norm.includes('ev') || norm.includes('tesla')) targetNodeId = 'node-ev-charging';
    else if (norm.includes('rideshare') || norm.includes('uber') || norm.includes('lyft') || norm.includes('didi')) targetNodeId = 'node-rideshare';
    else if (norm.includes('shop') || norm.includes('store') || norm.includes('merch')) targetNodeId = 'node-fan-shop';
    else if (norm.includes('guest') || norm.includes('lost') || norm.includes('found')) targetNodeId = 'node-guest-services';
    else if (norm.includes('parking') || norm.includes('lot')) targetNodeId = 'node-ada-parking';
    else if (norm.includes('volunteer') || norm.includes('shift')) targetNodeId = 'node-volunteer';

    if (targetNodeId) {
      setTimeout(() => {
        const nodeEl = document.getElementById(targetNodeId);
        if (nodeEl) {
          const circle = nodeEl.querySelector('.node-circle');
          if (circle) {
            circle.classList.add('animate-pulse');
            this.showToast(`Target location highlighted on interactive wayfinder.`, 'info');
            // Remove pulse after 5 seconds
            setTimeout(() => {
              circle.classList.remove('animate-pulse');
            }, 5000);
          }
        }
      }, 600);
    }

    // Stream text character by character
    this.appendStreamedBubble(finalAnswer);
  }

  getLocalRagAnswer(query) {
    const searchResult = this.simulateRAGSearch(query);
    if (searchResult) {
      return `[Local RAG Sources: ${searchResult.title}] \n\n${searchResult.content}`;
    }
    return "I'm sorry, I could not find that information in the stadium knowledge base. Please check with Guest Services near Section 116.";
  }

  appendTypingIndicator() {
    const chatMsgs = document.getElementById('fan-chat-messages');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot-message typing-indicator';
    bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    chatMsgs.appendChild(bubble);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
    return bubble;
  }

  sendSuggestedQuery(text) {
    document.getElementById('fan-chat-input').value = text;
    document.getElementById('fan-chat-form').dispatchEvent(new Event('submit'));
  }

  appendChatBubble(text, sender) {
    const chatMsgs = document.getElementById('fan-chat-messages');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}-message`;
    bubble.innerText = text;
    chatMsgs.appendChild(bubble);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  // Animated text streams
  appendStreamedBubble(text) {
    const chatMsgs = document.getElementById('fan-chat-messages');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot-message';
    chatMsgs.appendChild(bubble);
    
    let i = 0;
    const interval = setInterval(() => {
      bubble.innerText = text.substr(0, i) + '▒';
      i += 3;
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
      if (i >= text.length) {
        clearInterval(interval);
        bubble.innerText = text;
      }
    }, 15);
  }

  // Switch Stadium map overlay paths
  switchMapRoute(type) {
    const stdPath = document.getElementById('route-path-standard');
    const accPath = document.getElementById('route-path-accessible');
    
    document.getElementById('btn-map-standard').classList.remove('active');
    document.getElementById('btn-map-accessible').classList.remove('active');

    if (type === 'standard') {
      stdPath.style.display = 'block';
      accPath.style.display = 'none';
      document.getElementById('btn-map-standard').classList.add('active');
    } else {
      stdPath.style.display = 'none';
      accPath.style.display = 'block';
      document.getElementById('btn-map-accessible').classList.add('active');
    }
  }

  // GreenGoal carbon emission calc
  calculateCarbon() {
    const mode = document.getElementById('transit-method').value;
    const distance = parseFloat(document.getElementById('transit-dist').value) || 0;
    
    let multiplier = 0.41; // single car (lbs/mile)
    if (mode === 'train') multiplier = 0.05;
    if (mode === 'carpool') multiplier = 0.15;
    if (mode === 'flight') multiplier = 0.8;

    const co2 = (distance * multiplier).toFixed(1);
    document.getElementById('carbon-gen').innerText = `${co2} kg CO₂`;

    const icon = document.getElementById('badge-pass-icon');
    if (co2 < 8) {
      document.getElementById('carbon-rank').innerText = 'Gold Eco-Fan';
      document.getElementById('carbon-rank').className = 'block-val text-green';
      icon.innerText = '🔓 Unlock Pass';
      icon.className = 'badge-unlocked';
    } else if (co2 < 25) {
      document.getElementById('carbon-rank').innerText = 'Silver Eco-Fan';
      document.getElementById('carbon-rank').className = 'block-val text-cyan';
      icon.innerText = '🔓 Unlock Pass';
      icon.className = 'badge-unlocked';
    } else {
      document.getElementById('carbon-rank').innerText = 'Standard Fan';
      document.getElementById('carbon-rank').className = 'block-val text-yellow';
      icon.innerText = '🔒 Pass Locked';
      icon.className = 'badge-locked';
    }
  }

  claimEcoBadge() {
    const rank = document.getElementById('carbon-rank').innerText;
    if (rank === 'Standard Fan') {
      this.showToast('Footprint too high! Carbon offset purchase suggested to unlock pass.', 'error');
    } else {
      this.logEvent('info', `SUSTAINABILITY: unlocked digital FIFA Green Fan Pass (${rank})`);
      this.showToast(`Green Fan Pass (${rank}) successfully downloaded to wallet!`, 'success');
    }
  }

  // AI Incident Analyzer form suggestions (Module 2)
  async handleIncidentTextInput(text) {
    const helper = document.getElementById('incident-ai-helper');
    const evalTxt = document.getElementById('incident-ai-eval');
    
    if (text.length < 8) {
      helper.style.display = 'none';
      return;
    }

    let cat = 'facility';
    let sev = 'low';
    let sop = 'Dispatch janitorial team to location. Put safety cones.';

    try {
      const response = await fetch(`${this.apiUrl}/api/incident_sop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text })
      });
      if (!response.ok) throw new Error('API Offline');
      const data = await response.json();
      cat = data.category;
      sev = data.severity;
      sop = data.sop_response;
    } catch (err) {
      // Local fallback logic
      const clean = text.toLowerCase();
      if (clean.includes('hurt') || clean.includes('heart') || clean.includes('bleed') || clean.includes('passed out') || clean.includes('medical')) {
        cat = 'medical';
        sev = 'high';
        sop = 'Secure area immediately. Trigger ambulance dispatch. Direct first aid stewards to coordinates.';
      } else if (clean.includes('fight') || clean.includes('stole') || clean.includes('weapon') || clean.includes('security') || clean.includes('suspicious')) {
        cat = 'security';
        sev = 'high';
        sop = 'Keep safe distance. Monitor suspect. Alert Command Control on Radio Channel 3 for security squad dispatch.';
      } else if (clean.includes('crowd') || clean.includes('congestion') || clean.includes('jam') || clean.includes('bottleneck') || clean.includes('queue')) {
        cat = 'congestion';
        sev = 'medium';
        sop = 'Deploy crowd control volunteers. Guide fans to use alternative Gates A or D. Setup temporary queue ropes.';
      }
    }

    // Set selectors automatically to demonstrate AI decision assist
    document.getElementById('inc-category').value = cat;
    document.getElementById('inc-severity').value = sev;

    evalTxt.innerHTML = `<strong>Category:</strong> ${cat.toUpperCase()} | <strong>Severity:</strong> ${sev.toUpperCase()}<br><strong>Suggested SOP:</strong> ${sop}`;
    helper.style.display = 'block';
  }

  // Handle volunteer incident dispatch submission
  handleIncidentSubmit(e) {
    e.preventDefault();
    const category = document.getElementById('inc-category').value;
    const severity = document.getElementById('inc-severity').value;
    const location = document.getElementById('inc-location').value;
    const description = this.sanitizeInput(document.getElementById('inc-desc').value.trim());

    const newInc = {
      id: 'inc-' + Date.now(),
      category,
      severity,
      location,
      description,
      status: 'pending',
      reported_by: this.session.user || 'Steward',
      timestamp: new Date().toLocaleTimeString().substr(0, 5)
    };

    const incidents = JSON.parse(localStorage.getItem('vgpt_incidents'));
    incidents.unshift(newInc);
    localStorage.setItem('vgpt_incidents', JSON.stringify(incidents));

    this.logEvent('info', `INCIDENT SUBMITTED: Category: ${category}, Severity: ${severity}, Location: ${location}. Details: ${description}`);
    this.showToast('Incident reported & dispatched to Organizer console.', 'success');

    // Reset forms
    document.getElementById('incident-form').reset();
    document.getElementById('incident-ai-helper').style.display = 'none';

    // Highlight location on map in red
    if (location.includes('Gate A')) this.triggerMapIncidentPulse('node-gateA');
    if (location.includes('Gate B')) this.triggerMapIncidentPulse('node-gateB');
    if (location.includes('Gate C')) this.triggerMapIncidentPulse('node-gateC');
    if (location.includes('Gate D')) this.triggerMapIncidentPulse('node-gateD');

    this.syncIncidentBoards();
  }

  triggerMapIncidentPulse(nodeId) {
    const el = document.getElementById(nodeId);
    if (!el) return;
    const circle = el.querySelector('.node-circle');
    circle.classList.remove('status-green', 'status-yellow', 'status-blue');
    circle.classList.add('status-red', 'animate-pulse');
  }

  // Volunteer SOP search (RAG)
  async handleSopSearch(e) {
    e.preventDefault();
    const query = document.getElementById('sop-search-input').value.trim();
    const resBox = document.getElementById('sop-results');
    if (!query) return;

    resBox.innerHTML = '<p class="placeholder-text">Searching SOP index chunks...</p>';

    try {
      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: `volunteer SOP rules for ${query}`, stadium: this.currentStadium })
      });
      
      if (!response.ok) throw new Error('API Offline');
      const data = await response.json();
      resBox.innerHTML = `
        <div class="sop-result-item" style="font-size:0.8rem; line-height:1.4;">
          <h5>📋 Retrieved SOP Guideline (Python RAG)</h5>
          <p>${this.sanitizeOutput(data.response)}</p>
          <small style="color: var(--text-muted); display: block; margin-top: 0.5rem;">Source: ${data.context_source} | Platform: ${data.ai_platform}</small>
        </div>
      `;
    } catch (err) {
      const match = this.simulateRAGSearch(query);
      let out = "No matching Standard Operating Procedure found in base. Contact field coordinator.";
      if (match) {
        out = `<strong>SOP Document: ${match.title}</strong><br><br>${match.content}`;
      }
      resBox.innerHTML = `
        <div class="sop-result-item" style="font-size:0.8rem; line-height:1.4;">
          <h5>📋 Pre-loaded Local SOP Guidelines</h5>
          <p>${out}</p>
        </div>
      `;
    }
  }

  // RAG query for Organizer what-if scenarios (Module 5)
  runScenario(title) {
    const outBox = document.getElementById('scenario-output-box');
    outBox.innerHTML = '<p class="placeholder-text">Simulating scenario risk and routing matrix...</p>';

    let analysis = "";
    if (title.includes('Congestion')) {
      analysis = `<h4>🎯 AI Tactical Response: Gate C Congestion</h4>
      <strong>Risk Index:</strong> Medium-High | <strong>Estimated Resolution:</strong> 15 mins<br><br>
      <strong>Tactical Rerouting Actions:</strong><br>
      1. Trigger ticker update directing fans to Gates A and D.<br>
      2. Reallocate 5 volunteers from Lot C to Gate C ticket lanes to speed ticketing.<br>
      3. Set up physical queue management barricades at Concourse 1 entrance.<br><br>
      <strong>Draft Announcement:</strong> "Attention fans, Gate C is congested. Please use Gate D (3 min walk) or Gate A for fast entrance."`;
      document.getElementById('announce-topic').value = "Redirect fans from Gate C to Gate D due to bottlenecks";
    } else if (title.includes('Storm')) {
      analysis = `<h4>⛈️ AI Tactical Response: Thunderstorm Match Delay</h4>
      <strong>Risk Index:</strong> Critical (Electrical Storm) | <strong>Actions Required:</strong> Safety Shelter Protocol<br><br>
      <strong>Tactical Response:</strong><br>
      1. Initiate PA shelter announcement. Instruct spectators to vacate open seats and move to covered concourses.<br>
      2. Dispatch volunteer crews to Section stairwells to manage crowd backlogs safely.<br>
      3. Lock outer security gates to prevent entry during lightning intervals.<br><br>
      <strong>Evacuation Vector:</strong> Guide spectators from upper bowls to levels 1 & 2 concourses.`;
      document.getElementById('announce-topic').value = "Shelter in place due to thunderstorm match delay";
    } else if (title.includes('Elevator')) {
      analysis = `<h4>♿ AI Tactical Response: Elevator Outage (Section 112)</h4>
      <strong>Risk Index:</strong> High Accessibility impact<br><br>
      <strong>Tactical Response:</strong><br>
      1. Dispatch volunteer stewards to Section 112 to redirect disabled fans.<br>
      2. Deploy auxiliary wheelchair cart shuttle near the North ramp corridor.<br>
      3. Update chatbot knowledge base with elevator downtime data (estimated repairs: 1hr).`;
      document.getElementById('announce-topic').value = "Accessibility elevator near Section 112 is closed. Use North ramp.";
    }

    setTimeout(() => {
      outBox.innerHTML = analysis;
      this.logEvent('info', `AI Copilot scenario resolved: ${title}`);
    }, 1200);
  }

  handleCustomScenarioSubmit(e) {
    e.preventDefault();
    const customInp = document.getElementById('scenario-custom-input');
    const query = this.sanitizeInput(customInp.value.trim());
    if (!query) return;

    const outBox = document.getElementById('scenario-output-box');
    outBox.innerHTML = '<p class="placeholder-text">AI Vectoring custom incident coordinates...</p>';
    
    // Simulate what-if analysis based on keyword mapping
    setTimeout(() => {
      let analysis = `<h4>🎯 AI Custom Response: Analysis of "${query}"</h4>
      <strong>Risk Index:</strong> Medium | <strong>Dispatched Zone:</strong> Concourse Area<br><br>
      <strong>Action Matrix:</strong><br>
      1. Alert nearest stewards to secure the perimeter.<br>
      2. Check Knowledge Base for SOP matching the reported issue.<br>
      3. Draft public notifications and dispatch support teams.`;

      outBox.innerHTML = analysis;
      this.logEvent('info', `AI Copilot scenario resolved: Custom query - ${query}`);
      customInp.value = '';
    }, 1000);
  }

  // GenAI Multilingual Announcement Generator (Module 3)
  generateAnnouncement() {
    const topic = this.sanitizeInput(document.getElementById('announce-topic').value.trim());
    const resGrid = document.getElementById('announcement-drafts-results');
    
    if (!topic) {
      this.showToast('Please enter an announcement topic first!', 'error');
      return;
    }

    resGrid.innerHTML = '<div class="no-items">Drafting multilingual announcements...</div>';

    // Mock AI drafts translated in real-time
    setTimeout(() => {
      const drafts = [
        { lang: 'en 🇺🇸', text: `Attention: ${topic}. Please check directions.` },
        { lang: 'es 🇲🇽', text: `Atención: ${topic}. Por favor revise las direcciones.` },
        { lang: 'fr 🇫🇷', text: `Attention: ${topic}. Veuillez vérifier les directions.` },
        { lang: 'pt 🇧🇷', text: `Atenção: ${topic}. Por favor, verifique as direções.` },
        { lang: 'ar 🇸🇦', text: `تنبيه: ${topic}. يرجى التحقق من الاتجاهات.` },
        { lang: 'de 🇩🇪', text: `Achtung: ${topic}. Bitte überprüfen Sie die Wegbeschreibungen.` }
      ];

      resGrid.innerHTML = drafts.map(d => `
        <div class="draft-box">
          <span class="draft-lang">${d.lang}</span>
          <p class="draft-text" id="draft-text-${d.lang.substr(0, 2)}">${d.text}</p>
        </div>
      `).join('');

      document.getElementById('btn-broadcast-alert').disabled = false;
      this.logEvent('info', `GenAI drafted announcements in 6 languages for topic: "${topic}"`);
    }, 1200);
  }

  // Broadcast alert to main system ticker banner
  broadcastAlert() {
    const lang = this.currentLanguage;
    const textEl = document.getElementById(`draft-text-${lang}`);
    
    let text = "Tournament notice active. Check details.";
    if (textEl) {
      text = textEl.innerText;
    } else {
      const firstBox = document.getElementById('announcement-drafts-results').querySelector('.draft-text');
      if (firstBox) text = firstBox.innerText;
    }

    document.getElementById('system-ticker').innerText = `🚨 Live Broadcast: ${text} | ` + document.getElementById('system-ticker').innerText;
    this.logEvent('warn', `SYSTEM BROADCAST ALERT: "${text}" pushed to stadium ticker.`);
    this.showToast('Announcement broadcasted to public system ticker!', 'success');
  }

  // Sync incident lists
  syncIncidentBoards() {
    const incidents = JSON.parse(localStorage.getItem('vgpt_incidents'));
    
    // 1. Render Organizer Incident Monitor
    const orgList = document.getElementById('organizer-incidents-list');
    if (orgList) {
      if (incidents.length === 0) {
        orgList.innerHTML = '<div class="no-items">No active reported incidents.</div>';
      } else {
        orgList.innerHTML = incidents.map(inc => `
          <div class="incident-card border-${inc.severity}">
            <div class="card-top">
              <span class="incident-badge severity-${inc.severity}">${inc.severity.toUpperCase()}</span>
              <span class="task-meta">${inc.timestamp} | Reported by ${this.sanitizeOutput(inc.reported_by)}</span>
            </div>
            <div class="incident-title">🚨 ${inc.category.toUpperCase()} at ${inc.location}</div>
            <div class="incident-desc">${this.sanitizeOutput(inc.description)}</div>
            <div class="card-top" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top:1px solid rgba(255,255,255,0.03);">
              <span class="task-meta" style="text-transform:uppercase;">Status: <strong>${inc.status}</strong></span>
              <div style="display:flex; gap: 0.25rem;">
                ${inc.status === 'pending' ? `<button class="btn btn-primary btn-small" onclick="app.dispatchTask('${inc.id}')">Assign Task</button>` : ''}
                ${inc.status === 'in-progress' ? `<button class="btn btn-secondary btn-small" onclick="app.resolveIncident('${inc.id}')">Resolve</button>` : ''}
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    // 2. Render Volunteer task cards
    const volList = document.getElementById('volunteer-tasks-list');
    if (volList) {
      const activeTasks = incidents.filter(inc => inc.status === 'in-progress');
      if (activeTasks.length === 0) {
        volList.innerHTML = '<div class="no-items">No active tasks assigned to your station.</div>';
      } else {
        volList.innerHTML = activeTasks.map(task => `
          <div class="task-card">
            <div class="card-top">
              <span class="incident-badge severity-${task.severity}">${task.severity.toUpperCase()}</span>
              <span class="task-meta">${task.timestamp} | Assigned: Concourse Team</span>
            </div>
            <div class="task-title">📌 Action Required: ${task.location}</div>
            <div class="task-desc">${this.sanitizeOutput(task.description)}</div>
            <button class="btn btn-primary btn-small btn-full" onclick="app.resolveIncident('${task.id}')">Mark Task Completed</button>
          </div>
        `).join('');
      }
    }
  }

  dispatchTask(incId) {
    const incidents = JSON.parse(localStorage.getItem('vgpt_incidents'));
    const matched = incidents.find(i => i.id === incId);
    if (matched) {
      matched.status = 'in-progress';
      localStorage.setItem('vgpt_incidents', JSON.stringify(incidents));
      this.logEvent('info', `TASK DISPATCHED: Incident ${incId} assigned to Concourse Volunteer teams.`);
      this.showToast('Volunteer team dispatched to location.', 'success');
      this.syncIncidentBoards();
    }
  }

  resolveIncident(incId) {
    const incidents = JSON.parse(localStorage.getItem('vgpt_incidents'));
    const matched = incidents.find(i => i.id === incId);
    if (matched) {
      matched.status = 'resolved';
      
      // Remove it from active lists or update status
      const cleanList = incidents.filter(i => i.id !== incId);
      localStorage.setItem('vgpt_incidents', JSON.stringify(cleanList));
      
      this.logEvent('info', `INCIDENT RESOLVED: Incident ${incId} status completed by staff.`);
      this.showToast('Incident resolved and cleared from boards.', 'success');

      // Reset map pulse
      if (matched.location.includes('Gate C')) {
        const circle = document.getElementById('node-gateC').querySelector('.node-circle');
        circle.className = 'node-circle status-green';
      }

      this.syncIncidentBoards();
    }
  }

  // Admin users lists
  renderUsersAdmin() {
    const body = document.getElementById('admin-user-table');
    if (!body) return;
    const users = JSON.parse(localStorage.getItem('vgpt_users'));
    body.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td><strong>${this.sanitizeOutput(u.name)}</strong></td>
        <td><span class="user-role-label text-cyan">${u.role}</span></td>
        <td><span class="text-green">● ${u.mfa.toUpperCase()}</span></td>
        <td><span class="font-monospace">${u.role === 'admin' ? 'ALL_ACCESS' : 'ROLE_DISPATCH'}</span></td>
      </tr>
    `).join('');
  }

  // Simulated Telemetry (Sensors fluctuation)
  startLiveTelemetry() {
    setInterval(() => {
      // Fluctuate Occupancy
      const currentOcc = 80 + Math.floor(Math.random() * 16); // 80% to 95%
      document.getElementById('dial-occupancy-val').innerText = `${currentOcc}%`;
      const occCircle = document.getElementById('dial-occupancy');
      // dashoffset calculates 251.2 * (1 - pct)
      occCircle.style.strokeDashoffset = (251.2 * (1 - currentOcc/100)).toFixed(1);

      // Fluctuate Train times
      const currentTrain = 4 + Math.floor(Math.random() * 12); // 4m to 15m
      document.getElementById('dial-transit-val').innerText = `${currentTrain}m`;
      const transCircle = document.getElementById('dial-transit');
      transCircle.style.strokeDashoffset = (251.2 * (1 - currentTrain/20)).toFixed(1); // capped max 20m

      // Randomly print sensor warning logs to simulate firewall/telemetry logging
      if (Math.random() > 0.85) {
        const sensors = {
          metlife: ['Gate A camera index', 'Gate B ticketing turnstiles', 'Parking Lot E occupancy sensor'],
          azteca: ['Gate A main camera', 'Gate B east ticketing', 'Tlalpan parking sensor'],
          bcplace: ['Gate A entry stream', 'Gate B turnstile check', 'Pacific Boulevard Parkade sensor']
        };
        const activeSensors = sensors[this.currentStadium] || sensors.metlife;
        const chosen = activeSensors[Math.floor(Math.random() * activeSensors.length)];
        this.logEvent('info', `Sensor update: ${chosen} reporting operational telemetry fluent.`);
      }
    }, 4000);

    // Bind Announcement Ticker Broadcast trigger
    document.getElementById('btn-broadcast-alert').addEventListener('click', () => this.broadcastAlert());
  }



  async checkBackendConfig() {
    try {
      const response = await fetch(`${this.apiUrl}/api/config`);
      if (response.ok) {
        const data = await response.json();
        this.hasPredefinedKey = data.has_predefined_key;
        if (data.has_predefined_key) {
          this.logEvent('info', 'Predefined backend Gemini API key detected. Gemini AI ready.');
        }
      }
    } catch (err) {
      console.warn("Could not check backend configuration:", err);
    }
  }

  async handleKbFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      this.showToast(`Uploading document '${file.name}' to Python RAG...`, 'info');
      const response = await fetch(`${this.apiUrl}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const res = await response.json();
      this.showToast(res.message, 'success');
      this.logEvent('info', `Admin RAG Action: ${res.message}`);
      
      // Reload documents list in Admin Console
      this.renderAdminDocuments();
    } catch (err) {
      this.logEvent('error', `Failed to upload RAG file: ${err.message}`);
      this.showToast(`Upload failed: ${err.message}. Using client fallback.`, 'error');
      
      // Fallback: simulate dynamic file insertion into local storage vgpt_kb
      this.simulateLocalKbInsertion(file);
    }
  }

  simulateLocalKbInsertion(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const defaultKB = JSON.parse(localStorage.getItem('vgpt_kb') || '[]');
      const newId = `kb-${defaultKB.length + 1}`;
      defaultKB.push({
        id: newId,
        title: file.name,
        keywords: [file.name.toLowerCase().split('.')[0]],
        content: text.slice(0, 1000) // cap size
      });
      localStorage.setItem('vgpt_kb', JSON.stringify(defaultKB));
      this.showToast(`Local browser RAG updated for '${file.name}'.`, 'success');
      this.logEvent('info', `Admin Local Action: Indexed file '${file.name}' inside fallback storage.`);
      this.renderAdminDocuments();
    };
    reader.readAsText(file);
  }

  async renderAdminDocuments() {
    const filesList = document.getElementById('kb-files-list');
    if (!filesList) return;

    try {
      const response = await fetch(`${this.apiUrl}/api/documents`);
      if (!response.ok) throw new Error('Failed to fetch from backend');
      const docs = await response.json();

      if (docs.length === 0) {
        filesList.innerHTML = '<div class="no-items">No indexed documents found in Python RAG backend.</div>';
      } else {
        filesList.innerHTML = docs.map(doc => `
          <div class="kb-file-item">
            <span class="file-type-icon">${doc.filename.split('.').pop().toUpperCase()}</span>
            <div class="file-details">
              <span class="file-name">${this.sanitizeOutput(doc.filename)}</span>
              <span class="file-size">${(doc.size_bytes / 1024).toFixed(1)} KB | ${doc.chunks_count} vector chunks indexed</span>
            </div>
            <span class="file-status text-green" style="color: var(--accent-cyan) !important;">Active (Backend)</span>
          </div>
        `).join('');
      }
    } catch (err) {
      // Fallback: render local localStorage kb documents
      const localKb = JSON.parse(localStorage.getItem('vgpt_kb') || '[]');
      filesList.innerHTML = localKb.map(item => `
        <div class="kb-file-item">
          <span class="file-type-icon">TXT</span>
          <div class="file-details">
            <span class="file-name">${this.sanitizeOutput(item.title)}</span>
            <span class="file-size">${item.content.length} characters | 1 local chunk</span>
          </div>
          <span class="file-status text-green">Active (Local)</span>
        </div>
      `).join('');
    }
  }

  startLiveMatchPolling() {
    this.updateLiveScores();
    // Poll every 10 seconds for match score and timeline updates
    setInterval(() => this.updateLiveScores(), 10000);
  }

  async updateLiveScores() {
    const usaVal = document.getElementById('score-usa');
    const engVal = document.getElementById('score-eng');
    const timeVal = document.getElementById('score-time');
    const timelineVal = document.getElementById('score-timeline');
    const badgeVal = document.getElementById('live-indicator-badge');
    const stadiumVal = document.getElementById('score-stadium');
    const attendanceVal = document.getElementById('score-attendance');

    if (!usaVal || !engVal || !timeVal || !timelineVal) return;

    try {
      const activeStadium = this.currentStadium || 'metlife';
      const response = await fetch(`${this.apiUrl}/api/scores?stadium=${activeStadium}`);
      if (!response.ok) throw new Error('API Offline');
      const data = await response.json();

      const fix = data.fixture;
      usaVal.innerText = fix.home_score;
      engVal.innerText = fix.away_score;
      timeVal.innerText = fix.elapsed;

      const homeTeamEl = document.getElementById('team-home');
      const awayTeamEl = document.getElementById('team-away');
      if (homeTeamEl) homeTeamEl.innerText = fix.home;
      if (awayTeamEl) awayTeamEl.innerText = fix.away === "England" ? "ENG" : (fix.away === "Argentina" ? "ARG" : (fix.away === "France" ? "FRA" : fix.away));

      if (stadiumVal && fix.stadium) {
        stadiumVal.innerText = `🏟️ ${fix.stadium}`;
      }
      if (attendanceVal && fix.attendance) {
        attendanceVal.innerText = `👥 Attendance: ${fix.attendance}`;
      }

      if (fix.status === 'Finished') {
        if (badgeVal) {
          badgeVal.innerText = 'FT';
          badgeVal.style.background = 'var(--text-muted)';
          badgeVal.style.animation = 'none';
        }
      } else {
        if (badgeVal) {
          badgeVal.innerText = 'LIVE';
          badgeVal.style.background = 'var(--accent-red)';
        }
      }

      if (data.timeline && data.timeline.length > 0) {
        timelineVal.innerHTML = data.timeline.map(ev => {
          let emoji = '⚽';
          let colorClass = '';
          if (ev.type === 'Yellow Card') {
            emoji = '🟨';
            colorClass = 'style="color: var(--accent-yellow);"';
          } else if (ev.type === 'Red Card') {
            emoji = '🟥';
            colorClass = 'style="color: var(--accent-red);"';
          } else {
            colorClass = 'style="color: var(--accent-cyan); font-weight: bold;"';
          }
          return `
            <div class="timeline-event-item" style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.35rem;">
              <span style="font-family: var(--font-family-mono); color: var(--text-muted); min-width: 25px;">${ev.minute}'</span>
              <span>${emoji}</span>
              <div style="flex-grow: 1;">
                <span ${colorClass}>${this.sanitizeOutput(ev.player)} (${ev.team})</span>
                <span style="color: var(--text-secondary); display: block; font-size: 0.7rem;">${this.sanitizeOutput(ev.detail)}</span>
              </div>
            </div>
          `;
        }).join('');
      } else {
        timelineVal.innerHTML = '<p class="placeholder-text" style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">No events occurred yet.</p>';
      }
    } catch (err) {
      // Offline fallback: simulate offline mock timeline
      usaVal.innerText = '0';
      engVal.innerText = '0';
      timeVal.innerText = 'Gates Closed';
      if (stadiumVal) stadiumVal.innerText = '🏟️ Stadium Offline';
      if (attendanceVal) attendanceVal.innerText = '👥 Attendance: N/A';
      if (badgeVal) {
        badgeVal.innerText = 'UPCOMING';
        badgeVal.style.background = 'var(--text-muted)';
        badgeVal.style.animation = 'none';
      }
      timelineVal.innerHTML = '<p class="placeholder-text" style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">Timeline matches offline. Start Python server.</p>';
    }
  }
}

// Global App reference
window.app = new ArenaMindApp();
