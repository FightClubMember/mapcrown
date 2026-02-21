/* ============================================================
   MapCrown - app.js (FULL)
   - Clean Details for Countries/States/Cities/Rivers/Mountains
   - Robust name detection (no Unknown)
   - Cities cluster markers
   - Facts (Wikipedia summary) on button click only
   - Pro onboarding + replay help button
   ============================================================ */

const CONFIG = {
  DATA: {
    countries: "/data/countries.min.json",
    states: "/data/states_provinces.min.json",
    cities: "/data/cities_major.min.json",
    rivers: "/data/rivers.min.json",
    mountains: "/data/mountains_peaks.min.json",
  },
  MAP: { minZoom: 2, maxZoom: 10 },
  INDIA_KEY: "mapcrown_india_only",
  TOUR_KEY: "mapcrown_tour_done",
};

const $ = (s) => document.querySelector(s);

const UI = {
  category: $("#category"),
  examMode: $("#examMode"),
  indiaFocus: $("#indiaFocus"),
  modeText: $("#modeText"),

  title: $("#title"),
  cName: $("#cName"),
  cType: $("#cType"),
  details: $("#details"),
  flag: $("#flag"),

  btnFacts: $("#btnFacts"),
  btnHelp: $("#btnHelp"),

  // modals
  infoModal: $("#infoModal"),
  infoTitle: $("#infoTitle"),
  infoBody: $("#infoBody"),
  infoClose: $("#infoClose"),

  factsModal: $("#factsModal"),
  factsTitle: $("#factsTitle"),
  factsMeta: $("#factsMeta"),
  factsBox: $("#factsBox"),
  closeFacts: $("#closeFacts"),
  nextFact: $("#nextFact"),

  // menu
  mMenuBtn: $("#mMenuBtn"),
  mMenu: $("#mMenu"),
  mobileMenuWrap: document.querySelector(".mobileMenuWrap"),

  // tour
  tourOverlay: $("#tourOverlay"),
  tourSpotlight: $("#tourSpotlight"),
  tourCard: $("#tourCard"),
  tourTitle: $("#tourTitle"),
  tourMeta: $("#tourMeta"),
  tourText: $("#tourText"),
  tourDots: $("#tourDots"),
  tourNext: $("#tourNext"),
  tourBack: $("#tourBack"),
  tourSkip: $("#tourSkip"),
};

