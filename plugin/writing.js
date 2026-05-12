/**
 * Typora-GPT Writing Module
 * Provides writing assistance features: polish, continue, translate, summarize, explain.
 */

const WritingModule = {
    /**
     * Get the LLM module reference
     */
    get llm() {
        return window.TyporaGPT.LLM;
    },

    /**
     * Get the Context module reference
     */
    get context() {
        return window.TyporaGPT.Context;
    },

    /**
     * Get currently selected text or full document
     * @param {boolean} selectedOnly - Only get selected text
     * @returns {{text: string, isSelection: boolean}}
     */
    getWorkingText(selectedOnly = false) {
        const selected = this.context.getSelectedText();
        if (selected && selected.length > 10) {
            return { text: selected, isSelection: true };
        }
        if (selectedOnly) {
            return { text: '', isSelection: false };
        }
        return { text: this.context.getCurrentDocumentContent(), isSelection: false };
    },

    /**
     * Polish / improve writing quality
     * @param {function} onToken - Streaming token callback
     * @param {function} onDone - Completion callback
     * @param {function} onError - Error callback
     */
    async polish(onToken, onDone, onError) {
        const { text, isSelection } = this.getWorkingText(true);
        if (!text) {
            onError('Please select some text first, or use this on the full document via chat.');
            return;
        }

        const messages = [
            {
                role: 'system',
                content: `You are a professional writing editor. Improve the following text while:
- Fixing grammar and spelling errors
- Improving clarity and readability
- Maintaining the original meaning and tone
- Keeping Markdown formatting intact
- Being concise and not adding unnecessary content

Output ONLY the improved text, no explanations.`
            },
            { role: 'user', content: text }
        ];

        return this.llm.streamChat(messages, onToken, onDone, onError);
    },

    /**
     * Continue writing from the current position
     * @param {function} onToken
     * @param {function} onDone
     * @param {function} onError
     */
    async continueWriting(onToken, onDone, onError) {
        const content = this.context.getCurrentDocumentContent();

        const messages = [
            {
                role: 'system',
                content: `You are a writing assistant. Continue the following text naturally, maintaining the same style, tone, and formatting. Write 2-4 paragraphs unless the context suggests otherwise. Do not repeat what's already written. Output ONLY the continuation text.`
            },
            { role: 'user', content: `Continue writing from where this text ends:\n\n${content}` }
        ];

        return this.llm.streamChat(messages, onToken, onDone, onError);
    },

    /**
     * Translate text
     * @param {string} targetLang - Target language (e.g., 'Chinese', 'English', 'Japanese')
     * @param {function} onToken
     * @param {function} onDone
     * @param {function} onError
     */
    async translate(targetLang, onToken, onDone, onError) {
        const { text, isSelection } = this.getWorkingText();
        if (!text) {
            onError('No text to translate.');
            return;
        }

        const messages = [
            {
                role: 'system',
                content: `You are a professional translator. Translate the following text to ${targetLang}.
Rules:
- Keep Markdown formatting intact
- Maintain the original tone and style
- For technical terms, keep the original in parentheses if appropriate
- Output ONLY the translated text, no explanations`
            },
            { role: 'user', content: text }
        ];

        return this.llm.streamChat(messages, onToken, onDone, onError);
    },

    /**
     * Summarize the document or selected text
     * @param {function} onToken
     * @param {function} onDone
     * @param {function} onError
     * @param {string} language - Output language
     */
    async summarize(onToken, onDone, onError, language = '') {
        const { text } = this.getWorkingText();
        if (!text) {
            onError('No text to summarize.');
            return;
        }

        const langInstruction = language ? `Respond in ${language}.` : 'Respond in the same language as the source text.';

        const messages = [
            {
                role: 'system',
                content: `You are a document summarization expert. Provide a clear, well-structured summary.
${langInstruction}
Format the summary with:
- A one-line TL;DR
- Key points as a bullet list
- Any action items or notable conclusions`
            },
            { role: 'user', content: `Summarize this text:\n\n${text}` }
        ];

        return this.llm.streamChat(messages, onToken, onDone, onError);
    },

    /**
     * Explain the document or selected text
     * @param {function} onToken
     * @param {function} onDone
     * @param {function} onError
     */
    async explain(onToken, onDone, onError) {
        const { text, isSelection } = this.getWorkingText();
        if (!text) {
            onError('No text to explain.');
            return;
        }

        const context = isSelection ? 'the selected text' : 'this document';

        const messages = [
            {
                role: 'system',
                content: 'You are a helpful teacher. Explain the given text clearly and thoroughly. Use examples where helpful. Respond in the same language as the source text.'
            },
            { role: 'user', content: `Explain ${context}:\n\n${text}` }
        ];

        return this.llm.streamChat(messages, onToken, onDone, onError);
    },

    /**
     * Generate content based on a custom prompt
     * @param {string} prompt - User's custom prompt
     * @param {function} onToken
     * @param {function} onDone
     * @param {function} onError
     * @param {string} contextMode - 'document', 'folder', or 'none'
     */
    async customQuery(prompt, onToken, onDone, onError, contextMode = 'document', attachments = []) {
        const config = this.llm.getProviderConfig();

        // Build enhanced system prompt with memory, instructions, plan mode, etc.
        let systemPrompt = config.systemPrompt;
        const features = window.TyporaGPT.Features;
        if (features) {
            systemPrompt = await features.buildFullSystemPrompt(systemPrompt);
        }

        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add context based on mode
        let contextStr = '';
        if (contextMode === 'folder') {
            contextStr = this.context.buildFolderContext({ maxFiles: 8, maxCharsPerFile: 2000 });
        } else if (contextMode === 'document') {
            contextStr = this.context.buildDocumentContext();
        }

        if (contextStr) {
            messages.push({
                role: 'system',
                content: `Here is the context for the user's question:\n\n${contextStr}`
            });
        }

        // Add selected text if any
        const selectedText = this.context.getSelectedText();
        if (selectedText && selectedText.length > 10) {
            messages.push({
                role: 'system',
                content: `The user has selected the following text:\n\n${selectedText}`
            });
        }

        // Build user message content (may be multi-modal if images attached)
        const media = window.TyporaGPT.Media;
        const isAnthropic = config.id === 'anthropic';
        let userContent;

        if (attachments && attachments.length > 0 && media) {
            // Check if current model supports vision
            const hasImages = attachments.some(a => a.type === 'image');
            if (hasImages && !media.isVisionModel(config.model)) {
                // Non-vision model: OCR the images first
                const imageAttachments = attachments.filter(a => a.type === 'image');
                const otherAttachments = attachments.filter(a => a.type !== 'image');
                let ocrText = '';
                for (const img of imageAttachments) {
                    try {
                        ocrText += '\n\n[Image OCR: ' + img.name + ']\n' + await media.performOCR(img.data);
                    } catch (e) {
                        ocrText += '\n\n[Image: ' + img.name + ' - OCR failed: ' + e.message + ']';
                    }
                }
                userContent = prompt + ocrText;
                // Add other text file attachments
                otherAttachments.forEach(f => {
                    userContent += '\n\n---\n**File: ' + f.name + '**\n```\n' + (f.data || '').substring(0, 10000) + '\n```';
                });
            } else {
                // Vision model: send multi-modal content
                userContent = media.buildMultiModalContent(prompt, attachments, isAnthropic);
            }
        } else {
            userContent = prompt;
        }

        messages.push({ role: 'user', content: userContent });

        return this.llm.streamChat(messages, onToken, onDone, onError);
    },

    /**
     * Get quick action buttons configuration
     * @returns {Array<{id: string, label: string, icon: string, requiresSelection: boolean}>}
     */
    getQuickActions() {
        return [
            { id: 'polish', label: 'Polish', icon: '✨', requiresSelection: true },
            { id: 'continue', label: 'Continue', icon: '📝', requiresSelection: false },
            { id: 'summarize', label: 'Summarize', icon: '📋', requiresSelection: false },
            { id: 'explain', label: 'Explain', icon: '💡', requiresSelection: false },
            { id: 'translate-zh', label: 'To Chinese', icon: '🇨🇳', requiresSelection: false },
            { id: 'translate-en', label: 'To English', icon: '🇬🇧', requiresSelection: false },
            { id: 'translate-ja', label: 'To Japanese', icon: '🇯🇵', requiresSelection: false }
        ];
    },

    /**
     * Execute a quick action by ID
     * @param {string} actionId
     * @param {function} onToken
     * @param {function} onDone
     * @param {function} onError
     */
    async executeAction(actionId, onToken, onDone, onError) {
        switch (actionId) {
            case 'polish':
                return this.polish(onToken, onDone, onError);
            case 'continue':
                return this.continueWriting(onToken, onDone, onError);
            case 'summarize':
                return this.summarize(onToken, onDone, onError);
            case 'explain':
                return this.explain(onToken, onDone, onError);
            case 'translate-zh':
                return this.translate('Chinese (Simplified)', onToken, onDone, onError);
            case 'translate-en':
                return this.translate('English', onToken, onDone, onError);
            case 'translate-ja':
                return this.translate('Japanese', onToken, onDone, onError);
            default:
                onError(`Unknown action: ${actionId}`);
        }
    }
};

// Export
window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.Writing = WritingModule;
