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

// ---- 쪽지 자동 숨김: 자살·자해 암시, 소수자 혐오 표현 ----
// 걸린 쪽지는 쓴 사람 화면에서만 보이고 다른 사람에겐 보이지 않습니다. 관리자 화면에서 붉게 표시되고 다시 공개할 수 있어요.
// 단어를 더하거나 빼려면 아래 목록만 고치면 됩니다. (띄어쓰기·기호를 지운 뒤 비교)
const SELF_HARM = [
  '자살', '자해', '죽고싶', '죽고십', '주고싶', '죽여줘', '죽여주세요', '죽어버리', '죽어야겠', '죽을래', '죽으려', '죽을거야', '살기싫', '살고싶지않', '그만살', '사라지고싶',
  '뛰어내리', '목매', '목을매', '손목긋', '손목을긋', '극단적선택', '유서를쓰', '유서써', '수면제모아', '번개탄',
  'suicide', 'suicidal', 'killmyself', 'killme', 'wanttodie', 'wannadie', 'wanttodie', 'gonnadie', 'endmylife', 'endit all'.replace(' ', ''), 'endingmylife',
  'selfharm', 'cutmyself', 'dontwanttolive', 'donotwanttolive', 'dontwannalive', 'wishiwasdead', 'wishiweredead', 'betteroffdead',
  '죽을래', '죽고파', '죽고시퍼', '죽어버릴', '죽어야지', '살기싫어', '살고싶지않아', '자살하', '목숨끊',
];
const HATE = [
  '똥꼬충', '게이새끼', '호모새끼', '레즈충', '트젠충', '트랜스충', '변태성욕자', '한남충', '김치녀', '된장녀', '맘충', '틀딱', '급식충', '장애충', '병신',
  '짱깨', '쪽바리', '깜둥이', '흑형', '똥남아', '조선족새끼', '홍어새끼', '홍어족', '개독', '난민새끼',
  'nigger', 'nigga', 'faggot', 'fag', 'tranny', 'retard', 'chink', 'kike',
];
// 다른 언어 (띄어쓰기 없이 적기). 일상어와 겹쳐 오판이 잦은 말은 일부러 넣지 않았어요.
const SELF_HARM_INTL = [
  // 일본어
  '死にたい', '死にたく', '自殺', '自傷', '消えたい', '殺して', '生きたくない', '飛び降り', 'リスカ', '首吊り',
  // 중국어
  '想死', '自杀', '自残', '自殘', '不想活', '活不下去', '杀了我', '殺了我', '跳楼', '跳樓', '割腕',
  // 스페인어·포르투갈어·프랑스어·이탈리아어 (suicid- 는 공통)
  'suicid', 'quieromorir', 'mequieromorir', 'matarme', 'noquierovivir', 'acabarconmivida', 'autolesi',
  'queromorrer', 'mematar', 'naoqueroviver', 'nãoqueroviver', 'automutil',
  'jeveuxmourir', 'enviedemourir', 'metuer', 'plusenviedevivre',
  'vogliomorire', 'uccidermi', 'nonvogliopiuvivere', 'nonvogliopiùvivere',
  // 독일어
  'ichwillsterben', 'selbstmord', 'suizid', 'michumbringen', 'nichtmehrleben', 'selbstverletz',
  // 베트남어·태국어·인도네시아어
  'muốnchết', 'tựtử', 'tựsát', 'tựhại', 'khôngmuốnsống',
  'อยากตาย', 'ฆ่าตัวตาย', 'ไม่อยากมีชีวิต', 'ทำร้ายตัวเอง',
  'inginmati', 'pengenmati', 'maumati', 'bunuhdiri', 'tidakinginhidup', 'gamauhidup',
  // 러시아어
  'хочуумереть', 'суицид', 'самоубий', 'убейменя', 'нехочужить', 'покончитьссобой',
];
const HATE_INTL = [
  'バカチョン', 'チョン公', '支那人', 'ガイジ', 'キチガイ', 'ホモ野郎', 'オカマ野郎',
  '黑鬼', '死基佬', '人妖', '高丽棒子', '高麗棒子', '小日本', '支那', '残废', '殘廢', '弱智', '阿三',
  'maricón', 'maricon', 'sudaca', 'negrata', 'bollera',
  'pédé', 'tarlouze', 'bougnoule', 'youpin', 'bamboula',
  'schwuchtel', 'kanake', 'neger', 'spast', 'zigeuner',
  'sapatão', 'traveco', 'retardado',
  'bêđê', 'pêđê', 'ไอ้ตุ๊ด', 'ปัญญาอ่อน', 'banci', 'bencong',
  'пидор', 'пидорас', 'хохлы', 'чурка', 'жиды', 'жидов',
  'frocio', 'ricchione', 'terrone', 'mongoloide', 'ritardato',
];
SELF_HARM.push(...SELF_HARM_INTL.map(w => w.normalize('NFC').toLowerCase()));
HATE.push(...HATE_INTL.map(w => w.normalize('NFC').toLowerCase()));
const norm = s => String(s || '').toLowerCase().normalize('NFC').replace(/[\s\p{P}\p{S}_]+/gu, '');
export function moderate(text) {
  const t = norm(text);
  if (SELF_HARM.some(w => t.includes(w))) return 'selfharm';
  if (HATE.some(w => t.includes(w))) return 'hate';
  return null;
}
