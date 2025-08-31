/* Will be filled later. */
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.navbar')) {
            navLinks.classList.remove('active');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                navLinks.classList.remove('active');
                menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
                
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Tab functionality for "Why Choose Us" section
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Show corresponding pane
            const target = this.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
        });
    });
    
    // Testimonial carousel
    const testimonials = document.querySelectorAll('.testimonial');
    const dots = document.querySelectorAll('.dot');
    const prevButton = document.getElementById('prev-testimonial');
    const nextButton = document.getElementById('next-testimonial');
    let currentIndex = 0;
    
    function showTestimonial(index) {
        testimonials.forEach(testimonial => testimonial.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        testimonials[index].classList.add('active');
        dots[index].classList.add('active');
        currentIndex = index;
    }
    
    prevButton.addEventListener('click', function() {
        currentIndex = (currentIndex - 1 + testimonials.length) % testimonials.length;
        showTestimonial(currentIndex);
    });
    
    nextButton.addEventListener('click', function() {
        currentIndex = (currentIndex + 1) % testimonials.length;
        showTestimonial(currentIndex);
    });
    
    dots.forEach((dot, index) => {
        dot.addEventListener('click', function() {
            showTestimonial(index);
        });
    });
    
    // Auto-scroll testimonials
    let testimonialInterval = setInterval(() => {
        currentIndex = (currentIndex + 1) % testimonials.length;
        showTestimonial(currentIndex);
    }, 8000);
    
    // Pause auto-scroll when hovering over testimonials
    const testimonialContainer = document.querySelector('.testimonial-container');
    testimonialContainer.addEventListener('mouseenter', function() {
        clearInterval(testimonialInterval);
    });
    
    testimonialContainer.addEventListener('mouseleave', function() {
        testimonialInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % testimonials.length;
            showTestimonial(currentIndex);
        }, 8000);
    });
    
    // Animated counter for metrics
    const metricsSection = document.querySelector('.impact-section');
    let counted = false;
    
    const accuracyCounter = new CountUp('accuracy-metric', 0, 95, 0, 2, {
        useEasing: true,
        useGrouping: true,
        separator: ',',
        decimal: '.',
        suffix: '+'
    });
    
    const patientsCounter = new CountUp('patients-metric', 0, 15000, 0, 2.5, {
        useEasing: true,
        useGrouping: true,
        separator: ',',
        decimal: '.',
        suffix: '+'
    });
    
    const hospitalsCounter = new CountUp('hospitals-metric', 0, 153, 0, 2, {
        useEasing: true,
        useGrouping: true,
        separator: ',',
        decimal: '.'
    });
    
    const usersCounter = new CountUp('users-metric', 0, 5000, 0, 2.5, {
        useEasing: true,
        useGrouping: true,
        separator: ',',
        decimal: '.',
        suffix: '+'
    });
    
    // Intersection Observer for metrics section
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !counted) {
                accuracyCounter.start();
                patientsCounter.start();
                hospitalsCounter.start();
                usersCounter.start();
                counted = true;
            }
        });
    }, observerOptions);
    
    observer.observe(metricsSection);
    
    // Highlight active nav link based on scroll position
    const sections = document.querySelectorAll('section');
    const navItems = document.querySelectorAll('.nav-links a');
    
    window.addEventListener('scroll', function() {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            if (window.pageYOffset >= sectionTop - 150) {
                current = section.getAttribute('id');
            }
        });
        
        navItems.forEach(navItem => {
            navItem.classList.remove('active');
            if (navItem.getAttribute('href') === `#${current}`) {
                navItem.classList.add('active');
            }
        });
    });
    
    // Animation for elements when they enter viewport
    const fadeElements = document.querySelectorAll('.info-card, .pricing-card, .benefit-card');
    
    const fadeObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                fadeObserver.unobserve(entry.target);
            }
        });
    }, {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    });
    
    fadeElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        fadeObserver.observe(element);
    });

    
});

//Choose plan section
const selectPlanButtons = document.querySelectorAll('.select-plan-btn');

selectPlanButtons.forEach(button => {
    button.addEventListener('click', function() {
        const selectedPlan = this.value;
        localStorage.setItem('selectedPlan', selectedPlan);
        const redirectUrl = "/login?plan=" + encodeURIComponent(selectedPlan);
        window.location.href = redirectUrl;
    });
});

//create impact Animation
const accuracyElement = document.getElementById('accuracy-metric');
const patientsElement = document.getElementById('patients-metric');
const hospitalsElement = document.getElementById('hospitals-metric');
const usersElement = document.getElementById('users-metric');
const impactSection = document.getElementById('impact');

const observers = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            startNumberAnimation(accuracyElement, 86);
            startNumberAnimation(patientsElement, 1000);
            startNumberAnimation(hospitalsElement, 10);
            startNumberAnimation(usersElement, 200);
            observers.unobserve(impactSection); // Stop observing after animation
        }
    });
}, {
    threshold: 0.5 // Trigger when 50% of the section is visible
});

observers.observe(impactSection);

function startNumberAnimation(element, target) {
    const duration = 5000; // Animation duration in milliseconds
    const start = 0;
    const increment = Math.ceil(target / (duration / 16)); // Increment per frame (approx. 60fps)
    let current = start;
    const startTime = performance.now();

    function animate(currentTime) {
        const timeElapsed = currentTime - startTime;
        if (timeElapsed < duration) {
            current += increment;
            element.textContent = formatNumber(Math.min(current, target), element.id);
            requestAnimationFrame(animate);
        } else {
            element.textContent = formatNumber(target, element.id);
        }
    }

    requestAnimationFrame(animate);
}

function formatNumber(number, id) {
    if (id === 'accuracy-metric') {
        return `${number}`;
    } else if (id === 'patients-metric') {
        return `${number}+`;
    } else if (id === 'hospitals-metric') {
        return `${number}+`;
    } else if (id === 'users-metric') {
        return `${number}+`;
    }
    return number;
}

const btn_partner = document.getElementById('partner-btn');
btn_partner.addEventListener('click', function () {
    window.location.href = "about.html#support";
});

