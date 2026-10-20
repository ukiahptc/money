/* 섹션 6: 자산 탭 — 주식·코인 평가액, 시세 갱신, 순자산 */
const AssetsView = (() => {
  const { el, won, comma, parseNum } = U;
  let root = null;
  const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + won(Math.abs(v));
  const pct = (v) => (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  const fmtTime = (t) => t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  /* ---------- 코인·거래소 입력 시트 (대시보드에서 이동) ---------- */

  function openInvestSheet(inv, onDone) {
    const isNew = !inv;
    const d = inv ? { ...inv } : { id: U.uid(), name: '', unit: 'USDT', amount: 0, locked: 0, rate: 0, principal: 0 };
    let dlg;
    const err = el('p', { class: 'form-error', role: 'alert' });
    const numInp = (key, ph, decimal) => {
      const i = el('input', { type: 'text', inputmode: decimal ? 'decimal' : 'numeric', class: 'input num', placeholder: ph, value: d[key] ? (decimal ? d[key] : comma(d[key])) : '' });
      i.addEventListener('input', () => {
        const raw = i.value.replace(/[^\d.]/g, '');
        const n = decimal ? parseFloat(raw) : Math.floor(Number(raw));
        d[key] = Number.isFinite(n) ? n : 0;
        if (!decimal) i.value = d[key] ? comma(d[key]) : '';
      });
      return i;
    };
    const nameInp = el('input', { type: 'text', class: 'input', placeholder: '예: 거래소 선물 계정', value: d.name, maxlength: 20 });
    nameInp.addEventListener('input', () => { d.name = nameInp.value; });
    const amountInp = numInp('amount', '0', true), lockedInp = numInp('locked', '0', true);
    const rateInp = numInp('rate', '예: 1,350'), principalInp = numInp('principal', '내가 넣은 원화');
    const unitFields = el('div', { class: 'grid2' }, [
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '보유 수량'), amountInp]),
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '그중 출금 불가 (증정금 등)'), lockedInp]),
    ]);
    const rateField = el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '단가 (원, 거래소 원화 시세)'), rateInp, el('span', { class: 'field-hint' }, '평가액 = 수량 × 단가. 시세가 바뀌면 여기만 고치면 됩니다.')]);
    const syncUnit = () => { rateField.hidden = d.unit === 'KRW'; unitFields.querySelectorAll('.field-label')[0].textContent = d.unit === 'KRW' ? '평가액 (원)' : '보유 수량 (USDT)'; };
    const unitSeg = U.segmented({ USDT: 'USDT', KRW: '원화' }, d.unit, (k) => { d.unit = k; syncUnit(); });
    syncUnit();

    function saveIt() {
      if (!d.name.trim()) { err.textContent = '이름을 입력해 주세요.'; return; }
      if (!(d.amount > 0)) { err.textContent = '수량을 입력해 주세요.'; return; }
      if (d.unit !== 'KRW' && !(d.rate > 0)) { err.textContent = '단가를 입력해 주세요.'; return; }
      if (d.locked > d.amount) { err.textContent = '출금 불가 수량이 보유 수량보다 큽니다.'; return; }
      Invest.save(d); dlg.close(); onDone();
    }
    dlg = U.sheet('투자 자산', () =>
      el('form', { class: 'sheet-body', onsubmit: (e) => { e.preventDefault(); saveIt(); } }, [
        el('div', { class: 'sheet-head' }, [
          el('button', { type: 'button', class: 'link-btn', onclick: () => dlg.close() }, '취소'),
          el('strong', {}, isNew ? '투자 자산 추가' : '평가액 갱신'),
          el('button', { type: 'submit', class: 'link-btn strong' }, '저장'),
        ]),
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '이름'), nameInp]),
        el('div', { class: 'field' }, [el('span', { class: 'field-label' }, '단위'), unitSeg]),
        unitFields,
        rateField,
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '투자 원금 (원)'), principalInp, el('span', { class: 'field-hint' }, '실제로 넣은 내 돈. 손익은 출금 가능 평가액 − 원금으로 계산합니다.')]),
        err,
        isNew ? null : el('button', { type: 'button', class: 'btn danger-ghost block-btn', onclick: () => { if (confirm('이 투자 자산을 삭제할까요?')) { Invest.remove(d.id); dlg.close(); onDone(); } } }, '삭제'),
      ])
    );
  }


  /* ---------- 주식 입력 시트 ---------- */

  function openStockSheet(stock, onDone) {
    const isNew = !stock;
    const d = stock ? { ...stock } : { id: U.uid(), code: '', name: '', qty: 0, avgPrice: 0, price: 0 };
    let dlg;
    const err = el('p', { class: 'form-error', role: 'alert' });
    const info = el('p', { class: 'muted small', style: 'margin:0 0 8px' });
    const codeInp = el('input', { type: 'text', inputmode: 'numeric', class: 'input', placeholder: '예: 005930', value: d.code, maxlength: 6, 'aria-label': '종목코드' });
    const nameInp = el('input', { type: 'text', class: 'input', placeholder: '조회하면 자동 입력', value: d.name, maxlength: 20, 'aria-label': '종목명' });
    const num = (key, ph, decimal) => {
      const i = el('input', { type: 'text', inputmode: decimal ? 'decimal' : 'numeric', class: 'input num', placeholder: ph, value: d[key] ? (decimal ? d[key] : comma(d[key])) : '' });
      i.addEventListener('input', () => {
        const raw = i.value.replace(/[^\d.]/g, '');
        const n = decimal ? parseFloat(raw) : Math.floor(Number(raw));
        d[key] = Number.isFinite(n) ? n : 0;
        if (!decimal) i.value = d[key] ? comma(d[key]) : '';
      });
      return i;
    };
    const qtyInp = num('qty', '0', true), avgInp = num('avgPrice', '매수 평균단가'), priceInp = num('price', '현재가 (조회 또는 직접 입력)');
    codeInp.addEventListener('input', () => { d.code = codeInp.value.replace(/\D/g, ''); });
    nameInp.addEventListener('input', () => { d.name = nameInp.value; });

    const lookupBtn = el('button', { type: 'button', class: 'btn small', style: 'margin:0' }, '시세 조회');
    lookupBtn.addEventListener('click', async () => {
      if (d.code.length !== 6) { err.textContent = '종목코드 6자리를 입력해 주세요.'; return; }
      err.textContent = ''; lookupBtn.classList.add('busy'); info.textContent = '조회 중…';
      try {
        const q = await Stocks.quote(d.code);
        d.name = q.name; nameInp.value = q.name;
        d.price = q.price; priceInp.value = comma(q.price);
        d.change = q.change; d.ratio = q.ratio; d.priceAt = Date.now(); d.source = q.via;
        info.textContent = `${q.name} ${comma(q.price)}원 (${pct(q.ratio)}) · ${q.via} 경유`;
      } catch (e) {
        info.textContent = '';
        err.textContent = '시세를 못 가져왔습니다. 프록시가 막혀 있을 수 있어요. 현재가를 직접 입력하거나 설정의 프록시 URL을 확인하세요.';
      } finally {
        lookupBtn.classList.remove('busy');
      }
    });

    function saveIt() {
      if (d.code.length !== 6) { err.textContent = '종목코드 6자리를 입력해 주세요.'; return; }
      if (!d.name.trim()) { err.textContent = '종목명을 입력하거나 시세 조회를 눌러 주세요.'; return; }
      if (!(d.qty > 0)) { err.textContent = '보유 수량을 입력해 주세요.'; return; }
      if (!(d.price > 0)) { err.textContent = '현재가를 조회하거나 직접 입력해 주세요.'; return; }
      Stocks.save(d); dlg.close(); onDone();
    }
    dlg = U.sheet('주식 종목', () =>
      el('form', { class: 'sheet-body', onsubmit: (e) => { e.preventDefault(); saveIt(); } }, [
        el('div', { class: 'sheet-head' }, [
          el('button', { type: 'button', class: 'link-btn', onclick: () => dlg.close() }, '취소'),
          el('strong', {}, isNew ? '종목 추가' : '종목 수정'),
          el('button', { type: 'submit', class: 'link-btn strong' }, '저장'),
        ]),
        el('div', { class: 'grid2' }, [
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '종목코드 (6자리)'), codeInp]),
          el('div', { class: 'field' }, [el('span', { class: 'field-label' }, ' '), lookupBtn]),
        ]),
        info,
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '종목명'), nameInp]),
        el('div', { class: 'grid2' }, [
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '보유 수량 (주)'), qtyInp]),
          el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '평균 매수단가 (원)'), avgInp]),
        ]),
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '현재가 (원)'), priceInp, el('span', { class: 'field-hint' }, '증권사 앱의 현재가를 그대로 넣어도 됩니다. 시세 조회가 되면 자동으로 채워집니다.')]),
        err,
        isNew ? null : el('button', { type: 'button', class: 'btn danger-ghost block-btn', onclick: () => { if (confirm(`'${d.name}'을(를) 삭제할까요?`)) { Stocks.remove(d.id); dlg.close(); onDone(); } } }, '종목 삭제'),
      ])
    );
    if (isNew) codeInp.focus();
  }

  /* ---------- 카드 ---------- */

  function summaryCard(nowYm) {
    const n = Invest.netWorth(nowYm);
    const line = (label, v, cls) => el('div', { class: 'calc-line ' + (cls || '') }, [el('span', {}, label), el('strong', { class: 'num' }, v)]);
    return el('section', { class: 'card' }, [
      el('h3', {}, '순자산'),
      line('현금', won(n.cash)),
      line('+ 주식 평가액', won(n.stocks)),
      line('+ 코인·거래소 (출금 가능분)', won(n.invFree)),
      line('− 대출 잔액', won(n.debt)),
      line('= 순자산', sign(n.net), 'total' + (n.net < 0 ? ' neg' : '')),
    ]);
  }

  function refreshBar() {
    const s = Stocks.settings();
    const note = el('span', { class: 'refresh-note' }, s.lastRefresh ? `마지막 갱신 ${fmtTime(s.lastRefresh)}` : '시세를 아직 안 받았습니다');
    const btn = el('button', { type: 'button', class: 'btn small', style: 'margin:0' }, '시세 새로고침');
    btn.addEventListener('click', async () => {
      btn.classList.add('busy'); note.textContent = '받는 중…';
      const r = await Stocks.refreshAll();
      btn.classList.remove('busy');
      if (r.fail || r.errors.length) alert(`갱신 ${r.ok}건 성공, ${r.fail}건 실패\n${r.errors.join('\n')}\n\n실패한 종목은 항목을 눌러 현재가를 직접 넣을 수 있습니다.`);
      render(root);
    });
    return el('div', { class: 'refresh-bar' }, [note, btn]);
  }

  function stocksCard() {
    const list = Stocks.list();
    const t = Stocks.total();
    const rows = list.map((s) => {
      const v = Stocks.valueOf(s);
      const cls = s.ratio > 0 ? 'up' : s.ratio < 0 ? 'down' : '';
      return el('button', { type: 'button', class: 'stock-row', onclick: () => openStockSheet(s, () => render(root)) }, [
        el('div', { class: 'stock-top' }, [
          el('span', { class: 'stock-name' }, [s.name, el('small', {}, s.code)]),
          el('strong', { class: 'num' }, won(v.value)),
        ]),
        el('div', { class: 'stock-sub small' }, [
          el('span', { class: 'muted' }, `${s.qty}주 × ${comma(s.price)}원`),
          el('span', { class: cls }, s.ratio != null && s.priceAt ? `오늘 ${pct(s.ratio || 0)}` : ''),
        ]),
        el('div', { class: 'stock-sub small' }, [
          el('span', { class: v.profit >= 0 ? 'income' : 'neg' }, `평단 ${comma(s.avgPrice)} · 손익 ${sign(v.profit)} (${pct(v.ratio)})`),
          el('span', { class: 'muted' }, s.priceAt ? `${fmtTime(s.priceAt)}${s.source ? ' · ' + s.source : ''}` : '직접 입력'),
        ]),
      ]);
    });
    return el('section', { class: 'card' }, [
      el('div', { class: 'card-title' }, [
        el('h3', {}, '주식'),
        el('button', { type: 'button', class: 'link-btn', onclick: () => openStockSheet(null, () => render(root)) }, '+ 종목 추가'),
      ]),
      list.length ? el('div', { class: 'sum-grid', style: 'margin-bottom:6px' }, [
        el('div', {}, [el('span', {}, '평가액'), el('strong', {}, won(t.value))]),
        el('div', {}, [el('span', {}, '매수금액'), el('strong', {}, won(t.cost))]),
        el('div', {}, [el('span', {}, '손익'), el('strong', { class: t.value - t.cost >= 0 ? 'income' : 'neg' }, sign(t.value - t.cost))]),
      ]) : el('p', { class: 'muted small', style: 'margin:0' }, '종목코드·수량·평단을 넣으면 평가액과 손익이 순자산에 합산됩니다. 한국 주식은 네이버 시세를 프록시로 받아오고, 안 되면 직접 입력합니다.'),
      rows.length ? el('div', {}, rows) : null,
    ]);
  }

  function coinCard() {
    const n = Invest.netWorth(Ledger.thisMonth());
    const rows = n.items.map(({ inv, locked, free, profit }) => {
      const prev = (inv.history || []).slice(-2)[0];
      const delta = prev && inv.history.length > 1 ? free - prev.value : null;
      return el('button', { type: 'button', class: 'inv-row', onclick: () => openInvestSheet(inv, () => render(root)) }, [
        el('div', { class: 'inv-top' }, [el('span', { class: 'inv-name' }, inv.name), el('strong', { class: 'num' }, won(free))]),
        el('div', { class: 'inv-sub muted small' }, [
          inv.unit === 'KRW' ? null : `${inv.amount.toLocaleString('ko-KR')} ${inv.unit} × ${comma(inv.rate)}원${inv.rateAt ? ' (업비트 ' + fmtTime(inv.rateAt) + ')' : ''}`,
          locked ? ` · 출금 불가 ${won(locked)} 제외` : null,
        ]),
        el('div', { class: 'inv-sub small' }, [
          el('span', { class: profit >= 0 ? 'income' : 'neg' }, `원금 대비 ${sign(profit)}`),
          delta != null ? el('span', { class: 'muted' }, ` · 지난 기록 대비 ${sign(delta)}`) : null,
        ]),
      ]);
    });
    return el('section', { class: 'card' }, [
      el('div', { class: 'card-title' }, [
        el('h3', {}, '코인·거래소'),
        el('button', { type: 'button', class: 'link-btn', onclick: () => openInvestSheet(null, () => render(root)) }, '+ 추가'),
      ]),
      rows.length ? el('div', { class: 'inv-list', style: 'margin-top:0;border-top:0' }, rows)
        : el('p', { class: 'muted small', style: 'margin:0' }, 'USDT 수량·출금 불가 수량·원금을 넣으면 됩니다. USDT 원화 시세는 "시세 새로고침"으로 업비트에서 자동으로 받습니다.'),
    ]);
  }

  function settingsCard() {
    const s = Stocks.settings();
    const inp = el('input', { type: 'url', class: 'input', placeholder: 'https://xxx.workers.dev', value: s.proxyUrl || '', 'aria-label': '시세 프록시 URL' });
    inp.addEventListener('change', () => { s.proxyUrl = inp.value.trim(); Store.save(); });
    const testBtn = el('button', { type: 'button', class: 'btn ghost small', style: 'margin:0' }, '연결 테스트');
    const out = el('p', { class: 'muted small', style: 'margin:6px 0 0' });
    testBtn.addEventListener('click', async () => {
      s.proxyUrl = inp.value.trim(); Store.save();
      testBtn.classList.add('busy'); out.textContent = '삼성전자(005930)로 테스트 중…';
      try { const q = await Stocks.quote('005930'); out.textContent = `성공: ${q.name} ${comma(q.price)}원 · ${q.via} 경유`; }
      catch (e) { out.textContent = '실패: ' + e.message + '. URL을 확인하거나 README의 프록시 만들기 절차를 따라 주세요.'; }
      finally { testBtn.classList.remove('busy'); }
    });
    return el('details', { class: 'card', style: 'padding-top:12px' }, [
      el('summary', { style: 'cursor:pointer;font-weight:600' }, '시세 설정'),
      el('p', { class: 'muted small', style: 'margin:8px 0' }, '한국 주식 시세는 브라우저에서 직접 못 받아서 프록시가 필요합니다. 비워 두면 공개 프록시를 차례로 시도하는데 자주 끊깁니다. 안정적으로 쓰려면 README의 "시세 프록시 만들기"대로 내 프록시를 만들어 주소를 넣으세요.'),
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, '시세 프록시 URL'), inp]),
      testBtn, out,
    ]);
  }

  function render(r) {
    root = r;
    const nowYm = Ledger.thisMonth();
    root.replaceChildren(
      el('header', { class: 'page-head' }, [el('h1', {}, '자산')]),
      refreshBar(),
      summaryCard(nowYm),
      stocksCard(),
      coinCard(),
      settingsCard(),
      el('p', { class: 'footnote' }, '시세는 앱을 열고 "시세 새로고침"을 눌렀을 때만 받습니다. 네이버 시세는 장중 약간의 지연이 있고, 평가액은 참고용입니다.')
    );
  }

  return { render, openInvestSheet, openStockSheet };
})();
