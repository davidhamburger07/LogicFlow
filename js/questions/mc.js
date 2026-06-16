// ============================================================
// questions/mc.js — multiple-choice question type.
//
// Conforms to the question-type contract:
//   render(answerHost, question, ctx)
//     - builds the answer UI inside answerHost
//     - when the player answers, calls ctx.onSubmit(correct, details)
//
// ctx provides:
//   ctx.isAnswered()  -> bool  (guard against double-answers)
//   ctx.onSubmit(correct, details)
//   ctx.sfx           -> sound engine (for input clicks if needed)
//
// The engine owns everything around the answer (title, hints,
// feedback, explanation, next button, scoring). This module only
// owns the answer input and decides correctness.
// ============================================================

// Fisher–Yates shuffle (returns a new array; never mutates question.options).
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const mc = {
  type: 'MC',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';

    // Randomise option order on every render — the source data lists the
    // correct answer first, so without this the answer is always option A.
    shuffle(question.options).forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.textContent = opt;

      btn.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        const correct = opt === question.answer;

        // lock all options
        answerHost.querySelectorAll('.opt-btn').forEach(b => { b.disabled = true; });

        // mark the chosen one
        btn.classList.add(correct ? 'correct' : 'wrong');

        // if wrong, also highlight the correct option
        if (!correct) {
          answerHost.querySelectorAll('.opt-btn').forEach(b => {
            if (b.textContent === question.answer) b.classList.add('correct');
          });
        }

        ctx.onSubmit(correct, {});
      });

      answerHost.appendChild(btn);
    });
  },
};
