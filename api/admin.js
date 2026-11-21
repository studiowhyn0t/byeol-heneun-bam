import { redis, pipeline, kstDay, isDay, clientIp, allow, safeEqual, publicStar, send, parseHash } from './_lib.js';

// 관리자 기능: 비밀번호는 Vercel 환경변수 ADMIN_PASSWORD 에만 저장됩니다.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    const b = req.body || {};
    const ip = clientIp(req);
    const secret = process.env.ADMIN_PASSWORD;
    if (!secret) return send(res, 500, { error: 'ADMIN_PASSWORD not set' });
    const fails = Number(await redis('GET', 'rl:adminfail:' + ip)) || 0;
    if (fails >= 8) return send(res, 429, { error: 'too_many_attempts' });
    if (!safeEqual(String(b.password || ''), secret)) {
      await allow('adminfail:' + ip, 1000, 1800);
      return send(res, 403, { error: 'forbidden' });
    }

    if (b.action === 'check') return send(res, 200, { ok: true });

    if (b.action === 'config') {
      const c = b.config || {};
      const config = {
        lines: Array.isArray(c.lines) ? c.lines.map(s => String(s).slice(0, 60)).filter(Boolean).slice(0, 24) : [],
        themes: {},
        pos: {},
      };
      if (c.themes && typeof c.themes === 'object')
        for (const [k, v] of Object.entries(c.themes)) if (isDay(k) && v) config.themes[k] = String(v).slice(0, 40);
      if (c.pos && typeof c.pos === 'object')
        for (const L of ['wide', 'narrow']) if (Array.isArray(c.pos[L]))
          config.pos[L] = c.pos[L].slice(0, 24).map(p => [Number(p[0]) || 0, Number(p[1]) || 0]);
      await redis('SET', 'config', JSON.stringify(config));
      return send(res, 200, { ok: true, config });
    }

    if (b.action === 'list') {
      const day = isDay(b.day) ? b.day : kstDay();
      const [arr, days] = await pipeline([['HGETALL', 'd:' + day], ['SMEMBERS', 'days']]);
      return send(res, 200, { day, days: days || [], items: parseHash(arr).map(s => publicStar({ ...s, day })) });
    }

    if (b.action === 'delete') {
      const items = Array.isArray(b.items) ? b.items.slice(0, 500) : [];
      const cmds = items.filter(it => isDay(it.day) && it.id).map(it => ['HDEL', 'd:' + it.day, String(it.id)]);
      await pipeline(cmds);
      return send(res, 200, { ok: true, deleted: cmds.length });
    }

    send(res, 400, { error: 'unknown_action' });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
