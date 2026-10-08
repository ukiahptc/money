/* 가계부 데이터: 카테고리 정의 + 기록 조회·집계 */
const Ledger = (() => {
  const CATEGORIES = {
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

  function catLabel(type, id) {
    return (CATEGORIES[type] || []).find((c) => c.id === id)?.label || '기타';
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

  return { CATEGORIES, TYPES, catLabel, today, thisMonth, shiftMonth, dateLabel, ofMonth, totals, byCategory, groupByDate };
})();

if (typeof module !== 'undefined') module.exports = Ledger;
