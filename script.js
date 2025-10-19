document.addEventListener('DOMContentLoaded', () => {
    // --- Main Page Elements ---
    const hamburgerButton = document.getElementById('hamburger-button');
    const mainNav = document.querySelector('.main-nav');
    const navLinks = document.querySelectorAll('.main-nav a');
    const siteHeader = document.querySelector('.site-header');
    const backToTopButton = document.getElementById('back-to-top');

    let lastScrollY = window.scrollY;

    // --- Main Page Logic ---
    if (siteHeader) {
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY > 50) {
                siteHeader.classList.add('scrolled');
            } else {
                siteHeader.classList.remove('scrolled');
            }

            if (currentScrollY > lastScrollY && currentScrollY > siteHeader.offsetHeight) {
                // Scrolling down
                siteHeader.classList.add('header-hidden');
            } else {
                // Scrolling up
                siteHeader.classList.remove('header-hidden');
            }

            lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; // For Mobile or negative scrolling

            // Show/hide back-to-top button
            if (backToTopButton) {
                if (window.scrollY > 400) {
                    backToTopButton.classList.add('visible');
                } else {
                    backToTopButton.classList.remove('visible');
                }
            }
        });
    }

    if (hamburgerButton && mainNav) {
        hamburgerButton.addEventListener('click', () => {
            mainNav.classList.toggle('nav-active');
            hamburgerButton.classList.toggle('is-active');
        });
    }

    // Close menu when a navigation link is clicked
    mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (mainNav.classList.contains('nav-active')) {
                mainNav.classList.remove('nav-active');
                hamburgerButton.classList.remove('is-active');
            }
        });
    });

    const sectionsToFade = document.querySelectorAll('.fade-in-section');

    const observerOptions = {
        root: null, // relative to the viewport
        rootMargin: '0px',
        threshold: 0.1 // trigger when 10% of the element is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Animate only once
            }
        });
    }, observerOptions);

    sectionsToFade.forEach(section => {
        observer.observe(section);
    });

    document.querySelectorAll('.watch-button').forEach(button => {
        button.addEventListener('click', (e) => {
            if (button.classList.contains('disabled')) return;
            e.preventDefault();

            const card = e.target.closest('.season-card');
            if (!card) return;

            const type = card.dataset.contentType;
            const id = card.dataset.contentId;

            if (type && id) {
                const url = `player.html?type=${type}&id=${id}`;
                window.open(url, '_blank'); // Open in a new tab
            }
        });
    });
});