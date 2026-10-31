/**
 * The AI Mentor sidebar webview (mentor mode), task-first layout: the Learning
 * tab leads with milestones, the current task, real test results and hints;
 * Chat, Progress and Resources are separate tabs. Every number comes from the
 * persisted MentorState or a real run/submit - no sample data.
 */

export function mentorHtml(cspSource: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src ${cspSource};">
<title>BuildMyLogic AI Mentor</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 10px 16px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 12.5px; line-height: 1.5; }
  button, input, textarea { font: inherit; color: inherit; }
  button { cursor: pointer; border: 0; border-radius: 6px; }
  .muted { color: var(--vscode-descriptionForeground); }
  .top { position: sticky; top: 0; z-index: 5; margin: 0 -10px; padding: 8px 10px 0; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128,128,128,0.25)); }
  .brandrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .brandrow h1 { font-size: 13px; margin: 0; }
  .pill { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); white-space: nowrap; }
  .tabs { display: flex; gap: 2px; margin-top: 6px; }
  .tab { background: none; padding: 6px 10px; border-bottom: 2px solid transparent; color: var(--vscode-descriptionForeground); font-weight: 600; }
  .tab.active { color: var(--vscode-foreground); border-bottom-color: var(--vscode-focusBorder, #2563eb); }
  .card { border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.25)); border-radius: 8px; padding: 10px; margin: 10px 0; background: var(--vscode-editor-background); }
  .btn { display: inline-block; padding: 5px 10px; margin: 2px 4px 2px 0; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .btn:hover { background: var(--vscode-button-hoverBackground); }
  .btn.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn.big { display: block; width: 100%; padding: 8px; font-weight: 600; text-align: center; }
  .lesson { display: flex; align-items: center; gap: 7px; width: 100%; text-align: left; background: none; padding: 4px 6px; border-radius: 6px; color: inherit; }
  .lesson:hover:not(:disabled) { background: var(--vscode-list-hoverBackground); }
  .lesson.current { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
  .num { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid currentColor; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; flex: none; }
  .num.done { background: var(--vscode-testing-iconPassed, #3fb950); border-color: var(--vscode-testing-iconPassed, #3fb950); color: #fff; }
  .num.now { background: var(--vscode-focusBorder, #2563eb); border-color: var(--vscode-focusBorder, #2563eb); color: #fff; }
  .bar { height: 6px; border-radius: 3px; background: var(--vscode-input-background); overflow: hidden; margin: 6px 0 2px; }
  .bar > div { height: 100%; background: var(--vscode-testing-iconPassed, #3fb950); }
  pre { background: var(--vscode-textCodeBlock-background); padding: 8px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 11.5px; }
  .status { margin: 8px 0; padding: 6px 8px; border-radius: 6px; background: var(--vscode-input-background); }
  .status.error { color: var(--vscode-errorForeground); }
  .test { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 6px; border-radius: 6px; margin: 2px 0; background: var(--vscode-input-background); }
  .pass { color: var(--vscode-testing-iconPassed, #3fb950); font-weight: 600; }
  .fail { color: var(--vscode-errorForeground); font-weight: 600; }
  .rev { cursor: pointer; }
  .rev.selected { outline: 1px solid var(--vscode-focusBorder); }
  .chatlog { max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin: 6px 0; }
  .msg { padding: 6px 8px; border-radius: 8px; max-width: 95%; white-space: pre-wrap; word-break: break-word; }
  .msg.you { align-self: flex-end; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .msg.mentor { align-self: flex-start; background: var(--vscode-input-background); }
  .chatrow { display: flex; gap: 6px; }
  .chatrow input { flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 6px; padding: 6px 8px; }
  .chip { background: var(--vscode-input-background); border-radius: 999px; padding: 4px 10px; margin: 2px 4px 2px 0; font-size: 11.5px; }
  .chip:hover { background: var(--vscode-list-hoverBackground); }
  .hintbox { border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700); padding: 6px 8px; margin: 6px 0; background: var(--vscode-input-background); border-radius: 0 6px 6px 0; }
  .hintnav { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
  .hintnav button { background: none; font-size: 14px; padding: 2px 8px; }
  h2 { font-size: 12.5px; margin: 12px 0 4px; }
  ul.tight { margin: 4px 0; padding-left: 18px; }
  .levelbtn { display: block; width: 100%; text-align: left; margin: 6px 0; padding: 8px 10px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .levelbtn:hover { background: var(--vscode-button-hoverBackground); color: var(--vscode-button-foreground); }
  a { color: var(--vscode-textLink-foreground); }
</style>
</head>
<body>
<div class="top">
  <div class="brandrow"><h1>BuildMyLogic</h1><span class="pill" id="pill">offline</span></div>
  <div class="tabs" id="tabs" hidden>
    <button class="tab active" data-tab="learning">Learning</button>
    <button class="tab" data-tab="chat">Chat</button>
    <button class="tab" data-tab="progress">Progress</button>
    <button class="tab" data-tab="resources">Resources</button>
  </div>
</div>
<div id="status" class="status" hidden></div>
<div id="app"></div>
<script>
const vscode = acquireVsCodeApi();
let model = null;
let tab = 'learning';
let showInstructions = false;
let showExample = false;
let hintIndex = -1;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const send = (m) => vscode.postMessage(m);

function setStatus(text, error) {
  const el = $('status');
  if (!text) { el.hidden = true; return; }
  el.hidden = false; el.textContent = text; el.className = 'status' + (error ? ' error' : '');
}

function icon(status) {
  if (status === 'completed') return '<span class="num done">\\u2713</span>';
  if (status === 'in_progress' || status === 'needs_review') return '<span class="num now">\\u25CF</span>';
  return '<span class="num"></span>';
}

function flatLessons() {
  const seen = new Set(); const out = [];
  for (const mod of model.state.roadmap.modules) for (const lid of mod.lessonIds) {
    if (seen.has(lid)) continue; seen.add(lid);
    const meta = model.lessons.find((l) => l.id === lid);
    if (meta) out.push(meta);
  }
  return out;
}

function monitorLine() {
  if (!model.monitor) return '';
  return '<div class="status">' + (model.monitor.active
    ? '\\u25CF Monitoring ' + esc(model.monitor.file) + ' - saves and errors sync to the website' + (model.monitor.lastSyncAt ? ' (last sync ' + new Date(model.monitor.lastSyncAt).toLocaleTimeString() + ')' : '') + (model.monitor.note ? '<br><span class="muted">' + esc(model.monitor.note) + '</span>' : '')
    : '\\u25CB Not monitoring: ' + esc(model.monitor.reason)) + '</div>';
}

function renderLearning() {
  const s = model.state;
  const lessonById = Object.fromEntries(model.lessons.map((l) => [l.id, l]));
  const flat = flatLessons();
  const done = flat.filter((l) => s.lessons[l.id] && s.lessons[l.id].status === 'completed').length;
  const pct = flat.length ? Math.round((done / flat.length) * 100) : 0;
  let html = monitorLine();
  // project card
  html += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b>' + esc(s.roadmap.title) + '</b><span class="pill">' + esc(s.level) + '</span></div>' +
    '<div class="muted">' + esc(s.roadmap.objective) + '</div>' +
    '<div class="bar"><div style="width:' + pct + '%"></div></div>' +
    '<div class="muted">' + done + ' / ' + flat.length + ' milestones &nbsp; ' + pct + '%</div></div>';
  // milestones
  html += '<div class="card" style="padding:6px">';
  flat.forEach((l, i) => {
    const prog = s.lessons[l.id];
    if (!prog) return;
    const locked = prog.status === 'locked';
    html += '<button class="lesson' + (s.currentLessonId === l.id ? ' current' : '') + '" data-lesson="' + esc(l.id) + '"' + (locked ? ' disabled' : '') + '>' + icon(prog.status) +
      '<span>' + (i + 1) + '. ' + esc(l.title) + '</span>' +
      (prog.bestScore ? '<span class="muted" style="margin-left:auto">' + prog.bestScore + '%</span>' : '') + '</button>';
  });
  html += '</div>';
  // current task
  if (model.current) {
    const ex = model.current.exercise;
    const lesson = lessonById[model.current.lessonId];
    const prog = s.lessons[model.current.lessonId];
    const hintsAllowed = s.roadmap.rules.hintsAllowed;
    const hintsUsed = prog ? prog.hintsUsed : 0;
    const visible = ex.tests.filter((t) => !t.hidden);
    const hiddenCount = ex.tests.length - visible.length;
    html += '<div class="card"><div class="muted">Current Task' + (model.current.revisionId ? ' (revision)' : '') + '</div><b style="font-size:13px">' + esc(ex.title) + '</b>' +
      '<p style="margin:6px 0">' + esc(ex.prompt) + '</p>' +
      '<b>Requirements</b><ul class="tight">' +
      visible.map((t) => '<li>' + esc(t.name) + (t.stdin ? ' <span class="muted">(input: ' + esc(t.stdin) + ')</span>' : '') + '</li>').join('') +
      (hiddenCount ? '<li class="muted">Plus ' + hiddenCount + ' hidden test' + (hiddenCount > 1 ? 's' : '') + ' checked on submit</li>' : '') + '</ul>' +
      '<button class="btn secondary" id="instructions">' + (showInstructions ? 'Hide' : 'View') + ' Full Instructions</button>' +
      (showInstructions && lesson ? '<div style="margin-top:6px"><b>' + esc(lesson.title) + '</b><div class="muted">' + esc(lesson.objective) + '</div>' +
        lesson.explanation.map((p) => '<p style="margin:6px 0">' + esc(p) + '</p>').join('') +
        '<pre>' + esc(lesson.example.code) + '</pre><div class="muted">Expected output:</div><pre>' + esc(lesson.example.output) + '</pre>' +
        '<b>Key points</b><ul class="tight">' + lesson.keyPoints.map((k) => '<li>' + esc(k) + '</li>').join('') + '</ul></div>' : '') +
      '<div style="margin-top:8px;display:flex;gap:6px"><button class="btn secondary" id="starter">Open starter code</button><button class="btn" id="run" style="flex:1">\\u25B6 Run Tests</button></div>' +
      '<button class="btn big" id="submit" style="margin-top:4px">Submit for grading</button>' +
      '<div class="muted" style="margin-top:4px">Run Tests is a trial on the sandbox (not saved). Submit grades your real code and updates your learning record.</div>' +
      '<div id="results"></div></div>';
    // hints
    html += '<div class="card"><div class="hintnav"><b>Hints</b><span class="muted">' + hintsUsed + ' / ' + hintsAllowed + ' used</span></div>';
    if (model.hintLog && model.hintLog.length) {
      if (hintIndex < 0 || hintIndex >= model.hintLog.length) hintIndex = model.hintLog.length - 1;
      html += '<div class="hintnav"><button id="hintprev" ' + (hintIndex > 0 ? '' : 'disabled') + '>\\u2039</button>' +
        '<span class="muted">Hint ' + (hintIndex + 1) + ' / ' + model.hintLog.length + '</span>' +
        '<button id="hintnext" ' + (hintIndex < model.hintLog.length - 1 ? '' : 'disabled') + '>\\u203A</button></div>' +
        '<div class="hintbox">' + esc(model.hintLog[hintIndex]) + '</div>';
    } else {
      html += '<div class="muted" style="margin:4px 0">No hints used yet.</div>';
    }
    html += '<button class="btn secondary" id="hint" ' + (hintsUsed < hintsAllowed ? '' : 'disabled') + '>Get a hint</button>' +
      '<button class="btn secondary" id="example">' + (showExample ? 'Hide' : 'Show') + ' Example</button>';
    if (showExample && lesson) html += '<pre style="margin-top:6px">' + esc(lesson.example.code) + '</pre><div class="muted">Expected output:</div><pre>' + esc(lesson.example.output) + '</pre>';
    html += '</div>';
  } else {
    html += '<div class="card muted">No active exercise. Pick an unlocked milestone above.</div>';
  }
  // ask row
  html += '<div class="card"><div class="chatrow"><input id="taskinput" placeholder="Ask a question about this task..." /><button class="btn" id="tasksend">\\u27A4</button></div>' +
    '<div style="margin-top:6px"><button class="chip" data-kind="explain_mistake">Explain this error</button><button class="chip" id="hintchip">Give me a hint</button><button class="chip" data-kind="why_works">Why does this work?</button><button class="chip" data-kind="another_example">Show example</button></div>' +
    '<div id="taskreply"></div></div>';
  return html;
}

function renderChat() {
  let html = '<div class="card"><b>Ask your mentor</b><div class="muted">Answers stay on the current lesson and never reveal full solutions.</div><div class="chatlog" id="chatlog">' +
    (model.chatLog || []).map((m) => '<div class="msg ' + m.who + '">' + esc(m.text) + '</div>').join('') + '</div>' +
    '<div><button class="chip" data-kind="simpler">Explain simpler</button><button class="chip" data-kind="another_example">Another example</button><button class="chip" data-kind="why_works">Why does this work?</button><button class="chip" data-kind="explain_mistake">Explain my mistake</button></div>' +
    '<div class="chatrow" style="margin-top:6px"><input id="chatinput" placeholder="Ask about this lesson..." /><button class="btn" id="chatsend">Send</button></div></div>';
  return html;
}

function renderProgress() {
  const s = model.state;
  const submits = s.attempts.filter((a) => a.mode === 'submit');
  let html = '<div class="card"><b>Evidence</b><div class="muted">Real grading evidence from your submissions - completion is not mastery.</div>' +
    '<div class="test"><span>Submissions</span><b>' + submits.length + '</b></div>' +
    '<div class="test"><span>Tests passed</span><b>' + submits.reduce((n, a) => n + (a.assessment ? a.assessment.passed_tests : 0), 0) + ' / ' + submits.reduce((n, a) => n + (a.assessment ? a.assessment.total_tests : 0), 0) + '</b></div></div>';
  const comps = Object.values(s.competencies);
  html += '<div class="card"><b>Competencies</b>' + comps.map((c) =>
    '<div class="test"><span>' + esc(model.skills[c.skill] || c.skill) + '</span><span><b>' + esc(c.level) + '</b>' + (c.confirmed ? ' (confirmed)' : ' (estimated)') + '</span></div>').join('') + '</div>';
  const mis = Object.values(s.misconceptions);
  if (mis.length) {
    html += '<div class="card"><b>Misconceptions</b>' + mis.map((m) => '<div class="test"><span>' + esc(m.id) + '</span><span class="muted">' + esc(m.status) + ', seen ' + m.count + 'x</span></div>').join('') + '</div>';
  }
  if (s.revisions.length) {
    html += '<div class="card"><b>Revision tasks</b> <span class="muted">(spaced reassessments - click one to work on it)</span>';
    for (const r of s.revisions) {
      const due = new Date(r.dueAt);
      const meta = r.status === 'scheduled' ? esc(r.reason) + ', ' + (due.getTime() <= Date.now() ? 'due now' : 'due ' + due.toLocaleString()) : esc(r.status);
      const clickable = r.status === 'scheduled' ? ' rev" data-rev="' + esc(r.id) : '"';
      html += '<div class="test' + (model.selectedRevisionId === r.id ? ' rev selected' : clickable) + '><span>' + esc(r.concept) + '</span><span class="muted">' + meta + '</span></div>';
    }
    if (model.selectedRevisionId) html += '<button class="btn secondary" id="clearrev">Back to current lesson</button>';
    html += '</div>';
  }
  return html;
}

function renderResources() {
  const lesson = model.current ? model.lessons.find((l) => l.id === model.current.lessonId) : model.lessons.find((l) => l.id === model.state.currentLessonId);
  const ex = model.current ? model.current.exercise : null;
  let html = '';
  if (ex && ex.resources && ex.resources.length) {
    html += '<div class="card"><b>For the current practice task</b>' + ex.resources.map((r) => '<div class="test"><span>' + esc(r.label) + '</span><a href="' + esc(r.url) + '">Open</a></div>').join('') + '<div class="muted">Videos open externally in your browser.</div></div>';
  }
  html += '<div class="card"><b>Resources</b>';
  if (lesson && lesson.resources && lesson.resources.length) {
    html += lesson.resources.map((r) => '<div class="test"><span>' + esc(r.label) + '</span><a href="' + esc(r.url) + '">Open</a></div>').join('');
  } else {
    html += '<div class="muted">No extra resources for this lesson.</div>';
  }
  if (lesson) html += '</div><div class="card"><b>Concepts in this lesson</b><div>' + lesson.concepts.map((c) => '<span class="chip">' + esc(c) + '</span>').join('') + '</div>';
  html += '</div>';
  return html;
}

function render() {
  const app = $('app');
  if (!model) { app.innerHTML = ''; return; }
  $('pill').textContent = model.connected ? (model.state ? 'connected' : 'signed in') : 'not connected';
  if (!model.connected) {
    $('tabs').hidden = true;
    app.innerHTML = '<div class="card"><b>Connect this VS Code to your AI Mentor.</b><ol>' +
      '<li>Open the BuildMyLogic website and sign in.</li>' +
      '<li>Open <b>AI Mentor</b>.</li>' +
      '<li>Click <b>Connect VS Code</b>. The website talks to this extension privately on your own machine; nothing is pasted or typed.</li></ol>' +
      '<p class="muted">Server: ' + esc(model.apiBaseUrl) + '</p></div>';
    return;
  }
  if (!model.state) {
    $('tabs').hidden = true;
    app.innerHTML = '<div class="card"><b>Let\\'s build something real.</b><p>Choose your level. Your AI Mentor creates a practical C journey and grades your real code.</p>' +
      ['beginner','intermediate','advanced'].map((l) => '<button class="levelbtn" data-level="' + l + '"><b>' + l.toUpperCase() + '</b><br><span class="muted">' +
        ({beginner:'I am new to this. Teach me from the fundamentals.', intermediate:'I understand the basics and want practical problems.', advanced:'I have experience. Challenge me.'})[l] + '</span></button>').join('') +
      '</div>';
    app.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => send({ command: 'start', level: b.dataset.level })));
    return;
  }
  $('tabs').hidden = false;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  app.innerHTML = (tab === 'learning' ? renderLearning() : tab === 'chat' ? renderChat() : tab === 'progress' ? renderProgress() : renderResources()) +
    '<div style="margin-top:8px"><button class="btn secondary" id="refresh">Refresh</button><button class="btn secondary" id="disconnect">Disconnect</button></div>';
  wire(app);
}

function wire(app) {
  app.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => send({ command: 'select-lesson', lessonId: b.dataset.lesson })));
  app.querySelectorAll('[data-rev]').forEach((b) => b.addEventListener('click', () => send({ command: 'select-revision', revisionId: b.dataset.rev })));
  app.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => ask(b.dataset.kind, '')));
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  bind('starter', () => send({ command: 'open-starter' }));
  bind('run', () => send({ command: 'run' }));
  bind('submit', () => send({ command: 'submit' }));
  bind('hint', () => send({ command: 'hint' }));
  bind('hintchip', () => send({ command: 'hint' }));
  bind('refresh', () => send({ command: 'refresh' }));
  bind('disconnect', () => send({ command: 'disconnect' }));
  bind('clearrev', () => send({ command: 'select-revision', revisionId: null }));
  bind('instructions', () => { showInstructions = !showInstructions; render(); });
  bind('example', () => { showExample = !showExample; render(); });
  bind('hintprev', () => { hintIndex = Math.max(0, hintIndex - 1); render(); });
  bind('hintnext', () => { hintIndex = Math.min((model.hintLog || []).length - 1, hintIndex + 1); render(); });
  bind('chatsend', () => { const input = $('chatinput'); const text = input.value.trim(); if (!text) return; input.value = ''; ask('chat', text); });
  bind('tasksend', () => { const input = $('taskinput'); const text = input.value.trim(); if (!text) return; input.value = ''; ask('chat', text); });
  const ci = $('chatinput'); if (ci) ci.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('chatsend').click(); });
  const ti = $('taskinput'); if (ti) ti.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('tasksend').click(); });
}

function ask(kind, message) {
  send({ command: 'ask', kind, message });
}

function currentTaskId() { return model && model.current ? (model.current.revisionId || model.current.exercise.id) : null; }

function showResults(m) {
  const box = $('results'); if (!box) return;
  const forWhom = m.taskTitle ? 'Results for ' + esc(m.taskTitle) + ' <span class="muted">(' + esc(m.taskId || '') + ')</span> ' : 'Results ';
  if (m.kind === 'run') {
    box.innerHTML = '<h2>' + forWhom + '<span class="muted">(trial run, ' + esc(m.sandbox) + ')</span></h2>' + m.items.map((item, i) => {
      const name = m.tests[i] ? (m.tests[i].hidden ? 'Hidden test' : m.tests[i].name) : 'Run ' + (i + 1);
      return '<div class="test"><span>' + esc(name) + '</span><span class="' + (item.statusId === 3 ? 'pass' : 'fail') + '">' + esc(item.status) + '</span></div>' +
        (item.stdout ? '<pre>' + esc(item.stdout) + '</pre>' : '') +
        ((item.stderr || item.compileOutput) ? '<pre class="fail">' + esc([item.compileOutput, item.stderr].filter(Boolean).join('\\n')) + '</pre>' : '');
    }).join('');
  } else {
    const a = m.assessment;
    box.innerHTML = '<h2>' + forWhom + '<span class="muted">(graded, saved)</span></h2>' +
      m.results.map((r) => '<div class="test"><span>' + (r.hidden ? 'Hidden test' : esc(r.name)) + '</span><span class="' + (r.passed ? 'pass' : 'fail') + '">' + (r.passed ? 'Pass' : 'Fail') + '</span></div>').join('') +
      '<div class="status"><b>' + esc(a.status.replace('_', ' ')) + '</b> - ' + a.passed_tests + '/' + a.total_tests + ' tests, score ' + a.score + '<br>' + esc(a.feedback) + '</div>' +
      (a.misconceptions.length ? '<div class="status"><b>Misconception detected:</b> ' + esc(a.misconceptions.map((x) => x.id).join(', ')) + '<br><span class="muted">' + esc(a.misconceptions[0].evidence) + '</span></div>' : '') +
      '<div class="status"><b>Next:</b> ' + esc(m.decision) + '</div>';
  }
}

window.addEventListener('message', (event) => {
  const m = event.data;
  if (m.type === 'render') {
    const prev = model && model.lastResult; model = m.model;
    if (!model.lastResult && prev) model.lastResult = prev;
    if (model.lastResult && model.lastResult.taskId && model.lastResult.taskId !== currentTaskId()) model.lastResult = null;
    render(); if (model.lastResult) showResults(model.lastResult);
  }
  else if (m.type === 'status') { setStatus(m.text, m.error); }
  else if (m.type === 'busy') { /* actions are quick; the status line carries progress */ }
  else if (m.type === 'run-result') { model.lastResult = { kind: 'run', items: m.items, tests: m.tests, sandbox: m.sandbox, taskId: m.taskId, taskTitle: m.taskTitle }; showResults(model.lastResult); }
  else if (m.type === 'submit-result') { model.lastResult = { kind: 'submit', results: m.results, assessment: m.assessment, decision: m.decision, taskId: m.taskId, taskTitle: m.taskTitle }; showResults(model.lastResult); }
  else if (m.type === 'chat-reply') {
    if (tab === 'learning') { const box = $('taskreply'); if (box) box.innerHTML = '<div class="msg mentor" style="margin-top:6px">' + esc(m.text) + '</div>'; }
    else render();
  }
});

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; render(); }));
send({ command: 'ready' });
</script>
</body>
</html>`;
}
