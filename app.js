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
  btnQuiz: document.getElementById("btnQuiz"),
  btnExplore: document.getElementById("btnExplore"),

  title: document.getElementById("title"),
  cName: document.getElementById("cName"),
  cType: document.getElementById("cType"),
  modeText: document.getElementById("modeText"),
  details: document.getElementById("details"),
  flag: document.getElementById("flag"),

  quizBox: document.getElementById("quizBox"),
  qText: document.getElementById("qText"),
  qMsg: document.getElementById("qMsg"),
  scoreEl: document.getElementById("score"),
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
  mobileWrap: document.getElementById("mobileMenuWrap"),
};

const safeVal = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
const fmtNum = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : "—");
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

function setPanel(name = "—", type = "—") {
  els.title.textContent = name === "—" ? "Ready" : name;
  els.cName.textContent = name;
  els.cType.textContent = type;
}
function renderDetailsRows(rows) {
  els.details.innerHTML = rows.map(([k, v]) => `
    <div class="detailsRow">
      <div class="detailsKey">${k}</div>
      <div class="detailsVal">${v}</div>
    </div>
  `).join("");
}
function getNameFromProps(p) {
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
function isIndiaFeature(props){
  const admin = String(props?.admin || props?.ADMIN || props?.adm0name || props?.ADM0NAME || "").toLowerCase();
  const country = String(props?.country || props?.COUNTRY || "").toLowerCase();
  const iso = String(props?.iso_a2 || props?.ISO_A2 || props?.iso_a3 || props?.ISO_A3 || "").toLowerCase();
  return admin.includes("india") || country.includes("india") || iso === "in" || iso === "ind";
}

/* ✅ Map with fixed zoom-out + bounds lock */
const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true,
  minZoom: 2,   // ✅ fixed zoom out limit
  maxZoom: 7,
  worldCopyJump: true
}).setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 7,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

const worldBounds = L.latLngBounds(
  L.latLng(-85, -180),
  L.latLng(85, 180)
);
map.setMaxBounds(worldBounds);
map.on("drag", () => map.panInsideBounds(worldBounds, { animate: false }));

/* ---------- PC Nav ---------- */
function openInfo(title, html) {
  els.infoTitle.textContent = title;
  els.infoBody.innerHTML = html;
  els.infoModal.classList.remove("hidden");
}
function closeInfo() {
  els.infoModal.classList.add("hidden");
}
els.infoClose.addEventListener("click", closeInfo);
els.infoModal.addEventListener("click", (e) => { if (e.target === els.infoModal) closeInfo(); });

function handleNav(action) {
  if (action === "home") window.scrollTo({ top: 0, behavior: "smooth" });

  if (action === "contact") {
    openInfo("Contact Us", `
      <div>
        <p>For feedback and suggestions:</p>
        <p><b>Email:</b> <a href="mailto:yourname@example.com">yourname@example.com</a></p>
        <p><b>Telegram / Instagram:</b> add your links</p>
      </div>
    `);
  }

  if (action === "about") {
    openInfo("About the Founder", `
      <div>
        <h4>Himanshu Kumar</h4>
        <p><b>From:</b> Muzaffarpur</p>
        <p><b>Focus:</b> UPSC • NDA • CDS • SSC preparation + Geography learning.</p>
        <p>MapCrown is built to make map learning easy, interactive and exam-ready.</p>
      </div>
    `);
  }
}

document.querySelectorAll(".navLink[data-nav]").forEach(btn => {
  btn.addEventListener("click", () => handleNav(btn.dataset.nav));
});

/* ✅ MOBILE MENU FIXED (dropdown only) */
(function mobileMenuFixed(){
  const btn = els.mMenuBtn;
  const menu = els.mMenu;
  const wrap = els.mobileWrap;
  if (!btn || !menu || !wrap) return;

  const open = () => { menu.classList.remove("hidden"); btn.setAttribute("aria-expanded","true"); };
  const close = () => { menu.classList.add("hidden"); btn.setAttribute("aria-expanded","false"); };
  const toggle = () => (menu.classList.contains("hidden") ? open() : close());

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  menu.addEventListener("pointerdown", (e) => e.stopPropagation());

  menu.querySelectorAll("[data-nav]").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
      handleNav(item.dataset.nav);
    });
  });

  document.addEventListener("pointerdown", (e) => {
    if (!wrap.contains(e.target)) close();
  });
})();

/* ---------- Facts ---------- */
let selected = null;
let factsState = { list: [], idx: 0, forKey: "" };

