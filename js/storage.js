/* 데이터 저장 — 브라우저 localStorage (기기별 저장, 동기화 없음) */
const Store = (() => {
  const KEY = 'money.v1';
  const defaults = () => ({
    version: 1, loans: [], entries: [], budgets: {}, categories: null, ui: { tab: 'loan' },
  });
  let state = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
    } catch (e) {
      state = defaults();
    }
    migrate();
    return state;
  }

  // 기본 카테고리 채우기 (가져오기한 옛 데이터에도 적용)
  function migrate() {
    if (!state.categories) {
      state.categories = JSON.parse(JSON.stringify(Ledger.DEFAULT_CATEGORIES));
    }
    if (!state.budgets) state.budgets = {};
    if (!state.ui) state.ui = { tab: 'loan' };
  }

  // 백업 파일에서 통째로 교체
  function replace(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.loans) || !Array.isArray(data.entries)) {
      throw new Error('백업 파일 형식이 아닙니다.');
    }
    state = { ...defaults(), ...data };
    migrate();
    save();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* 사파리 개인정보 보호 모드 등에서는 저장이 안 될 수 있음 */
    }
  }

  return { load, save, replace, get state() { return state; } };
})();
