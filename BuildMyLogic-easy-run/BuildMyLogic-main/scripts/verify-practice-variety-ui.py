import subprocess,time,json,os,urllib.request,atexit
from playwright.sync_api import sync_playwright
from pathlib import Path
R=str(Path(__file__).resolve().parent.parent);PORT=5398;DB=54398
uid='123e4567-e89b-42d3-a456-426614174000';other='223e4567-e89b-42d3-a456-426614174000'
base={'onboarded':True,'profile':{'name':'QA Learner','fullName':'QA Learner','goal':'learn'},'plan':{'projectTitle':'Practice sync QA','projectPitch':'Synthetic browser fixture','headline':'QA','skills':[{'name':'Conditions','level':90},{'name':'React','level':90}],'missions':[{'id':'m1','title':'Unrelated roadmap','description':'Synthetic','difficulty':1,'minutes':10,'skills':[],'steps':[{'title':'Unrelated step','detail':'Do not credit practice here'}],'deliverable':'Local'}]},'missionProgress':{'m1':{'status':'active','completedSteps':[]}},'sessions':[],'activity':[]}
cloud={uid:base,other:dict(base,profile={'name':'OTHER QA','fullName':'OTHER QA'})};writes=[];save_calls=0;failures=0
task='python-conditions-sign-v1';marker='BML_PRACTICE_PASS:'+task
states=json.load(open(os.environ.get('BML_VARIETY_STATES','/tmp/bml-variety-states.json')));remote=states[0];selection_requests=[]
env=dict(os.environ,VITE_SUPABASE_URL=f'http://127.0.0.1:{DB}',VITE_SUPABASE_ANON_KEY='x'*40)
vite=subprocess.Popen(['node','node_modules/vite/bin/vite.js','--port',str(PORT),'--strictPort','--host','127.0.0.1'],cwd=R,env=env,stdout=open('/tmp/bml-practice-sync-vite.log','w'),stderr=subprocess.STDOUT);atexit.register(vite.terminate)
for _ in range(60):
 try:urllib.request.urlopen(f'http://127.0.0.1:{PORT}/',timeout=1);break
 except Exception:time.sleep(.5)
