import os,subprocess,time,json,urllib.request,threading,atexit,signal,tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
TMP=Path(tempfile.mkdtemp(prefix='bml-afk-gui-'));PORT=5488;DEBUG=9499
for folder in ['user/User','ext','project']:(TMP/folder).mkdir(parents=True,exist_ok=True)
(TMP/'project/main.py').write_text('n = int(input("enter number : "))\nif n>0:\n    print("positive")\nelif n=0:\n    print("zero")\nelse:\n    print("negative")\n')
(TMP/'user/User/settings.json').write_text(json.dumps({'workbench.startupEditor':'none','window.dialogStyle':'custom','security.workspace.trust.enabled':False,'buildMyLogic.apiBaseUrl':f'http://127.0.0.1:{PORT}','window.commandCenter':False,'extensions.autoUpdate':False,'extensions.autoCheckUpdates':False,'update.mode':'none','telemetry.telemetryLevel':'off','editor.autoIndent':'none','editor.formatOnPaste':False,'editor.formatOnSave':False}))
subprocess.run(['code','--no-sandbox','--user-data-dir',str(TMP/'user'),'--extensions-dir',str(TMP/'ext'),'--install-extension',str(ROOT/'public/downloads/buildmylogic-vscode-0.3.26.vsix'),'--force'],check=True)
state={'session_id':'BML-AFKQA5','challenge_id':'python-conditions-sign-v1','title':'Number sign - local QA','language':'Python','concept':'conditions','instructions':'Read one integer and print negative, zero or positive.','expected_skills':['conditions'],'status':'connected','attempts':0,'hints_used':0,'extension_status':'connected','rev':1,'task_generation':0,'checkpoints':[{'index':0,'title':'Number sign - local QA','detail':'3 authored output cases','status':'active','attempts':0,'evaluator':{'id':'python-conditions-sign-v1','command':'buildmylogic:python-conditions-sign-v1','expectedOutputIncludes':['BML_PRACTICE_PASS:python-conditions-sign-v1']}}],'timing':{'active_ms':0,'quality':'extension-observed','paused':False}}
events=[]
def auto_assign():
  from copy import deepcopy
  prior=deepcopy(state)
  state.update({'challenge_id':'python-arithmetic-add-v1','title':'Add two numbers - local QA','concept':'arithmetic','instructions':'Read two integers, one on each line. Store them in variables and add them.\nPrint only their sum.','task_generation':1,'rev':100,'attempts':0,'attempt_history':[],'test_score':{'passed':0,'total':1},'practice_history':[{'title':prior['title'],'state':prior}],'checkpoints':[{'index':0,'title':'Add two numbers - local QA','detail':'4 authored cases','status':'active','attempts':0,'evaluator':{'id':'python-arithmetic-add-v1','command':'buildmylogic:python-arithmetic-add-v1','expectedOutputIncludes':['BML_PRACTICE_PASS:python-arithmetic-add-v1']}}]})

class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def respond(self,data):
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
 def do_GET(self):self.respond({'ok':True,'state':state})
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or '{}')
  if self.path.endswith('/pairing/claim'):
   assert body['code']=='ABCD2345';return self.respond({'ok':True,'session_id':state['session_id'],'connection_token':'q'*43})
  if self.path.endswith('/run-plan'):return self.respond({'ok':True,'run_plan':{'command':'buildmylogic:python-conditions-sign-v1'},'state':state})
  if self.path.endswith('/test-result'):
   state['attempts']+=1;state.setdefault('attempt_history',[]).append({'attempt':state['attempts'],'passed':body['passed'],'total':body['total']});state['test_score']={'passed':body['passed'],'total':body['total']};state['status']='completed' if body['passed'] else 'connected';state['checkpoints'][0].update({'status':'passed' if body['passed'] else 'failed','attempts':state['attempts'],'lastOutput':body['stdout'],'evidence':'verified' if body['passed'] else 'not_verified'});events.append({'test_result':body});
   if state['attempts']==3 and state['challenge_id']!='python-arithmetic-add-v1':auto_assign()
   return self.respond({'ok':True,'state':state})
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
 assert 'v0.3.26' in frame.locator('.version').inner_text()
 # Real failed submissions trigger the fixture's automatic assignment response.
 for i in range(3):
  frame.locator('#submit').click();page.get_by_role('button',name='Run my Python code',exact=True).click();page.get_by_role('button',name='Run command',exact=True).click();time.sleep(1)
 frame.get_by_role('heading',name='Add two numbers - local QA',exact=True).wait_for(timeout=30000)
 assert frame.locator('#beginnerChoice').count()==0
 page.keyboard.press('Control+1');page.keyboard.press('Control+Home');page.keyboard.press('Control+a');page.keyboard.insert_text('a = int(input())\nb = int(input())\nprint(a + b)\n')
 frame.locator('#submit').click();page.get_by_role('button',name='Run my Python code',exact=True).click();page.get_by_role('button',name='Run command',exact=True).click();time.sleep(2)
 assert state['test_score']=={'passed':1,'total':1} and state['attempts']==1
 assert state['practice_history'][0]['state']['attempts']==3 and state['practice_history'][0]['state']['test_score']['passed']==0
 page.screenshot(path='/downloads/bml-auto-beginner-extension-passed.png')
 print('PASS exact installed0.3.26 real3fails, no choice, automatic response renders new question, real4case addition passes, prior3failures preserved')
 browser.close()
