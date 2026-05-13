/**
 * Typora-GPT Local Tools Module
 * Executes structured typora_tool blocks for document and Markdown file edits.
 */

const ToolsModule = {
    STORAGE_KEY: 'typora-gpt-tool-permission',
    modes: ['default', 'audit', 'full'],
    writeTools: new Set(['replaceSelection', 'insertAtCursor', 'replaceCurrentDocument', 'saveCurrentDocument', 'writeMarkdownFile', 'patchMarkdownFile']),

    getPermissionMode() {
        try {
            const mode = localStorage.getItem(this.STORAGE_KEY) || 'default';
            return this.modes.includes(mode) ? mode : 'default';
        } catch (e) { return 'default'; }
    },

    setPermissionMode(mode) {
        if (!this.modes.includes(mode)) throw new Error('Invalid permission mode: ' + mode);
        localStorage.setItem(this.STORAGE_KEY, mode);
        return mode;
    },

    listTools() {
        return [
            { name:'getCurrentMarkdown', description:'Get current document content', writes:false },
            { name:'getSelectedText', description:'Get selected text', writes:false },
            { name:'replaceSelection', description:'Replace selected text in the editor', writes:true },
            { name:'insertAtCursor', description:'Insert text at the current cursor', writes:true },
            { name:'replaceCurrentDocument', description:'Replace the full current editor content', writes:true },
            { name:'saveCurrentDocument', description:'Save the current Typora document', writes:true },
            { name:'readMarkdownFile', description:'Read a Markdown/text file from disk', writes:false },
            { name:'writeMarkdownFile', description:'Write a Markdown/text file to disk with backup', writes:true },
            { name:'patchMarkdownFile', description:'Find and replace text in a Markdown/text file with backup', writes:true },
            { name:'listMarkdownFiles', description:'List Markdown files in a folder', writes:false }
        ];
    },

    buildToolsPrompt() {
        return '\n\n## Typora Local Tools\n\n' +
            'When the user asks you to edit the current document or Markdown files, you may output fenced `typora_tool` JSON blocks. The app will execute them after permission checks.\n\n' +
            'Schema:\n```typora_tool\n{"tool":"replaceSelection","arguments":{"text":"new Markdown"}}\n```\n\n' +
            'Available tools: ' + this.listTools().map(t => t.name + (t.writes ? ' (writes)' : '')).join(', ') + '.\n' +
            'Use write tools only when the user clearly asks for an actual edit. Prefer `replaceSelection` for selected text and `patchMarkdownFile` for targeted file edits.';
    },

    _ctx() { return window.TyporaGPT.Context; },
    _ui() { return window.TyporaGPT.UI; },

    _getWriteElement() {
        return document.querySelector('#write') || document.querySelector('[contenteditable="true"]');
    },

    _selectElementContents(el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    },

    _insertText(text) {
        const value = String(text ?? '');
        const ok = document.execCommand && document.execCommand('insertText', false, value);
        if (ok) return true;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(value);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
    },

    _previewFor(tool, args) {
        if (tool === 'replaceSelection' || tool === 'insertAtCursor' || tool === 'replaceCurrentDocument') {
            return String(args.text || '').slice(0, 2000);
        }
        if (tool === 'writeMarkdownFile') {
            return 'Path: ' + args.path + '\n\n' + String(args.content || '').slice(0, 2000);
        }
        if (tool === 'patchMarkdownFile') {
            return 'Path: ' + args.path + '\n\nFind:\n' + String(args.find || '').slice(0, 1000) + '\n\nReplace:\n' + String(args.replace || '').slice(0, 1000);
        }
        return JSON.stringify(args, null, 2).slice(0, 2000);
    },

    _confirm(tool, args) {
        const mode = this.getPermissionMode();
        const writes = this.writeTools.has(tool);
        if (mode === 'full') return true;
        if (!writes && mode === 'default') return true;
        return confirm('Typora-CC wants to run tool: ' + tool + '\n\n' + this._previewFor(tool, args) + '\n\nAllow this operation?');
    },

    _requireFs() {
        if (typeof reqnode === 'undefined') throw new Error('Filesystem tools require Typora/Electron runtime.');
        return { fs: reqnode('fs'), path: reqnode('path') };
    },

    _isMarkdownPath(filePath) {
        return /\.(md|markdown|mdown|txt)$/i.test(String(filePath || ''));
    },

    _backupFile(filePath) {
        const { fs } = this._requireFs();
        if (!fs.existsSync(filePath)) return '';
        const backup = filePath + '.bak';
        fs.copyFileSync(filePath, backup);
        return backup;
    },

    _readFile(filePath) {
        const { fs } = this._requireFs();
        if (!this._isMarkdownPath(filePath)) throw new Error('Only Markdown/text files are allowed.');
        return fs.readFileSync(filePath, 'utf-8');
    },

    async executeTool(tool, args = {}) {
        if (!tool) throw new Error('Missing tool name.');
        if (!this._confirm(tool, args)) return { ok:false, tool, skipped:true, message:'User denied tool execution.' };

        switch (tool) {
            case 'getCurrentMarkdown':
                return { ok:true, tool, content:this._ctx().getCurrentDocumentContent(200000), path:this._ctx().getCurrentFilePath() };
            case 'getSelectedText':
                return { ok:true, tool, content:this._ctx().getSelectedText() };
            case 'replaceSelection':
                return this.replaceSelection(args.text);
            case 'insertAtCursor':
                return this.insertAtCursor(args.text);
            case 'replaceCurrentDocument':
                return this.replaceCurrentDocument(args.text);
            case 'saveCurrentDocument':
                return this.saveCurrentDocument();
            case 'readMarkdownFile':
                return { ok:true, tool, path:args.path, content:this._readFile(args.path) };
            case 'writeMarkdownFile':
                return this.writeMarkdownFile(args.path, args.content);
            case 'patchMarkdownFile':
                return this.patchMarkdownFile(args.path, args.find, args.replace, args.all !== false);
            case 'listMarkdownFiles':
                return this.listMarkdownFiles(args.folder || args.path);
            default:
                throw new Error('Unknown typora tool: ' + tool);
        }
    },

    replaceSelection(text) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) throw new Error('No selected text to replace.');
        if (!this._insertText(text)) throw new Error('Unable to replace selection.');
        return { ok:true, tool:'replaceSelection', chars:String(text || '').length };
    },

    insertAtCursor(text) {
        const el = this._getWriteElement();
        if (el) el.focus();
        if (!this._insertText(text)) throw new Error('Unable to insert at cursor.');
        return { ok:true, tool:'insertAtCursor', chars:String(text || '').length };
    },

    replaceCurrentDocument(text) {
        const el = this._getWriteElement();
        if (!el) throw new Error('Typora editor area not found.');
        el.focus();
        this._selectElementContents(el);
        if (!this._insertText(text)) throw new Error('Unable to replace document.');
        return { ok:true, tool:'replaceCurrentDocument', chars:String(text || '').length };
    },

    saveCurrentDocument() {
        try {
            if (typeof File !== 'undefined') {
                if (typeof File.save === 'function') { File.save(); return { ok:true, tool:'saveCurrentDocument', method:'File.save' }; }
                if (typeof File.saveFile === 'function') { File.saveFile(); return { ok:true, tool:'saveCurrentDocument', method:'File.saveFile' }; }
            }
            document.dispatchEvent(new KeyboardEvent('keydown', { key:'s', code:'KeyS', ctrlKey:true, bubbles:true }));
            return { ok:true, tool:'saveCurrentDocument', method:'keyboard-event', warning:'Save was requested via Ctrl+S event; verify Typora saved the file.' };
        } catch (e) {
            throw new Error('Unable to save current document: ' + e.message);
        }
    },

    writeMarkdownFile(filePath, content) {
        const { fs, path } = this._requireFs();
        if (!filePath) throw new Error('Missing path.');
        if (!this._isMarkdownPath(filePath)) throw new Error('Only Markdown/text files are allowed.');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) throw new Error('Directory not found: ' + dir);
        const backup = this._backupFile(filePath);
        fs.writeFileSync(filePath, String(content ?? ''), 'utf-8');
        return { ok:true, tool:'writeMarkdownFile', path:filePath, chars:String(content ?? '').length, backup };
    },

    patchMarkdownFile(filePath, find, replace, all = true) {
        if (!find) throw new Error('Missing find text.');
        const content = this._readFile(filePath);
        if (!content.includes(find)) throw new Error('Find text not found in file.');
        const next = all ? content.split(find).join(String(replace ?? '')) : content.replace(find, String(replace ?? ''));
        const result = this.writeMarkdownFile(filePath, next);
        result.tool = 'patchMarkdownFile';
        result.replacements = all ? content.split(find).length - 1 : 1;
        return result;
    },

    listMarkdownFiles(folder) {
        const { fs, path } = this._requireFs();
        const root = folder || this._ctx().getCurrentFolderPath();
        if (!root || !fs.existsSync(root)) throw new Error('Folder not found: ' + root);
        const files = [];
        const walk = (dir, depth) => {
            if (depth > 3 || files.length >= 200) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
                if (entry.name === 'node_modules' || entry.name === '.git') continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full, depth + 1);
                else if (entry.isFile() && this._isMarkdownPath(full)) files.push({ name:entry.name, path:full });
            }
        };
        walk(root, 0);
        return { ok:true, tool:'listMarkdownFiles', folder:root, files };
    },

    parseToolBlocks(text) {
        const calls = [];
        const re = /```typora_tool\s*([\s\S]*?)```/g;
        let m;
        while ((m = re.exec(String(text || ''))) !== null) {
            try {
                const parsed = JSON.parse(m[1].trim());
                (Array.isArray(parsed) ? parsed : [parsed]).forEach(x => calls.push(x));
            } catch (e) {
                calls.push({ error:'Invalid typora_tool JSON: ' + e.message });
            }
        }
        return calls;
    },

    async executeToolBlocks(text) {
        const calls = this.parseToolBlocks(text);
        const results = [];
        for (const call of calls) {
            if (call.error) { results.push({ ok:false, error:call.error }); continue; }
            try {
                results.push(await this.executeTool(call.tool, call.arguments || call.args || {}));
            } catch (e) {
                results.push({ ok:false, tool:call.tool, error:e.message });
            }
        }
        return results;
    }
};

window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.Tools = ToolsModule;
