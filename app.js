/* MapCrown (clean build)
   - Desktop: top links
   - Mobile: dropdown menu
   - Bottom sheet details on mobile
   - Explore categories + clean details
   - Facts (Wikipedia) only on click, Close/Next
   - Quiz: Map / Topic / PYQ / Daily (10)
   - Exam Mode + India Focus
*/

const DATA_FILES = {
  countries: "data/countries.min.json",
  states: "data/states_provinces.min.json",
  cities: "data/cities_major.min.json",
  rivers: "data/rivers.min.json",
  mountains: "data/mountains_peaks.min.json",
};

const els = {
  category: document.getElementById("category"),
  examMode: document.getElementById("examMode"),
  indiaFocus: document.getElementById("indiaFocus"),

  btnFacts: document.getElementById("btnFacts"),
  btnDaily: document.getElementById("btnDaily"),
  btnQuiz: document.getElementById("btnQuiz"),
  btnExplore: document.getElementById("btnExplore"),

  title: document.getElementById("title"),
  cName: document.getElementById("cName"),
  cType: document.getElementById("cType"),
  modeText: document.getElementById("modeText"),
  details: document.getElementById("details"),
  flag: document.getElementById("flag"),

  quizBox: document.getElementById("quizBox"),
  quizMode: document.getElementById("quizMode"),
  topicPick: document.getElementById("topicPick"),
  quizModeText: document.getElementById("quizModeText"),
  qText: document.getElementById("qText"),
  qMsg: document.getElementById("qMsg"),
  scoreEl: document.getElementById("score"),
  dailyProgress: document.getElementById("dailyProgress"),
  mcqBtns: Array.from(document.querySelectorAll(".mcqBtn")),

  factsModal: document.getElementById("factsModal"),
  closeFacts: document.getElementById("closeFacts"),
  nextFact: document.getElementById("nextFact"),
  factsBox: document.getElementById("factsBox"),
  factsTitle: document.getElementById("factsTitle"),
  factsMeta: document.getElementById("factsMeta"),

  infoModal: document.getElementById("infoModal"),
  infoTitle: document.getElementById("infoTitle"),
  infoBody: document.getElementById("infoBody"),
  infoClose: document.getElementById("infoClose"),

  mMenuBtn: document.getElementById("mMenuBtn"),
  mMenu: document.getElementById("mMenu"),
};

let currentKey = "countries";
let mode = "explore";
let selected = null; // { typeKey, typeLabel, name, props, latlng }
let score = 0;

let factsState = { list: [], idx: 0, forKey: "" };

let q = null;
let daily = { active:false, idx:0, total:10, seed:"", questions:[] };

const geoCache = new Map();
const poolCache = new Map();

let polygonLayer = null;
let pointLayer = null;
let clusterLayer = null;

/* ---------- helpers ---------- */
const normalize = (s) => String(s || "").trim().toLowerCase();
const safeVal = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
const fmtNum = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : "—");

function setPanel(name="—", type="—"){
  els.title.textContent = name === "—" ? "Select something" : name;
  els.cName.textContent = name;
  els.cType.textContent = type;
}

function renderDetailsRows(rows){
  els.details.innerHTML = rows.map(([k,v]) => `
    <div class="detailsRow">
      <div class="detailsKey">${k}</div>
      <div class="detailsVal">${v}</div>
    </div>
  `).join("");
}

