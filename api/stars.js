import crypto from 'node:crypto';
import { redis, pipeline, kstDay, pinHash, clientIp, allow, send, fail, moderate } from './_lib.js';

const num = (v, a, b, d = 0) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

// 새 종이별 붙이기
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    const b = req.body || {};
    const text = String(b.text || '').trim().slice(0, 60);
    const pin = String(b.pin || '');
    if (!text) return send(res, 400, { error: 'text' });
    if (!/^\d{4}$/.test(pin)) return send(res, 400, { error: 'pin' });
    if (!/^#[0-9a-fA-F]{6}$/.test(String(b.color || ''))) return send(res, 400, { error: 'color' });
    const ip = clientIp(req);
    // 한 접속지: 1분 6개, 하루 60개 (사이트 전체 개수 제한은 없음)
    if (!(await allow('post:' + ip, 6, 60))) return send(res, 429, { error: 'slow_down' });
    if (!(await allow('postday:' + ip, 60, 86400))) return send(res, 429, { error: 'slow_down' });

    const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const day = kstDay();
    const t = Date.now();
    const star = {
      id, text, color: b.color, t,
      x: num(b.x, 0, 1, 0.5), y: num(b.y, 0, 1, 0.5),
      rot: num(b.rot, -7, 7), tx: num(b.tx, -1, 1), ty: num(b.ty, -1, 1),
      pin: pinHash(id, pin),
    };
    const flag = moderate(text);
    if (flag) { star.hidden = true; star.flag = flag; }
    // r:날짜 = 최근 별 목록 (하늘에 보낼 것만 빠르게 읽기 위해, 최근 1000개만 유지)
    await pipeline([['HSET', 'd:' + day, id, JSON.stringify(star)], ['SADD', 'days', day], ['LPUSH', 'r:' + day, id], ['LTRIM', 'r:' + day, '0', '999'], ['EXPIRE', 'r:' + day, String(40 * 86400)]]);
    send(res, 200, flag ? { id, day, t, hidden: true, care: flag === 'selfharm' } : { id, day, t });
  } catch (e) {
    fail(res, e);
  }
}
