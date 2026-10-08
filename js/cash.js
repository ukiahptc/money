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

  // 스냅샷 시각. 옛 백업처럼 at이 없으면 asOf 날짜의 끝으로 본다
  function snapshotAt(c) {
    return c.at || (Date.parse(c.asOf + 'T23:59:59') || 0);
  }

  // 스냅샷 이후에 기록한 움직임을 반영한 현재 보유 금액 추정
  function now() {
    const c = st().cash;
    if (!c) return null;
    const at = snapshotAt(c);
    let v = c.amount;
    for (const e of st().entries) {
      if ((e.createdAt || 0) <= at) continue;
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
    const incomeSoFar = Ledger.totals(Ledger.ofMonth(st().entries, nowYm)).income;
    const planned = st().planned?.income || 0;
    // 월급을 아직 안 받았으면 예정액을 더한다
    const incomeToCome = incomeSoFar > 0 ? 0 : planned;
    return {
      hasCash: !!c, asOf: c?.asOf || null, current: cur,
      unpaid, unpaidTotal, incomeToCome, incomeSoFar,
      available: cur == null ? null : cur - unpaidTotal + incomeToCome,
    };
  }

  return { bills, unpaidBills, markPaid, setCash, setPlannedIncome, now, summary, cardUsageByMonth };
})();
