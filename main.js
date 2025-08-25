/**
 * A²M Application Module
 * 
 * Main application controller that manages routing, navigation, themes,
 * animations, and user interactions. Uses module pattern to prevent
 * global scope pollution and provides a clean public API.
 * 
 * @author A²M Team
 * @version 1.0.0
 */

const A2MApp = (() => {
    'use strict';

    // ========================================================================
    // CONFIGURATION & CONSTANTS
    // ========================================================================

    /**
     * Route mapping between hash names and page IDs
     * @type {Object<string, string>}
     */
    const routes = {
        'hub': 'page-hub',
        'products': 'page-products',
        'consulting': 'page-consulting',
        'privacy': 'page-privacy'
    };

    /**
     * Page-specific configuration including themes and CTA settings
     * @type {Object<string, Object>}
     */
    const pageConfig = {
        'page-hub': {
            theme: 'theme-hub',
            ctaText: 'Talk to Us',
            ctaHref: '#contact'
        },
        'page-products': {
            theme: 'theme-products',
            ctaText: 'Talk to Us',
            ctaHref: '#contact'
        },
        'page-consulting': {
            theme: 'theme-consulting',
            ctaText: 'Talk to Us',
            ctaHref: '#contact'
        },
        'page-privacy': {
            theme: 'theme-hub',
            ctaText: 'Talk to Us',
            ctaHref: '#contact'
        }
    };

    // Application state
    let hasInitialized = false;

    // Cached holders for logo sheen
    let _logoGrad = null;
    let _logoGlossGroup = null;

    // ========================================================================
    // DOM CACHE UTILITY
    // ========================================================================

    /**
     * DomCache - Micro helper to store & reuse expensive DOM queries
     * Provides caching for frequently accessed DOM elements to improve performance
     */
    const Dom = (() => {
        const store = new Map();

        /**
         * Internal query helper
         * @param {string} selector - CSS selector
         * @param {boolean} all - Whether to use querySelectorAll
         * @returns {Element|NodeList|null}
         */
        function q(selector, all = false) {
            return all ? document.querySelectorAll(selector) : document.querySelector(selector);
        }

        return {
            /**
             * Get cached DOM element or query and cache it
             * @param {string} key - Cache key
             * @param {string|null} selector - CSS selector (required on first call)
             * @param {boolean} all - Whether to use querySelectorAll
             * @returns {Element|NodeList|null}
             */
            $(key, selector = null, all = false) {
                if (store.has(key)) return store.get(key);
                if (!selector) throw new Error(`DomCache miss: "${key}" needs a selector`);
                const res = q(selector, all);
                store.set(key, res);
                return res;
            },

            /**
             * Clear specific keys or all cached elements
             * @param {string|string[]|null} keys - Keys to clear, or null for all
             */
            clear(keys = null) {
                if (!keys) return store.clear();
                [].concat(keys).forEach(k => store.delete(k));
            }
        };
    })();

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Throttle function execution to improve performance
     * @param {Function} fn - Function to throttle
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Throttled function
     */
    function throttle(fn, delay) {
        let last = 0;
        return (...args) => {
            const now = performance.now();
            if (now - last >= delay) {
                last = now;
                fn.apply(null, args);
            }
        };
    }

    function lowEndDevice() {
        const mem = navigator.deviceMemory || 4;           // GB
        const cores = navigator.hardwareConcurrency || 4;
        const conn = navigator.connection && navigator.connection.effectiveType;
        const slowNet = conn && /2g|3g/.test(conn);
        return mem <= 2 || cores <= 4 || slowNet;
    }

    // ========================================================================
    // CACHED DOM ELEMENTS
    // ========================================================================

    const $pages = Dom.$('pages', '.page-content', true);
    const $navLinks = Dom.$('navLinks', '.nav-link', true);
    const $mains = Dom.$('mains', '.page-content > main', true);
    const $body = Dom.$('body', 'body');
    const $ctaBtn = Dom.$('ctaBtn', '#cta-button');
    const $header = Dom.$('header', '#main-header');
    const $mobLinks = Dom.$('mobLinks', '.mobile-nav-link', true);

    // ========================================================================
    // ERROR HANDLING
    // ========================================================================

    /**
     * Centralized error handling utility
     */
    const ErrorHandler = {
        /**
         * Log error to console with context
         * @param {Error} error - Error object
         * @param {string} context - Context description
         */
        log(error, context = '') {
            console.error(`[A2MApp Error] ${context}:`, error);
        },

        /**
         * Show user-friendly error message
         * @param {string} message - Error message to display
         * @param {string} context - Error context
         */
        show(message, context = 'Application Error') {
            try {
                const errorContainer = document.getElementById('error-message');
                const errorText = document.getElementById('error-text');

                if (errorContainer && errorText) {
                    errorText.textContent = `${context}: ${message}`;
                    errorContainer.classList.add('show');

                    // Auto-hide after 5 seconds
                    setTimeout(() => {
                        errorContainer.classList.remove('show');
                    }, 5000);
                }
            } catch (e) {
                console.error('Failed to show error message:', e);
            }
        },

        /**
         * Hide error message
         */
        hide() {
            try {
                const errorContainer = document.getElementById('error-message');
                if (errorContainer) {
                    errorContainer.classList.remove('show');
                }
            } catch (e) {
                console.error('Failed to hide error message:', e);
            }
        }
    };

    // ========================================================================
    // PAGE MANAGEMENT
    // ========================================================================

    /**
     * Show specific page and handle associated state changes
     * @param {string} pageId - Page identifier (hash name or page ID)
     * @param {Object} options - Display options
     * @param {boolean} options.focus - Whether to focus page heading
     * @param {boolean} options.smoothScroll - Whether to smooth scroll to top
     */
    function showPage(pageId, options = {}) {
        try {
            ErrorHandler.hide(); // Hide any existing errors

            const { focus = true, smoothScroll = true } = options;

            // Handle both hash names and page IDs
            const actualPageId = pageId.startsWith('page-') ? pageId : routes[pageId];
            if (!actualPageId) {
                throw new Error(`Invalid page identifier: ${pageId}`);
            }

            // Verify page exists
            const activePage = document.getElementById(actualPageId);
            if (!activePage) {
                throw new Error(`Page element not found: ${actualPageId}`);
            }

            // Toggle active class and accessibility attributes
            $pages.forEach(page => {
                const isActive = (page.id === actualPageId);
                page.classList.toggle('active', isActive);
                page.setAttribute('aria-hidden', (!isActive).toString());
            });

            // Apply page configuration
            const config = pageConfig[actualPageId];
            if (config) {
                updateTheme(config.theme);
                updateCTAButton(config.ctaText, config.ctaHref);
                updateNavigation(pageId);
            }

            // Handle focus management
            if (focus) {
                focusPageHeading(activePage);
            }

            // Scroll to top
            scrollToTop(smoothScroll);

            // Re-run logo sheen on route change (throttled)
            if (typeof triggerLogoGlossThrottled === 'function') {
                triggerLogoGlossThrottled();
            }

        } catch (error) {
            ErrorHandler.log(error, 'showPage');
            ErrorHandler.show('We couldn\'t load that section. Please try again.', 'Navigation Error');

            // Fallback to hub page if current page failed
            if (pageId !== 'hub') {
                showPage('hub', { focus: false, smoothScroll: false });
            }
        }
    }

    /**
     * Scroll to top of page
     * @param {boolean} smooth - Whether to use smooth scrolling
     */
    function scrollToTop(smooth = true) {
        try {
            window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
        } catch (e) {
            // Fallback for older browsers
            window.scrollTo(0, 0);
        }
    }

    /**
     * Update page theme
     * @param {string} newTheme - New theme class name
     */
    function updateTheme(newTheme) {
        $body.classList.remove('theme-hub', 'theme-consulting', 'theme-products');
        $body.classList.add(newTheme);
    }

    /**
     * Update CTA button text and href
     * @param {string} text - Button text
     * @param {string} href - Button href
     */
    function updateCTAButton(text, href) {
        $ctaBtn.textContent = text;
        $ctaBtn.setAttribute('href', href);
    }

    /**
     * Update navigation active states
     * @param {string} currentPage - Current page identifier
     */
    function updateNavigation(currentPage) {
        try {
            // Update desktop navigation
            $navLinks.forEach(link => {
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            });

            const activeLink = [...$navLinks].find(l => l.dataset.page === currentPage);
            if (activeLink) {
                activeLink.classList.add('active');
                activeLink.setAttribute('aria-current', 'page');
            }

            // Update mobile navigation
            if (MobileNav.menu) {
                MobileNav.updateActiveLink(currentPage);
            }

        } catch (error) {
            ErrorHandler.log(error, 'updateNavigation');
        }
    }

    /**
     * Focus page heading for accessibility
     * @param {Element} activePage - Active page element
     */
    function focusPageHeading(activePage) {
        try {
            const firstHeading = activePage.querySelector('h1');
            if (firstHeading) {
                if (!firstHeading.hasAttribute('tabindex')) {
                    firstHeading.setAttribute('tabindex', '-1');
                }
                firstHeading.focus({ preventScroll: true });
            }
        } catch (error) {
            ErrorHandler.log(error, 'focusPageHeading');
        }
    }

    // ========================================================================
    // NAVIGATION HANDLERS
    // ========================================================================

    /**
     * Handle hash change events
     */
    function handleHashChange() {
        try {
            const hash = window.location.hash.slice(1) || 'hub'; // Remove # and default to hub
            showPage(hash, { focus: hasInitialized, smoothScroll: hasInitialized });
            if (!hasInitialized) hasInitialized = true;
        } catch (error) {
            ErrorHandler.log(error, 'handleHashChange');
            ErrorHandler.show('Failed to navigate to page', 'Navigation Error');
        }
    }

    /**
     * Navigate to specific page
     * @param {string} pageName - Page name to navigate to
     */
    function navigateToPage(pageName) {
        try {
            if (!pageName || typeof pageName !== 'string') {
                throw new Error('Invalid page name provided');
            }
            window.location.hash = pageName;
        } catch (error) {
            ErrorHandler.log(error, 'navigateToPage');
            ErrorHandler.show('Failed to navigate to page', 'Navigation Error');
        }
    }

    // ========================================================================
    // LOGO ANIMATIONS
    // ========================================================================

    /**
     * Animate the logo stroke once on first paint (respects reduced motion)
     * Currently commented out for testing - re-enable for production
     */
    function setupLogoDrawOnce() {
        try {
            const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
            // TODO: comment out for testing (because I have reduced motion active), re-enable for production.
            // if (mql.matches) return; // do nothing if user prefers less motion

            const logoPaths = document.querySelectorAll('.logo-path');
            if (!logoPaths.length) return;

            // Add class after a tick to ensure layout is ready
            requestAnimationFrame(() => {
                logoPaths.forEach(p => p.classList.add('draw'));
                // Remove the class after animation to avoid retriggering on theme swaps
                setTimeout(() => logoPaths.forEach(p => p.classList.remove('draw')), 1600);
            });
        } catch (error) {
            ErrorHandler.log(error, 'setupLogoDrawOnce');
        }
    }

    /**
     * Logo-masked gloss: one-time gradient sweep on header logo
     * Creates a shimmer effect that sweeps across the logo
     */
    function ensureLogoGloss() {
        const headerLogo = document.querySelector('#main-header svg');
        if (!headerLogo) return null;

        const svgNS = 'http://www.w3.org/2000/svg';
        let defs = headerLogo.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS(svgNS, 'defs');
            headerLogo.insertBefore(defs, headerLogo.firstChild);
        }

        // 1) Gradient once
        if (!_logoGrad) {
            const route = (location.hash || '#hub').replace('#', '');
            let accentVar = '--hub-primary';
            if (route === 'products') accentVar = '--products-primary';
            else if (route === 'consulting') accentVar = '--consulting-primary';
            const accent = getComputedStyle(document.documentElement).getPropertyValue(accentVar).trim() || '#ffffff';

            const grad = document.createElementNS(svgNS, 'linearGradient');
            grad.setAttribute('id', 'logoGlossGradient');
            grad.setAttribute('x1', '0');
            grad.setAttribute('y1', '0');
            grad.setAttribute('x2', '1');
            grad.setAttribute('y2', '0');
            grad.setAttribute('gradientUnits', 'objectBoundingBox');

            const stops = [
                { offset: '0%', color: '#ffffff', opacity: '0' },
                { offset: '50%', color: accent, opacity: '0.9' },
                { offset: '100%', color: '#ffffff', opacity: '0' }
            ];
            stops.forEach(s => {
                const st = document.createElementNS(svgNS, 'stop');
                st.setAttribute('offset', s.offset);
                st.setAttribute('stop-color', s.color);
                st.setAttribute('stop-opacity', s.opacity);
                grad.appendChild(st);
            });
            defs.appendChild(grad);
            _logoGrad = grad;
        }

        // 2) Overlay once (clone the strokes a single time)
        if (!_logoGlossGroup) {
            const group = document.createElementNS(svgNS, 'g');
            group.setAttribute('id', 'logo-gloss');
            group.setAttribute('class', 'logo-gloss-layer hidden');

            const strokes = headerLogo.querySelectorAll('.logo-path');
            strokes.forEach(src => {
                const clone = document.createElementNS(svgNS, 'path');
                clone.setAttribute('d', src.getAttribute('d'));
                clone.setAttribute('fill', 'none');
                clone.setAttribute('stroke', 'url(#logoGlossGradient)');
                clone.setAttribute('stroke-width', src.getAttribute('stroke-width') || '3');
                clone.setAttribute('stroke-linecap', 'round');
                group.appendChild(clone);
            });

            headerLogo.appendChild(group);
            _logoGlossGroup = group;
        }
        return { grad: _logoGrad, gloss: _logoGlossGroup };
    }

    // Animate only the gradientTransform; no node churn
    function runLogoSheenOnce() {
        const parts = ensureLogoGloss();
        if (!parts) return;
        const { grad, gloss } = parts;

        gloss.classList.remove('hidden'); // reveal overlay

        const duration = 1200;
        const start = performance.now();
        function animate(t) {
            const p = Math.min((t - start) / duration, 1);
            const tx = -0.8 + (p * 2.6);
            grad.setAttribute('gradientTransform', `translate(${tx},0)`);
            if (p < 1) {
                requestAnimationFrame(animate);
            } else {
                grad.removeAttribute('gradientTransform');
                gloss.classList.add('hidden'); // hide until next run
            }
        }
        requestAnimationFrame(animate);
    }

    // 1.2s throttle, identical cadence
    const triggerLogoGlossThrottled = (() => {
        let last = -1e9;
        return () => {
            const now = performance.now();
            if (now - last < 1200) return;
            last = now;
            runLogoSheenOnce();
        };
    })();

    // ========================================================================
    // HEADER & LAYOUT MANAGEMENT
    // ========================================================================

    /**
     * Measure fixed header height and offset page content accordingly
     */
    function applyHeaderOffset() {
        try {
            const h = $header.getBoundingClientRect().height;
            $mains.forEach(m => { m.style.paddingTop = h + 'px'; });
        } catch (error) {
            ErrorHandler.log(error, 'applyHeaderOffset');
        }
    }

    /**
     * Observe header size changes and re-apply offset automatically
     */
    function setupHeaderObserver() {
        try {
            const header = document.getElementById('main-header');
            if (!header) return;

            if (typeof ResizeObserver === 'undefined') {
                // Fallback: at least apply once
                applyHeaderOffset();
                return;
            }

            const ro = new ResizeObserver(applyHeaderOffset);
            ro.observe(header);
        } catch (error) {
            ErrorHandler.log(error, 'setupHeaderObserver');
        }
    }

    // ========================================================================
    // KINETIC BACKGROUND ANIMATION
    // ========================================================================

    /**
     * Scroll-driven kinetic background (position -> 0..360deg)
     * Creates a rotating background effect based on scroll position
     */
    function setupKineticScrollMotion() {
        try {
            const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
            // TODO: comment out for testing (because I have reduced motion active), re-enable for production.
            // if (mql.matches) return; // do nothing if user prefers less motion

            const bg = document.querySelector('.kinetic-bg');
            if (!bg) return;

            // Pause/resume CSS drift when tab visibility changes
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    bg.style.animationPlayState = 'paused';
                } else {
                    bg.style.animationPlayState = 'running';
                }
            });

            // Only handle scroll-based rotation, CSS handles drift
            let progress = 0;

            /**
             * Calculate scroll progress as percentage
             * @returns {number} Progress from 0 to 1
             */
            const computeProgress = () => {
                const doc = document.documentElement;
                const maxScroll = Math.max(1, (doc.scrollHeight - window.innerHeight));
                const y = Math.min(maxScroll, Math.max(0, window.scrollY || 0));
                return y / maxScroll;
            };

            /**
             * Update scroll-based rotation
             */
            const updateScrollRotation = () => {
                progress = computeProgress();
                const scrollAngle = progress * 360;
                bg.style.setProperty('--mix-angle', scrollAngle.toFixed(2) + 'deg');
            };

            // Initial setup
            updateScrollRotation();

            // Throttled scroll updates
            let scrollTimer;
            const handleScroll = () => {
                if (scrollTimer) return;
                scrollTimer = requestAnimationFrame(() => {
                    updateScrollRotation();
                    scrollTimer = null;
                });
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
            window.addEventListener('resize', updateScrollRotation, { passive: true });

        } catch (error) {
            ErrorHandler.log(error, 'setupKineticScrollMotion');
        }
    }

    // ========================================================================
    // MOBILE NAVIGATION
    // ========================================================================

    /**
     * Mobile Navigation Management
     * Handles mobile menu state, interactions, and accessibility
     */
    const MobileNav = {
        isOpen: false,
        toggle: null,
        menu: null,
        backdrop: null,

        /**
         * Initialize mobile navigation
         */
        init() {
            try {
                this.toggle = document.querySelector('.mobile-menu-toggle');
                this.menu = document.getElementById('mobile-menu');
                if (!this.toggle || !this.menu) return;

                // Set initial position
                this.updateMenuPosition();

                // Create backdrop element
                this.createBackdrop();

                // Setup event listeners
                this.setupEventListeners();

            } catch (error) {
                ErrorHandler.log(error, 'MobileNav.init');
            }
        },

        /**
         * Setup all mobile navigation event listeners
         */
        setupEventListeners() {
            // Toggle button
            this.toggle.addEventListener('click', () => this.toggleMenu());

            // Close menu when clicking backdrop
            if (this.backdrop) {
                this.backdrop.addEventListener('click', () => this.closeMenu());
            }

            // Close menu when clicking nav links
            this.menu.addEventListener('click', (e) => {
                if (e.target.matches('[data-page]')) {
                    this.closeMenu();
                }
            });

            // Handle keyboard navigation
            document.addEventListener('keydown', (e) => this.handleKeydown(e));

            // Close menu on window resize to desktop size
            window.addEventListener('resize', () => {
                if (window.innerWidth >= 768 && this.isOpen) {
                    this.closeMenu();
                }
            });
        },

        /**
         * Create backdrop element for mobile menu
         */
        createBackdrop() {
            try {
                this.backdrop = document.createElement('div');
                this.backdrop.className = 'mobile-nav-backdrop';
                this.backdrop.setAttribute('aria-hidden', 'true');
                document.body.appendChild(this.backdrop);
            } catch (error) {
                ErrorHandler.log(error, 'MobileNav.createBackdrop');
            }
        },

        /**
         * Toggle mobile menu open/closed
         */
        toggleMenu() {
            if (this.isOpen) {
                this.closeMenu();
            } else {
                this.openMenu();
            }
        },

        /**
         * Open mobile menu
         */
        openMenu() {
            try {
                this.isOpen = true;

                // Update button state
                this.updateToggleButton(true);

                // Show menu and backdrop
                this.menu.classList.add('open');
                this.menu.setAttribute('aria-hidden', 'false');

                if (this.backdrop) {
                    this.backdrop.classList.add('open');
                }

                // Prevent body scroll
                document.body.classList.add('mobile-menu-open');

                // Focus first menu item
                const firstLink = this.menu.querySelector('.mobile-nav-link');
                if (firstLink) {
                    setTimeout(() => firstLink.focus(), 100);
                }

            } catch (error) {
                ErrorHandler.log(error, 'MobileNav.openMenu');
            }
        },

        /**
         * Close mobile menu
         */
        closeMenu() {
            try {
                this.isOpen = false;

                // Update button state
                this.updateToggleButton(false);

                // Hide menu and backdrop
                this.menu.classList.remove('open');
                this.menu.setAttribute('aria-hidden', 'true');

                if (this.backdrop) {
                    this.backdrop.classList.remove('open');
                }

                // Re-enable body scroll
                document.body.classList.remove('mobile-menu-open');

            } catch (error) {
                ErrorHandler.log(error, 'MobileNav.closeMenu');
            }
        },

        /**
         * Update toggle button state
         * @param {boolean} isActive - Whether menu is active
         */
        updateToggleButton(isActive) {
            this.toggle.classList.toggle('active', isActive);
            this.toggle.setAttribute('aria-expanded', isActive.toString());

            const menuIcon = this.toggle.querySelector('.menu-icon');
            const closeIcon = this.toggle.querySelector('.close-icon');

            if (menuIcon && closeIcon) {
                menuIcon.classList.toggle('hidden', isActive);
                closeIcon.classList.toggle('hidden', !isActive);
            }
        },

        /**
         * Update menu position based on header height
         */
        updateMenuPosition() {
            try {
                const header = document.getElementById('main-header');
                if (header && this.menu) {
                    const headerHeight = header.getBoundingClientRect().height;
                    this.menu.style.marginTop = `${headerHeight}px`;
                    this.menu.style.maxHeight = `calc(100vh - ${headerHeight}px)`;
                }
            } catch (error) {
                ErrorHandler.log(error, 'MobileNav.updateMenuPosition');
            }
        },

        /**
         * Handle keyboard navigation
         * @param {KeyboardEvent} e - Keyboard event
         */
        handleKeydown(e) {
            try {
                if (!this.isOpen) return;

                if (e.key === 'Escape') {
                    this.closeMenu();
                    this.toggle.focus();
                    return;
                }

                // Trap focus within mobile menu
                if (e.key === 'Tab') {
                    this.trapFocus(e);
                }

            } catch (error) {
                ErrorHandler.log(error, 'MobileNav.handleKeydown');
            }
        },

        /**
         * Trap focus within mobile menu
         * @param {KeyboardEvent} e - Tab key event
         */
        trapFocus(e) {
            try {
                const focusableElements = this.menu.querySelectorAll(
                    'a, button, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            } catch (error) {
                ErrorHandler.log(error, 'MobileNav.trapFocus');
            }
        },

        /**
         * Update active link in mobile navigation
         * @param {string} currentPage - Current page identifier
         */
        updateActiveLink(currentPage) {
            try {
                $mobLinks.forEach(link => {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                });
                const activeLink = [...$mobLinks].find(l => l.dataset.page === currentPage);
                if (activeLink) {
                    activeLink.classList.add('active');
                    activeLink.setAttribute('aria-current', 'page');
                }
            } catch (error) {
                ErrorHandler.log(error, 'MobileNav.updateActiveLink');
            }
        }
    };

    // ========================================================================
    // GLASS CARD EFFECTS
    // ========================================================================

    /**
     * Glass cards – stencil, wrapper, filter-off (idempotent)
     * Enhances glass card elements with stencil effects for better performance
     */
    function enhanceGlassCards() {
        try {
            const selector = '.glass, .glass--light, .glass--strong';

            document.querySelectorAll(selector).forEach(card => {
                // 1 — add stencil only once
                if (!card.querySelector(':scope > .glass-stencil')) {
                    const stencil = document.createElement('div');
                    stencil.className = 'glass-stencil';
                    card.prepend(stencil);
                }

                // 2 — wrap existing children (except stencil) in .card-inner
                if (!card.querySelector(':scope > .card-inner')) {
                    const inner = document.createElement('div');
                    inner.className = 'card-inner';

                    [...card.children].forEach(child => {
                        if (!child.classList.contains('glass-stencil')) {
                            inner.appendChild(child);
                        }
                    });

                    card.appendChild(inner);
                }

                // 3 — disable the original heavy blur on this card
                card.style.backdropFilter = 'none';
                card.style.webkitBackdropFilter = 'none';

                // Ensure positioning context for absolute stencil
                if (getComputedStyle(card).position === 'static') {
                    card.style.position = 'relative';
                }
            });
        } catch (err) {
            ErrorHandler.log(err, 'enhanceGlassCards');
        }
    }

    // ========================================================================
    // ACCESSIBILITY & UX FEATURES
    // ========================================================================

    /**
     * Setup skip link functionality for accessibility
     */
    function setupSkipLink() {
        try {
            const skipLink = document.querySelector('.skip-link');
            if (!skipLink) return;

            // Make skip link reliably reachable as first tab stop on macOS default settings
            let firstTabHandled = false;

            document.addEventListener('keydown', (e) => {
                try {
                    if (e.key !== 'Tab' || e.shiftKey || firstTabHandled) return;

                    const ae = document.activeElement;
                    const isAtDocumentStart = !ae || ae === document.body || ae === document.documentElement;

                    if (isAtDocumentStart) {
                        firstTabHandled = true;
                        e.preventDefault();
                        skipLink.focus();
                    }
                } catch (error) {
                    ErrorHandler.log(error, 'skip link keydown handler');
                }
            });

            // On activation, focus the target headline robustly
            skipLink.addEventListener('click', (e) => {
                try {
                    const href = skipLink.getAttribute('href');
                    if (href && href.startsWith('#')) {
                        const target = document.getElementById(href.slice(1));
                        if (target) {
                            e.preventDefault();

                            // Ensure container/page is visible
                            const pageId = 'hub';
                            showPage(pageId, { focus: false, smoothScroll: true });

                            // Temporarily make target focusable if needed and focus it
                            const hadTabindex = target.hasAttribute('tabindex');
                            if (!hadTabindex) target.setAttribute('tabindex', '-1');
                            target.focus({ preventScroll: true });
                            if (!hadTabindex) target.removeAttribute('tabindex');
                        }
                    }
                } catch (error) {
                    ErrorHandler.log(error, 'skip link click handler');
                }
            });

        } catch (error) {
            ErrorHandler.log(error, 'setupSkipLink');
        }
    }

    // ========================================================================
    // EVENT LISTENERS SETUP
    // ========================================================================

    /**
     * Setup all global event listeners
     */
    function setupEventListeners() {
        try {
            // Event delegation for navigation
            document.addEventListener('click', (e) => {
                try {
                    if (e.target && e.target.matches('[data-page]')) {
                        e.preventDefault();
                        const pageName = e.target.dataset.page;
                        if (pageName) {
                            navigateToPage(pageName);
                        }
                    }
                } catch (error) {
                    ErrorHandler.log(error, 'navigation click handler');
                }
            });

            // Hash change listener
            window.addEventListener('hashchange', handleHashChange);

            // Error event listeners
            window.addEventListener('error', (e) => {
                ErrorHandler.log(e.error, 'Global error handler');
            });

            window.addEventListener('unhandledrejection', (e) => {
                ErrorHandler.log(e.reason, 'Unhandled promise rejection');
            });

            // Keep content offset correct when viewport changes
            window.addEventListener('resize', throttle(applyHeaderOffset, 150));

        } catch (error) {
            ErrorHandler.log(error, 'setupEventListeners');
        }
    }

    // ========================================================================
    // INITIALIZATION FUNCTIONS
    // ========================================================================

    /**
     * Initialize Lucide icons
     */
    function initializeLucideIcons() {
        try {
            // Lazy load Lucide icons
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            } else {
                // Retry after a short delay if lucide hasn't loaded yet
                setTimeout(() => {
                    if (typeof lucide !== 'undefined' && lucide.createIcons) {
                        lucide.createIcons();
                    }
                }, 100);
            }
        } catch (error) {
            ErrorHandler.log(error, 'initializeLucideIcons');
        }
    }

    /**
     * Setup logo interaction handlers
     */
    function setupLogoInteractions() {
        try {
            const logoLink = document.querySelector('#main-header a[aria-label="A²M Home"]');
            if (logoLink) {
                logoLink.addEventListener('mouseenter', triggerLogoGlossThrottled);
                logoLink.addEventListener('focusin', triggerLogoGlossThrottled);
            }
        } catch (error) {
            ErrorHandler.log(error, 'setupLogoInteractions');
        }
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Initialize the entire application
     */
    function init() {
        try {
            if (lowEndDevice()) {
                document.documentElement.classList.add('low-end');
            }

            // Core functionality
            setupEventListeners();
            setupSkipLink();
            enhanceGlassCards();

            // Defer icons; fallback if requestIdleCallback not available
            const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 120));
            idle(() => initializeLucideIcons());

            // Initialize mobile navigation
            MobileNav.init();

            // Browser configuration
            if ('scrollRestoration' in history) {
                history.scrollRestoration = 'manual';
            }

            // Layout setup
            applyHeaderOffset();
            setupHeaderObserver();

            // Handle initial page load
            handleHashChange();

            // Animation setup
            setupKineticScrollMotion();
            setupLogoInteractions();

            // Visual polish hooks (disabled for testing)
            // setupLogoDrawOnce();

            // Trigger initial logo sheen
            idle(() => triggerLogoGlossThrottled());

        } catch (error) {
            ErrorHandler.log(error, 'init');
            ErrorHandler.show('Application failed to initialize properly', 'Initialization Error');
        }
    }

    // Return public interface
    return {
        init,
        showPage,
        navigateToPage,
        ErrorHandler,
        // Expose for testing/debugging
        MobileNav,
        Dom
    };

})();

// ========================================================================
// APPLICATION BOOTSTRAP
// ========================================================================

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        A2MApp.init();
    } catch (error) {
        console.error('Failed to initialize A2M application:', error);
    }
});
