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
    inp.addEventListener('change', () => { Budget.set(month, r.id, parseNum(inp.value)); render(root, true); });

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
      const from = s.income.from === month ? '이번 달 수입' : `${ymLabel(s.income.from)} 수입 기준`;
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

  /* ---------- 렌더 ---------- */

  let rendering = false;
  function render(r, keepScroll) {
    if (rendering) return; // 입력칸 blur로 change가 중복 발생해도 한 번만 그림
    rendering = true;
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
    rendering = false;
  }

  return { render, openCategoryEditor };
})();
