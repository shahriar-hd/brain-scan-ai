// DOM Elements
let user = '{{ user|tojson|safe }}';
let recentScans = '{{ recent_scans|tojson|safe }}';
let chatHistory = '{{ chat_history|tojson|safe }}';
let medicalRecords = '{{ medical_records|tojson|safe }}';
const user_id = user.id;
let scan_id = recentScans[0].id;

document.addEventListener('DOMContentLoaded', async () => {
    // Function calls to render the initial data on page load
    user = await updateUserInfo();
    recentScans = await updateUserScan();
    chatHistory = await updateUserChat();
    renderUserProfile(user);
    renderRecentScans(recentScans);
    renderChatHistory(chatHistory);
    renderMedicalRecords();

    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const sectionOptions = document.querySelectorAll('.section-option');
    const contentSections = document.querySelectorAll('.content-section');
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    const chatContainer = document.querySelector('.chat-container');
    const closeInfoBtn = document.querySelector('.close-info-btn');
    const showInfoBtn = document.querySelector('.attachment-btn.show-info-btn');
    const uploadBtn = document.getElementById('scan-upload-button');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const calendarDays = document.querySelectorAll('.day-num:not(.disabled)');
    const timeSlots = document.querySelectorAll('.time-slot:not(.booked)');
    const sendBtn = document.querySelector('.send-btn');
    const chatTextarea = document.querySelector('.chat-textarea');
    const profileBtn = document.getElementById('save-profile-change');
    const profileErr = document.getElementById('profile-save-error');
    const passwordBtn = document.getElementById('update-password-btn');
    const passwordErr = document.getElementById('update-password-error');
    const profilePhotoInp = document.getElementById('profile-photo-update');
    // Initialize chat container with info panel shown
    if (chatContainer) {
        chatContainer.classList.add('show-info');
        
        // Close info panel button
        if (closeInfoBtn) {
            closeInfoBtn.addEventListener('click', () => {
                chatContainer.classList.remove('show-info');
            });
        }
        
        // Show info panel button
        if (showInfoBtn) {
            showInfoBtn.addEventListener('click', () => {
                chatContainer.classList.add('show-info');
            });
        }
    }

    // Theme Toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-theme');
            if (body.classList.contains('dark-theme')) {
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        });
    }
    
    if (sectionOptions) {
        // Section Navigation
        sectionOptions.forEach(option => {
            option.addEventListener('click', () => {
                const section = option.getAttribute('data-section');
                
                // Update active section option
                sectionOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                // Show corresponding content section
                contentSections.forEach(content => {
                    if (content.id === section) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });
            });
        });
    }
    
    if (dropdownItems) {
        // Profile Dropdown Navigation
        dropdownItems.forEach(item => {
            if (item.getAttribute('data-section')) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = item.getAttribute('data-section');
                    
                    // Update active section option
                    sectionOptions.forEach(opt => {
                        if (opt.getAttribute('data-section') === section) {
                            opt.classList.add('active');
                        } else {
                            opt.classList.remove('active');
                        }
                    });
                    
                    // Show corresponding content section
                    contentSections.forEach(content => {
                        if (content.id === section) {
                            content.classList.add('active');
                        } else {
                            content.classList.remove('active');
                        }
                    });
                });
            }
        });        
    }

    if (menuToggle) {
        // Mobile Menu Toggle
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });        
    }

    if (tabBtns) {
        // Tab functionality for appointment section
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabContainer = btn.closest('.tabs').nextElementSibling;
                const tabTarget = btn.getAttribute('data-tab');
                
                // Update active tab button
                btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                
                // Show corresponding tab pane
                tabContainer.querySelectorAll('.tab-pane').forEach(pane => {
                    if (pane.id === tabTarget) {
                        pane.classList.add('active');
                    } else {
                        pane.classList.remove('active');
                    }
                });
            });
        });
    }

    if (calendarDays) {
        // Calendar day selection
        calendarDays.forEach(day => {
            day.addEventListener('click', () => {
                calendarDays.forEach(d => d.classList.remove('selected'));
                day.classList.add('selected');
            });
        });        
    }

    if (timeSlots) {
        // Time slot selection
        timeSlots.forEach(slot => {
            slot.addEventListener('click', () => {
                timeSlots.forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
            });
        });        
    }

    // Toggle collapsible sections
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const content = btn.closest('.security-option').querySelector('.option-content');
            content.classList.toggle('collapsed');
            
            if (content.classList.contains('collapsed')) {
                btn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            } else {
                btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            }
        });
    });

    // Note expansion
    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const note = btn.closest('.note-item');
            note.classList.toggle('collapsed');
            
            if (note.classList.contains('collapsed')) {
                btn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            } else {
                btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            }
        });
    });    

    if (uploadBtn) {
        uploadBtn.addEventListener('click', async () => {
            const scanFile = document.getElementById('scan-upload-file').files[0];
            const scanDate = document.getElementById('scan-date-input').value;
            const scanType = document.getElementById('scan-type-selector').value;
            const facility = document.getElementById('scan-facility-input').value.trim();
            const symptomsNotes = document.getElementById('new-scan-notes').value.trim();
            const errorMessage = document.getElementById('new-upload-error');

            errorMessage.style.display = 'none';

            if (scanFile) {
                if (scanDate && scanType) {
                    const formData = new FormData();
                    formData.append('scan_image', scanFile);
                    formData.append('scan_date', scanDate);
                    formData.append('scan_type', scanType);
                    formData.append('facility', facility);
                    formData.append('symptoms_notes', symptomsNotes);    

                    uploadBtn.innerHTML = '<i class="fas fa-spinner"></i>' + 'Processing...';
                    uploadBtn.disabled = true;
                    try {
                        const response = await fetch('/scan', {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: formData
                        });
                        
                        const result = await response.json();

                        if (response.ok && result.success) {
                            scan_id = result.scan_id;
                            renderRecentScans();
                            renderChatHistory();
                            
                            const selectedScan = document.querySelector('.selected-scan');
                            const yoloResult = String(result.yolo_diagnosis).replace(/(?:\r\n|\r|\n)/g, '<br/>');
                            const ai_diagnosis = String(result.ai_diagnosis).replace(/(?:\r\n|\r|\n)/g, '<br/>');

                            const originalMediaHtml = createMediaTag(result.image_base64, result.image_mime_type, 'Original MRI Scan');
                            const processedMediaHtml = createMediaTag(result.processed_image_base64, result.processed_image_mime_type, 'Segmented MRI Scan');

                            const html = `
                                    <div class="selected-scan-info">
                                        <h4>Brain MRI (${result.scan_type}) - ${result.scan_date}</h4>
                                    </div>
                                    <div class="analysis-view">
                                        <div class="original-scan">
                                            <h5>Original Scan</h5>
                                            ${originalMediaHtml}
                                        </div>
                                        <div class="segmented-scan">
                                            <h5>AI Segmentation</h5>
                                            ${processedMediaHtml}
                                        </div>
                                    </div>
                                    
                                    <div class="ai-report">
                                        <h4>Yolo Diagnosis</h4>
                                        <p>${yoloResult}</p>
                                        <h4>AI-Generated Interpretation</h4>
                                        <p>${ai_diagnosis}</p>
                                        <div class="report-actions">
                                            <button class="btn-small">
                                                <i class="fas fa-download"></i> Download Report
                                            </button>
                                            <button class="btn-small">
                                                <i class="fas fa-share-alt"></i> Share with Doctor
                                            </button>
                                        </div>
                                    </div>                
                            `;
                            selectedScan.innerHTML = html;
                            
                        } else {
                            errorMessage.textContent = 'Error while processing: ' + String(response.message);
                            errorMessage.style.display = 'block';
                        }
                    } catch (e) {
                        errorMessage.textContent = 'Error while connecting to server: ' + String(e);
                        errorMessage.style.display = 'block';
                    }
                    uploadBtn.innerHTML = '<i class="fas fa-upload"></i>Upload';
                    uploadBtn.disabled = false;

                } else {
                    errorMessage.textContent = 'Please select scan type and scan date.';
                    errorMessage.style.display = 'none';
                }
            } else {
                errorMessage.textContent = 'Please upload your scan file.';
                errorMessage.style.display = 'block';
            }
        });
    }

    // Scan sending
    // Chat message sending
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            const message = chatTextarea.value.trim();
            if (message) {
                sendMessage(message);
                chatTextarea.value = '';
            }
        });
    }

    if (chatTextarea) {
        chatTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const message = chatTextarea.value.trim();
            if (message) {
                sendMessage(message);
                chatTextarea.value = '';
            }
        }
    });
    }

    if (profileBtn) {
        profileBtn.addEventListener('click', async () => {
            const data = new FormData();
            data.append('first_name', String(document.getElementById('user-first-name').value));
            data.append('last_name', String(document.getElementById('user-last-name').value));
            data.append('email', String(document.getElementById('user-email').value));
            data.append('date_of_birth', String(document.getElementById('user-date-birth').value));
            data.append('gender', String(document.getElementById('user-gender').value));
            data.append('blood_type', String(document.getElementById('user-blood-tp').value));
            data.append('height', String(document.getElementById('user-height').value));
            data.append('weight', String(document.getElementById('user-weight').value));
            data.append('phone_number', String(document.getElementById('user-phone-number').value));
            data.append('address', String(document.getElementById('user-address').value));
            data.append('city', String(document.getElementById('user-city').value));
            data.append('state_province', String(document.getElementById('user-state-province').value));
            data.append('postal_code', String(document.getElementById('user-postal-code').value));
            data.append('country', String(document.getElementById('user-country').value));
            data.append('emergency_contact_name', String(document.getElementById('user-emergency-contact-name').value));
            data.append('emergency_contact_relationship', String(document.getElementById('user-emergency-contact-relationship').value));
            data.append('emergency_contact_phone', String(document.getElementById('user-emergency-contact-phone').value));
            data.append('emergency_contact_email', String(document.getElementById('user-emergency-contact-email').value));
            data.append('allergies', String(document.getElementById('user-allergies').value.trim()));
            data.append('current_medications', String(document.getElementById('user-current-medications').value.trim()));
            data.append('medical_conditions', String(document.getElementById('user-medical-conditions').value.trim()));

            profileErr.style.display = 'none';
            profileBtn.innerHTML = '<i class="fas fa-spinner"></i>' + 'Processing...';
            profileBtn.disabled = true;
            try {
                const response = await fetch('/update_profile', {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: data
                });
                
                const result = await response.json();

                if (response.ok && result.success) {
                    alert(result.message);
                    user = result.user;
                } else {
                    profileErr.textContent = 'Error: ' + String(result.message);
                    profileErr.style.display = 'block';
                }
            } catch (e) {
                profileErr.textContent = 'Error while connecting to server: ' + String(e);
                profileErr.style.display = 'block';
            }
            profileBtn.innerHTML = 'Save';
            profileBtn.disabled = false;
            renderUserProfile();
        });
    }

    if (passwordBtn) {
        passwordBtn.addEventListener('click', async () => {
            const old_password = document.getElementById('user-old-password');
            const new_password1 = document.getElementById('user-new-password-1');
            const new_password2 = document.getElementById('user-new-password-2');
            passwordErr.style.display = 'none';
            
            if (old_password && new_password1 && new_password2) {
                if (new_password1.value == new_password2.value) {
                    const data = new FormData();
                    data.append('password', String(old_password.value));
                    data.append('new_password', String(new_password1.value));

                    passwordBtn.innerHTML = '<i class="fas fa-spinner"></i>' + 'Processing...';
                    passwordBtn.disabled = true;
                    try {
                        const response = await fetch('/update_profile', {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: data
                        });
                        
                        const result = await response.json();

                        if (response.ok && result.success) {
                            alert(result.message);
                        } else {
                            passwordErr.textContent = 'Error: ' + String(result.message);
                            passwordErr.style.display = 'block';
                        }
                    } catch (e) {
                        passwordErr.textContent = 'Error while connecting to server: ' + String(e);
                        passwordErr.style.display = 'block';
                    }
                    passwordBtn.innerHTML = 'Update password';
                    passwordBtn.disabled = false;
                    
                } else{
                    passwordErr.textContent = 'The new passwords do not match.';
                    passwordErr.style.display = 'block';
                }
                
            } else{
                passwordErr.textContent = 'Please fill all inputs';
                passwordErr.style.display = 'block';
            }
        });
    }

    if (profilePhotoInp) {
        profilePhotoInp.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            try {
                const response = await fetch('/update_profile', {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: {
                        'profile_image': file
                    }
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    alert(result.message);
                    user = result.user;
                    renderUserProfile();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (e) {
                alert('An error occurred while connecting to the server.');                
            }
        });
    }

});

