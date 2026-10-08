/* 앱 진입점: 탭 전환 */
(() => {
  const VIEWS = {
    dashboard: DashboardView,
    ledger: LedgerView,
    budget: BudgetView,
    loan: LoanView,
  };

  const view = document.getElementById('view');
  const tabs = document.querySelectorAll('.tab');

  function show(tab) {
    if (!VIEWS[tab]) tab = 'loan';
    Store.state.ui.tab = tab;
    Store.save();
    tabs.forEach((t) => t.setAttribute('aria-current', t.dataset.tab === tab ? 'page' : 'false'));
    VIEWS[tab].render(view);
    window.scrollTo(0, 0);
  }

  Store.load();
  if (!Store.state.loans.length && !Store.state.entries.length) {
    Seed.apply(Store.state);
    Store.save();
  }
  // 오프라인·홈 화면 앱용 (file:// 로 열면 지원 안 됨)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  show(Store.state.ui.tab);
})();
