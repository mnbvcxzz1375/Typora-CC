# Typora-CC

<p align="center">
  <img src="docs/images/typora-cc-icon.png" alt="Typora-CC icon" width="160" />
</p>

<p align="center">
  <strong>A Codex-style AI assistant for Typora.</strong>
</p>

<p align="center">
  Document context · Markdown editing tools · Skills · MCP · Multi-model support
</p>

<p align="center">
  <a href="README_zh.md">中文</a>
</p>

## What Is Typora-CC?

Typora-CC is an AI assistant plugin for Typora. It adds a chat sidebar to the editor and can work with the current Markdown document, selected text, and files in the current project folder.

It is designed for people who use Typora for writing, reading, summarizing, translating, polishing, and organizing Markdown notes or papers. Compared with a standalone chatbot, Typora-CC stays close to the editor and can act on the document itself.

Typora-CC can:

- Explain the current document.
- Polish or translate selected text.
- Generate Markdown tables and LaTeX formulas.
- Insert AI output back into Typora.
- Operate on Markdown through structured local tool calls.
- Import reusable Skills.
- Connect to MCP services.
- Use OpenAI-compatible model providers.

## Highlights

- **Built for Typora**: floating button, sidebar, quick actions, selected text reference, direct insertion.
- **Context modes**: `Document`, `Folder`, and `None`.
- **Markdown rendering**: headings, lists, tables, code blocks, inline math, and block math.
- **Local Markdown tools**: `typora_tool` can replace selected text, insert at cursor, patch Markdown files, and read/write `.md` files.
- **Permission control**: `Default`, `Audit`, and `Full Access`, shown under the input box and in Settings.
- **Skills**: built-in skills plus JSON, ZIP, folder, and Codex/Claude-style `SKILL.md` imports.
- **MCP integration**: add MCP servers, list available tools, and run MCP calls.
- **Multi-model support**: OpenAI, Anthropic, DeepSeek, Ollama, and custom OpenAI-compatible endpoints.
- **Context management**: detects or estimates model context windows, estimates token use, and compresses old conversation context instead of bluntly truncating it.

## Screenshot

<p align="center">
  <img src="docs/images/sidebar.png" alt="Typora-CC sidebar" width="100%" />
</p>

## Installation

### Windows: Double-click Install

Recommended for Windows.

1. Download or clone this repository.
2. Open the project folder.
3. Double-click `install.bat`.
4. Restart Typora.
5. Press `Ctrl+Shift+G`, or click the Typora-CC floating button.

If Typora is not installed at `E:\Typora`, edit `install.ps1` first:

```powershell
$typoraDir = 'E:\Typora'
```

Change it to your Typora installation path, for example:

```powershell
$typoraDir = 'C:\Program Files\Typora'
```

You can also run the installer manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

### Windows: Manual Install

Copy the files into Typora's resources directory:

```text
<Typora install directory>\resources\typora-gpt\
├── loader.js
└── plugin\
```

Then edit:

```text
<Typora install directory>\resources\window.html
```

Add this before `</body>`:

```html
<!-- Typora-CC Plugin -->
<script src="./typora-gpt/loader.js"></script>
```

Restart Typora.

### macOS: Double-click / Graphical Install

Recommended for macOS.

1. Download or clone this repository.
2. Right-click `install.command` and choose **Open**. macOS may ask for confirmation the first time.
3. Restart Typora.
4. Press `Ctrl+Shift+G`, or click the Typora-CC floating button.

If macOS says the file is not executable, run once:

```bash
chmod +x install.command
```

Then double-click it again.

If Typora is installed somewhere else:

```bash
TYPORA_RES=/path/to/Typora.app/Contents/Resources ./install.command
```

### macOS: Manual Install

Typora's resources path is usually:

```text
/Applications/Typora.app/Contents/Resources/
```

Create the plugin directory:

```text
/Applications/Typora.app/Contents/Resources/typora-gpt/
```

Copy files:

```bash
cp loader-embedded.js /Applications/Typora.app/Contents/Resources/typora-gpt/loader.js
cp -R plugin /Applications/Typora.app/Contents/Resources/typora-gpt/plugin
```

Edit:

```text
/Applications/Typora.app/Contents/Resources/window.html
```

Add this before `</body>`:

