/*
 * Yu聿 讀後感 SEO 建置程式
 * ------------------------------------------------------------
 * Vercel 每次部署時會自動執行這支程式（設定寫在 vercel.json）：
 *   1. 把整個網站複製到 dist/
 *   2. 依 reads.json 為每本書產生 /book/<id>/index.html
 *   3. 產生讀後感書庫總表 /book/index.html
 *   4. 產生 sitemap.xml 與 robots.txt
 *
 * 平常只要更新 reads.json 上傳到 GitHub，就會自動長出新書的頁面。
 * 不需要安裝任何套件。
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://yu-reading.com';          // 網站正式網址（結尾不要加 /）
const BRAND = 'Yu聿';
const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const SKIP = new Set(['.git', '.github', '.vercel', 'node_modules', 'dist', 'build.js', 'vercel.json', 'package.json', 'package-lock.json', 'README.md', '.gitignore', '.DS_Store']);

const LINKS = {
  line: 'https://line.me/ti/g2/36DOh-WVhRweSjRsBYB60fqVSt74QQEZLzNZzw',
  spotify: 'https://open.spotify.com/show/6W7hP7f1xya9A0VV93mlxS',
  apple: 'https://share.google/6xTEZYe6vTM5lp05h',
  threads: 'https://www.threads.com/@tyty.1994',
  ig: 'https://www.instagram.com/tyty.1994',
  support: 'https://portaly.cc/tyty.1994/support',
  accu: 'https://www.accupass.com/organizer/detail/2509190923031367725696',
};
const RL = { 1: '不太適合我', 2: '享受過程', 3: '值得一讀', 4: '非常喜歡', 5: '一生必推' };
const CC = { '小說': '#7a4e33', '推理恐怖': '#3a4246', '人文社科': '#2f5a55', '漫畫繪本': '#d9a54a', '歷史': '#a5583e', '散文': '#7f8f6a', '哲學': '#4c3a2e', '心理學': '#5d6f78', '報導文學': '#8b5e6b', '自然科學': '#6f8f7a', '詩': '#c9b79c', '未分類': '#9a8f84' };

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const flat = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const cut = (s, n) => { const a = [...s]; return a.length > n ? a.slice(0, n).join('') + '…' : s; };
const stars = r => (String(r || '').match(/★/g) || []).length;
const abs = p => !p ? '' : /^https?:/.test(p) ? p : SITE + '/' + String(p).replace(/^\/+/, '');
const rel = p => !p ? '' : /^https?:|^\//.test(p) ? p : '/' + p;
const bookUrl = b => `/book/${b.id}/`;
const ld = o => JSON.stringify(o).replace(/</g, '\\u003c');
const tc = t => { const n = [...t].length; return n > 40 ? 't3' : n > 24 ? 't2' : n > 14 ? 't1' : ''; };
/* 標題分段：只在書名與副標之間（：、:、—、括號前）換行，避免把書名從中間切斷 */
const segs = t => String(t).split(/(?<=[:：—;；,，!！?？]\s*)(?=[^:：—;；,，!！?？\s])|(?=[（(《〈])(?!^)/).filter(Boolean).map(x => `<span class="seg">${esc(x.trimEnd())}</span>${/\s$/.test(x) ? ' ' : ''}`).join('');
const paras = s => String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('\n');


/* ---------- 作家專題 ---------- */
const MIN_AUTHOR = 3;   // 讀過幾本以上的作者才產生專題頁（想多做幾位可改成 2）
const splitAuthors = s => String(s || '').split(/[、,，／\/]/)
  .map(x => x.replace(/\s*(著|繪|譯|編)$/, '').replace(/[•．・]/g, '·').replace(/\s+/g, ' ').trim())
  .filter(x => x.length >= 2 && !/translated/i.test(x));
// 網址用作者名算出固定的短代碼（中文網址分享時會變成一長串亂碼，所以不用中文）
const fnv = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const authorUrl = name => `/author/a${fnv(name)}/`;

/* ---------- shared look (取自首頁 V2 風格) ---------- */
const CSS = `
:root{color-scheme:light dark;--bg:light-dark(#eeece8,#16171a);--ink:light-dark(#1f2125,#e9e7e3);--muted:light-dark(#7b7b7b,#a2a19d);--card:light-dark(#f8f7f4,#1f2024);--line:light-dark(#dcd9d3,#2c2d31);--gold:#b59a6a}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--bg);color:var(--ink);font:300 16px/1.85 "Noto Sans TC",system-ui,sans-serif;letter-spacing:.02em}
a{color:inherit}img{display:block;max-width:100%}
h1,h2,h3{font-family:"Noto Serif TC",serif;font-weight:500;letter-spacing:.04em;line-height:1.3;margin:0;text-wrap:balance}
.ink{}@media(prefers-color-scheme:dark){.ink{filter:invert(1)}}
nav{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
nav .in{max-width:1080px;margin:0 auto;display:flex;align-items:center;gap:18px;padding:8px max(5vw,16px)}
.logo{margin-right:auto;display:flex;align-items:center;min-height:44px}.logo img{height:28px;width:auto}
nav .lk{display:flex;gap:18px;font-size:13px;letter-spacing:.12em}nav .lk a{text-decoration:none;padding:8px 0}
.nsearch{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border:1px solid var(--ink);border-radius:999px;text-decoration:none;font-size:13px;letter-spacing:.12em}
.nsearch svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.nsearch:hover{background:var(--ink);color:var(--bg)}
@media(max-width:600px){.nsearch{width:42px;padding:0;justify-content:center}.nsearch span{display:none}}nav .lk a:hover{color:var(--gold)}
main{max-width:760px;margin:0 auto;padding:clamp(28px,6vw,64px) max(5vw,16px) 40px}
.crumb{font-size:12px;letter-spacing:.14em;color:var(--muted);margin:0 0 22px}.crumb a{text-decoration:none}.crumb a:hover{color:var(--gold)}
.rmeta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;color:var(--muted)}
.stars{color:var(--gold);letter-spacing:1px}
.bigc{float:right;width:min(42%,230px);margin:6px 0 16px 24px}
.bigc img{width:100%;height:auto;border-radius:2px}
.pager{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px}
.pager>:first-child{justify-self:start;max-width:100%!important}.pager>:last-child{justify-self:end;max-width:100%!important}
.pager .mid{display:flex;align-items:center;gap:8px}
.pager .tolib{max-width:none;overflow:visible;border:0;padding:0 20px;color:var(--bg);opacity:1}
.pager .shbtn{padding:0;max-width:none;width:44px;min-width:44px;height:44px;border-radius:50%;overflow:visible}
.pager .shpop button{max-width:none;border:0;border-radius:6px;padding:0 10px;min-height:40px;white-space:nowrap}
.tolib{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border-radius:999px;background:var(--ink);color:var(--bg);text-decoration:none;font-size:13px;letter-spacing:.14em;white-space:nowrap}
.tolib:hover{filter:brightness(1.15)}
.shwrap{position:relative}
.shrow{clear:both;display:flex;justify-content:flex-end;margin-top:28px}
.shbtn{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}
.shbtn:hover,.shbtn[aria-expanded=true]{border-color:var(--ink)}
.shbtn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.shpop{position:absolute;bottom:calc(100% + 10px);right:0;z-index:5;width:180px;padding:8px;background:var(--bg);border:1px solid var(--line);border-radius:8px;box-shadow:0 18px 36px -16px rgba(0,0,0,.4)}
.shpop .sl{margin:2px 8px 6px;font-size:11px;letter-spacing:.22em;color:var(--muted)}
.shpop button{display:flex;width:100%;min-height:40px;align-items:center;padding:0 10px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;font-size:14px;text-align:left;cursor:pointer;max-width:none}
.shpop button:hover{background:var(--card)}
.tolib:focus-visible,.shbtn:focus-visible,.shpop button:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
@media(max-width:600px){.pager{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.pager .mid{grid-column:1/-1;order:-1;justify-content:center}}
h1{font-size:clamp(26px,4.4vw,38px);margin-top:10px;text-wrap:pretty}
.seg{display:inline-block;max-width:100%}
h1.flow .seg{display:inline}h1.flow{text-wrap:balance}h1.t1{font-size:clamp(23px,3.8vw,32px)}h1.t2{font-size:clamp(20px,3.2vw,26px)}h1.t3{font-size:clamp(17px,2.8vw,22px)}
.au{color:var(--muted);margin:8px 0 0}
blockquote{margin:26px 0;padding:14px 0 14px 20px;border-left:3px solid var(--c,var(--gold));font-family:"Noto Serif TC",serif;font-size:18px;line-height:1.85}
.txt p{margin:0 0 1.1em}
.txt,blockquote,.evbody{overflow-wrap:anywhere}
.txt{clear:none}
.pager{clear:both;display:flex;justify-content:space-between;gap:12px;margin-top:36px;padding-top:20px;border-top:1px solid var(--line)}
.pager a,.pager span{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid var(--line);border-radius:999px;text-decoration:none;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
.pager span{opacity:.35}.pager a:hover{border-color:var(--ink)}
.sec{margin-top:48px}
.sec h2{font-size:20px;margin-bottom:14px}
.no{display:flex;align-items:center;gap:14px;margin:0 0 10px;font:400 11px/1 "Noto Sans TC",sans-serif;letter-spacing:.32em;color:var(--muted)}.no i{width:36px;height:1px;background:var(--line)}
.rel{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:12px}
.rel a{display:grid;grid-template-columns:52px 1fr;gap:12px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:3px;background:var(--card);text-decoration:none;transition:transform .3s}
.rel a:hover{transform:translateY(-3px)}
.rel img{width:52px;aspect-ratio:3/4;object-fit:cover;border-radius:2px;background:var(--line)}
.rel b{display:block;font-family:"Noto Serif TC",serif;font-weight:500;font-size:15px;line-height:1.4}
.rel small{color:var(--muted);font-size:12px}
.cta{margin-top:48px;padding:clamp(24px,4vw,36px);background:#1c1e23;color:#e9e7e3;border-radius:3px}
.cta h2{font-size:21px;color:#f1efe9}.cta p{color:#b9b6b0;margin:8px 0 0}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:999px;background:#e9e7e3;color:#1c1e23;text-decoration:none;font-size:14px;letter-spacing:.1em}
.btn.ghost{background:transparent;color:#e9e7e3;border:1px solid currentColor}
.btn:hover{filter:brightness(1.08)}
.btn:focus-visible,.rel a:focus-visible,.pager a:focus-visible,.list a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
footer{text-align:center;padding:40px 16px 56px;font-size:13px;color:var(--muted)}
footer a{text-decoration:none;border-bottom:1px solid var(--line);margin:0 8px}
/* 書庫總表 */
.wide{max-width:1080px}
.cats{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 8px}
.cats a{min-height:36px;display:inline-flex;align-items:center;padding:0 14px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:13px}
.cats a:hover{border-color:var(--ink)}.cats small{opacity:.6;margin-left:4px}
.cat{margin-top:44px;scroll-margin-top:70px}.cat h2{font-size:22px;margin-bottom:12px}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:10px}
.list a{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:3px;background:var(--card);text-decoration:none}
.list a:hover{border-color:var(--ink)}
.list img{width:44px;aspect-ratio:3/4;object-fit:cover;border-radius:2px;background:var(--line)}
.list b{display:block;font-family:"Noto Serif TC",serif;font-weight:500;font-size:15px;line-height:1.4}
.list small{display:block;color:var(--muted);font-size:12px}
.lede{color:var(--muted);margin:10px 0 0}
/* 活動紀錄 */
.evp{margin:22px 0 26px;border-radius:2px;overflow:hidden;background:#111}
.evp img{width:100%;max-height:440px;object-fit:contain;margin:0 auto}
.evlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:14px;margin-top:14px}
.evlist a{display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:3px;background:var(--card);text-decoration:none}
.evlist a:hover{border-color:var(--ink)}
.evlist img{width:96px;aspect-ratio:1;object-fit:cover;border-radius:2px;filter:saturate(.75)}
.evlist b{display:block;font-family:"Noto Serif TC",serif;font-weight:500;font-size:16px;line-height:1.4;margin:2px 0}
.evlist small{display:block;color:var(--muted);font-size:12px;line-height:1.6}

.aulink{margin:6px 0 0;font-size:13px;letter-spacing:.06em}.aulink a{color:var(--muted);text-decoration:none;border-bottom:1px solid var(--line);padding-bottom:1px}.aulink a:hover{color:var(--ink);border-color:var(--ink)}
.apick{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:18px 0 0}
.apick .flabel{font-size:12px;letter-spacing:.2em;color:var(--muted);margin-right:4px}
.apick a{display:inline-flex;align-items:center;min-height:38px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);text-decoration:none;font-size:14px}
.apick a:hover{border-color:var(--ink)}.apick small{color:var(--muted);font-size:11px;margin-left:6px}
.apick.big a{min-height:48px;padding:0 20px;font-size:16px;font-family:"Noto Serif TC",serif}
.arank{list-style:none;margin:30px 0 0;padding:0;display:grid;gap:12px}
.arank a{display:grid;grid-template-columns:34px 76px minmax(0,1fr);gap:16px;align-items:center;padding:14px 16px;border:1px solid var(--line);border-radius:4px;background:var(--card);text-decoration:none;transition:transform .3s,border-color .3s}
.arank a:hover{transform:translateY(-2px);border-color:var(--ink)}
.arank a:focus-visible,.apick a:focus-visible,.aulink a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
.anum{font:400 22px/1 "Noto Serif TC",serif;color:var(--gold);text-align:center}
.arank img{width:76px;aspect-ratio:3/4;object-fit:cover;border-radius:2px;background:var(--line)}
.abody{display:grid;gap:5px}
.abody b{font-family:"Noto Serif TC",serif;font-weight:500;font-size:18px;line-height:1.4}
.abody q{font-family:"Noto Serif TC",serif;font-size:14px;line-height:1.7;color:var(--muted);quotes:"「" "」"}
.abody .go{font-size:13px;letter-spacing:.1em;color:var(--ink)}
@media(max-width:600px){.arank a{grid-template-columns:24px 60px minmax(0,1fr);gap:12px;padding:12px}.arank img{width:60px}.anum{font-size:17px}.abody b{font-size:16px}}
/* 書庫：搜尋＋浮動目錄 */
.sbox{margin:24px 0 0}
.search{width:100%;min-height:48px;padding:0 18px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit;font-size:16px}
.search:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.count{font-size:13px;color:var(--muted);margin:8px 0 0 18px;min-height:1em}
.empty{padding:40px 0;text-align:center;color:var(--muted)}
.cat h2 .n{font:400 13px "Noto Sans TC",sans-serif;color:var(--muted);margin-left:6px}
[hidden]{display:none!important}
.fab{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:30;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.fbtn{width:50px;height:50px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:#1c1e23;color:#e9e7e3;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);transition:transform .3s,opacity .3s}
.fbtn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.fbtn:focus-visible,.fl:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
@media(hover:hover){.fbtn:hover{transform:translateY(-3px)}}
#fTop{opacity:0;pointer-events:none;transform:translateY(10px)}#fTop.show{opacity:1;pointer-events:auto;transform:none}
.fpanel{width:min(78vw,230px);max-height:min(64vh,460px);overflow-y:auto;padding:10px;background:var(--bg);border:1px solid var(--line);border-radius:8px;box-shadow:0 20px 40px -20px rgba(0,0,0,.45)}
.ft{margin:2px 8px 6px;font-size:11px;letter-spacing:.24em;color:var(--muted)}
.fl{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:42px;padding:0 10px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;font-size:15px;text-align:left;cursor:pointer}
.fl:hover{background:var(--card)}.fl small{color:var(--muted);font-size:12px}
@media(max-width:600px){.bigc{float:none;width:68%;margin:18px auto 8px}nav .lk{display:none}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const head = ({ title, desc, url, image, type = 'article', extra = '' }) => `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(SITE + url)}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Yu聿・record &amp; remember">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(SITE + url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:locale" content="zh_TW">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="theme-color" content="#1c1c1f">
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
${extra}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;700&family=Noto+Sans+TC:wght@300;400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<nav><div class="in">
  <a class="logo" href="/"><img class="ink" src="/img/yu-logo.png" alt="Yu聿"></a>
  <div class="lk"><a href="/#reviews">最近讀了什麼</a><a href="/book/">讀後感書庫</a><a href="/party/">書蟲派對</a><a href="/#podcast">尼采一下</a></div>
  <a class="nsearch" href="/#search" aria-label="搜尋全站"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>搜尋</span></a>
