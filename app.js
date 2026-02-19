/* MapCrown • Geo Explorer
   - Premium menu + About Founder (Muzaffarpur, exam prep)
   - Mobile bottom sheet details panel (CSS handles it)
   - Explore: countries/states/cities/rivers/mountains
   - Amazing Facts: Wikipedia summary -> real facts
   - Quiz: Map quiz + Topic-wise + PYQ mode + Daily challenge (10 Q)
   - India Focus: filters non-country datasets when possible
*/

const els = {
  // top controls
  category: document.getElementById("category"),
  examMode: document.getElementById("examMode"),
  indiaFocus: document.getElementById("indiaFocus"),
  btnFacts: document.getElementById("btnFacts"),
  btnDaily: document.getElementById("btnDaily"),
  btnQuiz: document.getElementById("btnQuiz"),
  btnExplore: document.getElementById("btnExplore"),

  // panel
  title: document.getElementById("title"),
  cName: document.getElementById("cName"),
  cType: document.getElementById("cType"),
  modeText: document.getElementById("modeText"),
  details: document.getElementById("details"),
  flag: document.getElementById("flag"),

  // quiz
  quizBox: document.getElementById("quizBox"),
  quizMode: document.getElementById("quizMode"),
  topicPick: document.getElementById("topicPick"),
  quizModeText: document.getElementById("quizModeText"),
  qText: document.getElementById("qText"),
  qMsg: document.getElementById("qMsg"),
  scoreEl: document.getElementById("score"),
  dailyProgress: document.getElementById("dailyProgress"),
  mcqBtns: Array.from(document.querySelectorAll(".mcqBtn")),

  // facts
  factsModal: document.getElementById("factsModal"),
  closeFacts: document.getElementById("closeFacts"),
  nextFact: document.getElementById("nextFact"),
  factsBox: document.getElementById("factsBox"),
  factsTitle: document.getElementById("factsTitle"),
  factsMeta: document.getElementById("factsMeta"),

  // menu/info modal
  menuBtn: document.getElementById("menuBtn"),
  menuClose: document.getElementById("menuClose"),
  menuDrawer: document.getElementById("menuDrawer"),
  menuOverlay: document.getElementById("menuOverlay"),
  infoModal: document.getElementById("infoModal"),
  infoTitle: document.getElementById("infoTitle"),
  infoBody: document.getElementById("infoBody"),
  infoClose: document.getElementById("infoClose"),
};

const DATA_FILES = {
  countries: "data/countries.min.json",
  states: "data/states_provinces.min.json",
  cities: "data/cities_major.min.json",
  rivers: "data/rivers.min.json",
  mountains: "data/mountains_peaks.min.json",
};

let mode = "explore";           // explore | quiz
let currentKey = "countries";   // map category currently loaded
let score = 0;

// caches
const geoCache = new Map();
const poolCache = new Map();    // key -> {allNames, indiaNames}

// leaflet layers
let polygonLayer = null;
let clusterLayer = null;
let pointLayer = null;

// selection
let selected = null; // { typeKey, typeLabel, name, props, latlng }
let factsState = { list: [], idx: 0, forKey: "" };

// quiz state
let q = null;
let dailyState = { active:false, idx:0, total:10, seed:"", questions:[] };

