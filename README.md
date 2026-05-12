# Typora-GPT

> Typora Markdown Editor AI Assistant Plugin — inspired by Zotero GPT, Claude Code, and Linear design language.

## What It Does

A sidebar AI assistant that lives inside Typora. It connects to any large language model, understands your document context, and helps you write, analyze, translate, and manage knowledge — all without leaving the editor.

---

## Features

### Chat Interface

- Streaming response sidebar (Ctrl+Shift+G to toggle)
- Three context modes: **Document** (current file), **Folder** (all .md files in sidebar), **None** (pure chat)
- Copy / insert responses directly into the document
- Draggable sidebar resize (drag left edge, 280px–720px)

### Multi-Model Support

Works with any OpenAI-compatible API:

| Provider | Endpoint Example | Models |
|----------|-----------------|--------|
| OpenAI | `https://api.openai.com/v1/chat/completions` | gpt-4o, gpt-4o-mini |
| Anthropic | `https://api.anthropic.com/v1/messages` | claude-sonnet-4, claude-3-5-haiku |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | deepseek-chat, deepseek-r1 |
| Ollama | `http://localhost:11434/v1/chat/completions` | llama3, qwen2, etc. |
| Xiaomi TokenPlan | `https://token-plan-cn.xiaomimimo.com/v1` | (auto-discovered) |
| Any custom | User-configurable | User-configurable |

Endpoint auto-completion: entering `https://api.example.com/v1` automatically becomes `https://api.example.com/v1/chat/completions`.

### Thinking Mode

For reasoning models (DeepSeek R1, Claude with thinking, QwQ):

- Toggle in Settings with effort levels: Low (2K), Medium (8K), High (32K tokens)
- Thinking process shown in a collapsible block above the response
- Auto-detects `reasoning_content` (DeepSeek) and `thinking_delta` (Anthropic) formats

### Selected Text Reference (Copilot-style)

Select any text in the Typora editor:

1. A purple reference bar appears in the sidebar showing the selected text
2. The sidebar auto-opens
3. Type a question and press Enter — the selected text is sent as context
4. Or just press Enter directly to get an explanation/analysis

### File Upload and Multi-modal

- **Click** the attach button, **paste** (Ctrl+V), or **drag and drop** files
- Supports images (PNG, JPEG, GIF, WebP), text files (.md, .txt, .json, .csv, .js, .py, etc.), PDF
- Image preview with remove button before sending
- **Vision models** (GPT-4o, Claude-3+): images sent as base64 in the API request
- **Non-vision models**: automatic OCR via vision model API

### Conversation Management

- Create new conversations (+ button)
- Browse history (chat icon)
- Switch between conversations
- Delete conversations
- Auto-titled from first user message
- All persisted to localStorage

### Skills System

12 built-in skills accessible from the lightning bolt icon:

| Skill | What It Does |
|-------|-------------|
| Summarize as Bullets | Document summary as bullet points |
| Create Table of Contents | Generate TOC from headings |
| Improve Writing | Improve clarity and readability |
| Translate to Chinese | Translate content to Chinese |
| Translate to English | Translate content to English |
| Explain Code | Explain code blocks in document |
| Generate Changelog | Create changelog from content |
| Find Action Items | Extract TODOs and tasks |
| Rewrite Formal | Formal/professional tone |
| Rewrite Casual | Casual/friendly tone |
| Generate Quiz | Create quiz questions |
| Folder Overview | Overview of all files |

**Custom skills** can be created via:
- `/create-skill name | description | prompt` slash command
- Import from JSON file or folder via the Skills panel

### Slash Commands

Type `/` in the input field to see the autocomplete command palette. Arrow keys to navigate, Enter to select.

| Command | Description |
|---------|-------------|
| `/remember <fact>` | Save to persistent memory |
| `/memory` | Show all saved memories |
| `/forget all` | Clear all memories |
| `/plan` | Toggle plan mode (AI outlines plan before acting) |
| `/todo <task>` | Add a task |
| `/tasks` | Show all tasks |
| `/search <query>` | Web search via DuckDuckGo |
| `/run <cmd>` | Execute shell command |
| `/git` | Show git status, branch, recent commits |
| `/instructions` | Show project instructions (CLAUDE.md) |
| `/create-skill name \| desc \| prompt` | Create a custom skill |
| `/add-mcp name \| endpoint` | Add an MCP server |
| `/mcp` | List configured MCP servers |
| `/help` | Show all commands |

### MCP Server Integration

Configure external MCP (Model Context Protocol) servers in Settings:

- Add servers with name, endpoint URL, and optional API key
- Enable/disable individual servers
- Manage via Settings UI or `/add-mcp`, `/mcp` commands

### Project Instructions (CLAUDE.md)

The plugin reads project-level instructions from:

1. `CLAUDE.md` in the current project folder
2. `.typora-gpt.md` in the current project folder
3. Stored in localStorage as fallback

Instructions are automatically injected into the system prompt.

### Persistent Memory

Save facts that persist across sessions via `/remember`. Stored in localStorage. Use `/memory` to view, `/forget all` to clear.

### Web Search

`/search <query>` searches via DuckDuckGo directly from the chat. Returns titles, snippets, and URLs.

### Command Execution

`/run <cmd>` executes shell commands via Electron's child_process. Output displayed in the chat. Useful for git, pandoc, file operations, etc.

### Git Awareness

`/git` shows current branch, changed files, and recent commits. Git status is also automatically included in the system prompt when inside a git repository.

### Token Management