function renderUserProfile(data) {
    if (!data) {
        data = user;
    }

    if (!data.profile_base64 && !data.profile_mime_type) {
        document.getElementById('user-profile-img').innerHTML = '<i class="fas fa-user profile-icon" style="display: block;"></i>';
        document.getElementById('profile-photo-large').innerHTML = '<img src="https://placehold.co/400x400?text=Media+Not+Available" alt="Profile photo">';
    } else{
        document.getElementById('user-profile-img').innerHTML = `<img src="date:${data.profile_mime_type};base64,${data.profile_base64}" alt="Profile Image">`;
        document.getElementById('profile-photo-large').innerHTML = `<img src="date:${data.profile_mime_type};base64,${data.profile_base64}" alt="Profile Image">`;
    } 
    document.getElementById('user-first-name').value = data.first_name;
    document.getElementById('user-last-name').value = data.last_name;
    document.getElementById('user-date-birth').value = data.date_of_birth;
    document.getElementById('user-height').value = data.height;
    document.getElementById('user-weight').value = data.weight;
    document.getElementById('user-email').value = data.email;
    document.getElementById('user-phone-number').value = data.phone_number;
    document.getElementById('user-address').value = data.address;
    document.getElementById('user-city').value = data.city;
    document.getElementById('user-state-province').value = data.state_province;
    document.getElementById('user-postal-code').value = data.postal_code;
    document.getElementById('user-emergency-contact-name').value = data.emergency_contact_name;
    document.getElementById('user-emergency-contact-relationship').value = data.emergency_contact_relationship;
    document.getElementById('user-emergency-contact-phone').value = data.emergency_contact_phone;
    document.getElementById('user-emergency-contact-email').value = data.emergency_contact_email;
    document.getElementById('user-allergies').value = data.allergies;
    document.getElementById('user-current-medications').value = data.current_medications;
    document.getElementById('user-medical-conditions').value = data.medical_conditions;
    document.getElementById('user-full-name').textContent = data.first_name + " " + data.last_name;
    document.getElementById('user-pid').textContent = data.id;
    const today = new Date();
    const birth = new Date(data.date_of_birth);
    document.getElementById('user-age').textContent = today.getFullYear() - birth.getFullYear();
    document.getElementById('user-blood-type').textContent = data.blood_type;
    document.getElementById('user-phone-num').textContent = data.phone_number;
}

