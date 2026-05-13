/**
 * Typora-GPT Loader v1.1
 * Handles Typora's custom protocol and path resolution.
 */

(function () {
    'use strict';

    // Detect the base path for the plugin directory
    // Try multiple strategies to handle Typora's protocol
    function detectBasePath() {
        // Strategy 1: Find our own script tag and derive path
        var scripts = document.querySelectorAll('script[src]');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute('src') || '';
            var lowerSrc = src.toLowerCase();
            if ((lowerSrc.indexOf('typora-gpt') !== -1 || lowerSrc.indexOf('typora-cc') !== -1) && lowerSrc.indexOf('loader') !== -1) {
                // Found our loader script - base is its directory
                var base = src.substring(0, src.lastIndexOf('/') + 1);
                console.log('[Typora-GPT] Detected base path from script tag: ' + base);
                return base;
            }
        }

        // Strategy 2: Known paths
        var candidates = [
            './Typora-CC/',
            './typora-gpt/',
            'typora-gpt/',
            'resources/typora-gpt/'
        ];

        console.log('[Typora-GPT] Script tag not found, trying candidates...');
        return candidates[0]; // Default fallback
    }

    var PLUGIN_BASE = detectBasePath();
    window._typoraGPTBasePath = PLUGIN_BASE;

    var MODULES = [
        'plugin/context.js',
        'plugin/llm.js',
        'plugin/media.js',
        'plugin/features.js',
        'plugin/history.js',
        'plugin/skills.js',
        'plugin/tools.js',
        'plugin/writing.js',
        'plugin/ui.js',
        'plugin/main.js'
    ];

    var CSS_FILE = 'plugin/css/style.css';

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.onload = function () {
                console.log('[Typora-GPT] Loaded: ' + src);
                resolve();
            };
            script.onerror = function (e) {
                console.error('[Typora-GPT] FAILED to load: ' + src);
                reject(new Error('Failed to load: ' + src));
            };
            document.head.appendChild(script);
        });
    }

    function loadCSS(href) {
        return new Promise(function (resolve) {
            var link = document.createElement('link');
            link.id = 'typora-gpt-css';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = href;
            link.onload = function () { console.log('[Typora-GPT] CSS loaded'); resolve(); };
            link.onerror = function () { console.warn('[Typora-GPT] CSS load failed, continuing...'); resolve(); };
            document.head.appendChild(link);
        });
    }

    function loadAll() {
        console.log('[Typora-GPT] Starting plugin load from: ' + PLUGIN_BASE);

        // Load CSS first (non-blocking)
        loadCSS(PLUGIN_BASE + CSS_FILE);

        // Load modules sequentially
        var chain = Promise.resolve();
        MODULES.forEach(function (mod) {
            chain = chain.then(function () {
                return loadScript(PLUGIN_BASE + mod);
            });
        });

        chain.then(function () {
            console.log('[Typora-GPT] All modules loaded successfully.');
            // Dispatch custom event for other code to know plugin is ready
            document.dispatchEvent(new CustomEvent('typora-gpt-ready'));
        }).catch(function (e) {
            console.error('[Typora-GPT] Module loading failed:', e.message);
            console.error('[Typora-GPT] Base path was: ' + PLUGIN_BASE);
            console.error('[Typora-GPT] Make sure the typora-gpt folder exists in Typora resources directory.');
        });
    }

    // Start loading when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAll);
    } else {
        // DOM already loaded (Typora loads scripts at end of body)
        // Small delay to ensure Typora's own scripts are ready
        setTimeout(loadAll, 100);
    }
})();
