/**
 * Typora-GPT Plugin - Main Entry Point
 * Keyboard shortcut: Ctrl+Shift+G to toggle the sidebar
 */

(function () {
    'use strict';

    const PLUGIN_NAME = 'Typora-GPT';
    const PLUGIN_VERSION = '1.0.0';

    const TyporaGPTPlugin = {
        initialized: false,
        toggleBtn: null,
        _retryCount: 0,
        _maxRetries: 20,

        init() {
            if (this.initialized) return;
            if (!window.TyporaGPT || !window.TyporaGPT.UI || !window.TyporaGPT.LLM) {
                this._retryCount++;
                if (this._retryCount > this._maxRetries) {
                    console.error('[Typora-GPT] Modules failed to load after ' + this._maxRetries + ' retries.');
                    console.error('[Typora-GPT] Available:', Object.keys(window.TyporaGPT || {}));
                    return;
                }
                setTimeout(() => this.init(), 300);
                return;
            }
            try {
                this._loadCSS();
                window.TyporaGPT.UI.build();
                this._createToggleButton();
                this.initialized = true;
                console.log('[Typora-GPT] v' + PLUGIN_VERSION + ' initialized. Press Ctrl+Shift+G to toggle.');
            } catch (e) {
                console.error('[Typora-GPT] Init failed:', e);
            }
        },

        _loadCSS() {
            if (document.getElementById('typora-gpt-css')) return;
            var basePath = window._typoraGPTBasePath || './typora-gpt/';
            var link = document.createElement('link');
            link.id = 'typora-gpt-css';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = basePath + 'plugin/css/style.css';
            document.head.appendChild(link);
        },

        _createToggleButton() {
            if (document.getElementById('typora-gpt-toggle-btn')) return;
            this.toggleBtn = document.createElement('button');
            this.toggleBtn.id = 'typora-gpt-toggle-btn';
            this.toggleBtn.textContent = 'G';
            this.toggleBtn.title = 'Toggle MarkPilot (Ctrl+Shift+G)';
            document.body.appendChild(this.toggleBtn);

            let isDragging = false;
            let startX = 0, startY = 0, startRight = 0, startBottom = 0;
            let hasMoved = false;

            this.toggleBtn.addEventListener('mousedown', (e) => {
                isDragging = true;
                hasMoved = false;
                startX = e.clientX;
                startY = e.clientY;
                startRight = parseInt(window.getComputedStyle(this.toggleBtn).right);
                startBottom = parseInt(window.getComputedStyle(this.toggleBtn).bottom);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
                if (!hasMoved) return;
                const newRight = Math.max(14, Math.min(window.innerWidth - 54, startRight - dx));
                const newBottom = Math.max(14, Math.min(window.innerHeight - 54, startBottom - dy));
                this.toggleBtn.style.right = newRight + 'px';
                this.toggleBtn.style.bottom = newBottom + 'px';
                document.body.style.cursor = 'move';
                document.body.style.userSelect = 'none';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    if (!hasMoved) window.TyporaGPT.UI.toggle();
                }
            });
        },

        destroy() {
            if (!this.initialized) return;
            if (window.TyporaGPT && window.TyporaGPT.UI) window.TyporaGPT.UI.destroy();
            if (this.toggleBtn) { this.toggleBtn.remove(); this.toggleBtn = null; }
            this.initialized = false;
        }
    };

    window.TyporaGPTPlugin = TyporaGPTPlugin;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { TyporaGPTPlugin.init(); });
    } else {
        TyporaGPTPlugin.init();
    }

    document.addEventListener('typora-gpt-ready', function() {
        if (!TyporaGPTPlugin.initialized) TyporaGPTPlugin.init();
    });

    window.addEventListener('load', function() {
        if (!TyporaGPTPlugin.initialized) TyporaGPTPlugin.init();
    });
})();