function renderRecentScans(scans) {
    const scansListContainer = document.getElementById('scan-history-list');
    scansListContainer.innerHTML = '';

    if (!scans) {
        scans = recentScans;
    }

    if (scans.length === 0) {
        scansListContainer.innerHTML = '<p class="text-center text-gray-500">There are no recent scans.</p>';
        return;
    }
    scans.forEach(scan => {
        const scanDate = new Date(scan.scan_date).toLocaleDateString('en-US');

        const diagnosisStatusClass = scan.ai_diagnosis && scan.ai_diagnosis.toLowerCase().includes('meningioma') ? 'needs-attention' : 'ok';
        const diagnosisStatusIcon = diagnosisStatusClass === 'needs-attention' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-check-circle"></i>';
        
        const originalMediaHtml = createMediaTag(scan.image_base64, scan.image_mime_type, 'Original MRI Scan');
        const processedMediaHtml = createMediaTag(scan.processed_image_base64, scan.processed_image_mime_type, 'Segmented MRI Scan');

        const scanItem = document.createElement('div');
        scanItem.className = 'scan-history-item';

        scanItem.innerHTML = `
            <div class="scan-thumbnail">
                ${originalMediaHtml}
                <div class="scan-status ${diagnosisStatusClass}">
                    ${diagnosisStatusIcon}
                </div>
            </div>
            <div class="scan-history-info">
                <h4>Scan ID#${scan.id}</h4>
                <p><i class="fas fa-calendar-alt"></i> ${scanDate}</p>
                <p><i class="fas fa-hospital"></i> ${scan.facility || 'Invalid'}</p>
            </div>
        `;

        scanItem.addEventListener('click', () => {
            const selectedScan = document.querySelector('.selected-scan');
            const yoloscan = String(scan.yolo_diagnosis).replace(/(?:\r\n|\r|\n)/g, '<br/>');
            const ai_diagnosis = String(scan.ai_diagnosis).replace(/(?:\r\n|\r|\n)/g, '<br/>');
            const htmlInfo = `
                    <div class="selected-scan-info">
                        <h4>Brain MRI (${scan.scan_type}) - ${scan.scan_date}</h4>
                    </div>
                    <div class="analysis-view">
                        <div class="original-scan">
                            <h5>Original Scan</h5>
                            ${originalMediaHtml}
                        </div>
                        <div class="segmented-scan">
                            <h5>AI Segmentation</h5>
                            ${processedMediaHtml}
                        </div>
                    </div>
                    
                    <div class="ai-report">
                        <h4>Yolo Diagnosis</h4>
                        <p>${scan.yolo_diagnosis}</p>
                        <h4>AI-Generated Interpretation</h4>
                        <p>${ai_diagnosis}</p>
                        <div class="report-actions">
                            <button class="btn-small">
                                <i class="fas fa-download"></i> Download Report
                            </button>
                            <button class="btn-small">
                                <i class="fas fa-share-alt"></i> Share with Doctor
                            </button>
                        </div>
                    </div>                
            `;

            selectedScan.innerHTML = htmlInfo;

            document.querySelector('.upload-card form').reset();
        });

        scansListContainer.appendChild(scanItem);
    });
}

