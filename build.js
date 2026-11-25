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
const paras = s => String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('\n');

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
nav .lk{display:flex;gap:18px;font-size:13px;letter-spacing:.12em}nav .lk a{text-decoration:none;padding:8px 0}nav .lk a:hover{color:var(--gold)}
main{max-width:760px;margin:0 auto;padding:clamp(28px,6vw,64px) max(5vw,16px) 40px}
.crumb{font-size:12px;letter-spacing:.14em;color:var(--muted);margin:0 0 22px}.crumb a{text-decoration:none}.crumb a:hover{color:var(--gold)}
.rmeta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;color:var(--muted)}
.stars{color:var(--gold);letter-spacing:1px}
.bigc{float:right;width:min(42%,230px);margin:6px 0 16px 24px;border-radius:2px;overflow:hidden}
.bigc img{width:100%;height:auto}
h1{font-size:clamp(26px,4.4vw,38px);margin-top:10px}h1.t1{font-size:clamp(23px,3.8vw,32px)}h1.t2{font-size:clamp(20px,3.2vw,26px)}h1.t3{font-size:clamp(17px,2.8vw,22px)}
.au{color:var(--muted);margin:8px 0 0}
blockquote{margin:26px 0;padding:14px 0 14px 20px;border-left:3px solid var(--c,var(--gold));font-family:"Noto Serif TC",serif;font-size:18px;line-height:1.85}
.txt p{margin:0 0 1.1em}
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
${extra}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;700&family=Noto+Sans+TC:wght@300;400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<nav><div class="in">
  <a class="logo" href="/"><img class="ink" src="/img/yu-logo.png" alt="Yu聿"></a>
  <div class="lk"><a href="/#reviews">最近讀了什麼</a><a href="/book/">讀後感書庫</a><a href="/#party">書蟲派對</a><a href="/#podcast">尼采一下</a></div>
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
    .map(b => ({ ...b, category: b.category || '未分類' }));

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
    <h1 class="${tc(b.title)}">《${esc(b.title)}》讀後感</h1>
    ${b.author ? `<p class="au">${esc(b.author)}</p>` : ''}
    ${flat(b.quote) ? `<blockquote>${esc(b.quote)}</blockquote>` : '<div style="height:20px"></div>'}
    <div class="txt">
${paras(b.note)}
    </div>
  </article>
  <div class="pager">${prev ? `<a href="${bookUrl(prev)}" rel="prev">← ${esc(cut(prev.title, 12))}</a>` : '<span>沒有更新的了</span>'}${next ? `<a href="${bookUrl(next)}" rel="next">${esc(cut(next.title, 12))} →</a>` : '<span>已經到底</span>'}</div>
  ${related.length ? `<section class="sec"><p class="no"><i></i>MORE IN ${esc(b.category)}</p><h2>同樣是「${esc(b.category)}」的讀後感</h2><div class="rel">${related.map(mini).join('')}</div></section>` : ''}
  ${cta()}
</main>` + foot();

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
  <div class="cats">${order.map(c => `<a href="#${encodeURIComponent(c)}">${esc(c)}<small>${cats[c].length}</small></a>`).join('')}</div>
  ${order.map(c => `<section class="cat" id="${esc(c)}"><h2>${esc(c)}</h2><div class="list">${cats[c].map(b => `<a href="${bookUrl(b)}">${b.cover ? `<img src="${esc(rel(b.cover))}" alt="" loading="lazy">` : '<span></span>'}<span><b>${esc(b.title)}</b><small>${esc(b.author)}</small><small>${esc(b.date)}${stars(b.rating) ? `・<span class="stars">${'★'.repeat(stars(b.rating))}</span>` : ''}</small></span></a>`).join('')}</div></section>`).join('\n')}
  ${cta()}
</main>` + foot();
  fs.writeFileSync(path.join(OUT, 'book', 'index.html'), idx);

  // 4. sitemap.xml + robots.txt
  const newest = withNote.map(b => b.date).filter(Boolean).sort().pop() || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: SITE + '/', lastmod: newest },
    { loc: SITE + '/book/', lastmod: newest },
    ...withNote.map(b => ({ loc: SITE + bookUrl(b), lastmod: b.date })),
  ];
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${esc(u.loc)}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(u.lastmod || '') ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') +
    `\n</urlset>\n`);
  if (!fs.existsSync(path.join(ROOT, 'robots.txt'))) {
    fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  }

  console.log(`✔ 產生 ${withNote.length} 篇讀後感頁面、書庫總表、sitemap.xml（共 ${urls.length} 個網址）`);
}

main();