function safeStr(v){ return (v===null||v===undefined) ? "" : String(v).trim(); }
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function fmtNum(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-IN");
}
function pick(props, keys){
  for (const k of keys){
    const v = props?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return "";
}
function cap(s){ s=safeStr(s); return s? s[0].toUpperCase()+s.slice(1):""; }

/* ---------- SUPER ROBUST NAME DETECTION (fixes city Unknown) ---------- */
function getFeatureName(category, props){
  const name = pick(props, [
    // common
    "name","NAME","name_en","NAME_EN","name_long","NAME_LONG",
    "nameascii","NAMEASCII","label","LABEL","title","TITLE",
    // country
    "admin","ADMIN","sovereignt","SOVEREIGNT","geounit","GEOUNIT",
    // states
    "province","PROVINCE","state","STATE","region","REGION",
    "adm1name","ADM1NAME",
    // city
    "city","CITY","town","TOWN"
  ]);
  return safeStr(name) || "Unknown";
}

/* ---------- INDIA FILTER (best-effort) ---------- */
function isIndia(props){
  const a = safeStr(pick(props, ["admin","ADMIN","adm0name","ADM0NAME","country","COUNTRY","sovereignt","SOVEREIGNT"])).toLowerCase();
  const iso2 = safeStr(pick(props, ["iso_a2","ISO_A2"])).toLowerCase();
  const iso3 = safeStr(pick(props, ["iso_a3","ISO_A3"])).toLowerCase();
  return a.includes("india") || iso2 === "in" || iso3 === "ind";
}

/* ---------- CLEAN DETAILS MAP (works with upper/lower keys) ---------- */
const FIELD_MAP = {
  countries: [
    ["Country", ["admin","ADMIN","name","NAME","name_long","NAME_LONG","sovereignt","SOVEREIGNT"]],
    ["Capital", ["capital","CAPITAL"]],
    ["Continent", ["continent","CONTINENT"]],
    ["Region", ["region_un","REGION_UN","region_wb","REGION_WB","region","REGION"]],
    ["Subregion", ["subregion","SUBREGION"]],
    ["Population", ["pop_est","POP_EST","population","POPULATION"]],
    ["Area (km²)", ["area_km2","AREA_KM2","area","AREA"]],
    ["GDP (million $)", ["gdp_md","GDP_MD"]],
    ["ISO A2", ["iso_a2","ISO_A2"]],
    ["ISO A3", ["iso_a3","ISO_A3"]],
    ["Currency", ["currency","CURRENCY","currency_name","CURRENCY_NAME"]],
  ],
  states: [
    ["State/Province", ["name","NAME","name_en","NAME_EN","province","PROVINCE","state","STATE"]],
    ["Country", ["adm0name","ADM0NAME","admin","ADMIN","country","COUNTRY"]],
    ["Type", ["type","TYPE","engtype_1","ENGTYPE_1"]],
    ["ISO-3166-2", ["iso_3166_2","ISO_3166_2"]],
    ["Region", ["region","REGION"]],
  ],
  cities: [
    ["City", ["name","NAME","name_en","NAME_EN","nameascii","NAMEASCII","city","CITY"]],
    ["Country", ["adm0name","ADM0NAME","admin","ADMIN","country","COUNTRY"]],
    ["State/Region", ["adm1name","ADM1NAME","region","REGION","province","PROVINCE","state","STATE"]],
    ["Population", ["pop_max","POP_MAX","population","POPULATION"]],
  ],
  rivers: [
    ["River", ["name","NAME","name_en","NAME_EN"]],
    ["Country/Region", ["adm0name","ADM0NAME","country","COUNTRY","region","REGION"]],
    ["Length (km)", ["length_km","LENGTH_KM","length","LENGTH"]],
    ["Source", ["source","SOURCE"]],
    ["Mouth", ["mouth","MOUTH"]],
    ["Basin", ["basin","BASIN","drainage","DRAINAGE"]],
  ],
  mountains: [
    ["Peak", ["name","NAME","name_en","NAME_EN"]],
    ["Country/Region", ["adm0name","ADM0NAME","country","COUNTRY","region","REGION"]],
    ["Elevation (m)", ["elevation","ELEVATION","elev_m","ELEV_M","elev","ELEV"]],
    ["Range", ["range","RANGE","mountain_range","MOUNTAIN_RANGE"]],
    ["Type", ["type","TYPE","featurecla","FEATURECLA"]],
  ],
};

/* ---------- junk keys hidden in fallback ---------- */
const JUNK = new Set([
  "featurecla","FEATURECLA","scalerank","SCALERANK","labelrank","LABELRANK",
  "min_zoom","MIN_ZOOM","note","NOTE","ne_id","NE_ID","wikidataid","WIKIDATAID",
  "name_alt","NAME_ALT"
]);

function buildDetailsHTML(category, props, latlng){
  const rows = FIELD_MAP[category] || [];
  const out = [];

  out.push(`<div class="details">`);
  out.push(`<ul>`);

  let count = 0;
  for (const [label, keys] of rows){
    let val = pick(props, keys);
    if (!safeStr(val)) continue;

    const l = label.toLowerCase();
    if (l.includes("population") || l.includes("area") || l.includes("gdp") || l.includes("length") || l.includes("elevation")){
      val = fmtNum(val) || val;
    }

    out.push(`<li><b>${escapeHtml(label)}:</b> ${escapeHtml(String(val))}</li>`);
    count++;
  }

  if (latlng){
    out.push(`<li><b>Coordinates:</b> ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</li>`);
    count++;
  }

  out.push(`</ul>`);

  // If very few mapped fields found, add fallback “Top properties”
  if (count < 2){
    const entries = Object.entries(props || {})
      .filter(([k,v]) => !JUNK.has(k) && safeStr(v) && String(v).length <= 80)
      .slice(0, 10);

    if (entries.length){
      out.push(`<div class="fallbackTitle">More Info</div>`);
      out.push(`<ul>`);
      for (const [k,v] of entries){
        out.push(`<li><b>${escapeHtml(cap(k.replaceAll("_"," ")))}:</b> ${escapeHtml(String(v))}</li>`);
      }
      out.push(`</ul>`);
    }
  }

  out.push(`</div>`);
  return out.join("");
}

/* ---------- Map setup ---------- */
const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true,
  minZoom: CONFIG.MAP.minZoom,
  maxZoom: CONFIG.MAP.maxZoom,
  worldCopyJump: true
}).setView([20, 0], 2);