async function renderMedicalRecords() {
    const patientHistoryContainer = document.querySelector('.history-legend');
    const scanResultsContainer = document.querySelector('.scan-results');
    const notesContainer = document.querySelector('.notes-container');
    const loadingHTML = '<i class="fas fa-spinner"></i>Loading records...';

    patientHistoryContainer.innerHTML = loadingHTML;
    scanResultsContainer.innerHTML = loadingHTML;
    notesContainer.innerHTML = loadingHTML;

    if (medicalRecords) {
        renderPatientHistory(patientHistoryContainer, medicalRecords);
        renderScanResults(scanResultsContainer, medicalRecords);
        renderDoctorNotes(notesContainer, medicalRecords);
    } else {
        console.error('Error fetching or rendering medical records');
        const errorHTML = `<div class="error-message"><i class="fa-solid fa-circle-exclamation"></i>Error: ${error.message}</div>`;
        patientHistoryContainer.innerHTML = errorHTML;
        scanResultsContainer.innerHTML = '';
        notesContainer.innerHTML = '';
    }
}

function renderPatientHistory(container, data) {
    const { user, scans, medical_summary, treatment_draft } = data;
    const age = user.date_of_birth ? 
        new Date().getFullYear() - new Date(user.date_of_birth).getFullYear() : 'N/A';

    const patientHistoryHTML = `
        <div class="legend-item">
            <h3>Patient Informations</h3>
            <div class="demographics-grid">
                <span><strong>Full name:</strong> ${user.first_name} ${user.last_name}</span>
                <span><strong>Age:</strong> ${age}</span>
                <span><strong>Gender:</strong> ${user.gender || 'None'}</span>
                <span><strong>Scan numbers:</strong> ${scans.length}</span>
            </div>
        </div>
        <div class="legend-item">
            <h3>Medical condition summary</h3>
            <p>${medical_summary.replace(/\n/g, '<br>') || 'No information has been recorded.'}</p>
        </div>
        <div class="legend-item">
            <h3>Draft treatment plan (AI suggestion)</h3>
            <p>${treatment_draft.replace(/\n/g, '<br>') || 'There is no information to generate a draft.'}</p>
        </div>
    `;
    container.innerHTML = patientHistoryHTML;
}

