/* 대출 상환 계산 — 화면과 분리된 순수 함수 모음
 * 금액은 원 단위 정수로 다룬다. 월 이자 = 잔액 × 연이율 / 12 (반올림).
 * 은행마다 일할 계산·절사 방식이 달라 실제 청구액과 몇 원~몇백 원 차이가 날 수 있다.
 */
const Loan = (() => {
  const METHODS = { annuity: '원리금균등', equal: '원금균등', bullet: '만기일시' };

  function addMonths(ym, k) {
    const [y, m] = ym.split('-').map(Number);
    const t = y * 12 + (m - 1) + k;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  }

  function isValid(l) {
    return !!l && l.balance > 0 && l.months >= 1 &&
      Number.isFinite(l.rate) && l.rate >= 0 && l.rate < 100 &&
      /^\d{4}-\d{2}$/.test(l.startYm || '') && !!METHODS[l.method];
  }

  // 원리금균등 월 납입액
  function annuityPayment(P, r, n) {
    if (r === 0) return Math.ceil(P / n);
    const f = Math.pow(1 + r, n);
    return Math.ceil((P * r * f) / (f - 1));
  }

  // 월별 상환 스케줄. extra = 매달 추가 상환액(원금에 바로 반영 → 기간 단축)
  function schedule(l, extra = 0) {
    const r = l.rate / 100 / 12;
    const n = Math.floor(l.months);
    const pay = annuityPayment(l.balance, r, n);
    const fixedPrincipal = Math.ceil(l.balance / n);
    extra = Math.max(0, Math.floor(extra || 0));

    let bal = l.balance;
    const rows = [];
    for (let i = 1; i <= n && bal > 0; i++) {
      const interest = Math.round(bal * r);
      let principal =
        l.method === 'equal' ? fixedPrincipal :
        l.method === 'bullet' ? 0 :
        pay - interest;
      if (i === n) principal = bal; // 만기에는 남은 잔액 전부
      principal = Math.max(0, Math.min(principal, bal));
      const ex = Math.min(extra, bal - principal);
      bal -= principal + ex;
      rows.push({
        no: i, ym: addMonths(l.startYm, i - 1),
        principal, interest, extra: ex,
        payment: principal + interest + ex, balance: bal,
      });
    }
    return rows;
  }

  function summarize(rows) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    return {
      months: rows.length,
      endYm: last ? last.ym : null,
      totalInterest: rows.reduce((s, r) => s + r.interest, 0),
      totalPaid: rows.reduce((s, r) => s + r.payment, 0),
      firstPayment: first ? first.principal + first.interest : 0, // 추가상환 제외
      lastPayment: last ? last.principal + last.interest : 0,
      firstTotal: first ? first.payment : 0, // 추가상환 포함
    };
  }

  // 목표 개월 수 안에 끝내려면 매달 얼마를 더 갚아야 하는지 (1,000원 단위 올림)
  function requiredExtra(l, targetMonths) {
    if (!(targetMonths >= 1)) return null;
    if (schedule(l, 0).length <= targetMonths) return 0;
    let lo = 0, hi = Math.ceil(l.balance / 1000);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (schedule(l, mid * 1000).length <= targetMonths) hi = mid;
      else lo = mid + 1;
    }
    return hi * 1000;
  }

  return { METHODS, addMonths, isValid, annuityPayment, schedule, summarize, requiredExtra };
})();

if (typeof module !== 'undefined') module.exports = Loan;
