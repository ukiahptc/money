/* 상환 계획: 정규 납입은 그대로 두고, 매달 여유분을 한 대출에 몰아 추가 상환하는 시뮬레이션
 *
 * state.plan = { monthly, buffer, order }
 * - monthly: 매달 빚에 넣을 총액(정규 납입 포함). 비우면 월급 예정액 − 생활 예산으로 추정
 * - buffer:  통장에 남겨둘 최소 금액. 이번 달 추가 상환액 = min(계획 여유분, 실제 쓸 수 있는 돈 − buffer)
 * - order:   'auto' = 금리 높은 순이되, 만기일시 대출은 만기 전에 끝나도록 앞으로 당김 / 'rate' = 금리 순만
 * - maturityFrom: 'cash' = 만기 잔액도 매달 여유분으로 미리 모음 / 'invest' = 만기에 투자 자산을 회수해 갚음
 */
const Plan = (() => {
  const st = () => Store.state;
  const settings = () => st().plan || (st().plan = { monthly: 0, buffer: 300000, order: 'auto', maturityFrom: 'cash' });

  // 월급 예정액 − (이번 달 예산 합계 − 대출 상환 예산). 예산이 없으면 월급의 절반
  function defaultMonthly() {
    const ym = Ledger.thisMonth();
    const income = st().planned?.income || 0;
    const b = st().budgets[ym] || {};
    const living = Object.entries(b).filter(([k]) => k !== 'loan').reduce((s, [, v]) => s + v, 0);
    return Math.max(0, income - (living || Math.round(income / 2)));
  }

  function monthly() {
    return settings().monthly > 0 ? settings().monthly : defaultMonthly();
  }

  // 시뮬레이션용 대출 복제. 원리금균등은 고정 납입액, 만기일시는 이자만
  function snapshot() {
    return st().loans.filter(Loan.isValid).map((l) => {
      const r = l.rate / 100 / 12;
      const n = Math.floor(l.months);
      const pay = l.method === 'annuity' ? Loan.annuityPayment(l.balance, r, n)
        : l.method === 'equal' ? null : 0;
      return {
        id: l.id, name: l.name, rate: l.rate, method: l.method, b: l.balance, r,
        pay, fixedPrincipal: l.method === 'equal' ? Math.ceil(l.balance / n) : 0,
        startYm: l.startYm, endYm: Loan.addMonths(l.startYm, n - 1),
      };
    });
  }

  // 한 달 진행. order = 우선순위 id 배열. 돌려주는 값: 그달 내역
  function step(loans, ym, pool, order, fromInvest) {
    let interest = 0, regular = 0, fromInvestTotal = 0; const extra = []; const balloon = {};
    for (const l of loans) {
      if (l.b <= 0 || ym < l.startYm) continue;
      const i = Math.round(l.b * l.r); interest += i; pool -= i;
      let p = 0;
      if (l.method === 'annuity') p = Math.min(l.b, l.pay - i);
      else if (l.method === 'equal') p = Math.min(l.b, l.fixedPrincipal);
      if (ym === l.endYm && l.b - p > 0) { // 만기에는 남은 잔액 전부
        const rest = l.b - p;
        balloon[l.id] = rest;
        if (fromInvest) { fromInvestTotal += rest; l.b = 0; regular += p; pool -= p; continue; } // 투자 회수로 갚음 → 현금에서 안 뺌
        p = l.b;
      }
      l.b -= p; regular += p; pool -= p;
    }
    for (const id of order) {
      const l = loans.find((x) => x.id === id);
      if (!l || l.b <= 0 || pool <= 0) continue;
      const p = Math.min(l.b, pool);
      l.b -= p; pool -= p;
      extra.push({ id, name: l.name, amount: p, done: l.b === 0 });
    }
    return { interest, regular, extra, balloon, fromInvest: fromInvestTotal, left: pool, remaining: loans.reduce((s, l) => s + Math.max(0, l.b), 0) };
  }

  function simulate(order, monthlyAmount, firstMonthAmount) {
    const loans = snapshot();
    const fromInvest = settings().maturityFrom === 'invest';
    const rows = []; let ym = Ledger.thisMonth(); let total = 0, investTotal = 0;
    for (let k = 0; k < 120 && loans.some((l) => l.b > 0); k++) {
      const pool = k === 0 && firstMonthAmount != null ? firstMonthAmount : monthlyAmount;
      const s = step(loans, ym, pool, order, fromInvest);
      total += s.interest; investTotal += s.fromInvest;
      rows.push({ ym, ...s, loans: loans.map((l) => ({ id: l.id, b: Math.max(0, l.b) })) });
      ym = Ledger.shiftMonth(ym, 1);
    }
    // 투자 회수 예정: 만기월별 금액
    const investEvents = rows.filter((r) => r.fromInvest > 0).map((r) => ({ ym: r.ym, amount: r.fromInvest, loans: Object.keys(r.balloon) }));
    return { rows, totalInterest: total, endYm: rows.length ? rows[rows.length - 1].ym : null, months: rows.length, investTotal, investEvents };
  }

  // 금리 순으로 시작해, 만기일시 대출이 만기를 못 지키면 한 칸씩 앞으로 당긴다
  function autoOrder(monthlyAmount) {
    const loans = snapshot();
    let order = loans.slice().sort((a, b) => b.rate - a.rate).map((l) => l.id);
    for (let guard = 0; guard < 50; guard++) {
      const sim = simulate(order, monthlyAmount);
      // 만기월에 잔액을 한 번에 갚느라 그달 돈이 모자라면(left < 0) 만기를 못 지킨 것
      const miss = loans.find((l) => l.method === 'bullet' && sim.rows.some((r) => r.ym === l.endYm && r.left < 0 && r.balloon[l.id] > 0));
      if (!miss) break;
      const i = order.indexOf(miss.id);
      if (i <= 0) break;
      [order[i - 1], order[i]] = [order[i], order[i - 1]];
    }
    return order;
  }

  function order(monthlyAmount) {
    const s = settings();
    // 만기를 투자 회수로 막으면 굳이 앞당길 필요가 없어 금리순
    if (s.order === 'rate' || s.maturityFrom === 'invest') return snapshot().sort((a, b) => b.rate - a.rate).map((l) => l.id);
    return autoOrder(monthlyAmount);
  }

  // 이번 달 요약: 계획상 추가 상환 vs 현금 흐름 기준 가능액
  function thisMonth() {
    const m = monthly();
    const ord = order(m);
    const base = simulate(ord, m);
    const first = base.rows[0];
    const plannedExtra = first ? first.extra.reduce((s, e) => s + e.amount, 0) : 0;
    const cash = Cash.summary(Ledger.thisMonth());
    const buffer = settings().buffer || 0;
    // 현금 흐름의 "실제 쓸 수 있는 돈"은 이미 정규 납입(남은 것)을 뺀 값 → 여기서 버퍼만 더 빼면 추가 상환 가능액
    const affordable = cash.available == null ? null : Math.max(0, cash.available - buffer);
    const extraNow = affordable == null ? plannedExtra : Math.min(plannedExtra, affordable);
    const actual = simulate(ord, m, first ? first.interest + first.regular + extraNow : m);
    return {
      monthly: m, buffer, order: ord, plannedExtra, affordable, extraNow, cashAvailable: cash.available,
      first, target: first?.extra[0] || null, base, actual,
      regularOnly: simulate(ord, 0),
    };
  }

  return { settings, defaultMonthly, monthly, order, simulate, thisMonth };
})();