function openFacts(){ els.factsModal.classList.remove("hidden"); }
function closeFacts(){ els.factsModal.classList.add("hidden"); }
els.closeFacts.addEventListener("click", closeFacts);
els.factsModal.addEventListener("click", (e) => { if (e.target === els.factsModal) closeFacts(); });

function showFact(){
  if (!factsState.list.length){
    els.factsBox.textContent = "No facts. Select something then click Facts.";
    els.factsMeta.textContent = "—";
    return;
  }
  els.factsBox.textContent = factsState.list[factsState.idx];
  els.factsMeta.textContent = `Fact ${factsState.idx + 1} / ${factsState.list.length}`;
}
els.nextFact.addEventListener("click", () => {
  if (!factsState.list.length) return;
  factsState.idx = (factsState.idx + 1) % factsState.list.length;
  showFact();
});

async function wikipediaSummary(title){
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "Accept":"application/json" }});
  if (!res.ok) return null;
  const j = await res.json();
  if (!j || !j.extract) return null;
  return j.extract;
}
function toSentences(text){
  return (text || "").replace(/\s+/g," ").split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>=40);
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
    facts.push(...s.map(x => `✨ ${x}`));
  } else {
    facts.push(`🤷 Facts not found for "${name}" (dataset name mismatch).`);
  }
  if (sel.latlng) facts.push(`📍 Approx location: ${sel.latlng[0].toFixed(2)}°, ${sel.latlng[1].toFixed(2)}°`);
  return Array.from(new Set(facts)).slice(0, 10);
}

document.getElementById("btnFacts").addEventListener("click", async () => {
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

/* ---------- Data + Layers ---------- */
let currentKey = "countries";
const geoCache = new Map();
let polygonLayer=null, pointLayer=null, clusterLayer=null;

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

  renderDetailsRows(rows);
}

async function showCategory(key){
  currentKey = key;
  selected = null;
  els.btnFacts.disabled = true;
  closeFacts();
  factsState = { list:[], idx:0, forKey:"" };

  setPanel("Loading…", key.toUpperCase());
  renderDetailsRows([["Status","Loading dataset…"]]);
  clearMapLayers();

  const geo = await loadGeo(key);
  const indiaOn = !!els.indiaFocus.checked;

  const feats = (geo.features || []).filter(f => {
    if (!indiaOn) return true;
    if (key === "countries") return true;
    return isIndiaFeature(f.properties);
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

        selected = { typeKey:"cities", name, props:f.properties, latlng };
        els.btnFacts.disabled = false;
      });

      clusterLayer.addLayer(m);
    }
    map.addLayer(clusterLayer);
    setPanel("Ready", "CITIES");
    renderDetailsRows([["Tip","Click a city → Details → Facts"]]);
    return;
  }

  polygonLayer = L.geoJSON(filtered, {
    style: styleFor(key),
    onEachFeature: (feature, layer) => {
      const name = getNameFromProps(feature.properties);
      layer.bindTooltip(name, { sticky:true, opacity:0.95 });
      layer.on("click", () => {
        setPanel(name, key.toUpperCase());
        try{ if (layer.getBounds) map.fitBounds(layer.getBounds(), { padding:[20,20] }); } catch {}
        renderDetailsRows([["Type", key.toUpperCase()], ["Name", name]]);
        selected = { typeKey:key, name, props:feature.properties, latlng:null };
        els.btnFacts.disabled = false;
      });
    }
  }).addTo(map);

  setPanel("Ready", key.toUpperCase());
  renderDetailsRows([["Tip","Click something → Details → Facts"]]);
}

/* Explore / Quiz UI */
els.btnQuiz.addEventListener("click", () => {
  els.btnQuiz.classList.add("active");
  els.btnExplore.classList.remove("active");
  els.quizBox.classList.remove("hidden");
});
els.btnExplore.addEventListener("click", () => {
  els.btnExplore.classList.add("active");
  els.btnQuiz.classList.remove("active");
  els.quizBox.classList.add("hidden");
});

/* Events */
els.examMode.addEventListener("change", () => {
  const mapText = { general:"General", upsc:"UPSC", nda:"NDA", cds:"CDS", ssc:"SSC" };
  els.modeText.textContent = mapText[els.examMode.value] || "General";
});
els.indiaFocus.addEventListener("change", () => showCategory(currentKey).catch(console.error));
els.category.addEventListener("change", () => showCategory(els.category.value).catch(console.error));

/* Boot */
(async function init(){
  els.modeText.textContent = "General";
  try{
    await showCategory("countries");
  } catch (e){
    console.error(e);
    alert("GeoJSON missing or wrong filenames. Ensure /data files end with .json");
  }
})();
