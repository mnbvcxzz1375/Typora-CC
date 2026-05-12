/**
 * Typora-GPT LLM Module
 * Handles communication with LLM APIs (OpenAI, Anthropic, or any OpenAI-compatible service).
 */

const LLMModule = {
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
        return {
            id: providerId,
            ...this.providers[providerId],
            apiKey: settings.apiKey || '',
            endpoint: this._normalizeEndpoint(rawEndpoint, providerId),
            model: settings.model || this.providers[providerId].defaultModels[0],
            temperature: settings.temperature ?? 0.7,
            maxTokens: settings.maxTokens ?? 4096,
            maxContextTokens: settings.maxContextTokens ?? 120000,
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
        // Count CJK characters (roughly 1 token each)
        const cjkCount = (text.match(/[一-鿿㐀-䶿豈-﫿]/g) || []).length;
        // Remaining characters (~4 chars per token)
        const otherCount = text.length - cjkCount;
        return Math.ceil(cjkCount + otherCount / 3.5);
    },

    /**
     * Truncate messages array to fit within token budget
     * Preserves system message and last user message, truncates middle
     */
    truncateMessages(messages, maxContextTokens, maxOutputTokens) {
        const budget = maxContextTokens - maxOutputTokens - 500; // 500 token safety margin

        // Calculate total tokens
        let totalTokens = 0;
        messages.forEach(m => { totalTokens += this.estimateTokens(m.content); });

        if (totalTokens <= budget) return messages;

        console.log('[Typora-GPT] Context too large (' + totalTokens + ' tokens), truncating to ' + budget);

        // Keep system messages and last user message, truncate middle conversation
        const result = [];
        let usedTokens = 0;

        // Always include system messages
        const systemMsgs = messages.filter(m => m.role === 'system');
        const otherMsgs = messages.filter(m => m.role !== 'system');

        systemMsgs.forEach(m => {
            const tokens = this.estimateTokens(m.content);
            if (usedTokens + tokens < budget * 0.4) { // System msgs get 40% budget
                result.push(m);
                usedTokens += tokens;
            } else {
                // Truncate this system message
                const maxChars = Math.floor((budget * 0.4 - usedTokens) * 3);
                if (maxChars > 100) {
                    result.push({ role: m.role, content: m.content.substring(0, maxChars) + '\n\n[... truncated ...]' });
                }
                usedTokens = budget * 0.4;
            }
        });

        // Include last user message (most important)
        const lastUser = otherMsgs[otherMsgs.length - 1];
        if (lastUser) {
            const lastTokens = this.estimateTokens(lastUser.content);
            const remainingBudget = budget - usedTokens;

            if (lastTokens > remainingBudget * 0.6) {
                // Truncate the last user message
                const maxChars = Math.floor(remainingBudget * 0.6 * 3);
                result.push({ role: lastUser.role, content: lastUser.content.substring(0, maxChars) + '\n\n[... truncated ...]' });
            } else {
                result.push(lastUser);
            }
        }

        return result;
    },

    /**
     * Default system prompt
     */
    getDefaultSystemPrompt() {
        return `You are a helpful AI assistant integrated into the Typora Markdown editor.
You help users understand, improve, and work with their Markdown documents.
When given document context, analyze it carefully and provide relevant, accurate responses.
If asked to write or edit content, produce clean Markdown formatting.
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

        if (!config.apiKey && config.id !== 'custom') {
            onError('Please configure your API key in settings (click the gear icon).');
            return abortController;
        }

        try {
            const isAnthropic = config.id === 'anthropic';

            // Truncate messages if context is too large
            messages = this.truncateMessages(messages, config.maxContextTokens, config.maxTokens);

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

            onDone();
        } catch (error) {
            if (error.name === 'AbortError') {
                onDone();
            } else {
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
            const systemMsg = messages.find(m => m.role === 'system');
            const chatMessages = messages.filter(m => m.role !== 'system');

            const body = {
                model: config.model,
                max_tokens: config.maxTokens,
                stream: true,
                system: systemMsg?.content || config.systemPrompt,
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
            const models = (data.data || data.models || []).map(m => m.id || m.name || m).filter(Boolean);

            if (models.length === 0) {
                return { success: false, models: [], message: 'No models found in response.' };
            }

            return { success: true, models: models, message: 'Found ' + models.length + ' model(s)' };
        } catch (error) {
            return { success: false, models: [], message: 'Error: ' + error.message };
        }
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
