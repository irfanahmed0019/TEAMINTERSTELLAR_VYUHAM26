"""Bounded local browser acceptance. No real account, cloud, AI or remote runner.
Requires Python playwright, python-docx, reportlab and local Chrome.
Includes actual Dashboard/Learn/Mentor routes and late-retune unmount negative.
Run from any directory: python scripts/verify-onboarding-browser.py
BML_QA_OUT selects evidence directory (default /tmp/bml-onboarding-qa).
BML_QA_UNMOUNT=1 checks stale delayed-bank completion after component unmount.
Auth/cloud/AI responses are explicit fixtures; coding uses actual API handler and
actual local Python behind a mock Judge0 transport. This is not live acceptance.
"""
import subprocess,time,urllib.request,json,os,socket
from pathlib import Path
from playwright.sync_api import sync_playwright
from docx import Document
from reportlab.pdfgen.canvas import Canvas
root=Path(__file__).resolve().parents[1];qa=root/'src/qa-onboarding-temp.tsx'
def free_port():
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));return sock.getsockname()[1]
web_port,api_port=free_port(),free_port()
out=Path(os.environ.get('BML_QA_OUT','/tmp/bml-onboarding-qa'));out.mkdir(parents=True,exist_ok=True)
if qa.exists() or (root/'scripts/qa-onboarding-api-temp.mjs').exists(): raise RuntimeError('Temporary QA files already exist; inspect them before continuing.')
text='QA Learner\nPython developer\nBuilt a small budget tracker using Python functions and conditions.\nClaims 1 year experience.\n'
Path(out/'onboarding-resume.txt').write_text(text);doc=Document();doc.add_paragraph(text);doc.save(out/'onboarding-resume.docx');c=Canvas(str(out/'onboarding-resume.pdf'));y=780
for line in text.splitlines():c.drawString(50,y,line);y-=22
c.save()
qa.write_text('''import React from 'react';import{createRoot}from'react-dom/client';import{createRootRoute,createRoute,createRouter,RouterProvider,Outlet}from'@tanstack/react-router';import{ConversationalOnboarding}from'./components/ConversationalOnboarding';import{Route as D}from'./routes/auth/dashboard';import{Route as L}from'./routes/learn';import{Route as M}from'./routes/mentor';import{InitialAssessmentEvidence}from'./components/struggle/InitialAssessmentEvidence';import{StruggleDNA}from'./components/struggle/StruggleDNA';import{getLoopState,setLoopState,normalizeLoopState}from'./lib/loop-store';import{competencyView,competencyContext}from'./lib/competency';import{priorityLearningTopics}from'./lib/adaptive-learning';import{initialAssessmentView}from'./lib/initial-assessment-view';import{restoreCloudState}from'./lib/cloud-restore';import{learningSchedule}from'./lib/learning-schedule';import{curatedPlan}from'./lib/curated-fallback';window.__schedule=()=>({schedule:learningSchedule(getLoopState().profile),fallback:curatedPlan(getLoopState().profile!)});window.__state=getLoopState;window.__set=setLoopState;window.__selectors=()=>({competency:competencyView(getLoopState()),context:competencyContext(getLoopState()),priority:[...priorityLearningTopics(getLoopState())]});window.__restore=async()=>{const saved=JSON.parse(localStorage.getItem('loop.state.v1')!);await restoreCloudState({read:async()=>saved,current:()=>true,normalize:normalizeLoopState,local:getLoopState,apply:s=>setLoopState(()=>s)});};const root=createRootRoute({component:()=> <><p style={{background:'#fff0b5',padding:12}}>LOCAL CONNECTED QA - mock auth/cloud and AI outputs. Actual components, local extraction, coding handler and local Python.</p><Outlet/></>});const dashboard=createRoute({getParentRoute:()=>root,path:'/auth/dashboard',component:D.options.component});const router=createRouter({routeTree:root.addChildren([createRoute({getParentRoute:()=>root,path:'/qa',component:ConversationalOnboarding}),createRoute({getParentRoute:()=>root,path:'/qa-dna',component:StruggleDNA}),dashboard,createRoute({getParentRoute:()=>root,path:'/learn',component:L.options.component}),createRoute({getParentRoute:()=>root,path:'/mentor',component:M.options.component})])});const qaRoot=createRoot(document.getElementById('qa')!);window.__navigate=router.navigate;window.__unmount=()=>qaRoot.unmount();qaRoot.render(<RouterProvider router={router}/>);''')
profile={'name':'Fixture','resumeText':'','resumeSummary':'','technologies':[],'goal':'','goalDetail':'','experience':'First time building','experienceDetail':'','startTime':'19:00','endTime':'21:00','repeatDaily':True,'followUps':[],'projectIdea':'','challenge':'Guide me'}
plan={'headline':'Fixture Python budget tracker','profileSummary':'Based on provisional checks','projectTitle':'Python budget tracker','projectPitch':'Use Python functions and conditions','quote':'Build and test','skills':[{'name':'Conditions','level':87,'note':'AI draft not verified'}],'missions':[{'id':'fixture-first','title':'Budget conditions','stack':'Python','difficulty':2,'minutes':20,'description':'Check spending against a limit','skills':['Conditions'],'steps':[{'title':'Read input','detail':'Use a value'}],'deliverable':'Tested condition'},{'id':'fixture-next','title':'Budget functions','stack':'Python','difficulty':3,'minutes':20,'description':'Extract a function','skills':['Functions'],'steps':[],'deliverable':'Function'}],'session':{'focus':'Conditions','tasks':[{'title':'Compare values','minutes':20}],'totalMinutes':20,'tip':'Run checks'},'progress':{'momentum':90,'weeklyGoal':'Build budget tracker','insights':['Claims need checks']}}
questions=[{'id':'diagnostic-'+str(i),'skill':'Conditions','kind':['concept','prediction','debugging','reasoning'][i%4],'difficulty':(i%3)+1,'prompt':'FIXTURE '+str(i)+' choose the matching expectation','options':['fixture correct '+str(i),'fixture wrong A '+str(i),'fixture wrong B '+str(i),'fixture unknown '+str(i)],'answer':0,'explanation':'Fixture answer key, not verified mastery.'} for i in range(12)]
mockjs='''window.__aiCalls=[];export async function aiAnalyzeResume({data}){window.__aiCalls.push({kind:'resume',data});return {name:'QA Learner',summary:'Claims Python budget tracker experience',technologies:[{name:'Python',level:'intermediate'}],languages:['Python'],projects:[{name:'Budget tracker',complexity:'small',technologies:['Python']}],experience:'Claims 1 year',competencyClaims:['Python conditions']}};export async function aiInitialDiagnostic({data}){window.__aiCalls.push({kind:'diagnostic',data});'''+"await new Promise(resolve=>window.__finishDiagnostic=resolve);return {questions:"+json.dumps(questions[:2])+"}};export async function aiGeneratePlan({data}){window.__aiCalls.push({kind:'plan',data});return "+json.dumps(plan)+"};"
import re
for name in re.findall(r'export const (\w+) =', (root/'src/lib/sarvam.functions.ts').read_text()):
 if name not in ['aiAnalyzeResume','aiInitialDiagnostic','aiGeneratePlan']:
  mockjs+='export async function '+name+'(args){window.__aiCalls.push({kind:'+json.dumps(name)+',data:args?.data});return '+ ('{message:"LOCAL QA fixture response"}' if name=='aiMentorChat' else 'await new Promise(r=>window.__finishRetune=()=>r({...window.__state().plan,headline:"STALE_RETUNE_SHOULD_NOT_WRITE"}))' if name=='aiRetunePlan' else '{}')+'};'
