import crypto from 'node:crypto';

// Upstash Redis (Vercel Marketplace 연동 시 아래 환경변수가 자동으로 생깁니다)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export async function redis(...cmd) {
  if (!URL_ || !TOKEN) throw new Error('storage_not_configured');
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export async function pipeline(cmds) {
  if (!cmds.length) return [];
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  return j.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

export const kstDay = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offsetDays * 86400000));

export const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

const SALT = process.env.PIN_SALT || 'byeol-heneun-bam';
export const pinHash = (id, pin) => crypto.createHash('sha256').update(`${SALT}|${id}|${pin}`).digest('hex');

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

// 간단한 요청 제한: key 기준 sec초 동안 max회
export async function allow(key, max, sec) {
  const k = 'rl:' + key;
  const n = await redis('INCR', k);
  if (n === 1) await redis('EXPIRE', k, sec);
  return n <= max;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function publicStar(s) {
  const { pin, ...rest } = s;
  return rest;
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function parseHash(arr) {
  // HGETALL 결과 [field, value, field, value ...] → 객체 배열
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < arr.length; i += 2) {
    try { out.push(JSON.parse(arr[i + 1])); } catch {}
  }
  return out;
}