</div></nav>
`;

const foot = () => `
<footer>
  <p><a href="/">Yu聿 首頁</a><a href="/book/">讀後感書庫</a><a href="${LINKS.threads}">Threads</a><a href="${LINKS.ig}">Instagram</a></p>
  <p>© ${new Date().getFullYear()} Yu聿・書蟲派對</p>
</footer>
</body>
</html>
`;

const cta = () => `
<section class="cta">
  <p class="no" style="color:#9a978f"><i style="background:#3a3c42"></i>KEEP READING</p>
  <h2>喜歡這篇讀後感嗎？</h2>
  <p>每天的閱讀紀錄都在這裡。也歡迎來聽哲學 Podcast《尼采一下》，或加入閱讀社群《書蟲派對》，一起聊書。</p>
  <div class="btns">
    <a class="btn" href="/book/">看更多讀後感</a>
    <a class="btn ghost" href="${LINKS.spotify}">收聽《尼采一下》</a>
    <a class="btn ghost" href="${LINKS.line}">加入書蟲派對</a>
  </div>
</section>`;

const mini = b => `<a href="${bookUrl(b)}">${b.cover ? `<img src="${esc(rel(b.cover))}" alt="" loading="lazy">` : '<span></span>'}<span><b>${esc(b.title)}</b><small>${esc(b.author)}${stars(b.rating) ? `・<span class="stars">${'★'.repeat(stars(b.rating))}</span>` : ''}</small></span></a>`;

/* ---------- build ---------- */
function main() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'reads.json'), 'utf8'));
  const books = (data.books || []).filter(b => b && b.id && b.title)
    .map(b => ({ ...b, title: String(b.title).trim().replace(/^《(.*)》$/, '$1'), category: b.category || '未分類' })); // 書名本身已含《》時去掉，避免變成《《…》》

  // 1. 複製整個網站到 dist/
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of fs.readdirSync(ROOT)) {
    if (SKIP.has(name)) continue;
    fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
  }
  // 舊的產出（如果有人把 book/ 傳進 repo）以新產生的為準
  fs.rmSync(path.join(OUT, 'book'), { recursive: true, force: true });

  // 2. 每本書一頁
  const withNote = books.filter(b => flat(b.note));
  const byAuthor = {};
  withNote.forEach(b => splitAuthors(b.author).forEach(a => (byAuthor[a] = byAuthor[a] || []).push(b)));
  const authors = Object.keys(byAuthor).filter(a => byAuthor[a].length >= MIN_AUTHOR)
    .sort((a, b) => byAuthor[b].length - byAuthor[a].length || a.localeCompare(b, 'zh-Hant'));
  const authorSet = new Set(authors);
  withNote.forEach((b, i) => {
    const n = stars(b.rating);
    const url = bookUrl(b);
    const lead = flat(b.quote) || flat(b.note);
    const desc = cut(`《${b.title}》讀後感・心得${n ? `｜${'★'.repeat(n)} ${RL[n]}` : ''}｜${lead}`, 110);
    const title = `《${b.title}》讀後感｜${b.author ? b.author + '｜' : ''}${BRAND}`;
    const image = b.cover ? abs(b.cover) : SITE + '/img/og.jpg';
    const prev = withNote[i - 1], next = withNote[i + 1];
    const related = withNote.filter(x => x.id !== b.id && x.category === b.category).slice(0, 6);
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Review',
      name: `《${b.title}》讀後感`,
      url: SITE + url,
      datePublished: b.date || undefined,
      inLanguage: 'zh-Hant',
      author: { '@type': 'Person', name: BRAND, url: SITE + '/' },
      publisher: { '@type': 'Person', name: BRAND, url: SITE + '/' },
      itemReviewed: {
        '@type': 'Book', name: b.title,
        ...(b.author ? { author: { '@type': 'Person', name: b.author } } : {}),
        ...(b.cover ? { image: abs(b.cover) } : {}),
      },
      ...(n ? { reviewRating: { '@type': 'Rating', ratingValue: n, bestRating: 5, worstRating: 1 } } : {}),
      reviewBody: flat(b.note),
    };
    const crumbs = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Yu聿', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: '讀後感書庫', item: SITE + '/book/' },
        { '@type': 'ListItem', position: 3, name: `《${b.title}》`, item: SITE + url },
      ]
    };
    const extra = [
      b.date ? `<meta property="article:published_time" content="${esc(b.date)}">` : '',
      `<meta property="article:section" content="${esc(b.category)}">`,
      `<script type="application/ld+json">${ld(schema)}</script>`,
      `<script type="application/ld+json">${ld(crumbs)}</script>`,
    ].filter(Boolean).join('\n');

    const html = head({ title, desc, url, image, extra }) + `
