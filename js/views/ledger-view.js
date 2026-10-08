/* 섹션 2: 가계부 화면 */
const LedgerView = (() => {
  const { el, won, comma, parseNum, ymLabel } = U;
  let month = Ledger.thisMonth();
  let filterCat = null;
  let root = null;

  /* ---------- 입력 시트 (추가·수정) ---------- */

  function openSheet(entry) {
    const state = Store.state;
    const isNew = !entry;
    const last = state.ui.lastCat || {};
    const draft = entry
      ? { ...entry }
      : {
          type: 'expense', amount: 0, memo: '',
          category: last.expense || 'food',
          date: month === Ledger.thisMonth() ? Ledger.today() : `${month}-01`,
        };

    const dlg = el('dialog', { class: 'sheet', 'aria-label': isNew ? '내역 추가' : '내역 수정' });
    const error = el('p', { class: 'form-error', role: 'alert' });

    const amountInp = el('input', {
      type: 'text', inputmode: 'numeric', class: 'input amount-input num',
      placeholder: '0', value: draft.amount ? comma(draft.amount) : '', 'aria-label': '금액',
    });
    amountInp.addEventListener('input', () => {
      const n = Math.floor(parseNum(amountInp.value));
      amountInp.value = n ? comma(n) : '';
      draft.amount = n;
    });

    const chips = el('div', { class: 'chips' });
    function renderChips() {
      const cats = Ledger.CATEGORIES[draft.type];
      if (!cats.some((c) => c.id === draft.category)) draft.category = last[draft.type] || cats[0].id;
      chips.replaceChildren(...cats.map((c) => {
        const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(c.id === draft.category) }, c.label);
        b.addEventListener('click', () => {
          draft.category = c.id;
          chips.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        });
        return b;
      }));
    }
    renderChips();

    const typeSeg = U.segmented(Ledger.TYPES, draft.type, (t) => {
      draft.type = t;
      dlg.dataset.type = t;
      renderChips();
    });
    dlg.dataset.type = draft.type;

    const dateInp = el('input', { type: 'date', class: 'input', value: draft.date, 'aria-label': '날짜' });
    dateInp.addEventListener('change', () => { draft.date = dateInp.value; });
    const memoInp = el('input', { type: 'text', class: 'input', maxlength: 40, placeholder: '예: 점심 김밥', value: draft.memo || '', 'aria-label': '메모' });
    memoInp.addEventListener('input', () => { draft.memo = memoInp.value; });

    function save() {
      if (!(draft.amount > 0)) { error.textContent = '금액을 입력해 주세요.'; amountInp.focus(); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date || '')) { error.textContent = '날짜를 선택해 주세요.'; return; }
      draft.memo = draft.memo.trim();
      if (isNew) {
        state.entries.push({ ...draft, id: U.uid(), createdAt: Date.now() });
      } else {
        Object.assign(state.entries.find((e) => e.id === entry.id), draft);
      }
      state.ui.lastCat = { ...last, [draft.type]: draft.category };
      Store.save();
      month = draft.date.slice(0, 7); // 저장한 내역이 보이는 달로 이동
      dlg.close();
      render(root);
    }

    function remove() {
      if (!confirm('이 내역을 삭제할까요?')) return;
      state.entries = state.entries.filter((e) => e.id !== entry.id);
      Store.save();
      dlg.close();
      render(root);
    }

    dlg.append(
      el('form', { class: 'sheet-body', onsubmit: (e) => { e.preventDefault(); save(); } }, [
        el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
        el('div', { class: 'sheet-head' }, [
          el('button', { type: 'button', class: 'link-btn', onclick: () => dlg.close() }, '취소'),
          el('strong', {}, isNew ? '내역 추가' : '내역 수정'),
          el('button', { type: 'submit', class: 'link-btn strong' }, '저장'),
        ]),
        typeSeg,
        el('label', { class: 'amount-field' }, [amountInp, el('span', {}, '원')]),
        error,
        el('div', { class: 'field' }, [el('span', { class: 'field-label' }, '카테고리'), chips]),
        el('div', { class: 'grid2' }, [
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '날짜'), dateInp]),
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '메모'), memoInp]),
        ]),
        isNew ? null : el('button', { type: 'button', class: 'btn danger-ghost block-btn', onclick: remove }, '이 내역 삭제'),
      ])
    );
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // 바깥 터치로 닫기
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
    if (isNew) amountInp.focus();
  }

  /* ---------- 화면 구성 ---------- */

  function monthNav() {
    const go = (k) => { month = Ledger.shiftMonth(month, k); filterCat = null; render(root); };
    const isNow = month === Ledger.thisMonth();
    return el('div', { class: 'month-nav' }, [
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': '이전 달', onclick: () => go(-1) }, '‹'),
      el('strong', {}, ymLabel(month)),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': '다음 달', onclick: () => go(1) }, '›'),
      isNow ? null : el('button', {
        type: 'button', class: 'link-btn today-btn',
        onclick: () => { month = Ledger.thisMonth(); filterCat = null; render(root); },
      }, '이번 달'),
    ]);
  }

  function summaryCard(t) {
    return el('section', { class: 'card ledger-sum' }, [
      el('div', { class: 'sum-grid' }, [
        el('div', {}, [el('span', {}, '수입'), el('strong', { class: 'income' }, won(t.income))]),
        el('div', {}, [el('span', {}, '지출'), el('strong', {}, won(t.expense))]),
        el('div', {}, [el('span', {}, '남은 돈'), el('strong', { class: t.net < 0 ? 'neg' : '' }, won(t.net))]),
      ]),
      t.loan ? el('p', { class: 'muted small sum-note' }, `지출 중 대출 상환 ${won(t.loan)}`) : null,
    ]);
  }

  function breakdownCard(cats, total) {
    const max = cats[0].amount;
    return el('section', { class: 'card' }, [
      el('div', { class: 'card-title' }, [
        el('h3', {}, '카테고리별 지출'),
        filterCat ? el('button', { type: 'button', class: 'link-btn', onclick: () => { filterCat = null; render(root); } }, '전체 보기') : null,
      ]),
      el('ul', { class: 'bars' }, cats.map((c) =>
        el('li', {}, el('button', {
          type: 'button', class: 'bar-row', 'aria-pressed': String(filterCat === c.id),
          onclick: () => { filterCat = filterCat === c.id ? null : c.id; render(root); },
        }, [
          el('span', { class: 'bar-label' }, c.label),
          el('span', { class: 'bar-track' }, el('span', { class: 'bar-fill', style: `width:${Math.max(2, (c.amount / max) * 100)}%` })),
          el('span', { class: 'bar-amt num' }, comma(c.amount)),
          el('span', { class: 'bar-pct num' }, `${Math.round((c.amount / total) * 100)}%`),
        ]))
      )),
    ]);
  }

  function entryRow(e) {
    const sign = e.type === 'income' ? '+' : '-';
    return el('li', {}, el('button', { type: 'button', class: 'entry', onclick: () => openSheet(e) }, [
      el('span', { class: 'entry-cat' + (e.type === 'income' ? ' income' : '') }, Ledger.catLabel(e.type, e.category)),
      el('span', { class: 'entry-memo' }, e.memo || ''),
      el('span', { class: 'entry-amt num' + (e.type === 'income' ? ' income' : '') }, sign + comma(e.amount)),
    ]));
  }

  function listSection(list) {
    if (!list.length) {
      return el('div', { class: 'card empty-card' }, [
        el('p', {}, filterCat ? '이 카테고리 내역이 없습니다.' : `${ymLabel(month)} 기록이 없습니다.`),
        el('p', { class: 'small' }, '오른쪽 아래 + 버튼으로 기록을 추가하세요.'),
      ]);
    }
    return el('div', {}, Ledger.groupByDate(list).map((g) => {
      const dayOut = g.items.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
      return el('section', { class: 'day' }, [
        el('div', { class: 'day-head' }, [
          el('span', {}, Ledger.dateLabel(g.date)),
          dayOut ? el('span', { class: 'num' }, `-${comma(dayOut)}`) : null,
        ]),
        el('ul', { class: 'card entries' }, g.items.map(entryRow)),
      ]);
    }));
  }

  function render(r) {
    root = r;
    const all = Ledger.ofMonth(Store.state.entries, month);
    const t = Ledger.totals(all);
    const cats = Ledger.byCategory(all);
    const shown = filterCat ? all.filter((e) => e.type === 'expense' && e.category === filterCat) : all;

    root.replaceChildren(...[
      el('header', { class: 'page-head' }, [el('h1', {}, '가계부')]),
      monthNav(),
      summaryCard(t),
      cats.length ? breakdownCard(cats, t.expense) : null,
      listSection(shown),
      el('button', { type: 'button', class: 'fab', 'aria-label': '내역 추가', onclick: () => openSheet(null) }, '+'),
    ].filter(Boolean));
  }

  return { render };
})();
