import crypto from 'node:crypto';
import { redis, pipeline, clientIp, allow, send, fail } from './_lib.js';

// 쪽지·주제 번역 (DeepL). 같은 문장은 언어별로 한 번만 번역해서 저장해 둡니다.
// 환경변수: DEEPL_API_KEY (없으면 번역 없이 원문을 돌려줌)
//           TRANSLATE_MONTHLY_CHARS (한 달 번역 글자 상한, 기본 450000 = DeepL 무료 한도 안쪽)
const TARGETS = new Set(['AR', 'BG', 'CS', 'DA', 'DE', 'EL', 'EN-GB', 'EN-US', 'ES', 'ET', 'FI', 'FR', 'HE', 'HU', 'ID', 'IT', 'JA', 'KO',
  'LT', 'LV', 'NB', 'NL', 'PL', 'PT-BR', 'PT-PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TH', 'TR', 'UK', 'VI', 'ZH-HANS', 'ZH-HANT']);
const KEY = process.env.DEEPL_API_KEY || '';
// 한 달 상한: TRANSLATE_MONTHLY_CHARS 를 넣었을 때만 적용 (없으면 제한 없음, 사용량은 계속 셈)
const CAP = Number(process.env.TRANSLATE_MONTHLY_CHARS) || Infinity;
const TTL = 60 * 86400;

const h = (t, s) => 'tr:' + t + ':' + crypto.createHash('sha1').update(s).digest('base64url');
const hs = s => 'trsrc:' + crypto.createHash('sha1').update(s).digest('base64url');
const month = () => new Date().toISOString().slice(0, 7);

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    const { texts, target } = req.body || {};
    if (!TARGETS.has(target) || !Array.isArray(texts)) return send(res, 400, { error: 'bad_request' });
    const list = [...new Set(texts.filter(s => typeof s === 'string' && s.trim()).map(s => s.slice(0, 200)))].slice(0, 50);
    if (!list.length) return send(res, 200, { t: {} });
    if (!(await allow('tr:' + clientIp(req), 40, 60))) return send(res, 429, { error: 'slow_down' });

    const out = {}, src = {};
    const cached = await pipeline([...list.map(s => ['GET', h(target, s)]), ...list.map(s => ['GET', hs(s)])]);
    const miss = [];
    list.forEach((s, i) => { const sv = cached[list.length + i]; if (typeof sv === 'string') src[s] = sv;
      if (typeof cached[i] === 'string') out[s] = cached[i]; else miss.push(s); });

    if (miss.length && KEY) {
      const chars = miss.reduce((a, s) => a + s.length, 0);
      const mk = 'trm:' + month();
      const used = Number(await redis('GET', mk)) || 0;
      if (used + chars <= CAP) {
        await pipeline([['INCRBY', mk, String(chars)], ['EXPIRE', mk, String(40 * 86400)]]);
        // 무료 키(:fx)는 api-free, 그 밖은 api. 키 종류가 달라 거절되면 다른 주소로 한 번 더 시도
        const hosts = KEY.endsWith(':fx') ? ['https://api-free.deepl.com', 'https://api.deepl.com'] : ['https://api.deepl.com', 'https://api-free.deepl.com'];
        const call = host => fetch(host + '/v2/translate', {
          method: 'POST',
          headers: { Authorization: 'DeepL-Auth-Key ' + KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: miss, target_lang: target }),
        });
        let r = await call(hosts[0]);
        if (r.status === 403) r = await call(hosts[1]);
        if (r.ok) {
          const j = await r.json();
          const base = target.split('-')[0];
          const save = [];
          (j.translations || []).forEach((t, i) => {
            const src0 = miss[i];
            const det = String(t.detected_source_language || '').toUpperCase();
            const val = det === base ? src0 : String(t.text || src0).slice(0, 300);
            out[src0] = val;
            save.push(['SET', h(target, src0), val, 'EX', String(TTL)]);
            if (det) { src[src0] = det; save.push(['SET', hs(src0), det, 'EX', String(TTL)]); }
          });
          if (save.length) await pipeline(save);
        } else {
          console.error('deepl', r.status, await r.text().catch(() => ''));
        }
      }
    }
    send(res, 200, { t: out, s: src });
  } catch (e) {
    fail(res, e);
  }
}
