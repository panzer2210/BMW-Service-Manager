class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('bmw-theme') || 'light';
        this.init();
    }

    init() {
        // Force light theme only
        this.currentTheme = 'light';
        this.applyTheme(this.currentTheme);
        // Don't create theme toggle since we're removing dark mode
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        localStorage.setItem('bmw-theme', theme);
        
        // Update toggle button if it exists
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) {
            toggle.setAttribute('data-theme', theme);
            toggle.title = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
        }

        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        
        // Add smooth transition effect
        document.body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    createThemeToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'theme-toggle bmw-glow';
        toggle.setAttribute('data-theme', this.currentTheme);
        toggle.title = this.currentTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
        toggle.innerHTML = `
            <span class="theme-icon sun-icon">☀️</span>
            <span class="theme-icon moon-icon">🌙</span>
        `;
        
        toggle.addEventListener('click', () => this.toggleTheme());
        
        // Add to navigation
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            const li = document.createElement('li');
            li.appendChild(toggle);
            navLinks.insertBefore(li, navLinks.firstChild);
        }
    }

    setupEventListeners() {
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
            if (!localStorage.getItem('bmw-theme-user-set')) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });

        // Mark theme as user-set when manually changed
        window.addEventListener('themeChanged', () => {
            localStorage.setItem('bmw-theme-user-set', 'true');
        });
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager = new ThemeManager();
    });
} else {
    window.themeManager = new ThemeManager();
}

// BMW-specific theme utilities
window.BMWTheme = {
    addGlow: (element) => {
        element.classList.add('bmw-glow');
    },
    
    removeGlow: (element) => {
        element.classList.remove('bmw-glow');
    },
    
    addGradient: (element) => {
        element.classList.add('bmw-gradient');
    },
    
    createNotificationBadge: (count) => {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.textContent = count > 99 ? '99+' : count;
        return badge;
    },

    animateElement: (element, animation = 'pulse') => {
        element.style.animation = `${animation} 0.6s ease`;
        setTimeout(() => {
            element.style.animation = '';
        }, 600);
    }
};