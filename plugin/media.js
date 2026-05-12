/**
 * Typora-GPT Media Module
 * Handles file uploads, image processing, multi-modal message construction, and OCR.
 */

const MediaModule = {
    // Supported image types for multi-modal
    IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    // Max image size for API (10MB)
    MAX_IMAGE_SIZE: 10 * 1024 * 1024,

    /**
     * Process an uploaded file
     * @param {File} file
     * @returns {Promise<{type: string, data: string, name: string, mimeType: string}>}
     */
    async processFile(file) {
        const isImage = this.IMAGE_TYPES.includes(file.type);

        if (isImage) {
            return await this._processImage(file);
        }

        // For text-based files, read as text
        if (file.type.startsWith('text/') ||
            file.name.endsWith('.md') ||
            file.name.endsWith('.txt') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.csv') ||
            file.name.endsWith('.xml') ||
            file.name.endsWith('.yaml') ||
            file.name.endsWith('.yml') ||
            file.name.endsWith('.js') ||
            file.name.endsWith('.ts') ||
            file.name.endsWith('.py') ||
            file.name.endsWith('.css') ||
            file.name.endsWith('.html')) {
            return await this._processTextFile(file);
        }

        // PDF - try to extract text
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            return await this._processPDF(file);
        }

        // Other files - read as text fallback
        return await this._processTextFile(file);
    },

    /**
     * Process an image file: resize if needed, convert to base64
     */
    async _processImage(file) {
        let dataUrl = await this._readAsDataURL(file);

        // Resize if too large (max 2048px on longest side for API compatibility)
        dataUrl = await this._resizeImage(dataUrl, 2048);

        // Check size
        const sizeInBytes = Math.ceil(dataUrl.length * 3 / 4);
        if (sizeInBytes > this.MAX_IMAGE_SIZE) {
            // Compress more
            dataUrl = await this._resizeImage(dataUrl, 1024);
        }

        return {
            type: 'image',
            data: dataUrl, // data:image/xxx;base64,...
            name: file.name,
            mimeType: file.type
        };
    },

    /**
     * Process a text file
     */
    async _processTextFile(file) {
        const text = await this._readAsText(file);
        return {
            type: 'text',
            data: text,
            name: file.name,
            mimeType: file.type
        };
    },

    /**
     * Process a PDF file (basic text extraction)
     */
    async _processPDF(file) {
        try {
            // Try using pdfjs if available, otherwise just provide metadata
            const dataUrl = await this._readAsDataURL(file);
            return {
                type: 'pdf',
                data: dataUrl,
                name: file.name,
                mimeType: 'application/pdf',
                text: '[PDF file: ' + file.name + ' (' + this._formatSize(file.size) + ')]\nTo analyze this PDF, please copy and paste its text content.'
            };
        } catch (e) {
            return {
                type: 'text',
                data: '[Failed to read PDF: ' + file.name + ']',
                name: file.name,
                mimeType: 'application/pdf'
            };
        }
    },

    /**
     * Perform OCR on an image using a vision model
     * Sends the image to the API asking to extract text
     */
    async performOCR(imageDataUrl, apiKey, endpoint, model) {
        const config = window.TyporaGPT.LLM.getProviderConfig();
        const isAnthropic = config.id === 'anthropic';

        const messages = [];

        if (isAnthropic) {
            // Anthropic vision format
            messages.push({
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: imageDataUrl.match(/data:([^;]+);/)?.[1] || 'image/png',
                            data: imageDataUrl.split(',')[1]
                        }
                    },
                    {
                        type: 'text',
                        text: 'Extract ALL text from this image. Output only the extracted text, preserving the original formatting and structure as much as possible. If there is no text, describe the image briefly.'
                    }
                ]
            });

            return await window.TyporaGPT.LLM.chat([
                { role: 'system', content: 'You are an OCR assistant. Extract text from images accurately.' },
                ...messages
            ]);
        }

        // OpenAI-compatible vision format
        messages.push({
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: { url: imageDataUrl }
                },
                {
                    type: 'text',
                    text: 'Extract ALL text from this image. Output only the extracted text, preserving the original formatting and structure as much as possible. If there is no text, describe the image briefly.'
                }
            ]
        });

        return await window.TyporaGPT.LLM.chat([
            { role: 'system', content: 'You are an OCR assistant. Extract text from images accurately.' },
            ...messages
        ]);
    },

    /**
     * Check if the current model supports vision/multi-modal
     */
    isVisionModel(model) {
        if (!model) return false;
        const m = model.toLowerCase();
        // OpenAI vision models
        if (m.includes('gpt-4o') || m.includes('gpt-4-turbo') || m.includes('gpt-4-vision')) return true;
        // Anthropic vision models
        if (m.includes('claude') && !m.includes('haiku')) return true;
        if (m.includes('claude-3')) return true;
        // Other vision models
        if (m.includes('gemini') || m.includes('qwen-vl') || m.includes('internvl')) return true;
        if (m.includes('vision') || m.includes('-vl')) return true;
        return false;
    },

    /**
     * Build a multi-modal message content array
     * @param {string} text - The text content
     * @param {Array} attachments - Array of processed file objects
     * @param {boolean} isAnthropic - Whether to use Anthropic format
     * @returns {string|Array} - Either a plain string or content array
     */
    buildMultiModalContent(text, attachments, isAnthropic) {
        if (!attachments || attachments.length === 0) return text;

        const images = attachments.filter(a => a.type === 'image');
        const textFiles = attachments.filter(a => a.type === 'text' || a.type === 'pdf');

        // If only text files, just append to text
        if (images.length === 0) {
            let combinedText = text;
            textFiles.forEach(f => {
                if (f.type === 'pdf' && f.text) {
                    combinedText += '\n\n---\n**File: ' + f.name + '**\n' + f.text;
                } else {
                    combinedText += '\n\n---\n**File: ' + f.name + '**\n```\n' + (f.data || '').substring(0, 10000) + '\n```';
                }
            });
            return combinedText;
        }

        // Has images - build multi-modal content
        const content = [];

        // Add images
        images.forEach(img => {
            if (isAnthropic) {
                content.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: img.mimeType || 'image/png',
                        data: img.data.split(',')[1] // Remove data:xxx;base64, prefix
                    }
                });
            } else {
                content.push({
                    type: 'image_url',
                    image_url: { url: img.data }
                });
            }
        });

        // Build text part with file contents
        let textPart = text;
        textFiles.forEach(f => {
            if (f.type === 'pdf' && f.text) {
                textPart += '\n\n---\n**File: ' + f.name + '**\n' + f.text;
            } else {
                textPart += '\n\n---\n**File: ' + f.name + '**\n```\n' + (f.data || '').substring(0, 10000) + '\n```';
            }
        });

        content.push({ type: 'text', text: textPart });

        return content;
    },

    /**
     * Resize an image to fit within maxSize while maintaining aspect ratio
     * @returns {Promise<string>} data URL of resized image
     */
    _resizeImage(dataUrl, maxSize) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;

                if (width <= maxSize && height <= maxSize) {
                    resolve(dataUrl);
                    return;
                }

                const ratio = Math.min(maxSize / width, maxSize / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Use JPEG for photos, PNG for graphics
                const isJpeg = dataUrl.includes('image/jpeg');
                resolve(canvas.toDataURL(isJpeg ? 'image/jpeg' : 'image/png', 0.85));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    },

    _readAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    _readAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    _formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    /**
     * Handle paste event - extract images from clipboard
     * @param {ClipboardEvent} event
     * @returns {Promise<Array|null>} Array of processed files or null
     */
    async handlePaste(event) {
        const items = event.clipboardData?.items;
        if (!items) return null;

        const files = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    const processed = await this.processFile(file);
                    files.push(processed);
                }
            }
        }

        return files.length > 0 ? files : null;
    },

    /**
     * Handle drag & drop
     * @param {DragEvent} event
     * @returns {Promise<Array|null>}
     */
    async handleDrop(event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return null;

        const results = [];
        for (const file of files) {
            results.push(await this.processFile(file));
        }
        return results;
    }
};

window.TyporaGPT = window.TyporaGPT || {};
window.TyporaGPT.Media = MediaModule;
