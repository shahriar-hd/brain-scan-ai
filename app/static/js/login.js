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

//if from plan selected
document.addEventListener('DOMContentLoaded', function() {
    const selectedPlan = localStorage.getItem('selectedPlan');
    const roleRadios = document.querySelectorAll('input[name="role"]');
    
    if (selectedPlan) {
        roleRadios.forEach(radio => {
            if (radio.value === selectedPlan) {
                radio.checked = true;
            }
        });
    }
});

// Auth tab switching
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const forgotForm = document.getElementById('forgot-password-form')
const forgotLink = document.getElementById('forgot-password-link');

// Check URL hash for direct access to signup tab
if (window.location.hash === '#signup') {
    loginTab.classList.remove('active');
    signupTab.classList.add('active');
    loginForm.classList.remove('active');
    signupForm.classList.add('active');
    forgotForm.classList.remove('active');
}
else if (window.location.hash === '#forgot-password') {
    loginTab.classList.remove('active');
    signupTab.classList.remove('active');
    loginForm.classList.remove('active');
    signupForm.classList.remove('active');
    forgotForm.classList.add('active');
}
else {
    forgotForm.classList.remove('active');
}

loginTab.addEventListener('click', function() {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
    forgotForm.classList.remove('active');
    window.location.hash = '';
});

signupTab.addEventListener('click', function() {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
    forgotForm.classList.remove('active');
    window.location.hash = 'signup';
});

forgotLink.addEventListener('click', function () {
    loginTab.classList.remove('active');
    signupTab.classList.remove('active');
    loginForm.classList.remove('active');
    signupForm.classList.remove('active');
    forgotForm.classList.add('active');
    window.location.hash = 'forgot-password';
})

// Role selection in signup form
const roleOptions = document.querySelectorAll('.role-option');

roleOptions.forEach(option => {
    option.addEventListener('click', function() {
        const radio = this.querySelector('input[type="radio"]');
        radio.checked = true;
        
        // Update selected styling
        roleOptions.forEach(opt => opt.classList.remove('selected'));
        this.classList.add('selected');
    });
});

roleOptions.forEach(option => {
    option.addEventListener('onload', function(){
        const radio = this.querySelector('input[type="radio"]');
        if (localStorage.getItem('role-options') == radio.value)
            radio.checked = true;
        roleOptions.forEach(opt => opt.classList.remove('selected'));
        this.classList.add('selected');
    })
});

// Login form submission
const loginFormElement = document.getElementById('login-form-element');
const loginError = document.getElementById('login-error');

loginFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('login-username').value
    const password = document.getElementById('login-password').value
    const urlParams = new URLSearchParams(window.location.search);
    const selectedPlan = urlParams.get('plan');

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    let loginUrl = "login";
    if (selectedPlan) {
        loginUrl += `?plan=${encodeURIComponent(selectedPlan)}`;
    }

    try {
        const response = await fetch(loginUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message);
            window.location.href = data.redirect_url;
        } else {
            loginError.textContent = data.message || 'An error occurred. Please try again.';
            loginError.style.display = 'block';
        }
    } catch (error) {
        console.error('Error during login:', error);
        loginError.textContent = 'An error occurred while connecting to the server.';
        loginError.style.display = 'block';
    }
});

 
// Signup form submission
const signupFormElement = document.getElementById('signup-form-element');
const signupError = document.getElementById('signup-error');

signupFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fullname = document.getElementById('signup-fullname').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const selectedRole = document.querySelector('input[name="role"]:checked');
    
    // Validate passwords match
    if (password !== confirmPassword) {
        signupError.textContent = "Passwords don't match. Please try again.";
        signupError.style.display = 'block';
        return;
    }
    // Validate role selection
    if (!selectedRole) {
        signupError.textContent = "Please select a role.";
        signupError.style.display = 'block';
        return;
    }
    
    // Create user object
    const formData = new FormData();
    formData.append('fullname', fullname);
    formData.append('email', email);
    formData.append('password', password);
    formData.append('role', selectedRole.value);
    
    // Store user data (in a real app, this would be sent to a server)
    localStorage.setItem('newUser', JSON.stringify(formData));
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userRole', selectedRole.value);
    localStorage.setItem('userName', fullname);
    
    // Get selected plan from localStorage if coming from pricing page
    const urlParams = new URLSearchParams(window.location.search);
    const selectedPlan = urlParams.get('plan');
    
    signupUrl = "signup";
    try {
        const response = await fetch(signupUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message);
            // Decide where to redirect based on whether a plan was selected
            if (selectedPlan) {
                // Redirect to payment page if a plan was selected
                redirect_url = "payment"
                window.location.href = redirect_url + '?plan=' + selectedPlan;
            } else {
                // Otherwise redirect to profile page to complete profile setup
                redirect_url = "app#profile"
                window.location.href = redirect_url;
            }
        } else {
            loginError.textContent = data.message || 'An error occurred. Please try again.';
            loginError.style.display = 'block';
        }
    } catch (error) {
        console.error('Error during create an account:', error);
        loginError.textContent = 'An error occurred while connecting to the server.';
        loginError.style.display = 'block';
    }

});

const forgotFormElement = document.getElementById('forgot-password-form-element')
const forgotError = document.getElementById('forgot-error')

forgotFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('forgot-username').value;
    const formData = new FormData();
    formData.append('email', email);

    forgotUrl = "forgot-password";
    try {
        const response = await fetch(forgotUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message);
            window.location.href = data.redirect_url;
        } else {
            forgotError.textContent = data.message || 'An error occurred. Please try again.';
            forgotError.style.display = 'block';
        }
    } catch (error) {
        console.error('Error during login:', error);
        forgotError.textContent = 'An error occurred while connecting to the server.';
        forgotError.style.display = 'block';
    }
});