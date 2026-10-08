/* 섹션 5: 백업·복원 (JSON 전체, CSV 가계부) */
const Backup = (() => {
  function download(filename, text, mime) {
    const blob = new Blob(['﻿' + text], { type: mime + ';charset=utf-8' }); // BOM: 엑셀 한글 깨짐 방지
    const url = URL.createObjectURL(blob);
    const a = U.el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stamp = () => Ledger.today().replace(/-/g, '');

  function exportJson() {
    const data = { ...Store.state, exportedAt: new Date().toISOString() };
    download(`money-backup-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
  }

  function csvCell(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    const rows = [['날짜', '구분', '카테고리', '금액', '메모']];
    const sorted = [...Store.state.entries].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
    for (const e of sorted) {
      rows.push([e.date, Ledger.TYPES[e.type], Ledger.catLabel(e.type, e.category), e.amount, e.memo || '']);
    }
    download(`money-ledger-${stamp()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  }

  // 파일 선택 → 내용 검사 → 교체. onDone(요약 문자열)
  function importJson(onDone) {
    const input = U.el('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.loans) || !Array.isArray(data.entries)) throw new Error('형식');
        const cur = Store.state;
        const msg =
          `백업 파일: 대출 ${data.loans.length}건, 가계부 ${data.entries.length}건\n` +
          `현재 데이터: 대출 ${cur.loans.length}건, 가계부 ${cur.entries.length}건\n\n` +
          '현재 데이터를 백업 파일로 바꿉니다. 되돌릴 수 없습니다. 계속할까요?';
        if (!confirm(msg)) return;
        delete data.exportedAt;
        Store.replace(data);
        onDone(`가계부 ${data.entries.length}건을 불러왔습니다.`);
      } catch (e) {
        alert('백업 파일을 읽을 수 없습니다. 이 앱에서 내보낸 JSON 파일인지 확인해 주세요.');
      }
    });
    input.click();
  }

  function resetAll(onDone) {
    if (!confirm('모든 데이터(대출·가계부·예산·카테고리)를 지웁니다. 되돌릴 수 없습니다.\n먼저 백업을 내보내셨나요?')) return;
    if (!confirm('정말 지울까요?')) return;
    Store.replace({ loans: [], entries: [] });
    onDone();
  }

  return { exportJson, exportCsv, importJson, resetAll };
})();