def user(u):return {'id':u,'aud':'authenticated','email':('qa' if u==uid else 'other')+'@example.test','user_metadata':{'full_name':'QA'},'app_metadata':{},'created_at':'2026-01-01T00:00:00Z'}
def token(u):return {'access_token':'token-'+u,'token_type':'bearer','expires_in':36000,'expires_at':4102444800,'refresh_token':'r-'+u,'user':user(u)}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1440,'height':1000});active={'uid':uid};errors=[]
 def route_db(r):
  global save_calls
  u=active['uid'];url=r.request.url
  print('DB',r.request.method,url,'CLOUD',len(cloud[u].get('struggle',{}).get('attempts',[])),flush=True)
  if 'auth/v1/token' in url:return r.fulfill(status=200,content_type='application/json',body=json.dumps(token(u)))
  if 'auth/v1/user' in url:return r.fulfill(status=200,content_type='application/json',body=json.dumps(user(u)))
  if 'auth/v1/logout' in url:return r.fulfill(status=204,body='')
  if 'learner_memory' in url:
   if r.request.method=='GET':return r.fulfill(status=200,content_type='application/json',body=json.dumps({'state_json':cloud[u]}))
   save_calls+=1
   if save_calls<=failures:return r.fulfill(status=503,content_type='application/json',body='{"message":"fixture transient save failure"}')
   data=r.request.post_data_json
   if isinstance(data,list):data=data[0]
   assert data['user_id']==u
   cloud[u]=data['state_json'];writes.append((u,len(cloud[u].get('struggle',{}).get('attempts',[]))))
   return r.fulfill(status=200,content_type='application/json',body='{}')
  return r.fulfill(status=200,content_type='application/json',body='[]')
 ctx.route(f'http://127.0.0.1:{DB}/**',route_db)
 def api(r):
  global remote
  url=r.request.url
  if url.endswith('/api/app-version'):return r.fulfill(status=200,content_type='application/json',body='{}')
  if url.endswith('/practice-task'):
   body=r.request.post_data_json
   assert body['practice_topic']=='conditions'
   assert body['previous_challenge']==remote['challenge_id']
   assert body['task_generation']==remote.get('task_generation',0)
   selection_requests.append(body);remote=states[len(selection_requests)]
   return r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'session_id':remote['session_id'],'state':remote}))
  if url.endswith('/state'):return r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'state':remote}))
  raise Exception('Unexpected API '+url)
 ctx.route(f'http://127.0.0.1:{PORT}/api/**',api)
 pg=ctx.new_page();pg.on('console',lambda m:print('CONSOLE',m.type,m.text,flush=True) if m.type=='error' else None);pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(f'http://127.0.0.1:{PORT}/')
 def install_auth(u,session=True):
  pg.evaluate('''([u,t,session])=>{localStorage.setItem('loop.auth.v1',JSON.stringify({uid:u,email:t.user.email,displayName:'QA',expiresAt:4102444800000}));localStorage.setItem('sb-127-auth-token',JSON.stringify(t));if(session)localStorage.setItem('bml-vscode-session',JSON.stringify({sessionId:'BML-EXIST',status:'connected',userId:u}));}''',[u,token(u),session])
 install_auth(uid,False);pg.evaluate("r=>localStorage.setItem('bml-vscode-session',JSON.stringify({sessionId:r.session_id,status:'connected',userId:r.verified_owner_id}))",remote);pg.goto(f'http://127.0.0.1:{PORT}/sessions')

 pg.get_by_role('button',name='Next different conditions question',exact=True).wait_for()
 pg.on('dialog',lambda d:d.accept())
 for n,expected in enumerate(['Voting age','Pass or retry']):
  pg.get_by_role('button',name='Next different conditions question',exact=True).click()
  pg.get_by_text(expected,exact=True).first.wait_for()
  pg.wait_for_timeout(500)
  assert len(selection_requests)==n+1
 pg.get_by_text('Current question: Pass or retry',exact=True).scroll_into_view_if_needed()
 pg.screenshot(path='/downloads/bml-variety-sessions.png')
 print('PASS actual UI same-topic Next sends currentgeneration, displays genuinely different vote/pass router snapshots; history visible',flush=True)
 proof=dict(states[0],verified_owner_id=uid,evidence_provenance='extension-reported',attempts=2,attempt_history=[{'attempt':i+1,'at':1794840000000+i,'passed':0,'total':1,'checkpoints':[{'title':'Conditions practice','status':'failed','lastOutput':'wrong conditions branch'}]} for i in range(2)])
 pg.evaluate("async ([r,u])=>{const s=await import('/src/lib/loop-store.ts');s.applyBuildSessionEvidence(r,u)}",[proof,uid])
 assert pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1')).struggle.attempts.length")==2
 pg.wait_for_timeout(1000)
 pg.goto(f'http://127.0.0.1:{PORT}/auth/dashboard');pg.get_by_text('Current Task',exact=True).wait_for()
 assert 'Evidence and next checks' not in pg.locator('body').inner_text()
 assert 'Your Progress' in pg.locator('body').inner_text()
 assert 'Unrelated roadmap' in pg.locator('body').inner_text()
 assert pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1')).struggle.attempts.length")==2
 pg.screenshot(path='/downloads/bml-dashboard-no-evidence.png')
 assert pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1')).plan.projectTitle")=='Practice sync QA'
 print('PASS dashboardrequestedsectionabsent,currenttask/progressintact,persistedplanunchanged',flush=True)
 pg.goto(f'http://127.0.0.1:{PORT}/progress');pg.get_by_text('Assessed competency estimate',exact=True).wait_for(timeout=5000)
 assert 'Not assessed' not in pg.get_by_text('Assessed competency estimate',exact=True).locator('..').inner_text()
 assert '2' in pg.get_by_text('Checked attempts',exact=True).locator('..').inner_text()
 pg.screenshot(path='/downloads/bml-progress-graded.png')
 pg.get_by_role('button',name='Struggle DNA',exact=True).click(timeout=5000);pg.wait_for_timeout(300)
 pg.screenshot(path='/downloads/bml-struggle-graded.png')
 pg.goto(f'http://127.0.0.1:{PORT}/learn');pg.get_by_role('region',name='Recommended topic lessons').wait_for(timeout=5000)
 pg.screenshot(path='/downloads/bml-learn-connected.png')
 pg.reload();pg.wait_for_timeout(600)
 assert pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1')).struggle.attempts.length")==2
 assert pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1')).missionProgress.m1.status")=='active'
 print('PASS one checked fail pipeline updates Progress/Struggle/Learn, refresh replay stays 2 receipts and no project credit',flush=True)
 assert errors==[],errors
 print('PASS ZERO runtime/hydration errors; controlled auth/cloud; actualrouter-produced task snapshots, no AI',flush=True)
 b.close()
vite.terminate()