function renderScanResults(container, data) {
    const { scans, chart_data } = data;

    if (!scans || scans.length === 0) {
        container.innerHTML = '<p>There are no scan results to display.</p>';
        return;
    }

    const latestScan = scans[scans.length - 1];

    const scanResultsHTML = `
        <div class="latest-scan-result">
            <h3>Latest scan result (${new Date(latestScan.scan_date).toLocaleDateString('en-US')})</h3>
            <div class="scan-images">
                <div class="image-container">
                    <h4>Original scan</h4>
                    <img src="date:${latestScan.image_mime_type};base64,${latestScan.image_base64}" alt="Original Image" onerror="this.src="https://placehold.co/400x400?text=Media+Not+Available";">
                </div>
                <div class="image-container">
                    <h4>AI Analysis</h4>
                    <img src="date:${latestScan.processed_image_mime_type};base64,${latestScan.processed_image_base64}" alt="Original Image" onerror="this.src="https://placehold.co/400x400?text=Media+Not+Available";">
                </div>
            </div>
            <div class="scan-ai-report">
                <h4>AI Report</h4>
                <p>${latestScan.ai_diagnosis || 'No report has been recorded for this scan.'}</p>
            </div>
        </div>
        <div class="scan-comparison">
            <h3>Chart comparing tumor volume over time</h3>
            <canvas id="tumorSizeChart"></canvas>
        </div>
    `;
    container.innerHTML = scanResultsHTML;
    renderTumorChart(chart_data);
}

