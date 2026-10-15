/* Run: node tests/run-tests.js   (no dependencies) */
const assert = require('assert');
const M = require('../lib/math.js');
const Offline = require('../api/_offline.js');
const { validateProblem } = require('../api/generate.js');

let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { console.error('FAIL:', name, '\n ', e.message); process.exitCode = 1; } }
const F = M.frac;

// ---------- parsing ----------
test('parseNumber basics', () => {
  assert.deepStrictEqual(M.parseNumber('3'), F(3));
  assert.deepStrictEqual(M.parseNumber('-3/2'), F(-3, 2));
  assert.deepStrictEqual(M.parseNumber('6/4'), F(3, 2));
  assert.deepStrictEqual(M.parseNumber('-1.5'), F(-3, 2));
  assert.deepStrictEqual(M.parseNumber('1,5'), F(3, 2));
  assert.deepStrictEqual(M.parseNumber('−2'), F(-2));
  assert.deepStrictEqual(M.parseNumber('-\\frac{2}{3}'), F(-2, 3));
  assert.strictEqual(M.parseNumber('abc'), null);
  assert.strictEqual(M.parseNumber('1/0'), null);
});
test('parseAnswerList formats', () => {
  const s = l => M.parseAnswerList(l).values.map(M.fracToString).sort().join('|');
  assert.strictEqual(s('2; -3'), '-3|2');
  assert.strictEqual(s('x1=2, x2=-3'), '-3|2');
  assert.strictEqual(s('x = 2 and x = -3'), '-3|2');
  assert.strictEqual(s('2 және -3/2'), '-3/2|2');
  assert.strictEqual(s('2 -3'), '-3|2');
  assert.strictEqual(s('1,5'), '3/2');
  assert.strictEqual(s('x₁ = 4; x₂ = -1'), '-1|4');
});

// ---------- core algebra ----------
test('buildQuadratic / solve round-trip', () => {
  for (let p = -9; p <= 9; p++) for (let q = 1; q <= 6; q++) for (let r = -9; r <= 9; r++) {
    const r1 = F(p, q), r2 = F(r);
    const eq = M.buildQuadratic(r1, r2);
    assert.ok(M.isRoot(eq, r1) && M.isRoot(eq, r2));
    const sol = M.solveQuadratic(eq).roots;
    const expect = M.fracEq(r1, r2) ? [r1] : [r1, r2];
    assert.ok(M.sameSet(sol, expect), `roots of ${M.equationToLatex(eq)}`);
  }
});
test('sameEquation proportional', () => {
  assert.ok(M.sameEquation({ a: 1, b: -3, c: -4 }, { a: -5, b: 15, c: 20 }));
  assert.ok(!M.sameEquation({ a: 1, b: -3, c: -4 }, { a: 1, b: 3, c: -4 }));
});
test('equationToLatex', () => {
  assert.strictEqual(M.equationToLatex({ a: 1, b: -5, c: 6 }), 'x^2 - 5x + 6 = 0');
  assert.strictEqual(M.equationToLatex({ a: 2, b: 1, c: -3 }), '2x^2 + x - 3 = 0');
  assert.strictEqual(M.equationToLatex({ a: 3, b: 0, c: -12 }), '3x^2 - 12 = 0');
});

// ---------- level generation: 3000 seeds per level ----------
for (const level of [1, 2, 3]) {
  test('generateParams level ' + level, () => {
    for (let seed = 0; seed < 3000; seed++) {
      const p = M.generateParams(level, seed);
      const { a, b, c } = p.equation;
      assert.ok(a > 0 && M.gcd(M.gcd(a, b), c) === 1, 'reduced');
      assert.strictEqual(p.discriminant, b * b - 4 * a * c);
      assert.ok(p.discriminant > 0, 'two distinct real roots');
      assert.strictEqual(p.roots.length, 2);
      p.roots.forEach(r => assert.ok(M.isRoot(p.equation, r)));
      // floating-point cross-check with the quadratic formula
      const s = Math.sqrt(p.discriminant);
      const fl = [(-b - s) / (2 * a), (-b + s) / (2 * a)];
      p.roots.forEach((r, i) => assert.ok(Math.abs(M.fracToDecimal(r) - fl[i]) < 1e-9));
      if (level === 1) { assert.strictEqual(a, 1); p.roots.forEach(r => assert.strictEqual(r.d, 1)); }
      if (level === 2) { assert.ok(a > 1); assert.ok(p.roots.some(r => r.d > 1) && p.roots.some(r => r.d === 1)); }
      if (level === 3) {
        assert.strictEqual(p.answer.length, 1); assert.ok(p.answer[0].n > 0);
        assert.ok(p.roots.some(r => r.n < 0));
      }
      assert.deepStrictEqual(M.generateParams(level, seed), p, 'deterministic');
    }
  });
}

