/* ========================================
   MASRI DENTAL CLINIC - ENHANCED APP
   Powerful | Modern | Professional
   ======================================== */

// ==============================
// APP INITIALIZATION
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the app
    App.init();
});

// ==============================
// MAIN APP OBJECT
// ==============================
const App = {
    // App state
    state: {
        currentTab: 'dashboard',
        selectedTooth: null,
        patients: [],
        appointments: [],
        prescriptions: [],
        teethChart: {},
        stats: {
            totalPatients: 0,
            todayAppointments: 0,
            completedToday: 0,
            pendingAppointments: 0
        }
    },

    // Initialize the app
    init() {
        this.loadData();
        this.initHeader();
        this.initNavigation();
        this.initTeethChart();
        this.initDashboard();
        this.initPatients();
        this.initAppointments();
        this.initPrescriptions();
        this.initSettings();
        this.initSidebar();
        this.updateDate();
        this.updateStats();
        this.animateStats();
    },

    // ==============================
    // HEADER FUNCTIONS
    // ==============================
    initHeader() {
        // Mobile nav toggle
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });
        }

        // Global search
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
    },

    // ==============================
    // NAVIGATION FUNCTIONS
    // ==============================
    initNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = link.dataset.tab;
                this.switchTab(tabId);
                
                // Update active state
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
    },

    switchTab(tabId) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected tab
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
            selectedTab.classList.add('active');
            this.state.currentTab = tabId;
        }
    },

    // ==============================
    // TEETH CHART FUNCTIONS
    // ==============================
    initTeethChart() {
        this.generateTeeth();
        this.initToothDetails();
        this.initTeethActions();
    },

    generateTeeth() {
        const upperTeeth = document.getElementById('upperTeeth');
        const lowerTeeth = document.getElementById('lowerTeeth');
        
        if (!upperTeeth || !lowerTeeth) return;

        // Upper jaw teeth (right to left)
        const upperNumbers = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
        // Lower jaw teeth (right to left)
        const lowerNumbers = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

        // Generate upper teeth
        upperTeeth.innerHTML = '';
        upperNumbers.forEach(num => {
            const tooth = this.createToothElement(num);
            upperTeeth.appendChild(tooth);
        });

        // Generate lower teeth
        lowerTeeth.innerHTML = '';
        lowerNumbers.forEach(num => {
            const tooth = this.createToothElement(num);
            lowerTeeth.appendChild(tooth);
        });

        // Apply saved conditions
        this.applyTeethConditions();
    },

    createToothElement(number) {
        const tooth = document.createElement('div');
        tooth.className = 'tooth';
        tooth.dataset.number = number;
        tooth.innerHTML = `<span>${number}</span>`;
        
        tooth.addEventListener('click', () => {
            this.selectTooth(tooth, number);
        });

        tooth.addEventListener('mouseenter', () => {
            this.showToothTooltip(tooth, number);
        });

        return tooth;
    },

    selectTooth(toothElement, number) {
        // Remove previous selection
        document.querySelectorAll('.tooth').forEach(t => {
            t.classList.remove('selected');
        });

        // Add selection
        toothElement.classList.add('selected');
        this.state.selectedTooth = number;

        // Show details panel
        this.showToothDetails(number);
    },

    showToothDetails(number) {
        const panel = document.getElementById('toothDetailsPanel');
        const toothNumber = document.getElementById('selectedToothNumber');
        
        if (panel && toothNumber) {
            toothNumber.textContent = number;
            panel.classList.add('active');
            
            // Load existing condition
            const condition = this.state.teethChart[number];
            if (condition) {
                this.selectCondition(condition.condition);
                document.getElementById('toothNotes').value = condition.notes || '';
            } else {
                this.selectCondition('healthy');
                document.getElementById('toothNotes').value = '';
            }
        }
    },

    showToothTooltip(tooth, number) {
        const condition = this.state.teethChart[number];
        const status = condition ? condition.condition : 'Healthy';
        
        tooth.title = `Tooth #${number}\nCondition: ${status}`;
    },

    initToothDetails() {
        // Condition buttons
        const conditionButtons = document.querySelectorAll('.condition-btn');
        
        conditionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const condition = btn.dataset.condition;
                this.selectCondition(condition);
            });
        });

        // Close panel
        const closeBtn = document.getElementById('closeToothPanel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const panel = document.getElementById('toothDetailsPanel');
                if (panel) panel.classList.remove('active');
            });
        }
    },

    selectCondition(condition) {
        // Update UI
        document.querySelectorAll('.condition-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.condition === condition) {
                btn.classList.add('active');
            }
        });

        // Apply to selected tooth
        if (this.state.selectedTooth) {
            const toothElement = document.querySelector(`.tooth[data-number="${this.state.selectedTooth}"]`);
            
            // Remove all condition classes
            toothElement.classList.remove(
                'healthy', 'cavity', 'filling', 'crown', 
                'extraction', 'implant', 'root-canal', 'missing'
            );
            
            // Add new condition
            toothElement.classList.add(condition);
            
            // Save to state
            const notes = document.getElementById('toothNotes')?.value || '';
            this.state.teethChart[this.state.selectedTooth] = {
                condition: condition,
                notes: notes,
                updatedAt: new Date().toISOString()
            };
        }
    },

    initTeethActions() {
        // Save teeth chart
        const saveBtn = document.getElementById('saveTeeth');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveTeethChart();
            });
        }

        // Clear teeth
        const clearBtn = document.getElementById('clearTeeth');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearTeethChart();
            });
        }
    },

    saveTeethChart() {
        localStorage.setItem('masriTeethChart', JSON.stringify(this.state.teethChart));
        this.showNotification('Dental chart saved successfully!', 'success');
    },

    clearTeethChart() {
        if (confirm('Are you sure you want to clear the dental chart?')) {
            this.state.teethChart = {};
            
            // Reset all teeth
            document.querySelectorAll('.tooth').forEach(tooth => {
                tooth.classList.remove(
                    'healthy', 'cavity', 'filling', 'crown', 
                    'extraction', 'implant', 'root-canal', 'missing'
                );
            });
            
            this.showNotification('Dental chart cleared!', 'success');
        }
    },

    applyTeethConditions() {
        Object.entries(this.state.teethChart).forEach(([number, data]) => {
            const tooth = document.querySelector(`.tooth[data-number="${number}"]`);
            if (tooth && data.condition) {
                tooth.classList.add(data.condition);
            }
        });
    },

    // ==============================
    // DASHBOARD FUNCTIONS
    // ==============================
    initDashboard() {
        // Quick actions
        document.getElementById('quickAddPatient')?.addEventListener('click', () => {
            this.switchTab('patients');
            document.getElementById('addPatientBtn')?.click();
        });

        document.getElementById('quickNewAppointment')?.addEventListener('click', () => {
            this.switchTab('appointments');
            document.getElementById('addAppointmentBtn')?.click();
        });

        document.getElementById('quickPrescription')?.addEventListener('click', () => {
            this.switchTab('prescriptions');
            document.getElementById('addPrescriptionBtn')?.click();
        });
    },

    updateDate() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    },

    updateStats() {
        // Load data
        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
        const appointments = JSON.parse(localStorage.getItem('masriAppointments') || '[]');
        
        // Calculate stats
        const today = new Date().toDateString();
        const todayAppts = appointments.filter(a => new Date(a.date).toDateString() === today);
        const completedToday = todayAppts.filter(a => a.status === 'completed').length;
        const pendingToday = todayAppts.filter(a => a.status === 'pending').length;

        // Update state
        this.state.stats = {
            totalPatients: patients.length,
            todayAppointments: todayAppts.length,
            completedToday: completedToday,
            pendingAppointments: pendingToday
        };

        // Update DOM
        document.getElementById('totalPatients').textContent = patients.length;
        document.getElementById('todayAppointments').textContent = todayAppts.length;
        document.getElementById('completedToday').textContent = completedToday;
        document.getElementById('pendingAppointments').textContent = pendingToday;
    },

    animateStats() {
        // Animate numbers
        const statNumbers = document.querySelectorAll('.stat-number');
        
        statNumbers.forEach(stat => {
            const target = parseInt(stat.textContent) || 0;
            let current = 0;
            const increment = target / 20;
            
            const animate = () => {
                if (current < target) {
                    current += increment;
                    stat.textContent = Math.floor(current);
                    requestAnimationFrame(animate);
                } else {
                    stat.textContent = target;
                }
            };
            
            animate();
        });
    },

    // ==============================
    // PATIENTS FUNCTIONS
    // ==============================
    initPatients() {
        // Add patient button
        document.getElementById('addPatientBtn')?.addEventListener('click', () => {
            this.showAddPatientModal();
        });

        // Load patients
        this.renderPatients();
    },

    renderPatients() {
        const tbody = document.getElementById('patientsTableBody');
        if (!tbody) return;

        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
        
        if (patients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                        <p>No patients yet. Add your first patient!</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = patients.map((patient, index) => `
            <tr>
                <td><input type="checkbox"></td>
                <td>#${String(patient.id).padStart(4, '0')}</td>
                <td>
                    <div class="patient-name-cell">
                        <div class="patient-avatar-small">${patient.name.charAt(0)}</div>
                        <span>${patient.name}</span>
                    </div>
                </td>
                <td>${patient.age}</td>
                <td>${patient.phone}</td>
                <td>${patient.email}</td>
                <td>${patient.lastVisit || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="App.viewPatient(${patient.id})" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="App.editPatient(${patient.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="App.deletePatient(${patient.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    showAddPatientModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> Add New Patient</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="addPatientForm">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Full Name *</label>
                                <input type="text" id="patientName" required placeholder="Enter full name">
                            </div>
                            <div class="form-group">
                                <label>Age *</label>
                                <input type="number" id="patientAge" required placeholder="Enter age">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Phone *</label>
                                <input type="tel" id="patientPhone" required placeholder="+1 234 567 8900">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" id="patientEmail" placeholder="email@example.com">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Address</label>
                            <textarea id="patientAddress" placeholder="Enter address"></textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Gender</label>
                                <select id="patientGender">
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Blood Type</label>
                                <select id="patientBlood">
                                    <option value="">Unknown</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Medical History</label>
                            <textarea id="patientMedical" placeholder="Any allergies or medical conditions..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Cancel</button>
                    <button class="btn btn-primary" id="savePatientBtn">
                        <i class="fas fa-save"></i> Save Patient
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal events
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Save patient
        document.getElementById('savePatientBtn')?.addEventListener('click', () => {
            this.savePatient();
        });
    },

    savePatient() {
        const name = document.getElementById('patientName').value;
        const age = document.getElementById('patientAge').value;
        const phone = document.getElementById('patientPhone').value;
        const email = document.getElementById('patientEmail').value;
        const address = document.getElementById('patientAddress').value;
        const gender = document.getElementById('patientGender').value;
        const blood = document.getElementById('patientBlood').value;
        const medical = document.getElementById('patientMedical').value;

        // Validation
        if (!name || !age || !phone) {
            this.showNotification('Please fill in all required fields!', 'error');
            return;
        }

        // Get existing patients
        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');

        // Create new patient
        const newPatient = {
            id: Date.now(),
            name: name,
            age: age,
            phone: phone,
            email: email,
            address: address,
            gender: gender,
            blood: blood,
            medical: medical,
            createdAt: new Date().toISOString(),
            lastVisit: new Date().toLocaleDateString()
        };

        // Save to localStorage
        patients.push(newPatient);
        localStorage.setItem('masriPatients', JSON.stringify(patients));

        // Close modal
        document.querySelector('.modal-overlay')?.remove();

        // Refresh patients list
        this.renderPatients();
        this.updateStats();

        this.showNotification('Patient added successfully!', 'success');
    },

    viewPatient(id) {
        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
        const patient = patients.find(p => p.id === id);
        
        if (!patient) return;

        // Show in sidebar
        this.showPatientSidebar(patient);
    },

    editPatient(id) {
        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
        const patient = patients.find(p => p.id === id);
        
        if (!patient) return;

        // Show edit modal (similar to add patient modal but pre-filled)
        this.showAddPatientModal();
        
        // Pre-fill form
        setTimeout(() => {
            document.getElementById('patientName').value = patient.name;
            document.getElementById('patientAge').value = patient.age;
            document.getElementById('patientPhone').value = patient.phone;
            document.getElementById('patientEmail').value = patient.email || '';
            document.getElementById('patientAddress').value = patient.address || '';
            document.getElementById('patientGender').value = patient.gender || 'male';
            document.getElementById('patientBlood').value = patient.blood || '';
            document.getElementById('patientMedical').value = patient.medical || '';
        }, 100);

        // Store ID for update
        this.editingPatientId = id;
    },

    deletePatient(id) {
        if (confirm('Are you sure you want to delete this patient?')) {
            const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
            const filtered = patients.filter(p => p.id !== id);
            
            localStorage.setItem('masriPatients', JSON.stringify(filtered));
            this.renderPatients();
            this.updateStats();
            
            this.showNotification('Patient deleted!', 'success');
        }
    },

    // ==============================
    // APPOINTMENTS FUNCTIONS
    // ==============================
    initAppointments() {
        document.getElementById('addAppointmentBtn')?.addEventListener('click', () => {
            this.showAddAppointmentModal();
        });

        this.renderAppointments();
    },

    renderAppointments() {
        const grid = document.getElementById('appointmentsGrid');
        if (!grid) return;

        const appointments = JSON.parse(localStorage.getItem('masriAppointments') || '[]');
        const today = new Date().toDateString();

        // Sort by date
        appointments.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (appointments.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-check"></i>
                    <h3>No Appointments</h3>
                    <p>Schedule your first appointment!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = appointments.map(apt => `
            <div class="appointment-card ${apt.status}">
                <div class="appointment-time">
                    <span class="time">${apt.time}</span>
                    <span class="date">${apt.date}</span>
                </div>
                <div class="appointment-info">
                    <h4>${apt.patientName}</h4>
                    <p class="treatment">${apt.treatment}</p>
                    <p class="notes">${apt.notes || 'No notes'}</p>
                </div>
                <div class="appointment-status">
                    <span class="status-badge ${apt.status}">${apt.status}</span>
                </div>
                <div class="appointment-actions">
                    <button class="action-btn" onclick="App.completeAppointment(${apt.id})" title="Complete">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-btn" onclick="App.cancelAppointment(${apt.id})" title="Cancel">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    showAddAppointmentModal() {
        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
        
        if (patients.length === 0) {
            this.showNotification('Please add a patient first!', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3><i class="fas fa-calendar-plus"></i> New Appointment</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="addAppointmentForm">
                        <div class="form-group">
                            <label>Patient *</label>
                            <select id="appointmentPatient" required>
                                <option value="">Select Patient</option>
                                ${patients.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Date *</label>
                                <input type="date" id="appointmentDate" required>
                            </div>
                            <div class="form-group">
                                <label>Time *</label>
                                <input type="time" id="appointmentTime" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Treatment *</label>
                            <select id="appointmentTreatment" required>
                                <option value="">Select Treatment</option>
                                <option value="Check-up">Check-up</option>
                                <option value="Cleaning">Cleaning</option>
                                <option value="Filling">Filling</option>
                                <option value="Extraction">Extraction</option>
                                <option value="Root Canal">Root Canal</option>
                                <option value="Crown">Crown</option>
                                <option value="Implant">Implant</option>
                                <option value="Whitening">Whitening</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="appointmentNotes" placeholder="Additional notes..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Cancel</button>
                    <button class="btn btn-primary" id="saveAppointmentBtn">
                        <i class="fas fa-save"></i> Schedule
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.getElementById('saveAppointmentBtn')?.addEventListener('click', () => {
            this.saveAppointment();
        });
    },

    saveAppointment() {
        const patientId = parseInt(document.getElementById('appointmentPatient').value);
        const date = document.getElementById('appointmentDate').value;
        const time = document.getElementById('appointmentTime').value;
        const treatment = document.getElementById('appointmentTreatment').value;
        const notes = document.getElementById('appointmentNotes').value;

        if (!patientId || !date || !time || !treatment) {
            this.showNotification('Please fill in all required fields!', 'error');
            return;
        }

        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
        const patient = patients.find(p => p.id === patientId);

        const appointments = JSON.parse(localStorage.getItem('masriAppointments') || '[]');
        
        const newAppointment = {
            id: Date.now(),
            patientId: patientId,
            patientName: patient?.name || 'Unknown',
            date: date,
            time: time,
            treatment: treatment,
            notes: notes,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        appointments.push(newAppointment);
        localStorage.setItem('masriAppointments', JSON.stringify(appointments));

        document.querySelector('.modal-overlay')?.remove();
        this.renderAppointments();
        this.updateStats();

        this.showNotification('Appointment scheduled!', 'success');
    },

    completeAppointment(id) {
        const appointments = JSON.parse(localStorage.getItem('masriAppointments') || '[]');
        const apt = appointments.find(a => a.id === id);
        
        if (apt) {
            apt.status = 'completed';
            localStorage.setItem('masriAppointments', JSON.stringify(appointments));
            this.renderAppointments();
            this.updateStats();
            
            this.showNotification('Appointment completed!', 'success');
        }
    },

    cancelAppointment(id) {
        if (confirm('Cancel this appointment?')) {
            const appointments = JSON.parse(localStorage.getItem('masriAppointments') || '[]');
            const filtered = appointments.filter(a => a.id !== id);
            
            localStorage.setItem('masriAppointments', JSON.stringify(filtered));
            this.renderAppointments();
            this.updateStats();
            
            this.showNotification('Appointment cancelled!', 'success');
        }
    },

    // ==============================
    // PRESCRIPTIONS FUNCTIONS
    // ==============================
    initPrescriptions() {
        document.getElementById('addPrescriptionBtn')?.addEventListener('click', () => {
            this.showAddPrescriptionModal();
        });

        this.renderPrescriptions();
    },

    renderPrescriptions() {
        const list = document.getElementById('prescriptionsList');
        if (!list) return;

        const prescriptions = JSON.parse(localStorage.getItem('masriPrescriptions') || '[]');

        if (prescriptions.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-prescription"></i>
                    <h3>No Prescriptions</h3>
                    <p>Write your first prescription!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = prescriptions.map(rx => `
            <div class="prescription-card">
                <div class="prescription-header">
                    <h4>${rx.patientName}</h4>
                    <span class="date">${rx.date}</span>
                </div>
                <div class="prescription-body">
                    <p><strong>Treatment:</strong> ${rx.treatment}</p>
                    <p><strong>Medications:</strong></p>
                    <ul>${rx.medications.map(m => `<li>${m}</li>`).join('')}</ul>
                </div>
                <div class="prescription-footer">
                    <button class="btn btn-secondary btn-sm" onclick="App.printPrescription(${rx.id})">
                        <i class="fas fa-print"></i> Print
                    </button>
                </div>
            </div>
        `).join('');
    },

    showAddPrescriptionModal() {
        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3><i class="fas fa-prescription"></i> New Prescription</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="addPrescriptionForm">
                        <div class="form-group">
                            <label>Patient *</label>
                            <select id="prescriptionPatient" required>
                                <option value="">Select Patient</option>
                                ${patients.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Treatment</label>
                            <input type="text" id="prescriptionTreatment" placeholder="Diagnosis/Treatment">
                        </div>
                        <div class="form-group">
                            <label>Medications (one per line)</label>
                            <textarea id="prescriptionMedications" rows="6" placeholder="Amoxicillin 500mg - 3 times daily&#10;Ibuprofen 400mg - when needed"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Instructions</label>
                            <textarea id="prescriptionInstructions" rows="3" placeholder="Additional instructions..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Cancel</button>
                    <button class="btn btn-primary" id="savePrescriptionBtn">
                        <i class="fas fa-save"></i> Save
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-cancel').addEventListener('click', () => modal.remove());

        document.getElementById('savePrescriptionBtn')?.addEventListener('click', () => {
            this.savePrescription();
        });
    },

    savePrescription() {
        const patientId = parseInt(document.getElementById('prescriptionPatient').value);
        const treatment = document.getElementById('prescriptionTreatment').value;
        const medicationsText = document.getElementById('prescriptionMedications').value;
        const instructions = document.getElementById('prescriptionInstructions').value;

        if (!patientId || !medicationsText) {
            this.showNotification('Please fill required fields!', 'error');
            return;
        }

        const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
        const patient = patients.find(p => p.id === patientId);

        const medications = medicationsText.split('\n').filter(m => m.trim());

        const prescriptions = JSON.parse(localStorage.getItem('masriPrescriptions') || '[]');
        
        const newPrescription = {
            id: Date.now(),
            patientId: patientId,
            patientName: patient?.name || 'Unknown',
            treatment: treatment,
            medications: medications,
            instructions: instructions,
            date: new Date().toLocaleDateString(),
            createdAt: new Date().toISOString()
        };

        prescriptions.push(newPrescription);
        localStorage.setItem('masriPrescriptions', JSON.stringify(prescriptions));

        document.querySelector('.modal-overlay')?.remove();
        this.renderPrescriptions();

        this.showNotification('Prescription saved!', 'success');
    },

    printPrescription(id) {
        const prescriptions = JSON.parse(localStorage.getItem('masriPrescriptions') || '[]');
        const rx = prescriptions.find(r => r.id === id);
        
        if (!rx) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Prescription - ${rx.patientName}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    h1 { text-align: center; color: #00d4aa; }
                    .header { text-align: center; margin-bottom: 40px; }
                    .patient { margin: 20px 0; font-size: 18px; }
                    . medications { margin: 20px 0; }
                    .medications li { margin: 10px 0; }
                    .footer { margin-top: 40px; text-align: right; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🦷 Masri Dental Clinic</h1>
                </div>
                <div class="patient">
                    <p><strong>Patient:</strong> ${rx.patientName}</p>
                    <p><strong>Date:</strong> ${rx.date}</p>
                    <p><strong>Treatment:</strong> ${rx.treatment}</p>
                </div>
                <div class="medications">
                    <h3>Medications:</h3>
                    <ul>${rx.medications.map(m => `<li>${m}</li>`).join('')}</ul>
                </div>
                <div class="footer">
                    <p>Doctor Signature</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    },

    // ==============================
    // SETTINGS FUNCTIONS
    // ==============================
    initSettings() {
        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('
              // Theme toggle
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const theme = btn.dataset.theme;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('masriTheme', theme);
    });

    // Data export/import
    document.getElementById('exportData')?.addEventListener('click', () => {
        this.exportData();
    });

    document.getElementById('importData')?.addEventListener('click', () => {
        this.importData();
    });

    document.getElementById('clearAllData')?.addEventListener('click', () => {
        this.clearAllData();
    });

    // Load saved settings
    const savedTheme = localStorage.getItem('masriTheme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === savedTheme) {
                btn.classList.add('active');
            }
        });
    }
},

exportData() {
    const data = {
        patients: localStorage.getItem('masriPatients'),
        appointments: localStorage.getItem('masriAppointments'),
        prescriptions: localStorage.getItem('masriPrescriptions'),
        teethChart: localStorage.getItem('masriTeethChart'),
        settings: localStorage.getItem('masriSettings'),
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `masri-dental-backup-${new Date().toDateString()}.json`;
    a.click();

    this.showNotification('Data exported successfully!', 'success');
},

importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                if (data.patients) localStorage.setItem('masriPatients', data.patients);
                if (data.appointments) localStorage.setItem('masriAppointments', data.appointments);
                if (data.prescriptions) localStorage.setItem('masriPrescriptions', data.prescriptions);
                if (data.teethChart) localStorage.setItem('masriTeethChart', data.teethChart);
                if (data.settings) localStorage.setItem('masriSettings', data.settings);

                // Refresh app
                this.loadData();
                this.init();

                this.showNotification('Data imported successfully!', 'success');
            } catch (error) {
                this.showNotification('Invalid file format!', 'error');
            }
        };
        
        reader.readAsText(file);
    });
    
    input.click();
},

clearAllData() {
    if (confirm('⚠️ Are you sure you want to delete ALL data? This cannot be undone!')) {
        if (confirm('Really? All patients, appointments, and prescriptions will be deleted!')) {
            localStorage.removeItem('masriPatients');
            localStorage.removeItem('masriAppointments');
            localStorage.removeItem('masriPrescriptions');
            localStorage.removeItem('masriTeethChart');
            
            this.loadData();
            this.init();
            
            this.showNotification('All data cleared!', 'success');
        }
    }
},

// ==============================
// SIDEBAR FUNCTIONS
// ==============================
initSidebar() {
    document.getElementById('closeSidebar')?.addEventListener('click', () => {
        this.closePatientSidebar();
    });
},

showPatientSidebar(patient) {
    const sidebar = document.getElementById('patientSidebar');
    if (!sidebar) return;

    // Populate data
    document.getElementById('sidebarPatientName').textContent = patient.name;
    document.getElementById('sidebarPatientId').textContent = `ID: #${String(patient.id).padStart(4, '0')}`;
    document.getElementById('sidebarPatientAge').textContent = patient.age;
    
    // Show sidebar
    sidebar.classList.add('active');
},

closePatientSidebar() {
    const sidebar = document.getElementById('patientSidebar');
    if (sidebar) {
        sidebar.classList.remove('active');
    }
},

// ==============================
// DATA FUNCTIONS
// ==============================
loadData() {
    // Load from localStorage
    this.state.patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
    this.state.appointments = JSON.parse(localStorage.getItem('masriAppointments') || '[]');
    this.state.prescriptions = JSON.parse(localStorage.getItem('masriPrescriptions') || '[]');
    this.state.teethChart = JSON.parse(localStorage.getItem('masriTeethChart') || '{}');
    
    // Add demo data if empty
    if (this.state.patients.length === 0) {
        this.addDemoData();
    }
},

addDemoData() {
    // Demo patients
    const demoPatients = [
        { id: 17001, name: 'Ahmed Hassan', age: 35, phone: '+20 100 123 4567', email: 'ahmed@mail.com', lastVisit: '2024-01-15' },
        { id: 17002, name: 'Sara Mohamed', age: 28, phone: '+20 100 234 5678', email: 'sara@mail.com', lastVisit: '2024-01-14' },
        { id: 17003, name: 'Omar Ali', age: 42, phone: '+20 100 345 6789', email: 'omar@mail.com', lastVisit: '2024-01-13' },
        { id: 17004, name: 'Fatima Ahmed', age: 31, phone: '+20 100 456 7890', email: 'fatima@mail.com', lastVisit: '2024-01-12' },
        { id: 17005, name: 'Youssef Ibrahim', age: 45, phone: '+20 100 567 8901', email: 'youssef@mail.com', lastVisit: '2024-01-11' }
    ];

    localStorage.setItem('masriPatients', JSON.stringify(demoPatients));

    // Demo appointments
    const today = new Date();
    const demoAppointments = [
        { id: 1, patientId: 17001, patientName: 'Ahmed Hassan', date: today.toISOString().split('T')[0], time: '09:00', treatment: 'Check-up', status: 'pending' },
        { id: 2, patientId: 17002, patientName: 'Sara Mohamed', date: today.toISOString().split('T')[0], time: '10:30', treatment: 'Cleaning', status: 'pending' },
        { id: 3, patientId: 17003, patientName: 'Omar Ali', date: today.toISOString().split('T')[0], time: '14:00', treatment: 'Filling', status: 'completed' }
    ];

    localStorage.setItem('masriAppointments', JSON.stringify(demoAppointments));

    // Reload
    this.state.patients = demoPatients;
    this.state.appointments = demoAppointments;
}

// ==============================
// HELPER FUNCTIONS
// ==============================
handleSearch(query) {
    if (!query || query.length < 2) return;

    const patients = JSON.parse(localStorage.getItem('masriPatients') || '[]');
    const filtered = patients.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.phone.includes(query) ||
        p.email.toLowerCase().includes(query.toLowerCase())
    );

    // Show results
    if (filtered.length > 0) {
        this.switchTab('patients');
        this.renderFilteredPatients(filtered);
    }
},

renderFilteredPatients(patients) {
    const tbody = document.getElementById('patientsTableBody');
    if (!tbody) return;

    tbody.innerHTML = patients.map(patient => `
        <tr>
            <td><input type="checkbox"></td>
            <td>#${String(patient.id).padStart(4, '0')}</td>
            <td>
                <div class="patient-name-cell">
                    <div class="patient-avatar-small">${patient.name.charAt(0)}</div>
                    <span>${patient.name}</span>
                </div>
            </td>
            <td>${patient.age}</td>
            <td>${patient.phone}</td>
            <td>${patient.email}</td>
            <td>${patient.lastVisit || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="App.viewPatient(${patient.id})"><i class="fas fa-eye"></i></button>
                    <button class="action-btn edit" onclick="App.editPatient(${patient.id})"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="App.deletePatient(${patient.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
},

showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    // Show animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto hide
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
};

// ==============================
// PWA SERVICE WORKER
// ==============================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => {
        console.log('Service Worker registered!');
    });
}

// ==============================
// KEYBOARD SHORTCUTS
// ==============================
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        App.saveTeethChart();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        document.querySelector('.modal-overlay')?.remove();
        App.closePatientSidebar();
    }
});

// ==============================
// MAKE APP GLOBAL
// ==============================
window.App = App;                                                                                  