api_source=(root/'scripts/verify-initial-coding.mjs').read_text().split('\ntry {\n  const { curatedPlan }')[0]
api_source+="""\nconst { createServer: createHttpServer }=await import('node:http');const {handleMentorApi}=await vite.ssrLoadModule('/src/lib/mentor/mentor.api.server.ts');const server=createHttpServer(async(req,res)=>{let b='';for await(const x of req)b+=x;const r=await handleMentorApi(new Request('http://localhost/api/mentor/diagnostic',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer approved-fixture',origin:'http://localhost'},body:b}));res.writeHead(r.status,{'content-type':'application/json'});res.end(await r.text());});server.listen(8090,'127.0.0.1',()=>console.log('LOCAL_HANDLER_READY'));"""
api_source=api_source.replace("server.listen(8090,",f"server.listen({api_port},");(root/'scripts/qa-onboarding-api-temp.mjs').write_text(api_source)
api_log=open('/tmp/qa-onboarding-api.log','w');api=subprocess.Popen(['node','scripts/qa-onboarding-api-temp.mjs'],cwd=root,stdout=api_log,stderr=api_log)
log=open('/tmp/qa-onboarding-vite.log','w');p=subprocess.Popen(['node','node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',str(web_port),'--strictPort'],cwd=root,stdout=log,stderr=log)
try:
 for _ in range(100):
  try:urllib.request.urlopen(f'http://127.0.0.1:{web_port}');break
  except:time.sleep(.2)
 for _ in range(100):
  if 'LOCAL_HANDLER_READY' in Path('/tmp/qa-onboarding-api.log').read_text():break
  time.sleep(.2)
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':430,'height':1000},reduced_motion='reduce');page.on('pageerror',lambda e:print('PAGEERROR',e));page.on('console',lambda msg:print('BROWSER',msg.text[:500]) if msg.type=='error' and 'WebSocket' not in msg.text and '[vite]' not in msg.text else None)
  page.add_init_script("localStorage.setItem('loop.auth.v1',JSON.stringify({uid:'12345678-1234-1234-1234-123456789012',email:'fixture@example.invalid',displayName:'QA Learner',idToken:'approved-fixture',expiresAt:Date.now()+3600000}));window.__hydratedFixture=true")
  page.route('**/src/lib/cloud-sync.tsx',lambda r:r.fulfill(content_type='application/javascript',body='export function useCloudHydrated(){return true};export function CloudSync(){return null}'))
  page.route('**/src/lib/sarvam.functions.ts*',lambda r:r.fulfill(content_type='application/javascript',body=mockjs))
  def coding(r):
   data=r.request.post_data
   try:
    req=urllib.request.Request(f'http://127.0.0.1:{api_port}',data=data.encode(),headers={'content-type':'application/json'});resp=urllib.request.urlopen(req);r.fulfill(status=resp.status,content_type='application/json',body=resp.read().decode())
   except Exception as e:print('CODING_ERROR',e);raise
  page.route('**/api/mentor/diagnostic',coding)
  page.route(f'http://127.0.0.1:{web_port}/qa',lambda r:r.fulfill(content_type='text/html',body='<html><head><script type="module" src="/@vite/client"></script><link rel="stylesheet" href="/src/styles.css"></head><body></body></html>'))
  def mount():
   page.goto(f'http://127.0.0.1:{web_port}/qa');page.evaluate('''async()=>{const Refresh=(await import('/@react-refresh')).default;Refresh.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;document.body.innerHTML='<div id="qa"></div>';await import('/src/qa-onboarding-temp.tsx');}''')
  mount();page.get_by_text('Add your resume (optional)',exact=True).click()
  for extension in ['pdf','docx','txt']:
   page.get_by_label('Resume file',exact=True).set_input_files(str(out/('onboarding-resume.'+extension)));
   try:page.get_by_text('Text extracted on this device.',exact=False).wait_for()
   except Exception:
    print('EXTRACTION_FAILURE',extension,page.locator('body').inner_text());raise
   assert 'Python developer' in page.get_by_label('Resume text',exact=True).input_value(),extension;print('PASS actual local extraction',extension)
  page.get_by_label('Resume text',exact=True).fill(text+'Reviewed addition: no contact details.');page.get_by_role('button',name='Analyze reviewed resume').click();page.get_by_text('Added to your profile as unverified resume claims',exact=False).wait_for();assert page.evaluate("window.__state().profile.resumeClaims.provenance")== 'resume_claims_unverified'
  for answer in ['Learn Python and build a budget tracker','I know some basics, but I get stuck with conditions','Four hours weekly, focus on Python conditions']:
   page.locator('input[placeholder]').fill(answer);page.get_by_role('button',name='Send message',exact=True).click()
  page.get_by_role('heading',name="Everything's noted").wait_for();page.get_by_role('button',name='Prepare personalized diagnostic',exact=True).click();page.wait_for_function('typeof window.__finishDiagnostic==="function"')
  if os.environ.get('BML_QA_UNMOUNT')=='1':
   page.evaluate("window.__unmount();window.__set(s=>({...s,profile:{name:'NEW_PROFILE_SENTINEL'}}));window.__before=window.__state();window.__finishDiagnostic()");page.wait_for_timeout(150);assert page.evaluate('window.__state()===window.__before');print('PASS old diagnostic completion after unmount cannot overwrite profile');b.close();raise SystemExit(0)
  assert page.get_by_role('button',name='Start optional coding check',exact=True).is_disabled()
  page.evaluate('window.__finishDiagnostic()');page.get_by_text('Question 1 of 2',exact=False).wait_for()
  for i in range(2):page.get_by_role('button',name='fixture correct ',exact=False).first.click()
  page.get_by_text('Initial checks: 2/2 eligible',exact=False).wait_for()
  page.get_by_label('Coding concept',exact=True).select_option('conditions');page.get_by_role('button',name='Start optional coding check',exact=True).click()
  if os.environ.get('BML_QA_SCAFFOLD')=='1':
   page.clock.install();page.get_by_label('Initial coding program',exact=True).fill("# original transfer draft")
   for i in range(17):
    page.clock.run_for(29000);page.get_by_label('Initial coding program',exact=True).fill('# original transfer draft '+str(i))
   page.get_by_role('heading',name='Positive or not',exact=True).wait_for()
   snap=page.evaluate('window.__state()');d=snap['profile']['initialCodingDiagnostic'];assert len(d['scaffolds'])==1;assert len(d['submissions'])==0;assert len(snap.get('assessmentEvidence',[]))==0;assert 'original transfer draft' in d['scaffolds'][0]['draft']['code'];assert page.evaluate('window.__selectors().competency[0].observations')==2
   assert 'Simpler conditions task offered' in page.locator('body').inner_text();page.screenshot(path=str(out/'onboarding-timed-scaffold-local.png'),full_page=True)
   mount();page.get_by_role('heading',name='Positive or not',exact=True).wait_for();assert page.evaluate('window.__state().profile.initialCodingDiagnostic.scaffolds.length')==1
   page.get_by_role('button',name='Build roadmap from these checks',exact=True).click();page.wait_for_function('window.__state().onboarded===true');page.evaluate("window.__navigate({to:'/auth/dashboard'})");page.get_by_text('Evidence and next checks',exact=True).wait_for();assert 'Simpler conditions task offered' in page.locator('body').inner_text();page.screenshot(path=str(out/'onboarding-scaffold-dashboard-local.png'),full_page=True)
   page.evaluate("window.__navigate({to:'/learn'})");page.get_by_text('Your Learning Path',exact=True).wait_for();assert 'A simpler question was offered' in page.locator('body').inner_text();assert 'support signal' in page.evaluate('window.__selectors().context');assert len(page.evaluate('window.__state().profile.initialCodingDiagnostic.submissions'))==0
   page.evaluate("window.__navigate({to:'/qa-dna'})");page.get_by_role('heading',name='Struggle DNA',exact=True).wait_for();assert 'Simpler conditions task offered' in page.locator('body').inner_text();assert 'No initial coding evidence' in page.locator('body').inner_text() or 'No initial practical' in page.locator('body').inner_text() or page.evaluate('(window.__state().assessmentEvidence??[]).length===0');page.screenshot(path=str(out/'onboarding-scaffold-dna-local.png'),full_page=True)
   print('PASS actual component virtual focused/editing clock threshold -> automatic basic scaffold, preserved draft, zero fake grades, reload, Dashboard/Learn/context shared support');b.close();raise SystemExit(0)
  page.get_by_label('Initial coding program',exact=True).fill("print('wrong')");page.get_by_role('button',name='Submit this coding check',exact=True).click();page.get_by_text('1 of 2 coding submissions recorded.',exact=False).wait_for();assert page.evaluate('window.__state().assessmentEvidence.length')==1
  page.get_by_label('Initial coding program',exact=True).fill("n=int(input())\nprint('positive' if n>0 else 'zero' if n==0 else 'negative')");page.get_by_role('button',name='Submit this coding check',exact=True).click();page.get_by_text('2 of 2 coding submissions recorded.',exact=False).wait_for()
  snap=page.evaluate('window.__state()');assert len(snap['profile']['initialCodingDiagnostic']['submissions'])==2;assert len(snap['assessmentEvidence'])==2;assert len(snap['profile']['initialDiagnostic']['answers'])==2
  page.screenshot(path=str(out/'onboarding-connected-checks-local.png'),full_page=True)
  mount();page.get_by_text('Initial checks: 2/2 eligible',exact=False).wait_for();assert page.evaluate('window.__state().assessmentEvidence.length')==2;page.get_by_role('button',name='Build roadmap from these checks',exact=True).click();page.wait_for_function('window.__state().onboarded===true');snap=page.evaluate('window.__state()');assert snap['plan']['skills'][0]['level']==0;assert snap['missionProgress']['fixture-first']['status']=='active';assert snap['missionProgress']['fixture-next']['status']=='locked';assert len(snap['assessmentEvidence'])==2;calls=page.evaluate('window.__aiCalls');planinput=[c['data']['profile'] for c in calls if c['kind']=='plan'][0];assert len(planinput['initialCodingDiagnostic']['submissions'])==2;assert len(planinput['initialDiagnostic']['answers'])==2;assert planinput['resumeClaims']['provenance']=='resume_claims_unverified';assert 'Python' in planinput['goalDetail'];assert planinput['scheduleUnspecified'] is True;assert planinput['startTime']=='' and planinput['endTime']=='' and planinput['repeatDaily'] is False;assert 'Four hours weekly' in planinput['availabilityText'];schedule=page.evaluate('window.__schedule()');assert 'No exact daily' in schedule['schedule']['brief'];assert schedule['fallback']['session']['totalMinutes']==30;assert 'every day' not in schedule['fallback']['progress']['weeklyGoal'];assert page.get_by_text('No daily window is set.',exact=False).count()>0;assert page.get_by_text('Block 19:00',exact=False).count()==0;page.screenshot(path=str(out/'onboarding-schedule-reveal-local.png'),full_page=True);selectors=page.evaluate('window.__selectors()');assert 'server-graded initial coding tests' in json.dumps(selectors);page.evaluate('window.__restore()');assert page.evaluate('window.__state().assessmentEvidence.length')==2
  (out/'onboarding-connected-report.json').write_text(json.dumps({'mock_boundaries':['auth','cloud storage read','AI outputs'],'state':snap,'selectors':selectors},indent=2));print('PASS ONE actual browser component journey extraction/review/chat/2shortMCQ+2realhandlerPythoncoding/submissionevidence/restore/AIplaninput/progress0baseline/sharedselectors/persistence')
  page.evaluate("import('/src/lib/demo-mode.ts').then(m=>m.learnerStorage.setItem('bml-vscode-session',JSON.stringify({sessionId:'qa-session'})))")
  observed=[]
  def session_response(r):
   observed.append(r.request.headers.get('authorization'));r.fulfill(status=401 if not r.request.headers.get('authorization') else 200,content_type='application/json',body='{"ok":false}')
  page.route('**/api/sessions/qa-session/state',session_response)
  page.evaluate("window.__navigate({to:'/auth/dashboard'})");page.wait_for_timeout(1200);assert 'Evidence and next checks' in page.locator('body').inner_text();page.wait_for_timeout(300);assert observed and observed[0]=='Bearer approved-fixture',observed
  assert 'Four hours weekly' in page.locator('body').inner_text();assert 'No daily window is set' in page.locator('body').inner_text();page.screenshot(path=str(out/'onboarding-real-dashboard-local.png'),full_page=True)
  page.evaluate("window.__navigate({to:'/learn'})");page.wait_for_timeout(1000);assert 'Priority: recent difficulty' in page.locator('body').inner_text();assert 'if / else Conditions' in page.locator('body').inner_text();assert page.evaluate('window.__state().assessmentEvidence.length')==2;page.screenshot(path=str(out/'onboarding-real-learn-local.png'),full_page=True)
  page.evaluate("window.__navigate({to:'/mentor'})");page.get_by_placeholder('Ask anything about your learning, project or skills…').wait_for();page.get_by_placeholder('Ask anything about your learning, project or skills…').fill('What should I practice based on my checks?');page.get_by_role('button',name='Send message',exact=True).click();page.wait_for_function("window.__aiCalls.some(x=>x.kind==='aiMentorChat')");call=page.evaluate("window.__aiCalls.find(x=>x.kind==='aiMentorChat')");assert 'server-graded initial coding tests' in call['data']['competencyContext'] and 'n=4' in call['data']['competencyContext'],call;page.get_by_text('LOCAL QA fixture response',exact=True).wait_for();page.screenshot(path=str(out/'onboarding-real-mentor-local.png'),full_page=True);print('PASS actual Dashboard bearer polling + truthful availability; actual Learn persisted evidence; actual Mentor chat receives same initial coding evidence context. Explicit mocked identity/cloud/AI/network.')
  # Real Dashboard effect must not apply a delayed retune after route unmount.
  remote={'session_id':'qa-session','challenge_id':'fixture-first','title':'Budget conditions','language':'Python','concept':'conditions','status':'completed','attempts':1,'hints_used':0,'test_score':{'passed':3,'total':3},'verified_owner_id':'12345678-1234-1234-1234-123456789012'}
  page.unroute('**/api/sessions/qa-session/state');page.route('**/api/sessions/qa-session/state',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'state':remote})))
  page.evaluate("window.__navigate({to:'/auth/dashboard'})");page.wait_for_function('typeof window.__finishRetune==="function"');page.evaluate("window.__navigate({to:'/learn'})");page.get_by_text('Your Learning Path',exact=True).wait_for();before=page.evaluate('JSON.stringify(window.__state())');page.evaluate('window.__finishRetune()');page.wait_for_timeout(150);assert page.evaluate('JSON.stringify(window.__state())')==before;print('PASS actual Dashboard late AI retune after unmount cannot overwrite current shared state')
  b.close()
finally:
 p.terminate();p.wait(timeout=10);api.terminate();api.wait(timeout=10);qa.unlink(missing_ok=True);(root/'scripts/qa-onboarding-api-temp.mjs').unlink(missing_ok=True)
