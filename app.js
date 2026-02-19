/* Geo Explorer
   - Countries: good details via REST Countries API + flag
   - Others: CLEAN profile details + Raw Data dropdown (no repeated name fields)
   - Amazing Facts for ALL: Wikipedia summary -> “real facts”
   - Facts modal opens ONLY on button click, Close + Next works
   - Cities: dots + clustering (no pin icons)
*/

const els = {
  category: document.getElementById("category"),
  btnFacts: document.getElementById("btnFacts"),
  btnQuiz: document.getElementById("btnQuiz"),
  btnExplore: document.getElementById("btnExplore"),

  title: document.getElementById("title"),
  cName: document.getElementById("cName"),
  cType: document.getElementById("cType"),

  details: document.getElementById("details"),
  flag: document.getElementById("flag"),

  quizBox: document.getElementById("quizBox"),
  quizFromText: document.getElementById("quizFromText"),
  qText: document.getElementById("qText"),
  qMsg: document.getElementById("qMsg"),
  score: document.getElementById("score"),
  mcqBtns: Array.from(document.querySelectorAll(".mcqBtn")),

  factsModal: document.getElementById("factsModal"),
  closeFacts: document.getElementById("closeFacts"),
  nextFact: document.getElementById("nextFact"),
  factsBox: document.getElementById("factsBox"),
  factsTitle: document.getElementById("factsTitle"),
  factsMeta: document.getElementById("factsMeta"),
};

const DATA_FILES = {
  countries: "data/countries.min.json",
  states: "data/states_provinces.min.json",
  cities: "data/cities_major.min.json",
  rivers: "data/rivers.min.json",
  mountains: "data/mountains_peaks.min.json",
};

let mode = "explore";
let currentKey = "countries";
let score = 0;

const geoCache = new Map();
let currentPool = [];
let q = null;

let polygonLayer = null;
let clusterLayer = null;
let pointLayer = null;

let selected = null; // { typeKey, typeLabel, name, props, latlng }
let factsState = { list: [], idx: 0, forKey: "" };

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

/* ------------------- Facts Modal ------------------- */
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

/* ------------------- Map ------------------- */
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

function buildPool(geo){
  const feats = geo?.features || [];
  const names = [];
  for (const f of feats){
    const nm = getNameFromProps(f.properties);
    if (nm && nm !== "Unknown") names.push(nm);
  }
  return Array.from(new Set(names));
}

/* ------------------- CLEAN DETAILS FOR NON-COUNTRIES ------------------- */
const NAME_KEYS = [
  "name_en","NAME_EN",
  "name","NAME","Name",
  "name_long","NAME_LONG",
  "nameascii","NAMEASCII",
  "admin","ADMIN",
  "adm0name","ADM0NAME",
  "state","STATE",
  "province","PROVINCE",
  "city","CITY"
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
    featurecla: "Feature Class",
    FEATURECLA: "Feature Class",
    rivernum: "River No",
    RIVERNUM: "River No",
    scalerank: "Scale Rank",
    SCALERANK: "Scale Rank",
    min_zoom: "Min Zoom",
    min_label: "Min Label",
    length_km: "Length (km)",
    LENGTH_KM: "Length (km)",
    elev: "Elevation",
    ELEV: "Elevation",
    elevation: "Elevation",
    ELEVATION: "Elevation",
    pop_max: "Population (max)",
    POP_MAX: "Population (max)",
    adm0_a3: "Country Code",
    ADM0_A3: "Country Code",
    iso_a2: "ISO A2",
    ISO_A2: "ISO A2",
    iso_a3: "ISO A3",
    ISO_A3: "ISO A3",
    region: "Region",
    REGION: "Region",
    subregion: "Subregion",
    SUBREGION: "Subregion",
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
    "region","REGION",
    "subregion","SUBREGION",
    "iso_a2","ISO_A2",
    "iso_a3","ISO_A3",
    "adm0_a3","ADM0_A3",
    "scalerank","SCALERANK",
    "min_zoom","min_label"
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

  // Raw Data (all keys)
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

/* ------------------- COUNTRY DETAILS (API) ------------------- */
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
    ["Type","COUNTRY"],
    ["Name",countryName],
    ["Loading","Fetching full details…"]
  ]);

  const c = await loadCountryFromAPI(countryName);
  if (!c){
    renderDetailsRows([
      ["Type","COUNTRY"],
      ["Name",countryName],
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

/* ------------------- AMAZING FACTS (Wikipedia) ------------------- */
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

  // unique
  return Array.from(new Set(facts));
}

async function buildAmazingFacts(sel){
  const { typeKey, name, props, latlng } = sel;

  // Try Wikipedia name variations for rivers/mountains
  let wiki = await wikipediaSummary(name);
  if (!wiki && typeKey === "rivers") wiki = await wikipediaSummary(`${name} River`);
  if (!wiki && typeKey === "mountains") wiki = await wikipediaSummary(`${name} Mountain`);
  if (!wiki && typeKey === "cities") wiki = await wikipediaSummary(`${name} (city)`);

  const facts = [];
  if (wiki?.extract){
    facts.push(...makeFunFacts(name, wiki.extract));
  } else {
    facts.push(`🤷 Wikipedia page not found for "${name}" (name mismatch in dataset).`);
  }

  // Add a couple of “wow” dataset-based facts (NOT dump)
  if (latlng){
    facts.push(`📍 Located near ${latlng[0].toFixed(2)}°, ${latlng[1].toFixed(2)}° (approx).`);
  }
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

/* ------------------- RENDER CATEGORY ------------------- */
async function showCategory(key){
  currentKey = key;
  els.quizFromText.textContent = key;

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
  currentPool = buildPool(geo);

  if (key === "cities"){
    clusterLayer = L.markerClusterGroup({ chunkedLoading:true, removeOutsideVisibleBounds:true });

    const feats = geo.features || [];
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

        if (mode === "quiz") checkClickAnswer(name);
      });

      clusterLayer.addLayer(m);
    }

    map.addLayer(clusterLayer);
    setPanel("Ready", "CITIES");
    renderDetailsRows([["Tip","Click a city → Details. Then Amazing Facts."]]);

  } else if (key === "mountains"){
    pointLayer = L.layerGroup();
    const feats = geo.features || [];
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

        if (mode === "quiz") checkClickAnswer(name);
      });

      pointLayer.addLayer(m);
    }

    map.addLayer(pointLayer);
    setPanel("Ready", "MOUNTAINS");
    renderDetailsRows([["Tip","Click a mountain → Details. Then Amazing Facts."]]);

  } else {
    polygonLayer = L.geoJSON(geo, {
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

          if (mode === "quiz") checkClickAnswer(name);
        });
      }
    }).addTo(map);

    setPanel("Ready", key.toUpperCase());
    renderDetailsRows([["Tip","Click something → Details. Then Amazing Facts."]]);
  }

  if (mode === "quiz") newMCQ();
}

