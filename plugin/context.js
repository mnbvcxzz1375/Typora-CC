/**
 * Typora-GPT Context Module
 * Extracts content from the current document and folder for LLM context.
 */

const ContextModule = {
    /**
     * Get the current document's markdown source content
     * @param {number} maxLength - Maximum characters to return
     * @returns {string} Document content
     */
    getCurrentDocumentContent(maxLength = 50000) {
        try {
            // Method 1: Try to get from Typora's internal API
            if (typeof File !== 'undefined' && File.editor) {
                // Try sourceCode mode content
                const sourceEl = document.querySelector('#typora-source');
                if (sourceEl && sourceEl.textContent.trim()) {
                    const content = sourceEl.textContent.trim();
                    return content.length > maxLength
                        ? content.substring(0, maxLength) + '\n\n[... Content truncated ...]'
                        : content;
                }

                // Try getting from the write area
                const writeEl = document.querySelector('#write');
                if (writeEl) {
                    // Get the innerText which preserves structure reasonably
                    const content = writeEl.innerText || writeEl.textContent || '';
                    if (content.trim()) {
                        return content.length > maxLength
                            ? content.substring(0, maxLength) + '\n\n[... Content truncated ...]'
                            : content;
                    }
                }
            }

            // Method 2: Try the #write element directly
            const writeEl = document.querySelector('#write');
            if (writeEl) {
                const content = writeEl.innerText || writeEl.textContent || '';
                return content.length > maxLength
                    ? content.substring(0, maxLength) + '\n\n[... Content truncated ...]'
                    : content;
            }

            return '';
        } catch (e) {
            console.error('[Typora-GPT] Error getting document content:', e);
            return '';
        }
    },

    /**
     * Get the current file path
     * @returns {string} File path or empty string
     */
    getCurrentFilePath() {
        try {
            // Try Typora's File object
            if (typeof File !== 'undefined' && File.filePath) {
                return File.filePath;
            }

            // Try from document title or other hints
            const titleEl = document.querySelector('#title-text');
            if (titleEl) {
                return titleEl.textContent || '';
            }

            return '';
        } catch (e) {
            return '';
        }
    },

    /**
     * Get the current file name
     * @returns {string} File name
     */
    getCurrentFileName() {
        const path = this.getCurrentFilePath();
        if (path) {
            return path.split(/[\\/]/).pop() || path;
        }
        return 'Untitled';
    },

    /**
     * Get the current folder path
     * @returns {string} Folder path
     */
    getCurrentFolderPath() {
        try {
            if (typeof File !== 'undefined') {
                // Try File.dirPath or similar
                if (File.dirPath) return File.dirPath;

                // Derive from filePath
                const filePath = File.filePath;
                if (filePath) {
                    const parts = filePath.split(/[\\/]/);
                    parts.pop();
                    return parts.join('/');
                }
            }

            // Try from the file tree
            const fileTree = document.querySelector('#file-library-tree');
            if (fileTree) {
                const rootNode = fileTree.querySelector('.file-tree-node[data-path]');
                if (rootNode) {
                    return rootNode.getAttribute('data-path') || '';
                }
            }

            return '';
        } catch (e) {
            return '';
        }
    },

    /**
     * Get list of markdown files in the current folder
     * @returns {Array<{name: string, path: string}>} List of files
     */
    getFolderFileList() {
        const files = [];
        try {
            // Method 1: From the file tree sidebar
            const fileTree = document.querySelector('#file-library-tree');
            if (fileTree) {
                const nodes = fileTree.querySelectorAll('.file-tree-node[data-path]');
                nodes.forEach(node => {
                    const path = node.getAttribute('data-path');
                    const nameEl = node.querySelector('.file-node-title');
                    const name = nameEl ? nameEl.textContent.trim() : '';
                    if (path && (path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.txt'))) {
                        files.push({ name: name || path.split(/[\\/]/).pop(), path });
                    }
                });
            }

            // Method 2: From the file list view
            if (files.length === 0) {
                const fileList = document.querySelector('#file-library-list-children');
                if (fileList) {
                    const items = fileList.querySelectorAll('.file-list-item[data-path]');
                    items.forEach(item => {
                        const path = item.getAttribute('data-path');
                        const nameEl = item.querySelector('.file-list-item-file-name');
                        const name = nameEl ? nameEl.textContent.trim() : '';
                        if (path && (path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.txt'))) {
                            files.push({ name: name || path.split(/[\\/]/).pop(), path });
                        }
                    });
                }
            }
        } catch (e) {
            console.error('[Typora-GPT] Error getting file list:', e);
        }
        return files;
    },

    /**
     * Read a file's content (for folder indexing)
     * Uses Electron's fs module when available
     * @param {string} filePath
     * @returns {string} File content
     */
    readFileContent(filePath) {
        try {
            if (typeof reqnode !== 'undefined') {
                const fs = reqnode('fs');
                return fs.readFileSync(filePath, 'utf-8');
            }
            return '';
        } catch (e) {
            console.error('[Typora-GPT] Error reading file:', filePath, e);
            return '';
        }
    },

    /**
     * Index all markdown files in the current folder
     * @param {number} maxFiles - Maximum number of files to index
     * @param {number} maxCharsPerFile - Maximum characters per file
     * @returns {Array<{name: string, path: string, content: string}>}
     */
    indexFolder(maxFiles = 20, maxCharsPerFile = 5000) {
        const files = this.getFolderFileList();
        const indexed = [];

        for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
            const file = files[i];
            try {
                let content = '';

                // Try to read via Electron fs
                content = this.readFileContent(file.path);

                if (!content) {
                    // If this is the current file, get from DOM
                    const currentPath = this.getCurrentFilePath();
                    if (file.path === currentPath) {
                        content = this.getCurrentDocumentContent(maxCharsPerFile);
                    }
                }

                if (content) {
                    if (content.length > maxCharsPerFile) {
                        content = content.substring(0, maxCharsPerFile) + '\n[... truncated ...]';
                    }
                    indexed.push({
                        name: file.name,
                        path: file.path,
                        content
                    });
                }
            } catch (e) {
                // Skip files that can't be read
            }
        }

        return indexed;
    },

    /**
     * Build a context string for the LLM from the current document
     * @param {object} options
     * @returns {string} Formatted context
     */
    buildDocumentContext(options = {}) {
        const { maxChars = 30000 } = options;
        const fileName = this.getCurrentFileName();
        const content = this.getCurrentDocumentContent(maxChars);

        if (!content) return '';

        return `## Current Document: ${fileName}\n\n\`\`\`markdown\n${content}\n\`\`\``;
    },

    /**
     * Build a context string from the entire folder
     * @param {object} options
     * @returns {string} Formatted context
     */
    buildFolderContext(options = {}) {
        const { maxFiles = 10, maxCharsPerFile = 3000 } = options;
        const folderPath = this.getCurrentFolderPath();
        const files = this.indexFolder(maxFiles, maxCharsPerFile);

        if (files.length === 0) return '';

        let context = `## Folder: ${folderPath}\n\n`;
        context += `Found ${files.length} markdown file(s):\n\n`;

        files.forEach(file => {
            context += `### File: ${file.name}\n`;
            context += `\`\`\`markdown\n${file.content}\n\`\`\`\n\n`;
        });

        return context;
    },

    /**
     * Get the currently selected text in the editor
     * @returns {string} Selected text
     */
    getSelectedText() {
        try {
            const selection = window.getSelection();
            if (selection) {
                return selection.toString().trim();
            }
            return '';
        } catch (e) {
            return '';
        }
    },

    /**
     * Get word count statistics for the current document
     * @returns {object} Stats object
     */
    getDocumentStats() {
        const content = this.getCurrentDocumentContent();
        const words = content ? content.split(/\s+/).filter(w => w).length : 0;
        const chars = content ? content.length : 0;
        const lines = content ? content.split('\n').length : 0;

        return { words, chars, lines };
    }
};

// Export for use by other modules
window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.Context = ContextModule;
