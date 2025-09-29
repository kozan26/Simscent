// generate.mjs
// Simscent statik sayfa üretici (SSR-lite + hydrate)
// Kullanım: node generate.mjs
import fs from 'fs';
import path from 'path';

// Ortam değişkenleri (CF Pages / GH Actions için)
const DOMAIN    = process.env.DOMAIN    || 'https://www.simscent.com';
const BASE_PATH = process.env.BASE_PATH || ''; // GH Pages alt yolda '/repo-adin' ver

// Kaynak / Çıktı
const SRC_HTML = 'index.html';
const SRC_JSON = 'perfumes_data.json';
const OUT_DIR  = 'dist';
const ASSETS_DIR = 'assets';
const PUBLIC_DIR = 'public';

// Ayarlar
const MAX_SIMS = 10;    // her sayfadaki benzer sayısı
const LIMIT    = null;  // hızlı deneme için sayı (örn 200); tam üretim için null

// Mevcut uygulamayla uyumlu anahtar kümeleri
const KEYS = {
  usage:['Daily','Business','Evening','Night Out','Leisure','Sport'],
  season:['Spring','Summer','Fall','Winter'],
  style:['Classic','Masculine','Feminine','Modern'],
  family:['Animal','Aquatic','Chypre','Citrus','Creamy','Earthy','Floral','Fougère','Fresh','Fruity','Gourmand','Green','Leathery','Oriental','Powdery','Resinous','Smoky','Spicy','Sweet','Synthetic','Woody'],
};

// ---------- yardımcılar ----------
const read  = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive:true }); fs.writeFileSync(f, s); };

const slugify = t => String(t||'')
  .toLowerCase().replace(/&/g,'and').replace(/\s+/g,'-')
  .replace(/[^\w\-]+/g,'').replace(/\-\-+/g,'-').replace(/^-+|-+$/g,'');

function parseJSONFlex(txt){
  try{
    const p = JSON.parse(txt);
    if(Array.isArray(p)) return p;
    if(p && typeof p==='object'){
      if(Array.isArray(p.data))  return p.data;
      if(Array.isArray(p.items)) return p.items;
    }
  }catch(_){}
  // NDJSON desteği
  const lines = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const arr = [];
  for(const ln of lines){ try{ const o = JSON.parse(ln); if(o && typeof o==='object') arr.push(o); }catch(_){ } }
  if(arr.length) return arr;
  throw new Error('Geçersiz JSON / boş veri');
}

function addFullName(arr){
  for(const p of arr){
    const name=p['Fragrance Name']||p.name||'';
    const conc=p.Concentration||p.concentration||'';
    p.fullName=(conc?`${name} ${conc}`:name).trim();
    const yr = p['Release Year']!=null ? String(p['Release Year']) : '';
    p._search=[p.Brand,name,conc,yr].filter(Boolean).join(' ').toLowerCase();
  }
  return arr;
}

function vecSim(a,b,keys){
  let dot=0,n1=0,n2=0;
  for(const k of keys){ const x=+a[k]||0, y=+b[k]||0; dot+=x*y; n1+=x*x; n2+=y*y; }
  return (!n1||!n2)?0:dot/(Math.sqrt(n1)*Math.sqrt(n2));
}
function similarities(target, data, prefs={usage:true,season:true,style:true,family:true}){
  const buckets = Object.entries(prefs).filter(([,v])=>v).map(([k])=>KEYS[k]);
  return data.map(p=>{
    if(p.fullName===target.fullName && p.Brand===target.Brand) return {perfume:p, similarity:-1};
    let s=0,w=0; for(const arr of buckets){ s+=vecSim(target,p,arr); w++; }
    const avg = w? s/w : 0;
    return {perfume:p, similarity: Math.pow(avg,3)}; // app ile uyumlu ^3
  }).filter(x=>x.similarity>=0).sort((a,b)=>b.similarity-a.similarity);
}

const toPct = v => { const n = Number(v); if(!isFinite(n)) return 0; return (n<11) ? Math.round(n*10) : Math.round(n); };
const esc   = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const imgOf = (p,w=480,h=480) => p['Image URL'] || `https://placehold.co/${w}x${h}/e2e8f0/64748b?text=${encodeURIComponent((p.Brand||'?').slice(0,1))}`;
const pageURL = p => `${BASE_PATH}/p/${slugify(p.Brand||'unknown')}/${slugify(p.fullName||'unknown')}/`;

