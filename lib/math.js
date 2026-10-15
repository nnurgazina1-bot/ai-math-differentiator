/*
 * Math engine — exact rational arithmetic for quadratic equations.
 * Shared by the browser (window.MathEngine) and the server (require).
 *
 * Why this exists: the AI writes the wording, context, hints and steps,
 * but every number that decides correctness (the equation, its roots,
 * the expected answer, and the student's answer) is produced and checked
 * here, deterministically, with integers only (no floating-point error).
 */
(function (root) {
  'use strict';

  // ---------- rational numbers ----------
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a || 1;
  }

  function frac(n, d) {
    if (d === undefined) d = 1;
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error('frac needs integers');
    if (d === 0) throw new Error('zero denominator');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function fracEq(a, b) { return a.n === b.n && a.d === b.d; }
  function fracToString(f) { return f.d === 1 ? String(f.n) : f.n + '/' + f.d; }
  function fracToLatex(f) {
    if (f.d === 1) return String(f.n);
    return (f.n < 0 ? '-' : '') + '\\frac{' + Math.abs(f.n) + '}{' + f.d + '}';
  }
  function fracToDecimal(f) { return f.n / f.d; }

  // Parse "3", "-3", "3/2", "-1.5", "1,5" (decimal comma), "+4", "−2" (unicode minus)
  function parseNumber(raw) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim()
      .replace(/[−–—]/g, '-')   // unicode minus / dashes
      .replace(/\s+/g, '')
      .replace(/^\+/, '');
    if (!s) return null;
    let m = s.match(/^(-?)\\frac\{(\d+)\}\{(\d+)\}$/);          // \frac{a}{b}
    if (m) return frac((m[1] ? -1 : 1) * parseInt(m[2], 10), parseInt(m[3], 10));
    m = s.match(/^(-?\d+)\/(-?\d+)$/);                        // a/b
    if (m) { const d = parseInt(m[2], 10); return d === 0 ? null : frac(parseInt(m[1], 10), d); }
    m = s.match(/^(-?)(\d*)[.,](\d+)$/);                      // decimal
    if (m) {
      const intPart = m[2] || '0';
      const digits = m[3];
      if (digits.length > 9) return null;
      const den = Math.pow(10, digits.length);
      const num = parseInt(intPart, 10) * den + parseInt(digits, 10);
      return frac((m[1] ? -1 : 1) * num, den);
    }
    m = s.match(/^-?\d+$/);
    if (m) return frac(parseInt(s, 10), 1);
    return null;
  }

  // Split a student's answer into number tokens.
  // Accepts: "2; 3", "2 and 3", "x1=2, x2=3", "x = -1/2 or x = 4", "1,5" (= 1.5)
  function parseAnswerList(input) {
    if (typeof input !== 'string') return { values: [], bad: [] };
    let s = input.toLowerCase()
      .replace(/[−–—]/g, '-')
      .replace(/x\s*[_₁₂]?\s*[12₁₂]?\s*=/g, ' ')                 // x=, x1=, x_1=, x₁=
      .replace(/\{|\}|\$/g, function (c) { return c === '$' ? ' ' : c; });
    let parts;
    if (s.indexOf(';') !== -1) parts = s.split(';');
    else parts = s.split(/,\s+|\s+(?:and|or|және|немесе|и|или)\s+|\s{2,}|\n/);
    // a single chunk like "2 3" -> split on single spaces as a last resort
    if (parts.length === 1 && /^\s*-?[\d./,]+\s+-?[\d./,]+\s*$/.test(parts[0])) parts = parts[0].trim().split(/\s+/);
    const values = []; const bad = [];
    parts.map(function (p) { return p.trim(); }).filter(Boolean).forEach(function (p) {
      const v = parseNumber(p);
      if (v) values.push(v); else bad.push(p);
    });
    return { values: values, bad: bad };
  }

  // ---------- quadratics ----------
  // Build a*x^2 + b*x + c with roots r1, r2 (rationals), scaled by k, reduced, a > 0 unless keepSign.
  function buildQuadratic(r1, r2, k) {
    if (k === undefined) k = 1;
    let a = k * r1.d * r2.d;
    let b = -k * (r1.n * r2.d + r2.n * r1.d);
    let c = k * r1.n * r2.n;
    const g = gcd(gcd(a, b), c);
    a /= g; b /= g; c /= g;
    if (a < 0) { a = -a; b = -b; c = -c; }
    return { a: a, b: b, c: c };
  }

  function isValidEquation(eq) {
    return eq && Number.isInteger(eq.a) && Number.isInteger(eq.b) && Number.isInteger(eq.c) && eq.a !== 0 &&
      Math.abs(eq.a) <= 1e6 && Math.abs(eq.b) <= 1e6 && Math.abs(eq.c) <= 1e8;
  }

  // Exact test: a(n/d)^2 + b(n/d) + c = 0  <=>  a n^2 + b n d + c d^2 = 0
  function isRoot(eq, f) {
    return eq.a * f.n * f.n + eq.b * f.n * f.d + eq.c * f.d * f.d === 0;
  }

  // Two equations describe the same root set iff their coefficient vectors are proportional.
  function sameEquation(e1, e2) {
    if (!isValidEquation(e1) || !isValidEquation(e2)) return false;
    return e1.a * e2.b === e2.a * e1.b && e1.a * e2.c === e2.a * e1.c && e1.b * e2.c === e2.b * e1.c;
  }

  function isPerfectSquare(n) {
    if (n < 0) return false;
    const r = Math.round(Math.sqrt(n));
    return r * r === n;
  }

  // Independent solver (quadratic formula, exact). Returns sorted distinct rational roots, or null if irrational/complex.
  function solveQuadratic(eq) {
    const D = eq.b * eq.b - 4 * eq.a * eq.c;
    if (D < 0) return { discriminant: D, roots: [] };
    if (!isPerfectSquare(D)) return { discriminant: D, roots: null };
    const s = Math.round(Math.sqrt(D));
    const r1 = frac(-eq.b - s, 2 * eq.a);
    const r2 = frac(-eq.b + s, 2 * eq.a);
    const roots = fracEq(r1, r2) ? [r1] : [r1, r2];
    roots.sort(function (x, y) { return x.n * y.d - y.n * x.d; });
    return { discriminant: D, roots: roots };
  }

  function sameSet(listA, listB) {
    if (listA.length !== listB.length) return false;
    return listA.every(function (a) { return listB.some(function (b) { return fracEq(a, b); }); }) &&
      listB.every(function (b) { return listA.some(function (a) { return fracEq(a, b); }); });
  }

  function equationToLatex(eq, v) {
    v = v || 'x';
    function term(coef, pow, first) {
      if (coef === 0) return '';
      const sign = coef < 0 ? '-' : (first ? '' : '+');
      const abs = Math.abs(coef);
      let body;
      if (pow === 0) body = String(abs);
      else body = (abs === 1 ? '' : abs) + v + (pow === 2 ? '^2' : '');
      return (first ? sign : ' ' + sign + ' ') + body;
    }
    let s = term(eq.a, 2, true);
    s += term(eq.b, 1, s === '');
    s += term(eq.c, 0, s === '');
    return (s || '0') + ' = 0';
  }

  // ---------- deterministic problem parameters per level ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  /*
   * Level 1 Foundation: x^2 + bx + c = 0, two distinct non-zero integer roots, |roots| <= 9, small coefficients.
   * Level 2 Standard:   ax^2 + bx + c = 0, a in {2,3,5}, one integer root and one fractional root.
   * Level 3 Advanced:   real-world model; one positive (meaningful) and one negative (rejected) integer root.
   */
  function generateParams(level, seed) {
    const rng = mulberry32(seed >>> 0);
    let r1, r2, eq, expected;
    for (let guard = 0; guard < 500; guard++) {
      if (level === 1) {
        const p = randInt(rng, -9, 9), q = randInt(rng, -9, 9);
        if (p === 0 || q === 0 || p === q || p === -q) continue;
        r1 = frac(p); r2 = frac(q);
        eq = buildQuadratic(r1, r2, 1);
        if (Math.abs(eq.b) > 15 || Math.abs(eq.c) > 40) continue;
        expected = 'both';
      } else if (level === 2) {
        const den = pick(rng, [2, 3, 5]);
        let num = randInt(rng, -9, 9);
        if (num === 0 || gcd(num, den) !== 1) continue;
        const m = randInt(rng, -6, 6);
        if (m === 0) continue;
        r1 = frac(m); r2 = frac(num, den);
        eq = buildQuadratic(r1, r2, 1);
        if (Math.abs(eq.b) > 40 || Math.abs(eq.c) > 60) continue;
        expected = 'both';
      } else if (level === 3) {
        const pos = randInt(rng, 2, 12), neg = -randInt(rng, 1, 15);
        if (pos + neg === 0) continue;
        r1 = frac(neg); r2 = frac(pos);
        eq = buildQuadratic(r1, r2, 1);
        expected = 'positive';
      } else {
        throw new Error('level must be 1, 2 or 3');
      }
      const roots = solveQuadratic(eq).roots;              // independent re-check
      if (!roots || !sameSet(roots, [r1, r2])) continue;
      const answer = expected === 'both' ? roots : roots.filter(function (r) { return r.n > 0; });
      return {
        level: level,
        seed: seed >>> 0,
        equation: eq,
        roots: roots,
        answer: answer,
        answerMode: expected,
        discriminant: solveQuadratic(eq).discriminant
      };
    }
    throw new Error('could not generate parameters');
  }

  // Check a student's typed answer against the expected answer set.
  function checkStudentAnswer(params, input) {
    const parsed = parseAnswerList(input);
    if (!parsed.values.length) return { status: 'unparsed', bad: parsed.bad };
    const expected = params.answer;
    const roots = params.roots;
    const found = expected.filter(function (e) { return parsed.values.some(function (v) { return fracEq(v, e); }); });
    const missing = expected.filter(function (e) { return !found.some(function (f) { return fracEq(f, e); }); });
    const extra = parsed.values.filter(function (v) { return !expected.some(function (e) { return fracEq(v, e); }); });
    // extra values that ARE roots of the equation but should be rejected (Level 3: negative root)
    const rejectedRoots = extra.filter(function (v) { return roots.some(function (r) { return fracEq(r, v); }); });
    const wrong = extra.filter(function (v) { return !roots.some(function (r) { return fracEq(r, v); }); });
    let status;
    if (!missing.length && !extra.length) status = 'correct';
    else if (found.length || rejectedRoots.length) status = 'partial';
    else status = 'incorrect';
    function str(list) { return list.map(fracToString); }
    return {
      status: status,
      given: str(parsed.values),
      found: str(found),
      missing: str(missing),
      wrong: str(wrong),
      rejectedRoots: str(rejectedRoots),
      unparsed: parsed.bad,
      // substitution check for every value the student typed (useful feedback)
      substitution: parsed.values.map(function (v) {
        const val = (params.equation.a * v.n * v.n + params.equation.b * v.n * v.d + params.equation.c * v.d * v.d);
        return { value: fracToString(v), residual: fracToString(frac(val, v.d * v.d)) };
      })
    };
  }

  const api = {
    gcd: gcd, frac: frac, fracEq: fracEq, fracToString: fracToString, fracToLatex: fracToLatex,
    fracToDecimal: fracToDecimal, parseNumber: parseNumber, parseAnswerList: parseAnswerList,
    buildQuadratic: buildQuadratic, isValidEquation: isValidEquation, isRoot: isRoot,
    sameEquation: sameEquation, solveQuadratic: solveQuadratic, sameSet: sameSet,
    equationToLatex: equationToLatex, generateParams: generateParams,
    checkStudentAnswer: checkStudentAnswer
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MathEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