function renderTumorChart(chart_data) {
    const ctx = document.getElementById('tumorSizeChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chart_data.labels,
            datasets: [{
                label: 'Largest tumor diameter (centimeters)',
                data: chart_data.data,
                borderColor: 'rgba(68, 77, 239, 1)',
                backgroundColor: 'rgba(105, 68, 239, 0.2)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Size (cm)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Scan date'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` Size: ${context.parsed.y} cm`;
                        }
                    }
                }
            }
        }
    });
}

function renderDoctorNotes(container, data) {
    const { patient_report } = data;
    const notesHTML = `
        <h3>Health reports and recommendations</h3>
        <div class="ai-generated-note">
            ${patient_report.replace(/\n/g, '<br>') || 'There are no reports to display.'}
        </div>
        <div class="disclaimer">
            <p><strong><i class="fas fa-exclamation-triangle"></i>Pay Atention :</strong>This report is generated by artificial intelligence and is for informational purposes only. This text is not a substitute for the diagnosis, opinion, or instructions of your physician. Always consult your physician for treatment decisions.</p>
        </div>
        <div class="add-note">
            <h4>Patient Notes</h4>
            <textarea class="form-control" placeholder="Add your own notes about your symptoms, questions for your doctor, etc." rows="3"></textarea>
            <a href="#" class="btn-small" data-section="appointment">
                Save Notes
            </a>
        </div>
    `;
    container.innerHTML = notesHTML;
}

