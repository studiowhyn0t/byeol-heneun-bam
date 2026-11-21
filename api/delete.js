import { redis, pinHash, isDay, clientIp, allow, safeEqual, send, count, bump, fail } from './_lib.js';

// 내 별 지우기 (별을 붙일 때 정한 비밀번호 4자리로)
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    const { day, id, pin } = req.body || {};
    if (!isDay(day) || !id) return send(res, 400, { error: 'bad_request' });
    if (!(await allow('del:' + clientIp(req), 10, 300))) return send(res, 429, { error: 'slow_down' });
    const raw = await redis('HGET', 'd:' + day, String(id));
    if (!raw) return send(res, 404, { error: 'not_found' });
    const star = JSON.parse(raw);
    // 별 하나당 비밀번호를 5번 틀리면 1시간 동안 잠금 (여러 곳에서 맞혀보기 방지)
    if ((await count('pinfail:' + star.id)) >= 5) return send(res, 429, { error: 'locked' });
    if (!safeEqual(star.pin, pinHash(star.id, String(pin || '')))) {
      await bump('pinfail:' + star.id, 3600);
      return send(res, 403, { error: 'wrong_pin' });
    }
    await redis('HDEL', 'd:' + day, String(id));
    send(res, 200, { ok: true });
  } catch (e) {
    fail(res, e);
  }
}
