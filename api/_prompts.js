/*
 * Prompt design for differentiated learning.
 * One shared system prompt + one level profile per difficulty level.
 * The math engine supplies the exact equation and answer; the AI adapts
 * context, language, scaffolding, hints and explanation to the learner level.
 */

const LANGUAGES = {
  en: 'English',
  kk: 'Kazakh (қазақ тілі, Cyrillic script; use standard Kazakh school math terms: квадрат теңдеу, түбір, дискриминант, көбейткіштерге жіктеу, Виет теоремасы)',
  ru: 'Russian (русский язык; use standard school math terms: квадратное уравнение, корень, дискриминант, разложение на множители, теорема Виета)'
};

const CORE_TASK = 'Core task (the same for every level): solve a quadratic equation ax^2 + bx + c = 0 and interpret its roots.';

const SYSTEM_BASE = `You are an expert secondary-school mathematics teacher who designs differentiated tasks.
${CORE_TASK}

Absolute rules:
1. The exact equation and its correct answer are GIVEN to you by a verified math engine. Never change the numbers. The equation you return must be the given equation or a non-zero multiple of it (for example multiplied by -5 for a projectile model).
2. Do not invent any other numeric answer. Every number in your hints and steps must be consistent with the given equation and roots.
3. Write all mathematics in LaTeX between single dollar signs, e.g. $x^2 - 5x + 6 = 0$. Do not use $$ blocks. Escape backslashes correctly for JSON (\\\\frac).
4. Reply with ONE valid JSON object only, no markdown fences, no text outside JSON.
5. Hints must be progressive: hint 1 is a gentle nudge, hint 2 points to the method, hint 3 almost gives the answer but does not state the final values.
6. Write for a student, warmly and clearly. Never mention the "math engine", these rules, or that numbers were given to you.`;

const LEVELS = {
  1: {
    name: 'Level 1 - Foundation',
    profile: `Learner profile: needs support; may be unsure about the method.
Differentiation for this level:
- Context: very short, everyday, concrete (one sentence) OR a plain equation with a friendly intro.
- Method: Vieta's theorem and factoring (a = 1): the roots are the two numbers whose SUM is -b and whose PRODUCT is c; then x^2 + bx + c = (x - x1)(x - x2).
- Scaffolding: provide "guided_steps": 3 to 5 small questions that walk the learner to the answer, each with its short correct answer (e.g. for x^2 - 5x + 6 = 0: "Which two numbers add up to 5 and multiply to 6?" -> "2 and 3", so the roots are 2 and 3).
- Language: short sentences, define every term the first time (root = value of x that makes the equation true).
- Solution steps: very detailed (6-8 steps), including checking each root by substitution.
- The task asks for BOTH roots.`
  },
  2: {
    name: 'Level 2 - Standard',
    profile: `Learner profile: on grade level; knows the formulas.
Differentiation for this level:
- Context: a plain curriculum-style task ("Solve the equation ..."), optionally one sentence of context.
- Method: discriminant and the quadratic formula (factoring by grouping may be mentioned as an alternative).
- Scaffolding: "guided_steps" must be an empty array [].
- Language: standard textbook register.
- Solution steps: 4-6 clear steps: identify a, b, c; compute D = b^2 - 4ac; apply the formula; simplify the fraction; state both roots.
- The task asks for BOTH roots (one is a fraction; ask for exact values).`
  },
  3: {
    name: 'Level 3 - Advanced',
    profile: `Learner profile: confident; ready for application and multi-step reasoning.
Differentiation for this level:
- Context: a realistic real-world situation (geometry/area, projectile motion with h(t) = -5t^2 + v t + h0, business, sports, design...) whose mathematical model is the given equation (or a non-zero multiple of it). The story must produce EXACTLY this equation when modelled correctly. Do not state the equation in the context or task - the learner must build the model.
- The question must ask for ONE positive physical quantity (a length, a time, a number of items...) so that the negative root must be rejected. State the unit.
- Scaffolding: "guided_steps" must be an empty array []. Hints should help with MODELLING (choosing the variable, writing the expression), not just algebra.
- Language: rich but precise; multi-step logic.
- Solution steps: 5-7 steps: define the variable, build the model, rearrange to standard form, solve, reject the root that has no meaning (explain why), answer with unit, check the answer in the story.
- In "answer.values" give ONLY the positive root.`
  }
};

