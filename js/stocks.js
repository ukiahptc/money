/* 주식 보유 종목과 시세 조회
 * state.stocks = [{ id, code, name, qty, avgPrice, price, priceAt, source }]
 * state.settings = { proxyUrl }
 *
 * 한국 주식 시세(네이버)는 브라우저에서 직접 못 부르므로(CORS) 프록시를 거친다.
 * 1순위: 설정에 적은 내 프록시(Cloudflare Worker 등, proxy/worker.js 참고)
 * 2순위: 공개 프록시 몇 곳을 순서대로 시도. 자주 죽으므로 전부 실패하면 마지막 값을 유지한다.
 */
const Stocks = (() => {
  const st = () => Store.state;
  const list = () => st().stocks || (st().stocks = []);
  const settings = () => st().settings || (st().settings = { proxyUrl: '' });

  const NAVER = (code) => `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`;
  const PUBLIC_PROXIES = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://cors.eu.org/${u}`,
    (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  ];

  function proxyChain(url) {
    const own = (settings().proxyUrl || '').trim();
    const chain = [];
    if (own) chain.push(own.includes('?') ? `${own}&url=${encodeURIComponent(url)}` : `${own}?url=${encodeURIComponent(url)}`);
    return chain.concat(PUBLIC_PROXIES.map((f) => f(url)));
  }

  async function fetchJson(url, ms = 8000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  // 네이버 응답 → { price, name, change, ratio, time }
  function parseNaver(json) {
    const d = json?.datas?.[0];
    if (!d || !d.closePrice) throw new Error('형식');
    return {
      price: Number(String(d.closePrice).replace(/,/g, '')),
      name: d.stockName,
      change: Number(String(d.compareToPreviousClosePrice || '0').replace(/,/g, '')) * (d.compareToPreviousPrice?.code === '5' ? -1 : 1),
      ratio: Number(d.fluctuationsRatio || 0),
      time: d.localTradedAt || null,
      market: d.stockExchangeType?.nameKor || '',
    };
  }

  // 종목 하나 시세. 성공한 경로를 돌려줘서 화면에 표시
  async function quote(code) {
    let lastErr = null;
    for (const url of proxyChain(NAVER(code))) {
      try {
        const q = parseNaver(await fetchJson(url));
        q.via = url.startsWith((settings().proxyUrl || '').trim() || '\u0000') ? '내 프록시' : new URL(url).hostname;
        return q;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('시세 조회 실패');
  }

  // 업비트 USDT 원화 시세. CORS는 열려 있지만 Safari 등에서 직접 호출이 막히는 경우가 있어
  // 실패하면 프록시(내 프록시 → 공개 프록시)로 다시 시도한다
  const UPBIT = 'https://api.upbit.com/v1/ticker?markets=KRW-USDT';
  async function usdtKrw() {
    let lastErr = null;
    for (const url of [UPBIT, ...proxyChain(UPBIT)]) {
      try {
        const j = await fetchJson(url);
        const price = Number(j?.[0]?.trade_price);
        if (price > 0) return price;
        throw new Error('형식');
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('USDT 시세 조회 실패');
  }

  function save(s) {
    const items = list();
    const i = items.findIndex((x) => x.id === s.id);
    i >= 0 ? (items[i] = s) : items.push(s);
    Store.save();
  }

  function remove(id) {
    st().stocks = list().filter((x) => x.id !== id);
    Store.save();
  }

  function valueOf(s) {
    const value = Math.round((s.qty || 0) * (s.price || 0));
    const cost = Math.round((s.qty || 0) * (s.avgPrice || 0));
    return { value, cost, profit: value - cost, ratio: cost ? ((value - cost) / cost) * 100 : 0 };
  }

  function total() {
    return list().reduce((a, s) => { const v = valueOf(s); a.value += v.value; a.cost += v.cost; return a; }, { value: 0, cost: 0 });
  }

  // 전 종목 + USDT 시세 갱신. 결과 요약을 돌려준다
  async function refreshAll() {
    const out = { ok: 0, fail: 0, errors: [], usdt: null };
    for (const s of list()) {
      try {
        const q = await quote(s.code);
        s.price = q.price; s.priceAt = Date.now(); s.source = q.via;
        if (!s.name) s.name = q.name;
        s.change = q.change; s.ratio = q.ratio;
        out.ok++;
      } catch (e) {
        out.fail++; out.errors.push(`${s.name || s.code}: ${e.message}`);
      }
    }
    try {
      const r = await usdtKrw();
      if (r) {
        out.usdt = r;
        for (const inv of Invest.list()) if (inv.unit === 'USDT') { inv.rate = r; inv.rateAt = Date.now(); Invest.save(inv); }
      }
    } catch (e) {
      out.errors.push('USDT: ' + e.message);
    }
    st().settings.lastRefresh = Date.now();
    Store.save();
    return out;
  }

  return { list, settings, quote, usdtKrw, save, remove, valueOf, total, refreshAll };
})();
