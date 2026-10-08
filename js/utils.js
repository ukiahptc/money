/* 공통 유틸: 숫자 포맷, DOM 생성 */
const U = {
  comma(n) {
    return Math.round(n).toLocaleString('ko-KR');
  },
  won(n) {
    return U.comma(n) + '원';
  },
  // 8,000,000 → "800만원", 12,345,678 → "1,234.6만원"
  man(n) {
    if (Math.abs(n) < 10000) return U.won(n);
    const v = Math.round(n / 1000) / 10;
    return v.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만원';
  },
  parseNum(s) {
    const v = Number(String(s).replace(/[^\d.]/g, ''));
    return Number.isFinite(v) ? v : 0;
  },
  ymLabel(ym) {
    if (!ym) return '-';
    const [y, m] = ym.split('-');
    return `${y}년 ${Number(m)}월`;
  },
  ymShort(ym) {
    const [y, m] = ym.split('-');
    return `${y.slice(2)}.${m}`;
  },
  // 개월 수 → "1년 6개월"
  duration(months) {
    const y = Math.floor(months / 12), m = months % 12;
    if (!y) return `${m}개월`;
    return m ? `${y}년 ${m}개월` : `${y}년`;
  },
  // 세그먼트 버튼: options = {key: label}
  segmented(options, current, onChange) {
    const wrap = U.el('div', { class: 'seg', role: 'group' });
    for (const [key, label] of Object.entries(options)) {
      const b = U.el('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(key === current) }, label);
      b.addEventListener('click', () => {
        wrap.querySelectorAll('.seg-btn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        onChange(key);
      });
      wrap.append(b);
    }
    return wrap;
  },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
  // el('div', {class:'x', onclick:fn}, [child, '텍스트'])
  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'value') node.value = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  },
};
