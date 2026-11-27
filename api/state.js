import { pipeline, kstDay, publicStar, send, parseHash, fail } from './_lib.js';

// 최근 4일의 별과 사이트 설정을 돌려줍니다.
// 저장소 사용량을 줄이려고 ① 날짜마다 최근 별 목록(r:날짜)만 읽고 ② 결과를 잠깐 기억해 두고 ③ CDN이 1분 동안 대신 응답해요.
const KEEP = [600, 400, 400, 400];   // 날짜별로 보내는 최근 별 수 (오늘, 어제, 그저께, 그끄저께)
let memo = null;                      // { at, body }

async function recentIds(day, keep) {
  const [ids, done] = await pipeline([['LRANGE', 'r:' + day, '0', String(keep - 1)], ['EXISTS', 'rb:' + day]]);
  if (Number(done)) return Array.isArray(ids) ? ids : [];
  // 이 기능 이전에 쌓인 날: 한 번만 전체를 읽어 최근 목록을 다시 만들어 둠
  const [arr] = await pipeline([['HGETALL', 'd:' + day]]);
  const all = parseHash(arr).sort((a, b) => (b.t || 0) - (a.t || 0)).map(s => String(s.id));
  const top = all.slice(0, 1000);
  const cmds = [['DEL', 'r:' + day]];
  if (top.length) cmds.push(['RPUSH', 'r:' + day, ...top], ['EXPIRE', 'r:' + day, String(40 * 86400)]);
  cmds.push(['SET', 'rb:' + day, '1', 'EX', String(40 * 86400)]);
  await pipeline(cmds);
  return top.slice(0, keep);
}

async function build() {
  const days = [0, 1, 2, 3].map(o => kstDay(-o));
  const idLists = await Promise.all(days.map((d, i) => recentIds(d, KEEP[i])));
  const cmds = days.map((d, i) => idLists[i].length ? ['HMGET', 'd:' + d, ...idLists[i]] : ['GET', 'none:x']);
  cmds.push(['GET', 'config'], ['HLEN', 'd:' + days[0]]);
  const results = await pipeline(cmds);
  const stars = [];
  days.forEach((d, i) => {
    if (!idLists[i].length) return;
    for (const raw of results[i] || []) { if (!raw) continue; let s; try { s = JSON.parse(raw); } catch { continue; }
      if (!s.hidden) stars.push(publicStar({ ...s, day: d })); }
  });
  let config = {};
  try { config = JSON.parse(results[days.length] || '{}') || {}; } catch {}
  // 카카오페이 송금 링크 (Vercel 환경변수 DONATE_KAKAO_URL, qr.kakaopay.com 주소만 허용)
  const dk = String(process.env.DONATE_KAKAO_URL || '').trim();
  const donate = /^https:\/\/qr\.kakaopay\.com\/[A-Za-z0-9]+$/.test(dk) ? { kakao: dk } : {};
  // 해외용 Ko-fi 링크 (환경변수 DONATE_KOFI_URL, ko-fi.com 주소만 허용)
  const kf = String(process.env.DONATE_KOFI_URL || '').trim();
  if (/^https:\/\/ko-fi\.com\/[A-Za-z0-9_]+\/?$/.test(kf)) donate.kofi = kf;
  return { today: days[0], stars, config, donate, count: Number(results[days.length + 1]) || 0 };
}

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (!memo || now - memo.at > 30000 || memo.body.today !== kstDay()) memo = { at: now, body: await build() };
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.status(200).json(memo.body);
  } catch (e) {
    fail(res, e);
  }
}