- Automatic context truncation when content exceeds model limits
- Token estimation: CJK ~1 token/char, Latin ~3.5 chars/token
- Configurable max context tokens (default 120K)
- Configurable max output tokens (default 4K)
- System messages get 40% of token budget, last user message gets 60%

---

## Installation

### Windows (Automatic)

1. Download or clone this repository
2. If Typora is not at `E:\Typora`, edit `TYPORA_DIR` in `install.bat`
3. Double-click `install.bat`
4. Restart Typora

### Windows (Manual)

1. Copy the `plugin/` folder and `loader-embedded.js` into `Typora安装目录/resources/typora-gpt/`
2. Rename `loader-embedded.js` to `loader.js`
3. Open `resources/window.html` in a text editor
4. Add this line before `</body>`:

```html
<script src="./typora-gpt/loader.js"></script>
```

5. Restart Typora

### macOS / Linux

```bash
# macOS
TYPORA_RES="/Applications/Typora.app/Contents/Resources"
# Linux
TYPORA_RES="/opt/Typora/resources"

cp -r plugin "$TYPORA_RES/typora-gpt/plugin"
cp loader-embedded.js "$TYPORA_RES/typora-gpt/loader.js"
# Edit window.html: add <script src="./typora-gpt/loader.js"></script> before </body>
```

### Uninstall

Run `uninstall.bat` (Windows) or remove the `typora-gpt` folder and the script tag from `window.html`.

---

## Configuration

Click the gear icon in the sidebar header.

| Setting | Description | Default |
|---------|-------------|---------|
| Provider | OpenAI / Anthropic / Custom | OpenAI |
| API Key | Your API key | (empty) |
| Endpoint | API endpoint URL | (auto-filled) |
| Model | Model name | (auto-filled) |
| Temperature | 0–2 | 0.7 |
| Max Output Tokens | Max response length | 4096 |
| Max Context Tokens | Max input context | 120000 |
| Thinking Mode | Enable extended thinking | Off |
| Thinking Effort | Low / Medium / High | Medium |
| System Prompt | Custom instructions | (default) |

Use the **Fetch** button next to Model to auto-discover available models from your API.

---

## Architecture

```
typora-gpt/
├── loader.js            # Module loader (injected into window.html)
├── plugin/
│   ├── main.js          # Entry point, lifecycle, toggle button
│   ├── ui.js            # Sidebar UI, events, rendering
│   ├── llm.js           # API communication, token management, thinking
│   ├── context.js       # Document/folder content extraction
│   ├── media.js         # File upload, multi-modal, OCR
│   ├── features.js      # CLAUDE.md, memory, search, plan, tasks, git
│   ├── history.js       # Conversation persistence
│   ├── skills.js        # Skills system, MCP framework
│   ├── writing.js       # Writing assistance (orchestrates all modules)
│   └── css/
│       └── style.css    # Design system
├── install.bat          # Windows installer
├── uninstall.bat        # Windows uninstaller
├── loader-embedded.js   # Portable loader (for distribution)
└── README.md
```

### Module Dependencies

```
main.js
  └── ui.js
        ├── llm.js
        ├── writing.js
        │     ├── context.js
        │     ├── llm.js
        │     ├── media.js
        │     └── features.js
        ├── history.js
        ├── skills.js
        └── media.js
```

All modules communicate via `window.TyporaGPT` namespace. No direct imports.

### Design System

- **Colors**: Dark theme (#0f0f14), purple accent (#6e56cf), auto light theme
- **Typography**: System font stack + Cascadia Code for monospace
- **Icons**: SVG (Feather Icons style), zero emoji
- **Spacing**: CSS custom properties, 6px/10px border radius
- **Animation**: cubic-bezier(.16,1,.3,1), 180ms transitions

---

## Development

### Add a New Skill

Edit `plugin/skills.js`, add to `builtinSkills`:

```javascript
{ id:'my-skill', name:'My Skill', icon:'M', description:'What it does', prompt:'The prompt', contextMode:'document' }
```

### Add a New Slash Command

Edit `plugin/features.js`, add handler in `handleSpecialCommand()`:

```javascript
if (lower.startsWith('/mycommand ')) {
    const arg = input.substring(11).trim();
    return { handled: true, response: 'Result' };
}
```

Then add to the `_commands` array in `ui.js` for autocomplete.

### Add a New Module

1. Create `plugin/mymodule.js`
2. Export: `window.TyporaGPT.MyModule = MyModule;`
3. Add to `MODULES` array in both `loader.js` and `loader-embedded.js`
4. Reference from other modules: `window.TyporaGPT.MyModule`

---

## Troubleshooting

**Plugin not loading after restart**
- Press F12 in Typora, check Console for `[Typora-GPT]` messages
- Verify `window.html` has the script tag before `</body>`
- Ensure all files exist in `resources/typora-gpt/plugin/`

**API Error 404**
- Endpoint URL is wrong. Use "Fetch" button or check provider docs.
- The plugin auto-completes `/v1` to `/v1/chat/completions`.

**API Error 400 "Param Incorrect"**
- Model name is wrong. Use "Fetch Models" to discover available models.

**API Error 401**
- API key is invalid or expired. Check in Settings.

**Context too large**
- Reduce "Max Context Tokens" in Settings
- Switch to "Context: None" mode
- The plugin auto-truncates, but very large documents may still exceed limits

**Sidebar doesn't close properly**
- Make sure you're using the latest version of ui.js

---

## License

MIT

## Credits

- [Typora](https://typora.io/) — the Markdown editor
- [zotero-gpt](https://github.com/MuiseDestiny/zotero-gpt) — plugin concept inspiration
- [Linear](https://linear.app) — design language reference
