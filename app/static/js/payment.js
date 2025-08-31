// Theme toggle functionality
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    body.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

themeToggle.addEventListener('click', function() {
    body.classList.toggle('dark-theme');
    
    // Save theme preference
    if (body.classList.contains('dark-theme')) {
        localStorage.setItem('theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        localStorage.setItem('theme', 'light');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
});

// Mobile menu toggle
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

menuToggle.addEventListener('click', function() {
    navLinks.classList.toggle('active');
    if (navLinks.classList.contains('active')) {
        menuToggle.innerHTML = '<i class="fas fa-times"></i>';
    } else {
        menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    }
});

// Get plan details from URL parameters or localStorage
window.addEventListener('DOMContentLoaded', function() {
    // Get selected plan from URL parameters or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const planName = urlParams.get('plan') || localStorage.getItem('selectedPlan') || 'Professional';
    
    // Update plan details based on selected plan
    updatePlanDetails(planName);
    
    // Payment option selection
    const paymentOptions = document.querySelectorAll('.payment-option');
    paymentOptions.forEach(option => {
        option.addEventListener('click', function() {
            paymentOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Card number formatting
    const cardNumberInput = document.getElementById('card-number');
    cardNumberInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        let formattedValue = '';
        
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formattedValue += ' ';
            }
            formattedValue += value[i];
        }
        
        this.value = formattedValue;
    });
    
    // Expiry date formatting
    const expiryDateInput = document.getElementById('expiry-date');
    expiryDateInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        
        if (value.length > 2) {
            this.value = value.substring(0, 2) + '/' + value.substring(2, 4);
        } else {
            this.value = value;
        }
    });
    
    // Form submission
    const paymentForm = document.getElementById('payment-form');
    paymentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Simulate payment processing
        const paymentFormContainer = document.getElementById('payment-form-container');
        const planSummary = document.getElementById('plan-summary');
        const successMessage = document.getElementById('success-message');
        
        // Hide payment form and plan summary
        paymentFormContainer.style.display = 'none';
        planSummary.style.display = 'none';
        
        // Show success message
        successMessage.style.display = 'block';
        
        // Set success flag in localStorage (to indicate payment is complete)
        localStorage.setItem('paymentComplete', 'true');
        
        // Update payment container to span full width for success message
        document.querySelector('.payment-content').style.gridTemplateColumns = '1fr';
    });
});

// Function to update plan details based on selected plan
function updatePlanDetails(planName) {
    const planNameElement = document.getElementById('plan-name');
    const priceTagElement = document.getElementById('price-tag');
    const planDetailsElement = document.querySelector('.plan-details');
    // Set plan name
    planNameElement.textContent = planName + ' Plan';
    // Update price and features based on plan
    switch (planName.toLowerCase()) {
        case 'basic':
            priceTagElement.innerHTML = '$29 <small>/month</small>';
            planDetailsElement.innerHTML = `
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Up to 20 MRI scans per month</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Basic tumor detection</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Standard analysis reports</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Email support</span>
                </div>
            `;
            break;
        case 'professional':
            priceTagElement.innerHTML = '$49 <small>/month</small>';
            planDetailsElement.innerHTML = `
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Up to 50 MRI scans per month</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Advanced tumor detection & segmentation</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Detailed analysis reports</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Priority technical support</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Integration with hospital systems</span>
                </div>
            `;
            break;
        case 'enterprise':
            priceTagElement.innerHTML = '$199 <small>/month</small>';
            planDetailsElement.innerHTML = `
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Unlimited MRI scans</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Full suite of detection & analysis tools</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Comprehensive reports with treatment suggestions</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>24/7 dedicated support</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Full API access</span>
                </div>
                <div class="plan-detail">
                    <i class="fas fa-check-circle"></i>
                    <span>Custom integration & white labeling</span>
                </div>
            `;
            break;
        default:
            // Default to Professional plan if no match
            planNameElement.textContent = 'Professional Plan';
            break;
    }
}