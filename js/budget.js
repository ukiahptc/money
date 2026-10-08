/* 소비 계획(예산) 계산. state.budgets[ym] = { 카테고리id: 월 예산(원) } */
const Budget = (() => {
  function of(ym) {
    const b = Store.state.budgets;
    if (!b[ym]) b[ym] = {};
    return b[ym];
  }

  function set(ym, catId, amount) {
    const b = of(ym);
    if (amount > 0) b[catId] = Math.floor(amount);
    else delete b[catId];
    Store.save();
  }

  function total(ym) {
    return Object.values(Store.state.budgets[ym] || {}).reduce((s, v) => s + v, 0);
  }

  // 가장 최근에 예산을 세운 달 (ym 이전)
  function latestBefore(ym) {
    return Object.keys(Store.state.budgets)
      .filter((k) => k < ym && total(k) > 0)
      .sort()
      .pop() || null;
  }

  function copyFrom(fromYm, toYm) {
    Store.state.budgets[toYm] = { ...Store.state.budgets[fromYm] };
    Store.save();
  }

  // 카테고리별 예산 vs 지출
  function status(ym) {
    const budget = Store.state.budgets[ym] || {};
    const spent = {};
    for (const e of Ledger.ofMonth(Store.state.entries, ym)) {
      if (e.type === 'expense') spent[e.category] = (spent[e.category] || 0) + e.amount;
    }
    const rows = Ledger.cats('expense').map((c) => {
      const b = budget[c.id] || 0, s = spent[c.id] || 0;
      return { id: c.id, label: c.label, budget: b, spent: s, left: b - s, ratio: b ? s / b : (s ? Infinity : 0) };
    });
    const totalBudget = rows.reduce((a, r) => a + r.budget, 0);
    const totalSpent = rows.reduce((a, r) => a + r.spent, 0);
    const unplanned = rows.filter((r) => !r.budget && r.spent).reduce((a, r) => a + r.spent, 0);
    return { rows, totalBudget, totalSpent, totalLeft: totalBudget - totalSpent, unplanned };
  }

  // 이번 달 예상 수입: 기록된 수입 → 예정 수입(월급) → 최근 3개월 중 가장 최근 수입 달
  function expectedIncome(ym) {
    const inc = (m) => Ledger.totals(Ledger.ofMonth(Store.state.entries, m)).income;
    const now = inc(ym);
    if (now > 0) return { amount: now, from: ym };
    const planned = Store.state.planned?.income || 0;
    if (planned > 0) return { amount: planned, from: 'planned' };
    for (let k = 1; k <= 3; k++) {
      const m = Ledger.shiftMonth(ym, -k);
      const v = inc(m);
      if (v > 0) return { amount: v, from: m };
    }
    return { amount: 0, from: null };
  }

  // 추가 상환 제안: 예상 수입 − 예산 총액 (양수일 때만)
  function suggestion(ym) {
    const income = expectedIncome(ym);
    const st = status(ym);
    const room = income.amount - st.totalBudget;
    const loan = Store.state.loans.find(Loan.isValid) || null;
    let effect = null;
    if (loan && room > 0) {
      const base = Loan.summarize(Loan.schedule(loan, 0));
      const plan = Loan.summarize(Loan.schedule(loan, room));
      effect = { months: base.months - plan.months, interest: base.totalInterest - plan.totalInterest, endYm: plan.endYm };
    }
    return { income, totalBudget: st.totalBudget, room, loan, effect };
  }

  return { of, set, total, latestBefore, copyFrom, status, expectedIncome, suggestion };
})();
