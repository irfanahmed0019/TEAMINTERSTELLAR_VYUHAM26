"""Actual CameraVideo final-partial-section regression, with explicit local fixtures.
Requires Python Playwright and Chrome. No real identity, AI, cloud, camera or YouTube.
BML_QA_SAMPLE_MS=333, 1000 or 2000 controls simulated observed sampling cadence.
"""
import subprocess,time,json,os,urllib.request,socket
from pathlib import Path
from playwright.sync_api import sync_playwright
R=str(Path(__file__).resolve().parents[1]);sock=socket.socket();sock.bind(('127.0.0.1',0));PORT=sock.getsockname()[1];sock.close()
Path('/tmp/h').mkdir(exist_ok=True)
env=dict(os.environ,VITE_SUPABASE_URL='http://127.0.0.1:54399',VITE_SUPABASE_ANON_KEY='x'*40)
vite=subprocess.Popen(['node','node_modules/vite/bin/vite.js','--port',str(PORT),'--strictPort','--host','127.0.0.1'],cwd=R,env=env,stdout=open('/tmp/h/vite2.log','w'),stderr=subprocess.STDOUT)
for _ in range(60):
    try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/',timeout=1);break
    except Exception: time.sleep(1)
INIT='''
window.__now=1800000000000; Date.now=()=>window.__now; window.__yt=[]; window.__present=true; window.__det=0; window.__dur=window.__dur||600;
window.YT={Player:class{
 constructor(el,o){this.pl=false;this.base=0;this.t0=window.__now;window.__player=this;window.__yt.push({e:'new',v:o.videoId});setTimeout(()=>o.events.onReady(),50)}
 pos(){return Math.min(window.__dur,this.base+(this.pl?(window.__now-this.t0)/1000:0))}
 playVideo(){if(!this.pl){this.base=this.pos();this.t0=window.__now;this.pl=true;window.__yt.push({e:'play'})}}
 pauseVideo(){if(this.pl){this.base=this.pos();this.pl=false;window.__yt.push({e:'pause'})}}
 seekTo(s){this.base=s;this.t0=window.__now;window.__yt.push({e:'seek',v:s})}
 getCurrentTime(){return this.pos()} getDuration(){return window.__dur} getPlayerState(){return (this.pl&&this.pos()>=window.__dur)?0:(this.pl?1:2)} destroy(){}
}};'''
FACE='''export const nets={tinyFaceDetector:{loadFromUri:async()=>{}}};
export class TinyFaceDetectorOptions{constructor(o){this.o=o}}
export async function detectSingleFace(){window.__det++;return window.__present?{score:1}:undefined}
export default {nets,TinyFaceDetectorOptions,detectSingleFace};'''
out=[]
def check(n,ok,d=''):
    out.append((n,bool(ok),d));print('PASS' if ok else 'FAIL',n,d,flush=True)
def sb(owner):
    return "localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'a.b.c',token_type:'bearer',expires_in:36000,expires_at:4102444800,refresh_token:'r',user:{id:'%s',aud:'authenticated',email:'qa@example.test',user_metadata:{full_name:'QA'},app_metadata:{},created_at:'2026-01-01T00:00:00Z'}}))"%owner
def new(p,owner='qa-owner-1',dur=600,state=None,uidkey=None,deny=False):
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--no-sandbox'])
    ctx=b.new_context(permissions=['camera'],viewport={'width':1100,'height':900})
    st=json.dumps(state or {'onboarded':True})
    ctx.add_init_script(f"window.__dur={dur};")
    ctx.add_init_script(INIT)
    ctx.add_init_script(sb(owner))
    ctx.add_init_script(f"if(!localStorage.getItem('loop.state.v1')){{localStorage.setItem('loop.state.v1',{json.dumps(st)});localStorage.setItem('loop.state.uid','{uidkey or owner}')}}")
    if deny: ctx.add_init_script("navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'))")
    ctx.route('**/*face-api*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=FACE))
    ctx.route('http://127.0.0.1:54399/**',lambda r:r.fulfill(status=200,content_type='application/json',body='null' if 'learner_memory' in r.request.url and r.request.method=='GET' else '[]'))
    ctx.route('**/iframe_api',lambda r:r.fulfill(status=200,content_type='application/javascript',body=''))
    pg=ctx.new_page();pg.goto(f'http://127.0.0.1:{PORT}/videos')
    pg.wait_for_function("!document.querySelector('button.btn-primary-solid')?.disabled",timeout=60000)
    return b,pg
def ev(pg,js):return pg.evaluate(js)
def tick(pg,dt,present=True,usedet=True):
    if usedet:
        ev(pg,f"window.__present={str(present).lower()};window.__now+={dt};window.__tick=window.__det")
        pg.wait_for_function("window.__det>window.__tick",timeout=5000)
    else:
        ev(pg,f"window.__now+={dt};window.__t0=window.__yt.length")
        time.sleep(0.45)
    time.sleep(0.12)
def gate(pg):return pg.locator('section[aria-label="Section checkpoint"]').count()==1
def to_gate(pg,dt=2000,usedet=True,max=200):
    n=0
    while n<max and not gate(pg): tick(pg,dt,True,usedet);n+=1
    return n
def status(pg):return pg.get_by_test_id('presence-status').inner_text()
def answer(pg,idx):
    pg.locator('section[aria-label="Section checkpoint"] button').nth(idx).click();time.sleep(0.3)
def yt(pg):return ev(pg,"window.__yt")
try:
 with sync_playwright() as p:
     prog={'onboarded':True,'videoProgress':{'rfscVS0vtbw':{'ownerId':'qa-owner-1','completed':[1,2],'results':[],'updatedAt':1}}}
     b,pg=new(p,dur=250,state=prog)
     pg.click('text=Start with camera');pg.wait_for_function("window.__player",timeout=30000)
     for _ in range(3):tick(pg,1000)
     n=0
     while n<80 and not gate(pg):
         tick(pg,int(os.environ.get("BML_QA_SAMPLE_MS","1000")));n+=1
     h=pg.locator('section[aria-label="Section checkpoint"] h3').inner_text() if gate(pg) else ''
     check('final partial section (240-250s) gate appears at video end with bounded sampling',gate(pg) and 'Section 3' in h and abs(ev(pg,"window.__player.base")-250)<0.6,f'{h} base={ev(pg,"window.__player.base")} ticks={n}')
     pg.evaluate("(()=>{const p=document.createElement('p');p.textContent='LOCAL QA - simulated camera, face model, player, identity and cloud';p.style='background:#fff0b5;padding:12px';document.body.prepend(p)})()");pg.screenshot(path='/tmp/h/06-final.png')
     if gate(pg):
         answer(pg,2)
         check('final checkpoint saved, 3 of 3 sections',not gate(pg),pg.get_by_test_id('video-section').inner_text()+' | '+status(pg))
         st=json.loads(ev(pg,"localStorage.getItem('loop.state.v1')"))['videoProgress']['rfscVS0vtbw']
         check('completed [1,2,3] persisted',st['completed']==[1,2,3],str(st['completed']))
     b.close()
finally:
 vite.terminate();vite.wait(timeout=10)
json.dump(out,open('/tmp/h/results2c.json','w'));print(sum(o[1] for o in out),'/',len(out))

assert out and all(item[1] for item in out), out
