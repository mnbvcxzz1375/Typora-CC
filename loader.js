/**
 * Typora-GPT Loader
 *
 * This script is injected into Typora's window.html to load the plugin.
 * It handles:
 * 1. Determining the plugin's base path
 * 2. Loading all plugin modules in order
 * 3. Initializing the plugin
 *
 * Installation: Add this script tag to the end of window.html's <body>:
 *   <script src="file:///E:/VScodeProject/Typora-GPT/loader.js"></script>
 */

(function () {
    'use strict';

    // Plugin base path - the directory containing this loader.js
    const PLUGIN_BASE = (function () {
        // Get the path of this script
        const scripts = document.querySelectorAll('script[src]');
        for (const script of scripts) {
            const src = script.src || script.getAttribute('src') || '';
            if (src.includes('loader.js') && src.includes('Typora-GPT')) {
                return src.substring(0, src.lastIndexOf('/') + 1);
            }
        }
        // Fallback: known path
        return 'file:///E:/VScodeProject/Typora-GPT/';
    })();

    // Set global base path for CSS loading
    window._typoraGPTBasePath = PLUGIN_BASE;

    // Module load order
    const MODULES = [
        'plugin/context.js',
        'plugin/llm.js',
        'plugin/writing.js',
        'plugin/ui.js',
        'plugin/main.js'
    ];

    // CSS file
    const CSS_FILE = 'plugin/css/style.css';

    /**
     * Load a script dynamically
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load: ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Load CSS
     */
    function loadCSS(href) {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = href;
            link.onload = resolve;
            link.onerror = resolve; // Don't fail on CSS errors
            document.head.appendChild(link);
        });
    }

    /**
     * Load all modules sequentially
     */
    async function loadAll() {
        console.log('[Typora-GPT Loader] Loading plugin from:', PLUGIN_BASE);

        try {
            // Load CSS first
            await loadCSS(PLUGIN_BASE + CSS_FILE);
            console.log('[Typora-GPT Loader] CSS loaded.');

            // Load modules in order
            for (const module of MODULES) {
                await loadScript(PLUGIN_BASE + module);
                console.log(`[Typora-GPT Loader] Loaded: ${module}`);
            }

            console.log('[Typora-GPT Loader] All modules loaded successfully.');
        } catch (e) {
            console.error('[Typora-GPT Loader] Error loading modules:', e);
        }
    }

    // Start loading when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAll);
    } else {
        loadAll();
    }
})();