function renderChatHistory(chats) {
    if (!chats) {
        chats = chatHistory;
    }

    groupedChats = groupChatsByScanId(chats);
    renderRecentConversations(groupedChats);
    const latestScanId = Object.keys(groupedChats).sort((a, b) => groupedChats[b].timestamp - groupedChats[a].timestamp)[0];
    if (latestScanId) {
        renderChatMessages(latestScanId);
        const latestChatElement = document.querySelector(`.history-item[data-scan-id="${latestScanId}"]`);
        if (latestChatElement) {
            latestChatElement.classList.add('active');
        }
    }
}

// A helper function to add messages to the chat UI
// The sendMessage function is updated to send data via an AJAX call.

let groupedChats = {};
let currentScanId = null;

function sendMessage(message) {
    addMessageToChat(message, 'user');
    setLoadingIcon(true);

    fetch('/app_chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            message: message,
            scan_id: scan_id
        })
    })

    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        setLoadingIcon(false);
        if (data.success) {
            addMessageToChat(data.response, 'ai', data.timestamp);
        } else {
            addMessageToChat('An error occurred: ' + data.message, 'ai');
        }
    })
    .catch(error => {
        setLoadingIcon(false);
        console.error('Fetch error:', error);
        addMessageToChat('Unfortunately, there was an error connecting to the server.', 'ai');
    });
}

function setLoadingIcon(set) {
    if (set) {
        document.getElementById('sending-loading-icon').classList.replace('fas fa-paper-plane', 'fas fa-spinner');
    }
    else{
        document.getElementById('sending-loading-icon').classList.replace('fas fa-spinner', 'fas fa-paper-plane');
    }
}

function groupChatsByScanId(history) {
    const chats = chatHistory.filter(chatMessage => {
        return chatMessage.scan_id === scan_id;
    });
    return chats
}

function renderRecentConversations(groupedChats) {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';

    const sortedChats = Object.values(groupedChats).sort((a, b) => b.timestamp - a.timestamp);

    sortedChats.forEach(chatGroup => {
        const lastMessage = chatGroup.messages[chatGroup.messages.length - 1];

        const formattedDate = new Date(lastMessage.timestamp).toLocaleDateString();
        const formattedTime = new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.setAttribute('data-scan-id', chatGroup.scan_id);
        
        historyItem.innerHTML = `
            <div class="history-icon">
                <i class="fas fa-comment-medical"></i>
            </div>
            <div class="history-info">
                <h4>Conversation #${chatGroup.scan_id}</h4>
                <p>${formattedDate}, ${formattedTime}</p>
            </div>
        `;
        historyList.appendChild(historyItem);

        historyItem.addEventListener('click', () => {
            const prevActive = document.querySelector('.history-item.active');
            if (prevActive) {
                prevActive.classList.remove('active');
            }
            historyItem.classList.add('active');
            renderChatMessages(chatGroup.scan_id);
        });
    });
}