<main style="--c:${CC[b.category] || CC['未分類']}">
  <p class="crumb"><a href="/">Yu聿</a> ／ <a href="/book/">讀後感書庫</a> ／ <a href="/book/#${encodeURIComponent(b.category)}">${esc(b.category)}</a></p>
  <article>
    <div class="rmeta">${b.date ? `<time datetime="${esc(b.date)}">${esc(b.date)}</time>` : ''}${b.day ? `<span>每日紀錄 Day ${esc(b.day)}</span>` : ''}<span>${esc(b.category)}</span>${n ? `<span class="stars" aria-label="${n} 顆星">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span><span>${RL[n]}</span>` : ''}</div>
    ${b.cover ? `<div class="bigc"><img src="${esc(rel(b.cover))}" alt="《${esc(b.title)}》完讀圖卡"></div>` : ''}
    <h1 class="${tc(b.title)}">${segs(`《${b.title}》`)}<span class="seg">讀後感</span></h1>
    ${b.author ? `<p class="au">${esc(b.author)}</p>` : ''}
    ${splitAuthors(b.author).filter(a => authorSet.has(a)).map(a => `<p class="aulink"><a href="${authorUrl(a)}">${esc(a)}作品讀後感（${byAuthor[a].length} 篇）→</a></p>`).join('')}
    ${flat(b.quote) ? `<blockquote>${esc(b.quote)}</blockquote>` : '<div style="height:20px"></div>'}
    <div class="txt">
