/*
 * Offline fallback: if the AI service is unreachable (no key, quota, outage)
 * the app still works with template-based tasks built from the SAME verified
 * parameters. The UI labels these clearly as "offline template".
 */
const M = require('../lib/math.js');

function factorLatex(r) { // (x - r)
  if (r.n === 0) return 'x';
  const neg = r.n < 0;
  const abs = M.fracToLatex({ n: Math.abs(r.n), d: r.d });
  return '(x ' + (neg ? '+ ' : '- ') + abs + ')';
}
const L = M.fracToLatex;
const par = (v) => (v < 0 ? '(' + v + ')' : String(v)); // parenthesise negatives in substitutions

const T = {
  en: {
    t1: 'Find the two hidden numbers', c1: 'An unknown number $x$ satisfies the equation below.', q1: 'Find both roots of the equation $EQ$.',
    g1: ['What are $a$, $b$ and $c$ in this equation?', 'By Vieta\'s theorem, what must the SUM of the roots be?', 'What must the PRODUCT of the roots be?', 'Which two numbers have that sum and that product?'],
    h1: ['A root is a value of $x$ that makes the left side equal to $0$.', 'For $x^2+bx+c=0$ the roots add up to $-b$ and multiply to $c$.', 'Look for two numbers whose product is $C$ and whose sum is $S$.'],
    t2: 'Solve with the quadratic formula', c2: 'Standard practice task.', q2: 'Solve the equation $EQ$. Give both roots as exact values.',
    h2: ['Write down $a$, $b$ and $c$ carefully, with their signs.', 'Compute the discriminant $D=b^2-4ac$ first.', '$D = DD$, so $\\sqrt{D} = SQ$. Now use $x=\\frac{-b\\pm\\sqrt{D}}{2a}$ and simplify.'],
    t3: 'Designing a garden bed', c3: 'A rectangular garden bed has an area of $AREA$ m². Its length is DIFF its width.',
    q3: 'Find the width of the garden bed in metres.',
    h3: ['Let $x$ be the width in metres. Express the length in terms of $x$.', 'Area = width × length. Write this as an equation and move everything to one side.', 'You should get a quadratic equation. One of its roots cannot be a width - which one?'],
    more: 'm longer than', less: 'm shorter than', unitAns: 'The width of the bed is ANS m.', w: 'width (m)', len: 'length (m)', rej: 'a width must be positive', m: 'm',
    stmt: 'The roots are R.', check3: 'Check in the story: width × length must equal the area, and both sides must be positive.', check: 'Substitute each value into the left side of the equation: the result must be $0$.'
  },
  kk: {
    t1: 'Жасырын екі санды табайық', c1: 'Белгісіз $x$ саны төмендегі теңдеуді қанағаттандырады.', q1: '$EQ$ теңдеуінің екі түбірін де табыңыз.',
    g1: ['Бұл теңдеуде $a$, $b$ және $c$ неге тең?', 'Виет теоремасы бойынша түбірлердің ҚОСЫНДЫСЫ неге тең болуы керек?', 'Түбірлердің КӨБЕЙТІНДІСІ неге тең болуы керек?', 'Қосындысы мен көбейтіндісі осындай болатын қандай екі сан бар?'],
    h1: ['Түбір – теңдеудің сол жағын $0$-ге айналдыратын $x$-тің мәні.', '$x^2+bx+c=0$ үшін түбірлердің қосындысы $-b$-ға, көбейтіндісі $c$-ға тең.', 'Көбейтіндісі $C$, қосындысы $S$ болатын екі санды іздеңіз.'],
    t2: 'Дискриминант арқылы шешу', c2: 'Стандартты жаттығу есебі.', q2: '$EQ$ теңдеуін шешіңіз. Екі түбірді де дәл мәнде жазыңыз.',
    h2: ['$a$, $b$, $c$ коэффициенттерін таңбаларымен бірге жазыңыз.', 'Алдымен $D=b^2-4ac$ дискриминантын есептеңіз.', '$D = DD$, демек $\\sqrt{D} = SQ$. Енді $x=\\frac{-b\\pm\\sqrt{D}}{2a}$ формуласын қолданып, бөлшекті қысқартыңыз.'],
    t3: 'Бақша алаңын жобалау', c3: 'Тіктөртбұрыш пішінді бақша алаңының ауданы $AREA$ м². Оның ұзындығы енінен DIFF.',
    q3: 'Бақша алаңының енін метрмен табыңыз.',
    h3: ['Енін $x$ метр деп белгілеңіз. Ұзындығын $x$ арқылы өрнектеңіз.', 'Аудан = ені × ұзындығы. Теңдеу құрып, барлық мүшені бір жаққа шығарыңыз.', 'Квадрат теңдеу шығады. Оның бір түбірі ен бола алмайды – қайсысы?'],
    more: 'м ұзын', less: 'м қысқа', unitAns: 'Бақша алаңының ені ANS м.', w: 'ені (м)', len: 'ұзындығы (м)', rej: 'ен оң сан болуы керек', m: 'м',
    stmt: 'Түбірлері: R.', check3: 'Мәтін бойынша тексеріңіз: ені × ұзындығы ауданға тең болуы, ал екі қабырға да оң болуы керек.', check: 'Әр мәнді теңдеудің сол жағына қойыңыз: нәтиже $0$ болуы керек.'
  },
  ru: {
    t1: 'Найдём два загаданных числа', c1: 'Неизвестное число $x$ удовлетворяет уравнению ниже.', q1: 'Найдите оба корня уравнения $EQ$.',
    g1: ['Чему равны $a$, $b$ и $c$ в этом уравнении?', 'Чему по теореме Виета равна СУММА корней?', 'Чему равно ПРОИЗВЕДЕНИЕ корней?', 'Какие два числа имеют такую сумму и такое произведение?'],
    h1: ['Корень – это значение $x$, при котором левая часть равна $0$.', 'Для $x^2+bx+c=0$ сумма корней равна $-b$, а произведение равно $c$.', 'Ищите два числа с произведением $C$ и суммой $S$.'],
    t2: 'Решение через дискриминант', c2: 'Стандартное тренировочное задание.', q2: 'Решите уравнение $EQ$. Запишите оба корня в точном виде.',
    h2: ['Аккуратно выпишите $a$, $b$ и $c$ вместе со знаками.', 'Сначала найдите дискриминант $D=b^2-4ac$.', '$D = DD$, значит $\\sqrt{D} = SQ$. Примените $x=\\frac{-b\\pm\\sqrt{D}}{2a}$ и сократите дробь.'],
    t3: 'Проектирование грядки', c3: 'Площадь прямоугольной грядки равна $AREA$ м². Её длина DIFF ширины.',
    q3: 'Найдите ширину грядки в метрах.',
    h3: ['Обозначьте ширину через $x$ м. Выразите длину через $x$.', 'Площадь = ширина × длина. Составьте уравнение и перенесите всё в одну сторону.', 'Получится квадратное уравнение. Один из корней не может быть шириной – какой?'],
    more: 'м больше', less: 'м меньше', unitAns: 'Ширина грядки равна ANS м.', w: 'ширина (м)', len: 'длина (м)', rej: 'ширина должна быть положительной', m: 'м',
    stmt: 'Корни: R.', check3: 'Проверьте по условию: ширина × длина должна равняться площади, обе стороны положительны.', check: 'Подставьте каждое значение в левую часть уравнения: должно получиться $0$.'
  }
};

