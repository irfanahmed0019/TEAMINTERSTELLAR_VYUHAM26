import * as vscode from 'vscode';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';

type Pair = { id: string; credential: string; url: string; key: string; root: string };
type State = { project: string; paused: boolean; note: string; updated_at: string; snapshot?: { files?: {path:string;content:string}[]; summary?:string } };
const SECRET = 'buildmylogic.projectPair';
const EXCLUDE = '**/{.git,node_modules,vendor,dist,build,coverage,.next,.venv,venv,.idea,.vscode,.ssh,.aws}/**';
export function safePath(name: string) {
 return !name.split('/').some(p=>p.startsWith('.') || /^(node_modules|vendor|dist|build|coverage|venv)$/i.test(p)) && !/(secrets?|credentials?|passwords?|tokens?|private.?key|lock)(\.|_|-|$)/i.test(name) && /\.(ts|tsx|js|jsx|mjs|cjs|py|c|h|cpp|hpp|java|rs|go|rb|php|html|css|scss|sql|md|txt|json|yaml|yml)$/i.test(name) && !/(package-lock|yarn.lock|pnpm-lock|agent-config)/i.test(name);
}
export function containsSecret(text:string) {
 return /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk[-_][A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})|(?:api[_-]?key|secret|password|access[_-]?token|authorization)\s*["']?\s*[:=]\s*["'`]?[A-Za-z0-9_\/.+\-=]{12,}/i.test(text);
}
export class SessionSync implements vscode.Disposable {
 private pair?:Pair; private state?:State; private busy=false; private locallyPaused=true; private lastDigest=''; private timer:ReturnType<typeof setInterval>; private debounce?:ReturnType<typeof setTimeout>; private panel?:vscode.WebviewPanel;
 private status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,50);
 constructor(private context:vscode.ExtensionContext) {
  this.status.command='buildMyLogic.session'; this.status.text='$(plug) BML: Disconnected'; this.status.show();
  this.timer=setInterval(()=>void this.refresh(),3000);
  context.subscriptions.push(vscode.commands.registerCommand('buildMyLogic.session',()=>this.show()),vscode.commands.registerCommand('buildMyLogic.pair',()=>this.connect()),vscode.commands.registerCommand('buildMyLogic.pause',()=>this.toggle()),vscode.commands.registerCommand('buildMyLogic.disconnect',()=>this.disconnect()),vscode.workspace.onDidSaveTextDocument(d=>this.changed(d.uri)),vscode.workspace.onDidCreateFiles(e=>e.files.forEach(u=>this.changed(u))),vscode.workspace.onDidDeleteFiles(e=>e.files.forEach(u=>this.changed(u))),vscode.workspace.onDidRenameFiles(e=>e.files.forEach(u=>this.changed(u.newUri))));
 }
 private changed(uri:vscode.Uri) { if(!this.pair||this.locallyPaused||!path.relative(this.pair.root,uri.fsPath).split(path.sep).every(p=>p!=='..'))return; clearTimeout(this.debounce); this.debounce=setTimeout(()=>void this.snapshot(),800); }
 private async rpc(operation='read',data:unknown={}) { if(!this.pair)throw Error('Connect a project first.'); const p=this.pair; const response=await fetch(p.url+'/rest/v1/rpc/bml_project_sync',{method:'POST',headers:{apikey:p.key,Authorization:'Bearer '+p.key,'Content-Type':'application/json'},body:JSON.stringify({sid:p.id,credential:p.credential,operation,data}),signal:AbortSignal.timeout(12000)}); if(!response.ok)throw Error('Connection rejected. It may be paused, expired or revoked. Reconnect from Sessions.'); this.state=await response.json() as State; this.render(); return this.state; }
 private async connect() {
  if(!vscode.workspace.isTrusted){vscode.window.showWarningMessage('Trust this workspace before connecting.');return;}
  const raw=await vscode.window.showInputBox({title:'Connect BuildMyLogic',prompt:'Paste the private connection copied from website Sessions. Never share it.',password:true,ignoreFocusOut:true}); if(!raw)return;
  try {
   const data=JSON.parse(raw) as Omit<Pair,'root'>;
   if(!/^[0-9a-f-]{36}$/i.test(data.id)||!/^[0-9a-f]{64}$/.test(data.credential)||data.url!=='https://olayuljqahdokttrynvj.supabase.co'||typeof data.key!=='string'||data.key.length>2500)throw Error('Invalid pairing. Copy a new connection from buildmylogicxyz.vercel.app/sessions.');
   const folder=await vscode.window.showWorkspaceFolderPick({placeHolder:'Select the one project to sync'});if(!folder)return;
   const consent=await vscode.window.showWarningMessage('Sync readable source files in '+folder.name+' to your BuildMyLogic account? Files excluded by Git and common secret/vendor/build paths are skipped. Some secrets cannot be detected automatically. Review the project first. No commands will run.','Connect this project');if(consent!=='Connect this project')return;
   this.pair={...data,root:await fs.realpath(folder.uri.fsPath)}; this.locallyPaused=false;
   await this.rpc();await this.context.secrets.store(SECRET,JSON.stringify(this.pair));this.lastDigest='';this.show();await this.snapshot();
  }catch(e){await this.disconnect();vscode.window.showErrorMessage(e instanceof Error?e.message:'Could not pair.');}
 }
 private async refresh() {if(!this.pair||this.busy)return;this.busy=true;try{await this.rpc();this.status.text=this.locallyPaused||this.state?.paused?'$(debug-pause) BML: Paused':'$(sync) BML: Connected';}catch{this.status.text='$(warning) BML: Offline / reconnect';}finally{this.busy=false;}}
 private async ignored(relative:string):Promise<boolean>{if(!this.pair)return true;return new Promise(resolve=>execFile('git',['-C',this.pair!.root,'check-ignore','--no-index','--',relative],(err)=>resolve(!err || (err as NodeJS.ErrnoException & {code?:number})?.code!==1)));}
 private async snapshot() {
  if(!this.pair||this.locallyPaused||!vscode.workspace.isTrusted)return;
  try{
   const state=await this.rpc();if(state.paused)return;
   const root=this.pair.root;const uris=await vscode.workspace.findFiles(new vscode.RelativePattern(root,'**/*'),EXCLUDE,1000);const files:{path:string;content:string}[]=[];let bytes=0,skipped=0;
   for(const uri of uris){const name=path.relative(root,uri.fsPath).split(path.sep).join('/');if(!safePath(name)||await this.ignored(name)){skipped++;continue;}const real=await fs.realpath(uri.fsPath);if(!real.startsWith(root+path.sep)){skipped++;continue;}const stat=await fs.stat(real);if(!stat.isFile()||stat.size>30000){skipped++;continue;}const content=await fs.readFile(real,'utf8');if(content.includes('\0')||containsSecret(content)||bytes+Buffer.byteLength(content)>180000||files.length>=100){skipped++;continue;}files.push({path:name,content});bytes+=Buffer.byteLength(content);}
   files.sort((a,b)=>a.path.localeCompare(b.path));const digest=createHash('sha256').update(JSON.stringify(files)).digest('hex');if(digest===this.lastDigest)return;
   const languages=[...new Set(files.map(f=>path.extname(f.path)))].join(', ');await this.rpc('snapshot',{files,summary:files.length+' source files | '+bytes+' bytes | '+languages,skipped,capturedAt:new Date().toISOString(),feedback:'Source snapshot received. AI review is not active. Saved files only; no tests run.'});this.lastDigest=digest;this.status.text='$(check) BML: Synced';
  }catch{this.status.text='$(warning) BML: Not synced';}
 }
 private async toggle(){if(!this.pair)return;this.locallyPaused=!this.locallyPaused;try{await this.rpc(this.locallyPaused?'pause':'resume');if(!this.locallyPaused){this.lastDigest='';await this.snapshot();}}catch{this.locallyPaused=true;}this.render();}
 private async disconnect(){this.pair=undefined;this.state=undefined;this.locallyPaused=true;this.lastDigest='';await this.context.secrets.delete(SECRET);this.status.text='$(plug) BML: Disconnected';this.render();}
 private show(){if(!this.panel){this.panel=vscode.window.createWebviewPanel('bmlSession','BuildMyLogic Session',vscode.ViewColumn.Beside,{enableScripts:true});this.panel.onDidDispose(()=>{this.panel=undefined;});this.panel.webview.onDidReceiveMessage(m=>{if(m==='pair')void this.connect();if(m==='pause')void this.toggle();if(m==='disconnect')void this.disconnect();if(m==='sync')void this.snapshot();});}this.panel.reveal();this.render();}
 private render(){if(!this.panel)return;const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));const s=this.state;this.panel.webview.html=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-bmlsession'"><style>body{font:14px system-ui;background:#f5f8ff;color:#18253d;padding:28px}section{max-width:720px;background:white;border:1px solid #dce5f4;border-radius:18px;padding:24px;margin:18px 0}button{background:#2563eb;color:white;border:0;border-radius:8px;padding:12px;margin:5px;cursor:pointer}small{color:#667085}pre{white-space:pre-wrap;overflow-wrap:anywhere}li{padding:6px}</style></head><body><h1>BuildMyLogic Sessions</h1><small>One connected project. Saved code. No background shell commands.</small><section><h2>${esc(s?.project||'Connect your project')}</h2><p>${this.pair?(this.locallyPaused||s?.paused?'Paused':'Connected'):'Disconnected. Open website Sessions and copy a private connection.'}</p><button data-action="pair">Connect project</button>${this.pair?'<button data-action="pause">Pause / Resume</button><button data-action="sync">Sync now</button><button data-action="disconnect">Disconnect locally</button>':''}</section><section><h2>Latest context</h2><p>${esc(s?.snapshot?.summary||'No source snapshot yet.')}</p><small>AI review is not active. This is source context, not verified skill progress.</small><h3>Website note</h3><pre>${esc(s?.note||'Add a learning focus or note on the website. It appears here within a few seconds.')}</pre><h3>Synced files</h3><ul>${(s?.snapshot?.files||[]).map(f=>'<li>'+esc(f.path)+'</li>').join('')}</ul></section><p>Excluded: hidden files, Git-ignored paths, vendors, builds, binary and large files, known secret patterns. Git is required; if Git ignore checks fail, files are not uploaded. No offline or sleep syncing. Reconnect after restarting VS Code.</p><script nonce="bmlsession">const api=acquireVsCodeApi();document.querySelectorAll('button').forEach(b=>b.onclick=()=>api.postMessage(b.dataset.action));</script></body></html>`;}
 dispose(){clearInterval(this.timer);clearTimeout(this.debounce);this.status.dispose();this.panel?.dispose();}
}
