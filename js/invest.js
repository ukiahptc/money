/* 투자 자산: 거래소·계좌 평가액을 손으로 기록하고 순자산을 계산한다.
 * state.investments = [{ id, name, unit: 'USDT'|'KRW', amount, locked, rate, principal, updatedAt, history: [{date, value}] }]
 * - amount: 보유 수량 (KRW면 원화 금액)
 * - locked: 그중 환전·출금이 안 되는 수량 (증정금 등). 순자산에는 넣지 않는다
 * - rate: 단위당 원화 (KRW면 1). 손으로 입력
 * - principal: 실제로 넣은 내 돈 (원). 손익 = 환전 가능 평가액 − principal
 */
const Invest = (() => {
  const st = () => Store.state;
  const list = () => st().investments || (st().investments = []);

  function valueOf(inv) {
    const rate = inv.unit === 'KRW' ? 1 : inv.rate || 0;
    const total = Math.round((inv.amount || 0) * rate);
    const locked = Math.round((inv.locked || 0) * rate);
    return { total, locked, free: total - locked, profit: total - locked - (inv.principal || 0) };
  }

  function save(inv) {
    const items = list();
    const i = items.findIndex((x) => x.id === inv.id);
    inv.updatedAt = Date.now();
    inv.history = inv.history || [];
    const v = valueOf(inv).free;
    const today = Ledger.today();
    const last = inv.history[inv.history.length - 1];
    if (last && last.date === today) last.value = v; else inv.history.push({ date: today, value: v });
    if (inv.history.length > 90) inv.history.splice(0, inv.history.length - 90);
    i >= 0 ? (items[i] = inv) : items.push(inv);
    Store.save();
  }

  function remove(id) {
    st().investments = list().filter((x) => x.id !== id);
    Store.save();
  }

  // 순자산 = 현금 + 환전 가능 투자 − 대출 잔액(스케줄 기준 현재)
  function netWorth(nowYm) {
    const cash = Cash.now() || 0;
    const invs = list().map((inv) => ({ inv, ...valueOf(inv) }));
    const invFree = invs.reduce((s, x) => s + x.free, 0);
    const invLocked = invs.reduce((s, x) => s + x.locked, 0);
    const principal = invs.reduce((s, x) => s + (x.inv.principal || 0), 0);
    const stocks = typeof Stocks !== 'undefined' ? Stocks.total() : { value: 0, cost: 0 };
    const debt = st().loans.filter(Loan.isValid).reduce((s, l) => s + DashboardView.loanProgress(l, nowYm).current, 0);
    return {
      cash, invFree, invLocked, principal, profit: invFree - principal,
      stocks: stocks.value, stocksCost: stocks.cost, stocksProfit: stocks.value - stocks.cost,
      debt, net: cash + invFree + stocks.value - debt, items: invs,
    };
  }

  return { list, valueOf, save, remove, netWorth };
})();
