// Theme toggling functionality
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Check if user has a saved preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    body.classList.add('dark-theme');
    themeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-theme');
    
    // Update icon
    const icon = themeToggle.querySelector('i');
    if (body.classList.contains('dark-theme')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        localStorage.setItem('theme', 'light');
    }
});

// Mobile menu functionality
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    
    // Update icon
    const icon = mobileMenuBtn.querySelector('i');
    if (sidebar.classList.contains('open')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});

// Back to top button functionality
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
        backToTop.classList.add('visible');
    } else {
        backToTop.classList.remove('visible');
    }
});

backToTop.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Fetch and parse README.md
async function loadReadme() {
    try {
        const response = await fetch('README.md');
        if (!response.ok) {
            throw new Error('Failed to load README.md');
        }
        
        const markdown = await response.text();
        
        // Configure marked options
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true
        });
        
        // Parse markdown content
        const docContent = document.getElementById('docContent');
        docContent.innerHTML = marked.parse(markdown);
        
        // Generate navigation links
        generateNavLinks();
        
        // Add hash navigation behavior
        setupHashNavigation();
        
    } catch (error) {
        const docContent = document.getElementById('docContent');
        docContent.innerHTML = `<h1>Error Loading Documentation</h1><p>${error.message}</p>`;
        
        const docLinks = document.getElementById('docLinks');
        docLinks.innerHTML = '<li><a href="#error">Error Loading Navigation</a></li>';
        
        console.error('Error loading README.md:', error);
    }
}

// Generate navigation links from headings
function generateNavLinks() {
    const docContent = document.getElementById('docContent');
    const docLinks = document.getElementById('docLinks');
    const headings = docContent.querySelectorAll('h1, h2, h3');
    
    docLinks.innerHTML = '';
    
    headings.forEach((heading) => {
        // Create IDs for headings if they don't have one
        if (!heading.id) {
            heading.id = heading.textContent
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }
        
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent;
        
        // Add indentation based on heading level
        if (heading.tagName === 'H2') {
            link.style.paddingLeft = '1.5rem';
        } else if (heading.tagName === 'H3') {
            link.style.paddingLeft = '3rem';
        }
        
        listItem.appendChild(link);
        docLinks.appendChild(listItem);
    });
}

// Setup hash navigation behavior
function setupHashNavigation() {
    const docLinks = document.querySelectorAll('.doc-links a');
    
    // Add click event to all navigation links
    docLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            docLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Get the target element
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            // Scroll to the target element
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
                
                // Update URL hash without scrolling
                history.pushState(null, null, `#${targetId}`);
            }
            
            // Close mobile menu if open
            if (sidebar.classList.contains('open')) {
                mobileMenuBtn.click();
            }
        });
    });
    
    // Check if there's a hash in the URL and navigate to it
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            setTimeout(() => {
                targetElement.scrollIntoView();
                
                // Set active class on the corresponding link
                const activeLink = document.querySelector(`.doc-links a[href="#${targetId}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }, 100);
        }
    }
}

// Add a scroll spy functionality to highlight current section in navigation
function setupScrollSpy() {
    const sections = document.querySelectorAll('h1[id], h2[id], h3[id]');
    
    window.addEventListener('scroll', () => {
        let currentSection = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            
            if (window.scrollY >= sectionTop - 100) {
                currentSection = section.id;
            }
        });
        
        if (currentSection) {
            document.querySelectorAll('.doc-links a').forEach(link => {
                link.classList.remove('active');
                
                if (link.getAttribute('href') === `#${currentSection}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    loadReadme().then(() => {
        setupScrollSpy();
    });
});