```html
<!-- Typora-CC Plugin -->
<script src="./typora-gpt/loader.js"></script>
```

Restart Typora.

Editing files under `/Applications` may require administrator permission. Typora updates may overwrite the injected loader, so reinstall the plugin after updating Typora if the sidebar disappears.

### Linux: Double-click / Graphical Install

Most Linux desktop environments can run executable `.sh` files from the file manager.

1. Download or clone this repository.
2. Add executable permission:

```bash
chmod +x install-linux.sh
```

3. Double-click it from the file manager, or run:

```bash
./install-linux.sh
```

4. Restart Typora.
5. Press `Ctrl+Shift+G`, or click the Typora-CC floating button.

If your Typora resources directory is different:

```bash
TYPORA_RES=/opt/Typora/resources ./install-linux.sh
```

### Linux: Manual Install

Common Typora resources paths:

```text
/usr/share/typora/resources/
/opt/Typora/resources/
```

Example:

```bash
cd Typora-CC
sudo mkdir -p /usr/share/typora/resources/typora-gpt
sudo cp loader-embedded.js /usr/share/typora/resources/typora-gpt/loader.js
sudo cp -R plugin /usr/share/typora/resources/typora-gpt/plugin
```

Then edit:

```text
/usr/share/typora/resources/window.html
```

Add this before `</body>`:

```html
<!-- Typora-CC Plugin -->
<script src="./typora-gpt/loader.js"></script>
```

Restart Typora.

## Configuration

Open Settings from the Typora-CC sidebar.

### Model Providers

| Provider  | Endpoint example                                 | Notes                      |
| --------- | ------------------------------------------------ | -------------------------- |
| OpenAI    | `https://api.openai.com/v1/chat/completions`   | Official OpenAI API        |
| Anthropic | `https://api.anthropic.com/v1/messages`        | Claude models              |
| DeepSeek  | `https://api.deepseek.com/v1/chat/completions` | OpenAI-compatible          |
| Ollama    | `http://localhost:11434/v1/chat/completions`   | Local models               |
| Custom    | Any OpenAI-compatible endpoint                   | Proxies or other providers |

For OpenAI-compatible providers, you can enter a base URL:

```text
https://api.example.com/v1
```

Typora-CC will normalize it to:

```text
https://api.example.com/v1/chat/completions
```

### Model Context

Typora-CC tries to detect or infer:

- Maximum model context length.
- Current conversation token usage.
- Whether old messages need compression.
- Whether document/folder context should be shortened before sending.

You can still override context settings manually when using a custom provider.

### Tool Permissions

Local document tools are controlled by the permission selector under the input box:

| Mode            | Behavior                                                     |
| --------------- | ------------------------------------------------------------ |
| `Default`     | Allows low-risk editor actions and asks before risky writes. |
| `Audit`       | Shows intended tool calls without applying write operations. |
| `Full Access` | Allows document and Markdown file writes after model output. |

## Feature Details

### 1. Chat Sidebar

- Toggle with `Ctrl+Shift+G`.
- Stream model responses.
- Create, switch, and delete conversations.
- Copy or insert AI output.
- Resize the sidebar.
- Render Markdown, code blocks, tables, and math.

### 2. Context Modes

| Mode         | Use case                                             |
| ------------ | ---------------------------------------------------- |
| `Document` | Send current Markdown content as context.            |
| `Folder`   | Use Markdown files in the current folder as context. |
| `None`     | Chat without document context.                       |

### 3. Quick Actions

The quick action buttons are for common writing tasks:

- Polish
- Continue
- Summarize
- Translate
- Explain
- Generate outline

### 4. Markdown and LaTeX Output

Typora-CC encourages model output that works well in Typora:

- Tables use standard Markdown table syntax.
- Block formulas are wrapped in `$$`.
- Formula subscripts use braces when needed, such as `x_{total}`.
- Code-like algorithms stay in fenced code blocks.

Example:

```markdown
$$
L_{total} = \lambda_{cls} L_{cls} + \lambda_{feat} L_{feat}
$$
```

### 5. Local Document Tools

Models can request real document operations through fenced `typora_tool` blocks:

```typora_tool
{"tool":"insertAtCursor","args":{"text":"New Markdown content"}}
```

Supported operations include:

