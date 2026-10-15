# Report: AI Prompts and Differentiation — AI Math Differentiator

**Student:** Ardak · **Course:** Educational Technology & AI · **Topic 8:** AI for Differentiated Learning
**Live site:** [URL] · **Repository:** https://github.com/nnurgazina1-bot/ai-math-differentiator

## 1. Core task and idea
The core task is solving a quadratic equation $ax^2+bx+c=0$ and interpreting its roots. Every level uses the same mathematics; only the context, method, support and depth of reasoning change. The work is split between two components: a **math engine** (exact rational arithmetic) chooses the numbers and checks correctness, and the **AI (Google Gemini)** adapts the task, hints, feedback and explanations to the learner's level and language.

## 2. Prompt design
**System prompt (shared).** It sets the role ("expert secondary-school mathematics teacher who designs differentiated tasks"), the core task, and strict rules: the given equation and answer must not be changed (only a non-zero multiple of the equation is allowed); every number must agree with the given roots; mathematics is written in LaTeX; output is one JSON object; hints are progressive (nudge → method → almost the answer).

**Level profiles (one per level, added to the user prompt):**
- **Level 1 – Foundation:** short everyday context; method = factoring via Vieta's theorem ($a=1$); 3–5 *guided steps* (small questions with answers); short sentences and definitions of terms; 6–8 detailed solution steps including substitution checks.
- **Level 2 – Standard:** curriculum-style task with one fractional root; method = discriminant and quadratic formula; no guided steps; textbook language; 4–6 steps.
- **Level 3 – Advanced:** a real-world situation (area, projectile motion, business…) whose model is the given equation, which is **not shown** to the learner; the question asks for one positive quantity with units, so the negative root must be rejected; hints focus on *modelling*; 5–7 steps ending with a check in the story.

**Generation prompt** passes the verified equation, discriminant, roots and required answer, the output language, and a fixed JSON schema (title, context, task, equation, answer, guided_steps, hints, solution_steps, check_tip).
**Feedback prompt** receives the learner's attempt and the *verified verdict* (correct / partial / incorrect, missing and wrong values, substitution results) and must not contradict it. It diagnoses the likely mistake and gives one hint at the level's depth (Level 1: concrete step; Level 2: method; Level 3: modelling) without revealing the answer.
**Tutor prompt** answers free questions in ≤120 words, guiding rather than solving.

## 3. How differentiation is achieved
| | Level 1 Foundation | Level 2 Standard | Level 3 Advanced |
|---|---|---|---|
| Numbers | $a=1$, small integer roots | $a\in\{2,3,5\}$, one fractional root | one positive, one negative root |
| Context | simple / none | curriculum task | real-world model, equation hidden |
| Support | guided steps + direct hints | method hints | modelling hints |
| Thinking | apply a procedure | choose and apply a formula | model, solve, interpret, reject |

## 4. Ensuring mathematical correctness
AI output is never trusted blindly. The server checks that the returned equation is proportional to the verified one, that each root satisfies it by exact integer substitution, that the roots agree with an independent quadratic-formula solution, that the final answer matches, and that the structure is complete. Invalid output is regenerated once with the error list; otherwise a verified offline template is shown. Student answers are graded by the engine, not by the AI. Automated tests cover 9,000 generated equations, 4,500 template tasks in three languages and the rejection of incorrect AI output.
