import type { LoopState, Plan } from "./loop-types";
export type CompetencyView = { skill: string; estimate: number | null; previous: number | null; confidence: "none" | "low" | "moderate"; observations: number; history: Array<{id:string;at:number;score:number;source:string}>; recentPerformance: string; trend: "insufficient" | "improving" | "declining" | "stable"; lastAssessment: number | null; evidenceSources: string[]; difficulties: string[]; recommendedDifficulty: "beginner" | "intermediate" | "advanced"; reason: string };
const norm = (s: string) => s.trim().toLowerCase();
/** One derived view over the existing learner history. Does not mutate or promote legacy/AI claims. */
export function competencyView(state: LoopState): CompetencyView[] {
  const names = new Map<string,string>();
  for (const s of state.plan?.skills ?? []) names.set(norm(s.name),s.name);
  const histories = new Map<string,CompetencyView["history"]>();
  const add = (skill:string,item:CompetencyView["history"][number]) => { const key=norm(skill); if(!key || !Number.isFinite(item.at)||!Number.isFinite(item.score))return;names.set(key,names.get(key)||skill);const list=histories.get(key)??[];if(!list.some(x=>x.id===item.id)) list.push(item);histories.set(key,list); };
  // Explicit sample provenance is preserved: never present it as genuine work.
  if (!state.sampleProvenance) {
    for(const a of state.struggle?.attempts ?? []) if(!a.synthetic && a.total>0) add(a.topicTitle,{id:a.id,at:a.at,score:Math.max(0,Math.min(100,100*a.passed/a.total)),source:a.source==='vscode'?'extension-reported tests':a.source==='reassessment'?'targeted reassessment':'practice tests'});
    for(const a of state.profile?.initialDiagnostic?.answers ?? []) add(a.question.skill,{id:a.question.id+':'+a.at,at:a.at,score:a.correct?100:0,source:'AI-keyed client diagnostic'});
  }
  return [...names].map(([key,skill])=>{
    const history=(histories.get(key)??[]).sort((a,b)=>a.at-b.at).slice(-60);
    let estimate:number|null=null,previous:number|null=null;
    for(const h of history){previous=estimate;const weight=h.source==='AI-keyed client diagnostic'?.12:.2;estimate=estimate===null?50+(h.score-50)*weight:estimate+(h.score-estimate)*weight;}
    const recent=history.slice(-3), failed=recent.filter(h=>h.score<100).length, successful=recent.length===3&&recent.every(h=>h.score===100&&h.source!=='AI-keyed client diagnostic');
    const trend=history.length<3?'insufficient':(estimate??0)-(previous??estimate??0)>1?'improving':(estimate??0)-(previous??estimate??0)<-1?'declining':'stable';
    const n=history.length;const diagnosticOnly=history.every(h=>h.source==='AI-keyed client diagnostic');
    return {skill,estimate:estimate===null?null:Math.round(estimate),previous:previous===null?null:Math.round(previous),confidence:n===0?'none':n>=5&&!diagnosticOnly?'moderate':'low',observations:n,history,recentPerformance:!n?'No current graded evidence':`${recent.filter(h=>h.score===100).length}/${recent.length} recent checks fully passing`,trend,lastAssessment:history.at(-1)?.at??null,evidenceSources:[...new Set(history.map(h=>h.source))],difficulties:failed>=2?['Repeated recent checks not fully passing; inspect exact failures.']:[],recommendedDifficulty:successful?'advanced':failed>=2?'beginner':'intermediate',reason:!n?'Unassessed. Existing stored scores/claims retained, not promoted to new evidence.':successful?'Try a harder check; independence and general mastery are not established.':failed>=2?'Offer a smaller scaffold on this skill only.':'Collect more fresh evidence. Time alone does not change this estimate.'} as CompetencyView;
  });
}
export function competencyPlan(state:LoopState):Plan|null {
  if(!state.plan)return null;
  // Sample scores remain labeled samples by existing AppShell, never synthesized into history.
  if(state.sampleProvenance)return state.plan;
  const bySkill=new Map(competencyView(state).map(s=>[norm(s.skill),s]));
  return {...state.plan,skills:state.plan.skills.map(s=>{const c=bySkill.get(norm(s.name));return {...s,level:c?.estimate??0,note:c?`${c.observations} observations; ${c.confidence} confidence. ${c.reason}`:'Not assessed'};})};
}
export function competencyContext(state:LoopState):string {
  if(state.sampleProvenance)return 'SAMPLE DATA: not genuine learner evidence.';
  return competencyView(state).map(c=>`${c.skill}: ${c.estimate===null?'unassessed':c.estimate+'/100 estimate'}, confidence ${c.confidence}, n=${c.observations}; ${c.recentPerformance}; ${c.reason}`).join('\n') || 'No competency evidence yet.';
}
