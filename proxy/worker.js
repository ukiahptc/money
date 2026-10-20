/* 시세 프록시 — Cloudflare Workers용 (무료 플랜으로 충분)
 *
 * 브라우저가 네이버 시세 API를 직접 못 부르므로(CORS), 이 워커가 대신 받아서 넘겨준다.
 * 허용한 주소(네이버 시세, 업비트)만 중계하고, 그 외 URL은 거부한다.
 *
 * 배포: README의 "시세 프록시 만들기" 절차 참고. 배포 후 워커 주소를
 *       앱 → 자산 탭 → 설정 → "시세 프록시 URL"에 넣는다.
 * 호출: GET https://<워커주소>/?url=<인코딩한 원본 URL>
 */
const ALLOW = [
  'https://polling.finance.naver.com/api/realtime/domestic/stock/',
  'https://m.stock.naver.com/api/stock/',
  'https://api.upbit.com/v1/',
];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const target = new URL(request.url).searchParams.get('url') || '';
    if (!ALLOW.some((p) => target.startsWith(p))) {
      return new Response(JSON.stringify({ error: 'not allowed' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    try {
      const upstream = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cf: { cacheTtl: 10 } });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...CORS, 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
  },
};
