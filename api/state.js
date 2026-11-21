import { pipeline, kstDay, publicStar, send, parseHash, fail } from './_lib.js';

// 최근 4일의 별과 사이트 설정을 돌려줍니다.
export default async function handler(req, res) {
  try {
    const days = [0, 1, 2, 3].map(o => kstDay(-o));
    const results = await pipeline([...days.map(d => ['HGETALL', 'd:' + d]), ['GET', 'config']]);
    const stars = [];
    days.forEach((d, i) => parseHash(results[i]).forEach(s => stars.push(publicStar({ ...s, day: d }))));
    let config = {};
    try { config = JSON.parse(results[days.length] || '{}') || {}; } catch {}
    res.setHeader('Cache-Control', 'no-store');
    send(res, 200, { today: days[0], stars, config });
  } catch (e) {
    fail(res, e);
  }
}
