import os,subprocess,time,json,urllib.request,threading,atexit,signal,tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
TMP=Path(tempfile.mkdtemp(prefix='bml-afk-gui-'));PORT=5488;DEBUG=9499
for folder in ['user/User','ext','project']:(TMP/folder).mkdir(parents=True,exist_ok=True)
(TMP/'project/main.py').write_text('print("hello")\n')
(TMP/'user/User/settings.json').write_text(json.dumps({'workbench.startupEditor':'none','window.dialogStyle':'custom','security.workspace.trust.enabled':False,'buildMyLogic.apiBaseUrl':f'http://127.0.0.1:{PORT}','window.commandCenter':False,'extensions.autoUpdate':False,'extensions.autoCheckUpdates':False,'update.mode':'none','telemetry.telemetryLevel':'off'}))
subprocess.run(['code','--no-sandbox','--user-data-dir',str(TMP/'user'),'--extensions-dir',str(TMP/'ext'),'--install-extension',str(ROOT/'public/downloads/buildmylogic-vscode-0.3.22.vsix'),'--force'],check=True)
state={'session_id':'BML-AFKQA5','challenge_id':'python-conditions-sign-v1','title':'Number sign - local QA','language':'Python','concept':'conditions','instructions':'Read one integer and print negative, zero or positive.','expected_skills':['conditions'],'status':'connected','attempts':0,'hints_used':0,'extension_status':'connected','rev':1,'task_generation':0,'checkpoints':[],'timing':{'active_ms':0,'quality':'extension-observed','paused':False}}
events=[]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def respond(self,data):
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):self.respond({'ok':True,'state':state})
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or '{}')
  if self.path.endswith('/pairing/claim'):
   assert body['code']=='ABCD2345';return self.respond({'ok':True,'session_id':state['session_id'],'connection_token':'q'*43})
  if self.path.endswith('/connect'):return self.respond({'ok':True,'session':state})
  if self.path.endswith('/events'):
   events.append(body)
   assert body['event_type'] in ['heartbeat','work_pause','work_activity','project_context','compiler_error','file_evidence'],body
   return self.respond({'ok':True,'state':state})
  raise Exception('Unexpected API '+self.path)
server=ThreadingHTTPServer(('127.0.0.1',PORT),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();atexit.register(server.shutdown)
procs=[]
def start(args,env=None):
 p=subprocess.Popen(args,env=env,stdout=open(TMP/('process-'+str(len(procs))+'.log'),'w'),stderr=subprocess.STDOUT,start_new_session=True);procs.append(p);return p
@atexit.register
def cleanup():
 for p in reversed(procs):
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
start(['Xvfb',':98','-screen','0','1600x1100x24']);time.sleep(.5)
env=dict(os.environ,DISPLAY=':98',BUILDMYLOGIC_API_URL=f'http://127.0.0.1:{PORT}')
start(['/usr/share/code/code','--no-sandbox','--disable-gpu','--disable-workspace-trust','--password-store=basic','--user-data-dir',str(TMP/'user'),'--extensions-dir',str(TMP/'ext'),'--remote-debugging-port='+str(DEBUG),str(TMP/'project'),str(TMP/'project/main.py')],env)
for i in range(90):
 try:
  if json.load(urllib.request.urlopen(f'http://127.0.0.1:{DEBUG}/json/list')):break
 except Exception:pass
 time.sleep(.5)
with sync_playwright() as pw:
 browser=pw.chromium.connect_over_cdp(f'http://127.0.0.1:{DEBUG}')
 page=browser.contexts[0].pages[0];page.set_default_timeout(12000)
 time.sleep(3)
 subprocess.run(['xdotool','search','--onlyvisible','--class','Code','windowfocus'],env=env,check=False)
 page.keyboard.press('Control+Shift+P');page.keyboard.type('View: Show BuildMyLogic',delay=20);page.keyboard.press('Enter')
 frame=None
 for i in range(60):
  for f in page.frames:
   try:
    if f.locator('#pairCode').count():frame=f;break
   except Exception:pass
  if frame:break
  time.sleep(.5)
 if not frame:
  page.screenshot(path='/downloads/bml-afk-gui-error.png');raise Exception('No extension sidebar webview: '+page.locator('body').inner_text()[-1000:])
 frame.locator('#pairCode').fill('ABCD2345');frame.locator('#pairButton').click()
 page.get_by_role('button',name='Share session evidence',exact=True).click()
 frame.locator('#active').wait_for(state='visible')
 assert 'v0.3.22' in frame.locator('.version').inner_text()
 frame.locator('#afkClock').filter(has_text='AFK').wait_for()
 # The exact installed VSIX receives a real foreground document edit.
 page.keyboard.press('Control+1');page.keyboard.press('Control+End');page.keyboard.press('Enter');page.keyboard.insert_text('x = 1')
 frame.locator('#afkClock').filter(has_text='AFK in').wait_for()
 time.sleep(2)
 clock=frame.locator('#afkClock').inner_text()
 assert 'AFK in' in clock and int(clock.split()[2][:-1]) < 30,clock
 page.screenshot(path='/downloads/bml-afk-countdown-installed.png')
 page.keyboard.press('Control+1');page.keyboard.press('Control+End');page.keyboard.press('Enter');
 # Write only our synthetic fixture to this isolated desktop clipboard. The
 # product does not read it; a real Ctrl+V delivers one document-change event.
 clipboard=subprocess.Popen(['xclip','-selection','clipboard','-in','-loops','0','-quiet'],env=env,stdin=subprocess.PIPE,stdout=open(TMP/'clipboard.log','w'),stderr=subprocess.STDOUT,start_new_session=True)
 clipboard.stdin.write(('\n'.join('value_'+str(i)+' = '+str(i) for i in range(35))).encode());clipboard.stdin.close()
 procs.append(clipboard);time.sleep(.3)
 subprocess.run(['xdotool','key','--clearmodifiers','ctrl+v'],env=env,check=True)
 assert frame.locator('#insertionNotice').count()==0
 assert 'Large edit noticed' not in frame.locator('body').inner_text()
 assert 'Possible AI copy-paste detected' not in frame.locator('body').inner_text()
 assert frame.locator('#submit').is_enabled()
 page.screenshot(path='/downloads/bml-notice-removed-paste-installed.png')
 page.keyboard.press('Control+1');page.keyboard.type(' # own typing',delay=80)
 assert frame.locator('#insertionNotice').count()==0
 time.sleep(31)
 assert 'idle limit reached' in frame.locator('#afkClock').inner_text()
 page.screenshot(path='/downloads/bml-notice-removed-afk-installed.png')
 assert not any('insertion' in json.dumps(e).lower() for e in events)
 assert not any('value_34' in json.dumps(e) for e in events)
 assert any(e['event_type']=='work_activity' for e in events)
 assert all(0<=e['payload']['active_ms']<=30000 for e in events if e['event_type']=='work_activity')
 print('PASS exact installed0.3.22: real paste and normal typing show NO insertion feature; AFK countdown/31s idle and Submit enabled; no source/insertion upload')
 print('API event types:',[e['event_type'] for e in events])
 browser.close()
