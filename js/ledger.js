/* 가계부 데이터: 카테고리 정의 + 기록 조회·집계 */
const Ledger = (() => {
  // 기본 카테고리. 실제 목록은 Store.state.categories에 저장되고 앱 안에서 편집한다.
  const DEFAULT_CATEGORIES = {
    expense: [
      { id: 'food', label: '식비' },
      { id: 'cafe', label: '카페·간식' },
      { id: 'transport', label: '교통' },
      { id: 'housing', label: '주거·관리비' },
      { id: 'telecom', label: '통신' },
      { id: 'subscribe', label: '구독' },
      { id: 'shopping', label: '쇼핑' },
      { id: 'living', label: '생활용품' },
      { id: 'health', label: '의료·건강' },
      { id: 'leisure', label: '문화·여가' },
      { id: 'gift', label: '경조사·선물' },
      { id: 'edu', label: '자기계발' },
      { id: 'loan', label: '대출 상환' },
      { id: 'etc', label: '기타' },
    ],
    income: [
      { id: 'salary', label: '급여' },
      { id: 'side', label: '부수입' },
      { id: 'refund', label: '환급·캐시백' },
      { id: 'etc_in', label: '기타' },
    ],
  };
  const TYPES = { expense: '지출', income: '수입' };
  // 삭제할 수 없는 카테고리 (집계·대출 연동에 쓰임)
  const PROTECTED = ['etc', 'etc_in', 'loan'];

  function cats(type) {
    const all = (typeof Store !== 'undefined' && Store.state.categories) || DEFAULT_CATEGORIES;
    return all[type] || [];
  }

  function catLabel(type, id) {
    return cats(type).find((c) => c.id === id)?.label || '기타';
  }

  function addCategory(type, label) {
    const id = 'c_' + U.uid();
    const list = Store.state.categories[type];
    const etcIdx = list.findIndex((c) => PROTECTED.includes(c.id) && c.id.startsWith('etc'));
    const cat = { id, label };
    etcIdx >= 0 ? list.splice(etcIdx, 0, cat) : list.push(cat); // '기타'는 항상 마지막
    Store.save();
    return cat;
  }

  function renameCategory(type, id, label) {
    const c = cats(type).find((x) => x.id === id);
    if (c) { c.label = label; Store.save(); }
  }

  // 삭제하면 그 카테고리 기록·예산은 '기타'로 옮긴다
  function removeCategory(type, id) {
    if (PROTECTED.includes(id)) return false;
    const state = Store.state;
    const fallback = type === 'income' ? 'etc_in' : 'etc';
    state.categories[type] = cats(type).filter((c) => c.id !== id);
    for (const e of state.entries) if (e.type === type && e.category === id) e.category = fallback;
    if (state.budgets) for (const b of Object.values(state.budgets)) if (b[id] != null) { b[fallback] = (b[fallback] || 0) + b[id]; delete b[id]; }
    Store.save();
    return true;
  }

  function moveCategory(type, id, dir) {
    const list = Store.state.categories[type];
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    Store.save();
  }

  const pad = (n) => String(n).padStart(2, '0');
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const thisMonth = () => today().slice(0, 7);

  function shiftMonth(ym, k) {
    const [y, m] = ym.split('-').map(Number);
    const t = y * 12 + (m - 1) + k;
    return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
  }

  // "2026-10-08" → "10월 8일 (목)"
  function dateLabel(date) {
    const [y, m, d] = date.split('-').map(Number);
    const w = '일월화수목금토'[new Date(y, m - 1, d).getDay()];
    return `${m}월 ${d}일 (${w})`;
  }

  // 최신 날짜 → 최근 입력 순
  function ofMonth(entries, ym) {
    return entries
      .filter((e) => e.date.startsWith(ym))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  }

  function totals(list) {
    let income = 0, expense = 0, loan = 0;
    for (const e of list) {
      if (e.type === 'income') income += e.amount;
      else {
        expense += e.amount;
        if (e.category === 'loan') loan += e.amount;
      }
    }
    return { income, expense, loan, net: income - expense };
  }

  // 지출 카테고리별 합계, 큰 순서
  function byCategory(list) {
    const map = {};
    for (const e of list) if (e.type === 'expense') map[e.category] = (map[e.category] || 0) + e.amount;
    return Object.entries(map)
      .map(([id, amount]) => ({ id, label: catLabel('expense', id), amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  function groupByDate(list) {
    const groups = [];
    for (const e of list) {
      const g = groups[groups.length - 1];
      if (g && g.date === e.date) g.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    }
    return groups;
  }

  return { DEFAULT_CATEGORIES, TYPES, PROTECTED, cats, catLabel, addCategory, renameCategory, removeCategory, moveCategory, today, thisMonth, shiftMonth, dateLabel, ofMonth, totals, byCategory, groupByDate };
})();

if (typeof module !== 'undefined') module.exports = Ledger;