const worldBounds = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
map.setMaxBounds(worldBounds);
map.on("drag", () => map.panInsideBounds(worldBounds, { animate:false }));

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

/* ---------- Layer state ---------- */
const cache = new Map(); // category -> geojson
const layers = { countries:null, states:null, cities:null, rivers:null, mountains:null };
let activeLayer = null;

const cityCluster = L.markerClusterGroup({
  chunkedLoading: true,
  showCoverageOnHover: false,
  disableClusteringAtZoom: 8,
  maxClusterRadius: 50
});

/* ---------- Selection state ---------- */
let selected = { category:null, name:"", props:null, latlng:null };

/* ---------- UI helpers ---------- */
function setHeader(name, type){
  UI.title.textContent = name ? "Selected" : "Ready";
  UI.cName.textContent = name || "—";
  UI.cType.textContent = type || "—";
  UI.modeText.textContent = cap(UI.examMode.value);
}

function setLoading(){
  UI.title.textContent = "Loading…";
  UI.details.textContent = "Loading data…";
  UI.btnFacts.disabled = true;
}

function clearActiveLayer(){
  if (activeLayer) map.removeLayer(activeLayer);
  activeLayer = null;
  if (map.hasLayer(cityCluster)) map.removeLayer(cityCluster);
}

/* ---------- Styles ---------- */
function baseStyle(category){
  if (category === "rivers") return { color:"#5aa7ff", weight:2, fillOpacity:0 };
  if (category === "mountains") return { color:"#d6b36a", weight:2, fillOpacity:0.08 };
  if (category === "states") return { color:"#7cc4ff", weight:1.5, fillOpacity:0.10 };
  return { color:"#7cc4ff", weight:1.5, fillOpacity:0.08 };
}
function hoverStyle(category){
  const s = baseStyle(category);
  return { ...s, weight:(s.weight||2)+1, fillOpacity: Math.min(0.22, (s.fillOpacity||0.1)+0.1) };
}

/* ---------- Data load ---------- */
async function loadGeo(category){
  if (cache.has(category)) return cache.get(category);

  const url = CONFIG.DATA[category];
  if (!url) throw new Error("No file for category: " + category);

  const res = await fetch(url, { cache:"force-cache" });
  if (!res.ok) throw new Error("Failed to load " + url);

  const geo = await res.json();
  if (!geo || !Array.isArray(geo.features)) throw new Error("Invalid GeoJSON " + url);

  cache.set(category, geo);
  return geo;
}

/* ---------- Click select ---------- */
function selectFeature(category, props, latlng){
  const name = getFeatureName(category, props);
  selected = { category, name, props, latlng };

  setHeader(name, cap(category));
  UI.details.innerHTML = buildDetailsHTML(category, props, latlng);
  UI.btnFacts.disabled = false;
}

