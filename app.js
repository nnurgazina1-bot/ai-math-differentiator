/* Front-end logic: level toggle, API calls, instant checking, hints, tutor, solution. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ME = window.MathEngine;
  const state = { level: 1, lang: 'en', data: null, params: null, hintsShown: 0, attempts: 0, busy: false };

  // ---------- helpers ----------
  function t(key) {
    const parts = key.split('.');
    let v = window.I18N[state.lang];
    for (const p of parts) v = v && v[p];
    if (v === undefined) { v = window.I18N.en; for (const p of parts) v = v && v[p]; }
    return v;
  }
  function fmt(s, vars) { return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : '')); }

  // Put text into an element and render $...$ math with KaTeX (text is never parsed as HTML).
  function setMath(el, text) {
    el.textContent = text || '';
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el, { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false });
      } catch (e) { /* leave plain text */ }
    }
  }
  function li(text) { const x = document.createElement('li'); setMath(x, text); return x; }

  async function api(payload) {
    const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    let data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) throw new Error((data && (data.detail || data.error)) || ('HTTP ' + res.status));
    return data;
  }

  function setStatus(msg, isErr, spin) {
    const s = $('status');
    s.className = 'status' + (isErr ? ' err' : '');
    s.innerHTML = '';
    if (spin) { const sp = document.createElement('span'); sp.className = 'spinner'; s.appendChild(sp); }
    s.appendChild(document.createTextNode(msg || ''));
  }

  // ---------- static UI text ----------
  function applyI18n() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    setMath($('coreText'), t('core'));
    $('answerInput').placeholder = t('ansPh');
    $('askInput').placeholder = t('askPh');
    $('generate').textContent = state.data ? t('newTask') : t('generate');
    if (state.data) renderTaskChrome();
  }

  function selectLevel(level) {
    state.level = level;
    document.querySelectorAll('.level').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.level) === level)));
    $('generate').textContent = t('generate');
  }

  // ---------- generate ----------
  async function generate() {
    if (state.busy) return;
    state.busy = true; $('generate').disabled = true;
    setStatus(t('generating'), false, true);
    try {
      const data = await api({ action: 'problem', level: state.level, language: state.lang });
      state.data = data;
      state.params = ME.generateParams(data.params.level, data.params.seed); // same engine, same seed -> instant local checking
      if (!ME.sameEquation(state.params.equation, data.problem.equation)) throw new Error('verification mismatch');
      state.hintsShown = 0; state.attempts = 0;
      renderTask();
      setStatus('');
      $('taskSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      setStatus(fmt(t('errGen'), { e: e.message === 'Failed to fetch' ? t('errNet') : e.message }), true);
    } finally {
      state.busy = false; $('generate').disabled = false;
      $('generate').textContent = state.data ? t('newTask') : t('generate');
    }
  }

  function renderTaskChrome() {
    const d = state.data, lv = d.params.level;
    const lb = $('levelBadge');
    lb.className = 'badge level-badge l' + lv;
    lb.textContent = fmt(t('lvl'), { n: lv }) + ' · ' + t('l' + lv + 'name');
    const sb = $('sourceBadge');
    sb.className = 'badge' + (d.source === 'offline' ? ' offline' : '');
    sb.textContent = d.source === 'ai' ? fmt(t('srcAI'), { m: d.model }) : t('srcOffline');
    $('verifiedBadge').textContent = t('verified');
    const vp = $('verifyPanel');
    vp.innerHTML = '';
    const head = document.createElement('strong'); head.textContent = t('verifyTitle'); vp.appendChild(head);
    const ul = document.createElement('ul');
    (d.verification.summary || []).forEach((s) => { const x = document.createElement('li'); x.textContent = s; ul.appendChild(x); });
    vp.appendChild(ul);
    updateHintBtn();
    $('answerHelp').textContent = lv === 3 ? t('help3') : t('help12');
    $('solutionBtn').textContent = $('solution').hidden ? t('showSolution') : t('hideSolution');
  }

  function renderTask() {
    const d = state.data, p = d.problem, lv = d.params.level;
    $('taskSection').hidden = false;
    renderTaskChrome();
    $('verifyPanel').hidden = true; $('verifiedBadge').setAttribute('aria-expanded', 'false');
    $('taskTitle').textContent = p.title;
    setMath($('taskContext'), p.context);
    setMath($('taskQuestion'), p.task);

    // guided steps (Level 1 only)
    const gl = $('guidedList'); gl.innerHTML = '';
    $('guidedBlock').hidden = !(p.guided_steps && p.guided_steps.length);
    (p.guided_steps || []).forEach((g) => {
      const item = document.createElement('li');
      const q = document.createElement('span'); setMath(q, g.prompt); item.appendChild(q);
      const btn = document.createElement('button'); btn.className = 'btn ghost'; btn.type = 'button'; btn.textContent = t('showAns');
      const ans = document.createElement('span'); ans.className = 'g-ans'; ans.hidden = true; setMath(ans, g.answer);
      btn.addEventListener('click', () => { ans.hidden = false; btn.remove(); });
      item.appendChild(btn); item.appendChild(ans); gl.appendChild(item);
    });

    $('hintList').innerHTML = '';
    $('answerInput').value = ''; $('verdict').hidden = true; $('aiFeedback').hidden = true;
    $('askInput').value = ''; $('askAnswer').hidden = true;
    $('solution').hidden = true; $('solutionBtn').textContent = t('showSolution');
    const sl = $('solutionList'); sl.innerHTML = '';
    p.solution_steps.forEach((s) => sl.appendChild(li(s)));
    setMath($('finalAnswer'), t('finalAnswer') + ' ' + (p.answer.statement || p.answer.values.join('; ')));
    setMath($('checkTip'), p.check_tip || '');
    updateHintBtn();
  }

  // ---------- hints ----------
  function updateHintBtn() {
    if (!state.data) return;
    const total = state.data.problem.hints.length;
    const b = $('hintBtn');
    b.disabled = state.hintsShown >= total;
    b.textContent = state.hintsShown >= total ? t('noMoreHints') : fmt(t('hintBtn'), { n: state.hintsShown + 1, t: total });
  }
  function nextHint() {
    const hints = state.data.problem.hints;
    if (state.hintsShown >= hints.length) return;
    $('hintList').appendChild(li(hints[state.hintsShown]));
    state.hintsShown++;
    updateHintBtn();
  }

  // ---------- answer checking: instant local verdict, then AI feedback ----------
  function localFeedback(check, lv) {
    const fb = t('fb'), out = [];
    if (check.status === 'correct') return fb.correct[lv];
    if (check.status === 'unparsed') return fb.unparsed;
    check.substitution.forEach((s) => {
      if (check.wrong.includes(s.value)) out.push(fmt(fb.wrong, { v: s.value, r: s.residual }));
    });
    check.rejectedRoots.forEach((v) => out.push(fmt(fb.rejected, { v })));
    if (check.missing.length && !check.rejectedRoots.length) out.push(fb.missing);
    out.push(fb.level[lv]);
    return out.join(' ');
  }

  async function checkAnswer(ev) {
    ev.preventDefault();
    if (!state.data) return;
    const raw = $('answerInput').value.trim();
    if (!raw) return;
    state.attempts++;
    const lv = state.data.params.level;
    const check = ME.checkStudentAnswer(state.params, raw); // exact, instant, no network
    const v = $('verdict');
    v.hidden = false; v.className = 'verdict ' + check.status;
    v.textContent = t('v_' + check.status);

    const box = $('aiFeedback');
    box.hidden = false; box.innerHTML = '';
    const who = document.createElement('span'); who.className = 'who'; who.textContent = t('aiSays'); box.appendChild(who);
    const body = document.createElement('div'); box.appendChild(body);
    const sp = document.createElement('span'); sp.className = 'spinner'; body.appendChild(sp);
    body.appendChild(document.createTextNode(t('tutorThinking')));
    try {
      const res = await api({ action: 'feedback', level: lv, language: state.lang, seed: state.data.params.seed, problem: state.data.problem, answer: raw, attempt: state.attempts });
      if (res.check && res.check.status !== check.status) throw new Error('verdict mismatch'); // server and browser must agree
      if (res.feedback) {
        setMath(body, res.feedback.feedback + (res.feedback.next_step ? ' ' + res.feedback.next_step : ''));
        return;
      }
      throw new Error('no ai');
    } catch (e) {
      who.textContent = t('aiSays') + ' · offline';
      setMath(body, localFeedback(check, lv) + (e.message === 'no ai' ? '' : ' (' + t('aiDown') + ')'));
    }
  }

  // ---------- ask the tutor ----------
  async function ask(ev) {
    ev.preventDefault();
    if (!state.data) return;
    const q = $('askInput').value.trim();
    if (!q) return;
    const box = $('askAnswer');
    box.hidden = false; box.innerHTML = '';
    const who = document.createElement('span'); who.className = 'who'; who.textContent = t('aiSays'); box.appendChild(who);
    const body = document.createElement('div'); box.appendChild(body);
    const sp = document.createElement('span'); sp.className = 'spinner'; body.appendChild(sp);
    body.appendChild(document.createTextNode(t('tutorThinking')));
    try {
      const res = await api({ action: 'ask', level: state.data.params.level, language: state.lang, seed: state.data.params.seed, problem: state.data.problem, question: q });
      if (res.answer) setMath(body, res.answer);
      else { setMath(body, t('aiDown') + ' ' + (state.data.problem.hints[Math.min(state.hintsShown, state.data.problem.hints.length - 1)] || '')); }
    } catch (e) {
      setMath(body, t('aiDown'));
    }
  }

  // ---------- wire up ----------
  document.addEventListener('DOMContentLoaded', () => {
    try { const saved = localStorage.getItem('amd-lang'); if (saved && window.I18N[saved]) state.lang = saved; } catch (e) { /* ignore */ }
    $('lang').value = state.lang;
    applyI18n();
    document.querySelectorAll('.level').forEach((b) => b.addEventListener('click', () => selectLevel(Number(b.dataset.level))));
    document.querySelector('.levels').addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const n = ((state.level - 1 + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 2)) % 3) + 1;
      selectLevel(n); document.querySelector('.level[data-level="' + n + '"]').focus();
    });
    $('lang').addEventListener('change', (e) => {
      state.lang = e.target.value;
      try { localStorage.setItem('amd-lang', state.lang); } catch (err) { /* ignore */ }
      applyI18n();
    });
    $('generate').addEventListener('click', generate);
    $('hintBtn').addEventListener('click', nextHint);
    $('answerForm').addEventListener('submit', checkAnswer);
    $('askForm').addEventListener('submit', ask);
    $('verifiedBadge').addEventListener('click', () => {
      const p = $('verifyPanel'); p.hidden = !p.hidden; $('verifiedBadge').setAttribute('aria-expanded', String(!p.hidden));
    });
    $('solutionBtn').addEventListener('click', () => {
      const s = $('solution'); s.hidden = !s.hidden;
      $('solutionBtn').textContent = s.hidden ? t('showSolution') : t('hideSolution');
    });
  });
})();