- `getCurrentMarkdown`
- `getSelectedText`
- `replaceSelection`
- `insertAtCursor`
- `replaceCurrentDocument`
- `saveCurrentDocument`
- `readMarkdownFile`
- `writeMarkdownFile`
- `patchMarkdownFile`
- `listMarkdownFiles`

File-writing tools create backups before modifying Markdown files.

### 6. Skills

Skills are reusable prompts or workflows. Typora-CC supports:

- Built-in skills.
- JSON skill files.
- ZIP packages.
- Folder imports.
- Codex/Claude-style skill folders with `SKILL.md`.

Imported skills appear in the Skills panel and can be used from the slash menu or quick actions.

### 7. MCP

Typora-CC can connect to MCP services so the assistant can use external tools.

You can:

- Add MCP servers in Settings.
- List available tools.
- Run tool calls.
- Use `/mcp-tools` and `/mcp-call`.

The model can also output `mcp_call` blocks, and Typora-CC will execute them and append the result to the conversation.

### 8. Slash Commands

Type `/` in the input box to open the command palette.

| Command                | Description                  |
| ---------------------- | ---------------------------- |
| `/remember <fact>`   | Save a memory.               |
| `/memory`            | Show saved memories.         |
| `/forget all`        | Clear memories.              |
| `/plan`              | Toggle plan mode.            |
| `/todo <task>`       | Add a task.                  |
| `/tasks`             | Show tasks.                  |
| `/search <query>`    | Run web search.              |
| `/tools`             | Show local document tools.   |
| `/permission <mode>` | Change tool permission mode. |
| `/mcp-tools`         | List MCP tools.              |
| `/mcp-call`          | Call an MCP tool.            |
| `/help`              | Show commands.               |

## Project Structure

```text
Typora-CC/
├── plugin/
│   ├── context.js        # Document and folder context
│   ├── features.js       # Slash commands and feature actions
│   ├── history.js        # Conversation history
│   ├── llm.js            # Model provider clients
│   ├── main.js           # Plugin entry
│   ├── media.js          # File and image handling
│   ├── skills.js         # Skills system
│   ├── tools.js          # Local Markdown tools
│   ├── ui.js             # Sidebar UI
│   ├── writing.js        # Prompt and writing helpers
│   └── css/style.css     # UI styles
├── docs/images/          # README images and icon
├── tests/                # Local smoke test page
├── install.bat           # Windows double-click installer
├── install.ps1           # Windows installer logic
├── install.command       # macOS installer
├── install-linux.sh      # Linux installer
├── loader.js             # Development loader
└── loader-embedded.js    # Installed loader
```

## Development

Typora-CC is plain JavaScript and does not require a build step.

For local browser smoke testing:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/tests/test.html
```

For real Typora testing, reinstall the plugin and restart Typora.

## Troubleshooting

### The Sidebar Does Not Appear

- Restart Typora.
- Check whether `window.html` contains `typora-gpt/loader.js`.
- Re-run the installer after Typora updates.
- Open Typora DevTools and check the console for plugin errors.

### API Calls Fail

- Check API key and endpoint.
- For OpenAI-compatible providers, use a `/v1` base URL or a full `/chat/completions` URL.
- Make sure the selected model exists on the provider.
- For local Ollama, confirm Ollama is running.

### Tool Calls Do Not Execute

- Check the permission selector under the input box.
- Use `Audit` mode to inspect the requested operation.
- Use `Full Access` only when you want the assistant to modify files directly.
- Confirm the model output contains a valid fenced `typora_tool` block.

## Roadmap

- More built-in writing and research skills.
- Better MCP discovery and tool result display.
- More provider-specific context window metadata.
- Import/export for settings, skills, and conversations.

## Contributing

Issues and pull requests are welcome. Please keep changes focused and include a short description of the behavior being changed.

## Acknowledgements

Typora-CC is inspired by and learns from these projects:

- [mnbvcxzz1375 (Yecheng He)](https://github.com/mnbvcxzz1375) — 作者 & 维护者
- [Typora](https://typora.io/) — Markdown 编辑器
- [obsidian42-brat](https://github.com/TfTHacker/obsidian42-brat)
- [zotero-gpt](https://github.com/MuiseDestiny/zotero-gpt)
- [zotero-style](https://github.com/MuiseDestiny/zotero-style)

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
