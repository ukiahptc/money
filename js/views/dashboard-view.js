/* 섹션 4: 대시보드 + 섹션 5: 데이터 관리 */
const DashboardView = (() => {
  const { el, won, man, comma, ymLabel, ymShort, duration } = U;
  let root = null;

  /* ---------- 현금 흐름 ---------- */

  function moneyPrompt(label, current, onOk) {
    const v = prompt(label, current ? comma(current) : '');
    if (v == null) return;
    const n = Math.floor(U.parseNum(v));
    if (n >= 0) onOk(n);
  }

  function cashCard(nowYm) {
    const c = Cash.summary(nowYm);
    const line = (label, amount, sub, cls) =>
      el('div', { class: 'calc-line ' + (cls || '') }, [
        el('span', {}, [label, sub ? el('small', { class: 'muted' }, ` ${sub}`) : null]),
        el('strong', { class: 'num' }, amount),
      ]);

    if (!c.hasCash) {
      return el('section', { class: 'card' }, [
        el('h3', {}, '현금 흐름'),
        el('p', { class: 'muted small' }, '통장에 있는 돈을 입력하면 카드값·월급을 반영해 실제로 쓸 수 있는 돈을 계산합니다.'),
        el('button', { type: 'button', class: 'btn small', onclick: () => SetupView.open(() => render(root)) }, '시작 설정 열기'),
      ]);
    }

    const billRows = c.unpaid.map((b) =>
      el('div', { class: 'calc-line bill' }, [
        el('span', {}, [
          `− ${ymLabel(b.ym).replace(/^\d{4}년 /, '')} 카드 사용분`,
          el('small', { class: 'muted' }, b.ym === nowYm ? ' (지금까지)' : ` (${ymLabel(b.payYm).replace(/^\d{4}년 /, '')} 결제)`),
        ]),
        el('span', { class: 'bill-right' }, [
          el('strong', { class: 'num' }, won(b.amount)),
          b.ym === nowYm ? null : el('button', {
            type: 'button', class: 'link-btn tiny',
            onclick: () => { if (confirm(`${ymLabel(b.ym)} 카드값 ${won(b.amount)}을 오늘 결제한 것으로 표시할까요?\n보유 금액에서 그만큼 빠집니다.`)) { Cash.markPaid(b.ym, true); render(root); } },
          }, '결제 완료'),
        ]),
      ])
    );
    const paid = Cash.bills().filter((b) => b.paidOn).slice(-1)[0];

    return el('section', { class: 'card' }, [
      el('div', { class: 'card-title' }, [
        el('h3', {}, '현금 흐름'),
        el('button', { type: 'button', class: 'link-btn', onclick: () => moneyPrompt('현재 보유 금액 (원)\n통장 잔액을 확인한 값을 넣으세요.', Store.state.cash.amount, (n) => { Cash.setCash(n); render(root); }) }, '보유 금액 수정'),
      ]),
      line('지금 가진 돈', won(c.current), c.asOf === Ledger.today() ? '오늘 기준' : `${c.asOf.slice(5).replace('-', '/')} 입력 후 가계부 반영`),
      ...billRows,
      c.loanDue
        ? line('− 이번 달 대출 납입', won(c.loanLeft), c.loanPaid ? `${won(c.loanDue)} 중 ${won(c.loanPaid)} 냄` : `${Store.state.loans.filter(Loan.isValid).length}건 합계`, 'bill')
        : null,
      c.incomeToCome
        ? line('+ 들어올 월급', won(c.incomeToCome), '예정', 'plus')
        : c.incomeSoFar ? line('이번 달 수입', won(c.incomeSoFar), '반영됨', 'muted-line') : null,
      line('= 실제 쓸 수 있는 돈', won(c.available), null, 'total' + (c.available < 0 ? ' neg' : '')),
      el('div', { class: 'cash-actions' }, [
        el('button', { type: 'button', class: 'link-btn tiny', onclick: () => moneyPrompt('매달 들어올 예정 금액 (원)', Store.state.planned.income, (n) => { Cash.setPlannedIncome(n); render(root); }) },
          `월급 예정액 ${Store.state.planned.income ? won(Store.state.planned.income) : '설정'}`),
        paid ? el('button', { type: 'button', class: 'link-btn tiny', onclick: () => { Cash.markPaid(paid.ym, false); render(root); } }, `${ymLabel(paid.ym)} 결제 취소`) : null,
      ]),
      el('p', { class: 'muted small', style: 'margin:8px 0 0' }, '카드값은 가계부에서 "신용카드"로 기록한 지출을 달별로 합친 값, 대출 납입은 대출 탭 스케줄의 이번 달 금액입니다. 카드값은 "결제 완료"로, 대출은 가계부에 "대출 상환" 지출을 기록하면 반영됩니다.'),
    ]);
  }

  /* ---------- 대출 현황 ---------- */

  // 상환월이 지난 만큼 스케줄을 진행시켜 현재 잔액과 남은 기간을 구한다
  function loanProgress(loan, nowYm) {
    const rows = Loan.schedule(loan, loan.extra);
    const done = rows.filter((r) => r.ym < nowYm);
    const current = done.length ? done[done.length - 1].balance : loan.balance;
    const thisMonth = rows.find((r) => r.ym === nowYm);
    return {
      start: loan.balance, current, paid: loan.balance - current,
      monthsLeft: rows.length - done.length, endYm: rows[rows.length - 1].ym,
      due: thisMonth ? thisMonth.payment : 0,
      finished: rows.length - done.length <= 0,
    };
  }

  function loanCard(nowYm) {
    const loans = Store.state.loans.filter(Loan.isValid);
    const go = () => document.querySelector('.tab[data-tab="loan"]').click();
    if (!loans.length) {
      return el('section', { class: 'card summary', onclick: go, role: 'button', tabindex: 0 }, [
        el('div', { class: 'summary-label' }, '대출'),
        el('div', { class: 'summary-value', style: 'font-size:20px' }, '대출 탭에서 금리·기간을 입력하세요'),
      ]);
    }
    const ps = loans.map((l) => loanProgress(l, nowYm));
    const start = ps.reduce((s, p) => s + p.start, 0);
    const current = ps.reduce((s, p) => s + p.current, 0);
    const due = ps.reduce((s, p) => s + p.due, 0);
    const endYm = ps.reduce((m, p) => (p.endYm > m ? p.endYm : m), '');
    const monthsLeft = Math.max(...ps.map((p) => p.monthsLeft));
    const pct = start ? Math.round(((start - current) / start) * 100) : 0;
    const allDone = ps.every((p) => p.finished);

    return el('section', { class: 'card summary', onclick: go, role: 'button', tabindex: 0 }, [
      el('div', { class: 'summary-label' }, allDone ? '🎉 완납' : '남은 대출'),
      el('div', { class: 'summary-value' }, won(current)),
      el('div', { class: 'progress-wrap' }, [
        el('div', { class: 'progress' }, el('span', { style: `width:${pct}%` })),
        el('div', { class: 'progress-text' }, [
          el('span', {}, `${pct}% 상환`),
          el('span', {}, `시작 ${man(start)}`),
        ]),
      ]),
      allDone ? null : el('div', { class: 'summary-row' }, [
        el('div', {}, [el('span', {}, '완납까지'), el('strong', {}, duration(monthsLeft))]),
        el('div', {}, [el('span', {}, '완납 예정'), el('strong', {}, ymLabel(endYm))]),
        el('div', {}, [el('span', {}, '이번 달 납입'), el('strong', {}, due ? won(due) : '-')]),
      ]),
      el('div', { class: 'summary-note' }, '상환 스케줄 기준 예상 잔액입니다. 실제 잔액은 대출 탭에서 고쳐 주세요.'),
    ]);
  }

  /* ---------- 이번 달 ---------- */

  function monthCard(ym) {
    const t = Ledger.totals(Ledger.ofMonth(Store.state.entries, ym));
    const st = Budget.status(ym);
    const go = (tab) => () => document.querySelector(`.tab[data-tab="${tab}"]`).click();
    const pct = st.totalBudget ? Math.min(100, (st.totalSpent / st.totalBudget) * 100) : 0;
    const over = st.totalBudget && st.totalLeft < 0;
    const d = new Date();
    const dayOfMonth = d.getDate(), daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - dayOfMonth;
    const perDay = st.totalBudget && daysLeft > 0 && st.totalLeft > 0 ? Math.floor(st.totalLeft / daysLeft) : null;

    return el('section', { class: 'card' }, [
      el('div', { class: 'card-title' }, [el('h3', {}, `${ymLabel(ym)} 가계`), el('button', { type: 'button', class: 'link-btn', onclick: go('ledger') }, '가계부 ›')]),
      el('div', { class: 'sum-grid' }, [
        el('div', {}, [el('span', {}, '수입'), el('strong', { class: 'income' }, won(t.income))]),
        el('div', {}, [el('span', {}, '지출'), el('strong', {}, won(t.expense))]),
        el('div', {}, [el('span', {}, '남은 돈'), el('strong', { class: t.net < 0 ? 'neg' : '' }, won(t.net))]),
      ]),
      st.totalBudget
        ? el('div', { class: 'budget-mini', onclick: go('budget') }, [
            el('div', { class: 'budget-bar big' + (over ? ' over' : '') }, el('span', { style: `width:${pct}%` })),
            el('div', { class: 'progress-text' }, [
              el('span', {}, over ? `예산 ${won(-st.totalLeft)} 초과` : `예산 ${won(st.totalLeft)} 남음`),
              el('span', {}, perDay != null ? `하루 ${won(perDay)}꼴` : `${daysLeft}일 남음`),
            ]),
          ])
        : el('p', { class: 'muted small sum-note' }, [
            '이 달 예산이 없습니다. ',
            el('button', { type: 'button', class: 'link-btn inline', onclick: go('budget') }, '소비 계획 세우기'),
          ]),
    ]);
  }

  /* ---------- 6개월 추이 ---------- */

  function trendCard(nowYm) {
    const months = Array.from({ length: 6 }, (_, i) => Ledger.shiftMonth(nowYm, i - 5));
    const data = months.map((ym) => {
      const list = Ledger.ofMonth(Store.state.entries, ym);
      const t = Ledger.totals(list);
      return { ym, income: t.income, expense: t.expense, loan: t.loan, other: t.expense - t.loan };
    });
    if (!data.some((d) => d.income || d.expense)) return null;

    const W = 320, H = 150, L = 4, R = 4, T = 18, B = 20;
    const max = Math.max(1, ...data.map((d) => d.expense)); // 지출 기준으로 눈금을 잡아 막대가 잘 보이게
    const slot = (W - L - R) / 6, bw = Math.min(34, slot * 0.5);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const bars = data.map((d, i) => {
      const x = L + slot * i + (slot - bw) / 2;
      const yo = y(d.other), yl = y(d.expense);
      return `
        <rect x="${x}" y="${yo}" width="${bw}" height="${H - B - yo}" class="bar-other" rx="3"/>
        ${d.loan ? `<rect x="${x}" y="${yl}" width="${bw}" height="${yo - yl}" class="bar-loan" rx="3"/>` : ''}
        ${d.expense ? `<text x="${x + bw / 2}" y="${yl - 4}" class="val" text-anchor="middle">${d.expense >= 10000 ? Math.round(d.expense / 10000) + '만' : ''}</text>` : ''}
        <text x="${x + bw / 2}" y="${H - 5}" class="tick ${d.ym === nowYm ? 'now' : ''}" text-anchor="middle">${ymShort(d.ym)}</text>`;
    }).join('');
    const svg = `
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="최근 6개월 수입·지출">
        <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" class="axis"/>
        ${bars}
      </svg>`;
    const avg = Math.round(data.reduce((a, d) => a + d.other, 0) / data.filter((d) => d.expense).length || 0);
    return el('section', { class: 'card' }, [
      el('div', { class: 'card-title' }, [el('h3', {}, '최근 6개월 지출'), el('span', { class: 'muted small' }, `생활 지출 월평균 ${man(avg)}`)]),
      el('div', { class: 'chart-wrap' }, [
        el('div', { html: svg }),
        el('div', { class: 'legend' }, [
          el('span', { class: 'lg sq other' }, '생활 지출'),
          el('span', { class: 'lg sq loan' }, '대출 상환'),
        ]),
      ]),
    ]);
  }

  /* ---------- 최근 내역 ---------- */

  function recentCard() {
    const list = [...Store.state.entries]
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);
    if (!list.length) return null;
    return el('section', { class: 'card' }, [
      el('h3', {}, '최근 내역'),
      el('ul', { class: 'entries recent' }, list.map((e) =>
        el('li', {}, el('div', { class: 'entry' }, [
          el('span', { class: 'entry-cat' + (e.type === 'income' ? ' income' : '') }, Ledger.catLabel(e.type, e.category)),
          el('span', { class: 'entry-memo' }, [e.memo || '', el('small', { class: 'muted' }, ` ${e.date.slice(5).replace('-', '/')}`)]),
          el('span', { class: 'entry-amt num' + (e.type === 'income' ? ' income' : '') }, (e.type === 'income' ? '+' : '-') + comma(e.amount)),
        ]))
      )),
    ]);
  }

  /* ---------- 투자 자산 · 순자산 ---------- */

  function openInvestSheet(inv, onDone) {
    const isNew = !inv;
    const d = inv ? { ...inv } : { id: U.uid(), name: '', unit: 'USDT', amount: 0, locked: 0, rate: 0, principal: 0 };
    let dlg;
    const err = el('p', { class: 'form-error', role: 'alert' });
    const numInp = (key, ph, decimal) => {
      const i = el('input', { type: 'text', inputmode: decimal ? 'decimal' : 'numeric', class: 'input num', placeholder: ph, value: d[key] ? (decimal ? d[key] : comma(d[key])) : '' });
      i.addEventListener('input', () => {
        const raw = i.value.replace(/[^\d.]/g, '');
        const n = decimal ? parseFloat(raw) : Math.floor(Number(raw));
        d[key] = Number.isFinite(n) ? n : 0;
        if (!decimal) i.value = d[key] ? comma(d[key]) : '';
      });
      return i;
    };
    const nameInp = el('input', { type: 'text', class: 'input', placeholder: '예: 거래소 선물 계정', value: d.name, maxlength: 20 });
    nameInp.addEventListener('input', () => { d.name = nameInp.value; });
    const amountInp = numInp('amount', '0', true), lockedInp = numInp('locked', '0', true);
    const rateInp = numInp('rate', '예: 1,350'), principalInp = numInp('principal', '내가 넣은 원화');
    const unitFields = el('div', { class: 'grid2' }, [
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '보유 수량'), amountInp]),
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '그중 출금 불가 (증정금 등)'), lockedInp]),
    ]);
    const rateField = el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '단가 (원, 거래소 원화 시세)'), rateInp, el('span', { class: 'field-hint' }, '평가액 = 수량 × 단가. 시세가 바뀌면 여기만 고치면 됩니다.')]);
    const syncUnit = () => { rateField.hidden = d.unit === 'KRW'; unitFields.querySelectorAll('.field-label')[0].textContent = d.unit === 'KRW' ? '평가액 (원)' : '보유 수량 (USDT)'; };
    const unitSeg = U.segmented({ USDT: 'USDT', KRW: '원화' }, d.unit, (k) => { d.unit = k; syncUnit(); });
    syncUnit();

    function saveIt() {
      if (!d.name.trim()) { err.textContent = '이름을 입력해 주세요.'; return; }
      if (!(d.amount > 0)) { err.textContent = '수량을 입력해 주세요.'; return; }
      if (d.unit !== 'KRW' && !(d.rate > 0)) { err.textContent = '단가를 입력해 주세요.'; return; }
      if (d.locked > d.amount) { err.textContent = '출금 불가 수량이 보유 수량보다 큽니다.'; return; }
      Invest.save(d); dlg.close(); onDone();
    }
    dlg = U.sheet('투자 자산', () =>
      el('form', { class: 'sheet-body', onsubmit: (e) => { e.preventDefault(); saveIt(); } }, [
        el('div', { class: 'sheet-head' }, [
          el('button', { type: 'button', class: 'link-btn', onclick: () => dlg.close() }, '취소'),
          el('strong', {}, isNew ? '투자 자산 추가' : '평가액 갱신'),
          el('button', { type: 'submit', class: 'link-btn strong' }, '저장'),
        ]),
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '이름'), nameInp]),
        el('div', { class: 'field' }, [el('span', { class: 'field-label' }, '단위'), unitSeg]),
        unitFields,
        rateField,
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '투자 원금 (원)'), principalInp, el('span', { class: 'field-hint' }, '실제로 넣은 내 돈. 손익은 출금 가능 평가액 − 원금으로 계산합니다.')]),
        err,
        isNew ? null : el('button', { type: 'button', class: 'btn danger-ghost block-btn', onclick: () => { if (confirm('이 투자 자산을 삭제할까요?')) { Invest.remove(d.id); dlg.close(); onDone(); } } }, '삭제'),
      ])
    );
  }

  function investCard(nowYm) {
    const n = Invest.netWorth(nowYm);
    const refresh = () => render(root);
    const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + won(Math.abs(v));
    const rows = n.items.map(({ inv, total, locked, free, profit }) => {
      const prev = (inv.history || []).slice(-2)[0];
      const delta = prev && inv.history.length > 1 ? free - prev.value : null;
      return el('button', { type: 'button', class: 'inv-row', onclick: () => openInvestSheet(inv, refresh) }, [
        el('div', { class: 'inv-top' }, [
          el('span', { class: 'inv-name' }, inv.name),
          el('strong', { class: 'num' }, won(free)),
        ]),
        el('div', { class: 'inv-sub muted small' }, [
          inv.unit === 'KRW' ? null : `${inv.amount.toLocaleString('ko-KR')} ${inv.unit} × ${comma(inv.rate)}원`,
          locked ? ` · 출금 불가 ${won(locked)} 제외` : null,
        ]),
        el('div', { class: 'inv-sub small' }, [
          el('span', { class: profit >= 0 ? 'income' : 'neg' }, `원금 대비 ${sign(profit)}`),
          delta != null ? el('span', { class: 'muted' }, ` · 지난 기록 대비 ${sign(delta)}`) : null,
          el('span', { class: 'muted' }, ` · ${new Date(inv.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 갱신`),
        ]),
      ]);
    });
    return el('section', { class: 'card' }, [
      el('div', { class: 'card-title' }, [
        el('h3', {}, '순자산'),
        el('button', { type: 'button', class: 'link-btn', onclick: () => openInvestSheet(null, refresh) }, '+ 투자 자산'),
      ]),
      el('div', { class: 'calc-line' }, [el('span', {}, '현금'), el('strong', { class: 'num' }, won(n.cash))]),
      el('div', { class: 'calc-line' }, [el('span', {}, ['+ 투자 (출금 가능분)', n.invLocked ? el('small', { class: 'muted' }, ` 증정금 ${won(n.invLocked)} 제외`) : null]), el('strong', { class: 'num' }, won(n.invFree))]),
      el('div', { class: 'calc-line' }, [el('span', {}, '− 대출 잔액'), el('strong', { class: 'num' }, won(n.debt))]),
      el('div', { class: 'calc-line total' + (n.net < 0 ? ' neg' : '') }, [el('span', {}, '= 순자산'), el('strong', { class: 'num' }, sign(n.net))]),
      rows.length ? el('div', { class: 'inv-list' }, rows) : el('p', { class: 'muted small', style: 'margin:10px 0 0' }, '거래소·계좌 평가액을 넣으면 빚을 뺀 순자산과 투자 손익을 따로 보여줍니다. 수익이 나도 빚 계획은 바뀌지 않습니다.'),
      rows.length ? el('p', { class: 'muted small', style: 'margin:8px 0 0' }, '항목을 누르면 평가액을 갱신합니다. 순자산에는 출금 가능한 금액만 넣습니다.') : null,
    ]);
  }

  /* ---------- 데이터 관리 (섹션 5) ---------- */

  function dataCard() {
    const s = Store.state;
    const status = el('p', { class: 'muted small', style: 'margin:8px 0 0' },
      `대출 ${s.loans.length}건 · 가계부 ${s.entries.length}건 · 이 기기 브라우저에만 저장됨`);
    const btn = (label, fn, cls = 'ghost') => el('button', { type: 'button', class: `btn ${cls} block-btn`, style: 'margin-bottom:8px', onclick: fn }, label);
    return el('section', { class: 'card' }, [
      el('h3', {}, '데이터 백업'),
      el('p', { class: 'muted small', style: 'margin:0 0 12px' },
        '데이터는 기기마다 따로 저장됩니다. PC↔아이폰으로 옮기거나 기기를 바꿀 때는 JSON 백업을 내보내 다른 기기에서 불러오세요.'),
      btn('JSON 백업 내보내기 (전체)', Backup.exportJson),
      btn('CSV 내보내기 (가계부, 엑셀용)', Backup.exportCsv),
      btn('JSON 백업 불러오기', () => Backup.importJson((msg) => { alert(msg); render(root); })),
      btn('모든 데이터 지우기', () => Backup.resetAll(() => render(root)), 'danger-ghost'),
      status,
    ]);
  }

  function render(r) {
    root = r;
    const nowYm = Ledger.thisMonth();
    root.replaceChildren(...[
      el('header', { class: 'page-head' }, [el('h1', {}, '대시보드')]),
      cashCard(nowYm),
      loanCard(nowYm),
      investCard(nowYm),
      monthCard(nowYm),
      trendCard(nowYm),
      recentCard(),
      dataCard(),
    ].filter(Boolean));
  }

  return { render, loanProgress };
})();
