/* 섹션 3: 소비 계획(예산) 화면 + 카테고리 편집 */
const BudgetView = (() => {
  const { el, won, comma, parseNum, ymLabel, duration } = U;
  let month = Ledger.thisMonth();
  let root = null;

  /* ---------- 카테고리 편집 시트 ---------- */

  function openCategoryEditor(onDone) {
    let type = 'expense';
    let dlg;
    const list = el('ul', { class: 'cat-list' });

    function row(c, i, n) {
      const protectedCat = Ledger.PROTECTED.includes(c.id);
      const nameInp = el('input', { type: 'text', class: 'input cat-name', value: c.label, maxlength: 12, 'aria-label': '카테고리 이름' });
      nameInp.addEventListener('change', () => {
        const v = nameInp.value.trim();
        if (!v) { nameInp.value = c.label; return; }
        Ledger.renameCategory(type, c.id, v);
      });
      const mv = (d) => el('button', {
        type: 'button', class: 'icon-btn sm', 'aria-label': d < 0 ? '위로' : '아래로',
        disabled: d < 0 ? i === 0 : i === n - 1,
        onclick: () => { Ledger.moveCategory(type, c.id, d); refresh(); },
      }, d < 0 ? '↑' : '↓');
      const del = el('button', {
        type: 'button', class: 'icon-btn sm danger', 'aria-label': '삭제', disabled: protectedCat,
        title: protectedCat ? '삭제할 수 없는 카테고리' : '',
        onclick: () => {
          const used = Store.state.entries.filter((e) => e.type === type && e.category === c.id).length;
          const msg = used ? `'${c.label}' 기록 ${used}건은 '기타'로 옮겨집니다. 삭제할까요?` : `'${c.label}'을(를) 삭제할까요?`;
          if (confirm(msg)) { Ledger.removeCategory(type, c.id); refresh(); }
        },
      }, '×');
      return el('li', { class: 'cat-row' }, [nameInp, mv(-1), mv(1), del]);
    }

    let busy = false;
    function refresh() {
      if (busy) return;
      busy = true;
      document.activeElement?.blur?.(); // 수정 중인 이름을 먼저 반영
      const cats = Ledger.cats(type);
      list.replaceChildren(...cats.map((c, i) => row(c, i, cats.length)));
      busy = false;
    }

    const addInp = el('input', { type: 'text', class: 'input', placeholder: '새 카테고리 이름', maxlength: 12, 'aria-label': '새 카테고리 이름' });
    function add() {
      const v = addInp.value.trim();
      if (!v) return;
      if (Ledger.cats(type).some((c) => c.label === v)) { alert('같은 이름의 카테고리가 있습니다.'); return; }
      Ledger.addCategory(type, v);
      addInp.value = '';
      refresh();
      list.lastElementChild?.previousElementSibling?.scrollIntoView({ block: 'nearest' });
    }

    const seg = U.segmented(Ledger.TYPES, type, (t) => { type = t; refresh(); });
    refresh();

    dlg = U.sheet('카테고리 편집', () =>
      el('div', { class: 'sheet-body' }, [
        el('div', { class: 'sheet-head' }, [
          el('span'),
          el('strong', {}, '카테고리 편집'),
          el('button', { type: 'button', class: 'link-btn strong', onclick: () => dlg.close() }, '완료'),
        ]),
        seg,
        el('p', { class: 'muted small', style: 'margin:10px 0 6px' }, '이름을 고치면 기존 기록에도 바로 반영됩니다. 삭제한 카테고리의 기록은 \'기타\'로 옮겨집니다.'),
        el('div', { class: 'cat-scroll' }, list),
        el('form', { class: 'cat-add', onsubmit: (e) => { e.preventDefault(); add(); } }, [
          addInp,
          el('button', { type: 'submit', class: 'btn small', style: 'margin:0' }, '추가'),
        ]),
      ])
    );
    dlg.addEventListener('close', onDone);
  }

  /* ---------- 예산 입력 ---------- */

  function budgetRow(r) {
    const over = r.budget && r.spent > r.budget;
    const pct = r.budget ? Math.min(100, (r.spent / r.budget) * 100) : (r.spent ? 100 : 0);
    const inp = el('input', {
      type: 'text', inputmode: 'numeric', class: 'input num budget-inp',
      value: r.budget ? comma(r.budget) : '', placeholder: '예산', 'aria-label': `${r.label} 예산`,
    });
    inp.addEventListener('input', () => {
      const n = Math.floor(parseNum(inp.value));
      inp.value = n ? comma(n) : '';
    });
    // Safari(iOS) 엔진은 입력 중 값을 코드로 고쳐 쓰면 change를 안 띄우므로 blur·Enter에서 직접 저장
    let committed = r.budget;
    const commit = () => {
      const n = Math.floor(parseNum(inp.value));
      if (n === committed) return;
      committed = n;
      Budget.set(month, r.id, n);
      render(root, true);
    };
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });

    let note;
    if (r.budget) note = over ? `${won(r.spent - r.budget)} 초과` : `${won(r.left)} 남음`;
    else note = r.spent ? '예산 없이 지출' : '';

    return el('li', { class: 'budget-row' + (over ? ' over' : '') + (!r.budget && !r.spent ? ' idle' : '') }, [
      el('div', { class: 'budget-top' }, [
        el('span', { class: 'budget-label' }, r.label),
        el('span', { class: 'budget-spent num' }, r.spent ? `${comma(r.spent)}원 씀` : ''),
        inp,
      ]),
      el('div', { class: 'budget-bar' }, el('span', { style: `width:${pct}%` })),
      el('div', { class: 'budget-note small' }, note),
    ]);
  }

  /* ---------- 카드 ---------- */

  function summaryCard(st) {
    const pct = st.totalBudget ? Math.min(100, (st.totalSpent / st.totalBudget) * 100) : 0;
    const over = st.totalLeft < 0;
    return el('section', { class: 'card' }, [
      el('div', { class: 'sum-grid' }, [
        el('div', {}, [el('span', {}, '예산 합계'), el('strong', {}, won(st.totalBudget))]),
        el('div', {}, [el('span', {}, '지출'), el('strong', {}, won(st.totalSpent))]),
        el('div', {}, [el('span', {}, over ? '초과' : '남은 예산'), el('strong', { class: over ? 'neg' : 'income' }, won(Math.abs(st.totalLeft)))]),
      ]),
      st.totalBudget ? el('div', { class: 'budget-bar big' + (over ? ' over' : '') }, el('span', { style: `width:${pct}%` })) : null,
      st.unplanned ? el('p', { class: 'muted small sum-note' }, `예산을 정하지 않은 카테고리에서 ${won(st.unplanned)} 지출`) : null,
    ]);
  }

  function suggestionCard() {
    const s = Budget.suggestion(month);
    const body = [];
    if (!s.income.amount) {
      body.push(el('p', { class: 'muted small' }, '가계부에 수입을 기록하면 예산을 뺀 나머지를 추가 상환액으로 제안합니다.'));
    } else {
      const from = s.income.from === month ? '이번 달 수입' : s.income.from === 'planned' ? '예정 수입(월급)' : `${ymLabel(s.income.from)} 수입 기준`;
      body.push(
        el('div', { class: 'calc-line' }, [
          el('span', {}, from), el('strong', { class: 'num' }, won(s.income.amount)),
        ]),
        el('div', { class: 'calc-line' }, [
          el('span', {}, '− 예산 합계'), el('strong', { class: 'num' }, won(s.totalBudget)),
        ]),
        el('div', { class: 'calc-line total' + (s.room < 0 ? ' neg' : '') }, [
          el('span', {}, s.room < 0 ? '예산이 수입을 넘음' : '추가 상환 가능'), el('strong', { class: 'num' }, won(Math.abs(s.room))),
        ])
      );
      if (s.room > 0 && s.effect) {
        const e = s.effect;
        body.push(
          el('p', { class: 'callout good', style: 'margin-top:10px' },
            e.months > 0
              ? `매달 ${won(s.room)}씩 더 갚으면 ${duration(e.months)} 빨리 끝나고 이자 ${won(e.interest)}을 아낍니다. (${ymLabel(e.endYm)} 완납)`
              : `매달 ${won(s.room)}씩 더 갚으면 이자 ${won(e.interest)}을 아낍니다.`),
          el('button', {
            type: 'button', class: 'btn small',
            onclick: () => {
              s.loan.extra = s.room; Store.save();
              alert(`대출 탭의 월 추가 상환액을 ${won(s.room)}으로 설정했습니다.`);
            },
          }, '대출 탭 추가 상환액에 적용')
        );
      } else if (s.room > 0 && !s.loan) {
        body.push(el('p', { class: 'muted small' }, '대출 탭에 금리·기간을 입력하면 절감 효과를 계산합니다.'));
      }
    }
    return el('section', { class: 'card' }, [el('h3', {}, '남는 돈 → 대출 상환'), ...body]);
  }

  /* ---------- 고정 지출 ---------- */

  function openRecurringSheet(r, onDone) {
    const isNew = !r;
    const d = r ? { ...r } : { id: U.uid(), name: '', amount: 0, day: 1, category: 'subscribe', pay: 'card', startYm: Ledger.shiftMonth(Ledger.thisMonth(), 1), endYm: null, active: true };
    let dlg;
    const err = el('p', { class: 'form-error', role: 'alert' });
    const nameInp = el('input', { type: 'text', class: 'input', placeholder: '예: Claude Max', value: d.name, maxlength: 30 });
    nameInp.addEventListener('input', () => { d.name = nameInp.value; });
    const amountInp = el('input', { type: 'text', inputmode: 'numeric', class: 'input num', placeholder: '0', value: d.amount ? comma(d.amount) : '' });
    amountInp.addEventListener('input', () => { const n = Math.floor(parseNum(amountInp.value)); amountInp.value = n ? comma(n) : ''; d.amount = n; });
    const dayInp = el('input', { type: 'text', inputmode: 'numeric', class: 'input num', placeholder: '1~31', value: d.day || '' });
    dayInp.addEventListener('input', () => { d.day = Math.floor(parseNum(dayInp.value)); });
    const chips = el('div', { class: 'chips' });
    chips.replaceChildren(...Ledger.cats('expense').map((c) => {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(c.id === d.category) }, c.label);
      b.addEventListener('click', () => { d.category = c.id; chips.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      return b;
    }));
    const startInp = el('input', { type: 'month', class: 'input', value: d.startYm });
    startInp.addEventListener('change', () => { d.startYm = startInp.value; });
    const endInp = el('input', { type: 'month', class: 'input', value: d.endYm || '' });
    endInp.addEventListener('change', () => { d.endYm = endInp.value || null; });

    function saveIt() {
      if (!d.name.trim()) { err.textContent = '이름을 입력해 주세요.'; return; }
      if (!(d.amount > 0)) { err.textContent = '금액을 입력해 주세요.'; return; }
      if (!(d.day >= 1 && d.day <= 31)) { err.textContent = '결제일은 1~31 사이여야 합니다.'; return; }
      if (!/^\d{4}-\d{2}$/.test(d.startYm || '')) { err.textContent = '시작월을 선택해 주세요.'; return; }
      if (d.endYm && d.endYm < d.startYm) { err.textContent = '종료월이 시작월보다 빠릅니다.'; return; }
      Recurring.save(d);
      const n = Recurring.postDue();
      dlg.close(); onDone(n);
    }
    dlg = U.sheet('고정 지출', () =>
      el('form', { class: 'sheet-body', onsubmit: (e) => { e.preventDefault(); saveIt(); } }, [
        el('div', { class: 'sheet-head' }, [
          el('button', { type: 'button', class: 'link-btn', onclick: () => dlg.close() }, '취소'),
          el('strong', {}, isNew ? '고정 지출 추가' : '고정 지출 수정'),
          el('button', { type: 'submit', class: 'link-btn strong' }, '저장'),
        ]),
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '이름'), nameInp]),
        el('div', { class: 'grid2' }, [
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '월 금액 (원)'), amountInp]),
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '결제일 (매달 며칠)'), dayInp]),
        ]),
        el('div', { class: 'field' }, [el('span', { class: 'field-label' }, '카테고리'), chips]),
        el('div', { class: 'field' }, [
          el('span', { class: 'field-label' }, '결제 수단'),
          U.segmented({ card: '신용카드', cash: '현금·체크(자동이체)' }, d.pay, (k) => { d.pay = k; }),
        ]),
        el('div', { class: 'grid2' }, [
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '시작월'), startInp, el('span', { class: 'field-hint' }, '이 달부터 자동 기록. 이미 손으로 적은 달은 그 다음 달로')]),
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '종료월 (해지 예정이면)'), endInp, el('span', { class: 'field-hint' }, '비우면 계속')]),
        ]),
        err,
        isNew ? null : el('div', { class: 'grid2' }, [
          el('button', { type: 'button', class: 'btn ghost small', style: 'margin:0', onclick: () => { d.active = d.active === false; Recurring.save(d); dlg.close(); onDone(0); } }, d.active === false ? '다시 켜기' : '일시 중지'),
          el('button', { type: 'button', class: 'btn danger-ghost small', style: 'margin:0', onclick: () => {
            const keep = confirm('이미 가계부에 기록된 내역은 남길까요?\n확인 = 남김, 취소 = 같이 삭제');
            Recurring.remove(d.id, !keep); dlg.close(); onDone(0);
          } }, '삭제'),
        ]),
      ])
    );
    if (isNew) nameInp.focus();
  }

  function recurringCard() {
    const items = Recurring.list();
    const ym = month;
    const total = Recurring.monthlyTotal(ym);
    const rows = items.map((r) => {
      const active = Recurring.activeIn(r, ym);
      return el('button', { type: 'button', class: 'stock-row' + (active ? '' : ' muted'), onclick: () => openRecurringSheet(r, (n) => { if (n) alert(`${n}건을 가계부에 기록했습니다.`); render(root, true); }) }, [
        el('div', { class: 'stock-top' }, [
          el('span', { class: 'stock-name' }, [r.name, el('small', {}, ` 매달 ${r.day}일 · ${r.pay === 'cash' ? '자동이체' : '카드'}`)]),
          el('strong', { class: 'num' }, won(r.amount)),
        ]),
        el('div', { class: 'stock-sub small muted' }, [
          el('span', {}, `${Ledger.catLabel('expense', r.category)} · ${r.startYm.replace('-', '.')}부터${r.endYm ? ' ' + r.endYm.replace('-', '.') + '까지' : ''}`),
          el('span', {}, r.active === false ? '일시 중지' : active ? '' : '이 달 해당 없음'),
        ]),
      ]);
    });
    return el('section', { class: 'card' }, [
      el('div', { class: 'card-title' }, [
        el('h3', {}, '고정 지출'),
        el('button', { type: 'button', class: 'link-btn', onclick: () => openRecurringSheet(null, (n) => { if (n) alert(`${n}건을 가계부에 기록했습니다.`); render(root, true); }) }, '+ 추가'),
      ]),
      el('p', { class: 'muted small', style: 'margin:0 0 8px' }, items.length
        ? `${ymLabel(ym)} 고정 지출 합계 ${won(total)}. 결제일이 되면 가계부에 자동으로 기록되고, 그 전에는 현금 흐름 예측에 미리 잡힙니다.`
        : '구독·통신·보험료·대출 자동이체처럼 매달 같은 날 빠지는 지출을 등록하면 매달 손으로 안 적어도 됩니다.'),
      rows.length ? el('div', {}, rows) : null,
    ]);
  }

  /* ---------- 렌더 ---------- */

  let rendering = false;
  function render(r, keepScroll) {
    if (rendering) return; // 입력칸 blur로 저장이 중복 발생해도 한 번만 그림
    rendering = true;
    try { renderInner(r, keepScroll); } finally { rendering = false; }
  }
  function renderInner(r, keepScroll) {
    root = r;
    const y = keepScroll ? window.scrollY : 0;
    const st = Budget.status(month);
    const prev = !st.totalBudget ? Budget.latestBefore(month) : null;

    root.replaceChildren(...[
      el('header', { class: 'page-head' }, [el('h1', {}, '소비 계획')]),
      U.monthNav(month, (ym) => { month = ym; render(root); }),
      summaryCard(st),
      prev ? el('button', {
        type: 'button', class: 'btn ghost block-btn',
        onclick: () => { Budget.copyFrom(prev, month); render(root); },
      }, `${ymLabel(prev)} 예산 복사해 오기`) : null,
      suggestionCard(),
      recurringCard(),
      el('section', { class: 'card' }, [
        el('div', { class: 'card-title' }, [
          el('h3', {}, '카테고리별 예산'),
          el('button', { type: 'button', class: 'link-btn', onclick: () => openCategoryEditor(() => render(root, true)) }, '카테고리 편집'),
        ]),
        el('p', { class: 'muted small', style: 'margin:0 0 8px' }, '오른쪽 칸에 이 달 예산을 적으세요. 비워두면 예산 없이 지출만 집계합니다.'),
        el('ul', { class: 'budget-list' }, st.rows.map(budgetRow)),
      ]),
    ].filter(Boolean));
    if (keepScroll) window.scrollTo(0, y);
  }

  return { render, openCategoryEditor };
})();