function renderChatMessages(scanId) {
    const chatMessagesContainer = document.getElementById('chat-messages-container');
    chatMessagesContainer.innerHTML = '';
    
    const chatGroup = chatHistory.filter(chatMessages => {
        return chatMessages.scan_id === scanId;
    });
    if (!chatGroup) {
        chatMessagesContainer.innerHTML = '<p class="text-center text-gray-500">No messages for this conversation.</p>';
        return;
    }

    chatGroup.messages.forEach(message => {
        if (message.user_message) {
            addMessageToContainer(message.user_message, 'user', message.timestamp);
        }
        addMessageToContainer(message.ai_response, 'ai', message.timestamp);
    });

    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function addMessageToContainer(message, sender, timestamp) {
    const chatMessagesContainer = document.getElementById('chat-messages-container');
    const messageType = sender === 'user' ? 'user-message' : 'ai-message';
    const avatar = sender === 'ai' ? '<div class="message-avatar"><i class="fas fa-robot"></i></div>' : '';
    const formattedTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messageHTML = `
        <div class="message-group">
            <div class="message ${messageType}">
                ${avatar}
                <div class="message-content">
                    <p>${message}</p>
                </div>
                <div class="message-time">${formattedTime}</div>
            </div>
        </div>
    `;

    chatMessagesContainer.insertAdjacentHTML('beforeend', messageHTML);
}

function addMessageToChat(message, sender, timestamp) {
    const chatMessages = document.getElementById('chat-messages');
    const now = new Date(timestamp);
    const formattedTime = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const messageClass = sender === 'user' ? 'user-message bg-green-100 ml-auto' : 'ai-message bg-gray-200 mr-auto';
    const html = `
        <div class="message-group flex">
            <div class="message ${messageClass}">
                <div class="message-content p-3 rounded-xl shadow-sm">
                    <p>${message}</p>
                </div>
                <div class="message-time text-xs text-gray-500 mt-1">${formattedTime}</div>
            </div>
        </div>
    `;
    chatMessages.insertAdjacentHTML('afterbegin', html);
}

function createMediaTag(base64Data, mimeType, altText) {
    // If there's no data or MIME type, return a placeholder.
    if (!base64Data || !mimeType) {
        return `<img src="https://placehold.co/400x400?text=Media+Not+Available" alt="${altText}">`;
    }

    const dataSrc = `data:${mimeType};base64,${base64Data}`;

    // Check if the MIME type indicates a video file.
    if (mimeType.startsWith('video/')) {
        // Return a <video> tag if it's a video.
        return `<video controls autoplay loop muted src="${dataSrc}" alt="${altText}"></video>`;
    } else {
        // Otherwise, return an <img> tag.
        return `<img src="${dataSrc}" alt="${altText}">`;
    }
}

async function updateUserInfo() {
    try {
        const response = await fetch('/get-user-info', {
            method: 'GET'
        });
        
        const result = await response.json();

        if (response.ok && result.success) {
            console.log('User data loaded successfully:', result.user_info);
            return result.user_info;
        } else {
            console.error('Failed to fetch user info:', result.message);
            return  [];
        }
    } catch (e) {
        console.error('Connection error:', e);
        return [];
    }
}

async function updateUserScan() {
    try {
        const response = await fetch('/get-scan-history', {
            method: 'GET'
        });
        
        const result = await response.json();

        if (response.ok && result.success) {
            console.log('User scans loaded successfully:', result.user_scan);
            return result.user_scan;
        } else {
            console.error('Failed to fetch user info:', result.message);
            return [];
        }
    } catch (e) {
        console.error('Connection error:', e);
        return [];
    }
}

async function updateUserChat() {
    try {
        const response = await fetch('/get-chat-history', {
            method: 'GET'
        });
        
        const result = await response.json();

        if (response.ok && result.success) {
            console.log('User data loaded successfully:', result.user_chat);
            return result.user_chat;
        } else {
            console.error('Failed to fetch user info:', result.message);
            return [];
        }
    } catch (e) {
        console.error('Connection error:', e);
        return [];
    }
}

async function updateUserChat() {
    try {
        const response = await fetch('/get-medical-records', {
            method: 'GET'
        });
        
        const result = await response.json();

        if (response.ok && result.success) {
            console.log('Medical records loaded successfully:', result.user_chat);
            return result.user_chat;
        } else {
            console.error('Failed to fetch medical records:', result.message);
            return [];
        }
    } catch (e) {
        console.error('Connection error:', e);
        return [];
    }
}