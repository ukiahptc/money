/* 시작 설정: 첫 실행 때 보유 금액·카드값·월급 예정액을 앱 안에서 입력받는다.
 * 숫자는 저장소에 두지 않고 이 기기의 localStorage에만 저장된다. */
const SetupView = (() => {
  const { el, comma, parseNum, ymLabel } = U;

  function moneyField(label, hint, key, draft) {
    const inp = el('input', { type: 'text', inputmode: 'numeric', class: 'input num', placeholder: '0', 'aria-label': label });
    inp.addEventListener('input', () => {
      const n = Math.floor(parseNum(inp.value));
      inp.value = n ? comma(n) : '';
      draft[key] = n;
    });
    return el('label', { class: 'field' }, [
      el('span', { class: 'field-label' }, label),
      inp,
      hint ? el('span', { class: 'field-hint' }, hint) : null,
    ]);
  }

  function open(onDone) {
    const state = Store.state;
    const nowYm = Ledger.thisMonth();
    const prevYm = Ledger.shiftMonth(nowYm, -1);
    const m = (ym) => ymLabel(ym).replace(/^\d{4}년 /, '');
    const draft = { cash: 0, income: 0, prevCard: 0, curCard: 0 };
    let dlg;

    function finish(skip) {
      if (!skip) {
        if (draft.cash > 0) Cash.setCash(draft.cash);
        if (draft.income > 0) Cash.setPlannedIncome(draft.income);
        const add = (amount, date, memo) =>
          state.entries.push({ id: U.uid(), type: 'expense', amount, category: 'etc', memo, date, pay: 'card', createdAt: Date.now() });
        // 지난달 사용분은 지난달 말일, 이번 달 사용분은 오늘 날짜로. 보유 금액 스냅샷보다 먼저 기록돼야 이중 차감이 안 된다
        if (draft.prevCard > 0) add(draft.prevCard, prevYm + '-28', `${m(prevYm)} 카드값 (시작 설정)`);
        if (draft.curCard > 0) add(draft.curCard, Ledger.today(), `${m(nowYm)} 카드 사용분 (시작 설정, 오늘까지)`);
        if (draft.cash > 0) state.cash.at = Date.now() + 1;
      }
      state.ui.setupDone = true;
      Store.save();
      dlg.close();
      onDone();
    }

    dlg = U.sheet('시작 설정', () =>
      el('form', { class: 'sheet-body', onsubmit: (e) => { e.preventDefault(); finish(false); } }, [
        el('div', { class: 'sheet-head' }, [
          el('button', { type: 'button', class: 'link-btn', onclick: () => finish(true) }, '나중에'),
          el('strong', {}, '시작 설정'),
          el('button', { type: 'submit', class: 'link-btn strong' }, '시작'),
        ]),
        el('p', { class: 'muted small', style: 'margin:6px 0 14px' },
          '지금 상태를 넣으면 "실제 쓸 수 있는 돈"부터 계산합니다. 모르는 칸은 비워 두고 나중에 대시보드에서 넣어도 됩니다. 입력값은 이 기기에만 저장됩니다.'),
        moneyField('현재 보유 금액 (원)', '통장 잔액 합계', 'cash', draft),
        moneyField('매달 들어올 월급 (원)', '대략적인 실수령액', 'income', draft),
        moneyField(`${m(prevYm)} 카드 사용액 (원)`, `${m(nowYm)}에 결제될 카드값. 카드가 여러 장이면 합계`, 'prevCard', draft),
        moneyField(`${m(nowYm)} 카드 사용액, 오늘까지 (원)`, '이후 쓰는 카드 지출은 가계부에 하나씩 기록하면 자동 합산', 'curCard', draft),
        el('p', { class: 'muted small', style: 'margin:4px 0 0' }, '대출 잔액·금리는 대출 탭에서 입력합니다.'),
      ])
    );
    dlg.addEventListener('cancel', (e) => e.preventDefault()); // 뒤로가기로 닫혀도 다시 안 뜨게 버튼으로만 닫기
    dlg.querySelector('input').focus();
  }

  return { open };
})();