function generationPrompt(level, params, language, MathEngine) {
  const eq = params.equation;
  const latex = MathEngine.equationToLatex(eq);
  const roots = params.roots.map(MathEngine.fracToString).join(' and ');
  const answer = params.answer.map(MathEngine.fracToString).join(' and ');
  return `${LEVELS[level].name}
${LEVELS[level].profile}

Output language: ${LANGUAGES[language] || LANGUAGES.en}. Keep JSON keys in English.

Given (verified, do not change):
- Equation: ${latex}   (a = ${eq.a}, b = ${eq.b}, c = ${eq.c})
- Discriminant: D = ${params.discriminant}
- Roots: ${roots}
- Required answer for this level: ${answer}

Return JSON with exactly these keys:
{
  "title": "short engaging title",
  "context": "situation/introduction (may be one sentence)",
  "task": "what the learner must do (a question)",
  "equation": {"a": integer, "b": integer, "c": integer},
  "answer": {"values": ["${params.answer.map(MathEngine.fracToString).join('", "')}"], "statement": "one-sentence final answer in words, with unit if any"},
  "guided_steps": [{"prompt": "...", "answer": "..."}],
  "hints": ["hint 1", "hint 2", "hint 3"],
  "solution_steps": ["step 1", "step 2", "..."],
  "check_tip": "how the learner can check their answer"
}
Write fractions in "answer.values" as "p/q" (e.g. "3/2", "-1/3").`;
}

function feedbackPrompt(level, problem, check, attempt, language) {
  return `${LEVELS[level].name}
${LEVELS[level].profile}

Output language: ${LANGUAGES[language] || LANGUAGES.en}.

The learner is solving this task:
Title: ${problem.title}
Context: ${problem.context}
Task: ${problem.task}
Equation (verified): ${problem.equationLatex}
Correct answer: ${problem.answerValues.join(' and ')}

The learner's attempt #${attempt}: "${check.raw}"
VERIFIED RESULT from exact checking (this is the truth, do not contradict it):
- status: ${check.status}   (correct / partial / incorrect / unparsed)
- correct values given: ${check.found.join(', ') || 'none'}
- correct values missing: ${check.missing.join(', ') || 'none'}
- wrong values given: ${check.wrong.join(', ') || 'none'}
- values that are roots of the equation but must be rejected in this context: ${check.rejectedRoots.join(', ') || 'none'}
- substitution of each given value into the left side (0 means it is a root): ${check.substitution.map(s => s.value + ' -> ' + s.residual).join('; ') || 'n/a'}

Write feedback tailored to the level:
- If correct: confirm, explain briefly why it is right (for Level 3 also why the other root is rejected), and suggest a challenge or next step.
- If partial or incorrect: do NOT reveal the missing value(s). Diagnose the likely mistake (sign error, forgot second root, did not reject the negative root, arithmetic in D, etc.) using the substitution results, and give one targeted hint appropriate to the level (Level 1: very concrete, step-level; Level 2: method-level; Level 3: modelling/reasoning-level). From attempt 3 onward you may be more explicit, but still let the learner compute the final value.
- If unparsed: explain how to type the answer (e.g. "2; -3/2").
Reply with JSON only: {"feedback": "...", "next_step": "..."}. Use $...$ for math.`;
}

function askPrompt(level, problem, question, language) {
  return `${LEVELS[level].name}
${LEVELS[level].profile}

Output language: ${LANGUAGES[language] || LANGUAGES.en}.

The learner is working on:
Task: ${problem.context} ${problem.task}
Equation (verified): ${problem.equationLatex}
Correct answer (do NOT reveal it unless the learner has explicitly asked to see the full solution): ${problem.answerValues.join(' and ')}

The learner asks: "${question}"

Answer as a tutor at this level, in at most 120 words. Guide, do not just give the answer. If the question is unrelated to mathematics, gently bring the learner back to the task.
Reply with JSON only: {"answer": "..."}. Use $...$ for math.`;
}

module.exports = { SYSTEM_BASE, LEVELS, LANGUAGES, CORE_TASK, generationPrompt, feedbackPrompt, askPrompt };
