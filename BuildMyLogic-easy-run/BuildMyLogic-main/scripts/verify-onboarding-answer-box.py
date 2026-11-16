import subprocess,time,json,os,urllib.request,atexit
from playwright.sync_api import sync_playwright
from pathlib import Path
R=str(Path(__file__).resolve().parent.parent);PORT=5400;DB=54400
uid='123e4567-e89b-42d3-a456-426614174000';other='223e4567-e89b-42d3-a456-426614174000'
base={'onboarded':True,'profile':{'name':'QA Learner','fullName':'QA Learner','goal':'learn'},'plan':{'projectTitle':'Python adaptive Learn QA','projectPitch':'Synthetic browser fixture','headline':'QA','skills':[{'name':'Conditions','level':90},{'name':'React','level':90}],'missions':[{'id':'m1','title':'Unrelated roadmap','description':'Synthetic','difficulty':1,'minutes':10,'skills':[],'steps':[{'title':'Unrelated step','detail':'Do not credit practice here'}],'deliverable':'Local'}]},'missionProgress':{'m1':{'status':'active','completedSteps':[]}},'sessions':[],'activity':[]}
fixtures=json.loads(subprocess.check_output(['node','--experimental-strip-types','scripts/recheck-count-fixtures.mjs'],cwd=R,text=True))
base.update(fixtures[1]);base['profile'].update({'technologies':[{'name':'C','level':'beginner'}],'goalDetail':'Build for a career','experience':'First time building','experienceDetail':'','resumeText':'Reported C','resumeSummary':'Lists C','followUps':[],'projectIdea':'C calculator','challenge':'Guide me','startTime':'','endTime':'','scheduleUnspecified':True,'repeatDaily':False})
base['onboarded']=False;base['profile']['followUps']=[{'question':'What would you like to learn or build? Tell me your goal in your own words.','answer':'Learn Python and build a project'}]
cloud={uid:base,other:dict(base,profile={'name':'OTHER QA','fullName':'OTHER QA'})};writes=[];save_calls=0;failures=0
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
 pg=ctx.new_page();pg.set_default_timeout(7000);pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(f'http://127.0.0.1:{PORT}/')
 pg.evaluate('''([u,t])=>{localStorage.setItem('loop.auth.v1',JSON.stringify({uid:u,email:t.user.email,displayName:'QA',expiresAt:4102444800000}));localStorage.setItem('sb-127-auth-token',JSON.stringify(t));}''',[uid,token(uid)])
 pg.goto(f'http://127.0.0.1:{PORT}/')
 answer=pg.get_by_role('textbox',name='Your answer',exact=True)
 answer.wait_for()
 assert answer.input_value()==''
 assert answer.get_attribute('placeholder')=='Type your answer…'
 pg.get_by_text('Learn Python and build a project',exact=True).wait_for()
 pg.get_by_text('What have you tried',exact=False).wait_for()
 before=pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1'))")
 answer.fill('I know variables but loops confuse me')
 # Changing an unrelated local preference must not clear the typed answer.
 pg.get_by_label('Target job',exact=True).select_option('Frontend developer')
 assert answer.input_value()=='I know variables but loops confuse me'
 pg.get_by_role('button',name='Send message',exact=True).click()
 assert answer.input_value()==''
 assert answer.get_attribute('placeholder')=='Type your answer…'
 pg.get_by_text('I know variables but loops confuse me',exact=True).wait_for()
 pg.get_by_text('How much time can you realistically spend each week?',exact=False).wait_for()
 after=pg.evaluate("JSON.parse(localStorage.getItem('loop.state.v1'))")
 assert after['profile']['resumeText']==before['profile']['resumeText']
 assert after['profile']['resumeSummary']==before['profile']['resumeSummary']
 assert after['profile']['followUps'][0]==before['profile']['followUps'][0]
 assert after['profile']['followUps'][1]['answer']=='I know variables but loops confuse me'
 pg.get_by_role('textbox',name='Your answer',exact=True).scroll_into_view_if_needed()
 pg.screenshot(path='/downloads/bml-onboarding-answer-box.png')
 pg.wait_for_timeout(1700)
 pg.reload();answer=pg.get_by_role('textbox',name='Your answer',exact=True);answer.wait_for()
 assert answer.input_value()=='' and answer.get_attribute('placeholder')=='Type your answer…'
 pg.get_by_text('I know variables but loops confuse me',exact=True).wait_for()
 assert errors==[],errors
 print('PASS real onboarding UI: restored question remains in Mentor bubble, answer box empty/short placeholder; typed answer survives unrelated choice; send/next blank; resume/earlier answers retained on refresh; no AI calls')
 b.close()
vite.terminate()
