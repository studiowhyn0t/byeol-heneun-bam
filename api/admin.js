import { redis, pipeline, kstDay, isDay, clientIp, safeEqual, publicStar, send, parseHash, count, bump, fail } from './_lib.js';

// 관리자 기능: 비밀번호는 Vercel 환경변수 ADMIN_PASSWORD 에만 저장됩니다.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    const b = req.body || {};
    const ip = clientIp(req);
    const secret = process.env.ADMIN_PASSWORD;
    if (!secret) return send(res, 500, { error: 'ADMIN_PASSWORD not set' });
    // 한 접속지 30분 8회, 전체 1시간 40회 실패하면 잠시 잠금
    if ((await count('adminfail:' + ip)) >= 8 || (await count('adminfail:all')) >= 40)
      return send(res, 429, { error: 'too_many_attempts' });
    if (!safeEqual(String(b.password || ''), secret)) {
      await bump('adminfail:' + ip, 1800);
      await bump('adminfail:all', 3600);
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

    if (b.action === 'stats') {
      // 최근 30일 방문·별 개수 + 언어/유입 경로 합계
      const days = Array.from({ length: 30 }, (_, i) => kstDay(-i));
      const cmds = [];
      days.forEach(d => cmds.push(['PFCOUNT', 'uv:' + d], ['GET', 'pv:' + d], ['HLEN', 'd:' + d], ['HGETALL', 'lang:' + d], ['HGETALL', 'src:' + d]));
      cmds.push(['GET', 'trm:' + new Date().toISOString().slice(0, 7)]);
      cmds.push(['SMEMBERS', 'days']);
      const r = await pipeline(cmds);
      const toObj = a => { const o = {}; if (Array.isArray(a)) for (let i = 0; i < a.length; i += 2) o[a[i]] = Number(a[i + 1]) || 0; return o; };
      const rows = days.map((d, i) => ({ day: d, uv: Number(r[i * 5]) || 0, pv: Number(r[i * 5 + 1]) || 0, stars: Number(r[i * 5 + 2]) || 0,
        lang: toObj(r[i * 5 + 3]), src: toObj(r[i * 5 + 4]) }));
      const allDays = (r[r.length - 1] || []).sort();
      const trUsed = Number(r[r.length - 2]) || 0;
      let total = 0;
      if (allDays.length) { const n = await pipeline(allDays.map(d => ['HLEN', 'd:' + d])); total = n.reduce((a, x) => a + (Number(x) || 0), 0); }
      return send(res, 200, { rows, totalStars: total, firstDay: allDays[0] || null,
        tr: { used: trUsed, cap: Number(process.env.TRANSLATE_MONTHLY_CHARS) || 0, on: !!process.env.DEEPL_API_KEY } });
    }

    if (b.action === 'delete') {
      const items = Array.isArray(b.items) ? b.items.slice(0, 500) : [];
      const cmds = items.filter(it => isDay(it.day) && it.id).map(it => ['HDEL', 'd:' + it.day, String(it.id)]);
      await pipeline(cmds);
      return send(res, 200, { ok: true, deleted: cmds.length });
    }

    send(res, 400, { error: 'unknown_action' });
  } catch (e) {
    fail(res, e);
  }
}
