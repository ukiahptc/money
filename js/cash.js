/* 현금 흐름: 보유 금액 + 신용카드 청구 + 예정 수입
 *
 * - state.cash = { amount, asOf, at }     보유 금액 스냅샷. at(밀리초)보다 나중에 기록한 것만 반영
 *                                         날짜가 아니라 기록 시각으로 비교해야 같은 날 입력한 지출도 빠진다
 * - 가계부 entry.pay = 'card' | 'cash'     신용카드 결제는 다음 달 청구, 현금·체크는 즉시 빠짐
 * - state.cardBills[ym] = { paidOn, paidAt } ym월 카드 사용분 청구서를 결제한 날·시각 (없으면 미결제)
 * - state.planned = { income }            매달 들어올 예정 금액(월급). 실제 수입을 기록하면 그 달은 실제값 사용
 */
const Cash = (() => {
  const st = () => Store.state;

  // 카드 사용분을 월별로 합산
  function cardUsageByMonth() {
    const map = {};
    for (const e of st().entries) {
      if (e.type === 'expense' && (e.pay || 'card') === 'card') {
        const ym = e.date.slice(0, 7);
        map[ym] = (map[ym] || 0) + e.amount;
      }
    }
    return map;
  }

  // 청구서 목록 (오래된 달부터). 사용월 ym → 결제월 ym+1
  function bills() {
    const usage = cardUsageByMonth();
    return Object.keys(usage).sort().map((ym) => {
      const b = st().cardBills[ym] || {};
      return { ym, payYm: Ledger.shiftMonth(ym, 1), amount: usage[ym], paidOn: b.paidOn || null, paidAt: b.paidAt || 0 };
    });
  }

  function unpaidBills() {
    return bills().filter((b) => !b.paidOn);
  }

  function markPaid(ym, paid) {
    if (paid) st().cardBills[ym] = { paidOn: Ledger.today(), paidAt: Date.now() };
    else delete st().cardBills[ym];
    Store.save();
  }

  function setCash(amount) {
    st().cash = { amount: Math.floor(amount), asOf: Ledger.today(), at: Date.now() };
    Store.save();
  }

  function setPlannedIncome(amount) {
    st().planned = { ...st().planned, income: Math.floor(amount) };
    Store.save();
  }

  function setPayday(day) {
    st().planned = { ...st().planned, payday: Math.min(31, Math.max(0, Math.floor(day))) };
    Store.save();
  }

  // 스냅샷 시각. 옛 백업처럼 at이 없으면 asOf 날짜의 끝으로 본다
  function snapshotAt(c) {
    return c.at || (Date.parse(c.asOf + 'T23:59:59') || 0);
  }

  // 스냅샷 이후에 기록한 움직임을 반영한 현재 보유 금액 추정
  function now() {
    const c = st().cash;
    if (!c) return null;
    const at = snapshotAt(c);
    const today = Ledger.today();
    let v = c.amount;
    for (const e of st().entries) {
      if (e.date > today) continue; // 미리 적어둔 예정 지출(자동이체 등)은 그 날짜가 돼야 빠진다
      // 스냅샷 뒤에 기록했거나, 스냅샷 날짜보다 뒤의 날짜면 스냅샷에 안 들어간 움직임
      if ((e.createdAt || 0) <= at && e.date <= c.asOf) continue;
      if (e.type === 'income') v += e.amount;
      else if ((e.pay || 'card') === 'cash') v -= e.amount;
    }
    for (const b of bills()) if (b.paidOn && b.paidAt > at) v -= b.amount;
    return v;
  }

  // 대시보드용 요약
  function summary(nowYm) {
    const c = st().cash;
    const cur = now();
    const unpaid = unpaidBills();
    const unpaidTotal = unpaid.reduce((s, b) => s + b.amount, 0);
    // 이번 달에 아직 안 빠진 고정 지출: 카드는 다음 달 카드값, 현금은 바로 차감 예정
    const up = typeof Recurring !== 'undefined' ? Recurring.upcoming(nowYm) : { card: [], cash: [], cardTotal: 0, cashTotal: 0 };
    const monthEntries = Ledger.ofMonth(st().entries, nowYm);
    const incomeSoFar = Ledger.totals(monthEntries).income;
    const planned = st().planned?.income || 0;
    // '급여'를 아직 안 받았으면 예정액을 더한다 (환급·정산 같은 소액 수입은 월급으로 치지 않음)
    const salaryIn = monthEntries.some((e) => e.type === 'income' && e.category === 'salary');
    // 월급일이 지났는데 급여 기록이 없으면 이미 받은 달(앱 시작 전)로 보고 더하지 않는다
    const payday = st().planned?.payday || 0;
    const todayDay = Number(Ledger.today().slice(8, 10));
    const paydayPassed = payday > 0 && nowYm === Ledger.thisMonth() && todayDay > payday;
    const incomeToCome = salaryIn || paydayPassed ? 0 : planned;
    // 이번 달 대출 납입 중 아직 안 낸 금액 (가계부 '대출 상환' 기록만큼 차감)
    const loanDue = st().loans.filter(Loan.isValid).reduce((s, l) => {
      const row = Loan.schedule(l, l.extra).find((r) => r.ym === nowYm);
      return s + (row ? row.payment : 0);
    }, 0);
    const todayStr = Ledger.today();
    const loanPaid = monthEntries.filter((e) => e.type === 'expense' && e.category === 'loan' && e.date <= todayStr).reduce((s, e) => s + e.amount, 0);
    const loanLeft = Math.max(0, loanDue - loanPaid);
    return {
      hasCash: !!c, asOf: c?.asOf || null, current: cur,
      unpaid, unpaidTotal, incomeToCome, incomeSoFar, loanDue, loanPaid, loanLeft, paydayPassed: paydayPassed && !salaryIn,
      upcomingCard: up.card, upcomingCardTotal: up.cardTotal, upcomingCash: up.cash, upcomingCashTotal: up.cashTotal,
      available: cur == null ? null : cur - unpaidTotal - up.cardTotal - up.cashTotal - loanLeft + incomeToCome,
    };
  }

  return { bills, unpaidBills, markPaid, setCash, setPlannedIncome, setPayday, now, summary, cardUsageByMonth };
})();