/* ---------- Build layers ---------- */
async function ensureLayer(category){
  if (layers[category]) return layers[category];

  const geo = await loadGeo(category);
  const indiaOnly = !!UI.indiaFocus.checked;

  // Cities: markers
  if (category === "cities"){
    cityCluster.clearLayers();

    for (const f of geo.features){
      const props = f.properties || {};
      if (indiaOnly && !isIndia(props)) continue;

      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const lat = coords[1], lon = coords[0];
      const latlng = L.latLng(lat, lon);

      const name = getFeatureName("cities", props);
      const marker = L.marker(latlng, { title:name });

      marker.bindTooltip(name, { direction:"top", opacity:0.95 });
      marker.on("click", () => {
        selectFeature("cities", props, latlng);
        map.setView(latlng, Math.max(map.getZoom(), 6), { animate:true });
      });

      cityCluster.addLayer(marker);
    }

    layers.cities = cityCluster;
    return layers.cities;
  }

  // Polygons/lines
  const layer = L.geoJSON(geo, {
    filter: (f) => {
      if (!indiaOnly) return true;
      return isIndia(f.properties || {});
    },
    style: () => baseStyle(category),
    onEachFeature: (feature, lyr) => {
      const props = feature.properties || {};
      const nm = getFeatureName(category, props);

      lyr.bindTooltip(nm, { sticky:true, opacity:0.9 });

      lyr.on("mouseover", () => lyr.setStyle?.(hoverStyle(category)));
      lyr.on("mouseout", () => lyr.setStyle?.(baseStyle(category)));
      lyr.on("click", (e) => selectFeature(category, props, e.latlng));
    }
  });

  layers[category] = layer;
  return layer;
}

/* ---------- Switch category ---------- */
async function switchCategory(category){
  setLoading();
  clearActiveLayer();
  selected = { category:null, name:"", props:null, latlng:null };
  setHeader("", "");

  try{
    const layer = await ensureLayer(category);
    activeLayer = layer;
    map.addLayer(layer);

    // fit bounds for non-cities
    if (category !== "cities"){
      try{
        map.fitBounds(layer.getBounds(), { padding:[20,20] });
      } catch {}
    }

    UI.title.textContent = "Ready";
    UI.details.textContent = "Click on the map to see details…";
  } catch (e){
    UI.title.textContent = "Error";
    UI.details.innerHTML = `<b>Missing/incorrect GeoJSON files.</b><br>Check /data filenames.<br><small>${escapeHtml(e.message)}</small>`;
  }
}

/* ---------- Facts (Wikipedia) ---------- */
let facts = [];
let factIndex = 0;

function splitFacts(text){
  return safeStr(text)
    .replace(/\s+/g," ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 30)
    .slice(0, 8);
}

async function wikiSummary(title){
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);
  const res = await fetch(url);
  if (!res.ok) throw new Error("No Wikipedia page");
  return await res.json();
}

function factTitleGuess(){
  if (!selected?.name) return "";
  if (selected.category === "rivers") return `${selected.name} River`;
  if (selected.category === "mountains") return `${selected.name} mountain`;
  return selected.name;
}

UI.btnFacts.addEventListener("click", async () => {
  if (!selected?.name) return;

  UI.factsModal.classList.remove("hidden");
  UI.factsTitle.textContent = selected.name;
  UI.factsMeta.textContent = "Loading facts…";
  UI.factsBox.textContent = "Loading…";

  try{
    const guess = factTitleGuess();
    let sum;
    try { sum = await wikiSummary(guess); }
    catch { sum = await wikiSummary(selected.name); }

    facts = splitFacts(sum.extract || "");
    factIndex = 0;

    if (!facts.length) throw new Error("No facts found");

    UI.factsMeta.textContent = `1/${facts.length} • Source: Wikipedia`;
    UI.factsBox.textContent = facts[0];
  } catch {
    UI.factsMeta.textContent = "Facts not found";
    UI.factsBox.textContent = "Try selecting a bigger/known place. Wikipedia facts not available for this item.";
  }
});

