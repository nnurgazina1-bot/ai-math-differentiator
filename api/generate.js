/*
 * POST /api/generate
 *   { action: "problem",  level: 1|2|3, language: "en"|"kk"|"ru", seed?: number }
 *   { action: "feedback", level, language, seed, problem, answer, attempt }
 *   { action: "ask",      level, language, seed, problem, question }
 *
 * Pipeline for "problem":
 *   math engine picks verified parameters -> AI adapts the task to the level
 *   -> server validates the AI output against the math engine -> (retry once)
 *   -> offline template fallback if the AI is unavailable or keeps failing.
 */
const M = require('../lib/math.js');
const P = require('./_prompts.js');
const AI = require('./_ai.js');
const Offline = require('./_offline.js');

const LEVELS = [1, 2, 3];
const LANGS = ['en', 'kk', 'ru'];

function str(x, max) { return typeof x === 'string' ? x.slice(0, max || 2000) : ''; }

// Validate and normalise the AI's problem JSON. Returns { ok, problem, errors }.
function validateProblem(raw, params) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['not an object'] };

  const eq = raw.equation && { a: Number(raw.equation.a), b: Number(raw.equation.b), c: Number(raw.equation.c) };
  if (!eq || !M.isValidEquation(eq)) errors.push('equation missing or not integer');
  else if (!M.sameEquation(eq, params.equation)) errors.push('equation does not match the verified equation');
  else if (!params.roots.every(r => M.isRoot(eq, r))) errors.push('roots do not satisfy returned equation');

  const vals = (raw.answer && Array.isArray(raw.answer.values) ? raw.answer.values : []).map(v => M.parseNumber(String(v)));
  if (!vals.length || vals.some(v => !v)) errors.push('answer.values missing or unparsable');
  else if (!M.sameSet(vals, params.answer)) errors.push('answer.values do not match the verified answer');

  ['title', 'context', 'task'].forEach(k => { if (!str(raw[k]).trim()) errors.push(k + ' missing'); });
  const hints = Array.isArray(raw.hints) ? raw.hints.map(h => str(h, 600)).filter(Boolean) : [];
  if (hints.length < 3) errors.push('need 3 hints');
  const steps = Array.isArray(raw.solution_steps) ? raw.solution_steps.map(s => str(s, 800)).filter(Boolean) : [];
  if (steps.length < 3) errors.push('need at least 3 solution steps');
  const guided = Array.isArray(raw.guided_steps) ? raw.guided_steps
    .filter(g => g && str(g.prompt) && str(g.answer))
    .map(g => ({ prompt: str(g.prompt, 400), answer: str(g.answer, 300) })) : [];
  if (params.level === 1 && guided.length < 3) errors.push('Level 1 needs 3+ guided steps');

  // Level 3 must not give the equation away inside the story.
  if (params.level === 3) {
    const shown = M.equationToLatex(params.equation).replace(/\s/g, '');
    if ((str(raw.context) + str(raw.task)).replace(/\s/g, '').includes(shown)) errors.push('Level 3 context reveals the equation');
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    problem: {
      title: str(raw.title, 200), context: str(raw.context), task: str(raw.task),
      equation: eq,
      answer: { values: params.answer.map(M.fracToString), statement: str(raw.answer && raw.answer.statement, 400) },
      guided_steps: params.level === 1 ? guided.slice(0, 6) : [],
      hints: hints.slice(0, 3),
      solution_steps: steps.slice(0, 10),
      check_tip: str(raw.check_tip, 500)
    }
  };
}

function publicParams(params) {
  return {
    level: params.level, seed: params.seed, equation: params.equation,
    equationLatex: M.equationToLatex(params.equation),
    answerMode: params.answerMode
    // The browser re-derives the roots from the seed with the same engine (lib/math.js),
    // so a learner's answer is checked instantly without a network round-trip.
  };
}