function normalize(s){ return (s || "").trim().toLowerCase(); }
function safeVal(v){
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function fmtNum(n){
  if (typeof n !== "number") return "—";
  return n.toLocaleString("en-IN");
}
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
function getNameFromProps(p){
  return (
    p?.name || p?.NAME || p?.Name ||
    p?.name_en || p?.NAME_EN ||
    p?.nameascii || p?.NAMEASCII ||
    p?.name_long || p?.NAME_LONG ||
    p?.admin || p?.ADMIN ||
    p?.adm0name || p?.ADM0NAME ||
    p?.river || p?.RIVER ||
    p?.city || p?.CITY ||
    "Unknown"
  );
}
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffle(arr){
  for (let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

/* =========================
   MENU + INFO MODAL
========================= */
function openMenu(){
  els.menuDrawer.classList.remove("hidden");
  els.menuOverlay.classList.remove("hidden");
}
function closeMenu(){
  els.menuDrawer.classList.add("hidden");
  els.menuOverlay.classList.add("hidden");
}
function openInfo(title, html){
  els.infoTitle.textContent = title;
  els.infoBody.innerHTML = html;
  els.infoModal.classList.remove("hidden");
}
function closeInfo(){
  els.infoModal.classList.add("hidden");
}
els.menuBtn?.addEventListener("click", openMenu);
els.menuClose?.addEventListener("click", closeMenu);
els.menuOverlay?.addEventListener("click", closeMenu);
els.infoClose?.addEventListener("click", closeInfo);
els.infoModal?.addEventListener("click", (e) => { if (e.target === els.infoModal) closeInfo(); });

function handleNav(action){
  closeMenu();
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

        <div style="height:12px"></div>
        <div class="muted">Tip: mention device (mobile/PC) + category (countries/states/etc.) for faster fixes.</div>
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
          <b>UPSC, NDA, CDS, SSC</b> and other competitive exams. The goal is simple:
          <b>explore faster, remember better, and revise smarter</b>.
        </div>

        <div style="height:14px"></div>

        <div class="grid2">
          <div class="proCard">
            <div style="font-weight:900">Mission</div>
            <div class="muted" style="margin-top:6px;">
              Make map learning visual, interactive, and exam-ready — so students can revise with confidence.
            </div>
          </div>

          <div class="proCard">
            <div style="font-weight:900">Focus Areas</div>
            <div class="muted" style="margin-top:6px;">
              Map-based revision • Quick details • MCQ practice • Daily challenge • India focus
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
          <span class="badge">General Knowledge</span>
        </div>

        <div style="height:12px"></div>
        <div style="font-weight:900">Core Features</div>
        <div style="margin-top:6px;">
          <span class="badge">Explore</span>
          <span class="badge">Topic-wise Quiz</span>
          <span class="badge">PYQ Mode</span>
          <span class="badge">Daily Challenge</span>
          <span class="badge">Amazing Facts</span>
          <span class="badge">Mobile Friendly</span>
        </div>

        <div style="height:14px"></div>
        <div class="muted">
          Future upgrades: <b>PYQ packs</b>, <b>India-only revision sets</b>, <b>topic-wise practice</b>,
          <b>leaderboard</b>, and <b>saved progress</b>.
        </div>
      </div>
    `);
  }
}
document.querySelectorAll("[data-nav]").forEach(btn => {
  btn.addEventListener("click", () => handleNav(btn.dataset.nav));
});

/* =========================
   FACTS MODAL
========================= */
function openFactsModal(){
  els.factsModal.classList.remove("hidden");
  els.factsModal.setAttribute("aria-hidden", "false");
}
function closeFactsModal(){
  els.factsModal.classList.add("hidden");
  els.factsModal.setAttribute("aria-hidden", "true");
}
els.closeFacts.addEventListener("click", closeFactsModal);
els.factsModal.addEventListener("click", (e) => {
  if (e.target === els.factsModal) closeFactsModal();
});
function showCurrentFact(){
  if (!factsState.list.length){
    els.factsBox.textContent = "No facts. Select something and click Amazing Facts.";
    els.factsMeta.textContent = "—";
    return;
  }
  els.factsBox.textContent = factsState.list[factsState.idx];
  els.factsMeta.textContent = `Fact ${factsState.idx + 1} / ${factsState.list.length}`;
}
els.nextFact.addEventListener("click", () => {
  if (!factsState.list.length) return;
  factsState.idx = (factsState.idx + 1) % factsState.list.length;
  showCurrentFact();
});

/* =========================
   LEAFLET MAP
========================= */
const map = L.map("map", { zoomControl:true, preferCanvas:true }).setView([20,0],2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 7,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

function clearMapLayers(){
  if (polygonLayer){ map.removeLayer(polygonLayer); polygonLayer = null; }
  if (clusterLayer){ map.removeLayer(clusterLayer); clusterLayer = null; }
  if (pointLayer){ map.removeLayer(pointLayer); pointLayer = null; }
}
function styleFor(key){
  if (key === "countries") return { color:"#5aa7ff", weight:1, fillOpacity:0.18 };
  if (key === "states") return { color:"#ffd166", weight:1, fillOpacity:0.10 };
  if (key === "rivers") return { color:"#4cc9f0", weight:2, opacity:0.85 };
  return undefined;
}
async function loadGeo(key){
  if (geoCache.has(key)) return geoCache.get(key);
  const res = await fetch(DATA_FILES[key]);
  if (!res.ok) throw new Error(`Missing file: ${DATA_FILES[key]}`);
  const geo = await res.json();
  geoCache.set(key, geo);
  return geo;
}

/* =========================
   INDIA FILTER (best effort)
========================= */
function isIndiaFeature(key, props){
  // countries dataset: not used here
  // for states/cities/rivers/mountains we try multiple fields
  const admin = String(props?.admin || props?.ADMIN || props?.adm0name || props?.ADM0NAME || "").toLowerCase();
  const country = String(props?.country || props?.COUNTRY || "").toLowerCase();
  const iso = String(props?.iso_a2 || props?.ISO_A2 || props?.iso_a3 || props?.ISO_A3 || "").toLowerCase();

  // Some datasets mark India clearly in admin/adm0name.
  if (admin.includes("india") || country.includes("india")) return true;

  // iso hints
  if (iso === "in" || iso === "ind") return true;

  return false;
}

function buildPoolsForKey(key, geo){
  const feats = geo?.features || [];
  const allNames = [];
  const indiaNames = [];

  for (const f of feats){
    const nm = getNameFromProps(f.properties);
    if (!nm || nm === "Unknown") continue;
    allNames.push(nm);
    if (isIndiaFeature(key, f.properties)) indiaNames.push(nm);
  }

  const uniq = (arr) => Array.from(new Set(arr));
  return { allNames: uniq(allNames), indiaNames: uniq(indiaNames) };
}

async function getPool(key){
  if (poolCache.has(key)) return poolCache.get(key);
  const geo = await loadGeo(key);
  const pools = buildPoolsForKey(key, geo);
  poolCache.set(key, pools);
  return pools;
}

/* =========================
   CLEAN DETAILS (non-countries)
========================= */
const NAME_KEYS = [
  "name_en","NAME_EN","name","NAME","Name",
  "name_long","NAME_LONG","nameascii","NAMEASCII",
  "admin","ADMIN","adm0name","ADM0NAME","state","STATE",
  "province","PROVINCE","city","CITY"
];

function pickBestNameFromProps(props, fallback="Unknown"){
  for (const k of NAME_KEYS){
    const v = props?.[k];
    if (v !== undefined && v !== null){
      const s = String(v).trim();
      if (s && s !== "—") return s;
    }
  }
  return fallback;
}
function humanKey(k){
  const map = {
    featurecla: "Feature Class", FEATURECLA: "Feature Class",
    rivernum: "River No", RIVERNUM: "River No",
    scalerank: "Scale Rank", SCALERANK: "Scale Rank",
    min_zoom: "Min Zoom", min_label: "Min Label",
    length_km: "Length (km)", LENGTH_KM: "Length (km)",
    elev: "Elevation", ELEV: "Elevation", elevation:"Elevation", ELEVATION:"Elevation",
    pop_max: "Population (max)", POP_MAX:"Population (max)",
    adm0_a3: "Country Code", ADM0_A3: "Country Code",
    iso_a2: "ISO A2", ISO_A2:"ISO A2",
    iso_a3: "ISO A3", ISO_A3:"ISO A3",
    region: "Region", REGION:"Region",
    subregion:"Subregion", SUBREGION:"Subregion",
  };
  return map[k] || k.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
}
function getCoordText(latlng){
  if (!latlng) return null;
  return `${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}`;
}
function buildProfileRows(typeKey, typeLabel, name, props, latlng){
  const rows = [];
  rows.push(["Type", typeLabel]);
  rows.push(["Name", name]);

  const coord = getCoordText(latlng);
  if (coord) rows.push(["Coordinates", coord]);

  if (typeKey === "states"){
    const country = props?.admin || props?.ADMIN || props?.adm0name || props?.ADM0NAME;
    if (country) rows.push(["Country", String(country)]);
  }
  if (typeKey === "cities"){
    const country = props?.adm0name || props?.ADM0NAME || props?.admin || props?.ADMIN;
    const pop = props?.pop_max ?? props?.POP_MAX ?? props?.population ?? props?.POP;
    if (country) rows.push(["Country", String(country)]);
    if (pop !== undefined) rows.push(["Population", safeVal(pop)]);
  }
  if (typeKey === "rivers"){
    const num = props?.rivernum ?? props?.RIVERNUM;
    const len = props?.length_km ?? props?.LENGTH_KM ?? props?.length ?? props?.LENGTH;
    const cls = props?.featurecla ?? props?.FEATURECLA;
    if (cls) rows.push(["Feature Class", safeVal(cls)]);
    if (num !== undefined) rows.push(["River No", safeVal(num)]);
    if (len !== undefined) rows.push(["Length", safeVal(len)]);
  }
  if (typeKey === "mountains"){
    const elev = props?.elev ?? props?.ELEV ?? props?.elevation ?? props?.ELEVATION;
    if (elev !== undefined) rows.push(["Elevation", safeVal(elev)]);
  }

  const useful = [
    "region","REGION","subregion","SUBREGION",
    "iso_a2","ISO_A2","iso_a3","ISO_A3","adm0_a3","ADM0_A3",
    "scalerank","SCALERANK","min_zoom","min_label"
  ];
  for (const k of useful){
    if (props && props[k] !== undefined && props[k] !== null && String(props[k]).trim() !== ""){
      const label = humanKey(k);
      if (!rows.some(r => r[0] === label)) rows.push([label, safeVal(props[k])]);
    }
  }
  return rows;
}
function showNonCountryDetails(typeKey, typeLabel, clickedName, props, latlng){
  els.flag.classList.add("hidden");
  els.flag.src = "";

  const bestName = pickBestNameFromProps(props, clickedName);
  const profileRows = buildProfileRows(typeKey, typeLabel, bestName, props, latlng);
  renderDetailsRows(profileRows);

  // Raw Data dropdown
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

/* =========================
   COUNTRY DETAILS (API)
========================= */
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
  renderDetailsRows([
    ["Type","COUNTRY"],["Name",countryName],["Loading","Fetching full details…"]
  ]);

  const c = await loadCountryFromAPI(countryName);
  if (!c){
    renderDetailsRows([
      ["Type","COUNTRY"],["Name",countryName],
      ["Error","Couldn’t load country details (internet/name mismatch)."]
    ]);
    els.flag.classList.add("hidden");
    els.flag.src = "";
    return null;
  }

  const capital = c.capital?.[0] || "—";
  const region = c.region || "—";
  const subregion = c.subregion || "—";
  const population = typeof c.population === "number" ? fmtNum(c.population) : "—";
  const area = typeof c.area === "number" ? `${fmtNum(Math.round(c.area))} km²` : "—";
  const currencies = c.currencies ? Object.values(c.currencies).map(x=>x?.name).filter(Boolean).join(", ") : "—";
  const languages = c.languages ? Object.values(c.languages).join(", ") : "—";
  const timezones = c.timezones ? c.timezones.join(", ") : "—";

  const flagUrl = c.flags?.png || c.flags?.svg || "";
  if (flagUrl){
    els.flag.src = flagUrl;
    els.flag.classList.remove("hidden");
  } else {
    els.flag.classList.add("hidden");
  }

  renderDetailsRows([
    ["Type","COUNTRY"],
    ["Name",c.name?.common || countryName],
    ["Capital",capital],
    ["Region",region],
    ["Subregion",subregion],
    ["Population",population],
    ["Area",area],
    ["Currencies",currencies || "—"],
    ["Languages",languages || "—"],
    ["Timezones",timezones || "—"],
    ["Code",c.cca2 || "—"]
  ]);

  return c;
}

/* =========================
   AMAZING FACTS (Wikipedia)
========================= */
async function wikipediaSummary(title){
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return null;
  const j = await res.json();
  if (!j || !j.extract) return null;
  return { extract: j.extract };
}
function extractSentences(text){
  return (text || "")
    .replace(/\s+/g," ")
    .split(/(?<=[.!?])\s+/)
    .map(s=>s.trim())
    .filter(s=>s.length >= 40);
}
function makeFunFacts(name, extract){
  const facts = [];
  const sents = extractSentences(extract);

  if (extract) facts.push(`🤯 ${name}: ${extract.length > 220 ? extract.slice(0,220).trim() + "…" : extract}`);
  for (const s of sents.slice(0, 6)) facts.push(`✨ ${s}`);
  return Array.from(new Set(facts));
}
async function buildAmazingFacts(sel){
  const { typeKey, name, props, latlng } = sel;

  let wiki = await wikipediaSummary(name);
  if (!wiki && typeKey === "rivers") wiki = await wikipediaSummary(`${name} River`);
  if (!wiki && typeKey === "mountains") wiki = await wikipediaSummary(`${name} Mountain`);
  if (!wiki && typeKey === "cities") wiki = await wikipediaSummary(`${name} (city)`);

  const facts = [];
  if (wiki?.extract){
    facts.push(...makeFunFacts(name, wiki.extract));
  } else {
    facts.push(`🤷 Wikipedia page not found for "${name}" (dataset name mismatch).`);
  }

  // small dataset-based wow lines (not dump)
  if (latlng) facts.push(`📍 Located near ${latlng[0].toFixed(2)}°, ${latlng[1].toFixed(2)}° (approx).`);
  if (typeKey === "mountains"){
    const elev = props?.elev ?? props?.ELEV ?? props?.elevation ?? props?.ELEVATION;
    if (elev !== undefined) facts.push(`⛰️ Dataset reports elevation: ${safeVal(elev)}.`);
  }
  if (typeKey === "rivers"){
    const len = props?.length_km ?? props?.LENGTH_KM ?? props?.length ?? props?.LENGTH;
    if (len !== undefined) facts.push(`🌊 Dataset reports length: ${safeVal(len)}.`);
  }
  return Array.from(new Set(facts)).slice(0, 10);
}
els.btnFacts.addEventListener("click", async () => {
  if (!selected){
    els.factsTitle.textContent = "No selection";
    factsState = { list: [], idx: 0, forKey: "" };
    els.factsBox.textContent = "Select something on the map first.";
    els.factsMeta.textContent = "—";
    openFactsModal();
    return;
  }

  const key = `${selected.typeKey}:${selected.name}`;
  if (factsState.forKey === key && factsState.list.length){
    els.factsTitle.textContent = selected.name;
    openFactsModal();
    showCurrentFact();
    return;
  }

  els.factsTitle.textContent = selected.name;
  els.factsBox.textContent = "Loading amazing facts…";
  els.factsMeta.textContent = "Loading…";
  openFactsModal();

  const list = await buildAmazingFacts(selected);
  factsState = { list, idx: 0, forKey: key };
  showCurrentFact();
});

/* =========================
   RENDER CATEGORY
========================= */
async function showCategory(key){
  currentKey = key;

  // reset selection + facts
  closeFactsModal();
  selected = null;
  els.btnFacts.disabled = true;
  factsState = { list: [], idx: 0, forKey: "" };

  setPanel("Loading…", key.toUpperCase());
  els.flag.classList.add("hidden");
  els.flag.src = "";
  renderDetailsRows([["Status","Loading dataset…"]]);

  clearMapLayers();

  const geo = await loadGeo(key);
  const indiaOn = !!els.indiaFocus.checked;

  // filter features if India Focus (non-countries only)
  const feats = (geo.features || []).filter(f => {
    if (!indiaOn) return true;
    if (key === "countries") return true; // keep all countries (optional)
    return isIndiaFeature(key, f.properties);
  });

  const filteredGeo = { ...geo, features: feats };

  if (key === "cities"){
    clusterLayer = L.markerClusterGroup({ chunkedLoading:true, removeOutsideVisibleBounds:true });

    const isHuge = feats.length > 12000;
    const step = isHuge ? 3 : 1;

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
    renderDetailsRows([["Tip","Click a city → Details. Then Amazing Facts."]]);

  } else if (key === "mountains"){
    pointLayer = L.layerGroup();

    const isHuge = feats.length > 12000;
    const step = isHuge ? 2 : 1;

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
    renderDetailsRows([["Tip","Click a mountain → Details. Then Amazing Facts."]]);

  } else {
    polygonLayer = L.geoJSON(filteredGeo, {
      style: styleFor(key),
      onEachFeature: (feature, l) => {
        const name = getNameFromProps(feature.properties);
        l.bindTooltip(name, { sticky:true, opacity:0.95 });

        l.on("click", async () => {
          setPanel(name, key.toUpperCase());
          try{
            if (l.getBounds) map.fitBounds(l.getBounds(), { padding:[20,20] });
          } catch {}

          if (key === "countries"){
            await showCountryDetails(name);
          } else {
            showNonCountryDetails(key, key.toUpperCase(), name, feature.properties, null);
          }

          selected = { typeKey:key, typeLabel:key.toUpperCase(), name, props:feature.properties, latlng:null };
          els.btnFacts.disabled = false;

          if (mode === "quiz" && els.quizMode.value === "map") checkClickAnswer(name);
        });
      }
    }).addTo(map);

    setPanel("Ready", key.toUpperCase());
    renderDetailsRows([["Tip","Click something → Details. Then Amazing Facts."]]);
  }

  // if quiz active, refresh the question
  if (mode === "quiz") newQuestion();
}

/* =========================
   QUIZ SYSTEM (ALL MODES)
========================= */

// PYQ-like static bank (real GK style)
const PYQ_BANK = [
  { q: "Which is the highest mountain in the world?", a: "Mount Everest", o: ["K2","Kangchenjunga","Mount Everest","Lhotse"] },
  { q: "Which is the longest river in the world (commonly accepted in GK)?", a: "Nile", o: ["Amazon","Yangtze","Nile","Mississippi"] },
  { q: "Which is the largest ocean?", a: "Pacific Ocean", o: ["Indian Ocean","Atlantic Ocean","Pacific Ocean","Arctic Ocean"] },
  { q: "Which is the largest continent by area?", a: "Asia", o: ["Africa","Europe","Asia","South America"] },
  { q: "Which latitude passes through the middle of India?", a: "Tropic of Cancer", o: ["Equator","Arctic Circle","Tropic of Cancer","Prime Meridian"] },
  { q: "Which is the largest desert in the world?", a: "Sahara", o: ["Gobi","Kalahari","Sahara","Thar"] },
  { q: "Which is the deepest ocean trench?", a: "Mariana Trench", o: ["Tonga Trench","Puerto Rico Trench","Mariana Trench","Java Trench"] },
  { q: "Which Indian state is called the 'Land of Five Rivers'?", a: "Punjab", o: ["Haryana","Punjab","Bihar","Rajasthan"] },
  { q: "Which is the southernmost point of mainland India?", a: "Kanyakumari", o: ["Rameswaram","Kanyakumari","Kochi","Chennai"] },
  { q: "Which is the largest country by area?", a: "Russia", o: ["Canada","China","Russia","USA"] },
];

// seeded random for Daily Challenge
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededPick(arr, rand){
  return arr[Math.floor(rand()*arr.length)];
}

function setQuizUI(modeKey){
  const map = { map:"Map Quiz", topic:"Topic-wise Quiz", pyq:"PYQ Mode", daily:"Daily Challenge" };
  els.quizModeText.textContent = map[modeKey] || "Quiz";
  els.topicPick.classList.toggle("hidden", modeKey !== "topic");
  els.dailyProgress.classList.toggle("hidden", modeKey !== "daily");
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

function lockMCQ(lock=true){
  els.mcqBtns.forEach(b => b.disabled = lock);
}

function renderMCQ(options){
  els.mcqBtns.forEach((btn, i) => {
    btn reminder = options[i] ?? "—";
    btn.textContent = reminder;
    btn.disabled = false;
  });
}

// build options for name-based question
function buildNameMCQ(pool, answer){
  const set = new Set([answer]);
  while (set.size < 4) set.add(pickRandom(pool));
  const options = shuffle(Array.from(set));
  return { options, correctIndex: options.indexOf(answer) };
}

// Decide pool based on India Focus + exam mode + topic
async function getActivePoolFor(topicKey){
  // countries pool is derived from dataset (names), but facts/details via API
  const pools = await getPool(topicKey);
  const indiaOn = !!els.indiaFocus.checked;

  // exam mode can bias pool (simple policy)
  const exam = els.examMode.value;
  let pool = indiaOn && topicKey !== "countries" ? pools.indiaNames : pools.allNames;

  // For SSC/NDA/CDS we can prefer India focus automatically if user enabled it (already handled)
  // UPSC: keep world + India (no extra restriction)

  // fallback if India pool too small
  if (pool.length < 50) pool = pools.allNames;
  return pool;
}

// Generate next question based on quiz mode
async function newQuestion(){
  const qm = els.quizMode.value;
  setQuizUI(qm);
  els.qMsg.textContent = "";
  lockMCQ(false);

  if (qm === "pyq"){
    // random PYQ
    const item = pickRandom(PYQ_BANK);
    q = { type:"pyq", question:item.q, options:item.o, answer:item.a, correctIndex:item.o.indexOf(item.a) };
    els.qText.textContent = item.q;
    renderMCQ(item.o);
    return;
  }

  if (qm === "daily"){
    if (!dailyState.active) startDailyChallenge(); // ensure created
    const cur = dailyState.questions[dailyState.idx];
    if (!cur){
      els.qText.textContent = "✅ Daily Challenge Completed!";
      els.qMsg.textContent = "Come back tomorrow for a new set.";
      lockMCQ(true);
      return;
    }
    els.dailyProgress.textContent = `Daily: ${dailyState.idx}/10`;
    q = cur;
    els.qText.textContent = cur.question;
    renderMCQ(cur.options);
    return;
  }

  // topic or map quiz uses dataset names
  const topicKey = (qm === "topic") ? els.topicPick.value : currentKey;
  const pool = await getActivePoolFor(topicKey);

  if (!pool || pool.length < 4){
    els.qText.textContent = `Not enough data for "${topicKey}".`;
    els.qMsg.textContent = "";
    els.mcqBtns.forEach(b => { b.textContent = "—"; b.disabled = true; });
    return;
  }

  // Question type: exam mode decides prompt style
  const exam = els.examMode.value;
  const answer = pickRandom(pool);
  const { options, correctIndex } = buildNameMCQ(pool, answer);

  let prompt = `Select: "${answer}"`;
  if (exam === "upsc") prompt = `Identify on map / MCQ: "${answer}"`;
  if (exam === "ssc") prompt = `GK Practice: choose the correct name: "${answer}"`;
  if (exam === "nda" || exam === "cds") prompt = `Geography Drill: "${answer}"`;

  q = { type:"name", topicKey, question: prompt, options, answer, correctIndex, mode: qm };
  els.qText.textContent = prompt;
  renderMCQ(options);
}

function submitMCQ(i){
  if (!q) return;
  lockMCQ(true);
  const ok = i === q.correctIndex;
  applyResult(ok);

  // daily progress
  if (els.quizMode.value === "daily" && dailyState.active){
    dailyState.idx += 1;
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

// Daily Challenge builder: deterministic per date + exam + India focus
async function startDailyChallenge(){
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,"0");
  const d = String(now.getDate()).padStart(2,"0");
  const dateKey = `${y}-${m}-${d}`;
  const seedStr = `${dateKey}|${els.examMode.value}|${els.indiaFocus.checked ? "IN" : "ALL"}`;
  const seed = xmur3(seedStr)();
  const rand = mulberry32(seed);

  // daily uses topic rotation to feel rich
  const topics = ["countries","states","cities","rivers","mountains"];
  const qs = [];

  for (let i=0;i<10;i++){
    const topicKey = topics[i % topics.length];
    const pool = await getActivePoolFor(topicKey);
    if (pool.length < 4) continue;

    const answer = seededPick(pool, rand);
    // build seeded options
    const set = new Set([answer]);
    while (set.size < 4) set.add(seededPick(pool, rand));
    const options = shuffle(Array.from(set));
    const correctIndex = options.indexOf(answer);

    qs.push({
      type:"daily",
      topicKey,
      question:`Daily Q${i+1}: Pick "${answer}" (${topicKey})`,
      options,
      answer,
      correctIndex
    });
  }

  dailyState = { active:true, idx:0, total:10, seed: seedStr, questions: qs.slice(0,10) };
  els.dailyProgress.classList.remove("hidden");
}

function stopDailyChallenge(){
  dailyState = { active:false, idx:0, total:10, seed:"", questions:[] };
  els.dailyProgress.classList.add("hidden");
}

/* =========================
   UI BUTTONS
========================= */
els.btnQuiz.addEventListener("click", () => {
  mode = "quiz";
  els.btnQuiz.classList.add("active");
  els.btnExplore.classList.remove("active");
  els.quizBox.classList.remove("hidden");
  stopDailyChallenge();
  newQuestion();
});

els.btnExplore.addEventListener("click", () => {
  mode = "explore";
  els.btnExplore.classList.add("active");
  els.btnQuiz.classList.remove("active");
  els.quizBox.classList.add("hidden");
});

els.quizMode.addEventListener("change", () => {
  const qm = els.quizMode.value;
  setQuizUI(qm);
  if (qm !== "daily") stopDailyChallenge();
  newQuestion();
});

els.topicPick.addEventListener("change", () => {
  if (mode === "quiz") newQuestion();
});

els.btnDaily.addEventListener("click", () => {
  mode = "quiz";
  els.btnQuiz.classList.add("active");
  els.btnExplore.classList.remove("active");
  els.quizBox.classList.remove("hidden");

  els.quizMode.value = "daily";
  setQuizUI("daily");
  startDailyChallenge().then(newQuestion);
});

els.category.addEventListener("change", () => {
  showCategory(els.category.value).catch(err => {
    console.error(err);
    setPanel("Dataset missing", "ERROR");
    renderDetailsRows([["Error", "File missing/wrong name in /data folder"]]);
    els.btnFacts.disabled = true;
    closeFactsModal();
  });
});

els.indiaFocus.addEventListener("change", () => {
  // reload current category to apply filter
  showCategory(currentKey).catch(console.error);
});

els.examMode.addEventListener("change", () => {
  // update display
  const mapNames = { general:"General", upsc:"UPSC", nda:"NDA", cds:"CDS", ssc:"SSC" };
  els.modeText.textContent = mapNames[els.examMode.value] || "General";

  // refresh quiz prompt style if open
  if (mode === "quiz") newQuestion();
});

/* =========================
   BOOT
========================= */
(async function init(){
  // init mode text
  els.modeText.textContent = "General";
  closeFactsModal();
  try{
    await showCategory("countries");
  } catch (e){
    console.error(e);
    alert("Missing/incorrect GeoJSON files. Check /data filenames.");
  }
})();