UI.closeFacts.addEventListener("click", () => UI.factsModal.classList.add("hidden"));
UI.nextFact.addEventListener("click", () => {
  if (!facts.length) return;
  factIndex = (factIndex + 1) % facts.length;
  UI.factsMeta.textContent = `${factIndex+1}/${facts.length} • Source: Wikipedia`;
  UI.factsBox.textContent = facts[factIndex];
});

/* ---------- Professional About/Contact (same style as before) ---------- */
function openInfo(title, html){
  UI.infoTitle.textContent = title;
  UI.infoBody.innerHTML = html;
  UI.infoModal.classList.remove("hidden");
}
UI.infoClose.addEventListener("click", () => UI.infoModal.classList.add("hidden"));

function handleNav(action){
  if (action === "home"){
    window.scrollTo({ top:0, behavior:"smooth" });
    return;
  }
  if (action === "contact"){
    openInfo("Contact Us", `
      <div style="line-height:1.75">
        <p style="margin:0 0 10px;"><b>MapCrown Support</b></p>
        <p style="margin:0 0 12px;color:rgba(233,238,252,.85);">
          For suggestions, bug reports, and collaborations:
        </p>
        <div style="display:grid;gap:10px;">
          <div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05);">
            <b>📍 Location</b><br/>Muzaffarpur, Bihar (India)
          </div>
          <div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05);">
            <b>✉️ Email</b><br/><span style="opacity:.9">add-your-email-here</span>
          </div>
          <div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05);">
            <b>💬 Telegram</b><br/><span style="opacity:.9">add-your-telegram-link</span>
          </div>
        </div>
        <p style="margin:12px 0 0;color:rgba(233,238,252,.75);font-size:13px;">
          Created by Himanshu Kumar • MapCrown.online
        </p>
      </div>
    `);
    return;
  }
  if (action === "about"){
    openInfo("About Founder", `
      <div style="line-height:1.75">
        <p style="margin:0 0 10px;"><b>Himanshu Kumar</b></p>
        <div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05);margin-bottom:10px;">
          <b>🎯 What is MapCrown?</b><br/>
          MapCrown is an interactive geography learning platform for <b>UPSC, NDA, CDS, SSC</b>.
        </div>
        <div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05);margin-bottom:10px;">
          <b>🧠 Learning Method</b><br/>
          Explore categories, open clean details, read facts, and practice with quizzes.
        </div>
        <div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05);">
          <b>📍 Based in</b><br/>Muzaffarpur, Bihar (India)
        </div>
      </div>
    `);
  }
}

document.querySelectorAll(".navLink[data-nav]").forEach(b=>{
  b.addEventListener("click", () => handleNav(b.dataset.nav));
});

/* ---------- Mobile menu (always above map) ---------- */
(function mobileMenu(){
  if (!UI.mMenuBtn || !UI.mMenu || !UI.mobileMenuWrap) return;

  const open = () => { UI.mMenu.classList.remove("hidden"); UI.mMenuBtn.setAttribute("aria-expanded","true"); };
  const close = () => { UI.mMenu.classList.add("hidden"); UI.mMenuBtn.setAttribute("aria-expanded","false"); };
  const toggle = () => UI.mMenu.classList.contains("hidden") ? open() : close();

  UI.mMenuBtn.addEventListener("pointerdown", (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });
  UI.mMenu.addEventListener("pointerdown", (e)=> e.stopPropagation());

  UI.mMenu.querySelectorAll("[data-nav]").forEach(item=>{
    item.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      close();
      handleNav(item.dataset.nav);
    });
  });

  document.addEventListener("pointerdown", (e)=>{
    if (!UI.mobileMenuWrap.contains(e.target)) close();
  });
})();

