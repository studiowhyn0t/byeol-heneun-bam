import crypto from 'node:crypto';
import { pipeline, kstDay, clientIp, allow, send, fail } from './_lib.js';

// 방문 기록: 접속지 정보는 날짜별 소금을 친 해시로만 세고(원래 주소는 저장 안 함), 언어·유입 경로는 개수만 셉니다.
const SALT = process.env.PIN_SALT || 'byeol-heneun-bam';
const LANGS = /^[a-z]{2,3}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    const ip = clientIp(req);
    if (!(await allow('hit:' + ip, 20, 600))) return send(res, 200, { ok: true });
    const day = kstDay();
    const b = req.body || {};
    const lang = LANGS.test(String(b.lang || '')) ? String(b.lang) : 'etc';
    const ua = String(req.headers['user-agent'] || '');
    const src = /Instagram/i.test(ua) ? 'instagram' : /Barcelona|Threads/i.test(ua) ? 'threads' : /KAKAOTALK/i.test(ua) ? 'kakao'
      : /FBAN|FBAV/i.test(ua) ? 'facebook' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile_web' : 'desktop_web';
    const who = crypto.createHash('sha256').update(`${SALT}|${day}|${ip}|${ua}`).digest('base64url').slice(0, 16);
    await pipeline([
      ['PFADD', 'uv:' + day, who],
      ['INCR', 'pv:' + day],
      ['HINCRBY', 'lang:' + day, lang, '1'],
      ['HINCRBY', 'src:' + day, src, '1'],
      ['SADD', 'hitdays', day],
    ]);
    send(res, 200, { ok: true });
  } catch (e) {
    fail(res, e);
  }
}
