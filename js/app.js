/* 앱 진입점: 탭 전환, 서비스 워커 */
const APP_VERSION = 'v19'; // sw.js의 CACHE 버전과 맞춘다
(() => {
  const VIEWS = {
    dashboard: DashboardView,
    ledger: LedgerView,
    budget: BudgetView,
    assets: AssetsView,
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
  Recurring.postDue(); // 날짜 지난 고정 지출을 가계부에 기록
  const firstRun = !Store.state.loans.length && !Store.state.entries.length && !Store.state.cash;
  if (firstRun) {
    Store.state.loans.push(...LoanView.seedLoans());
    Store.state.ui.tab = 'dashboard';
    Store.save();
  }
  // 오프라인·홈 화면 앱용 (file:// 로 열면 지원 안 됨)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then((reg) => reg.update().catch(() => {})).catch(() => {});
    // 새 버전이 설치돼 제어권이 바뀌면 한 번만 새로고침 (처음 설치 때는 제외)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !sessionStorage.getItem('sw-reloaded')) {
        sessionStorage.setItem('sw-reloaded', '1');
        location.reload();
      }
    });
    sessionStorage.removeItem('sw-reloaded');
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  show(Store.state.ui.tab);
  if (firstRun && !Store.state.ui.setupDone) SetupView.open(() => show('dashboard'));
})();