/* ---------- Pro onboarding (spotlight) + Help replay ---------- */
(function tour(){
  const steps = [
    { t:"Welcome to MapCrown", d:"This is an interactive map learning tool for UPSC/NDA/CDS/SSC.", el:()=>document.querySelector(".brand") },
    { t:"Pick Category", d:"Choose Countries / States / Cities / Rivers / Mountains.", el:()=>UI.category },
    { t:"India Focus", d:"Enable India Focus for India-only practice.", el:()=>document.getElementById("indiaToggle") },
    { t:"Click on Map", d:"Tap any feature to see clean details on the right.", el:()=>document.getElementById("map") },
    { t:"Amazing Facts", d:"After selecting, click ✨ Facts for interesting facts.", el:()=>UI.btnFacts },
    { t:"Help Anytime", d:"Use ❓ Help to replay this guide anytime.", el:()=>UI.btnHelp },
  ];
  let i = 0;

  function setDots(){
    UI.tourDots.innerHTML = "";
    for (let k=0;k<steps.length;k++){
      const dot = document.createElement("div");
      dot.className = "tourDot" + (k===i ? " active" : "");
      UI.tourDots.appendChild(dot);
    }
  }

  function place(target){
    const r = target.getBoundingClientRect();
    const pad = 10;
    const x = Math.max(10, r.left - pad);
    const y = Math.max(10, r.top - pad);
    const w = Math.min(window.innerWidth - 20, r.width + pad*2);
    const h = Math.min(window.innerHeight - 20, r.height + pad*2);

    UI.tourSpotlight.style.left = x + "px";
    UI.tourSpotlight.style.top = y + "px";
    UI.tourSpotlight.style.width = w + "px";
    UI.tourSpotlight.style.height = h + "px";

    const cardW = Math.min(420, window.innerWidth*0.92);
    const margin = 10;
    let cx = Math.min(window.innerWidth - cardW - margin, x);
    cx = Math.max(margin, cx);

    const below = y + h + margin;
    const above = y - margin;
    const cy = (below + 190 < window.innerHeight) ? below : Math.max(margin, above - 190);

    UI.tourCard.style.left = cx + "px";
    UI.tourCard.style.top = cy + "px";
  }

  function show(){
    const s = steps[i];
    UI.tourTitle.textContent = s.t;
    UI.tourText.textContent = s.d;
    UI.tourMeta.textContent = `Step ${i+1}/${steps.length}`;
    setDots();

    UI.tourBack.disabled = (i===0);
    UI.tourNext.textContent = (i===steps.length-1) ? "Finish" : "Next";

    const el = s.el();
    if (!el) return;

    el.scrollIntoView?.({ block:"center", behavior:"smooth" });
    setTimeout(()=>place(el), 180);
  }

  function open(force=false){
    if (!force && localStorage.getItem(CONFIG.TOUR_KEY)) return;
    UI.tourOverlay.classList.remove("hidden");
    i = 0;
    show();
  }

  function close(save=true){
    UI.tourOverlay.classList.add("hidden");
    if (save) localStorage.setItem(CONFIG.TOUR_KEY, "1");
  }

  UI.tourNext.addEventListener("click", ()=>{ if (i>=steps.length-1) return close(true); i++; show(); });
  UI.tourBack.addEventListener("click", ()=>{ if (i<=0) return; i--; show(); });
  UI.tourSkip.addEventListener("click", ()=>close(true));

  UI.btnHelp.addEventListener("click", ()=>open(true));
  window.addEventListener("resize", ()=>{ if (!UI.tourOverlay.classList.contains("hidden")) show(); });

  window.addEventListener("load", ()=> setTimeout(()=>open(false), 700));
})();

/* ---------- Events ---------- */
UI.examMode.addEventListener("change", ()=> UI.modeText.textContent = cap(UI.examMode.value));
UI.category.addEventListener("change", ()=> switchCategory(UI.category.value));
UI.indiaFocus.addEventListener("change", ()=> {
  // reset layers so filter applies
  layers.countries = layers.states = layers.cities = layers.rivers = layers.mountains = null;
  switchCategory(UI.category.value);
});

/* ---------- Start ---------- */
setHeader("", "");
switchCategory(UI.category.value);
