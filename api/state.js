import { pipeline, kstDay, publicStar, send, parseHash } from './_lib.js';

// 최근 4일의 별과 사이트 설정을 돌려줍니다.
export default async function handler(req, res) {
  try {
    const days = [0, 1, 2, 3].map(o => kstDay(-o));
    const results = await pipeline([...days.map(d => ['HGETALL', 'd:' + d]), ['GET', 'config']]);
    const stars = [];
    days.forEach((d, i) => parseHash(results[i]).forEach(s => stars.push(publicStar({ ...s, day: d }))));
    let config = {};
    try { config = JSON.parse(results[days.length] || '{}') || {}; } catch {}
    send(res, 200, { today: days[0], stars, config });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
