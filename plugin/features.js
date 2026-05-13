/**
 * Typora-GPT Features Module
 * Inspired by Claude Code's architecture.
 * Adds: CLAUDE.md, Memory, Web Search, Plan Mode, Task Tracking, Command Execution, Git Awareness
 */

const FeaturesModule = {
    SAFE_COMMANDS: [/^git\s+(status|log|diff|show|branch)\b/i, /^dir\b/i, /^ls\b/i, /^Get-ChildItem\b/i, /^pwd\b/i, /^wc\b/i, /^type\b/i, /^cat\b/i],
    DANGEROUS_PATTERNS: [/\brm\s+-rf\b/i, /\bRemove-Item\b.*\b-Recurse\b/i, /\bdel\b/i, /\brmdir\b/i, /\bgit\s+reset\s+--hard\b/i, /\bgit\s+push\b/i, /\bkill\b/i, /\bStop-Process\b/i, />\s*\S+/, /\bSet-Content\b/i, /\bOut-File\b/i],

    // ==================== 1. Project Instructions (CLAUDE.md equivalent) ====================

    INSTRUCTIONS_KEY: 'typora-gpt-instructions',

    /**
     * Load project instructions from:
     * 1. CLAUDE.md in current folder (via Electron fs)
     * 2. localStorage fallback
     */
    getProjectInstructions() {
        // Try to read CLAUDE.md from current folder
        const folder = window.TyporaGPT.Context.getCurrentFolderPath();
        if (folder) {
            try {
                if (typeof reqnode !== 'undefined') {
                    const fs = reqnode('fs');
                    const path = reqnode('path');
                    const claudePath = path.join(folder, 'CLAUDE.md');
                    if (fs.existsSync(claudePath)) {
                        return fs.readFileSync(claudePath, 'utf-8');
                    }
                    // Also try .typora-gpt.md
                    const altPath = path.join(folder, '.typora-gpt.md');
                    if (fs.existsSync(altPath)) {
                        return fs.readFileSync(altPath, 'utf-8');
                    }
                }
            } catch (e) {}
        }

        // Fallback to localStorage
        try {
            return localStorage.getItem(this.INSTRUCTIONS_KEY) || '';
        } catch (e) { return ''; }
    },

    saveProjectInstructions(text) {
        try { localStorage.setItem(this.INSTRUCTIONS_KEY, text); } catch (e) {}
    },

    /**
     * Get instructions as system prompt fragment
     */
    getInstructionsPrompt() {
        const inst = this.getProjectInstructions();
        if (!inst) return '';
        return '\n\n## Project Instructions\n\n' + inst;
    },

    // ==================== 2. Memory System ====================

    MEMORY_KEY: 'typora-gpt-memory',
    MEMORY_FILES_KEY: 'typora-gpt-memory-files',

    /**
     * Get all memory entries
     */
    getMemories() {
        try {
            const data = localStorage.getItem(this.MEMORY_FILES_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },

    _saveMemories(memories) {
        try { localStorage.setItem(this.MEMORY_FILES_KEY, JSON.stringify(memories)); } catch (e) {}
    },

    /**
     * Add a memory
     */
    addMemory(content, category = 'general') {
        const memories = this.getMemories();
        memories.push({
            id: 'mem_' + Date.now(),
            content: content,
            category: category, // 'user', 'project', 'feedback', 'reference'
            createdAt: new Date().toISOString()
        });
        this._saveMemories(memories);
    },

    deleteMemory(id) {
        let memories = this.getMemories();
        memories = memories.filter(m => m.id !== id);
        this._saveMemories(memories);
    },

    getMemoryContext() {
        const memories = this.getMemories();
        if (memories.length === 0) return '';
        let ctx = '\n\n## Memory\n\nRemember these facts about the user and project:\n';
        memories.forEach(m => { ctx += '- [' + m.category + '] ' + m.content + '\n'; });
        return ctx;
    },

    // ==================== 3. Web Search & Fetch ====================

    /**
     * Search the web using a search API
     * Uses DuckDuckGo's instant answer API (no key needed)
     */
    async webSearch(query) {
        try {
            // Use DuckDuckGo HTML search
            const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
            const response = await fetch(url);
            const html = await response.text();

            // Parse results from HTML
            const results = [];
            const regex = /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
            let match;
            while ((match = regex.exec(html)) !== null && results.length < 5) {
                results.push({
                    title: match[2].replace(/<[^>]*>/g, '').trim(),
                    url: match[1],
                    snippet: match[3].replace(/<[^>]*>/g, '').trim()
                });
            }

            if (results.length === 0) {
                // Fallback: try simple fetch
                return { success: false, results: [], message: 'No results found. Try a different query.' };
            }

            return { success: true, results: results };
        } catch (error) {
            return { success: false, results: [], message: 'Search error: ' + error.message };
        }
    },

    /**
     * Fetch a URL and extract text content
     */
    async fetchUrl(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();

            // Simple HTML to text conversion
            const text = html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 8000);

            return { success: true, content: text, url: url };
        } catch (error) {
            return { success: false, content: '', message: 'Fetch error: ' + error.message };
        }
    },

    /**
     * Build web search context for LLM prompt
     */
    async getWebContext(query) {
        const searchResult = await this.webSearch(query);
        if (!searchResult.success || searchResult.results.length === 0) return '';

        let ctx = '\n\n## Web Search Results for: "' + query + '"\n\n';
        searchResult.results.forEach((r, i) => {
            ctx += (i + 1) + '. **' + r.title + '**\n   ' + r.snippet + '\n   URL: ' + r.url + '\n\n';
        });
        return ctx;
    },

    // ==================== 4. Plan Mode ====================

    planMode: false,

    togglePlanMode() {
        this.planMode = !this.planMode;
        return this.planMode;
    },

    getPlanPrompt() {
        if (!this.planMode) return '';
        return '\n\n## Plan Mode Active\n\nYou are in PLAN MODE. Before executing any action:\n' +
            '1. Think step by step\n' +
            '2. Outline your plan as a numbered list\n' +
            '3. Identify potential issues\n' +
            '4. Wait for user confirmation before proceeding\n\n' +
            'Format your plan as:\n' +
            '### Plan\n' +
            '1. Step one...\n' +
            '2. Step two...\n' +
            '...\n\n' +
            '**Ready to proceed?** (Reply "go" to execute, or ask me to modify the plan)';
    },

    // ==================== 5. Task/Todo Tracking ====================

    TODOS_KEY: 'typora-gpt-todos',

    getTodos() {
        try {
            const data = localStorage.getItem(this.TODOS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },

    _saveTodos(todos) {
        try { localStorage.setItem(this.TODOS_KEY, JSON.stringify(todos)); } catch (e) {}
    },

    addTodo(content, status = 'pending') {
        const todos = this.getTodos();
        todos.push({ id: 'todo_' + Date.now(), content, status, createdAt: new Date().toISOString() });
        this._saveTodos(todos);
    },

    updateTodo(id, status) {
        const todos = this.getTodos();
        const todo = todos.find(t => t.id === id);
        if (todo) { todo.status = status; this._saveTodos(todos); }
    },

    deleteTodo(id) {
        let todos = this.getTodos();
        todos = todos.filter(t => t.id !== id);
        this._saveTodos(todos);
    },

    clearCompletedTodos() {
        let todos = this.getTodos();
        todos = todos.filter(t => t.status !== 'completed');
        this._saveTodos(todos);
    },

    getTodoContext() {
        const todos = this.getTodos();
        if (todos.length === 0) return '';
        let ctx = '\n\n## Current Tasks\n\n';
        todos.forEach(t => {
            const icon = t.status === 'completed' ? '[x]' : t.status === 'in_progress' ? '[>]' : '[ ]';
            ctx += icon + ' ' + t.content + '\n';
        });
        return ctx;
    },

    // ==================== 6. Command Execution ====================

    isCommandDangerous(command) {
        return this.DANGEROUS_PATTERNS.some(p => p.test(String(command || '')));
    },

    isCommandSafe(command) {
        const cmd = String(command || '').trim();
        if (!cmd || this.isCommandDangerous(cmd)) return false;
        return this.SAFE_COMMANDS.some(p => p.test(cmd));
    },

    /**
     * Execute a shell command via Electron's child_process
     * Returns {stdout, stderr, exitCode}
     */
    async executeCommand(command, cwd) {
        try {
            if (typeof reqnode === 'undefined') {
                return { stdout: '', stderr: 'Shell not available (not in Electron)', exitCode: -1 };
            }

            if (this.isCommandDangerous(command)) {
                const ok = typeof confirm === 'function'
                    ? confirm('This command may modify files, processes, or remote state:\n\n' + command + '\n\nRun it anyway?')
                    : false;
                if (!ok) return { stdout:'', stderr:'Command denied by safety check.', exitCode:-1 };
            }

            const { execSync } = reqnode('child_process');
            const folder = cwd || window.TyporaGPT.Context.getCurrentFolderPath() || '.';

            const result = execSync(command, {
                cwd: folder,
                encoding: 'utf-8',
                timeout: 30000,
                maxBuffer: 1024 * 1024
            });

            return { stdout: result, stderr: '', exitCode: 0 };
        } catch (error) {
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                exitCode: error.status || -1
            };
        }
    },

    /**
     * Auto-detect useful commands for the current context
     */
    getAvailableCommands() {
        const commands = [
            { cmd: 'git status', desc: 'Show git status', category: 'git' },
            { cmd: 'git log --oneline -10', desc: 'Recent git commits', category: 'git' },
            { cmd: 'git diff', desc: 'Show uncommitted changes', category: 'git' },
            { cmd: 'pandoc --version', desc: 'Check pandoc version', category: 'tools' },
            { cmd: 'wc -l *.md', desc: 'Count lines in markdown files', category: 'stats' },
            { cmd: 'find . -name "*.md" | head -20', desc: 'List markdown files', category: 'files' },
        ];
        return commands;
    },

    // ==================== 7. Git Awareness ====================

    /**
     * Get git status for the current folder
     */
    async getGitStatus() {
        const result = await this.executeCommand('git status --porcelain -b');
        if (result.exitCode !== 0) return null;

        const lines = result.stdout.split('\n').filter(l => l.trim());
        const branch = lines[0]?.replace('## ', '').split('...')[0] || 'unknown';
        const changes = lines.slice(1).map(l => ({
            status: l.substring(0, 2).trim(),
            file: l.substring(3).trim()
        }));

        return { branch, changes, clean: changes.length === 0 };
    },

    /**
     * Get recent git log
     */
    async getGitLog(count = 5) {
        const result = await this.executeCommand('git log --oneline -' + count);
        if (result.exitCode !== 0) return [];
        return result.stdout.split('\n').filter(l => l.trim());
    },

    /**
     * Build git context for LLM
     */
    async getGitContext() {
        const status = await this.getGitStatus();
        if (!status) return '';

        let ctx = '\n\n## Git Status\n\n';
        ctx += 'Branch: `' + status.branch + '`\n';
        if (status.clean) {
            ctx += 'Working tree clean.\n';
        } else {
            ctx += 'Changed files:\n';
            status.changes.forEach(c => { ctx += '- [' + c.status + '] ' + c.file + '\n'; });
        }

        const log = await this.getGitLog(5);
        if (log.length > 0) {
            ctx += '\nRecent commits:\n';
            log.forEach(l => { ctx += '- ' + l + '\n'; });
        }

        return ctx;
    },

    async getRuntimeStatus() {
        const config = window.TyporaGPT.LLM.getProviderConfig();
        const status = window.TyporaGPT.LLM.getContextStatus([]);
        const git = await this.getGitStatus();
        const todos = this.getTodos();
        return [
            '### Status',
            '',
            '- Model: `' + config.model + '`',
            '- Context window: ' + status.total + ' tokens (' + status.source + ')',
            '- Max output: ' + config.maxTokens + ' tokens',
            '- Context mode: ' + (window.TyporaGPT.UI?.contextMode || 'document'),
            '- Git: ' + (git ? (git.clean ? git.branch + ' clean' : git.branch + ', ' + git.changes.length + ' changed file(s)') : 'not available'),
            '- Tasks: ' + todos.length
        ].join('\n');
    },

    // ==================== 8. Keyboard Shortcuts ====================

    SHORTCUTS_KEY: 'typora-gpt-shortcuts',

    getDefaultShortcuts() {
        return {
            'ctrl+shift+g': 'toggleSidebar',
            'ctrl+shift+n': 'newConversation',
            'ctrl+shift+c': 'clearMessages',
            'ctrl+shift+p': 'togglePlanMode',
            'ctrl+shift+t': 'toggleTodoPanel',
            'ctrl+shift+s': 'toggleSkillsPanel',
            'ctrl+shift+h': 'toggleHistoryPanel',
            'ctrl+enter': 'sendMessage'
        };
    },

    getShortcuts() {
        try {
            const data = localStorage.getItem(this.SHORTCUTS_KEY);
            return data ? JSON.parse(data) : this.getDefaultShortcuts();
        } catch (e) { return this.getDefaultShortcuts(); }
    },

    /**
     * Build the full system prompt with all context
     */
    async buildFullSystemPrompt(basePrompt) {
        let prompt = basePrompt;

        // Add project instructions
        prompt += this.getInstructionsPrompt();

        // Add memory context
        prompt += this.getMemoryContext();

        // Add plan mode
        prompt += this.getPlanPrompt();

        // Add todo context
        prompt += this.getTodoContext();

        return prompt;
    },

    /**
     * Detect if user message is a special command
     * Returns {handled: bool, response: string|null}
     */
    async handleSpecialCommand(input) {
        const lower = input.toLowerCase().trim();

        // /remember - save to memory
        if (lower.startsWith('/remember ')) {
            const content = input.substring(10).trim();
            this.addMemory(content, 'user');
            return { handled: true, response: 'Saved to memory: "' + content + '"' };
        }

        // /forget - clear memory
        if (lower === '/forget all') {
            this._saveMemories([]);
            return { handled: true, response: 'All memories cleared.' };
        }

        // /plan - toggle plan mode
        if (lower === '/plan') {
            const enabled = this.togglePlanMode();
            return { handled: true, response: enabled ? 'Plan mode **ON** — I will outline a plan before acting.' : 'Plan mode **OFF** — I will act directly.' };
        }

        // /todo - add task
        if (lower.startsWith('/todo ')) {
            const content = input.substring(6).trim();
            this.addTodo(content);
            return { handled: true, response: 'Added task: ' + content };
        }

        // /tasks - show tasks
        if (lower === '/tasks' || lower === '/todo') {
            const todos = this.getTodos();
            if (todos.length === 0) return { handled: true, response: 'No tasks yet. Use `/todo <task>` to add one.' };
            let resp = '### Tasks\n\n';
            todos.forEach(t => {
                const icon = t.status === 'completed' ? '[x]' : t.status === 'in_progress' ? '[>]' : '[ ]';
                resp += icon + ' ' + t.content + '\n';
            });
            return { handled: true, response: resp };
        }

        // /search - web search
        if (lower.startsWith('/search ')) {
            const query = input.substring(8).trim();
            const result = await this.webSearch(query);
            if (!result.success) return { handled: true, response: 'Search failed: ' + result.message };
            let resp = '### Search: "' + query + '"\n\n';
            result.results.forEach((r, i) => { resp += (i+1) + '. **' + r.title + '**\n   ' + r.snippet + '\n   ' + r.url + '\n\n'; });
            return { handled: true, response: resp };
        }

        // /run - execute command
        if (lower.startsWith('/run ')) {
            const cmd = input.substring(5).trim();
            const result = await this.executeCommand(cmd);
            let resp = '```\n$ ' + cmd + '\n```\n\n';
            if (result.stdout) resp += '```\n' + result.stdout.substring(0, 3000) + '\n```\n';
            if (result.stderr) resp += '**Error:**\n```\n' + result.stderr.substring(0, 1000) + '\n```\n';
            resp += 'Exit code: ' + result.exitCode;
            return { handled: true, response: resp };
        }

        // /git - show git status
        if (lower === '/git') {
            const ctx = await this.getGitContext();
            return { handled: true, response: ctx || 'Not a git repository.' };
        }

        if (lower === '/status') {
            return { handled: true, response: await this.getRuntimeStatus() };
        }

        if (lower === '/tools') {
            const tools = window.TyporaGPT.Tools;
            if (!tools) return { handled: true, response: 'Typora tools module is not loaded.' };
            let resp = '### Typora Tools\n\nPermission mode: `' + tools.getPermissionMode() + '`\n\n';
            tools.listTools().forEach(t => { resp += '- `' + t.name + '`' + (t.writes ? ' (writes)' : '') + ' — ' + t.description + '\n'; });
            resp += '\nUse `/permission default`, `/permission audit`, or `/permission full` to change execution mode.';
            return { handled: true, response: resp };
        }

        if (lower.startsWith('/permission')) {
            const tools = window.TyporaGPT.Tools;
            if (!tools) return { handled: true, response: 'Typora tools module is not loaded.' };
            const mode = input.substring('/permission'.length).trim();
            if (!mode) return { handled: true, response: 'Current permission mode: `' + tools.getPermissionMode() + '`.\n\nAvailable: `default`, `audit`, `full`.' };
            try {
                tools.setPermissionMode(mode);
                return { handled: true, response: 'Tool permission mode set to `' + mode + '`.' };
            } catch (e) {
                return { handled: true, response: e.message };
            }
        }

        // /memory - show memories
        if (lower === '/memory') {
            const memories = this.getMemories();
            if (!memories.length) return { handled: true, response: 'No memories saved. Use `/remember <fact>` to save.' };
            let resp = '### Memory\n\n';
            memories.forEach(m => { resp += '- [' + m.category + '] ' + m.content + '\n'; });
            return { handled: true, response: resp };
        }

        // /instructions - show/edit project instructions
        if (lower === '/instructions') {
            const inst = this.getProjectInstructions();
            return { handled: true, response: inst ? '### Project Instructions\n\n' + inst : 'No project instructions found.\n\nCreate a `CLAUDE.md` file in your project folder, or save instructions in settings.' };
        }

        // /create-skill - create a custom skill
        if (lower.startsWith('/create-skill ')) {
            const parts = input.substring(14).split('|').map(p => p.trim());
            if (parts.length >= 3) {
                const skill = { name: parts[0], description: parts[1], prompt: parts[2], contextMode: parts[3] || 'document', icon: parts[4] || '*' };
                window.TyporaGPT.Skills.addSkill(skill);
                return { handled: true, response: 'Skill created: **' + skill.name + '**\nDescription: ' + skill.description };
            }
            return { handled: true, response: 'Format: `/create-skill name | description | prompt | contextMode | icon`' };
        }

        // /add-mcp - add an MCP server
        if (lower.startsWith('/add-mcp ')) {
            const parts = input.substring(9).split('|').map(p => p.trim());
            if (parts.length >= 2) {
                const srv = { name: parts[0], endpoint: parts[1], apiKey: parts[2] || '' };
                window.TyporaGPT.Skills.addMCPServer(srv);
                return { handled: true, response: 'MCP server added: **' + srv.name + '**\nEndpoint: ' + srv.endpoint };
            }
            return { handled: true, response: 'Format: `/add-mcp name | endpoint | apiKey`' };
        }

        // /mcp - list MCP servers
        if (lower === '/mcp') {
            const servers = window.TyporaGPT.Skills.getMCPServers();
            if (!servers.length) return { handled: true, response: 'No MCP servers. Use `/add-mcp name | endpoint` or configure in Settings.' };
            let r = '### MCP Servers\n\n';
            servers.forEach(s => { r += '- **' + s.name + '** (' + (s.enabled ? 'on' : 'off') + '): ' + s.endpoint + '\n'; });
            r += '\nUse `/mcp-tools <server>` to list tools, or `/mcp-call <server> | <tool> | {"arg":"value"}` to run one.';
            return { handled: true, response: r };
        }

        // /mcp-tools - list tools for one MCP server
        if (lower.startsWith('/mcp-tools ')) {
            const ref = input.substring(11).trim();
            const srv = window.TyporaGPT.Skills._findMCPServer(ref);
            if (!srv) return { handled: true, response: 'MCP server not found: `' + ref + '`' };
            const tools = await window.TyporaGPT.Skills.listMCPTools(srv.id);
            if (!tools.length) return { handled: true, response: 'No tools returned by **' + srv.name + '**.' };
            let r = '### MCP Tools: ' + srv.name + '\n\n';
            tools.forEach(t => { r += '- **' + t.name + '**: ' + (t.description || '') + '\n'; });
            return { handled: true, response: r };
        }

        // /mcp-call - execute an MCP tool explicitly
        if (lower.startsWith('/mcp-call ')) {
            const parts = input.substring(10).split('|').map(p => p.trim());
            if (parts.length < 2) return { handled: true, response: 'Format: `/mcp-call server | tool | {"arg":"value"}`' };
            let args = {};
            if (parts[2]) {
                try { args = JSON.parse(parts.slice(2).join('|')); }
                catch (e) { return { handled: true, response: 'Invalid JSON arguments: ' + e.message }; }
            }
            try {
                const result = await window.TyporaGPT.Skills.callMCPTool(parts[0], parts[1], args);
                return { handled: true, response: '### MCP Result\n\n```json\n' + JSON.stringify(result, null, 2).slice(0, 12000) + '\n```' };
            } catch (e) {
                return { handled: true, response: 'MCP call failed: ' + e.message };
            }
        }

        // /help - show all commands
        if (lower === '/help') {
            return { handled: true, response: '### Commands\n\n'
                + '- `/remember <fact>` — Save to memory\n- `/memory` — Show memories\n- `/forget all` — Clear memories\n'
                + '- `/plan` — Toggle plan mode\n- `/todo <task>` — Add task\n- `/tasks` — Show tasks\n'
                + '- `/search <query>` — Web search\n- `/run <cmd>` — Run shell command\n- `/git` — Git status\n- `/status` — Session status\n- `/tools` — List Typora tools\n- `/permission <mode>` — Set tool permission mode\n'
                + '- `/instructions` — Project instructions\n- `/create-skill name | desc | prompt` — Create skill\n'
                + '- `/add-mcp name | endpoint` — Add MCP server\n- `/mcp` — List MCP servers\n- `/mcp-tools <server>` — List MCP tools\n- `/mcp-call server | tool | JSON` — Run MCP tool\n'
                + '- `/help` — This message' };
        }

        return { handled: false, response: null };
    }
};

window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.Features = FeaturesModule;
