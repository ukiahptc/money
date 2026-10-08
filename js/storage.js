/* 데이터 저장 — 브라우저 localStorage (기기별 저장, 동기화 없음) */
const Store = (() => {
  const KEY = 'money.v1';
  const defaults = () => ({ version: 1, loans: [], entries: [], ui: { tab: 'loan' } });
  let state = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
    } catch (e) {
      state = defaults();
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* 사파리 개인정보 보호 모드 등에서는 저장이 안 될 수 있음 */
    }
  }

  return { load, save, get state() { return state; } };
})();