${paras(b.note)}
    </div>
    <div class="shrow"><div class="shwrap" data-url="${esc(SITE + url)}" data-title="${esc(`《${b.title}》讀後感｜${BRAND}`)}"><button type="button" class="shbtn" aria-label="分享這篇" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M9 15c.5-5 4.5-8 11-8"/><path d="M16 3l4 4-4 4"/></svg></button><div class="shpop" role="menu" hidden><p class="sl">分享這篇</p><button type="button" data-sh="native" hidden>更多分享方式…</button><button type="button" data-sh="threads">Threads</button><button type="button" data-sh="line">LINE</button><button type="button" data-sh="fb">Facebook</button><button type="button" data-sh="copy">複製連結</button></div></div></div>
  </article>
  <div class="pager">${prev ? `<a href="${bookUrl(prev)}" rel="prev">← ${esc(cut(prev.title, 12))}</a>` : '<span>沒有更新的了</span>'}<div class="mid"><a class="tolib" href="/book/">讀後感書庫</a></div>${next ? `<a href="${bookUrl(next)}" rel="next">${esc(cut(next.title, 12))} →</a>` : '<span>已經到底</span>'}</div>
  ${related.length ? `<section class="sec"><p class="no"><i></i>MORE IN ${esc(b.category)}</p><h2>同樣是「${esc(b.category)}」的讀後感</h2><div class="rel">${related.map(mini).join('')}</div></section>` : ''}
  ${cta()}
