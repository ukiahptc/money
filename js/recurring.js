/* 고정 지출: 매달 같은 날 같은 금액이 빠지는 지출(구독·통신·보험·대출 자동이체)
 *
 * state.recurring = [{ id, name, amount, day, category, pay, startYm, endYm, active }]
 * - 날짜가 되면 가계부에 자동으로 기록한다 (entry.recurringId 로 표시, 중복 기록 안 함)
 * - 아직 안 빠진 이번 달 건은 현금 흐름 예측(카드값·현금)에 미리 잡힌다
 * - 월말보다 큰 day(예: 31일)는 그 달 마지막 날로 본다
 */
const Recurring = (() => {
  const st = () => Store.state;
  const list = () => st().recurring || (st().recurring = []);

  function dateOf(ym, day) {
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${ym}-${String(Math.min(day, last)).padStart(2, '0')}`;
  }

  function activeIn(r, ym) {
    return r.active !== false && r.startYm <= ym && (!r.endYm || ym <= r.endYm);
  }

  function save(r) {
    const items = list();
    const i = items.findIndex((x) => x.id === r.id);
    i >= 0 ? (items[i] = r) : items.push(r);
    Store.save();
  }

  function remove(id, alsoEntries) {
    st().recurring = list().filter((x) => x.id !== id);
    if (alsoEntries) st().entries = st().entries.filter((e) => e.recurringId !== id);
    Store.save();
  }

  // 날짜가 지난 건을 가계부에 기록. 돌려주는 값: 새로 기록한 건수
  function postDue() {
    const today = Ledger.today();
    const nowYm = today.slice(0, 7);
    const have = new Set(st().entries.filter((e) => e.recurringId).map((e) => e.recurringId + '@' + e.date.slice(0, 7)));
    let n = 0;
    for (const r of list()) {
      if (r.active === false) continue;
      for (let ym = r.startYm; ym <= nowYm; ym = Ledger.shiftMonth(ym, 1)) {
        if (r.endYm && ym > r.endYm) break;
        const date = dateOf(ym, r.day);
        if (date > today || have.has(r.id + '@' + ym)) continue;
        st().entries.push({
          id: U.uid(), type: 'expense', amount: r.amount, category: r.category, memo: r.name,
          date, pay: r.pay, recurringId: r.id, createdAt: Date.now(),
        });
        n++;
      }
    }
    if (n) Store.save();
    return n;
  }

  // 이번 달에 아직 안 빠진 고정 지출 (예측용). 대출 상환은 현금 흐름이 따로 계산하므로 제외
  function upcoming(ym) {
    const today = Ledger.today();
    const posted = new Set(st().entries.filter((e) => e.recurringId && e.date.startsWith(ym)).map((e) => e.recurringId));
    const out = { card: [], cash: [], cardTotal: 0, cashTotal: 0 };
    for (const r of list()) {
      if (!activeIn(r, ym) || posted.has(r.id) || r.category === 'loan') continue;
      const date = dateOf(ym, r.day);
      if (ym === today.slice(0, 7) && date <= today) continue; // 날짜 지났는데 미기록이면 postDue가 처리
      const item = { id: r.id, name: r.name, amount: r.amount, date };
      if (r.pay === 'cash') { out.cash.push(item); out.cashTotal += r.amount; }
      else { out.card.push(item); out.cardTotal += r.amount; }
    }
    return out;
  }

  function monthlyTotal(ym) {
    return list().filter((r) => activeIn(r, ym)).reduce((s, r) => s + r.amount, 0);
  }

  return { list, save, remove, postDue, upcoming, monthlyTotal, dateOf, activeIn };
})();
