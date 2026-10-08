/* 앱 진입점: 탭 전환 */
(() => {
  const { el } = U;

  const placeholder = (title, section) => ({
    render(root) {
      root.replaceChildren(
        el('header', { class: 'page-head' }, [el('h1', {}, title)]),
        el('div', { class: 'card empty-card' }, [
          el('p', {}, `섹션 ${section}에서 추가될 화면입니다.`),
        ])
      );
    },
  });

  const VIEWS = {
    dashboard: placeholder('대시보드', 4),
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
  if (!Store.state.loans.length) {
    Store.state.loans.push(LoanView.newLoan());
    Store.save();
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  show(Store.state.ui.tab);
})();