</main>
<script>
/* 書封在右邊時：標題縮到放得進書封左側；縮到下限仍放不下才在書名裡換行 */
function yuFit(h,c){if(!h||!c)return;h.classList.remove('flow');h.style.fontSize='';
 var cs=getComputedStyle(c);if(cs.float==='none'||c.offsetParent===null)return;
 var avail=h.clientWidth-c.getBoundingClientRect().width-parseFloat(cs.marginLeft||0)-2;
 var segs=[].slice.call(h.querySelectorAll('.seg'));if(!segs.length)return;
 var widest=function(){return Math.max.apply(0,segs.map(function(s){s.style.maxWidth='none';s.style.whiteSpace='nowrap';var w=s.getBoundingClientRect().width;s.style.maxWidth='';s.style.whiteSpace='';return w}))};
 var w=widest();if(w<=avail)return;
 var fs=parseFloat(getComputedStyle(h).fontSize),min=Math.min(22,fs),nf=Math.max(min,Math.floor(fs*avail/w*0.98));
 if(nf<fs)h.style.fontSize=nf+'px';
 if(widest()>avail)h.classList.add('flow');}
function yuShare(w){if(!w)return;var enc=encodeURIComponent,btn=w.querySelector('.shbtn'),pop=w.querySelector('.shpop');
 if(navigator.share){var nb=pop.querySelector('[data-sh=native]');if(nb)nb.hidden=false}
 var set=function(o){pop.hidden=!o;btn.setAttribute('aria-expanded',o)};
 btn.addEventListener('click',function(e){e.stopPropagation();set(pop.hidden)});
 document.addEventListener('click',function(e){if(document.contains(w)&&!pop.hidden&&!w.contains(e.target))set(false)});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.contains(w)&&!pop.hidden){e.stopPropagation();set(false);btn.focus()}},true);
 pop.addEventListener('click',function(e){var b=e.target.closest('[data-sh]');if(!b)return;var u=w.dataset.url,t=w.dataset.title,k=b.dataset.sh;
  if(k==='native'){set(false);navigator.share({title:t,url:u}).catch(function(){});return}
  if(k==='copy'){var done=function(){b.textContent='已複製 ✓';setTimeout(function(){b.textContent='複製連結';set(false)},1200)};
   if(navigator.clipboard)navigator.clipboard.writeText(u).then(done).catch(function(){window.prompt('複製這個連結',u)});else window.prompt('複製這個連結',u);return}
  var m={threads:'https://www.threads.net/intent/post?text='+enc(t+' '+u),line:'https://social-plugins.line.me/lineit/share?url='+enc(u),fb:'https://www.facebook.com/sharer/sharer.php?u='+enc(u)};
  if(m[k]){set(false);window.open(m[k],'_blank','noopener')}});}
yuShare(document.querySelector('.shwrap'));
(function(){var h=document.querySelector('article h1'),c=document.querySelector('article .bigc');var run=function(){yuFit(h,c)};run();if(document.fonts)document.fonts.ready.then(run);addEventListener('resize',run);})();
</script>` + foot();

    const dir = path.join(OUT, 'book', b.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  });

  // 3. 讀後感書庫總表
  const cats = {};
  withNote.forEach(b => (cats[b.category] = cats[b.category] || []).push(b));
  const order = Object.keys(cats).sort((a, b) => cats[b].length - cats[a].length);
  const idxTitle = `讀後感書庫：${withNote.length} 篇讀後感與心得｜${BRAND}`;
  const idxDesc = `Yu聿 的每日閱讀紀錄，收錄 ${withNote.length} 篇讀後感與心得，涵蓋${order.slice(0, 6).join('、')}等類別。`;
  const idxLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: '讀後感書庫', url: SITE + '/book/',
    inLanguage: 'zh-Hant', author: { '@type': 'Person', name: BRAND },
    mainEntity: { '@type': 'ItemList', numberOfItems: withNote.length, itemListElement: withNote.map((b, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + bookUrl(b), name: `《${b.title}》讀後感` })) }
  };
  const idx = head({ title: idxTitle, desc: idxDesc, url: '/book/', image: SITE + '/img/og.jpg', type: 'website', extra: `<script type="application/ld+json">${ld(idxLd)}</script>` }) + `