function scoreRing(v,lbl){
  const R=24,C=2*Math.PI*R,off=C-(Math.max(0,Math.min(100,v))/100)*C;
  return `<div class='s-item'><div class='ring'><svg class='svg' viewBox='0 0 54 54'><circle class='bg' cx='27' cy='27' r='${R}'></circle><circle class='fg' cx='27' cy='27' r='${R}' stroke-dasharray='${C}' stroke-dashoffset='${off}'></circle></svg><div class='val'><span class='vtext'>${isNaN(v)?'?':v}</span></div></div><div class='lbl2'>${lbl}</div></div>`;
}

// ---------- prerender HTML ----------
function renderRefDetailHTML(p){
  const img   = imgOf(p,480,480);
  const notes = (p['Fragrance Notes']||'').split(',').map(s=>s.trim()).filter(Boolean);
  const accs  = (p['Main Accords']||'').split(',').map(s=>s.trim()).filter(Boolean);
  const yr    = (p['Release Year'] && !['N/A','Unknown'].includes(String(p['Release Year']))) ? String(p['Release Year']) : '';
  const perfumers = (p.Perfumer||'').split(',').map(s=>s.trim()).filter(x=>x && !['N/A','Unknown'].includes(x));

  const notesHTML = notes.length ? `
    <div class="detail-section">
      <h4 class="detail-section-title">Notalar</h4>
      <div class="chips">${notes.map(n=>`<span class="chip note-link" data-note="${esc(n)}">${esc(n)}</span>`).join('')}</div>
    </div>` : '';

  const sub = (()=>{
    const perfLinks = perfumers.map(n=>`<span class="perfumer-link" data-perfumer="${esc(n)}">${esc(n)}</span>`).join(', ');
    if(yr && perfLinks) return `<p class='ref-card-sub'>${yr} • ${perfLinks}</p>`;
    if(yr) return `<p class='ref-card-sub'>${yr}</p>`;
    if(perfLinks) return `<p class='ref-card-sub'>${perfLinks}</p>`;
    return '';
  })();

  const lon=toPct(p.Longevity), scent=toPct(p.Scent), sil=toPct(p.Sillage), val=toPct(p['Value for Money']);

  return `
  <div class="card" style="box-shadow:var(--elev-1)">
    <div class="card-inner">
      <div class="ref-card-grid">
        <div>
          <img class="ref-card-image" src="${esc(img)}" alt="${esc(p.fullName)}"/>
          ${notesHTML}
        </div>
        <div>
          <div class="pf-brand brand-link" data-brand="${encodeURIComponent(p.Brand||'')}">${esc(p.Brand||'—')}</div>
          <h2 class="ref-card-title">${esc(p.fullName||'')}</h2>
          ${sub}
          <div class="detail-section">
            <h4 class="detail-section-title">Ana Akordlar</h4>
            <div class="chips">${
              accs.length ? accs.map(a=>`<span class="chip accord-link" data-accord="${esc(a)}">${esc(a)}</span>`).join('') :
              '<span class="chip" style="opacity:.7">Belirtilmedi</span>'}
            </div>
          </div>
          <div class="detail-section">
            <h4 class="detail-section-title">Puanlar</h4>
            <div class="scores">
              ${scoreRing(lon,'Kalıcılık')}${scoreRing(scent,'Koku')}
              ${scoreRing(sil,'Yayılım')}${scoreRing(val,'Değer')}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderSimilarGridHTML(list){
  const cards = list.map(({perfume:p, similarity:s})=>{
    const url  = pageURL(p);
    const img  = imgOf(p,240,240);
    const badge = (typeof s==='number') ? `${Math.round(s*100)}% Benzer` : 'Öneri';
    return `
    <a class="pf" href="${url}">
      <img class="pf-img" src="${esc(img)}" alt="${esc(p.fullName)}"/>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div class="pf-brand brand-link" data-brand="${encodeURIComponent(p.Brand||'')}">${esc(p.Brand||'')}</div>
          <div class="badge">${badge}</div>
        </div>
        <div class="pf-name" style="margin-top:4px">${esc(p.fullName||'')}</div>
      </div>
    </a>`;
  }).join('\n');

  return `
  <div style="font-weight:800;font-size:22px;margin:40px 0 16px;font-family:'Playfair Display',serif">
    Benzeri Parfümler
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;">
    ${cards}
  </div>`;
}

// ---------- head/meta + JSON-LD ----------
function injectHead(html, {url, title, desc, jsonld}){
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  if (out.match(/<meta\s+name=["']description["'][^>]*>/i))
    out = out.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(desc)}">`);
  else
    out = out.replace(/<\/head>/i, `<meta name="description" content="${esc(desc)}">\n</head>`);
  if (out.match(/<link\s+rel=["']canonical["'][^>]*>/i))
    out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(url)}"/>`);
  else
    out = out.replace(/<\/head>/i, `<link rel="canonical" href="${esc(url)}"/>\n</head>`);
  out = out.replace(/<\/head>/i, `${jsonld}\n</head>`);
  return out;
}
function buildJSONLD(perf, simsAbs){
  const ld = {
    "@context":"https://schema.org",
    "@type":"Product",
    "name": perf.fullName || '',
    "brand": {"@type":"Brand","name": perf.Brand || ''},
    "image": imgOf(perf,800,800),
    "url": DOMAIN + pageURL(perf),
    "releaseDate": perf['Release Year'] ? String(perf['Release Year']) : undefined,
    "additionalProperty":[
      {"@type":"PropertyValue","name":"Longevity","value": toPct(perf.Longevity)},
      {"@type":"PropertyValue","name":"Sillage","value": toPct(perf.Sillage)},
      {"@type":"PropertyValue","name":"Scent","value": toPct(perf.Scent)},
      {"@type":"PropertyValue","name":"Value for Money","value": toPct(perf['Value for Money'])},
    ].filter(Boolean),
    "isSimilarTo": simsAbs.map(u=>({"@type":"Product","url":u}))
  };
  return `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}

// ---------- hydrate patch ----------
function patchInitForHydrate(tpl){
  const hydrateFn = `
function hydrateFromPrerender(){
  try{
    const pr = window.__PRERENDERED__;
    if(!pr || !pr.ref) return;
    state.currentRef = pr.ref;
    q('#searchInput').placeholder = \`Bir parfüm ara, örn: '\${pr.ref.fullName || 'Aventus'}'\`;
    showPrefs();
    // Veri setini etkileşim için arkada yükle (GH Pages alt yol için BASE_PATH'e dikkat)
    const base = (typeof BASE_PATH!=='undefined' ? BASE_PATH : '');
    fetch((base||'') + '/perfumes_data.json')
      .then(r=>r.ok?r.text():Promise.reject())
      .then(t=>{
        const data = addFullName(parseJSONFlex(t.replace(/:\\s*NaN/gi,': null')));
        state.data = data; buildFuse(); buildFeaturedIndex(); pickFeatured(3); renderFeatured();
      })
      .catch(()=>{});
  }catch(_){}
}
`;
  // init() fonksiyonunu hydrate ile koştur
  const re = /function\s+init\s*\(\)\s*\{[\s\S]*?\}\s*init\s*\(\)\s*;/i;
  let out = tpl.replace(/<\/script>\s*<\/body>/i, `${hydrateFn}\n</script>\n</body>`);
  if(re.test(out)){
    const newInit = `function init(){ 
  wireEvents(); 
  if(window.__PRERENDERED__){ hydrateFromPrerender(); } 
  else { loadInitialUI(); loadInitialData(); } 
}
init();`;
    out = out.replace(re, newInit);
  }
  return out;
}

// ---------- sayfa üretimi ----------
function buildPerfumePage(tpl, perf, allData){
  const sims = similarities(perf, allData).slice(0, MAX_SIMS);

  let html = injectHead(tpl, {
    url:   DOMAIN + pageURL(perf),
    title: `${perf.fullName} — simscent`,
    desc:  `${perf.Brand} ${perf.fullName} notalar, akordlar ve benzer parfümler.`,
    jsonld: buildJSONLD(perf, sims.map(s=>DOMAIN+pageURL(s.perfume))),
  });

  // hero görseli
  html = html.replace(
    /(<img[^>]*id=["']heroShot["'][^>]*src=["'])([^"']*)(["'])/i,
    `$1${esc(imgOf(perf,930,930))}$3`
  );

  // #out içeriğini prerender et
  const prerender = `${renderRefDetailHTML(perf)}\n${renderSimilarGridHTML(sims)}`;
  html = html.replace(
    /<div\s+id=["']out["'][^>]*>[\s\S]*?<\/div>/i,
    `<div id="out">${prerender}</div>`
  );

  // Arama placeholder
  html = html.replace(
    /(<input[^>]*id=["']searchInput["'][^>]*placeholder=["'])[^\"]*(["'])/i,
    `$1Bir parfüm ara, örn: '${esc(perf.fullName)}'$2`
  );

  // Hydrate için bootstrap verisi
  const bootstrap = {
    ref: pick(perf, ['Brand','fullName','Image URL','Release Year','Perfumer','Main Accords','Fragrance Notes','Longevity','Sillage','Scent','Value for Money']),
    sims: sims.map(s=>({ perfume: pick(s.perfume, ['Brand','fullName','Image URL','Release Year']), similarity: s.similarity }))
  };
  html = html.replace(
    /<\/body>/i,
    `<script>window.__PRERENDERED__=${JSON.stringify(bootstrap)};</script>\n</body>`
  );

  // init()’i hydrate moduna patchle
  html = patchInitForHydrate(html);

  return html;
}

function pick(obj, keys){ const o={}; for(const k of keys){ if(Object.prototype.hasOwnProperty.call(obj,k)) o[k]=obj[k]; } return o; }

// ---------- main ----------
(function main(){
  console.time('build');
  if(!fs.existsSync(SRC_HTML)) throw new Error(`Bulunamadı: ${SRC_HTML}`);
  if(!fs.existsSync(SRC_JSON)) throw new Error(`Bulunamadı: ${SRC_JSON}`);

  const baseHTML = read(SRC_HTML);
  const raw = read(SRC_JSON).replace(/:\s*NaN/gi,': null');
  let data = addFullName(parseJSONFlex(raw));
  if(LIMIT) data = data.slice(0, LIMIT);

  // dist temizle
  fs.rmSync(OUT_DIR, { recursive:true, force:true });
  fs.mkdirSync(OUT_DIR, { recursive:true });

  // Ana sayfayı ve JSON'u kopyala
  write(path.join(OUT_DIR,'index.html'), baseHTML);
  write(path.join(OUT_DIR,'perfumes_data.json'), raw);

  // Statikler: assets/ → dist/assets, public/ → dist/
  if (fs.existsSync(ASSETS_DIR)) {
    fs.cpSync(ASSETS_DIR, path.join(OUT_DIR, 'assets'), { recursive: true });
    console.log('• Kopyalandı:', ASSETS_DIR, '→', path.join(OUT_DIR,'assets'));
  }
  if (fs.existsSync(PUBLIC_DIR)) {
    fs.cpSync(PUBLIC_DIR, OUT_DIR, { recursive: true });
    console.log('• Kopyalandı:', PUBLIC_DIR, '→', OUT_DIR);
  }

  // Tekil sayfalar
  let n = 0;
  for(const perf of data){
    const html = buildPerfumePage(baseHTML, perf, data);
    const outPath = path.join(OUT_DIR, 'p', slugify(perf.Brand||'unknown'), slugify(perf.fullName||'unknown'), 'index.html');
    write(outPath, html);
    if(++n % 200 === 0) console.log('...generated', n);
  }

  // sitemap.xml
  const urls = data.map(p=>`${DOMAIN}${pageURL(p)}`);
  const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${DOMAIN}/</loc></url>
  ${urls.map(u=>`<url><loc>${u}</loc></url>`).join('\n  ')}
</urlset>`;
  write(path.join(OUT_DIR,'sitemap.xml'), sm);

  // robots.txt
  const robots = `User-agent: *
Allow: /
Sitemap: ${DOMAIN}/sitemap.xml`;
  write(path.join(OUT_DIR,'robots.txt'), robots);

  // Cloudflare Pages: SPA fallback ve cache header'ları
  write(path.join(OUT_DIR,'_redirects'), `
/assets/*           /assets/:splat        200
/perfumes_data.json /perfumes_data.json   200
/sitemap.xml        /sitemap.xml          200
/robots.txt         /robots.txt           200
/ads.txt            /ads.txt              200
/*                  /index.html           200
`.trim() + '\n');

  write(path.join(OUT_DIR,'_headers'), `
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  Cache-Control: public, max-age=60
`.trim() + '\n');

  console.log(`\n✅ Tamamlandı. Üretilen sayfa: ${n} (+ sitemap.xml, robots.txt, perfumes_data.json, index.html)`);
  console.timeEnd('build');
})();