function build(level, params, lang) {
  const t = T[lang] || T.en;
  const eq = params.equation;
  const EQ = M.equationToLatex(eq);
  const roots = params.roots;
  const rootsTxt = roots.map(r => '$' + L(r) + '$').join(lang === 'en' ? ' and ' : (lang === 'kk' ? ' және ' : ' и '));
  const ansValues = params.answer.map(M.fracToString);
  const base = { equation: eq, answer: { values: ansValues, statement: t.stmt.replace('R', rootsTxt) }, check_tip: t.check, guided_steps: [] };

  if (level === 1) {
    const S = -eq.b, C = eq.c;
    return Object.assign(base, {
      title: t.t1, context: t.c1, task: t.q1.replace('EQ', EQ),
      guided_steps: [
        { prompt: t.g1[0], answer: `$a=1,\\ b=${eq.b},\\ c=${eq.c}$` },
        { prompt: t.g1[1], answer: `$x_1+x_2=-b=${S}$` },
        { prompt: t.g1[2], answer: `$x_1\\cdot x_2=c=${C}$` },
        { prompt: t.g1[3], answer: `$${L(roots[0])}$, $${L(roots[1])}$` }
      ],
      hints: [t.h1[0], t.h1[1], t.h1[2].replace('$C$', '$' + C + '$').replace('$S$', '$' + S + '$')],
      solution_steps: [
        `$${EQ}$: $a=1,\\ b=${eq.b},\\ c=${eq.c}$`,
        `$x_1+x_2=${S}$, $x_1\\cdot x_2=${C}$`,
        `$${roots[0].n}+${par(roots[1].n)}=${S}$, $${roots[0].n}\\cdot${par(roots[1].n)}=${C}$`,
        `$${factorLatex(roots[0])}${factorLatex(roots[1])}=0$`,
        `$x_1=${L(roots[0])},\\quad x_2=${L(roots[1])}$`,
        `$${par(roots[0].n)}^2${eq.b < 0 ? '-' : '+'}${Math.abs(eq.b)}\\cdot${par(roots[0].n)}${eq.c < 0 ? '-' : '+'}${Math.abs(eq.c)}=0$ ✓,  $${par(roots[1].n)}^2${eq.b < 0 ? '-' : '+'}${Math.abs(eq.b)}\\cdot${par(roots[1].n)}${eq.c < 0 ? '-' : '+'}${Math.abs(eq.c)}=0$ ✓`
      ]
    });
  }

  if (level === 2) {
    const D = params.discriminant, SQ = Math.round(Math.sqrt(D));
    return Object.assign(base, {
      title: t.t2, context: t.c2, task: t.q2.replace('EQ', EQ),
      hints: [t.h2[0], t.h2[1], t.h2[2].replace('DD', String(D)).replace('SQ', String(SQ))],
      solution_steps: [
        `$a=${eq.a},\\ b=${eq.b},\\ c=${eq.c}$`,
        `$D=b^2-4ac=${par(eq.b)}^2-4\\cdot${eq.a}\\cdot${par(eq.c)}=${D}$, $\\sqrt{D}=${SQ}$`,
        `$x=\\frac{-b\\pm\\sqrt{D}}{2a}=\\frac{${-eq.b}\\pm${SQ}}{${2 * eq.a}}$`,
        `$x_1=\\frac{${-eq.b - SQ}}{${2 * eq.a}}=${L(M.frac(-eq.b - SQ, 2 * eq.a))}$, $x_2=\\frac{${-eq.b + SQ}}{${2 * eq.a}}=${L(M.frac(-eq.b + SQ, 2 * eq.a))}$`
      ]
    });
  }

  // level 3: x(x + b) = -c  with width x = positive root, length = x + b = -negativeRoot
  const pos = roots.find(r => r.n > 0), neg = roots.find(r => r.n < 0);
  const area = -eq.c, diff = eq.b;
  const DIFF = Math.abs(diff) + ' ' + (diff > 0 ? t.more : t.less);
  return Object.assign(base, {
    title: t.t3,
    context: t.c3.replace('AREA', String(area)).replace('DIFF', DIFF),
    task: t.q3,
    check_tip: t.check3,
    answer: { values: ansValues, statement: t.unitAns.replace('ANS', L(pos)) },
    hints: t.h3,
    solution_steps: [
      `$x$ — ${t.w}, $x ${diff > 0 ? '+' : '-'} ${Math.abs(diff)}$ — ${t.len}`,
      `$x(x ${diff > 0 ? '+' : '-'} ${Math.abs(diff)}) = ${area}$`,
      `$${EQ}$`,
      `$D=${params.discriminant}$, $x_1=${L(neg)},\\ x_2=${L(pos)}$`,
      `$x_1=${L(neg)}<0$ ✗ (${t.rej})`,
      `$x=${L(pos)}$ ${t.m}; $${pos.n}\\cdot ${pos.n + diff} = ${area}$ ✓`
    ]
  });
}

module.exports = { build };