<main class="wide">
  <p class="crumb"><a href="/">Yu聿</a> ／ 讀後感書庫</p>
  <h1>讀後感書庫</h1>
  <p class="lede">每日紀錄的 ${withNote.length} 篇讀後感，依類別整理。點書名讀全文。</p>
  ${authors.length ? `<div class="apick"><span class="flabel">作家專題</span>${authors.map(a => `<a href="${authorUrl(a)}">${esc(a)}<small>${byAuthor[a].length}</small></a>`).join('')}</div>` : ''}
  <div class="sbox"><input class="search" id="q" type="search" placeholder="搜尋書名、作者或句子" aria-label="搜尋讀後感" autocomplete="off"><p class="count" id="count" aria-live="polite"></p></div>
  <div class="cats">${order.map(c => `<a href="#${encodeURIComponent(c)}">${esc(c)}<small>${cats[c].length}</small></a>`).join('')}</div>
  ${order.map(c => `<section class="cat" id="${esc(c)}"><h2>${esc(c)} <small class="n">${cats[c].length}</small></h2><div class="list">${cats[c].map(b => `<a href="${bookUrl(b)}" data-k="${esc([b.title, b.author, b.category, flat(b.quote)].join(' ').toLowerCase())}">${b.cover ? `<img src="${esc(rel(b.cover))}" alt="" loading="lazy">` : '<span></span>'}<span><b>${esc(b.title)}</b><small>${esc(b.author)}</small><small>${esc(b.date)}${stars(b.rating) ? `・<span class="stars">${'★'.repeat(stars(b.rating))}</span>` : ''}</small></span></a>`).join('')}</div></section>`).join('\n')}
  <p class="empty" id="empty" hidden>找不到符合的讀後感，換個關鍵字試試。</p>
  ${cta()}
</main>
<div class="fab" id="fab">
  <div class="fpanel" id="fpanel" hidden>
    <p class="ft">快速前往</p>
    <button type="button" class="fl" data-go="search">🔍　搜尋</button>
    ${order.map(c => `<button type="button" class="fl" data-go="${esc(c)}">${esc(c)}<small>${cats[c].length}</small></button>`).join('')}
  </div>
  <button type="button" class="fbtn" id="fToggle" aria-expanded="false" aria-controls="fpanel" aria-label="分類目錄"><svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg></button>
  <button type="button" class="fbtn" id="fTop" aria-label="回到頂端"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
