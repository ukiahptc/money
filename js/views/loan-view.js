/* 섹션 1: 대출 관리 화면 */
const LoanView = (() => {
  const { el, won, man, comma, ymLabel, ymShort, parseNum, duration } = U;

  function nextYm() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function newLoan(name = '대출', balance = 0) {
    return {
      id: U.uid(), name, balance, rate: null,
      method: 'annuity', months: null, startYm: nextYm(),
      extra: 0, targetMonths: null,
    };
  }

  // 첫 실행 기본 대출 목록. 비상금 대출은 금액·금리를 몰라 비워 둔다
  function seedLoans() {
    return [newLoan('신용 대출', 8000000), newLoan('비상금 대출', 0)];
  }

  /* ---------- 입력 컴포넌트 ---------- */

  function field(label, input, hint) {
    return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, label), input, hint]);
  }

  function moneyInput(value, onChange) {
    const inp = el('input', {
      type: 'text', inputmode: 'numeric', class: 'input num',
      value: value ? comma(value) : '', placeholder: '0',
    });
    inp.addEventListener('input', () => {
      const n = Math.floor(parseNum(inp.value));
      inp.value = n ? comma(n) : '';
      onChange(n);
    });
    return inp;
  }

  function tile(label, value, sub, tone) {
    return el('div', { class: 'tile' + (tone ? ' ' + tone : '') }, [
      el('div', { class: 'tile-label' }, label),
      el('div', { class: 'tile-value' }, value),
      sub ? el('div', { class: 'tile-sub' }, sub) : null,
    ]);
  }

  /* ---------- 잔액 그래프 (기본 vs 추가상환) ---------- */

  function balanceChart(base, plan, startBal, startYm) {
    const W = 320, H = 140, L = 4, R = 4, T = 10, B = 20;
    const n = base.length;
    const x = (i) => L + ((W - L - R) * i) / n;
    const y = (v) => T + (H - T - B) * (1 - v / startBal);
    const pts = (rows) =>
      [[x(0), y(startBal)], ...rows.map((r, i) => [x(i + 1), y(r.balance)])]
        .map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
    const planEnd = x(plan.length);
    const showPlan = plan.length < base.length;
    const svg = `
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="대출 잔액 감소 그래프">
        <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" class="axis"/>
        <polyline points="${pts(base)}" class="line-base"/>
        ${showPlan ? `<polyline points="${pts(plan)}" class="line-plan"/>
          <circle cx="${planEnd.toFixed(1)}" cy="${H - B}" r="3.5" class="dot-plan"/>` : ''}
        <text x="${L}" y="${H - 5}" class="tick">${ymShort(startYm)}</text>
        ${showPlan && planEnd < W - 70 && planEnd > 50 ? `<text x="${planEnd.toFixed(1)}" y="${H - 5}" class="tick plan" text-anchor="middle">${ymShort(plan[plan.length - 1].ym)}</text>` : ''}
        <text x="${W - R}" y="${H - 5}" class="tick" text-anchor="end">${ymShort(base[base.length - 1].ym)}</text>
      </svg>`;
    return el('div', { class: 'chart-wrap' }, [
      el('div', { html: svg }),
      el('div', { class: 'legend' }, [
        el('span', { class: 'lg base' }, '기본 계획'),
        showPlan ? el('span', { class: 'lg plan' }, '추가 상환 반영') : null,
      ]),
    ]);
  }

  /* ---------- 상환 스케줄 표 ---------- */

  function scheduleTable(rows) {
    const hasExtra = rows.some((r) => r.extra > 0);
    const head = el('tr', {}, ['월', '원금', '이자', hasExtra ? '추가' : null, '잔액'].filter(Boolean).map((h) => el('th', {}, h)));
    const body = rows.map((r) =>
      el('tr', {}, [
        el('td', {}, ymShort(r.ym)),
        el('td', {}, comma(r.principal)),
        el('td', {}, comma(r.interest)),
        hasExtra ? el('td', { class: 'accent' }, comma(r.extra)) : null,
        el('td', {}, comma(r.balance)),
      ])
    );
    return el('div', { class: 'table-wrap' }, el('table', { class: 'sched' }, [el('thead', {}, head), el('tbody', {}, body)]));
  }

  /* ---------- 대출 카드 ---------- */

  function loanCard(loan, { onChange, onDelete }) {
    const results = el('div', { class: 'results' });
    const extraOut = el('div', { class: 'extra-out' });
    const chartBox = el('div');
    const targetOut = el('div', { class: 'target-out' });
    const schedBox = el('div');
    const planBlocks = el('div', { class: 'plan-blocks' });

    const commit = () => { Store.save(); update(); onChange(); };

    // 기본 정보
    const nameInp = el('input', { type: 'text', class: 'input title-input', value: loan.name, placeholder: '대출 이름', 'aria-label': '대출 이름' });
    nameInp.addEventListener('input', () => { loan.name = nameInp.value; Store.save(); });

    const rateInp = el('input', {
      type: 'text', inputmode: 'decimal', class: 'input num', placeholder: '예: 5.2',
      value: loan.rate ?? '',
    });
    rateInp.addEventListener('input', () => {
      const v = parseFloat(rateInp.value.replace(/[^\d.]/g, ''));
      loan.rate = Number.isFinite(v) ? v : null;
      commit();
    });

    const monthsHint = el('span', { class: 'field-hint' });
    const monthsInp = el('input', {
      type: 'text', inputmode: 'numeric', class: 'input num', placeholder: '예: 24',
      value: loan.months ?? '',
    });
    const syncMonthsHint = () => { monthsHint.textContent = loan.months ? '= ' + duration(loan.months) : ''; };
    monthsInp.addEventListener('input', () => {
      const n = Math.floor(parseNum(monthsInp.value));
      monthsInp.value = n || '';
      loan.months = n || null;
      syncMonthsHint();
      commit();
    });
    syncMonthsHint();

    const startInp = el('input', { type: 'month', class: 'input', value: loan.startYm });
    startInp.addEventListener('change', () => { loan.startYm = startInp.value; commit(); });

    // 추가 상환
    const SLIDER_MAX = 1000000;
    const slider = el('input', { type: 'range', min: 0, max: SLIDER_MAX, step: 10000, value: Math.min(loan.extra, SLIDER_MAX), class: 'slider', 'aria-label': '월 추가 상환액' });
    const extraInp = moneyInput(loan.extra, (n) => {
      loan.extra = n;
      slider.value = Math.min(n, SLIDER_MAX);
      commit();
    });
    slider.addEventListener('input', () => {
      loan.extra = Number(slider.value);
      extraInp.value = loan.extra ? comma(loan.extra) : '';
      commit();
    });

    // 목표 완납
    const targetInp = el('input', {
      type: 'text', inputmode: 'numeric', class: 'input num', placeholder: '예: 12',
      value: loan.targetMonths ?? '',
    });
    targetInp.addEventListener('input', () => {
      const n = Math.floor(parseNum(targetInp.value));
      targetInp.value = n || '';
      loan.targetMonths = n || null;
      Store.save();
      update();
    });

    // 스케줄 (펼칠 때만 그림)
    const details = el('details', { class: 'sched-details' }, [el('summary', {}, '월별 상환 스케줄 보기'), schedBox]);
    details.addEventListener('toggle', () => details.open && update());

    planBlocks.append(
      el('section', { class: 'block' }, [
        el('h3', {}, '추가 상환 시뮬레이션'),
        el('p', { class: 'muted small' }, '매달 정기 납입 외에 원금을 더 갚으면 기간과 이자가 얼마나 줄어드는지 계산합니다.'),
        field('월 추가 상환액 (원)', extraInp),
        slider,
        el('div', { class: 'slider-scale' }, [el('span', {}, '0'), el('span', {}, '50만'), el('span', {}, '100만')]),
        extraOut,
        chartBox,
      ]),
      el('section', { class: 'block' }, [
        el('h3', {}, '목표 완납 계산'),
        field('몇 개월 안에 다 갚고 싶나요?', targetInp, el('span', { class: 'field-hint' }, '다음 상환월부터 셈')),
        targetOut,
      ]),
      details
    );

    function update() {
      if (!Loan.isValid(loan)) {
        results.replaceChildren(el('p', { class: 'empty-hint' }, '잔액·금리·남은 기간을 입력하면 상환 계획이 계산됩니다.'));
        planBlocks.hidden = true;
        return;
      }
      planBlocks.hidden = false;

      const baseRows = Loan.schedule(loan, 0);
      const planRows = Loan.schedule(loan, loan.extra);
      const base = Loan.summarize(baseRows);
      const plan = Loan.summarize(planRows);

      // 기본 계획 타일
      let payLabel = '월 납입액', payValue = won(base.firstPayment), paySub = null;
      if (loan.method === 'equal') {
        payLabel = '첫 달 납입액';
        paySub = `마지막 달 ${won(base.lastPayment)}`;
      } else if (loan.method === 'bullet') {
        payLabel = '매달 이자';
        paySub = `만기에 ${man(loan.balance)} 일시 상환`;
      }
      results.replaceChildren(
        el('div', { class: 'tiles' }, [
          tile(payLabel, payValue, paySub),
          tile('남은 총 이자', won(base.totalInterest), `총 상환 ${man(base.totalPaid)}`),
          tile('완납 예정', ymLabel(base.endYm), `${duration(base.months)} 남음`),
        ])
      );

      // 추가 상환 결과
      if (loan.extra > 0) {
        const saved = base.totalInterest - plan.totalInterest;
        const cut = base.months - plan.months;
        extraOut.replaceChildren(
          el('div', { class: 'tiles' }, [
            tile('완납 앞당김', cut > 0 ? `${duration(cut)} 단축` : '변동 없음', `${ymLabel(plan.endYm)} 완납`, 'good'),
            tile('아끼는 이자', won(saved), `총 이자 ${won(plan.totalInterest)}`, 'good'),
            tile('매달 내는 돈', won(plan.firstTotal), `정기 ${comma(plan.firstPayment)} + 추가 ${comma(planRows[0].extra)}`),
          ])
        );
      } else {
        extraOut.replaceChildren(el('p', { class: 'muted small' }, '슬라이더를 움직여 추가 상환 효과를 확인하세요.'));
      }
      chartBox.replaceChildren(balanceChart(baseRows, planRows, loan.balance, loan.startYm));

      // 목표 완납
      const t = loan.targetMonths;
      if (!t) {
        targetOut.replaceChildren();
      } else {
        const need = Loan.requiredExtra(loan, t);
        if (need === 0) {
          targetOut.replaceChildren(el('p', { class: 'callout good' }, `추가 상환 없이도 ${duration(base.months)} 안에 끝납니다.`));
        } else {
          const r = Loan.summarize(Loan.schedule(loan, need));
          const applyBtn = el('button', { type: 'button', class: 'btn small' }, '이 금액을 추가 상환액으로 적용');
          applyBtn.addEventListener('click', () => {
            loan.extra = need;
            extraInp.value = comma(need);
            slider.value = Math.min(need, SLIDER_MAX);
            commit();
          });
          targetOut.replaceChildren(
            el('div', { class: 'callout' }, [
              el('div', {}, [`${duration(t)} 안에 갚으려면 매달 `, el('strong', {}, won(need)), ' 추가 상환']),
              el('div', { class: 'muted small' }, `첫 달 총 납입 ${won(r.firstTotal)} · ${ymLabel(r.endYm)} 완납 · 이자 ${won(base.totalInterest - r.totalInterest)} 절감`),
              applyBtn,
            ])
          );
        }
      }

      if (details.open) schedBox.replaceChildren(scheduleTable(planRows));
    }

    const card = el('article', { class: 'card loan-card' }, [
      el('div', { class: 'card-head' }, [
        nameInp,
        el('button', {
          type: 'button', class: 'link-btn danger',
          onclick: () => { if (confirm(`'${loan.name || '대출'}'을(를) 삭제할까요?`)) onDelete(loan); },
        }, '삭제'),
      ]),
      el('div', { class: 'grid2' }, [
        field('남은 대출 잔액 (원)', moneyInput(loan.balance, (n) => { loan.balance = n; commit(); })),
        field('연 금리 (%)', rateInp),
        field('남은 기간 (개월)', monthsInp, monthsHint),
        field('다음 상환월', startInp),
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'field-label' }, '상환 방식'),
        U.segmented(Loan.METHODS, loan.method, (k) => { loan.method = k; commit(); }),
      ]),
      results,
      planBlocks,
    ]);
    update();
    return card;
  }

  /* ---------- 전체 요약 ---------- */

  function summaryCard() {
    const box = el('section', { class: 'card summary' });
    function refresh() {
      const loans = Store.state.loans;
      const valid = loans.filter(Loan.isValid);
      const total = loans.reduce((s, l) => s + (l.balance || 0), 0);
      let monthly = 0, interest = 0, end = null;
      for (const l of valid) {
        const s = Loan.summarize(Loan.schedule(l, l.extra));
        monthly += s.firstTotal;
        interest += s.totalInterest;
        if (!end || s.endYm > end) end = s.endYm;
      }
      box.replaceChildren(...[
        el('div', { class: 'summary-label' }, '갚아야 할 돈'),
        el('div', { class: 'summary-value' }, won(total)),
        valid.length
          ? el('div', { class: 'summary-row' }, [
              el('div', {}, [el('span', {}, '이번 달 납입'), el('strong', {}, won(monthly))]),
              el('div', {}, [el('span', {}, '남은 이자'), el('strong', {}, won(interest))]),
              el('div', {}, [el('span', {}, '완납 예상'), el('strong', {}, ymLabel(end))]),
            ])
          : null,
        valid.length && valid.length < loans.length
          ? el('div', { class: 'summary-note' }, '정보가 다 입력된 대출만 합산했습니다.')
          : null,
      ].filter(Boolean));
    }
    refresh();
    return { node: box, refresh };
  }

  /* ---------- 화면 렌더 ---------- */

  function render(root) {
    const state = Store.state;
    const summary = summaryCard();
    const list = el('div', { class: 'loan-list' });

    const handlers = {
      onChange: summary.refresh,
      onDelete: (loan) => {
        state.loans = state.loans.filter((l) => l.id !== loan.id);
        Store.save();
        render(root);
      },
    };
    state.loans.forEach((l) => list.append(loanCard(l, handlers)));

    const addBtn = el('button', { type: 'button', class: 'btn ghost block-btn' }, '+ 대출 추가');
    addBtn.addEventListener('click', () => {
      state.loans.push(newLoan(`대출 ${state.loans.length + 1}`));
      Store.save();
      render(root);
      root.querySelector('.loan-card:last-of-type')?.scrollIntoView({ behavior: 'smooth' });
    });

    root.replaceChildren(
      el('header', { class: 'page-head' }, [el('h1', {}, '대출 상환')]),
      summary.node,
      list,
      addBtn,
      el('p', { class: 'footnote' }, '월 이자 = 잔액 × 연 금리 ÷ 12로 계산한 예상치입니다. 은행의 일할 계산·중도상환수수료에 따라 실제 금액과 다를 수 있습니다.')
    );
  }

  return { render, newLoan, seedLoans };
})();
