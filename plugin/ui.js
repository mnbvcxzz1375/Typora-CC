/**
 * Typora-GPT UI Module v2 — Linear/Claude design. No emoji.
 *
 * Features:
 * - SVG icon system (no emoji)
 * - Command palette with autocomplete (/ commands)
 * - MCP server management in settings
 * - File upload with preview (paste, drag, click)
 * - Conversation history management
 * - Skills panel with import (JSON + folder)
 * - Thinking mode display (collapsible)
 * - Sidebar resize (drag left edge)
 */
const UIModule = {
    sidebar:null,messagesContainer:null,inputField:null,isStreaming:false,currentAbortController:null,contextMode:'document',pendingAttachments:[],_themeState:'auto',_stickToBottom:true,
    get llm(){return window.TyporaGPT.LLM},get writing(){return window.TyporaGPT.Writing},get context(){return window.TyporaGPT.Context},
    _icons:{
        app:'<svg class="gpt-app-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="#111417" stroke="#2d3338"/><path d="M7 7h5l2 2h3v8H7z" fill="#252a2f" stroke="#59616a"/><path d="M8.5 11h5.5M8.5 14h4" stroke="#8b949e"/><path d="M16.4 6.8l.55 1.55 1.55.55-1.55.55-.55 1.55-.55-1.55-1.55-.55 1.55-.55z" fill="#58f08b" stroke="#8cffb2"/><path d="M15.5 15.5l1.2-1.2M17 17l1.45-1.45M16.8 14.1a.7.7 0 100 1.4.7.7 0 000-1.4zM18.7 12.2a.7.7 0 100 1.4.7.7 0 000-1.4zM18.7 16a.7.7 0 100 1.4.7.7 0 000-1.4z" stroke="#58f08b"/></svg>',
        send:'<svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6"/></svg>',
        stop:'<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/></svg>',
        close:'<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        settings:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>',
        plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
        history:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 118 8"/><path d="M4 12h4M4 12l3-3M12 8v5l3 2"/></svg>',
        skills:'<svg viewBox="0 0 24 24"><path d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3z"/><path d="M19 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/></svg>',
        context:'<svg viewBox="0 0 24 24"><path d="M6 4h9l3 3v13H6z"/><path d="M14 4v4h4M9 12h6M9 16h4"/></svg>',
        folder:'<svg viewBox="0 0 24 24"><path d="M3 7h7l2 3h9v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 7V5a2 2 0 012-2h4l2 4"/></svg>',
        chat:'<svg viewBox="0 0 24 24"><path d="M5 6h14v10H8l-3 3z"/><path d="M8 10h8M8 13h5"/></svg>',
        attach:'<svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
        theme:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 100 18 7 7 0 010-18z"/></svg>',
    },
    _svg(n){return this._icons[n]||''},
    build(){
        if(document.getElementById('typora-gpt-sidebar'))return;
        this.sidebar=document.createElement('div');this.sidebar.id='typora-gpt-sidebar';
        this.sidebar.innerHTML=this._getSidebarHTML();document.body.appendChild(this.sidebar);this._applyTheme(this._getTheme());
        this.messagesContainer=document.getElementById('gpt-messages');this.inputField=document.getElementById('gpt-input');
        this._bindEvents();this._bindResize();this._addWelcomeMessage();this._updateStatusLine();
    },
    _getSidebarHTML(){
        return '<div id="gpt-resize-handle" class="gpt-resize-handle"></div>'
        +'<div class="gpt-sidebar-header"><div class="gpt-header-left"><div class="gpt-logo">'+this._svg('app')+'</div><span class="gpt-title">Typora-CC</span></div>'
        +'<div class="gpt-header-right">'
        +'<button id="gpt-new-conv-btn" class="gpt-icon-btn" title="New conversation">'+this._svg('plus')+'</button>'
        +'<button id="gpt-history-btn" class="gpt-icon-btn" title="History">'+this._svg('history')+'</button>'
        +'<button id="gpt-skills-btn" class="gpt-icon-btn" title="Skills">'+this._svg('skills')+'</button>'
        +'<button id="gpt-context-toggle" class="gpt-icon-btn" title="Context: Document">'+this._svg('context')+'</button>'
        +'<button id="gpt-theme-btn" class="gpt-icon-btn" title="Theme: auto">'+this._svg('theme')+'</button>'
        +'<button id="gpt-settings-btn" class="gpt-icon-btn" title="Settings">'+this._svg('settings')+'</button>'
        +'<button id="gpt-close-btn" class="gpt-icon-btn" title="Close">'+this._svg('close')+'</button></div></div>'
        +'<div id="gpt-history-panel" class="gpt-panel gpt-hidden"><div class="gpt-panel-header"><span>Conversations</span><button id="gpt-history-close" class="gpt-icon-btn">'+this._svg('close')+'</button></div><div id="gpt-history-list" class="gpt-history-list"></div></div>'
        +'<div id="gpt-skills-panel" class="gpt-panel gpt-hidden"><div class="gpt-panel-header"><span>Skills</span><div style="display:flex;gap:2px;"><button id="gpt-import-skill-btn" class="gpt-icon-btn" title="Import">'+this._svg('attach')+'</button><button id="gpt-skills-close" class="gpt-icon-btn">'+this._svg('close')+'</button></div></div><div id="gpt-skills-list" class="gpt-skills-list"></div></div>'
        +'<div id="gpt-quick-actions" class="gpt-quick-actions"><button class="gpt-quick-btn" data-action="polish">Polish</button><button class="gpt-quick-btn" data-action="continue">Continue</button><button class="gpt-quick-btn" data-action="summarize">Summarize</button><button class="gpt-quick-btn" data-action="explain">Explain</button><button class="gpt-quick-btn" data-action="translate-zh">ZH</button><button class="gpt-quick-btn" data-action="translate-en">EN</button><button class="gpt-quick-btn" data-action="translate-ja">JA</button></div>'
        +'<div id="gpt-messages" class="gpt-messages"></div>'
        +'<div id="gpt-selection-ref" class="gpt-selection-ref gpt-hidden"><div class="gpt-selection-ref-content"></div><button class="gpt-selection-ref-close">&times;</button></div>'
        +'<div id="gpt-attachment-preview" class="gpt-attachment-preview gpt-hidden"></div>'
        +'<div class="gpt-input-area"><div class="gpt-input-row">'
        +'<button id="gpt-upload-btn" class="gpt-icon-btn" title="Attach file">'+this._svg('attach')+'</button>'
        +'<textarea id="gpt-input" class="gpt-input" placeholder="Ask anything..." rows="1"></textarea>'
        +'<button id="gpt-send-btn" class="gpt-send-btn" title="Send">'+this._svg('send')+'</button>'
        +'<button id="gpt-stop-btn" class="gpt-stop-btn gpt-hidden" title="Stop">'+this._svg('stop')+'</button></div>'
        +'<div class="gpt-input-hint"><span id="gpt-context-label">Context: Document</span><span class="gpt-input-hint-sep"></span><span id="gpt-status-line">Context window: auto</span><span class="gpt-input-hint-sep"></span><select id="gpt-permission-inline" class="gpt-permission-inline" title="Tool permission mode"><option value="default">Default</option><option value="audit">Audit</option><option value="full">Full Access</option></select></div></div>'
        +'<div id="gpt-settings-modal" class="gpt-modal gpt-hidden"><div class="gpt-modal-content"><div class="gpt-modal-header"><h3>Settings</h3><button id="gpt-settings-close" class="gpt-icon-btn">'+this._svg('close')+'</button></div><div class="gpt-modal-body">'
        +'<div class="gpt-setting-group"><label>Provider</label><select id="gpt-setting-provider"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="custom">Custom (OpenAI-compatible)</option></select></div>'
        +'<div class="gpt-setting-group"><label>API Key</label><input type="password" id="gpt-setting-apikey" placeholder="sk-..." autocomplete="off" /></div>'
        +'<div class="gpt-setting-group"><label>Endpoint</label><input type="text" id="gpt-setting-endpoint" placeholder="https://api.openai.com/v1/chat/completions" /></div>'
        +'<div class="gpt-setting-group"><label>Model</label><div style="display:flex;gap:6px;"><input type="text" id="gpt-setting-model" placeholder="gpt-4o" style="flex:1" /><button id="gpt-fetch-models" class="gpt-btn gpt-btn-secondary" style="white-space:nowrap;padding:6px 10px;font-size:11px;">Fetch</button></div><select id="gpt-model-list" class="gpt-hidden" style="margin-top:6px;"></select></div>'
        +'<div class="gpt-setting-group"><label>Temperature: <span id="gpt-temp-value">0.7</span></label><input type="range" id="gpt-setting-temperature" min="0" max="2" step="0.1" value="0.7" /></div>'
        +'<div class="gpt-setting-group"><label>Max Output Tokens</label><input type="number" id="gpt-setting-maxtokens" value="4096" min="256" max="128000" /></div>'
        +'<div class="gpt-setting-group"><label>Context Window</label><input type="text" id="gpt-setting-contextwindow" value="Auto" readonly /><div class="gpt-setting-note">Detected from model metadata when available; otherwise inferred from model name.</div></div>'
        +'<input type="hidden" id="gpt-setting-maxcontexttokens" value="" />'
        +'<div class="gpt-setting-group"><label>Tool Permissions</label><select id="gpt-setting-toolpermission"><option value="default">Default - confirm write tools</option><option value="audit">Audit - confirm every tool</option><option value="full">Full Access - no confirmations</option></select><div class="gpt-setting-note">Controls typora_tool execution for document and Markdown file operations.</div></div>'
        +'<div class="gpt-setting-group" style="border:1px solid var(--gpt-border);border-radius:var(--gpt-radius);padding:10px 12px;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="gpt-setting-enablethinking" style="accent-color:var(--gpt-accent);" /><span>Thinking Mode</span></label><div id="gpt-thinking-options" class="gpt-hidden" style="margin-top:8px;"><label>Effort</label><select id="gpt-setting-thinkingeffort"><option value="low">Low (2K)</option><option value="medium" selected>Medium (8K)</option><option value="high">High (32K)</option></select></div></div>'
        +'<div class="gpt-setting-group"><label>System Prompt</label><textarea id="gpt-setting-systemprompt" rows="3" placeholder="Custom instructions..."></textarea></div>'
        +'<div class="gpt-setting-group gpt-setting-actions"><button id="gpt-test-connection" class="gpt-btn gpt-btn-secondary">Test</button><button id="gpt-save-settings" class="gpt-btn gpt-btn-primary">Save</button></div>'
        +'<div id="gpt-test-result" class="gpt-test-result gpt-hidden"></div>'
        +'<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--gpt-border);">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><label style="font-weight:600;font-size:12px;color:var(--gpt-text-secondary);">MCP Servers</label><button id="gpt-add-mcp-btn" class="gpt-btn gpt-btn-secondary" style="padding:4px 10px;font-size:11px;">+ Add</button></div>'
        +'<div id="gpt-mcp-list"></div>'
        +'<div id="gpt-mcp-form" class="gpt-hidden" style="margin-top:8px;padding:10px;background:var(--gpt-bg-tertiary);border-radius:var(--gpt-radius);border:1px solid var(--gpt-border);">'
        +'<div class="gpt-setting-group"><label>Name</label><input type="text" id="gpt-mcp-name" placeholder="My MCP Server" /></div>'
        +'<div class="gpt-setting-group"><label>Endpoint URL</label><input type="text" id="gpt-mcp-endpoint" placeholder="http://localhost:3000" /></div>'
        +'<div class="gpt-setting-group"><label>API Key (optional)</label><input type="password" id="gpt-mcp-key" placeholder="Optional" /></div>'
        +'<div style="display:flex;gap:6px;justify-content:flex-end;"><button id="gpt-mcp-cancel" class="gpt-btn gpt-btn-secondary">Cancel</button><button id="gpt-mcp-save" class="gpt-btn gpt-btn-primary">Add Server</button></div>'
        +'</div></div></div></div></div>';
    },
    _bindEvents(){
        document.getElementById('gpt-close-btn').addEventListener('click',()=>this.toggle());
        document.getElementById('gpt-new-conv-btn').addEventListener('click',()=>this.newConversation());
        document.getElementById('gpt-history-btn').addEventListener('click',()=>this.toggleHistoryPanel());
        document.getElementById('gpt-history-close').addEventListener('click',()=>this.toggleHistoryPanel());
        document.getElementById('gpt-skills-btn').addEventListener('click',()=>this.toggleSkillsPanel());
        document.getElementById('gpt-skills-close').addEventListener('click',()=>this.toggleSkillsPanel());
        document.getElementById('gpt-import-skill-btn').addEventListener('click',()=>this.importSkill());
        document.getElementById('gpt-settings-btn').addEventListener('click',()=>this.openSettings());
        document.getElementById('gpt-settings-close').addEventListener('click',()=>this.closeSettings());
        document.getElementById('gpt-context-toggle').addEventListener('click',()=>this.toggleContextMode());
        document.getElementById('gpt-theme-btn').addEventListener('click',()=>this.toggleTheme());
        document.getElementById('gpt-send-btn').addEventListener('click',()=>this.sendMessage());
        document.getElementById('gpt-stop-btn').addEventListener('click',()=>this.stopStreaming());
        this.inputField.addEventListener('input',()=>{this.inputField.style.height='auto';const newH=Math.min(this.inputField.scrollHeight,200);this.inputField.style.height=newH+'px';this.inputField.style.overflowY=this.inputField.scrollHeight>200?'auto':'hidden';const v=this.inputField.value;if(v==='/')this._showCommandPalette();else if(v.startsWith('/')&&v.length>1)this._filterCommandPalette();else this._hideCommandPalette()});
        this.inputField.addEventListener('keydown',(e)=>{
            const pal=document.getElementById('gpt-command-palette');
            if(e.key==='Escape'){this._hideCommandPalette();return}
            if(pal&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
                e.preventDefault();const items=[...pal.children].filter(c=>c.style.display!=='none');const cur=items.findIndex(i=>i.dataset.active==='1');items.forEach(i=>{i.dataset.active='0';i.style.background=''});let next=e.key==='ArrowDown'?cur+1:cur-1;if(next>=items.length)next=0;if(next<0)next=items.length-1;if(items[next]){items[next].dataset.active='1';items[next].style.background='var(--gpt-bg-hover)';items[next].scrollIntoView({block:'nearest'})}
                return;
            }
            if(e.key==='Enter'&&!e.shiftKey){
                if(pal){const active=[...pal.children].find(c=>c.dataset.active==='1');if(active){e.preventDefault();active.click();return}}
                e.preventDefault();this.sendMessage();
            }
        });
        document.getElementById('gpt-upload-btn').addEventListener('click',()=>this.openFilePicker());
        this.inputField.addEventListener('paste',(e)=>this._handlePaste(e));
        const ma=document.getElementById('gpt-messages');
        ma.addEventListener('scroll',()=>{this._stickToBottom=this._isNearBottom()});
        ma.addEventListener('dragover',(e)=>{e.preventDefault();ma.classList.add('gpt-drag-over')});
        ma.addEventListener('dragleave',()=>ma.classList.remove('gpt-drag-over'));
        ma.addEventListener('drop',(e)=>{e.preventDefault();ma.classList.remove('gpt-drag-over');this._handleDrop(e)});
        document.querySelectorAll('.gpt-quick-btn').forEach(b=>{b.addEventListener('click',()=>this.executeQuickAction(b.getAttribute('data-action')))});
        document.getElementById('gpt-save-settings').addEventListener('click',()=>{this.saveSettings();setTimeout(()=>this.closeSettings(),600)});
        document.getElementById('gpt-test-connection').addEventListener('click',()=>this.testConnection());
        document.getElementById('gpt-fetch-models').addEventListener('click',()=>this.fetchModels());
        document.getElementById('gpt-model-list').addEventListener('change',(e)=>{if(e.target.value){document.getElementById('gpt-setting-model').value=e.target.value;const settings=this.llm.getSettings();if(settings.modelCapsById&&settings.modelCapsById[e.target.value]){settings.modelCapabilities=settings.modelCapsById[e.target.value];this.llm.saveSettings(settings)}e.target.classList.add('gpt-hidden');this._refreshContextWindowLabel()}});
        document.getElementById('gpt-setting-temperature').addEventListener('input',(e)=>{document.getElementById('gpt-temp-value').textContent=e.target.value});
        document.getElementById('gpt-setting-toolpermission').addEventListener('change',(e)=>this._setToolPermission(e.target.value));
        document.getElementById('gpt-permission-inline').addEventListener('change',(e)=>this._setToolPermission(e.target.value));
        document.getElementById('gpt-setting-enablethinking').addEventListener('change',(e)=>{document.getElementById('gpt-thinking-options').classList.toggle('gpt-hidden',!e.target.checked)});
        document.getElementById('gpt-settings-modal').addEventListener('click',(e)=>{if(e.target.id==='gpt-settings-modal')this.closeSettings()});
        document.getElementById('gpt-add-mcp-btn').addEventListener('click',()=>{document.getElementById('gpt-mcp-form').classList.toggle('gpt-hidden')});
        document.getElementById('gpt-mcp-cancel').addEventListener('click',()=>{document.getElementById('gpt-mcp-form').classList.add('gpt-hidden')});
        document.getElementById('gpt-mcp-save').addEventListener('click',()=>this._saveMCP());
        document.addEventListener('keydown',(e)=>{if(e.ctrlKey&&e.shiftKey&&e.key==='G'){e.preventDefault();this.toggle()}});
        // Selection reference: monitor text selection in the editor
        document.addEventListener('mouseup',(e)=>{setTimeout(()=>this._checkSelection(e),10)});
        document.addEventListener('selectionchange',()=>{setTimeout(()=>this._checkSelection(),10)});
        document.getElementById('gpt-selection-ref').querySelector('.gpt-selection-ref-close').addEventListener('click',()=>this._clearSelectionRef());
    },
    _bindResize(){const h=document.getElementById('gpt-resize-handle');if(!h)return;let sx=0,sw=0;const mv=(e)=>{const dx=sx-e.clientX;const w=Math.max(300,Math.min(720,sw+dx));this.sidebar.style.width=w+'px';const ce=document.querySelector('content');if(ce&&this.sidebar.classList.contains('gpt-open'))ce.style.marginRight=w+'px';document.body.style.cursor='col-resize';document.body.style.userSelect='none'};const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);document.body.style.cursor='';document.body.style.userSelect=''};h.addEventListener('mousedown',(e)=>{e.preventDefault();sx=e.clientX;sw=this.sidebar.offsetWidth;document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)})},
    toggle(){
        if(!this.sidebar)return;
        const willOpen=!this.sidebar.classList.contains('gpt-open');
        if(!willOpen){this.sidebar.style.width=''}
        this.sidebar.classList.toggle('gpt-open',willOpen);
        document.body.classList.toggle('typora-gpt-open',willOpen);
        const ce=document.querySelector('content');
        if(ce)ce.style.marginRight=willOpen?(this.sidebar.offsetWidth||380)+'px':'0px';
    },
    open(){if(this.sidebar&&!this.sidebar.classList.contains('gpt-open'))this.toggle()},
    toggleContextMode(){const m=['document','folder','none'];const l={document:'Context: Document',folder:'Context: Folder',none:'Context: None'};const ic={document:'context',folder:'folder',none:'chat'};const i=m.indexOf(this.contextMode);this.contextMode=m[(i+1)%m.length];document.getElementById('gpt-context-toggle').innerHTML=this._svg(ic[this.contextMode]);document.getElementById('gpt-context-toggle').title=l[this.contextMode];document.getElementById('gpt-context-label').textContent=l[this.contextMode]},
    _getTheme(){try{this._themeState=localStorage.getItem('typora-gpt-theme')||this._themeState||'auto'}catch(e){}return this._themeState||'auto'},
    _getEffectiveTheme(){const t=this._getTheme();if(t==='dark'||t==='light')return t;return document.body.classList.contains('dark-mode')||document.documentElement.classList.contains('dark-mode')?'dark':'light'},
    _applyTheme(theme){this._themeState=theme;[document.documentElement,document.body,this.sidebar].filter(Boolean).forEach(el=>el.setAttribute('data-typora-gpt-theme',theme));const btn=document.getElementById('gpt-theme-btn');if(btn){btn.title='Theme: '+theme;btn.dataset.theme=theme}},
    toggleTheme(){const next=this._getEffectiveTheme()==='dark'?'light':'dark';try{localStorage.setItem('typora-gpt-theme',next)}catch(e){}this._applyTheme(next)},
    _formatTokens(n){if(!n)return 'auto';return n>=1000000?(Math.round(n/100000)/10)+'M':n>=1000?Math.round(n/1000)+'K':String(n)},
    _refreshContextWindowLabel(){const model=document.getElementById('gpt-setting-model')?.value||this.llm.getProviderConfig().model;const saved=this.llm.getSettings().modelCapabilities;const caps=saved?.id===model?saved:this.llm.inferModelCapabilities(model);const el=document.getElementById('gpt-setting-contextwindow');if(el)el.value=this._formatTokens(caps.contextWindow)+' tokens ('+(caps.source||'auto')+')';this._updateStatusLine()},
    _updateStatusLine(messages){const el=document.getElementById('gpt-status-line');if(!el||!this.llm)return;const status=this.llm.getContextStatus(messages||[]);el.textContent='ctx '+status.percent+'% · '+this._formatTokens(status.total)+' · '+status.source},
    _syncToolPermissionUI(){const mode=window.TyporaGPT.Tools?window.TyporaGPT.Tools.getPermissionMode():'default';const inline=document.getElementById('gpt-permission-inline'),settings=document.getElementById('gpt-setting-toolpermission');if(inline)inline.value=mode;if(settings)settings.value=mode},
    _setToolPermission(mode){if(window.TyporaGPT.Tools)window.TyporaGPT.Tools.setPermissionMode(mode);this._syncToolPermissionUI()},
    _addWelcomeMessage(){this.addMessage('assistant','**Typora-CC**\n\n**Quick Actions**: Polish / Continue / Summarize / Explain / ZH / EN / JA\n\n**Slash Commands** (type `/` for autocomplete):\n- `/remember <fact>` — Save to memory\n- `/memory` — Show memories\n- `/plan` — Toggle plan mode\n- `/todo <task>` — Add task\n- `/tasks` — Show tasks\n- `/search <query>` — Web search\n- `/run <cmd>` — Shell command\n- `/git` — Git status\n- `/status` — Session status\n- `/tools` — List Typora tools\n- `/permission <mode>` — Tool permission mode\n- `/instructions` — Project instructions\n- `/create-skill name | desc | prompt` — Create skill\n- `/add-mcp name | endpoint` — Add MCP server\n- `/mcp` — List MCP servers\n- `/mcp-tools <server>` — List MCP tools\n- `/mcp-call server | tool | JSON` — Run MCP tool\n- `/help` — All commands\n\n**Tips**: Ctrl+Shift+G to toggle. Attach files via button or paste.')},
    addMessage(role,content){const shouldScroll=this._isNearBottom();const d=document.createElement('div');d.className='gpt-message gpt-message-'+role;const a=document.createElement('div');a.className='gpt-message-avatar';a.innerHTML=role==='assistant'?this._svg('app'):'U';const b=document.createElement('div');b.className='gpt-message-body';const c=document.createElement('div');c.className='gpt-message-content';c.innerHTML=this._renderMarkdown(content);this._typesetMath(c);b.appendChild(c);if(role==='assistant'){const x=document.createElement('div');x.className='gpt-message-actions';x.innerHTML='<button class="gpt-msg-action-btn" data-action="copy">Copy</button><button class="gpt-msg-action-btn" data-action="insert">Insert</button>';x.querySelectorAll('.gpt-msg-action-btn').forEach(btn=>{btn.addEventListener('click',()=>{const a=btn.getAttribute('data-action');if(a==='copy'){navigator.clipboard.writeText(c.textContent);btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy',1500)}else if(a==='insert'){this._insertIntoDocument(c.textContent);btn.textContent='Done';setTimeout(()=>btn.textContent='Insert',1500)}})});b.appendChild(x)}d.appendChild(a);d.appendChild(b);this.messagesContainer.appendChild(d);if(shouldScroll)this._scrollToBottom();return c},
    _renderMarkdown(t){if(!t)return '';const placeholders=[];let s=String(t).replace(/\r\n/g,'\n');const stash=(html)=>{const k='@@GPTPH'+placeholders.length+'@@';placeholders.push(html);return k};s=s.replace(/```(\w*)\n([\s\S]*?)```/g,(m,lang,code)=>stash('<pre><code class="lang-'+this._esc(lang)+'">'+this._esc(code)+'</code></pre>'));s=s.replace(/\$\$([\s\S]*?)\$\$/g,(m,math)=>stash('<div class="gpt-math gpt-math-block">$$'+this._esc(math.trim())+'$$</div>'));s=s.replace(/\\\[([\s\S]*?)\\\]/g,(m,math)=>stash('<div class="gpt-math gpt-math-block">\\['+this._esc(math.trim())+'\\]</div>'));s=s.replace(/\\\(([\s\S]*?)\\\)/g,(m,math)=>stash('<span class="gpt-math gpt-math-inline">\\('+this._esc(math.trim())+'\\)</span>'));s=s.replace(/(^|[^\\$])\$([^$\n]+?)\$/g,(m,p,math)=>p+stash('<span class="gpt-math gpt-math-inline">$'+this._esc(math.trim())+'$</span>'));let h=this._esc(s);h=this._renderTables(h);h=h.replace(/^###### (.+)$/gm,'<h6>$1</h6>').replace(/^##### (.+)$/gm,'<h5>$1</h5>').replace(/^#### (.+)$/gm,'<h4>$1</h4>').replace(/^### (.+)$/gm,'<h4>$1</h4>').replace(/^## (.+)$/gm,'<h3>$1</h3>').replace(/^# (.+)$/gm,'<h2>$1</h2>').replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');h=this._renderLists(h);h=h.split(/\n{2,}/).map(block=>{if(/^<(pre|table|ul|ol|h\d|blockquote|div)/.test(block.trim()))return block;return '<p>'+block.replace(/\n/g,'<br>')+'</p>'}).join('');placeholders.forEach((html,i)=>{h=h.replaceAll('@@GPTPH'+i+'@@',html)});return h},
    _renderTables(h){const lines=h.split('\n'),out=[];for(let i=0;i<lines.length;i++){if(i+1<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i])&&/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1])){const headers=lines[i].trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());i+=2;const rows=[];while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i])){rows.push(lines[i].trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim()));i++}i--;out.push('<table><thead><tr>'+headers.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>')}else out.push(lines[i])}return out.join('\n')},
    _renderLists(h){const lines=h.split('\n'),out=[];let buf=[],ordered=false;const flush=()=>{if(!buf.length)return;out.push((ordered?'<ol>':'<ul>')+buf.map(x=>'<li>'+x+'</li>').join('')+(ordered?'</ol>':'</ul>'));buf=[]};for(const line of lines){let m=line.match(/^\s*[-*]\s+(.+)$/);if(m){if(buf.length&&ordered)flush();ordered=false;buf.push(m[1]);continue}m=line.match(/^\s*\d+\.\s+(.+)$/);if(m){if(buf.length&&!ordered)flush();ordered=true;buf.push(m[1]);continue}flush();out.push(line)}flush();return out.join('\n')},
    _typesetMath(root){try{if(window.MathJax&&window.MathJax.typesetPromise){window.MathJax.typesetPromise([root]);return}if(window.katex){root.querySelectorAll('.gpt-math').forEach(el=>{let tex=el.textContent.trim();tex=tex.replace(/^\$\$|\$\$$/g,'').replace(/^\\\[|\\\]$/g,'').replace(/^\\\(|\\\)$/g,'').replace(/^\$|\$$/g,'');window.katex.render(tex,el,{throwOnError:false,displayMode:el.classList.contains('gpt-math-block')})})}}catch(e){}},
    _updateStreamingContent(el,thinking,markdown){el.innerHTML=this._renderStreamingMessage(thinking,markdown);this._typesetMath(el);this._scrollIfSticky()},
    _renderStreamingMessage(th,mt){let h='';if(th)h+='<details class="gpt-thinking-block" open><summary class="gpt-thinking-summary">Thinking</summary><div class="gpt-thinking-content">'+this._renderMarkdown(th)+'</div></details>';if(mt)h+=this._renderMarkdown(mt);return h||'<span class="gpt-typing">Thinking</span>'},
    _insertIntoDocument(t){try{const w=document.querySelector('#write');if(w&&w.getAttribute('contenteditable')==='true'){const s=window.getSelection();if(s&&s.rangeCount>0){const r=s.getRangeAt(0);r.collapse(false);const n=document.createTextNode('\n\n'+t);r.insertNode(n);const nr=document.createRange();nr.setStartAfter(n);nr.collapse(true);s.removeAllRanges();s.addRange(nr);return}}navigator.clipboard.writeText(t)}catch(e){navigator.clipboard.writeText(t)}},
    async sendMessage(){
        const input=this.inputField.value.trim();
        if((!input&&!this.pendingAttachments.length&&!this._selectedRef)||this.isStreaming)return;
        const feat=window.TyporaGPT.Features;
        if(feat&&input.startsWith('/')){const r=await feat.handleSpecialCommand(input);if(r.handled){this.addMessage('user',input);this.addMessage('assistant',r.response);this.inputField.value='';this.inputField.style.height='auto';return}}
        const att=[...this.pendingAttachments];this.pendingAttachments=[];this._clearAttachmentPreview();
        const selRef=this._selectedRef;this._clearSelectionRef();
        // Build display text
        let dt=input;
        if(selRef){dt=(input?'':'Explain this selection.')+(input?'':'')+(input&&selRef?'\n\n':'')+'[Selected text]:\n> '+selRef.split('\n').join('\n> ')+(input?'\n\n'+input:'')}
        if(att.length>0){dt=(dt?dt+'\n\n':'')+'[Attached: '+att.map(a=>a.name).join(', ')+']'}
        this.addMessage('user',dt);this.inputField.value='';
        // Build LLM prompt
        let prompt=input||'Explain this selection.';
        if(selRef){prompt='The user selected the following text from the document:\n\n> '+selRef+'\n\n'+(input?'User question: '+input:'Please explain, analyze, or improve the selected text.')}
        const h=window.TyporaGPT.History;h.getCurrent();h.addMessage('user',dt);this.inputField.style.height='auto';this.isStreaming=true;this._updateStreamingUI(true);
        const am=this.addMessage('assistant','');am.innerHTML='<span class="gpt-typing">Thinking</span>';
        let fr='',tr='';
        const stream=this.writing.customQuery(prompt,(tk,tp)=>{if(tp==='thinking')tr+=tk;else fr+=tk;this._updateStreamingContent(am,tr,fr)},()=>{this.isStreaming=false;this._updateStreamingUI(false);this.currentAbortController=null;if(!fr)am.innerHTML='<em>No response.</em>';this._typesetMath(am);h.updateLastAssistant(fr,tr);this._maybeExecuteMCPBlocks(fr,h);this._maybeExecuteTyporaToolBlocks(fr,h)},(e)=>{this.isStreaming=false;this._updateStreamingUI(false);this.currentAbortController=null;am.innerHTML='<span class="gpt-error">'+this._esc(e)+'</span>'},this.contextMode,att);
        this.currentAbortController=this.llm.currentAbortController||null;
        await stream;
    },
    async executeQuickAction(id){if(this.isStreaming)return;this.open();const lb={polish:'Polishing...',continue:'Continuing...',summarize:'Summarizing...',explain:'Explaining...','translate-zh':'Translating to ZH...','translate-en':'Translating to EN...','translate-ja':'Translating to JA...'};this.addMessage('user','/'+id);const a=this.addMessage('assistant','');a.innerHTML='<span class="gpt-typing">'+(lb[id]||'Processing')+'</span>';this.isStreaming=true;this._updateStreamingUI(true);let f='',t='';const stream=this.writing.executeAction(id,(tk,tp)=>{if(tp==='thinking')t+=tk;else f+=tk;this._updateStreamingContent(a,t,f)},()=>{this.isStreaming=false;this._updateStreamingUI(false);this.currentAbortController=null;if(!f)a.innerHTML='<em>No response.</em>';this._typesetMath(a)},(e)=>{this.isStreaming=false;this._updateStreamingUI(false);this.currentAbortController=null;a.innerHTML='<span class="gpt-error">'+this._esc(e)+'</span>'});this.currentAbortController=this.llm.currentAbortController||null;await stream},
    stopStreaming(){const c=this.currentAbortController||this.llm.currentAbortController;if(c)c.abort();this.isStreaming=false;this.currentAbortController=null;this._updateStreamingUI(false)},
    _updateStreamingUI(s){document.getElementById('gpt-send-btn').classList.toggle('gpt-hidden',s);document.getElementById('gpt-stop-btn').classList.toggle('gpt-hidden',!s)},
    clearMessages(){this.messagesContainer.innerHTML='';this._addWelcomeMessage()},
    _isNearBottom(){if(!this.messagesContainer)return true;return this.messagesContainer.scrollHeight-this.messagesContainer.scrollTop-this.messagesContainer.clientHeight<48},
    _scrollToBottom(){if(this.messagesContainer){this.messagesContainer.scrollTop=this.messagesContainer.scrollHeight;this._stickToBottom=true}},
    _scrollIfSticky(){if(this._stickToBottom)this._scrollToBottom()},
    openSettings(){document.getElementById('gpt-settings-modal').classList.remove('gpt-hidden');const s=this.llm.getSettings();document.getElementById('gpt-setting-provider').value=s.provider||'openai';document.getElementById('gpt-setting-apikey').value=s.apiKey||'';document.getElementById('gpt-setting-endpoint').value=s.endpoint||'';document.getElementById('gpt-setting-model').value=s.model||'';document.getElementById('gpt-setting-temperature').value=s.temperature??0.7;document.getElementById('gpt-temp-value').textContent=s.temperature??0.7;document.getElementById('gpt-setting-maxtokens').value=s.maxTokens||4096;document.getElementById('gpt-setting-maxcontexttokens').value=s.maxContextTokens||'';this._syncToolPermissionUI();document.getElementById('gpt-setting-enablethinking').checked=s.enableThinking||false;document.getElementById('gpt-thinking-options').classList.toggle('gpt-hidden',!s.enableThinking);document.getElementById('gpt-setting-thinkingeffort').value=s.thinkingEffort||'medium';document.getElementById('gpt-setting-systemprompt').value=s.systemPrompt||'';this._refreshContextWindowLabel();this._renderMCPList()},
    closeSettings(){document.getElementById('gpt-settings-modal').classList.add('gpt-hidden');document.getElementById('gpt-test-result').classList.add('gpt-hidden')},
    saveSettings(silent){const old=this.llm.getSettings();const model=document.getElementById('gpt-setting-model').value;const manualContext=parseInt(document.getElementById('gpt-setting-maxcontexttokens').value);const s={...old,provider:document.getElementById('gpt-setting-provider').value,apiKey:document.getElementById('gpt-setting-apikey').value,endpoint:document.getElementById('gpt-setting-endpoint').value,model,temperature:parseFloat(document.getElementById('gpt-setting-temperature').value),maxTokens:parseInt(document.getElementById('gpt-setting-maxtokens').value),enableThinking:document.getElementById('gpt-setting-enablethinking').checked,thinkingEffort:document.getElementById('gpt-setting-thinkingeffort').value,systemPrompt:document.getElementById('gpt-setting-systemprompt').value};if(manualContext)s.maxContextTokens=manualContext;else delete s.maxContextTokens;if(s.modelCapsById&&s.modelCapsById[model])s.modelCapabilities=s.modelCapsById[model];else if(!s.modelCapabilities||s.modelCapabilities.id!==model)s.modelCapabilities={id:model,...this.llm.inferModelCapabilities(model)};this.llm.saveSettings(s);this._refreshContextWindowLabel();if(!silent){const r=document.getElementById('gpt-test-result');r.classList.remove('gpt-hidden');r.className='gpt-test-result gpt-test-success';r.textContent='Saved';setTimeout(()=>r.classList.add('gpt-hidden'),1800)}return s},
    async testConnection(){this.saveSettings(true);const r=document.getElementById('gpt-test-result');r.classList.remove('gpt-hidden');r.className='gpt-test-result gpt-test-testing';r.textContent='Testing...';const res=await this.llm.testConnection();r.className=res.success?'gpt-test-result gpt-test-success':'gpt-test-result gpt-test-error';r.textContent=res.success?res.message:'Failed: '+res.message},
    async fetchModels(){this.saveSettings(true);const r=document.getElementById('gpt-test-result'),ml=document.getElementById('gpt-model-list'),fb=document.getElementById('gpt-fetch-models');r.classList.remove('gpt-hidden');r.className='gpt-test-result gpt-test-testing';r.textContent='Fetching...';fb.disabled=true;const res=await this.llm.fetchModels();let cap=null;try{cap=await this.llm.fetchCurrentModelCapabilities()}catch(e){}fb.disabled=false;if(res.success){const settings=this.llm.getSettings();settings.modelCapsById=res.modelCaps||{};if(cap)settings.modelCapabilities=cap;this.llm.saveSettings(settings);r.className='gpt-test-result gpt-test-success';r.textContent=res.message+(cap?' · context '+this._formatTokens(cap.contextWindow):'');ml.innerHTML='<option value="">-- Select --</option>';res.models.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;ml.appendChild(o)});ml.classList.remove('gpt-hidden');this._refreshContextWindowLabel()}else{r.className='gpt-test-result gpt-test-error';r.textContent=res.message;ml.classList.add('gpt-hidden')}},
    newConversation(){window.TyporaGPT.History.create();this.clearMessages()},
    toggleHistoryPanel(){const p=document.getElementById('gpt-history-panel');document.getElementById('gpt-skills-panel').classList.add('gpt-hidden');p.classList.toggle('gpt-hidden');if(!p.classList.contains('gpt-hidden'))this._renderHistoryList()},
    _renderHistoryList(){const h=window.TyporaGPT.History,l=document.getElementById('gpt-history-list'),c=h.getList();if(!c.length){l.innerHTML='<div class="gpt-panel-empty">No conversations yet.</div>';return}l.innerHTML='';c.forEach(cv=>{const i=document.createElement('div');i.className='gpt-history-item'+(cv.id===h.currentId?' gpt-active':'');const d=new Date(cv.updatedAt);const ts=d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});i.innerHTML='<div class="gpt-history-title">'+this._esc(cv.title)+'</div><div class="gpt-history-meta">'+cv.messageCount+' messages · '+ts+'</div><div class="gpt-history-actions"><button class="gpt-msg-action-btn" data-action="switch">Open</button><button class="gpt-msg-action-btn" data-action="delete">Delete</button></div>';i.querySelector('[data-action="switch"]').addEventListener('click',(e)=>{e.stopPropagation();this._switchConversation(cv.id)});i.querySelector('[data-action="delete"]').addEventListener('click',(e)=>{e.stopPropagation();if(confirm('Delete "'+cv.title+'"?')){h.delete(cv.id);this._renderHistoryList();if(cv.id===h.currentId){this.clearMessages();this._addWelcomeMessage()}}});i.addEventListener('click',()=>this._switchConversation(cv.id));l.appendChild(i)})},
    _switchConversation(id){const h=window.TyporaGPT.History,c=h.switchTo(id);if(!c)return;this.messagesContainer.innerHTML='';if(!c.messages.length)this._addWelcomeMessage();else c.messages.forEach(m=>{if(m.role==='user')this.addMessage('user',m.content);else if(m.role==='assistant'){const el=this.addMessage('assistant','');el.innerHTML=m.thinking?this._renderStreamingMessage(m.thinking,m.content):this._renderMarkdown(m.content)}});document.getElementById('gpt-history-panel').classList.add('gpt-hidden')},
    toggleSkillsPanel(){const p=document.getElementById('gpt-skills-panel');document.getElementById('gpt-history-panel').classList.add('gpt-hidden');p.classList.toggle('gpt-hidden');if(!p.classList.contains('gpt-hidden'))this._renderSkillsList()},
    _renderSkillsList(){const sk=window.TyporaGPT.Skills,l=document.getElementById('gpt-skills-list');l.innerHTML='';sk.getAllSkills().forEach(s=>{const i=document.createElement('div');i.className='gpt-skill-item';i.innerHTML='<div class="gpt-skill-info"><div class="gpt-skill-name">'+this._esc(s.name)+'</div><div class="gpt-skill-desc">'+this._esc(s.description||'')+'</div></div>'+(s.isCustom?'<button class="gpt-msg-action-btn" data-action="delete">Del</button>':'');i.addEventListener('click',(e)=>{if(e.target.closest('[data-action="delete"]')){sk.deleteSkill(s.id);this._renderSkillsList();return}this._executeSkill(s)});l.appendChild(i)})},
    async _executeSkill(skill){this.open();document.getElementById('gpt-skills-panel').classList.add('gpt-hidden');this.addMessage('user','['+skill.name+']');const a=this.addMessage('assistant','');a.innerHTML='<span class="gpt-typing">Running</span>';this.isStreaming=true;this._updateStreamingUI(true);let f='',t='';const stream=this.writing.customQuery(skill.prompt,(tk,tp)=>{if(tp==='thinking')t+=tk;else f+=tk;this._updateStreamingContent(a,t,f)},()=>{this.isStreaming=false;this._updateStreamingUI(false);this.currentAbortController=null;if(!f)a.innerHTML='<em>No response.</em>';this._typesetMath(a);this._maybeExecuteMCPBlocks(f);this._maybeExecuteTyporaToolBlocks(f)},(e)=>{this.isStreaming=false;this._updateStreamingUI(false);this.currentAbortController=null;a.innerHTML='<span class="gpt-error">'+this._esc(e)+'</span>'},skill.contextMode||'document');this.currentAbortController=this.llm.currentAbortController||null;await stream},
    importSkill(){
        const i=document.createElement('input');i.type='file';i.accept='.json,.zip,application/json,application/zip';i.multiple=true;i.webkitdirectory=false;
        const folderBtn=document.createElement('input');folderBtn.type='file';folderBtn.webkitdirectory=true;
        const dialog=document.createElement('div');dialog.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:10001;display:flex;align-items:center;justify-content:center;';
        dialog.innerHTML='<div style="background:var(--gpt-bg-secondary);border:1px solid var(--gpt-border);border-radius:var(--gpt-radius-lg);padding:20px;width:280px;text-align:center;">'
            +'<div style="font-weight:600;margin-bottom:14px;font-size:13px;">Import Skills</div>'
            +'<div style="display:flex;flex-direction:column;gap:8px;">'
            +'<button id="imp-file-btn" class="gpt-btn gpt-btn-secondary" style="width:100%;">Import ZIP / JSON</button>'
            +'<button id="imp-folder-btn" class="gpt-btn gpt-btn-secondary" style="width:100%;">Import Folder</button>'
            +'<button id="imp-cancel-btn" class="gpt-btn gpt-btn-secondary" style="width:100%;">Cancel</button>'
            +'</div></div>';
        document.body.appendChild(dialog);
        dialog.querySelector('#imp-cancel-btn').addEventListener('click',()=>dialog.remove());
        dialog.querySelector('#imp-file-btn').addEventListener('click',()=>{dialog.remove();i.click()});
        dialog.querySelector('#imp-folder-btn').addEventListener('click',()=>{dialog.remove();folderBtn.click()});
        i.onchange=async(e)=>{try{let n=0;const files=[];for(const f of e.target.files){if(f.name.toLowerCase().endsWith('.zip'))n+=await window.TyporaGPT.Skills.importFromZipFile(f);else files.push({name:f.name,path:f.webkitRelativePath||f.name,content:await f.text()})}n+=window.TyporaGPT.Skills.importFromFiles(files);this._notify('Imported '+n+' skill(s).',n?'success':'warn');this._renderSkillsList()}catch(err){this._notify('Failed: '+err.message,'error')}};
        folderBtn.onchange=async(e)=>{const files=[];for(const f of e.target.files){const p=f.webkitRelativePath||f.name;const low=p.toLowerCase().replace(/\\/g,'/');if(low.endsWith('.json')||low.endsWith('/skill.md')||low==='skill.md')files.push({name:f.name,path:p,content:await f.text()})}try{const n=window.TyporaGPT.Skills.importFromFiles(files);this._notify('Imported '+n+' skill(s).',n?'success':'warn');this._renderSkillsList()}catch(err){this._notify('Failed: '+err.message,'error')}};
    },
    openFilePicker(){const i=document.createElement('input');i.type='file';i.accept='image/*,.md,.txt,.json,.csv,.xml,.yaml,.yml,.js,.ts,.py,.css,.html,.pdf';i.multiple=true;i.onchange=async(e)=>{for(const f of e.target.files)await this._addAttachment(f)};i.click()},
    async _addAttachment(f){const m=window.TyporaGPT.Media;if(!m)return;try{const p=await m.processFile(f);this.pendingAttachments.push(p);this._renderAttachmentPreview()}catch(e){}},
    async _handlePaste(e){const m=window.TyporaGPT.Media;if(!m)return;const fs=await m.handlePaste(e);if(fs&&fs.length>0){e.preventDefault();fs.forEach(f=>this.pendingAttachments.push(f));this._renderAttachmentPreview()}},
    async _handleDrop(e){const m=window.TyporaGPT.Media;if(!m)return;const fs=await m.handleDrop(e);if(fs&&fs.length>0){fs.forEach(f=>this.pendingAttachments.push(f));this._renderAttachmentPreview()}},
    _renderAttachmentPreview(){const p=document.getElementById('gpt-attachment-preview');if(!p)return;if(!this.pendingAttachments.length){p.classList.add('gpt-hidden');p.innerHTML='';return}p.classList.remove('gpt-hidden');p.innerHTML='';this.pendingAttachments.forEach((a,i)=>{const d=document.createElement('div');d.className='gpt-attachment-item';if(a.type==='image')d.innerHTML='<img src="'+a.data+'" class="gpt-attachment-thumb" /><span class="gpt-attachment-name">'+this._esc(a.name)+'</span><button class="gpt-attachment-remove">&times;</button>';else d.innerHTML='<span class="gpt-attachment-icon">doc</span><span class="gpt-attachment-name">'+this._esc(a.name)+'</span><button class="gpt-attachment-remove">&times;</button>';d.querySelector('.gpt-attachment-remove').addEventListener('click',()=>{this.pendingAttachments.splice(i,1);this._renderAttachmentPreview()});p.appendChild(d)})},
    _clearAttachmentPreview(){this.pendingAttachments=[];const p=document.getElementById('gpt-attachment-preview');if(p){p.classList.add('gpt-hidden');p.innerHTML=''}},

    /* ---- Selection Reference ---- */
    _selectedRef:'',
    _checkSelection(e){
        // Don't trigger on clicks inside the sidebar
        if(e&&this.sidebar&&this.sidebar.contains(e.target))return;
        const sel=window.getSelection();
        if(!sel||sel.isCollapsed||!sel.toString().trim()){this._clearSelectionRef();return}
        const text=sel.toString().trim();
        if(text.length<3){this._clearSelectionRef();return}
        // Only show if selection is in the editor area
        const writeEl=document.querySelector('#write');
        if(writeEl&&writeEl.contains(sel.anchorNode)){
            this._selectedRef=text;
            this._showSelectionRef(text);
        } else this._clearSelectionRef();
    },
    _showSelectionRef(text){
        const ref=document.getElementById('gpt-selection-ref');
        if(!ref)return;
        const content=ref.querySelector('.gpt-selection-ref-content');
        const truncated=text.length>200?text.substring(0,200)+'...':text;
        content.textContent=truncated;
        ref.classList.remove('gpt-hidden');
        // Auto-open sidebar if closed
        if(this.sidebar&&!this.sidebar.classList.contains('gpt-open'))this.toggle();
    },
    _clearSelectionRef(){
        this._selectedRef='';
        const ref=document.getElementById('gpt-selection-ref');
        if(ref){ref.classList.add('gpt-hidden');ref.querySelector('.gpt-selection-ref-content').textContent=''}
    },
    _notify(message,type='success'){
        const old=document.getElementById('gpt-toast');
        if(old)old.remove();
        const t=document.createElement('div');
        t.id='gpt-toast';
        const color=type==='error'?'#d92d20':type==='warn'?'#b54708':'var(--gpt-accent)';
        t.style.cssText='position:fixed;right:24px;bottom:24px;z-index:10050;max-width:360px;padding:10px 12px;border-radius:8px;background:var(--gpt-bg-secondary);border:1px solid var(--gpt-border);box-shadow:var(--gpt-shadow-lg);font-size:12px;color:var(--gpt-text-primary);border-left:3px solid '+color+';';
        t.textContent=message;
        document.body.appendChild(t);
        setTimeout(()=>{if(t.parentNode)t.remove()},2600);
    },
    _esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML},

    /* ---- MCP ---- */
    _renderMCPList(){const list=document.getElementById('gpt-mcp-list');if(!list)return;const servers=window.TyporaGPT.Skills.getMCPServers();if(!servers.length){list.innerHTML='<div style="font-size:11px;color:var(--gpt-text-muted);padding:4px 0;">No MCP servers configured.</div>';return}list.innerHTML='';servers.forEach(s=>{const d=document.createElement('div');d.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid var(--gpt-border-subtle);';d.innerHTML='<span style="flex:1;font-weight:500;">'+this._esc(s.name)+'</span><span style="font-size:10px;color:var(--gpt-text-muted);">'+(s.enabled?'on':'off')+'</span><button class="gpt-msg-action-btn" data-action="toggle">'+(s.enabled?'Disable':'Enable')+'</button><button class="gpt-msg-action-btn" data-action="remove">Remove</button>';d.querySelector('[data-action="toggle"]').addEventListener('click',()=>{window.TyporaGPT.Skills.toggleMCPServer(s.id);this._renderMCPList()});d.querySelector('[data-action="remove"]').addEventListener('click',()=>{if(confirm('Remove "'+s.name+'"?')){window.TyporaGPT.Skills.removeMCPServer(s.id);this._renderMCPList()}});list.appendChild(d)})},
    _saveMCP(){const name=document.getElementById('gpt-mcp-name').value.trim(),endpoint=document.getElementById('gpt-mcp-endpoint').value.trim(),key=document.getElementById('gpt-mcp-key').value.trim();if(!name||!endpoint){alert('Name and endpoint are required.');return}window.TyporaGPT.Skills.addMCPServer({name,endpoint,apiKey:key});document.getElementById('gpt-mcp-name').value='';document.getElementById('gpt-mcp-endpoint').value='';document.getElementById('gpt-mcp-key').value='';document.getElementById('gpt-mcp-form').classList.add('gpt-hidden');this._renderMCPList()},

    async _maybeExecuteMCPBlocks(text,history){const sk=window.TyporaGPT.Skills;if(!sk||!sk.executeMCPBlocks||!String(text||'').includes('```mcp_call'))return;const results=await sk.executeMCPBlocks(text);if(!results.length)return;const body='### MCP Tool Results\n\n```json\n'+JSON.stringify(results,null,2).slice(0,12000)+'\n```';this.addMessage('assistant',body);if(history&&history.addMessage)history.addMessage('assistant',body)},

    async _maybeExecuteTyporaToolBlocks(text,history){const tools=window.TyporaGPT.Tools;if(!tools||!tools.executeToolBlocks||!String(text||'').includes('```typora_tool'))return;const results=await tools.executeToolBlocks(text);if(!results.length)return;const body='### Typora Tool Results\n\n```json\n'+JSON.stringify(results,null,2).slice(0,12000)+'\n```';this.addMessage('assistant',body);if(history&&history.addMessage)history.addMessage('assistant',body)},

    /* ---- Command Palette ---- */
    _commands:[{cmd:'/remember',desc:'Save to memory',args:'<fact>'},{cmd:'/memory',desc:'Show memories'},{cmd:'/forget all',desc:'Clear memories'},{cmd:'/plan',desc:'Toggle plan mode'},{cmd:'/todo',desc:'Add task',args:'<task>'},{cmd:'/tasks',desc:'Show tasks'},{cmd:'/search',desc:'Web search',args:'<query>'},{cmd:'/run',desc:'Run shell command',args:'<cmd>'},{cmd:'/git',desc:'Show git status'},{cmd:'/status',desc:'Session status'},{cmd:'/tools',desc:'List Typora tools'},{cmd:'/permission',desc:'Tool permission mode',args:'default'},{cmd:'/instructions',desc:'Show project instructions'},{cmd:'/create-skill',desc:'Create a skill',args:'name | desc | prompt'},{cmd:'/add-mcp',desc:'Add MCP server',args:'name | endpoint'},{cmd:'/mcp',desc:'List MCP servers'},{cmd:'/mcp-tools',desc:'List MCP tools',args:'<server>'},{cmd:'/mcp-call',desc:'Run MCP tool',args:'server | tool | JSON'},{cmd:'/help',desc:'Show all commands'}],
    _showCommandPalette(){this._hideCommandPalette();const pal=document.createElement('div');pal.id='gpt-command-palette';pal.style.cssText='position:fixed;background:var(--gpt-bg-secondary);border:1px solid var(--gpt-border);border-radius:var(--gpt-radius-lg);max-height:220px;overflow-y:auto;z-index:10020;box-shadow:var(--gpt-shadow-lg);';this._commands.forEach((c,i)=>{const item=document.createElement('div');item.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 12px;cursor:pointer;font-size:12px;transition:background 0.1s;';item.dataset.active=i===0?'1':'0';if(i===0)item.style.background='var(--gpt-bg-hover)';item.innerHTML='<span style="font-weight:600;color:var(--gpt-accent-text);min-width:110px;">'+c.cmd+'</span><span style="color:var(--gpt-text-secondary);">'+c.desc+'</span>';item.addEventListener('mouseenter',()=>{[...pal.children].forEach(c=>{c.dataset.active='0';c.style.background=''});item.dataset.active='1';item.style.background='var(--gpt-bg-hover)'});item.addEventListener('click',()=>{this.inputField.value=c.cmd+(c.args?' '+c.args:'');this._hideCommandPalette();this.inputField.focus()});pal.appendChild(item)});document.body.appendChild(pal);this._positionCommandPalette()},
    _positionCommandPalette(){const pal=document.getElementById('gpt-command-palette');if(!pal||!this.inputField)return;const r=this.inputField.getBoundingClientRect();pal.style.left=r.left+'px';pal.style.width=r.width+'px';pal.style.bottom=(window.innerHeight-r.top+4)+'px'},
    _hideCommandPalette(){const p=document.getElementById('gpt-command-palette');if(p)p.remove()},
    _filterCommandPalette(){const val=this.inputField.value.toLowerCase();const pal=document.getElementById('gpt-command-palette');if(!pal)return;let visible=0;pal.querySelectorAll('div').forEach(d=>{const t=d.textContent.toLowerCase();const show=t.includes(val);d.style.display=show?'':'none';if(show)visible++});if(visible===0)this._hideCommandPalette()},

    destroy(){if(this.sidebar){this.sidebar.remove();this.sidebar=null}const ce=document.querySelector('content');if(ce)ce.style.marginRight=''}
};
window.TyporaGPT=window.TyporaGPT||{};window.TyporaGPT.UI=UIModule;