</div>
<script>
(()=>{
const $=s=>document.querySelector(s);
const rm=matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth';
const go=el=>{if(!el)return;scrollTo({top:el.getBoundingClientRect().top+scrollY-72,behavior:rm})};
/* 搜尋 */
const q=$('#q'),links=[...document.querySelectorAll('.list a')],secs=[...document.querySelectorAll('.cat')];
const run=()=>{const k=q.value.trim().toLowerCase();let n=0;
  links.forEach(a=>{const ok=!k||a.dataset.k.includes(k);a.hidden=!ok;if(ok)n++});
  secs.forEach(s=>{s.hidden=!s.querySelector('.list a:not([hidden])')});
  $('#count').textContent=k?'找到 '+n+' 篇':'';$('#empty').hidden=n>0;
  document.querySelectorAll('.fl[data-go]').forEach(b=>{if(b.dataset.go!=='search')b.hidden=!!k&&!document.getElementById(b.dataset.go)?.matches(':not([hidden])')})};
q.addEventListener('input',run);
/* 浮動目錄 */
const panel=$('#fpanel'),tg=$('#fToggle');
const setP=o=>{panel.hidden=!o;tg.setAttribute('aria-expanded',o)};
tg.addEventListener('click',()=>setP(panel.hidden));
panel.addEventListener('click',e=>{const b=e.target.closest('.fl');if(!b)return;setP(false);
  if(b.dataset.go==='search'){go($('.sbox'));setTimeout(()=>q.focus({preventScroll:true}),350)}else go(document.getElementById(b.dataset.go))});
document.addEventListener('click',e=>{if(!panel.hidden&&!e.target.closest('#fab'))setP(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){setP(false);tg.focus()}});
/* 回到頂端 */
const top=$('#fTop');
const tick=()=>top.classList.toggle('show',scrollY>500);
addEventListener('scroll',tick,{passive:true});tick();
top.addEventListener('click',()=>scrollTo({top:0,behavior:rm}));
})();
</script>` + foot();
  fs.writeFileSync(path.join(OUT, 'book', 'index.html'), idx);

  // 3a. 作家專題頁
  const authorUrls = buildAuthors(authors, byAuthor);

  // 3b. 書蟲派對活動紀錄
  const evUrls = buildEvents();

  // 4. sitemap.xml + robots.txt
  const newest = withNote.map(b => b.date).filter(Boolean).sort().pop() || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: SITE + '/', lastmod: newest },
    { loc: SITE + '/book/', lastmod: newest },
    ...withNote.map(b => ({ loc: SITE + bookUrl(b), lastmod: b.date })),
    ...evUrls,
    ...authorUrls,
  ];
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${esc(u.loc)}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(u.lastmod || '') ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') +
    `\n</urlset>\n`);
  if (!fs.existsSync(path.join(ROOT, 'robots.txt'))) {
    fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  }

  console.log(`✔ 產生 ${withNote.length} 篇讀後感頁面、${evUrls.length ? evUrls.length - 1 : 0} 篇活動紀錄、書庫總表、sitemap.xml（共 ${urls.length} 個網址）`);
}


/* ---------- 作家專題：/author/<代碼>/ ---------- */
function buildAuthors(authors, byAuthor) {
  if (!authors.length) return [];
  const rank = list => [...list].sort((a, b) => stars(b.rating) - stars(a.rating) || String(b.date).localeCompare(String(a.date)));
  const urls = [];
  authors.forEach(name => {
    const list = rank(byAuthor[name]);
    const n = list.length, url = authorUrl(name);
    const titles = list.slice(0, 4).map(b => `《${b.title}》`).join('');
    const rated = list.filter(b => stars(b.rating));
    const top = rated.length ? stars(rated[0].rating) : 0;
    const best = top ? list.filter(b => stars(b.rating) === top) : [];
    const title = `${name}作品推薦｜${n} 篇讀後感與心得｜${BRAND}`;
    const desc = cut(`Yu聿 讀過的${name}作品共 ${n} 本：${titles}${n > 4 ? '等' : ''}。依星等由高到低排列，附每本的讀後感與心得。`, 120);
    const image = list.find(b => b.cover) ? abs(list.find(b => b.cover).cover) : SITE + '/img/og.jpg';
    const schema = {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${name}作品讀後感`, url: SITE + url, inLanguage: 'zh-Hant',
      about: { '@type': 'Person', name },
      author: { '@type': 'Person', name: BRAND, url: SITE + '/' },
      mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: list.map((b, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + bookUrl(b), name: `《${b.title}》讀後感` })) },
    };
    const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Yu聿', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: '讀後感書庫', item: SITE + '/book/' },
      { '@type': 'ListItem', position: 3, name: `${name}作品讀後感`, item: SITE + url },
    ] };
    const others = authors.filter(a => a !== name);
    const html = head({ title, desc, url, image, type: 'website', extra: `<script type="application/ld+json">${ld(schema)}</script>\n<script type="application/ld+json">${ld(crumbs)}</script>` }) + `
<main>
  <p class="crumb"><a href="/">Yu聿</a> ／ <a href="/book/">讀後感書庫</a> ／ 作家專題</p>
  <p class="no"><i></i>AUTHOR</p>
  <h1><span class="seg">${esc(name)}</span><span class="seg">作品讀後感</span></h1>
  <p class="lede">Yu聿 讀過的${esc(name)}作品共 ${n} 本，依星等由高到低排列${best.length && best.length <= 2 ? `；最推薦的是${best.map(b => `《${esc(b.title)}》`).join('')}（${'★'.repeat(top)} ${RL[top]}）` : best.length ? `；其中 ${best.length} 本是${'★'.repeat(top)} ${RL[top]}` : ''}。</p>
  <ol class="arank">
    ${list.map((b, i) => `<li><a href="${bookUrl(b)}">
      <span class="anum">${String(i + 1).padStart(2, '0')}</span>
      ${b.cover ? `<img src="${esc(rel(b.cover))}" alt="《${esc(b.title)}》" loading="lazy">` : '<span></span>'}
      <span class="abody">
        <span class="rmeta">${stars(b.rating) ? `<span class="stars">${'★'.repeat(stars(b.rating))}${'☆'.repeat(5 - stars(b.rating))}</span><span>${RL[stars(b.rating)]}</span>` : ''}<span>${esc(b.category)}</span><span>${esc(b.date)}</span></span>
        <b>《${esc(b.title)}》</b>
        ${flat(b.quote || b.note) ? `<q>${esc(cut(flat(b.quote) || flat(b.note), 70))}</q>` : ''}
        <span class="go">讀全文 →</span>
      </span></a></li>`).join('\n')}
  </ol>
  ${others.length ? `<section class="sec"><p class="no"><i></i>MORE AUTHORS</p><h2>其他作家專題</h2><div class="apick">${others.map(a => `<a href="${authorUrl(a)}">${esc(a)}<small>${byAuthor[a].length}</small></a>`).join('')}</div></section>` : ''}
  ${cta()}
</main>` + foot();
    const dir = path.join(OUT, 'author', 'a' + fnv(name));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    urls.push({ loc: SITE + url, lastmod: list.map(b => b.date).filter(Boolean).sort().pop() });
  });
  // /author/ 總覽
  const idx = head({ title: `作家專題：${authors.join('、')}｜${BRAND}`, desc: `Yu聿 讀過三本以上的作家，依作家整理的讀後感與作品推薦：${authors.join('、')}。`, url: '/author/', image: SITE + '/img/og.jpg', type: 'website' }) + `
<main>
  <p class="crumb"><a href="/">Yu聿</a> ／ <a href="/book/">讀後感書庫</a> ／ 作家專題</p>
  <h1>作家專題</h1>
  <p class="lede">讀過 ${MIN_AUTHOR} 本以上的作家，把他們的作品整理在一起，依星等由高到低排列。</p>
  <div class="apick big">${authors.map(a => `<a href="${authorUrl(a)}">${esc(a)}<small>${byAuthor[a].length} 篇</small></a>`).join('')}</div>
  ${cta()}
</main>` + foot();
  fs.writeFileSync(path.join(OUT, 'author', 'index.html'), idx);
  urls.unshift({ loc: SITE + '/author/', lastmod: urls.map(u => u.lastmod).filter(Boolean).sort().pop() });
  return urls;
}

