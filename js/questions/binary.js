// ============================================================
// questions/binary.js — binary-input question type.
//
// Same contract as mc.js: render(answerHost, question, ctx),
// calls ctx.onSubmit(correct, details) when the player submits.
//
// Builds a place-value row (standard binary: MSB on the LEFT, e.g.
// 8 4 2 1 for 4 bits — matches how GCSE exams write binary), a row
// of toggle bit buttons, and a submit button. On a wrong answer it
// passes the correct bit string back via details.feedbackOnWrong so
// the engine can show it in the feedback box.
// (Answer arrays are MSB-first: answer[0] is the most significant bit.)
// ============================================================

export const binary = {
  type: 'BINARY',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const bits = new Array(question.bits).fill(0);

    // place-value row — standard MSB-on-the-left (e.g. 8 4 2 1 for 4 bits)
    const placeRow = document.createElement('div');
    placeRow.className = 'bit-place-row';
    for (let i = 0; i < question.bits; i++) {
      const lbl = document.createElement('div');
      lbl.className = 'bit-place-lbl';
      lbl.textContent = Math.pow(2, question.bits - 1 - i);
      placeRow.appendChild(lbl);
    }

    // toggle bit buttons
    const bitRow = document.createElement('div');
    bitRow.className = 'bit-row';
    for (let i = 0; i < question.bits; i++) {
      const b = document.createElement('button');
      b.className = 'bit-btn';
      b.textContent = '0';
      b.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        bits[i] ^= 1;
        b.textContent = bits[i];
        b.classList.toggle('on', bits[i] === 1);
        ctx.sfx.bitClick(bits[i] === 1);
      });
      bitRow.appendChild(b);
    }

    // submit
    const submit = document.createElement('button');
    submit.className = 'binary-submit';
    submit.textContent = 'SUBMIT →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      const correct = bits.every((b, i) => b === question.answer[i]);
      submit.disabled = true;
      bitRow.querySelectorAll('.bit-btn').forEach(b => { b.disabled = true; });
      const details = correct
        ? {}
        : { feedbackOnWrong: 'Correct answer: ' + question.answer.join('') };
      ctx.onSubmit(correct, details);
    });

    answerHost.appendChild(placeRow);
    answerHost.appendChild(bitRow);
    answerHost.appendChild(submit);
  },
};
