/* =========================================================
   SiteMaker AI — посредник между сайтом и Gemini (Cloudflare Worker)
   Ключ Gemini хранится здесь в секретах и не виден посетителям сайта.

   Как подключить (5 минут, бесплатно):
   1. dash.cloudflare.com → зарегистрируйтесь → Workers & Pages → Create → Create Worker
   2. Нажмите Deploy, затем Edit code → удалите всё и вставьте этот файл → Deploy
   3. Settings → Variables and Secrets → Add → тип Secret,
      имя GEMINI_KEY, значение — ваш ключ Gemini (AQ....) → Save / Deploy
   4. Скопируйте адрес воркера (https://....workers.dev) и вставьте в index.html:
      найдите  proxy: ''  и впишите  proxy: 'https://....workers.dev'
   ========================================================= */

const ALLOWED_ORIGINS = [
  'https://sitemarke.github.io',   // ваш сайт на GitHub Pages
  'http://localhost:5500',         // Live Server в VS Code (для проверки)
  'http://127.0.0.1:5500'
];
const ALLOWED_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_BODY = 60000; // байт — защита от слишком больших запросов

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'POST') return new Response('SiteMaker AI proxy работает', { headers: cors(origin) });
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden origin', { status: 403, headers: cors(origin) });
    if (!env.GEMINI_KEY) return new Response('GEMINI_KEY не задан в Settings → Variables', { status: 500, headers: cors(origin) });

    const url = new URL(request.url);
    const model = url.searchParams.get('model') || ALLOWED_MODELS[0];
    if (!ALLOWED_MODELS.includes(model)) return new Response('Model not allowed', { status: 400, headers: cors(origin) });

    const body = await request.text();
    if (body.length > MAX_BODY) return new Response('Too large', { status: 413, headers: cors(origin) });

    const stream = url.searchParams.get('stream') === '1';
    const target = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
      body
    });
    return new Response(res.body, {
      status: res.status,
      headers: { ...cors(origin), 'Content-Type': res.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' }
    });
  }
};