// ---------- student answer checking ----------
test('checkStudentAnswer', () => {
  const p = M.generateParams(1, 7);
  const [r1, r2] = p.roots.map(M.fracToString);
  assert.strictEqual(M.checkStudentAnswer(p, `${r1}; ${r2}`).status, 'correct');
  assert.strictEqual(M.checkStudentAnswer(p, `${r2} and ${r1}`).status, 'correct');
  assert.strictEqual(M.checkStudentAnswer(p, r1).status, 'partial');
  assert.strictEqual(M.checkStudentAnswer(p, '1000').status, 'incorrect');
  assert.strictEqual(M.checkStudentAnswer(p, 'hello').status, 'unparsed');
  const p3 = M.generateParams(3, 11);
  const pos = M.fracToString(p3.answer[0]), neg = M.fracToString(p3.roots.find(r => r.n < 0));
  assert.strictEqual(M.checkStudentAnswer(p3, pos).status, 'correct');
  const both = M.checkStudentAnswer(p3, `${pos}; ${neg}`);
  assert.strictEqual(both.status, 'partial'); assert.deepStrictEqual(both.rejectedRoots, [neg]);
  const p2 = M.generateParams(2, 5);
  const dec = p2.roots.map(r => String(r.n / r.d).replace('.', ',')).join('; ');
  if (p2.roots.every(r => [1, 2, 5].includes(r.d))) assert.strictEqual(M.checkStudentAnswer(p2, dec).status, 'correct');
});

// ---------- offline templates must pass the same validator as AI output ----------
for (const level of [1, 2, 3]) for (const lang of ['en', 'kk', 'ru']) {
  test(`offline template L${level} ${lang}`, () => {
    for (let seed = 0; seed < 500; seed++) {
      const p = M.generateParams(level, seed);
      const v = validateProblem(Offline.build(level, p, lang), p);
      assert.ok(v.ok, `seed ${seed}: ${v.errors && v.errors.join('; ')}`);
      const text = JSON.stringify(v.problem);
      assert.ok(!/undefined|NaN|null/.test(text), 'no undefined/NaN in text: seed ' + seed);
    }
  });
}

// ---------- the validator must reject wrong AI output ----------
test('validator rejects bad AI output', () => {
  const p = M.generateParams(2, 42);
  const good = Offline.build(2, p, 'en');
  assert.ok(validateProblem(good, p).ok);
  const wrongEq = JSON.parse(JSON.stringify(good)); wrongEq.equation.c += 1;
  assert.ok(!validateProblem(wrongEq, p).ok);
  const wrongAns = JSON.parse(JSON.stringify(good)); wrongAns.answer.values = ['1', '2'];
  assert.ok(!validateProblem(wrongAns, p).ok);
  const noHints = JSON.parse(JSON.stringify(good)); noHints.hints = ['only one'];
  assert.ok(!validateProblem(noHints, p).ok);
  const scaled = JSON.parse(JSON.stringify(good));
  scaled.equation = { a: -3 * p.equation.a, b: -3 * p.equation.b, c: -3 * p.equation.c };
  assert.ok(validateProblem(scaled, p).ok, 'non-zero multiple accepted');
  const p3 = M.generateParams(3, 3);
  const leak = Offline.build(3, p3, 'en'); leak.task += ' Solve $' + M.equationToLatex(p3.equation) + '$.';
  assert.ok(!validateProblem(leak, p3).ok, 'level 3 must not reveal the equation');
  const p1 = M.generateParams(1, 3);
  const noGuide = Offline.build(1, p1, 'en'); noGuide.guided_steps = [];
  assert.ok(!validateProblem(noGuide, p1).ok, 'level 1 needs scaffolding');
});

console.log(process.exitCode ? 'SOME TESTS FAILED' : `All ${passed} tests passed`);