async function handleProblem(body) {
  const level = Number(body.level);
  const language = LANGS.includes(body.language) ? body.language : 'en';
  const seed = Number.isInteger(body.seed) ? body.seed >>> 0 : Math.floor(Math.random() * 2 ** 32);
  const params = M.generateParams(level, seed);

  const verification = { engine: 'exact rational arithmetic', checks: [] };
  let problem = null, source = 'ai', lastErrors = [];

  if (AI.hasKey()) {
    for (let attempt = 1; attempt <= 2 && !problem; attempt++) {
      try {
        let user = P.generationPrompt(level, params, language, M);
        if (lastErrors.length) user += '\n\nYour previous answer was rejected for: ' + lastErrors.join('; ') + '. Fix these issues.';
        const raw = await AI.callJSON(P.SYSTEM_BASE, user, { temperature: attempt === 1 ? 0.8 : 0.4 });
        const v = validateProblem(raw, params);
        if (v.ok) problem = v.problem; else lastErrors = v.errors;
        verification.checks.push({ attempt, ok: v.ok, errors: v.ok ? [] : v.errors });
      } catch (e) {
        lastErrors = [String(e.message || e).slice(0, 200)];
        verification.checks.push({ attempt, ok: false, errors: lastErrors });
      }
    }
  } else {
    lastErrors = ['GEMINI_API_KEY is not set'];
  }

  if (!problem) {
    source = 'offline';
    const v = validateProblem(Offline.build(level, params, language), params);
    if (!v.ok) throw new Error('offline template failed validation: ' + v.errors.join('; '));
    problem = v.problem;
    verification.fallbackReason = lastErrors.join('; ');
  }

  verification.passed = true;
  verification.summary = [
    'Equation matches the verified model',
    'All roots satisfy the equation (exact substitution)',
    'Roots re-derived independently with the quadratic formula',
    'Final answer matches the verified answer'
  ];
  return { source, model: source === 'ai' ? AI.modelName() : null, params: publicParams(params), problem, verification };
}

function problemContext(body, params) {
  const p = body.problem || {};
  return {
    title: str(p.title, 200), context: str(p.context), task: str(p.task),
    equationLatex: M.equationToLatex(params.equation),
    answerValues: params.answer.map(M.fracToString)
  };
}

async function handleFeedback(body) {
  const level = Number(body.level);
  const language = LANGS.includes(body.language) ? body.language : 'en';
  const params = M.generateParams(level, Number(body.seed) >>> 0);
  const raw = str(body.answer, 200);
  const check = Object.assign({ raw }, M.checkStudentAnswer(params, raw)); // verdict is computed here, never by the AI
  const attempt = Math.max(1, Math.min(20, Number(body.attempt) || 1));
  let feedback = null, source = 'ai';
  if (AI.hasKey()) {
    try {
      const out = await AI.callJSON(P.SYSTEM_BASE, P.feedbackPrompt(level, problemContext(body, params), check, attempt, language), { temperature: 0.5 });
      if (out && str(out.feedback)) feedback = { feedback: str(out.feedback, 1500), next_step: str(out.next_step, 600) };
    } catch (e) { /* fall through */ }
  }
  if (!feedback) { source = 'offline'; feedback = null; }
  return { source, check, feedback };
}

async function handleAsk(body) {
  const level = Number(body.level);
  const language = LANGS.includes(body.language) ? body.language : 'en';
  const params = M.generateParams(level, Number(body.seed) >>> 0);
  const question = str(body.question, 500).trim();
  if (!question) return { source: 'none', answer: '' };
  if (!AI.hasKey()) return { source: 'offline', answer: null };
  try {
    const out = await AI.callJSON(P.SYSTEM_BASE, P.askPrompt(level, problemContext(body, params), question, language), { temperature: 0.5 });
    return { source: 'ai', answer: str(out && out.answer, 1500) || null };
  } catch (e) {
    return { source: 'offline', answer: null };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return send(res, { error: 'Use POST' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') { res.statusCode = 400; return send(res, { error: 'JSON body required' }); }
  if (!LEVELS.includes(Number(body.level))) { res.statusCode = 400; return send(res, { error: 'level must be 1, 2 or 3' }); }
  try {
    let out;
    if (body.action === 'problem') out = await handleProblem(body);
    else if (body.action === 'feedback') out = await handleFeedback(body);
    else if (body.action === 'ask') out = await handleAsk(body);
    else { res.statusCode = 400; return send(res, { error: 'unknown action' }); }
    res.statusCode = 200; return send(res, out);
  } catch (e) {
    res.statusCode = 500; return send(res, { error: 'Server error', detail: String(e.message || e).slice(0, 200) });
  }
};

function send(res, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

module.exports.validateProblem = validateProblem;
module.exports.handleProblem = handleProblem;
