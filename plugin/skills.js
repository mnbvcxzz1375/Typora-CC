/**
 * Typora-GPT Skills + MCP Module
 */

const SkillsModule = {
    STORAGE_KEY: 'typora-gpt-skills',
    MCP_STORAGE_KEY: 'typora-gpt-mcp-servers',

    builtinSkills: [
        { id:'summarize-bullets', name:'Summarize as Bullets', icon:'S', description:'Summarize the document as bullet points', prompt:'Summarize the following content as concise bullet points. Use Markdown list format. Respond in the same language as the source.', contextMode:'document' },
        { id:'create-toc', name:'Create Table of Contents', icon:'T', description:'Generate a table of contents', prompt:'Analyze the document and create a Markdown table of contents based on headings. Use proper indentation for nested headings.', contextMode:'document' },
        { id:'improve-writing', name:'Improve Writing', icon:'W', description:'Improve clarity and readability', prompt:'Improve the following text for clarity, readability, and professionalism. Fix grammar issues. Keep the original meaning and Markdown formatting. Output only the improved text.', contextMode:'selection' },
        { id:'translate-zh', name:'Translate to Chinese', icon:'ZH', description:'Translate content to Chinese', prompt:'Translate the following text to Simplified Chinese. Keep Markdown formatting. For technical terms, keep originals in parentheses.', contextMode:'selection' },
        { id:'translate-en', name:'Translate to English', icon:'EN', description:'Translate content to English', prompt:'Translate the following text to English. Keep Markdown formatting. For technical terms, keep originals in parentheses.', contextMode:'selection' },
        { id:'explain-code', name:'Explain Code', icon:'{}', description:'Explain code blocks in the document', prompt:'Explain the code in the document. For each code block, describe what it does and its purpose.', contextMode:'document' },
        { id:'generate-changelog', name:'Generate Changelog', icon:'C', description:'Create a changelog from content', prompt:'Based on the document content, generate a changelog in Keep a Changelog format with categories: Added, Changed, Fixed, Removed.', contextMode:'document' },
        { id:'find-action-items', name:'Find Action Items', icon:'[ ]', description:'Extract action items and TODOs', prompt:'Scan the document and extract all action items, TODOs, and tasks. List them as a checkbox list. Group by priority if possible.', contextMode:'document' },
        { id:'rewrite-formal', name:'Rewrite Formal', icon:'F', description:'Formal/professional tone', prompt:'Rewrite the following text in a formal, professional tone suitable for business or academic communication. Keep Markdown formatting.', contextMode:'selection' },
        { id:'rewrite-casual', name:'Rewrite Casual', icon:'R', description:'Casual/friendly tone', prompt:'Rewrite the following text in a casual, friendly tone. Keep Markdown formatting.', contextMode:'selection' },
        { id:'generate-quiz', name:'Generate Quiz', icon:'Q', description:'Create quiz questions from content', prompt:'Based on the document content, generate 5 quiz questions with answers. Use multiple-choice format where applicable.', contextMode:'document' },
        { id:'folder-overview', name:'Folder Overview', icon:'D', description:'Overview of all files in folder', prompt:'Provide a comprehensive overview of all files in this folder. For each file, summarize its main topic and purpose. Then provide an overall summary.', contextMode:'folder' }
    ],

    getAllSkills() { return [...this.builtinSkills, ...this._getCustom()]; },
    _getCustom() { try { const d = localStorage.getItem(this.STORAGE_KEY); return d ? JSON.parse(d) : []; } catch(e){return []} },
    _saveCustom(s) { try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(s)); } catch(e){} },

    addSkill(skill) {
        const s = this._getCustom();
        skill.id = skill.id || 'custom_' + Date.now();
        skill.isCustom = true;
        s.push(skill);
        this._saveCustom(s);
        return skill;
    },

    deleteSkill(id) { this._saveCustom(this._getCustom().filter(s => s.id !== id)); },
    getSkill(id) { return this.getAllSkills().find(s => s.id === id) || null; },

    /**
     * Import from JSON string (single object or array)
     */
    importSkill(jsonStr) {
        const skill = JSON.parse(jsonStr);
        if (!skill.name || !skill.prompt) throw new Error('Invalid skill: needs name and prompt');
        return this.addSkill(skill);
    },

    importFromFile(content) {
        const data = JSON.parse(content);
        const arr = Array.isArray(data) ? data : [data];
        let n = 0;
        arr.forEach(s => { if (s.name && s.prompt) { this.addSkill(s); n++; } });
        return n;
    },

    /**
     * Import skills from multiple files (folder or zip contents)
     * @param {Array<{name: string, content: string}>} files - Array of {name, content}
     * @returns {number} Count of imported skills
     */
    importFromFiles(files) {
        let count = 0;
        files.forEach(f => {
            try {
                if (f.name.endsWith('.json')) {
                    const n = this.importFromFile(f.content);
                    count += n;
                }
            } catch (e) { /* skip invalid files */ }
        });
        return count;
    },

    /**
     * Import from a directory (reads .json files via Electron fs)
     */
    importFromDirectory(dirPath) {
        if (typeof reqnode === 'undefined') throw new Error('Not in Electron environment');
        const fs = reqnode('fs');
        const path = reqnode('path');

        if (!fs.existsSync(dirPath)) throw new Error('Directory not found: ' + dirPath);

        let count = 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.json')) {
                try {
                    const content = fs.readFileSync(path.join(dirPath, entry.name), 'utf-8');
                    const n = this.importFromFile(content);
                    count += n;
                } catch (e) { /* skip */ }
            } else if (entry.isDirectory()) {
                // Recurse into subdirectories (1 level)
                try {
                    const subPath = path.join(dirPath, entry.name);
                    const subEntries = fs.readdirSync(subPath, { withFileTypes: true });
                    for (const sub of subEntries) {
                        if (sub.isFile() && sub.name.endsWith('.json')) {
                            try {
                                const content = fs.readFileSync(path.join(subPath, sub.name), 'utf-8');
                                const n = this.importFromFile(content);
                                count += n;
                            } catch (e) {}
                        }
                    }
                } catch (e) {}
            }
        }
        return count;
    },

    exportSkill(id) {
        const s = this.getSkill(id);
        return s ? JSON.stringify(s, null, 2) : '';
    },

    exportAllCustom() {
        return JSON.stringify(this._getCustom(), null, 2);
    },

    // ==================== MCP ====================

    getMCPServers() { try { const d = localStorage.getItem(this.MCP_STORAGE_KEY); return d ? JSON.parse(d) : []; } catch(e){return []} },
    _saveMCP(s) { try { localStorage.setItem(this.MCP_STORAGE_KEY, JSON.stringify(s)); } catch(e){} },

    addMCPServer(srv) {
        const s = this.getMCPServers();
        srv.id = srv.id || 'mcp_' + Date.now();
        srv.enabled = srv.enabled !== false;
        s.push(srv);
        this._saveMCP(s);
        return srv;
    },

    removeMCPServer(id) { this._saveMCP(this.getMCPServers().filter(s => s.id !== id)); },
    toggleMCPServer(id) { const s = this.getMCPServers(); const srv = s.find(x => x.id === id); if (srv) { srv.enabled = !srv.enabled; this._saveMCP(s); } },

    async callMCPTool(serverId, toolName, params) {
        const srv = this.getMCPServers().find(s => s.id === serverId);
        if (!srv || !srv.enabled) throw new Error('MCP server not found or disabled');
        const r = await fetch(srv.endpoint + '/tools/call', { method:'POST', headers:{'Content-Type':'application/json',...(srv.apiKey?{'Authorization':'Bearer '+srv.apiKey}:{})}, body:JSON.stringify({tool:toolName,arguments:params}) });
        if (!r.ok) throw new Error('MCP Error: ' + r.status);
        return await r.json();
    },

    async listMCPTools(serverId) {
        const srv = this.getMCPServers().find(s => s.id === serverId);
        if (!srv) return [];
        try { const r = await fetch(srv.endpoint + '/tools/list', { headers:{'Content-Type':'application/json',...(srv.apiKey?{'Authorization':'Bearer '+srv.apiKey}:{})} }); if (!r.ok) return []; return (await r.json()).tools || []; } catch(e){return []}
    },

    async getMCPContextForPrompt() {
        const servers = this.getMCPServers().filter(s => s.enabled);
        if (!servers.length) return '';
        let ctx = '\n\n## Available External Tools (MCP)\n\nUse ```mcp_call blocks to invoke tools.\n\n';
        for (const srv of servers) {
            const tools = await this.listMCPTools(srv.id);
            if (tools.length) { ctx += '### ' + (srv.name || srv.id) + '\n'; tools.forEach(t => { ctx += '- **' + t.name + '**: ' + (t.description || '') + '\n'; }); ctx += '\n'; }
        }
        return ctx;
    }
};

window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.Skills = SkillsModule;