/* ---------- 書蟲派對活動紀錄：/party/<日期>/ ---------- */
function buildEvents() {
  const file = path.join(ROOT, 'events.json');
  if (!fs.existsSync(file)) return [];
  const raw = (JSON.parse(fs.readFileSync(file, 'utf8')).events || [])
    .filter(e => e && e.title && flat(e.text));
  if (!raw.length) return [];
  fs.rmSync(path.join(OUT, 'party'), { recursive: true, force: true });

  // 網址用日期，例如 /party/2026-09-05/；同一天兩場會自動加 -2
  const seen = {};
  const evs = raw.map(e => {
    const d = String(e.date || '').trim().replace(/[./]/g, '-');
    let slug = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : 'event';
    seen[slug] = (seen[slug] || 0) + 1;
    if (seen[slug] > 1) slug += '-' + seen[slug];
    return { ...e, iso: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '', slug, url: `/party/${slug}/` };
  }).sort((a, b) => (b.iso || '').localeCompare(a.iso || ''));
  const photo = e => (e.photos || [])[0] ? '/img/' + e.photos[0] : '';
  const fullName = e => /書蟲派對/.test(e.title) ? e.title : `書蟲派對 ${e.title}`;

  evs.forEach((e, i) => {
    const place = e.place || '';
    const title = `${fullName(e)}｜${place ? place + '讀書會' : '讀書會'}活動紀錄｜${BRAND}`;
    const desc = cut(`《書蟲派對》${place ? place + '讀書會' : '讀書會'}・${e.date || ''}｜${flat(e.text)}`, 110);
    const image = photo(e) ? SITE + photo(e) : SITE + '/img/og.jpg';
    const prev = evs[i - 1], next = evs[i + 1];
    const schema = {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: fullName(e), url: SITE + e.url, inLanguage: 'zh-Hant',
      ...(e.iso ? { datePublished: e.iso } : {}),
      image: [image],
      author: { '@type': 'Person', name: BRAND, url: SITE + '/' },
      publisher: { '@type': 'Person', name: BRAND, url: SITE + '/' },
      articleBody: flat(e.text),
    };
    const html = head({ title, desc, url: e.url, image, extra: `<script type="application/ld+json">${ld(schema)}</script>` }) + `
<main>
  <p class="crumb"><a href="/">Yu聿</a> ／ <a href="/party/">書蟲派對活動紀錄</a></p>
  <article>
    <div class="rmeta">${e.iso ? `<time datetime="${e.iso}">${esc(e.date)}</time>` : ''}${place ? `<span>${esc(place)}</span>` : ''}<span>書蟲派對・實體讀書會</span></div>
    <h1 class="${tc(e.title)}">${fullName(e).split(/(?<=・)/).map(x => `<span class="seg">${esc(x)}</span>`).join('')}</h1>
    ${photo(e) ? `<div class="evp"><img src="${esc(photo(e))}" alt="${esc(fullName(e))} 活動現場"></div>` : ''}
    <div class="txt">
${paras(e.text)}
    </div>
    ${e.ig ? `<p><a href="${esc(e.ig)}" target="_blank" rel="noopener">在 Instagram 看原文、留言 →</a></p>` : ''}
  </article>
  <div class="pager">${prev ? `<a href="${prev.url}" rel="prev">← ${esc(cut(prev.title, 12))}</a>` : '<span>最新一場</span>'}<div class="mid"><a class="tolib" href="/party/">活動紀錄</a></div>${next ? `<a href="${next.url}" rel="next">${esc(cut(next.title, 12))} →</a>` : '<span>第一場</span>'}</div>
  <section class="cta">
    <p class="no" style="color:#9a978f"><i style="background:#3a3c42"></i>BOOKWORM PARTY</p>
    <h2>想一起來聊書嗎？</h2>
    <p>《書蟲派對》是一個讓每個人的閱讀都被看見的社群。線上在 LINE 社群分享，線下在台灣各地舉辦讀書聚會。</p>
    <div class="btns">
      <a class="btn" href="${LINKS.line}">加入 LINE 社群</a>
      <a class="btn ghost" href="${LINKS.accu}">看近期活動・報名</a>
      <a class="btn ghost" href="/party/">更多活動紀錄</a>
    </div>
  </section>
</main>` + foot();
    const dir = path.join(OUT, 'party', e.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  });

  // 活動紀錄總表
  // 依北、中、南、東分區（各區內由新到舊）
  const REGION = [
    ['北部', /台北|臺北|新北|基隆|桃園|新竹/],
    ['中部', /台中|臺中|苗栗|彰化|南投|雲林/],
    ['南部', /嘉義|台南|臺南|高雄|屏東/],
    ['東部', /花蓮|台東|臺東|宜蘭/],
  ];
  const regionOf = p => (REGION.find(([, rx]) => rx.test(p || '')) || ['其他'])[0];
  const regions = [...REGION.map(([n]) => n), '其他']
    .map(name => ({ name, items: evs.filter(e => regionOf(e.place) === name) }))
    .filter(r => r.items.length);
  const places = [...new Set(evs.map(e => e.place).filter(Boolean))];
  const idx = head({
    title: `書蟲派對活動紀錄：${places.join('、')}讀書會｜${BRAND}`,
    desc: `閱讀社群《書蟲派對》在${places.join('、')}舉辦的 ${evs.length} 場實體讀書會紀錄與會後感。`,
    url: '/party/', image: SITE + (fs.existsSync(path.join(ROOT, 'img', 'party-og.jpg')) ? '/img/party-og.jpg' : '/img/og.jpg'), type: 'website',
  }) + `
<main class="wide">
  <p class="crumb"><a href="/">Yu聿</a> ／ 書蟲派對活動紀錄</p>
  <h1>書蟲派對活動紀錄</h1>
  <p class="lede">從花蓮的第一場讀書聚會開始，一路走到${places.filter(p => p !== '花蓮').join('、')}。每一場的會後感都收在這裡。</p>
  <div class="cats">${regions.map(r => `<a href="#${encodeURIComponent(r.name)}">${r.name}<small>${r.items.length}</small></a>`).join('')}</div>
  ${regions.map(r => `<section class="cat" id="${r.name}"><h2>${r.name} <small class="n">${[...new Set(r.items.map(e => e.place).filter(Boolean))].join('・')}</small></h2>
  <div class="evlist">${r.items.map(e => `<a href="${e.url}">${photo(e) ? `<img src="${esc(photo(e))}" alt="" loading="lazy">` : '<span></span>'}<span><small>${esc(e.date)}${e.place ? '・' + esc(e.place) : ''}</small><b>${esc(fullName(e))}</b><small>${esc(cut(flat(e.text), 46))}</small></span></a>`).join('')}</div></section>`).join('\n')}
  <section class="cta">
    <h2>下一場，一起來？</h2>
    <p>活動報名都在 Accupass，平常的聊書在 LINE 社群。</p>
    <div class="btns"><a class="btn" href="${LINKS.line}">加入 LINE 社群</a><a class="btn ghost" href="${LINKS.accu}">看近期活動・報名</a></div>
  </section>
</main>` + foot();
  fs.writeFileSync(path.join(OUT, 'party', 'index.html'), idx);

  const latest = evs.find(e => e.iso)?.iso;
  return [
    { loc: SITE + '/party/', lastmod: latest },
    ...evs.map(e => ({ loc: SITE + e.url, lastmod: e.iso })),
  ];
}

main();
