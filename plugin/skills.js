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
        { id:'format-markdown-latex', name:'Format Markdown + LaTeX', icon:'MD', description:'Normalize Markdown, tables, and formulas for Typora', prompt:'Rewrite the provided content as clean Typora-compatible Markdown. Preserve the meaning and technical details. Use headings, bullet lists, and tables where helpful. Do not wrap formulas in code blocks. Put every display equation in its own block wrapped with $$ on both sides. Use inline math with $...$ only for short formulas inside sentences. For LaTeX variables, wrap multi-character subscripts and superscripts in braces, for example E_{mri}, E_{pet}, A_{T}, e_{T}, z_{S}, L_{total}, \\lambda_{cls}, \\lambda_{feat}. Use LaTeX operators such as \\operatorname{CrossAttention}, \\operatorname{SelfAttention}, \\operatorname{softmax}, \\operatorname{Linear}, \\operatorname{MLP}, \\sum, and \\cdot. Output only the rewritten Markdown.', contextMode:'selection' },
        { id:'folder-overview', name:'Folder Overview', icon:'D', description:'Overview of all files in folder', prompt:'Provide a comprehensive overview of all files in this folder. For each file, summarize its main topic and purpose. Then provide an overall summary.', contextMode:'folder' }
    ],

    getAllSkills() { return [...this.builtinSkills, ...this._getCustom()]; },
    _getCustom() { try { const d = localStorage.getItem(this.STORAGE_KEY); return d ? JSON.parse(d) : []; } catch(e){return []} },
    _saveCustom(s) { try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(s)); } catch(e){} },

    addSkill(skill) {
        const s = this._getCustom();
        skill.id = skill.id || 'custom_' + Date.now();
        skill.isCustom = true;
        const idx = s.findIndex(x =>
            (skill.sourcePath && x.sourcePath === skill.sourcePath) ||
            (skill.id && x.id === skill.id) ||
            (x.name === skill.name && x.prompt === skill.prompt)
        );
        if (idx >= 0) s[idx] = { ...s[idx], ...skill };
        else s.push(skill);
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

    _slug(text) {
        return String(text || 'skill').toLowerCase().replace(/\\/g, '/').split('/').filter(Boolean).pop()
            .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';
    },

    _parseFrontmatter(text) {
        const src = String(text || '').replace(/\r\n/g, '\n');
        if (!src.startsWith('---\n')) return { data: {}, body: src };
        const end = src.indexOf('\n---', 4);
        if (end < 0) return { data: {}, body: src };
        const raw = src.slice(4, end).trim();
        const body = src.slice(end + 4).replace(/^\n+/, '');
        const data = {};
        raw.split('\n').forEach(line => {
            const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
            if (!m) return;
            let value = m[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            data[m[1]] = value;
        });
        return { data, body };
    },

    _descriptionFromMarkdown(body) {
        const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
        for (const line of lines) {
            const t = line.trim();
            if (!t || t.startsWith('#') || t.startsWith('---') || t.startsWith('```')) continue;
            return t.replace(/^[-*> ]+/, '').slice(0, 260);
        }
        return '';
    },

    _nameFromPath(filePath) {
        const parts = String(filePath || '').replace(/\\/g, '/').split('/').filter(Boolean);
        const file = parts[parts.length - 1] || 'SKILL.md';
        if (/^SKILL\.md$/i.test(file) && parts.length > 1) return parts[parts.length - 2];
        if (/^README\.md$/i.test(file) && parts.length > 1) return parts[0];
        return file.replace(/\.(md|json)$/i, '');
    },

    importMarkdownSkill(content, filePath, fallbackName) {
        const parsed = this._parseFrontmatter(content);
        const body = parsed.body || content;
        const name = parsed.data.name || fallbackName || this._nameFromPath(filePath);
        const description = parsed.data.description || parsed.data.when_to_use || parsed.data.whenToUse || this._descriptionFromMarkdown(body) || 'Imported Markdown skill';
        const contextMode = parsed.data.contextMode || parsed.data.context_mode || 'document';
        const skill = {
            id: 'skill_md_' + this._slug(name),
            name,
            icon: 'MD',
            description,
            prompt: String(content || '').trim(),
            contextMode,
            source: 'skill-md',
            sourcePath: filePath || name
        };
        this.addSkill(skill);
        return 1;
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
                const name = f.path || f.webkitRelativePath || f.name || '';
                const lower = name.toLowerCase().replace(/\\/g, '/');
                if (lower.endsWith('.json')) {
                    const n = this.importFromFile(f.content);
                    count += n;
                } else if (lower.endsWith('/skill.md') || lower === 'skill.md') {
                    count += this.importMarkdownSkill(f.content, name);
                }
            } catch (e) { /* skip invalid files */ }
        });
        return count;
    },

    async importFromZipFile(file) {
        const entries = await this._readZipEntries(file);
        const primary = entries.filter(e => /\.json$/i.test(e.name) || /(^|\/)SKILL\.md$/i.test(e.name));
        let count = this.importFromFiles(primary);
        if (!count) {
            const readmes = entries.filter(e => /(^|\/)README\.md$/i.test(e.name))
                .sort((a, b) => a.name.split('/').length - b.name.split('/').length);
            if (readmes[0]) count += this.importMarkdownSkill(readmes[0].content, readmes[0].name, (file.name || '').replace(/\.zip$/i, ''));
        }
        return count;
    },

    async _readZipEntries(file) {
        const buf = await file.arrayBuffer();
        const view = new DataView(buf);
        const bytes = new Uint8Array(buf);
        const files = [];

        let eocd = -1;
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
            if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('Invalid ZIP file.');

        let pos = view.getUint32(eocd + 16, true);
        const total = view.getUint16(eocd + 10, true);
        for (let idx = 0; idx < total && pos + 46 <= bytes.length; idx++) {
            if (view.getUint32(pos, true) !== 0x02014b50) break;
            const method = view.getUint16(pos + 10, true);
            const compressedSize = view.getUint32(pos + 20, true);
            const nameLen = view.getUint16(pos + 28, true);
            const extraLen = view.getUint16(pos + 30, true);
            const commentLen = view.getUint16(pos + 32, true);
            const localOffset = view.getUint32(pos + 42, true);
            const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLen));

            const lowerName = name.toLowerCase();
            const wantsEntry = lowerName.endsWith('.json') || /(^|\/)skill\.md$/.test(lowerName) || /(^|\/)readme\.md$/.test(lowerName);
            if (wantsEntry) {
                if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Invalid ZIP entry: ' + name);
                const localNameLen = view.getUint16(localOffset + 26, true);
                const localExtraLen = view.getUint16(localOffset + 28, true);
                const dataStart = localOffset + 30 + localNameLen + localExtraLen;
                const dataEnd = dataStart + compressedSize;
                const compressed = bytes.slice(dataStart, dataEnd);
                const content = method === 0
                    ? new TextDecoder().decode(compressed)
                    : await this._inflateRaw(compressed);
                files.push({ name, content });
            }
            pos += 46 + nameLen + extraLen + commentLen;
        }

        if (!files.length) throw new Error('No JSON, SKILL.md, or README.md skill files found in ZIP.');
        return files;
    },

    async _inflateRaw(bytes) {
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('ZIP compression is not supported by this Typora runtime.');
        }
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return await new Response(stream).text();
    },

    /**
     * Import from a directory (reads .json and SKILL.md files via Electron fs)
     */
    importFromDirectory(dirPath) {
        if (typeof reqnode === 'undefined') throw new Error('Not in Electron environment');
        const fs = reqnode('fs');
        const path = reqnode('path');

        if (!fs.existsSync(dirPath)) throw new Error('Directory not found: ' + dirPath);

        let count = 0;
        const walk = (base) => {
            const entries = fs.readdirSync(base, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(base, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === '.git') continue;
                    walk(full);
                    continue;
                }
                if (!entry.isFile()) continue;
                const rel = path.relative(dirPath, full);
                if (entry.name.endsWith('.json')) {
                    try {
                        const content = fs.readFileSync(full, 'utf-8');
                        count += this.importFromFile(content);
                    } catch (e) { /* skip */ }
                } else if (entry.name.toLowerCase() === 'skill.md') {
                    try {
                        const content = fs.readFileSync(full, 'utf-8');
                        count += this.importMarkdownSkill(content, rel);
                    } catch (e) { /* skip */ }
                }
            }
        };
        walk(dirPath);
        if (!count) {
            const readme = path.join(dirPath, 'README.md');
            if (fs.existsSync(readme)) {
                try {
                    count += this.importMarkdownSkill(fs.readFileSync(readme, 'utf-8'), 'README.md', path.basename(dirPath));
                } catch (e) { /* skip */ }
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

    findRelevantSkills(query, limit = 3) {
        const terms = String(query || '').toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5_+-]+/).filter(Boolean);
        if (!terms.length) return [];
        return this.getAllSkills().map(skill => {
            const name = String(skill.name || '').toLowerCase();
            const desc = String(skill.description || '').toLowerCase();
            const prompt = String(skill.prompt || '').toLowerCase();
            let score = 0;
            terms.forEach(t => {
                if (name.includes(t)) score += 8;
                if (desc.includes(t)) score += 4;
                if (prompt.includes(t)) score += 1;
            });
            if (name && String(query).toLowerCase().includes(name)) score += 12;
            return { skill, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.skill);
    },

    buildSkillsContext(query) {
        const skills = this.findRelevantSkills(query, 3);
        if (!skills.length) return '';
        let used = 0;
        let ctx = '\n\n## Relevant Skills\n\nThe following imported or built-in skills appear relevant. Use them only when they fit the user request; ignore irrelevant skills.\n';
        skills.forEach(s => {
            const body = String(s.prompt || '').trim();
            const remaining = Math.max(0, 6000 - used);
            if (!remaining) return;
            const snippet = body.slice(0, Math.min(2200, remaining));
            used += snippet.length;
            ctx += '\n### ' + s.name + '\n';
            if (s.description) ctx += 'Description: ' + s.description + '\n';
            ctx += 'Instructions:\n' + snippet + (body.length > snippet.length ? '\n[Skill truncated for context.]\n' : '\n');
        });
        return ctx;
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

    _findMCPServer(ref) {
        const key = String(ref || '').toLowerCase();
        return this.getMCPServers().find(s => s.id === ref || String(s.name || '').toLowerCase() === key);
    },

    async callMCPTool(serverId, toolName, params) {
        const srv = this._findMCPServer(serverId);
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
        let ctx = '\n\n## Available External Tools (MCP)\n\nWhen an external tool is needed, output a fenced `mcp_call` JSON block like:\n```mcp_call\n{"server":"server name or id","tool":"tool_name","arguments":{}}\n```\nThe app will execute the block and append the real result.\n\n';
        for (const srv of servers) {
            const tools = await this.listMCPTools(srv.id);
            if (tools.length) { ctx += '### ' + (srv.name || srv.id) + ' (`' + srv.id + '`)\n'; tools.forEach(t => { ctx += '- **' + t.name + '**: ' + (t.description || '') + '\n'; }); ctx += '\n'; }
        }
        return ctx;
    },

    async executeMCPBlocks(text) {
        const blocks = [];
        const re = /```mcp_call\s*([\s\S]*?)```/g;
        let m;
        while ((m = re.exec(String(text || ''))) !== null) {
            try {
                const parsed = JSON.parse(m[1].trim());
                (Array.isArray(parsed) ? parsed : [parsed]).forEach(x => blocks.push(x));
            } catch (e) {
                blocks.push({ error: 'Invalid mcp_call JSON: ' + e.message });
            }
        }
        const results = [];
        for (const b of blocks) {
            if (b.error) { results.push({ ok:false, error:b.error }); continue; }
            try {
                const result = await this.callMCPTool(b.server, b.tool, b.arguments || b.params || {});
                results.push({ ok:true, server:b.server, tool:b.tool, result });
            } catch (e) {
                results.push({ ok:false, server:b.server, tool:b.tool, error:e.message });
            }
        }
        return results;
    }
};

window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.Skills = SkillsModule;
