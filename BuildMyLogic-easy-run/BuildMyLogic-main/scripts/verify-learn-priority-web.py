import subprocess,time,json,os,urllib.request,atexit
from playwright.sync_api import sync_playwright
from pathlib import Path
R=str(Path(__file__).resolve().parent.parent);PORT=5398;DB=54398
uid='123e4567-e89b-42d3-a456-426614174000';other='223e4567-e89b-42d3-a456-426614174000'
base={'onboarded':True,'profile':{'name':'QA Learner','fullName':'QA Learner','goal':'learn'},'plan':{'projectTitle':'Python adaptive Learn QA','projectPitch':'Synthetic browser fixture','headline':'QA','skills':[{'name':'Conditions','level':90},{'name':'React','level':90}],'missions':[{'id':'m1','title':'Unrelated roadmap','description':'Synthetic','difficulty':1,'minutes':10,'skills':[],'steps':[{'title':'Unrelated step','detail':'Do not credit practice here'}],'deliverable':'Local'}]},'missionProgress':{'m1':{'status':'active','completedSteps':[]}},'sessions':[],'activity':[]}
base['struggle']={'attempts':[{'id':'loop-pass','topicId':'loops','passed':4,'total':4,'at':1794840000000,'kind':'code'},{'id':'cond-fail1','topicId':'conditions','passed':0,'total':4,'at':1794840001000,'kind':'code'},{'id':'cond-fail2','topicId':'conditions','passed':1,'total':4,'at':1794840002000,'kind':'code'}],'misconceptions':[]}
cloud={uid:base,other:dict(base,profile={'name':'OTHER QA','fullName':'OTHER QA'})};writes=[];save_calls=0;failures=int(os.environ.get('BML_QA_SAVE_FAILURES','1'))
task='python-conditions-sign-v1';marker='BML_PRACTICE_PASS:'+task
remote={'session_id':'BML-EXIST','challenge_id':task,'title':'Conditions practice','concept':'conditions','language':'Python','status':'connected','extension_status':'connected','connection_status':'connected','evidence_provenance':'extension-reported','verified_owner_id':uid,'attempts':2,'hints_used':0,'task_generation':0,'test_score':{'passed':0,'total':1},'checkpoints':[{'title':'Conditions practice','status':'failed','evaluator':{'id':task,'command':'buildmylogic:'+task,'expectedOutputIncludes':[marker]}}],'attempt_history':[{'attempt':i+1,'at':1794840000000+i,'passed':0,'total':1,'checkpoints':[{'title':'Conditions practice','status':'failed','lastOutput':'Expected negative for -7, received positive'}]} for i in range(2)]}
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
  if '/api/mentor/run' in r.request.url:
   data=r.request.post_data_json;items=[]
   for stdin in data['stdins']:
    run=subprocess.run(['python3','-I','-c',data['code']],input=stdin,capture_output=True,text=True,timeout=3)
    items.append({'statusId':3 if run.returncode==0 else 11,'status':'Accepted' if run.returncode==0 else 'Runtime Error','stdout':run.stdout,'stderr':run.stderr,'compileOutput':'','timeSec':None})
   return r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'items':items,'sandbox':'actual isolated local Python QA'}))
  if r.request.url.endswith('/conquest'):return r.fulfill(status=200,content_type='application/json',body='{"ok":true}')
  if r.request.url.endswith('/api/app-version'):return r.fulfill(status=200,content_type='application/json',body='{}')
  if r.request.url.endswith('/state'):return r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'state':remote}))
  raise Exception('Unexpected API '+r.request.url)
 ctx.route(f'http://127.0.0.1:{PORT}/api/**',api)
 pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(f'http://127.0.0.1:{PORT}/')
 def install_auth(u,session=True):
  pg.evaluate('''([u,t,session])=>{localStorage.setItem('loop.auth.v1',JSON.stringify({uid:u,email:t.user.email,displayName:'QA',expiresAt:4102444800000}));localStorage.setItem('sb-127-auth-token',JSON.stringify(t));if(session)localStorage.setItem('bml-vscode-session',JSON.stringify({sessionId:'BML-EXIST',status:'connected',userId:u}));}''',[u,token(u),session])
 pg.wait_for_timeout(1500)
 install_auth(uid,False);pg.goto(f'http://127.0.0.1:{PORT}/learn')
 focus=pg.get_by_role('region',name='Recommended topic lessons')
 focus.wait_for(timeout=20000)
 assert 'if / else Conditions' in focus.inner_text()
 assert 'Loops' not in focus.inner_text()
 before=pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1')).struggle.attempts")
 assert len(before)==3
 href=focus.get_by_role('link').get_attribute('href');assert href.startswith('https://www.youtube.com/watch?v=')
 pg.evaluate("document.title='ISOLATED QA - mocked auth/cloud, no real learner or AI'; const n=document.createElement('div');n.textContent='ISOLATED QA: controlled loops PASS + conditions FAIL evidence; mock auth/cloud; no real learner account';n.style='position:fixed;top:0;left:0;right:0;z-index:99999;background:#172554;color:white;text-align:center;font:12px sans-serif;padding:5px';document.body.append(n)")
 focus.scroll_into_view_if_needed();pg.screenshot(path='/downloads/learn-weak-topic-qa.png')
 focus.get_by_role('button',name='Open if / else Conditions lesson').click()
 pg.get_by_role('heading',name='Notes - if / else Conditions in Python',exact=True).wait_for()
 lessonlink=pg.get_by_role('link',name='Open on YouTube',exact=False)
 print('YT_LINKS',pg.locator('a[href*=youtube]').evaluate_all('(els)=>els.map(e=>({text:e.textContent,href:e.href}))'))
 assert pg.locator('a[href="'+href+'"]').count()>=1
 after=pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1')).struggle.attempts")
 assert before==after
 pg.screenshot(path='/downloads/learn-conditions-lesson-qa.png')
 pg.locator('a[href="'+href+'"]').scroll_into_view_if_needed();pg.screenshot(path='/downloads/learn-conditions-video-qa.png')
 assert errors==[],errors
 print('PASS actual Learn route: loops PASS preserved, 2 conditions failures -> conditions recommendation + exact catalog YouTube link -> matching Python notes/video lesson; 3 attempts unchanged; zero runtime errors. Controlled mock auth/cloud, no paid AI or external video playback.')
 b.close()
vite.terminate()