/* ------------------- AMAZING FACTS BUTTON ------------------- */
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

/* ------------------- QUIZ ------------------- */
function newMCQ(){
  if (!currentPool || currentPool.length < 4){
    els.qText.textContent = `Not enough data for "${currentKey}".`;
    els.qMsg.textContent = "";
    els.mcqBtns.forEach(b => { b.textContent = "—"; b.disabled = true; });
    return;
  }

  const answer = pickRandom(currentPool);
  const set = new Set([answer]);
  while (set.size < 4) set.add(pickRandom(currentPool));
  const options = shuffle(Array.from(set));
  const correctIndex = options.indexOf(answer);

  q = { answer, options, correctIndex };

  els.qText.textContent = `Select: "${answer}"`;
  els.qMsg.textContent = "";

  els.mcqBtns.forEach((btn, i) => {
    btn.textContent = options[i];
    btn.disabled = false;
  });
}

function applyResult(ok){
  if (ok){
    score += 10;
    els.qMsg.textContent = "✅ Correct +10";
  } else {
    els.qMsg.textContent = `❌ Wrong. Correct: ${q.options[q.correctIndex]}`;
  }
  els.score.textContent = String(score);
}

function submitMCQ(i){
  if (!q) return;
  els.mcqBtns.forEach(b => b.disabled = true);
  applyResult(i === q.correctIndex);
  setTimeout(newMCQ, 900);
}

function checkClickAnswer(clickedName){
  if (!q) return;
  els.mcqBtns.forEach(b => b.disabled = true);
  applyResult(normalize(clickedName) === normalize(q.answer));
  setTimeout(newMCQ, 900);
}

els.mcqBtns.forEach(btn => {
  btn.addEventListener("click", () => submitMCQ(Number(btn.dataset.i)));
});

els.btnQuiz.addEventListener("click", () => {
  mode = "quiz";
  els.btnQuiz.classList.add("active");
  els.btnExplore.classList.remove("active");
  els.quizBox.classList.remove("hidden");
  newMCQ();
});

els.btnExplore.addEventListener("click", () => {
  mode = "explore";
  els.btnExplore.classList.add("active");
  els.btnQuiz.classList.remove("active");
  els.quizBox.classList.add("hidden");
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

/* ------------------- BOOT ------------------- */
(async function init(){
  closeFactsModal();
  try{
    await showCategory("countries");
  } catch (e){
    console.error(e);
    alert("Missing/incorrect GeoJSON files. Check /data filenames.");
  }
})();
