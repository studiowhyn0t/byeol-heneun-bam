import { pipeline, isDay, publicStar, send, fail } from './_lib.js';

// 공유 링크로 들어온 사람에게 별 하나만 돌려줍니다 (저장소 명령 1번, CDN이 5분 동안 대신 응답)
export default async function handler(req, res) {
  try {
    const q = req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams);
    const d = String(q.d || ''), i = String(q.i || '');
    if (!isDay(d) || !/^[A-Za-z0-9]{4,40}$/.test(i)) return send(res, 400, { error: 'bad_request' });
    const [raw, cfg] = await pipeline([['HGET', 'd:' + d, i], ['GET', 'config']]);
    let s = null; try { s = raw ? JSON.parse(raw) : null; } catch {}
    if (!s || s.hidden) return send(res, 404, { error: 'not_found' });
    let theme = ''; try { theme = (JSON.parse(cfg || '{}').themes || {})[d] || ''; } catch {}
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ star: publicStar({ ...s, day: d }), theme });
  } catch (e) {
    fail(res, e);
  }
}
