import crypto from 'node:crypto';

// Upstash Redis (Vercel Marketplace 연동 시 아래 환경변수가 자동으로 생깁니다)
// 접두사(prefix)가 붙어 있어도 찾을 수 있게 이름 끝부분으로 찾습니다.
function findEnv(re, not) {
  for (const [k, v] of Object.entries(process.env)) if (v && re.test(k) && !(not && not.test(k))) return v;
  return undefined;
}
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  || findEnv(/(KV_REST_API_URL|REDIS_REST_URL)$/);
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  || findEnv(/(KV_REST_API_TOKEN|REDIS_REST_TOKEN)$/, /READ_ONLY/);

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
  if (!URL_ || !TOKEN) throw new Error('storage_not_configured');
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
  // Vercel이 직접 넣어주는 x-real-ip를 우선 사용 (사용자가 꾸며내기 어려움)
  return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
}

// 간단한 요청 제한: key 기준 sec초 동안 max회
export async function allow(key, max, sec) {
  const k = 'rl:' + key;
  // 만료시간이 항상 붙도록: 없을 때만 만료 포함해 만들고, 그다음 증가
  const [, n] = await pipeline([['SET', k, '0', 'EX', String(sec), 'NX'], ['INCR', k]]);
  return n <= max;
}
export async function count(key) { return Number(await redis('GET', 'rl:' + key)) || 0; }
export async function bump(key, sec) { await pipeline([['SET', 'rl:' + key, '0', 'EX', String(sec), 'NX'], ['INCR', 'rl:' + key]]); }
export function fail(res, e) { console.error(e); send(res, 500, { error: 'server_error' }); }

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
