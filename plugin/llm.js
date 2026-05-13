/**
 * Typora-GPT LLM Module
 * Handles communication with LLM APIs (OpenAI, Anthropic, or any OpenAI-compatible service).
 */

const LLMModule = {
    currentAbortController: null,
    // Provider configurations
    providers: {
        openai: {
            name: 'OpenAI',
            defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
            defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            headers(apiKey) {
                return {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
            }
        },
        anthropic: {
            name: 'Anthropic',
            defaultEndpoint: 'https://api.anthropic.com/v1/messages',
            defaultModels: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
            headers(apiKey) {
                return {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                };
            }
        },
        custom: {
            name: 'Custom (OpenAI-compatible)',
            defaultEndpoint: 'http://localhost:11434/v1/chat/completions',
            defaultModels: ['custom-model'],
            headers(apiKey) {
                const h = {
                    'Content-Type': 'application/json'
                };
                if (apiKey) {
                    h['Authorization'] = `Bearer ${apiKey}`;
                }
                return h;
            }
        }
    },

    modelCaps: [
        { pattern:/gpt-5\.5/i, contextWindow:1050000, maxOutputTokens:128000, vision:true },
        { pattern:/gpt-5\.(4|3|2)/i, contextWindow:1050000, maxOutputTokens:128000, vision:true },
        { pattern:/gpt-4\.1/i, contextWindow:1047576, maxOutputTokens:32768, vision:true },
        { pattern:/gpt-4o/i, contextWindow:128000, maxOutputTokens:16384, vision:true },
        { pattern:/gpt-4-turbo/i, contextWindow:128000, maxOutputTokens:4096, vision:true },
        { pattern:/gpt-3\.5-turbo/i, contextWindow:16385, maxOutputTokens:4096, vision:false },
        { pattern:/o(1|3|4)/i, contextWindow:200000, maxOutputTokens:100000, vision:false },
        { pattern:/claude-(opus-4-7|opus-4-6|sonnet-4-6)/i, contextWindow:1000000, maxOutputTokens:128000, vision:true },
        { pattern:/claude-(sonnet|opus|haiku|3|4)/i, contextWindow:200000, maxOutputTokens:64000, vision:true },
        { pattern:/deepseek-v4/i, contextWindow:1000000, maxOutputTokens:128000, vision:false },
        { pattern:/deepseek-chat|deepseek-reasoner/i, contextWindow:64000, maxOutputTokens:8192, vision:false },
        { pattern:/deepseek-(v3|r1)/i, contextWindow:128000, maxOutputTokens:8192, vision:false },
        { pattern:/gemini-(3|2\.5|2\.0|1\.5)/i, contextWindow:1048576, maxOutputTokens:65536, vision:true },
        { pattern:/qwen.*(vl|vision)/i, contextWindow:128000, maxOutputTokens:8192, vision:true },
        { pattern:/qwen|llama|mistral|mixtral|glm|kimi|yi-/i, contextWindow:128000, maxOutputTokens:8192, vision:false }
    ],

    _extractModelCaps(model) {
        if (!model || typeof model !== 'object') return null;
        const contextWindow = model.context_window || model.contextWindow || model.context_length ||
            model.contextLength || model.max_context_length || model.maxContextLength ||
            model.input_token_limit || model.inputTokenLimit || model.max_input_tokens ||
            model.maxInputTokens || model.n_ctx || model.num_ctx;
        const maxOutputTokens = model.max_output_tokens || model.maxOutputTokens ||
            model.output_token_limit || model.outputTokenLimit || model.max_tokens ||
            model.maxTokens;
        const id = model.id || model.name || model.baseModelId || model.model || '';
        const caps = this.inferModelCapabilities(id);
        return {
            id,
            contextWindow: Number(contextWindow) || caps.contextWindow,
            maxOutputTokens: Number(maxOutputTokens) || caps.maxOutputTokens,
            vision: model.vision ?? model.supports_vision ?? caps.vision,
            source: Number(contextWindow) ? 'api' : caps.source
        };
    },

    inferModelCapabilities(modelId) {
        const id = (modelId || '').toString();
        for (const cap of this.modelCaps) {
            if (cap.pattern.test(id)) {
                return {
                    contextWindow: cap.contextWindow,
                    maxOutputTokens: cap.maxOutputTokens,
                    vision: cap.vision,
                    source: 'known-model'
                };
            }
        }
        return { contextWindow: 128000, maxOutputTokens: 8192, vision: false, source: 'fallback' };
    },

    /**
     * Get saved settings
     */
    getSettings() {
        try {
            const saved = localStorage.getItem('typora-gpt-settings');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    },

    /**
     * Save settings
     */
    saveSettings(settings) {
        try {
            localStorage.setItem('typora-gpt-settings', JSON.stringify(settings));
        } catch (e) {
            console.error('[Typora-GPT] Failed to save settings:', e);
        }
    },

    /**
     * Get the current provider config
     */
    /**
     * Normalize endpoint URL - auto-complete path if user only provides base URL
     * e.g. "https://api.example.com/v1" -> "https://api.example.com/v1/chat/completions"
     */
    _normalizeEndpoint(endpoint, providerId) {
        if (!endpoint) return endpoint;

        // Remove trailing slash
        endpoint = endpoint.replace(/\/+$/, '');

        if (providerId === 'anthropic') {
            // Anthropic: /v1 -> /v1/messages
            if (endpoint.match(/\/v1$/)) {
                return endpoint + '/messages';
            }
            if (!endpoint.includes('/messages')) {
                return endpoint + '/v1/messages';
            }
            return endpoint;
        }

        // OpenAI / Custom (OpenAI-compatible)
        // Already has the full path
        if (endpoint.includes('/chat/completions') || endpoint.includes('/completions')) {
            return endpoint;
        }

        // Ends with /v1 -> append /chat/completions
        if (endpoint.match(/\/v\d+$/)) {
            return endpoint + '/chat/completions';
        }

        // Just a base URL -> append /v1/chat/completions
        if (!endpoint.includes('/v')) {
            return endpoint + '/v1/chat/completions';
        }

        // Fallback: append /chat/completions
        return endpoint + '/chat/completions';
    },

    getProviderConfig() {
        const settings = this.getSettings();
        const providerId = settings.provider || 'openai';
        const rawEndpoint = settings.endpoint || this.providers[providerId].defaultEndpoint;
        const model = settings.model || this.providers[providerId].defaultModels[0];
        const caps = settings.modelCapabilities?.id === model
            ? settings.modelCapabilities
            : this.inferModelCapabilities(model);
        const maxTokens = settings.maxTokens ?? Math.min(caps.maxOutputTokens || 8192, 8192);
        return {
            id: providerId,
            ...this.providers[providerId],
            apiKey: settings.apiKey || '',
            endpoint: this._normalizeEndpoint(rawEndpoint, providerId),
            model,
            temperature: settings.temperature ?? 0.7,
            maxTokens,
            maxContextTokens: settings.maxContextTokens || caps.contextWindow || 128000,
            modelCapabilities: caps,
            systemPrompt: settings.systemPrompt || this.getDefaultSystemPrompt(),
            enableThinking: settings.enableThinking ?? false,
            thinkingEffort: settings.thinkingEffort ?? 'medium'
        };
    },

    /**
     * Estimate token count from text
     * Heuristic: ~1 token per 3.5 chars (mix of CJK and Latin)
     */
    estimateTokens(text) {
        if (!text) return 0;
        if (Array.isArray(text)) {
            return text.reduce((sum, item) => sum + this.estimateTokens(item), 0);
        }
        if (typeof text === 'object') {
            if (text.type === 'image_url' || text.type === 'image') return 2000;
            if (text.text) return this.estimateTokens(text.text);
            if (text.source || text.image_url) return 2000;
            text = JSON.stringify(text);
        }
        text = String(text);
        // Count CJK characters (roughly 1 token each)
        const cjkCount = (text.match(/[一-鿿㐀-䶿豈-﫿]/g) || []).length;
        // Remaining characters (~4 chars per token)
        const otherCount = text.length - cjkCount;
        return Math.ceil(cjkCount + otherCount / 3.5);
    },

    _messageText(content) {
        if (!content) return '';
        if (Array.isArray(content)) {
            return content.map(item => this._messageText(item)).filter(Boolean).join('\n');
        }
        if (typeof content === 'object') {
            if (content.type === 'image_url' || content.type === 'image' || content.source || content.image_url) return '[image attachment]';
            if (content.text) return String(content.text);
            return JSON.stringify(content);
        }
        return String(content);
    },

    _compressTextExtractive(text, maxTokens) {
        const budget = Math.max(120, Math.floor(maxTokens * 3.5));
        text = this._messageText(text).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
        if (this.estimateTokens(text) <= maxTokens) return text;

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const important = [];
        const seen = new Set();
        const keepLine = (line) => {
            const key = line.toLowerCase();
            if (!line || seen.has(key)) return;
            seen.add(key);
            important.push(line);
        };

        lines.forEach(line => {
            if (/^(#{1,6}\s|[-*]\s|\d+\.\s|>\s|\|.*\||```|todo|fix|bug|error|important|注意|需求|问题|结论|实现|接口|路径)/i.test(line)) {
                keepLine(line);
            }
        });
        lines.slice(0, 8).forEach(keepLine);
        lines.slice(-8).forEach(keepLine);

        let out = important.join('\n');
        if (out.length > budget) out = out.slice(0, budget);
        return out + '\n[content compacted extractively]';
    },

    _messagesToTranscript(messages, maxTokens) {
        const parts = [];
        let used = 0;
        for (const m of messages) {
            const text = this._messageText(m.content);
            const tokens = this.estimateTokens(text);
            const remaining = maxTokens - used;
            if (remaining <= 100) break;
            const body = tokens > remaining
                ? this._compressTextExtractive(text, remaining)
                : text;
            parts.push('[' + m.role + ']\n' + body);
            used += this.estimateTokens(body);
        }
        return parts.join('\n\n---\n\n');
    },

    _localCompactSummary(messages, targetTokens) {
        const lines = [];
        lines.push('[Compacted earlier context]');
        lines.push('This summary preserves older conversation context that no longer fits verbatim.');
        messages.forEach((m, i) => {
            const text = this._compressTextExtractive(m.content, Math.max(80, Math.floor(targetTokens / Math.max(messages.length, 1))));
            lines.push('- ' + (i + 1) + '. ' + m.role + ': ' + text.replace(/\n+/g, ' | '));
        });
        return this._compressTextExtractive(lines.join('\n'), targetTokens);
    },

    async _summarizeForCompaction(messages, targetTokens, config) {
        if (!messages.length) return '';
        if (!config.apiKey && config.id !== 'custom') return this._localCompactSummary(messages, targetTokens);

        const transcriptBudget = Math.min(Math.floor((config.maxContextTokens || 128000) * 0.45), Math.max(4000, targetTokens * 8));
        const transcript = this._messagesToTranscript(messages, transcriptBudget);
        const system = 'You compress old chat context for a Markdown editor assistant. Preserve user goals, constraints, decisions, document facts, file paths, API/model settings, unresolved tasks, and assistant conclusions. Remove chatter. Do not invent facts.';
        const user = 'Create a compact state summary for future turns. Use Markdown with these sections: User goals, Important context, Decisions made, Open tasks, Recent constraints. Keep it under about ' + targetTokens + ' tokens.\n\n' + transcript;

        try {
            const compactConfig = { ...config, maxTokens: Math.max(512, Math.min(targetTokens, config.maxTokens || targetTokens)), temperature: 0.2 };
            const isAnthropic = compactConfig.id === 'anthropic';
            const body = this._buildRequestBody(compactConfig, [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ], isAnthropic);
            body.stream = false;
            const response = await fetch(compactConfig.endpoint, {
                method: 'POST',
                headers: compactConfig.headers(compactConfig.apiKey),
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('compact failed: ' + response.status);
            const data = await response.json();
            const summary = isAnthropic ? (data.content?.[0]?.text || '') : (data.choices?.[0]?.message?.content || '');
            return summary ? this._compressTextExtractive(summary, targetTokens) : this._localCompactSummary(messages, targetTokens);
        } catch (e) {
            console.warn('[Typora-GPT] Model compaction failed; using local compaction.', e);
            return this._localCompactSummary(messages, targetTokens);
        }
    },

    /**
     * Compact messages to fit within token budget.
     * Preserves system messages and recent turns, summarizes older context.
     */
    async compactMessagesForContext(messages, maxContextTokens, maxOutputTokens) {
        const budget = Math.max(1000, maxContextTokens - Math.min(maxOutputTokens || 0, 20000) - 500);

        let totalTokens = 0;
        messages.forEach(m => { totalTokens += this.estimateTokens(m.content); });

        if (totalTokens <= budget) return messages;

        console.log('[Typora-GPT] Context too large (' + totalTokens + ' tokens), compacting to ' + budget);

        const systemMsgs = messages.filter(m => m.role === 'system');
        const otherMsgs = messages.filter(m => m.role !== 'system');
        const result = [];
        let usedTokens = 0;

        systemMsgs.forEach(m => {
            const tokens = this.estimateTokens(m.content);
            const systemBudget = Math.floor(budget * 0.25);
            if (usedTokens + tokens <= systemBudget) {
                result.push(m);
                usedTokens += tokens;
            } else {
                const compacted = this._compressTextExtractive(m.content, Math.max(300, systemBudget - usedTokens));
                if (compacted) {
                    result.push({ role: m.role, content: compacted });
                    usedTokens += this.estimateTokens(compacted);
                }
            }
        });

        const recent = [];
        let recentTokens = 0;
        const recentBudget = Math.max(600, Math.floor(budget * 0.55));
        for (let i = otherMsgs.length - 1; i >= 0; i--) {
            const m = otherMsgs[i];
            const tokens = this.estimateTokens(m.content);
            if (recent.length >= 2 && recentTokens + tokens > recentBudget) break;
            recent.unshift(m);
            recentTokens += tokens;
            if (recent.length >= 8 && recentTokens > recentBudget * 0.75) break;
        }

        const olderCount = otherMsgs.length - recent.length;
        const older = otherMsgs.slice(0, Math.max(0, olderCount));
        if (older.length) {
            const summaryBudget = Math.max(500, Math.min(4000, budget - usedTokens - recentTokens - 200));
            const summary = await this._summarizeForCompaction(older, summaryBudget, this.getProviderConfig());
            const summaryMsg = {
                role: 'system',
                content: 'Earlier conversation has been compacted. Use this as authoritative context:\n\n' + summary
            };
            result.push(summaryMsg);
            usedTokens += this.estimateTokens(summaryMsg.content);
        }

        for (const m of recent) {
            const remaining = budget - usedTokens - 100;
            const tokens = this.estimateTokens(m.content);
            if (tokens <= remaining) {
                result.push(m);
                usedTokens += tokens;
            } else if (m === recent[recent.length - 1]) {
                const compacted = this._compressTextExtractive(m.content, Math.max(300, remaining));
                result.push({ ...m, content: compacted });
                usedTokens += this.estimateTokens(compacted);
            }
        }

        return result;
    },

    truncateMessages(messages, maxContextTokens, maxOutputTokens) {
        return this.compactMessagesForContext(messages, maxContextTokens, maxOutputTokens);
    },

    getContextStatus(messages = []) {
        const config = this.getProviderConfig();
        const used = messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);
        const reserved = Math.min(config.maxTokens || 0, 20000) + 500;
        const usable = Math.max(1000, config.maxContextTokens - reserved);
        return {
            used,
            usable,
            total: config.maxContextTokens,
            reserved,
            percent: Math.min(100, Math.round((used / usable) * 100)),
            source: config.modelCapabilities?.source || 'fallback'
        };
    },

    /**
     * Default system prompt
     */
    getDefaultSystemPrompt() {
        return `You are a helpful AI assistant integrated into the Typora Markdown editor.
You help users understand, improve, and work with their Markdown documents.
When given document context, analyze it carefully and provide relevant, accurate responses.
If asked to write or edit content, produce clean Markdown formatting.
Markdown output rules:
- Use GitHub-flavored Markdown.
- Use fenced code blocks only for executable code, logs, or literal snippets. Do not put mathematical formulas in code blocks.
- Put display math in its own block wrapped by $$ on both sides.
- Put inline math in $...$ only when it is short and appears inside a sentence.
- Use braces for all LaTeX subscripts and superscripts with more than one character, for example E_{mri}, L_{total}, A_{T}, z_{S}, \lambda_{cls}.
- Prefer LaTeX operators for equations: \operatorname{softmax}, \operatorname{MLP}, \sum, \cdot.
- When explaining model formulas or algorithms, use headings, bullet lists, tables, and display equations instead of raw pseudo-code unless the user asks for code.
Be concise but thorough. Respond in the same language as the user's question.`;
    },

    /**
     * Make a streaming API call to the LLM
     * @param {Array} messages - Chat messages array
     * @param {function} onToken - Callback for each token received
     * @param {function} onDone - Callback when streaming is complete
     * @param {function} onError - Callback for errors
     * @returns {AbortController} For cancellation
     */
    async streamChat(messages, onToken, onDone, onError) {
        const config = this.getProviderConfig();
        const abortController = new AbortController();
        this.currentAbortController = abortController;

        if (!config.apiKey && config.id !== 'custom') {
            onError('Please configure your API key in settings (click the gear icon).');
            return abortController;
        }

        try {
            const isAnthropic = config.id === 'anthropic';

            // Compact messages if context is too large
            messages = await this.compactMessagesForContext(messages, config.maxContextTokens, config.maxTokens);

            const body = this._buildRequestBody(config, messages, isAnthropic);
            const headers = config.headers(config.apiKey);

            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: abortController.signal
            });

            if (!response.ok) {
                let errorMsg = 'API Error: ' + response.status + ' ' + response.statusText;
                let rawError = '';
                try {
                    const errorBody = await response.json();
                    rawError = errorBody.error?.message || errorBody.message || '';
                    errorMsg = rawError || errorMsg;
                } catch (e) {}

                // Helpful hints based on error type
                if (response.status === 404) {
                    errorMsg += '\n\nEndpoint: ' + config.endpoint;
                    errorMsg += '\nTip: Make sure endpoint includes /v1/chat/completions';
                } else if (response.status === 400 || rawError.toLowerCase().includes('param')) {
                    errorMsg += '\n\nModel: "' + config.model + '"';
                    errorMsg += '\nEndpoint: ' + config.endpoint;
                    errorMsg += '\nTip: The model name may be incorrect.';
                    errorMsg += '\nUse the "Fetch Models" button in settings to see available models.';
                } else if (response.status === 401) {
                    errorMsg += '\n\nTip: Check your API Key in settings.';
                }

                this.currentAbortController = null;
                onError(errorMsg);
                return abortController;
            }

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));

                        if (isAnthropic) {
                            // Anthropic thinking or text
                            const delta = json.delta;
                            if (delta) {
                                if (delta.type === 'thinking_delta') {
                                    // Thinking content - emit with prefix if first thinking token
                                    if (onToken && delta.thinking) {
                                        onToken(delta.thinking, 'thinking');
                                    }
                                } else if (delta.type === 'text_delta' && delta.text) {
                                    onToken(delta.text, 'text');
                                } else if (delta.text) {
                                    onToken(delta.text, 'text');
                                }
                            }
                        } else {
                            // OpenAI-compatible
                            const choice = json.choices?.[0];
                            const delta = choice?.delta;

                            if (delta) {
                                // Regular content
                                if (delta.content) {
                                    onToken(delta.content, 'text');
                                }
                                // DeepSeek-style reasoning_content
                                if (delta.reasoning_content) {
                                    onToken(delta.reasoning_content, 'thinking');
                                }
                            }
                        }
                    } catch (e) {
                        // Skip malformed JSON lines
                    }
                }
            }

            this.currentAbortController = null;
            onDone();
        } catch (error) {
            if (error.name === 'AbortError') {
                this.currentAbortController = null;
                onDone();
            } else {
                this.currentAbortController = null;
                onError(error.message || 'Network error occurred');
            }
        }

        return abortController;
    },

    /**
     * Build request body based on provider
     */
    _buildRequestBody(config, messages, isAnthropic) {
        const thinkingBudgetMap = { low: 2048, medium: 8192, high: 32768 };

        if (isAnthropic) {
            const systemText = messages
                .filter(m => m.role === 'system')
                .map(m => m.content)
                .join('\n\n');
            const chatMessages = messages.filter(m => m.role !== 'system');

            const body = {
                model: config.model,
                max_tokens: config.maxTokens,
                stream: true,
                system: systemText || config.systemPrompt,
                messages: chatMessages.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    // content can be string or array (multi-modal)
                    content: Array.isArray(m.content) ? m.content : m.content
                }))
            };

            // Anthropic extended thinking
            if (config.enableThinking) {
                body.thinking = {
                    type: 'enabled',
                    budget_tokens: thinkingBudgetMap[config.thinkingEffort] || 8192
                };
                // temperature must be 1 when thinking is enabled
                body.temperature = 1;
            } else {
                body.temperature = config.temperature;
            }

            return body;
        }

        // OpenAI-compatible format
        const body = {
            model: config.model,
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            stream: true,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        };

        // Thinking/reasoning mode for compatible providers
        if (config.enableThinking) {
            // DeepSeek, QwQ, and similar providers
            body.enable_thinking = true;
            body.thinking_budget = thinkingBudgetMap[config.thinkingEffort] || 8192;

            // Some providers use reasoning_effort (OpenAI o1/o3 style)
            body.reasoning_effort = config.thinkingEffort;

            // Some thinking models need temperature = 1
            if (config.model && (config.model.includes('deepseek-r1') || config.model.includes('qwq') || config.model.includes('thinking'))) {
                body.temperature = 1;
            }
        }

        return body;
    },

    /**
     * Non-streaming chat completion (for quick tasks)
     * @param {Array} messages
     * @returns {Promise<string>} Response text
     */
    async chat(messages) {
        const config = this.getProviderConfig();
        const isAnthropic = config.id === 'anthropic';
        messages = await this.compactMessagesForContext(messages, config.maxContextTokens, config.maxTokens);
        const body = this._buildRequestBody(config, messages, isAnthropic);
        body.stream = false;

        const headers = config.headers(config.apiKey);

        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();

        if (isAnthropic) {
            return data.content?.[0]?.text || '';
        }
        return data.choices?.[0]?.message?.content || '';
    },

    /**
     * Fetch available models from the API
     * @returns {Promise<{success: boolean, models: Array, message: string}>}
     */
    async fetchModels() {
        const config = this.getProviderConfig();
        if (!config.apiKey && config.id !== 'custom') {
            return { success: false, models: [], message: 'Please set API key first.' };
        }

        try {
            // Derive the models endpoint from the chat endpoint
            let modelsUrl = config.endpoint;
            // /v1/chat/completions -> /v1/models
            modelsUrl = modelsUrl.replace(/\/chat\/completions.*$/, '/models');
            modelsUrl = modelsUrl.replace(/\/completions.*$/, '/models');
            if (!modelsUrl.endsWith('/models')) {
                modelsUrl = modelsUrl.replace(/\/v\d+.*$/, '/v1/models');
            }

            const headers = { 'Content-Type': 'application/json' };
            if (config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey;

            const response = await fetch(modelsUrl, { method: 'GET', headers });

            if (!response.ok) {
                return { success: false, models: [], message: 'Failed to fetch models: ' + response.status };
            }

            const data = await response.json();
            const rawModels = data.data || data.models || [];
            const modelCaps = {};
            const models = rawModels.map(m => {
                const caps = this._extractModelCaps(m);
                if (caps?.id) modelCaps[caps.id] = caps;
                return caps?.id || m.id || m.name || m;
            }).filter(Boolean);

            if (models.length === 0) {
                return { success: false, models: [], message: 'No models found in response.' };
            }

            return { success: true, models: models, modelCaps, message: 'Found ' + models.length + ' model(s)' };
        } catch (error) {
            return { success: false, models: [], message: 'Error: ' + error.message };
        }
    },

    async fetchCurrentModelCapabilities() {
        const config = this.getProviderConfig();
        let caps = this.inferModelCapabilities(config.model);

        try {
            if (config.endpoint.includes('localhost:11434') || config.endpoint.includes('127.0.0.1:11434')) {
                const response = await fetch('http://localhost:11434/api/show', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: config.model })
                });
                if (response.ok) {
                    const data = await response.json();
                    const info = data.model_info || data.details || data;
                    const ctx = info['llama.context_length'] || info['general.context_length'] ||
                        info.context_length || data.context_length;
                    if (ctx) caps = { ...caps, contextWindow: Number(ctx), source: 'ollama-show' };
                }
            }
        } catch (e) {}

        const settings = this.getSettings();
        settings.modelCapabilities = { id: config.model, ...caps };
        if (!settings.maxContextTokens) delete settings.maxContextTokens;
        this.saveSettings(settings);
        return settings.modelCapabilities;
    },

    /**
     * Test the API connection
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async testConnection() {
        try {
            const response = await this.chat([
                { role: 'system', content: 'Reply with exactly: OK' },
                { role: 'user', content: 'Test' }
            ]);
            return { success: true, message: `Connected! Response: "${response.substring(0, 50)}"` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

// Export
window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.LLM = LLMModule;
