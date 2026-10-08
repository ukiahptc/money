/* 첫 실행 기본 데이터 (2026-10-09 기준 실제 값)
 * 앱을 처음 열 때 한 번만 들어간다. 이미 데이터가 있으면 건드리지 않는다.
 * 같은 내용이 data/initial-data.json 에도 있어 "JSON 백업 불러오기"로 넣을 수도 있다.
 */
const Seed = (() => {
  const AS_OF = '2026-10-09';

  function entry(type, amount, category, memo, date, pay) {
    return { id: U.uid(), type, amount, category, memo, date, pay, createdAt: Date.now() };
  }

  function apply(state) {
    state.loans.push(...LoanView.seedLoans());

    // 보유 금액 (통장 잔액)
    state.cash = { amount: 5465910, asOf: AS_OF, at: Date.now() + 1 }; // 기본 데이터 기록보다 뒤 시각으로
    // 매달 들어올 월급 (약 300만원)
    state.planned = { income: 3000000 };

    // 9월 카드 사용분 → 10월 결제 예정. 카드 3장 합계 4,295,091원
    state.entries.push(
      entry('expense', 3085290, 'etc', '9월 카드값 (카드 1)', '2026-09-30', 'card'),
      entry('expense', 394031, 'etc', '9월 카드값 (카드 2)', '2026-09-30', 'card'),
      entry('expense', 815770, 'etc', '9월 카드값 (카드 3)', '2026-09-30', 'card'),
      // 10월 카드 사용분 (10/9까지) → 11월 결제. 합계 1,618,493원
      entry('expense', 1118701, 'etc', '10월 카드 사용 ~10/9 (카드 1)', AS_OF, 'card'),
      entry('expense', 99880, 'etc', '10월 카드 사용 ~10/9 (카드 2)', AS_OF, 'card'),
      entry('expense', 399912, 'etc', '10월 카드 사용 ~10/9 (카드 3)', AS_OF, 'card')
    );
    state.ui.tab = 'dashboard';
  }

  return { apply };
})();