function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffle(arr){
  for (let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function getNameFromProps(p){
  return (
    p?.name || p?.NAME || p?.Name ||
    p?.name_en || p?.NAME_EN ||
    p?.nameascii || p?.NAMEASCII ||
    p?.name_long || p?.NAME_LONG ||
    p?.admin || p?.ADMIN ||
    p?.adm0name || p?.ADM0NAME ||
    p?.city || p?.CITY ||
    p?.river || p?.RIVER ||
    "Unknown"
  );
}

function clearMapLayers(){
  if (polygonLayer){ map.removeLayer(polygonLayer); polygonLayer=null; }
  if (clusterLayer){ map.removeLayer(clusterLayer); clusterLayer=null; }
  if (pointLayer){ map.removeLayer(pointLayer); pointLayer=null; }
}

function styleFor(key){
  if (key === "countries") return { color:"#5aa7ff", weight:1, fillOpacity:0.18 };
  if (key === "states") return { color:"#ffd166", weight:1, fillOpacity:0.10 };
  if (key === "rivers") return { color:"#4cc9f0", weight:2, opacity:0.85 };
  return undefined;
}

async function loadGeo(key){
  if (geoCache.has(key)) return geoCache.get(key);
  const path = DATA_FILES[key];
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Missing file: ${path}`);
  const geo = await res.json();
  geoCache.set(key, geo);
  return geo;
}

/* ---------- India focus filter (best effort) ---------- */
function isIndiaFeature(key, props){
  const admin = String(props?.admin || props?.ADMIN || props?.adm0name || props?.ADM0NAME || "").toLowerCase();
  const country = String(props?.country || props?.COUNTRY || "").toLowerCase();
  const iso = String(props?.iso_a2 || props?.ISO_A2 || props?.iso_a3 || props?.ISO_A3 || "").toLowerCase();
  return admin.includes("india") || country.includes("india") || iso === "in" || iso === "ind";
}

/* ---------- clean details (non-countries) ---------- */
function showNonCountryDetails(typeKey, typeLabel, clickedName, props, latlng){
  els.flag.classList.add("hidden");
  els.flag.src = "";

  const rows = [];
  rows.push(["Type", typeLabel]);
  rows.push(["Name", clickedName]);
  if (latlng) rows.push(["Coordinates", `${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}`]);

  if (typeKey === "cities"){
    const country = props?.adm0name || props?.ADM0NAME || props?.admin || props?.ADMIN;
    const pop = props?.pop_max ?? props?.POP_MAX ?? props?.population ?? props?.POP;
    if (country) rows.push(["Country", safeVal(country)]);
    if (pop !== undefined) rows.push(["Population", safeVal(pop)]);
  }

  if (typeKey === "states"){
    const country = props?.admin || props?.ADMIN || props?.adm0name || props?.ADM0NAME;
    if (country) rows.push(["Country", safeVal(country)]);
  }

  if (typeKey === "rivers"){
    const cls = props?.featurecla ?? props?.FEATURECLA;
    const num = props?.rivernum ?? props?.RIVERNUM;
    const len = props?.length_km ?? props?.LENGTH_KM ?? props?.length ?? props?.LENGTH;
    if (cls) rows.push(["Feature Class", safeVal(cls)]);
    if (num !== undefined) rows.push(["River No", safeVal(num)]);
    if (len !== undefined) rows.push(["Length", safeVal(len)]);
  }

  if (typeKey === "mountains"){
    const elev = props?.elev ?? props?.ELEV ?? props?.elevation ?? props?.ELEVATION;
    if (elev !== undefined) rows.push(["Elevation", safeVal(elev)]);
  }

  renderDetailsRows(rows);

  // Raw data (expand)
  if (props && typeof props === "object"){
    const rawKeys = Object.keys(props).sort((a,b)=>a.localeCompare(b));
    const rawHtml = rawKeys.map(k => `
      <div class="detailsRow">
        <div class="detailsKey">${k}</div>
        <div class="detailsVal">${safeVal(props[k])}</div>
      </div>
    `).join("");

    els.details.insertAdjacentHTML("beforeend", `
      <details style="margin-top:10px;">
        <summary style="cursor:pointer; opacity:.85;">Raw Data (all keys)</summary>
        <div style="margin-top:10px; border:1px solid rgba(255,255,255,.10); border-radius:12px; padding:10px; background:rgba(255,255,255,.03);">
          ${rawHtml}
        </div>
      </details>
    `);
  }
}

/* ---------- countries (RestCountries API) ---------- */
async function loadCountryFromAPI(countryName){
  try{
    let url = `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fullText=true`;
    let res = await fetch(url);
    let data = await res.json();
    if (!Array.isArray(data) || !data.length){
      url = `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fullText=false`;
      res = await fetch(url);
      data = await res.json();
    }
    return Array.isArray(data) ? data[0] : null;
  } catch {
    return null;
  }
}

async function showCountryDetails(countryName){
  renderDetailsRows([["Type","COUNTRY"],["Name",countryName],["Status","Loading details…"]]);

  const c = await loadCountryFromAPI(countryName);
  if (!c){
    renderDetailsRows([["Type","COUNTRY"],["Name",countryName],["Error","Couldn’t load details (name mismatch / internet)."]]);
    els.flag.classList.add("hidden");
    return;
  }

  const flagUrl = c.flags?.png || c.flags?.svg || "";
  if (flagUrl){
    els.flag.src = flagUrl;
    els.flag.classList.remove("hidden");
  } else {
    els.flag.classList.add("hidden");
  }

  renderDetailsRows([
    ["Type","COUNTRY"],
    ["Name", c.name?.common || countryName],
    ["Capital", safeVal(c.capital?.[0])],
    ["Region", safeVal(c.region)],
    ["Subregion", safeVal(c.subregion)],
    ["Population", typeof c.population === "number" ? fmtNum(c.population) : "—"],
    ["Area", typeof c.area === "number" ? `${fmtNum(Math.round(c.area))} km²` : "—"],
    ["Currencies", c.currencies ? Object.values(c.currencies).map(x=>x?.name).filter(Boolean).join(", ") : "—"],
    ["Languages", c.languages ? Object.values(c.languages).join(", ") : "—"],
    ["Timezones", c.timezones ? c.timezones.join(", ") : "—"],
    ["Code", safeVal(c.cca2)]
  ]);
}

/* ---------- Facts (Wikipedia summary) ---------- */
async function wikipediaSummary(title){
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "Accept":"application/json" }});
  if (!res.ok) return null;
  const j = await res.json();
  if (!j || !j.extract) return null;
  return j.extract;
}

function toSentences(text){
  return (text || "")
    .replace(/\s+/g," ")
    .split(/(?<=[.!?])\s+/)
    .map(s=>s.trim())
    .filter(s=>s.length >= 40);
}

async function buildFacts(sel){
  const name = sel.name;
  let extract = await wikipediaSummary(name);

  if (!extract && sel.typeKey === "rivers") extract = await wikipediaSummary(`${name} River`);
  if (!extract && sel.typeKey === "mountains") extract = await wikipediaSummary(`${name} Mountain`);
  if (!extract && sel.typeKey === "cities") extract = await wikipediaSummary(`${name} (city)`);

  const facts = [];
  if (extract){
    const s = toSentences(extract).slice(0, 8);
    if (s.length) facts.push(...s.map(x => `✨ ${x}`));
  } else {
    facts.push(`🤷 Wikipedia page not found for "${name}" (dataset name mismatch).`);
  }

  if (sel.latlng) facts.push(`📍 Approx location: ${sel.latlng[0].toFixed(2)}°, ${sel.latlng[1].toFixed(2)}°`);
  return Array.from(new Set(facts)).slice(0, 10);
}

function openFacts(){
  els.factsModal.classList.remove("hidden");
}
function closeFacts(){
  els.factsModal.classList.add("hidden");
}
function showFact(){
  if (!factsState.list.length){
    els.factsBox.textContent = "No facts. Select something then click Facts.";
    els.factsMeta.textContent = "—";
    return;
  }
  els.factsBox.textContent = factsState.list[factsState.idx];
  els.factsMeta.textContent = `Fact ${factsState.idx + 1} / ${factsState.list.length}`;
}
els.closeFacts.addEventListener("click", closeFacts);
els.nextFact.addEventListener("click", () => {
  if (!factsState.list.length) return;
  factsState.idx = (factsState.idx + 1) % factsState.list.length;
  showFact();
});
els.btnFacts.addEventListener("click", async () => {
  openFacts();
  if (!selected){
    els.factsTitle.textContent = "No selection";
    factsState = { list: [], idx:0, forKey:"" };
    els.factsBox.textContent = "Select something on the map first.";
    els.factsMeta.textContent = "—";
    return;
  }
  const key = `${selected.typeKey}:${selected.name}`;
  els.factsTitle.textContent = selected.name;

  if (factsState.forKey === key && factsState.list.length){
    showFact();
    return;
  }

  els.factsBox.textContent = "Loading facts…";
  els.factsMeta.textContent = "Loading…";
  const list = await buildFacts(selected);
  factsState = { list, idx:0, forKey:key };
  showFact();
});

/* ---------- Map init ---------- */
const map = L.map("map", { zoomControl:true, preferCanvas:true }).setView([20,0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 7,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

async function showCategory(key){
  currentKey = key;
  selected = null;
  els.btnFacts.disabled = true;
  closeFacts();
  factsState = { list:[], idx:0, forKey:"" };

  setPanel("Loading…", key.toUpperCase());
  els.flag.classList.add("hidden");
  renderDetailsRows([["Status","Loading dataset…"]]);
  clearMapLayers();

  const geo = await loadGeo(key);
  const indiaOn = !!els.indiaFocus.checked;

  const feats = (geo.features || []).filter(f => {
    if (!indiaOn) return true;
    if (key === "countries") return true;
    return isIndiaFeature(key, f.properties);
  });
  const filtered = { ...geo, features: feats };

  if (key === "cities"){
    clusterLayer = L.markerClusterGroup({ chunkedLoading:true, removeOutsideVisibleBounds:true });
    const step = feats.length > 12000 ? 3 : 1;

    for (let i=0;i<feats.length;i+=step){
      const f = feats[i];
      const name = getNameFromProps(f.properties);
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const latlng = [coords[1], coords[0]];

      const m = L.circleMarker(latlng, { radius:3, weight:1, fillOpacity:0.85 });
      m.bindTooltip(name, { sticky:true, opacity:0.95 });

      m.on("click", () => {
        setPanel(name, "CITY");
        map.setView(latlng, 6);
        showNonCountryDetails("cities", "CITY", name, f.properties, latlng);

        selected = { typeKey:"cities", typeLabel:"CITY", name, props:f.properties, latlng };
        els.btnFacts.disabled = false;

        if (mode === "quiz" && els.quizMode.value === "map") checkClickAnswer(name);
      });

      clusterLayer.addLayer(m);
    }
    map.addLayer(clusterLayer);
    setPanel("Ready", "CITIES");
    renderDetailsRows([["Tip","Click a city → Details → Facts"]]);
    return;
  }

  if (key === "mountains"){
    pointLayer = L.layerGroup();
    const step = feats.length > 12000 ? 2 : 1;

    for (let i=0;i<feats.length;i+=step){
      const f = feats[i];
      const name = getNameFromProps(f.properties);
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const latlng = [coords[1], coords[0]];

      const m = L.circleMarker(latlng, { radius:4, weight:1, fillOpacity:0.85 });
      m.bindTooltip(name, { sticky:true, opacity:0.95 });

      m.on("click", () => {
        setPanel(name, "MOUNTAIN");
        map.setView(latlng, 6);
        showNonCountryDetails("mountains", "MOUNTAIN", name, f.properties, latlng);

        selected = { typeKey:"mountains", typeLabel:"MOUNTAIN", name, props:f.properties, latlng };
        els.btnFacts.disabled = false;

        if (mode === "quiz" && els.quizMode.value === "map") checkClickAnswer(name);
      });

      pointLayer.addLayer(m);
    }
    map.addLayer(pointLayer);
    setPanel("Ready", "MOUNTAINS");
    renderDetailsRows([["Tip","Click a mountain → Details → Facts"]]);
    return;
  }

  // polygons/lines
  polygonLayer = L.geoJSON(filtered, {
    style: styleFor(key),
    onEachFeature: (feature, layer) => {
      const name = getNameFromProps(feature.properties);
      layer.bindTooltip(name, { sticky:true, opacity:0.95 });

      layer.on("click", async () => {
        setPanel(name, key.toUpperCase());
        try{ if (layer.getBounds) map.fitBounds(layer.getBounds(), { padding:[20,20] }); } catch {}

        if (key === "countries") await showCountryDetails(name);
        else showNonCountryDetails(key, key.toUpperCase(), name, feature.properties, null);

        selected = { typeKey:key, typeLabel:key.toUpperCase(), name, props:feature.properties, latlng:null };
        els.btnFacts.disabled = false;

        if (mode === "quiz" && els.quizMode.value === "map") checkClickAnswer(name);
      });
    }
  }).addTo(map);

  setPanel("Ready", key.toUpperCase());
  renderDetailsRows([["Tip","Click something → Details → Facts"]]);

  if (mode === "quiz") newQuestion();
}

/* ---------- Pools for quiz ---------- */
async function getPool(key){
  if (poolCache.has(key)) return poolCache.get(key);
  const geo = await loadGeo(key);
  const feats = geo?.features || [];
  const all = [];
  const india = [];
  for (const f of feats){
    const nm = getNameFromProps(f.properties);
    if (!nm || nm === "Unknown") continue;
    all.push(nm);
    if (isIndiaFeature(key, f.properties)) india.push(nm);
  }
  const uniq = (arr) => Array.from(new Set(arr));
  const out = { all: uniq(all), india: uniq(india) };
  poolCache.set(key, out);
  return out;
}

/* ---------- Quiz ---------- */
const PYQ_BANK = [
  { q:"Which is the highest mountain in the world?", a:"Mount Everest", o:["K2","Kangchenjunga","Mount Everest","Lhotse"] },
  { q:"Which is the largest ocean?", a:"Pacific Ocean", o:["Indian Ocean","Atlantic Ocean","Pacific Ocean","Arctic Ocean"] },
  { q:"Which latitude passes through the middle of India?", a:"Tropic of Cancer", o:["Equator","Prime Meridian","Tropic of Cancer","Arctic Circle"] },
  { q:"Which is the largest country by area?", a:"Russia", o:["Canada","China","Russia","USA"] },
  { q:"Which is the longest river (commonly in GK)?", a:"Nile", o:["Amazon","Yangtze","Nile","Mississippi"] },
];

function setQuizUI(qm){
  const map = { map:"Map Quiz", topic:"Topic-wise", pyq:"PYQ", daily:"Daily (10)" };
  els.quizModeText.textContent = map[qm] || "Quiz";
  els.topicPick.classList.toggle("hidden", qm !== "topic");
  els.dailyProgress.classList.toggle("hidden", qm !== "daily");
}

function lockMCQ(lock=true){
  els.mcqBtns.forEach(b => b.disabled = lock);
}

function renderMCQ(options){
  els.mcqBtns.forEach((btn, i) => {
    btn.textContent = options[i] ?? "—";
    btn.disabled = false;
  });
}

function examPrompt(answer, topicKey){
  const ex = els.examMode.value;
  if (ex === "upsc") return `UPSC Drill (${topicKey}): Identify "${answer}"`;
  if (ex === "ssc") return `SSC GK (${topicKey}): Choose "${answer}"`;
  if (ex === "nda") return `NDA Drill (${topicKey}): "${answer}"`;
  if (ex === "cds") return `CDS Drill (${topicKey}): "${answer}"`;
  return `Select: "${answer}"`;
}

function buildMCQ(pool, answer){
  const set = new Set([answer]);
  while (set.size < 4) set.add(pickRandom(pool));
  const options = shuffle(Array.from(set));
  return { options, correctIndex: options.indexOf(answer) };
}

// daily seed (simple)
function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function seededRand(seedStr){
  let h = 2166136261;
  for (let i=0;i<seedStr.length;i++){
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function(){
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function startDaily(){
  const seed = `${todayKey()}|${els.examMode.value}|${els.indiaFocus.checked?"IN":"ALL"}`;
  const rand = seededRand(seed);
  const topics = ["countries","states","cities","rivers","mountains"];
  const questions = [];

  for (let i=0;i<10;i++){
    const topicKey = topics[i % topics.length];
    const pools = await getPool(topicKey);
    let pool = (els.indiaFocus.checked && topicKey !== "countries") ? pools.india : pools.all;
    if (pool.length < 20) pool = pools.all;
    if (pool.length < 4) continue;

    const answer = pool[Math.floor(rand()*pool.length)];
    const set = new Set([answer]);
    while (set.size < 4) set.add(pool[Math.floor(rand()*pool.length)]);
    const options = shuffle(Array.from(set));
    questions.push({
      type:"daily",
      topicKey,
      question:`Daily Q${i+1}: Pick "${answer}" (${topicKey})`,
      options,
      answer,
      correctIndex: options.indexOf(answer)
    });
  }

  daily = { active:true, idx:0, total:10, seed, questions: questions.slice(0,10) };
}

function stopDaily(){
  daily = { active:false, idx:0, total:10, seed:"", questions:[] };
}

async function newQuestion(){
  const qm = els.quizMode.value;
  setQuizUI(qm);
  els.qMsg.textContent = "";
  lockMCQ(false);

  if (qm === "pyq"){
    const item = pickRandom(PYQ_BANK);
    q = { ...item, type:"pyq", correctIndex: item.o.indexOf(item.a) };
    els.qText.textContent = item.q;
    renderMCQ(item.o);
    return;
  }

  if (qm === "daily"){
    if (!daily.active) await startDaily();
    els.dailyProgress.textContent = `Daily: ${daily.idx}/10`;
    const cur = daily.questions[daily.idx];
    if (!cur){
      els.qText.textContent = "✅ Daily Challenge completed!";
      els.qMsg.textContent = "Come back tomorrow.";
      lockMCQ(true);
      return;
    }
    q = cur;
    els.qText.textContent = cur.question;
    renderMCQ(cur.options);
    return;
  }

  const topicKey = (qm === "topic") ? els.topicPick.value : currentKey;
  const pools = await getPool(topicKey);
  let pool = (els.indiaFocus.checked && topicKey !== "countries") ? pools.india : pools.all;
  if (pool.length < 50) pool = pools.all;
  if (pool.length < 4){
    els.qText.textContent = `Not enough data for "${topicKey}".`;
    lockMCQ(true);
    return;
  }

  const answer = pickRandom(pool);
  const built = buildMCQ(pool, answer);
  q = {
    type:"name",
    topicKey,
    question: examPrompt(answer, topicKey),
    options: built.options,
    answer,
    correctIndex: built.correctIndex,
    mode: qm
  };
  els.qText.textContent = q.question;
  renderMCQ(q.options);
}

function applyResult(ok){
  if (ok){
    score += 10;
    els.qMsg.textContent = "✅ Correct +10";
  } else {
    els.qMsg.textContent = `❌ Wrong. Correct: ${q?.answer || "—"}`;
  }
  els.scoreEl.textContent = String(score);
}

function submitMCQ(i){
  if (!q) return;
  lockMCQ(true);
  const ok = i === q.correctIndex;
  applyResult(ok);

  if (els.quizMode.value === "daily" && daily.active){
    daily.idx += 1;
    setTimeout(newQuestion, 700);
    return;
  }
  setTimeout(newQuestion, 850);
}

function checkClickAnswer(clickedName){
  if (!q) return;
  lockMCQ(true);
  applyResult(normalize(clickedName) === normalize(q.answer));
  setTimeout(newQuestion, 850);
}

els.mcqBtns.forEach(btn => {
  btn.addEventListener("click", () => submitMCQ(Number(btn.dataset.i)));
});

/* ---------- Info modal content ---------- */
function openInfo(title, html){
  els.infoTitle.textContent = title;
  els.infoBody.innerHTML = html;
  els.infoModal.classList.remove("hidden");
}
function closeInfo(){
  els.infoModal.classList.add("hidden");
}
els.infoClose.addEventListener("click", closeInfo);
els.infoModal.addEventListener("click", (e) => { if (e.target === els.infoModal) closeInfo(); });

function handleNav(action){
  if (action === "home"){
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (action === "contact"){
    openInfo("Contact Us", `
      <div class="proCard">
        <div class="muted">Feedback, feature requests, and improvement ideas are welcome.</div>
        <div style="height:10px"></div>
        <div class="grid2">
          <div class="proCard">
            <div style="font-weight:900">Email</div>
            <div class="muted">Replace with your real email:</div>
            <div style="margin-top:6px;"><a href="mailto:yourname@example.com">yourname@example.com</a></div>
          </div>
          <div class="proCard">
            <div style="font-weight:900">Social</div>
            <div class="muted">Add your links:</div>
            <div style="margin-top:6px;">
              <span class="badge">Instagram</span>
              <span class="badge">YouTube</span>
              <span class="badge">Telegram</span>
            </div>
          </div>
        </div>
      </div>
    `);
    return;
  }
  if (action === "about"){
    openInfo("About the Founder", `
      <div class="proCard">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:18px;font-weight:900;letter-spacing:.2px;">Himanshu Kumar</div>
            <div class="muted">Founder & Creator — MapCrown</div>
          </div>
          <div class="badge">Muzaffarpur • India</div>
        </div>

        <div style="height:12px"></div>
        <div style="font-size:14px;opacity:.92;">
          MapCrown is built for learners who want geography to become a <b>daily habit</b> — especially for
          <b>UPSC, NDA, CDS, SSC</b> and other competitive exams. The goal:
          <b>explore faster, remember better, revise smarter</b>.
        </div>

        <div style="height:14px"></div>
        <div class="grid2">
          <div class="proCard">
            <div style="font-weight:900">Mission</div>
            <div class="muted" style="margin-top:6px;">
              Make map learning visual, interactive, and exam-ready — so students revise with confidence.
            </div>
          </div>
          <div class="proCard">
            <div style="font-weight:900">Focus</div>
            <div class="muted" style="margin-top:6px;">
              Map-based revision • Details • Facts • MCQ drills • Daily practice
            </div>
          </div>
        </div>

        <div style="height:12px"></div>
        <div style="font-weight:900">Built for</div>
        <div style="margin-top:6px;">
          <span class="badge">UPSC Prelims</span>
          <span class="badge">NDA</span>
          <span class="badge">CDS</span>
          <span class="badge">SSC</span>
          <span class="badge">GK</span>
        </div>
      </div>
    `);
  }
}

document.querySelectorAll("[data-nav]").forEach(btn => {
  btn.addEventListener("click", () => handleNav(btn.dataset.nav));
});

/* ---------- Mobile dropdown menu ---------- */
(function mobileMenu(){
  function close(){ els.mMenu.classList.add("hidden"); }
  function toggle(){ els.mMenu.classList.toggle("hidden"); }

  els.mMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  document.addEventListener("click", close);

  els.mMenu?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.nav){
      close();
      handleNav(t.dataset.nav);
    }
  });
})();

/* ---------- UI events ---------- */
els.examMode.addEventListener("change", () => {
  const mapText = { general:"General", upsc:"UPSC", nda:"NDA", cds:"CDS", ssc:"SSC" };
  els.modeText.textContent = mapText[els.examMode.value] || "General";
  if (mode === "quiz") newQuestion();
});

els.indiaFocus.addEventListener("change", () => {
  showCategory(currentKey).catch(console.error);
  if (mode === "quiz") newQuestion();
});

els.category.addEventListener("change", () => {
  showCategory(els.category.value).catch(err => {
    console.error(err);
    setPanel("Dataset missing", "ERROR");
    renderDetailsRows([["Error", err.message]]);
    els.btnFacts.disabled = true;
  });
});

els.btnQuiz.addEventListener("click", () => {
  mode = "quiz";
  els.btnQuiz.classList.add("active");
  els.btnExplore.classList.remove("active");
  els.quizBox.classList.remove("hidden");
  stopDaily();
  newQuestion();
});

els.btnExplore.addEventListener("click", () => {
  mode = "explore";
  els.btnExplore.classList.add("active");
  els.btnQuiz.classList.remove("active");
  els.quizBox.classList.add("hidden");
});

els.quizMode.addEventListener("change", () => {
  setQuizUI(els.quizMode.value);
  if (els.quizMode.value !== "daily") stopDaily();
  newQuestion();
});

els.topicPick.addEventListener("change", () => {
  if (mode === "quiz") newQuestion();
});

els.btnDaily.addEventListener("click", async () => {
  mode = "quiz";
  els.btnQuiz.classList.add("active");
  els.btnExplore.classList.remove("active");
  els.quizBox.classList.remove("hidden");

  els.quizMode.value = "daily";
  setQuizUI("daily");
  stopDaily();
  await startDaily();
  await newQuestion();
});

/* ---------- boot ---------- */
(async function init(){
  els.modeText.textContent = "General";
  setPanel("Loading…", "COUNTRIES");
  try{
    await showCategory("countries");
  } catch (e){
    console.error(e);
    alert("Missing/incorrect GeoJSON files. Check /data filenames + extension .json");
  }
})();
