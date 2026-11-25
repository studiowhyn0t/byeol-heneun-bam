import { pipeline, kstDay, publicStar, send, parseHash, fail } from './_lib.js';

// 최근 4일의 별과 사이트 설정을 돌려줍니다.
export default async function handler(req, res) {
  try {
    const days = [0, 1, 2, 3].map(o => kstDay(-o));
    const results = await pipeline([...days.map(d => ['HGETALL', 'd:' + d]), ['GET', 'config']]);
    const stars = [];
    days.forEach((d, i) => parseHash(results[i]).forEach(s => { if (!s.hidden) stars.push(publicStar({ ...s, day: d })); }));
    let config = {};
    try { config = JSON.parse(results[days.length] || '{}') || {}; } catch {}
    // 방문자가 많아도 저장소 조회는 10초에 한 번 정도로 줄이기 (Vercel CDN이 대신 응답)
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    // 카카오페이 송금 링크 (Vercel 환경변수 DONATE_KAKAO_URL, qr.kakaopay.com 주소만 허용)
    const dk = String(process.env.DONATE_KAKAO_URL || '').trim();
    const donate = /^https:\/\/qr\.kakaopay\.com\/[A-Za-z0-9]+$/.test(dk) ? { kakao: dk } : {};
    // 해외용 Ko-fi 링크 (환경변수 DONATE_KOFI_URL, ko-fi.com 주소만 허용)
    const kf = String(process.env.DONATE_KOFI_URL || '').trim();
    if (/^https:\/\/ko-fi\.com\/[A-Za-z0-9_]+\/?$/.test(kf)) donate.kofi = kf;
    res.status(200).json({ today: days[0], stars, config, donate });
  } catch (e) {
    fail(res, e);
  }
}
