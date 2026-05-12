/**
 * Typora-GPT History Module
 * Manages conversation history: create, save, switch, delete conversations.
 */

const HistoryModule = {
    STORAGE_KEY: 'typora-gpt-conversations',
    currentId: null,

    /**
     * Get all conversations from localStorage
     */
    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },

    /**
     * Save all conversations
     */
    _saveAll(conversations) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(conversations));
        } catch (e) {
            console.error('[Typora-GPT] Failed to save conversations:', e);
        }
    },

    /**
     * Create a new conversation
     * @returns {object} The new conversation
     */
    create() {
        const conv = {
            id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            title: 'New Conversation',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const conversations = this.getAll();
        conversations.unshift(conv);
        this._saveAll(conversations);
        this.currentId = conv.id;
        return conv;
    },

    /**
     * Get current conversation, create one if none exists
     */
    getCurrent() {
        if (this.currentId) {
            const conv = this.get(this.currentId);
            if (conv) return conv;
        }
        // Create new if no current conversation
        return this.create();
    },

    /**
     * Get a conversation by ID
     */
    get(id) {
        return this.getAll().find(c => c.id === id) || null;
    },

    /**
     * Switch to a conversation
     */
    switchTo(id) {
        const conv = this.get(id);
        if (conv) {
            this.currentId = id;
            return conv;
        }
        return null;
    },

    /**
     * Add a message to the current conversation
     */
    addMessage(role, content) {
        const conversations = this.getAll();
        const conv = conversations.find(c => c.id === this.currentId);
        if (!conv) return;

        conv.messages.push({
            role: role,
            content: content,
            timestamp: new Date().toISOString()
        });

        // Auto-title from first user message
        if (role === 'user' && conv.messages.filter(m => m.role === 'user').length === 1) {
            conv.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        }

        conv.updatedAt = new Date().toISOString();
        this._saveAll(conversations);
    },

    /**
     * Update the last assistant message (for streaming)
     */
    updateLastAssistant(content, thinking) {
        const conversations = this.getAll();
        const conv = conversations.find(c => c.id === this.currentId);
        if (!conv) return;

        const lastMsg = conv.messages[conv.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = content;
            if (thinking) lastMsg.thinking = thinking;
        } else {
            conv.messages.push({
                role: 'assistant',
                content: content,
                thinking: thinking || '',
                timestamp: new Date().toISOString()
            });
        }

        conv.updatedAt = new Date().toISOString();
        this._saveAll(conversations);
    },

    /**
     * Delete a conversation
     */
    delete(id) {
        let conversations = this.getAll();
        conversations = conversations.filter(c => c.id !== id);
        this._saveAll(conversations);

        if (this.currentId === id) {
            this.currentId = conversations.length > 0 ? conversations[0].id : null;
        }
    },

    /**
     * Rename a conversation
     */
    rename(id, newTitle) {
        const conversations = this.getAll();
        const conv = conversations.find(c => c.id === id);
        if (conv) {
            conv.title = newTitle;
            this._saveAll(conversations);
        }
    },

    /**
     * Get conversation list (summary only, no messages)
     */
    getList() {
        return this.getAll().map(c => ({
            id: c.id,
            title: c.title,
            messageCount: c.messages.length,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt
        }));
    },

    /**
     * Clear all conversations
     */
    clearAll() {
        this._saveAll([]);
        this.currentId = null;
    },

    /**
     * Export conversation as markdown
     */
    exportAsMarkdown(id) {
        const conv = this.get(id);
        if (!conv) return '';

        let md = '# ' + conv.title + '\n\n';
        md += '_Created: ' + new Date(conv.createdAt).toLocaleString() + '_\n\n---\n\n';

        conv.messages.forEach(m => {
            if (m.role === 'user') {
                md += '## User\n\n' + m.content + '\n\n';
            } else if (m.role === 'assistant') {
                md += '## Assistant\n\n';
                if (m.thinking) {
                    md += '<details><summary>Thinking</summary>\n\n' + m.thinking + '\n\n</details>\n\n';
                }
                md += m.content + '\n\n';
            }
            md += '---\n\n';
        });

        return md;
    }
};

window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.History = HistoryModule;
