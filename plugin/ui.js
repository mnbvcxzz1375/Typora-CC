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
    sidebar:null,messagesContainer:null,inputField:null,isStreaming:false,currentAbortController:null,contextMode:'document',pendingAttachments:[],
    get llm(){return window.TyporaGPT.LLM},get writing(){return window.TyporaGPT.Writing},get context(){return window.TyporaGPT.Context},
    _icons:{
        send:'<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
        stop:'<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/></svg>',
        close:'<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z"/></svg>',
        plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
        history:'<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
        skills:'<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        context:'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        folder:'<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
        chat:'<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
        attach:'<svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
    },
    _svg(n){return this._icons[n]||''},
    build(){
        if(document.getElementById('typora-gpt-sidebar'))return;
        this.sidebar=document.createElement('div');this.sidebar.id='typora-gpt-sidebar';
        this.sidebar.innerHTML=this._getSidebarHTML();document.body.appendChild(this.sidebar);
        this.messagesContainer=document.getElementById('gpt-messages');this.inputField=document.getElementById('gpt-input');
        this._bindEvents();this._bindResize();this._addWelcomeMessage();
    },
    _getSidebarHTML(){
        return '<div id="gpt-resize-handle" class="gpt-resize-handle"></div>'
        +'<div class="gpt-sidebar-header"><div class="gpt-header-left"><div class="gpt-logo">G</div><span class="gpt-title">Typora GPT</span></div>'
        +'<div class="gpt-header-right">'
        +'<button id="gpt-new-conv-btn" class="gpt-icon-btn" title="New conversation">'+this._svg('plus')+'</button>'
        +'<button id="gpt-history-btn" class="gpt-icon-btn" title="History">'+this._svg('history')+'</button>'
        +'<button id="gpt-skills-btn" class="gpt-icon-btn" title="Skills">'+this._svg('skills')+'</button>'
        +'<button id="gpt-context-toggle" class="gpt-icon-btn" title="Context: Document">'+this._svg('context')+'</button>'
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
        +'<div class="gpt-input-hint"><span id="gpt-context-label">Context: Document</span><span class="gpt-input-hint-sep"></span><span>Attach / paste / drop files</span></div></div>'
        +'<div id="gpt-settings-modal" class="gpt-modal gpt-hidden"><div class="gpt-modal-content"><div class="gpt-modal-header"><h3>Settings</h3><button id="gpt-settings-close" class="gpt-icon-btn">'+this._svg('close')+'</button></div><div class="gpt-modal-body">'
        +'<div class="gpt-setting-group"><label>Provider</label><select id="gpt-setting-provider"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="custom">Custom (OpenAI-compatible)</option></select></div>'
        +'<div class="gpt-setting-group"><label>API Key</label><input type="password" id="gpt-setting-apikey" placeholder="sk-..." autocomplete="off" /></div>'
        +'<div class="gpt-setting-group"><label>Endpoint</label><input type="text" id="gpt-setting-endpoint" placeholder="https://api.openai.com/v1/chat/completions" /></div>'
        +'<div class="gpt-setting-group"><label>Model</label><div style="display:flex;gap:6px;"><input type="text" id="gpt-setting-model" placeholder="gpt-4o" style="flex:1" /><button id="gpt-fetch-models" class="gpt-btn gpt-btn-secondary" style="white-space:nowrap;padding:6px 10px;font-size:11px;">Fetch</button></div><select id="gpt-model-list" class="gpt-hidden" style="margin-top:6px;"></select></div>'
        +'<div class="gpt-setting-group"><label>Temperature: <span id="gpt-temp-value">0.7</span></label><input type="range" id="gpt-setting-temperature" min="0" max="2" step="0.1" value="0.7" /></div>'
        +'<div class="gpt-setting-group"><label>Max Output Tokens</label><input type="number" id="gpt-setting-maxtokens" value="4096" min="256" max="128000" /></div>'
        +'<div class="gpt-setting-group"><label>Max Context Tokens</label><input type="number" id="gpt-setting-maxcontexttokens" value="120000" min="1000" max="1000000" /></div>'
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
        document.getElementById('gpt-send-btn').addEventListener('click',()=>this.sendMessage());
        document.getElementById('gpt-stop-btn').addEventListener('click',()=>this.stopStreaming());
        this.inputField.addEventListener('input',()=>{this.inputField.style.height='auto';this.inputField.style.height=Math.min(this.inputField.scrollHeight,140)+'px';const v=this.inputField.value;if(v==='/')this._showCommandPalette();else if(v.startsWith('/')&&v.length>1)this._filterCommandPalette();else this._hideCommandPalette()});
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
        ma.addEventListener('dragover',(e)=>{e.preventDefault();ma.classList.add('gpt-drag-over')});
        ma.addEventListener('dragleave',()=>ma.classList.remove('gpt-drag-over'));
        ma.addEventListener('drop',(e)=>{e.preventDefault();ma.classList.remove('gpt-drag-over');this._handleDrop(e)});
        document.querySelectorAll('.gpt-quick-btn').forEach(b=>{b.addEventListener('click',()=>this.executeQuickAction(b.getAttribute('data-action')))});
        document.getElementById('gpt-save-settings').addEventListener('click',()=>{this.saveSettings();setTimeout(()=>this.closeSettings(),600)});
        document.getElementById('gpt-test-connection').addEventListener('click',()=>this.testConnection());
        document.getElementById('gpt-fetch-models').addEventListener('click',()=>this.fetchModels());
        document.getElementById('gpt-model-list').addEventListener('change',(e)=>{if(e.target.value){document.getElementById('gpt-setting-model').value=e.target.value;e.target.classList.add('gpt-hidden')}});
        document.getElementById('gpt-setting-temperature').addEventListener('input',(e)=>{document.getElementById('gpt-temp-value').textContent=e.target.value});
        document.getElementById('gpt-setting-enablethinking').addEventListener('change',(e)=>{document.getElementById('gpt-thinking-options').classList.toggle('gpt-hidden',!e.target.checked)});
        document.getElementById('gpt-settings-modal').addEventListener('click',(e)=>{if(e.target.id==='gpt-settings-modal')this.closeSettings()});
        document.getElementById('gpt-add-mcp-btn').addEventListener('click',()=>{document.getElementById('gpt-mcp-form').classList.toggle('gpt-hidden')});
        document.getElementById('gpt-mcp-cancel').addEventListener('click',()=>{document.getElementById('gpt-mcp-form').classList.add('gpt-hidden')});
        document.getElementById('gpt-mcp-save').addEventListener('click',()=>this._saveMCP());
        document.addEventListener('keydown',(e)=>{if(e.ctrlKey&&e.shiftKey&&e.key==='G'){e.preventDefault();this.toggle()}});
        // Selection reference: monitor text selection in the editor
        document.addEventListener('mouseup',(e)=>{setTimeout(()=>this._checkSelection(e),10)});
        document.getElementById('gpt-selection-ref').querySelector('.gpt-selection-ref-close').addEventListener('click',()=>this._clearSelectionRef());
    },
    _bindResize(){const h=document.getElementById('gpt-resize-handle');if(!h)return;let sx=0,sw=0;const mv=(e)=>{const dx=sx-e.clientX;const w=Math.max(300,Math.min(720,sw+dx));this.sidebar.style.width=w+'px';const ce=document.querySelector('content');if(ce&&this.sidebar.classList.contains('gpt-open'))ce.style.marginRight=w+'px';document.body.style.cursor='col-resize';document.body.style.userSelect='none'};const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);document.body.style.cursor='';document.body.style.userSelect=''};h.addEventListener('mousedown',(e)=>{e.preventDefault();sx=e.clientX;sw=this.sidebar.offsetWidth;document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)})},
    toggle(){
        if(!this.sidebar)return;
        const willOpen=!this.sidebar.classList.contains('gpt-open');
        if(!willOpen){this.sidebar.style.width=''}
        this.sidebar.classList.toggle('gpt-open',willOpen);
        const ce=document.querySelector('content');
        if(ce)ce.style.marginRight=willOpen?(this.sidebar.offsetWidth||380)+'px':'0px';
    },
    open(){if(this.sidebar&&!this.sidebar.classList.contains('gpt-open'))this.toggle()},
    toggleContextMode(){const m=['document','folder','none'];const l={document:'Context: Document',folder:'Context: Folder',none:'Context: None'};const ic={document:'context',folder:'folder',none:'chat'};const i=m.indexOf(this.contextMode);this.contextMode=m[(i+1)%m.length];document.getElementById('gpt-context-toggle').innerHTML=this._svg(ic[this.contextMode]);document.getElementById('gpt-context-toggle').title=l[this.contextMode];document.getElementById('gpt-context-label').textContent=l[this.contextMode]},
    _addWelcomeMessage(){this.addMessage('assistant','**Typora GPT**\n\n**Quick Actions**: Polish / Continue / Summarize / Explain / ZH / EN / JA\n\n**Slash Commands** (type `/` for autocomplete):\n- `/remember <fact>` — Save to memory\n- `/memory` — Show memories\n- `/plan` — Toggle plan mode\n- `/todo <task>` — Add task\n- `/tasks` — Show tasks\n- `/search <query>` — Web search\n- `/run <cmd>` — Shell command\n- `/git` — Git status\n- `/instructions` — Project instructions\n- `/create-skill name | desc | prompt` — Create skill\n- `/add-mcp name | endpoint` — Add MCP server\n- `/mcp` — List MCP servers\n- `/help` — All commands\n\n**Tips**: Ctrl+Shift+G to toggle. Attach files via button or paste.')},
    addMessage(role,content){const d=document.createElement('div');d.className='gpt-message gpt-message-'+role;const a=document.createElement('div');a.className='gpt-message-avatar';a.textContent=role==='user'?'U':'G';const b=document.createElement('div');b.className='gpt-message-body';const c=document.createElement('div');c.className='gpt-message-content';c.innerHTML=this._renderMarkdown(content);b.appendChild(c);if(role==='assistant'){const x=document.createElement('div');x.className='gpt-message-actions';x.innerHTML='<button class="gpt-msg-action-btn" data-action="copy">Copy</button><button class="gpt-msg-action-btn" data-action="insert">Insert</button>';x.querySelectorAll('.gpt-msg-action-btn').forEach(btn=>{btn.addEventListener('click',()=>{const a=btn.getAttribute('data-action');if(a==='copy'){navigator.clipboard.writeText(c.textContent);btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy',1500)}else if(a==='insert'){this._insertIntoDocument(c.textContent);btn.textContent='Done';setTimeout(()=>btn.textContent='Insert',1500)}})});b.appendChild(x)}d.appendChild(a);d.appendChild(b);this.messagesContainer.appendChild(d);this._scrollToBottom();return c},
    _renderMarkdown(t){if(!t)return '';let h=t.replace(/```(\w*)\n([\s\S]*?)```/g,'<pre><code class="lang-$1">$2</code></pre>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>').replace(/^### (.+)$/gm,'<h4>$1</h4>').replace(/^## (.+)$/gm,'<h3>$1</h3>').replace(/^# (.+)$/gm,'<h2>$1</h2>').replace(/^[*-] (.+)$/gm,'<li>$1</li>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');h=h.replace(/(<li>.*?<\/li>)+/gs,'<ul>$&</ul>');return '<p>'+h+'</p>'},
    _renderStreamingMessage(th,mt){let h='';if(th)h+='<details class="gpt-thinking-block" open><summary class="gpt-thinking-summary">Thinking</summary><div class="gpt-thinking-content">'+this._renderMarkdown(th)+'</div></details>';if(mt)h+=this._renderMarkdown(mt);return h||'<span class="gpt-typing">Thinking</span>'},
    _insertIntoDocument(t){try{const w=document.querySelector('#write');if(w&&w.getAttribute('contenteditable')==='true'){const s=window.getSelection();if(s&&s.rangeCount>0){const r=s.getRangeAt(0);r.collapse(false);const n=document.createTextNode('\n\n'+t);r.insertNode(n);r.setStartAfter(n);r.setEndAfter(n);s.removeAllRanges();s.addRange(n);return}}navigator.clipboard.writeText(t)}catch(e){navigator.clipboard.writeText(t)}},
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
        await this.writing.customQuery(prompt,(tk,tp)=>{if(tp==='thinking')tr+=tk;else fr+=tk;am.innerHTML=this._renderStreamingMessage(tr,fr);this._scrollToBottom()},()=>{this.isStreaming=false;this._updateStreamingUI(false);if(!fr)am.innerHTML='<em>No response.</em>';h.updateLastAssistant(fr,tr)},(e)=>{this.isStreaming=false;this._updateStreamingUI(false);am.innerHTML='<span class="gpt-error">'+e+'</span>'},this.contextMode,att);
    },
    async executeQuickAction(id){if(this.isStreaming)return;this.open();const lb={polish:'Polishing...',continue:'Continuing...',summarize:'Summarizing...',explain:'Explaining...','translate-zh':'Translating to ZH...','translate-en':'Translating to EN...','translate-ja':'Translating to JA...'};this.addMessage('user','/'+id);const a=this.addMessage('assistant','');a.innerHTML='<span class="gpt-typing">'+(lb[id]||'Processing')+'</span>';this.isStreaming=true;this._updateStreamingUI(true);let f='',t='';await this.writing.executeAction(id,(tk,tp)=>{if(tp==='thinking')t+=tk;else f+=tk;a.innerHTML=this._renderStreamingMessage(t,f);this._scrollToBottom()},()=>{this.isStreaming=false;this._updateStreamingUI(false);if(!f)a.innerHTML='<em>No response.</em>'},(e)=>{this.isStreaming=false;this._updateStreamingUI(false);a.innerHTML='<span class="gpt-error">'+e+'</span>'})},
    stopStreaming(){if(this.currentAbortController)this.currentAbortController.abort();this.isStreaming=false;this._updateStreamingUI(false)},
    _updateStreamingUI(s){document.getElementById('gpt-send-btn').classList.toggle('gpt-hidden',s);document.getElementById('gpt-stop-btn').classList.toggle('gpt-hidden',!s)},
    clearMessages(){this.messagesContainer.innerHTML='';this._addWelcomeMessage()},
    _scrollToBottom(){if(this.messagesContainer)this.messagesContainer.scrollTop=this.messagesContainer.scrollHeight},
    openSettings(){document.getElementById('gpt-settings-modal').classList.remove('gpt-hidden');const s=this.llm.getSettings();document.getElementById('gpt-setting-provider').value=s.provider||'openai';document.getElementById('gpt-setting-apikey').value=s.apiKey||'';document.getElementById('gpt-setting-endpoint').value=s.endpoint||'';document.getElementById('gpt-setting-model').value=s.model||'';document.getElementById('gpt-setting-temperature').value=s.temperature??0.7;document.getElementById('gpt-temp-value').textContent=s.temperature??0.7;document.getElementById('gpt-setting-maxtokens').value=s.maxTokens||4096;document.getElementById('gpt-setting-maxcontexttokens').value=s.maxContextTokens||120000;document.getElementById('gpt-setting-enablethinking').checked=s.enableThinking||false;document.getElementById('gpt-thinking-options').classList.toggle('gpt-hidden',!s.enableThinking);document.getElementById('gpt-setting-thinkingeffort').value=s.thinkingEffort||'medium';document.getElementById('gpt-setting-systemprompt').value=s.systemPrompt||'';this._renderMCPList()},
    closeSettings(){document.getElementById('gpt-settings-modal').classList.add('gpt-hidden');document.getElementById('gpt-test-result').classList.add('gpt-hidden')},
    saveSettings(silent){const s={provider:document.getElementById('gpt-setting-provider').value,apiKey:document.getElementById('gpt-setting-apikey').value,endpoint:document.getElementById('gpt-setting-endpoint').value,model:document.getElementById('gpt-setting-model').value,temperature:parseFloat(document.getElementById('gpt-setting-temperature').value),maxTokens:parseInt(document.getElementById('gpt-setting-maxtokens').value),maxContextTokens:parseInt(document.getElementById('gpt-setting-maxcontexttokens').value)||120000,enableThinking:document.getElementById('gpt-setting-enablethinking').checked,thinkingEffort:document.getElementById('gpt-setting-thinkingeffort').value,systemPrompt:document.getElementById('gpt-setting-systemprompt').value};this.llm.saveSettings(s);if(!silent){const r=document.getElementById('gpt-test-result');r.classList.remove('gpt-hidden');r.className='gpt-test-result gpt-test-success';r.textContent='Saved';setTimeout(()=>r.classList.add('gpt-hidden'),1800)}return s},
    async testConnection(){this.saveSettings(true);const r=document.getElementById('gpt-test-result');r.classList.remove('gpt-hidden');r.className='gpt-test-result gpt-test-testing';r.textContent='Testing...';const res=await this.llm.testConnection();r.className=res.success?'gpt-test-result gpt-test-success':'gpt-test-result gpt-test-error';r.textContent=res.success?res.message:'Failed: '+res.message},
    async fetchModels(){this.saveSettings(true);const r=document.getElementById('gpt-test-result'),ml=document.getElementById('gpt-model-list'),fb=document.getElementById('gpt-fetch-models');r.classList.remove('gpt-hidden');r.className='gpt-test-result gpt-test-testing';r.textContent='Fetching...';fb.disabled=true;const res=await this.llm.fetchModels();fb.disabled=false;if(res.success){r.className='gpt-test-result gpt-test-success';r.textContent=res.message;ml.innerHTML='<option value="">-- Select --</option>';res.models.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;ml.appendChild(o)});ml.classList.remove('gpt-hidden')}else{r.className='gpt-test-result gpt-test-error';r.textContent=res.message;ml.classList.add('gpt-hidden')}},
    newConversation(){window.TyporaGPT.History.create();this.clearMessages();this._addWelcomeMessage()},
    toggleHistoryPanel(){const p=document.getElementById('gpt-history-panel');document.getElementById('gpt-skills-panel').classList.add('gpt-hidden');p.classList.toggle('gpt-hidden');if(!p.classList.contains('gpt-hidden'))this._renderHistoryList()},
    _renderHistoryList(){const h=window.TyporaGPT.History,l=document.getElementById('gpt-history-list'),c=h.getList();if(!c.length){l.innerHTML='<div class="gpt-panel-empty">No conversations yet.</div>';return}l.innerHTML='';c.forEach(cv=>{const i=document.createElement('div');i.className='gpt-history-item'+(cv.id===h.currentId?' gpt-active':'');const d=new Date(cv.updatedAt);const ts=d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});i.innerHTML='<div class="gpt-history-title">'+this._esc(cv.title)+'</div><div class="gpt-history-meta">'+cv.messageCount+' messages · '+ts+'</div><div class="gpt-history-actions"><button class="gpt-msg-action-btn" data-action="switch">Open</button><button class="gpt-msg-action-btn" data-action="delete">Delete</button></div>';i.querySelector('[data-action="switch"]').addEventListener('click',(e)=>{e.stopPropagation();this._switchConversation(cv.id)});i.querySelector('[data-action="delete"]').addEventListener('click',(e)=>{e.stopPropagation();if(confirm('Delete "'+cv.title+'"?')){h.delete(cv.id);this._renderHistoryList();if(cv.id===h.currentId){this.clearMessages();this._addWelcomeMessage()}}});i.addEventListener('click',()=>this._switchConversation(cv.id));l.appendChild(i)})},
    _switchConversation(id){const h=window.TyporaGPT.History,c=h.switchTo(id);if(!c)return;this.messagesContainer.innerHTML='';if(!c.messages.length)this._addWelcomeMessage();else c.messages.forEach(m=>{if(m.role==='user')this.addMessage('user',m.content);else if(m.role==='assistant'){const el=this.addMessage('assistant','');el.innerHTML=m.thinking?this._renderStreamingMessage(m.thinking,m.content):this._renderMarkdown(m.content)}});document.getElementById('gpt-history-panel').classList.add('gpt-hidden')},
    toggleSkillsPanel(){const p=document.getElementById('gpt-skills-panel');document.getElementById('gpt-history-panel').classList.add('gpt-hidden');p.classList.toggle('gpt-hidden');if(!p.classList.contains('gpt-hidden'))this._renderSkillsList()},
    _renderSkillsList(){const sk=window.TyporaGPT.Skills,l=document.getElementById('gpt-skills-list');l.innerHTML='';sk.getAllSkills().forEach(s=>{const i=document.createElement('div');i.className='gpt-skill-item';i.innerHTML='<div class="gpt-skill-icon">'+(s.icon||'*')+'</div><div class="gpt-skill-info"><div class="gpt-skill-name">'+this._esc(s.name)+'</div><div class="gpt-skill-desc">'+this._esc(s.description||'')+'</div></div>'+(s.isCustom?'<button class="gpt-msg-action-btn" data-action="delete">Del</button>':'');i.addEventListener('click',(e)=>{if(e.target.closest('[data-action="delete"]')){sk.deleteSkill(s.id);this._renderSkillsList();return}this._executeSkill(s)});l.appendChild(i)})},
    async _executeSkill(skill){this.open();document.getElementById('gpt-skills-panel').classList.add('gpt-hidden');this.addMessage('user','['+skill.name+']');const a=this.addMessage('assistant','');a.innerHTML='<span class="gpt-typing">Running</span>';this.isStreaming=true;this._updateStreamingUI(true);let f='',t='';await this.writing.customQuery(skill.prompt,(tk,tp)=>{if(tp==='thinking')t+=tk;else f+=tk;a.innerHTML=this._renderStreamingMessage(t,f);this._scrollToBottom()},()=>{this.isStreaming=false;this._updateStreamingUI(false);if(!f)a.innerHTML='<em>No response.</em>'},(e)=>{this.isStreaming=false;this._updateStreamingUI(false);a.innerHTML='<span class="gpt-error">'+e+'</span>'},skill.contextMode||'document')},
    importSkill(){
        const i=document.createElement('input');i.type='file';i.accept='.json';i.multiple=true;i.webkitdirectory=false;
        const folderBtn=document.createElement('input');folderBtn.type='file';folderBtn.webkitdirectory=true;
        const dialog=document.createElement('div');dialog.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:10001;display:flex;align-items:center;justify-content:center;';
        dialog.innerHTML='<div style="background:var(--gpt-bg-secondary);border:1px solid var(--gpt-border);border-radius:var(--gpt-radius-lg);padding:20px;width:280px;text-align:center;">'
            +'<div style="font-weight:600;margin-bottom:14px;font-size:13px;">Import Skills</div>'
            +'<div style="display:flex;flex-direction:column;gap:8px;">'
            +'<button id="imp-file-btn" class="gpt-btn gpt-btn-secondary" style="width:100%;">Import JSON File(s)</button>'
            +'<button id="imp-folder-btn" class="gpt-btn gpt-btn-secondary" style="width:100%;">Import from Folder</button>'
            +'<button id="imp-cancel-btn" class="gpt-btn gpt-btn-secondary" style="width:100%;">Cancel</button>'
            +'</div></div>';
        document.body.appendChild(dialog);
        dialog.querySelector('#imp-cancel-btn').addEventListener('click',()=>dialog.remove());
        dialog.querySelector('#imp-file-btn').addEventListener('click',()=>{dialog.remove();i.click()});
        dialog.querySelector('#imp-folder-btn').addEventListener('click',()=>{dialog.remove();folderBtn.click()});
        i.onchange=async(e)=>{const files=[];for(const f of e.target.files)files.push({name:f.name,content:await f.text()});try{const n=window.TyporaGPT.Skills.importFromFiles(files);alert('Imported '+n+' skill(s).');this._renderSkillsList()}catch(err){alert('Failed: '+err.message)}};
        folderBtn.onchange=async(e)=>{const files=[];for(const f of e.target.files)if(f.name.endsWith('.json'))files.push({name:f.name,content:await f.text()});try{const n=window.TyporaGPT.Skills.importFromFiles(files);alert('Imported '+n+' skill(s).');this._renderSkillsList()}catch(err){alert('Failed: '+err.message)}};
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
        if(this.sidebar&&this.sidebar.contains(e.target))return;
        const sel=window.getSelection();
        if(!sel||sel.isCollapsed||!sel.toString().trim()){return}
        const text=sel.toString().trim();
        if(text.length<3)return;
        // Only show if selection is in the editor area
        const writeEl=document.querySelector('#write');
        if(writeEl&&writeEl.contains(sel.anchorNode)){
            this._selectedRef=text;
            this._showSelectionRef(text);
        }
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
    _esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML},

    /* ---- MCP ---- */
    _renderMCPList(){const list=document.getElementById('gpt-mcp-list');if(!list)return;const servers=window.TyporaGPT.Skills.getMCPServers();if(!servers.length){list.innerHTML='<div style="font-size:11px;color:var(--gpt-text-muted);padding:4px 0;">No MCP servers configured.</div>';return}list.innerHTML='';servers.forEach(s=>{const d=document.createElement('div');d.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid var(--gpt-border-subtle);';d.innerHTML='<span style="flex:1;font-weight:500;">'+this._esc(s.name)+'</span><span style="font-size:10px;color:var(--gpt-text-muted);">'+(s.enabled?'on':'off')+'</span><button class="gpt-msg-action-btn" data-action="toggle">'+(s.enabled?'Disable':'Enable')+'</button><button class="gpt-msg-action-btn" data-action="remove">Remove</button>';d.querySelector('[data-action="toggle"]').addEventListener('click',()=>{window.TyporaGPT.Skills.toggleMCPServer(s.id);this._renderMCPList()});d.querySelector('[data-action="remove"]').addEventListener('click',()=>{if(confirm('Remove "'+s.name+'"?')){window.TyporaGPT.Skills.removeMCPServer(s.id);this._renderMCPList()}});list.appendChild(d)})},
    _saveMCP(){const name=document.getElementById('gpt-mcp-name').value.trim(),endpoint=document.getElementById('gpt-mcp-endpoint').value.trim(),key=document.getElementById('gpt-mcp-key').value.trim();if(!name||!endpoint){alert('Name and endpoint are required.');return}window.TyporaGPT.Skills.addMCPServer({name,endpoint,apiKey:key});document.getElementById('gpt-mcp-name').value='';document.getElementById('gpt-mcp-endpoint').value='';document.getElementById('gpt-mcp-key').value='';document.getElementById('gpt-mcp-form').classList.add('gpt-hidden');this._renderMCPList()},

    /* ---- Command Palette ---- */
    _commands:[{cmd:'/remember',desc:'Save to memory',args:'<fact>'},{cmd:'/memory',desc:'Show memories'},{cmd:'/forget all',desc:'Clear memories'},{cmd:'/plan',desc:'Toggle plan mode'},{cmd:'/todo',desc:'Add task',args:'<task>'},{cmd:'/tasks',desc:'Show tasks'},{cmd:'/search',desc:'Web search',args:'<query>'},{cmd:'/run',desc:'Run shell command',args:'<cmd>'},{cmd:'/git',desc:'Show git status'},{cmd:'/instructions',desc:'Show project instructions'},{cmd:'/create-skill',desc:'Create a skill',args:'name | desc | prompt'},{cmd:'/add-mcp',desc:'Add MCP server',args:'name | endpoint'},{cmd:'/mcp',desc:'List MCP servers'},{cmd:'/help',desc:'Show all commands'}],
    _showCommandPalette(){this._hideCommandPalette();const pal=document.createElement('div');pal.id='gpt-command-palette';pal.style.cssText='position:absolute;bottom:100%;left:0;right:0;background:var(--gpt-bg-secondary);border:1px solid var(--gpt-border);border-radius:var(--gpt-radius-lg);max-height:220px;overflow-y:auto;z-index:20;box-shadow:var(--gpt-shadow-md);margin-bottom:4px;';this._commands.forEach((c,i)=>{const item=document.createElement('div');item.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 12px;cursor:pointer;font-size:12px;transition:background 0.1s;';item.dataset.active=i===0?'1':'0';if(i===0)item.style.background='var(--gpt-bg-hover)';item.innerHTML='<span style="font-weight:600;color:var(--gpt-accent-text);min-width:110px;">'+c.cmd+'</span><span style="color:var(--gpt-text-secondary);">'+c.desc+'</span>';item.addEventListener('mouseenter',()=>{[...pal.children].forEach(c=>{c.dataset.active='0';c.style.background=''});item.dataset.active='1';item.style.background='var(--gpt-bg-hover)'});item.addEventListener('click',()=>{this.inputField.value=c.cmd+(c.args?' '+c.args:'');this._hideCommandPalette();this.inputField.focus()});pal.appendChild(item)});this.inputField.parentElement.style.position='relative';this.inputField.parentElement.insertBefore(pal,this.inputField)},
    _hideCommandPalette(){const p=document.getElementById('gpt-command-palette');if(p)p.remove()},
    _filterCommandPalette(){const val=this.inputField.value.toLowerCase();const pal=document.getElementById('gpt-command-palette');if(!pal)return;let visible=0;pal.querySelectorAll('div').forEach(d=>{const t=d.textContent.toLowerCase();const show=t.includes(val);d.style.display=show?'':'none';if(show)visible++});if(visible===0)this._hideCommandPalette()},

    destroy(){if(this.sidebar){this.sidebar.remove();this.sidebar=null}const ce=document.querySelector('content');if(ce)ce.style.marginRight=''}
};
window.TyporaGPT=window.TyporaGPT||{};window.TyporaGPT.UI=UIModule;
