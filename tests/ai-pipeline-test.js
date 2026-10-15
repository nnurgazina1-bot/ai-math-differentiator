/* Simulates the AI to test the generate -> validate -> retry -> fallback pipeline. Run: node tests/ai-pipeline-test.js */
const assert = require('assert');
process.env.GEMINI_API_KEY = 'test-key';
const AI = require('../api/_ai.js');
const M = require('../lib/math.js');
const Offline = require('../api/_offline.js');
const { handleProblem } = require('../api/generate.js');

(async () => {
  // 1) first AI answer has a wrong equation, second is correct -> source "ai", 2 attempts logged
  let calls = 0;
  AI.callJSON = async (sys, user) => {
    calls++;
    const seed = 123, p = M.generateParams(2, seed);
    const good = Offline.build(2, p, 'en'); good.title = 'AI version';
    if (calls === 1) { const bad = JSON.parse(JSON.stringify(good)); bad.equation.b += 2; return bad; }
    assert.ok(user.includes('rejected'), 'retry prompt must explain the rejection');
    return good;
  };
  let r = await handleProblem({ level: 2, language: 'en', seed: 123 });
  assert.strictEqual(r.source, 'ai'); assert.strictEqual(r.problem.title, 'AI version');
  assert.strictEqual(r.verification.checks.length, 2); assert.strictEqual(r.verification.checks[0].ok, false);

  // 2) AI keeps returning a wrong answer -> offline fallback, still verified
  AI.callJSON = async () => { const p = M.generateParams(1, 5); const o = Offline.build(1, p, 'en'); o.answer.values = ['1', '2']; return o; };
  r = await handleProblem({ level: 1, language: 'en', seed: 5 });
  assert.strictEqual(r.source, 'offline'); assert.ok(/answer.values/.test(r.verification.fallbackReason));

  // 3) AI throws (quota/outage) -> offline fallback
  AI.callJSON = async () => { throw new Error('AI_HTTP_429: quota'); };
  r = await handleProblem({ level: 3, language: 'kk', seed: 9 });
  assert.strictEqual(r.source, 'offline');

  // 4) loose JSON parsing of fenced output
  assert.deepStrictEqual(AI.parseJSONLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(AI.parseJSONLoose('Here you go: {"a":2} thanks'), { a: 2 });
  console.log('AI pipeline tests passed');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
