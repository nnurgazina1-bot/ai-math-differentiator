# AI Math Differentiator

**Topic 8 – AI for Differentiated Learning** · Individual assignment

A web application that takes **one core mathematics task — solving a quadratic equation `ax² + bx + c = 0` and interpreting its roots —** and uses AI to adapt it into **three difficulty levels**, each with its own context, scaffolding, progressive hints, instant feedback and a full worked solution.

🔗 **Live site:** `https://YOUR-PROJECT.vercel.app` *(replace after deploying)*

---

## Features

| Requirement | How it is met |
|---|---|
| Interactive web interface | Responsive single page (HTML/CSS/JS), level toggle, works on phone and desktop, light/dark mode, keyboard accessible |
| AI integration | Google Gemini API (`generateContent`) called from a serverless function; the key stays on the server |
| Level 1 – Foundation | Simple context, **guided step-by-step questions** (Vieta's theorem / factoring), very direct hints, detailed solution with substitution check |
| Level 2 – Standard | Curriculum-style task with a fractional root: discriminant and quadratic formula |
| Level 3 – Advanced | **Real-world modelling** problem (the equation is not given): build the model, solve, **reject the meaningless root**, answer with units |
| Feedback & guidance | 3 progressive hints per task · instant answer check · AI feedback tailored to the level and to the specific mistake · "Ask the AI tutor" for free questions · full solution on demand |
| Mathematical correctness | Every task is **verified by an exact-arithmetic math engine** before it is shown (see below) |
| Extra | Interface **and** AI output in English, Kazakh or Russian |

## How differentiation works

1. **Same core task.** All three levels are the same mathematics: a quadratic equation with two rational roots.
2. **The math engine chooses the numbers** for the level (`lib/math.js`):
   - Level 1: `x² + bx + c = 0`, two small integer roots;
   - Level 2: `ax² + bx + c = 0` (a = 2, 3 or 5), one integer and one fractional root;
   - Level 3: one positive root (the meaningful answer) and one negative root (to be rejected).
3. **The AI adapts the task** using a shared system prompt plus a level-specific profile (`api/_prompts.js`) that controls context, method, scaffolding, hint style, language register and solution depth.
4. **The server verifies the AI output** (`api/generate.js → validateProblem`): the equation must be the same equation (or a non-zero multiple), every root must satisfy it by exact substitution, the final answer must match, the structure must be complete (3 hints, steps, guided steps for Level 1), and at Level 3 the story must not reveal the equation. If the AI fails, it is asked again with the reasons; if it fails twice or is unavailable, a verified offline template is used (clearly labelled in the UI).
5. **Student answers are checked exactly** (fractions, decimals with "." or ",", many input formats). The verdict always comes from the math engine; the AI only explains it, so the AI can never mark a wrong answer as right.

## Project structure

```
index.html        UI markup
style.css         styles (responsive, light/dark)
app.js            front-end logic
i18n.js           UI text in English / Kazakh / Russian
lib/math.js       exact rational math engine (shared by browser and server)
api/generate.js   serverless endpoint: problem / feedback / ask (+ verification)
api/_prompts.js   system prompt and level-specific prompts
api/_ai.js        Gemini API client
api/_offline.js   verified offline templates (fallback)
dev-server.js     local server (no dependencies)
tests/            unit tests + AI pipeline tests
REPORT.md         1-page report (prompts and differentiation)
```

## Run locally

Requirements: Node.js 18+. No `npm install` is needed (zero dependencies).

```bash
cp .env.example .env          # then put your key into .env
npm run dev                   # http://localhost:3000
npm test                      # runs all tests
```

Get a free Gemini API key at <https://aistudio.google.com/apikey>. Without a key the app still runs using the offline templates.

## Deploy (Vercel)

1. Push this folder to a **public** GitHub repository.
2. Go to <https://vercel.com/new>, sign in with GitHub, **Import** the repository (framework preset: *Other*; no build command).
3. In **Environment Variables** add `GEMINI_API_KEY` = your key (optional: `GEMINI_MODEL`).
4. Click **Deploy**. Open the URL and check that the source badge says *AI-generated* (not *Offline template*).
5. Put the live URL at the top of this README.

**Troubleshooting:** if the badge shows *Offline template*, open Vercel → Project → *Logs*. `404 model not found` → set `GEMINI_MODEL` to a model listed in Google AI Studio and redeploy. `403/401` → the key is wrong or not set for the *Production* environment. `429` → free-tier quota reached; wait or use another key.

## Security & privacy

- The API key is only read on the server (`process.env.GEMINI_API_KEY`); it is never sent to the browser.
- Inputs are length-limited and validated; all text is inserted with `textContent` (no HTML injection), math is rendered with KaTeX.
- No personal data is stored.

## Testing

`npm test` checks: number/answer parsing, 9,000 generated equations (exact roots, cross-checked with floating-point formula, level constraints), student-answer verdicts, 4,500 offline tasks in 3 languages, rejection of wrong AI output (wrong equation, wrong answer, missing hints, Level 3 leaking the equation, Level 1 without scaffolding), and the retry/fallback pipeline with a simulated AI.

## License

MIT
