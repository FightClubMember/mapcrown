// =========================
// MapCrown - FULL app.js
// =========================

// ---------- DOM ----------
const elCategory = document.getElementById("category");
const elExamMode = document.getElementById("examMode");
const elIndiaFocus = document.getElementById("indiaFocus");
const elModeText = document.getElementById("modeText");

const titleEl = document.getElementById("title");
const cNameEl = document.getElementById("cName");
const cTypeEl = document.getElementById("cType");
const detailsEl = document.getElementById("details");
const flagEl = document.getElementById("flag");

const btnFacts = document.getElementById("btnFacts");
const btnHelp = document.getElementById("btnHelp");

const factsModal = document.getElementById("factsModal");
const factsTitle = document.getElementById("factsTitle");
const factsMeta = document.getElementById("factsMeta");
const factsBox = document.getElementById("factsBox");
const closeFacts = document.getElementById("closeFacts");
const nextFact = document.getElementById("nextFact");

const infoModal = document.getElementById("infoModal");
const infoTitle = document.getElementById("infoTitle");
const infoBody = document.getElementById("infoBody");
const infoClose = document.getElementById("infoClose");

// Mobile menu fix
const mMenuBtn = document.getElementById("mMenuBtn");
const mMenu = document.getElementById("mMenu");
const mobileMenuWrap = document.getElementById("mobileMenuWrap");

// ---------- Helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function safeStr(v){
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function pick(obj, keys){
  for (const k of keys){
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return "";
}

function fmtNum(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString();
}

function isIndiaFeature(props){
  const name = safeStr(pick(props, ["admin", "name", "name_en", "name_long", "region", "province", "state"])).toLowerCase();
  const admin0 = safeStr(pick(props, ["adm0name", "country", "sovereignt", "admin0"])).toLowerCase();
  return name.includes("india") || admin0.includes("india");
}

function capitalize(s){
  s = safeStr(s);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------- Detail mapping (clean UI) ----------
const FIELD_MAP = {
  countries: [
    ["Capital", ["capital", "capital_en", "cap", "capitale"]],
    ["Continent", ["continent", "region_un", "continent"]],
    ["Region", ["region", "subregion", "subregion_en"]],
    ["Population", ["pop_est", "population"]],
    ["Area (km²)", ["area_km2", "area"]],
    ["Currency", ["currency", "currency_name"]],
    ["ISO Code", ["iso_a2", "iso_a3", "iso3"]],
    ["Timezones", ["timezones", "tz"]]
  ],
  states: [
    ["Country", ["adm0name", "country", "admin"]],
    ["State/Province", ["name", "name_en", "name_alt"]],
    ["Type", ["type", "engtype_1", "type_en"]],
    ["Region", ["region", "region_cod"]],
    ["Postal/Code", ["postal", "postal_code", "iso_3166_2"]],
    ["Capital", ["capital", "cap"]]
  ],
  cities: [
    ["Country", ["adm0name", "country", "sov0name"]],
    ["State/Region", ["adm1name", "admin1", "region"]],
    ["City Type", ["featurecla", "type", "class"]],
    ["Population", ["pop_max", "population"]],
    ["Rank", ["scalerank", "rank"]],
    ["Coordinates", ["lat", "latitude", "y", "lon", "longitude", "x"]]
  ],
  rivers: [
    ["Country/Region", ["adm0name", "country", "region"]],
    ["River Name", ["name", "name_en", "name_alt"]],
    ["Length (km)", ["length_km", "length"]],
    ["Basin", ["basin", "drainage"]],
    ["Mouth", ["mouth", "mouth_name"]],
    ["Source", ["source", "source_name"]]
  ],
  mountains: [
    ["Country/Region", ["adm0name", "country", "region"]],
    ["Peak Name", ["name", "name_en", "name_alt"]],
    ["Elevation (m)", ["elevation", "elev_m", "elev"]],
    ["Range", ["range", "mountain_range"]],
    ["Type", ["type", "featurecla"]],
    ["Coordinates", ["lat", "latitude", "y", "lon", "longitude", "x"]]
  ]
};

function buildDetailsHTML(category, props){
  const rows = FIELD_MAP[category] || [];
  const parts = [];

  // Special formatting for coordinates if available
  let lat = pick(props, ["lat", "latitude", "y"]);
  let lon = pick(props, ["lon", "longitude", "x"]);

  parts.push(`<ul>`);
  for (const [label, keys] of rows){
    let val = pick(props, keys);

    if (label.includes("Population")) val = fmtNum(val);
    if (label.includes("Area")) val = fmtNum(val);

    if (label === "Coordinates"){
      // try both in one line
      if (lat && lon) val = `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
      else val = "";
    }

    if (safeStr(val)) {
      parts.push(`<li><b>${label}:</b> ${escapeHtml(String(val))}</li>`);
    }
  }
  parts.push(`</ul>`);

  // If nothing found, show minimal safe
  if (parts.length <= 2){
    return `<div>No clean details found for this feature.</div>`;
  }
  return parts.join("");
}

function escapeHtml(str){
  return str
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---------- Map ----------
const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true,
  minZoom: 2,
  maxZoom: 10,
  worldCopyJump: true
}).setView([20, 0], 2);

// lock bounds (no infinite drag)
const worldBounds = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
map.setMaxBounds(worldBounds);
map.on("drag", () => map.panInsideBounds(worldBounds, { animate:false }));

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// layers
let activeLayer = null;
let activeCategory = "countries";

const layers = {
  countries: null,
  states: null,
  rivers: null,
  mountains: null,
  cities: null
};

const cityCluster = L.markerClusterGroup({
  chunkedLoading: true,
  showCoverageOnHover: false,
  disableClusteringAtZoom: 8,
  maxClusterRadius: 50
});

let selected = {
  category: null,
  name: "",
  props: null,
  latlng: null
};

// ---------- Data load ----------
const DATA_FILES = {
  countries: "/data/countries.min.json",
  states: "/data/states_provinces.min.json",
  cities: "/data/cities_major.min.json",
  rivers: "/data/rivers.min.json",
  mountains: "/data/mountains_peaks.min.json"
};

async function loadGeoJSON(url){
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load: ${url}`);
  return await res.json();
}

function baseStyle(category){
  if (category === "rivers") return { color: "#5aa7ff", weight: 2, fillOpacity: 0.0 };
  if (category === "mountains") return { color: "#d6b36a", weight: 2, fillOpacity: 0.08 };
  if (category === "states") return { color: "#7cc4ff", weight: 1.5, fillOpacity: 0.10 };
  return { color: "#7cc4ff", weight: 1.5, fillOpacity: 0.08 };
}

function hoverStyle(){
  return { weight: 3, fillOpacity: 0.18 };
}

function clickSelect(feature, latlng, category){
  const props = feature?.properties || {};
  const name = safeStr(pick(props, ["name", "name_en", "admin", "name_long", "name_alt"])) || "Unknown";
  selected = { category, name, props, latlng };

  titleEl.textContent = "Selected";
  cNameEl.textContent = name;
  cTypeEl.textContent = capitalize(category);
  elModeText.textContent = capitalize(elExamMode.value);

  // Clean details
  detailsEl.innerHTML = buildDetailsHTML(category, props);

  // enable facts
  btnFacts.disabled = false;

  // flag only for countries if you have a flag url (optional)
  flagEl.classList.add("hidden");
}

function bindFeatureEvents(layer, feature, category){
  layer.on("mouseover", () => {
    if (layer.setStyle) layer.setStyle(hoverStyle());
  });
  layer.on("mouseout", () => {
    if (layer.setStyle) layer.setStyle(baseStyle(category));
  });
  layer.on("click", (e) => {
    clickSelect(feature, e.latlng, category);
  });
}

async function ensureLayer(category){
  if (layers[category]) return;

  const url = DATA_FILES[category];
  if (!url) throw new Error(`No data file for ${category}`);

  const geo = await loadGeoJSON(url);

  // India focus filter
  const indiaOn = !!elIndiaFocus?.checked;

  if (category === "cities"){
    // Points as markers for speed
    cityCluster.clearLayers();

    const feats = geo.features || [];
    for (const f of feats){
      const props = f.properties || {};

      if (indiaOn && !isIndiaFeature(props)) continue;

      // coords can be GeoJSON [lon, lat]
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const lon = coords[0];
      const lat = coords[1];

      const name = safeStr(pick(props, ["name", "name_en"])) || "City";
      const marker = L.marker([lat, lon], { title: name });

      marker.on("click", () => {
        clickSelect(f, L.latLng(lat, lon), "cities");
        map.setView([lat, lon], Math.max(map.getZoom(), 6), { animate: true });
      });

      marker.bindTooltip(name, { direction: "top", opacity: 0.9 });
      cityCluster.addLayer(marker);
    }

    layers.cities = cityCluster;
    return;
  }

  // Polygons/lines
  const layer = L.geoJSON(geo, {
    style: () => baseStyle(category),
    filter: (f) => {
      if (!indiaOn) return true;
      return isIndiaFeature(f.properties || {});
    },
    onEachFeature: (feature, lyr) => bindFeatureEvents(lyr, feature, category)
  });

  layers[category] = layer;
}

function clearActiveLayer(){
  if (activeLayer){
    map.removeLayer(activeLayer);
    activeLayer = null;
  }
  if (map.hasLayer(cityCluster)) map.removeLayer(cityCluster);
}

async function switchCategory(category){
  activeCategory = category;
  clearActiveLayer();

  // show loading
  titleEl.textContent = "Loading…";
  detailsEl.textContent = "Loading data…";
  btnFacts.disabled = true;
  selected = { category:null, name:"", props:null, latlng:null };

  try{
    await ensureLayer(category);

    if (category === "cities"){
      activeLayer = layers.cities;
      map.addLayer(activeLayer);
    } else {
      activeLayer = layers[category];
      map.addLayer(activeLayer);
      // Fit bounds for better view (optional)
      try{
        map.fitBounds(activeLayer.getBounds(), { padding:[20,20] });
      } catch {}
    }

    titleEl.textContent = "Ready";
    detailsEl.textContent = "Click on the map to see details…";
  } catch (err){
    titleEl.textContent = "Error";
    detailsEl.innerHTML = `<b>Missing/incorrect GeoJSON files.</b><br>Check your /data filenames.<br><small>${escapeHtml(err.message)}</small>`;
  }
}

// ---------- Facts (Real facts via Wikipedia REST Summary) ----------
let factsList = [];
let factsIndex = 0;

async function wikiSummary(title){
  // Wikipedia REST API supports CORS
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);
  const res = await fetch(url);
  if (!res.ok) throw new Error("No Wikipedia page found.");
  return await res.json();
}

function extractFacts(text){
  // split into sentences and pick interesting ones
  const sentences = safeStr(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 30);

  // take up to 8
  return sentences.slice(0, 8);
}

async function loadFactsForSelected(){
  if (!selected?.name) return;

  const key = `facts_${selected.category}_${selected.name}`;
  const cached = sessionStorage.getItem(key);
  if (cached){
    factsList = JSON.parse(cached);
    factsIndex = 0;
    return;
  }

  // Build better search titles per category
  let title = selected.name;

  // Common disambiguation helpers
  if (selected.category === "rivers") title = `${selected.name} River`;
  if (selected.category === "mountains") title = `${selected.name} mountain`;
  if (selected.category === "states") title = `${selected.name}`;

  const sum = await wikiSummary(title);

  const facts = extractFacts(sum.extract || "");
  if (!facts.length) throw new Error("No facts available.");

  factsList = facts;
  factsIndex = 0;
  sessionStorage.setItem(key, JSON.stringify(factsList));
}

function showFact(){
  if (!factsList.length){
    factsBox.textContent = "No facts available.";
    return;
  }
  factsBox.textContent = factsList[factsIndex] || factsList[0];
  factsMeta.textContent = `${factsIndex + 1}/${factsList.length} • Source: Wikipedia`;
}

btnFacts?.addEventListener("click", async () => {
  if (!selected?.name) return;

  factsTitle.textContent = selected.name;
  factsMeta.textContent = "Loading facts…";
  factsBox.textContent = "Loading…";
  factsModal.classList.remove("hidden");
  factsModal.setAttribute("aria-hidden", "false");

  try{
    await loadFactsForSelected();
    showFact();
  } catch (e){
    factsMeta.textContent = "Facts not found";
    factsBox.textContent = "Try selecting a bigger/known place. (Wikipedia facts unavailable for this item.)";
  }
});

closeFacts?.addEventListener("click", () => {
  factsModal.classList.add("hidden");
  factsModal.setAttribute("aria-hidden", "true");
});

nextFact?.addEventListener("click", () => {
  if (!factsList.length) return;
  factsIndex = (factsIndex + 1) % factsList.length;
  showFact();
});

// ---------- Contact / About ----------
function openInfo(title, html){
  infoTitle.textContent = title;
  infoBody.innerHTML = html;
  infoModal.classList.remove("hidden");
  infoModal.setAttribute("aria-hidden", "false");
}
infoClose?.addEventListener("click", () => {
  infoModal.classList.add("hidden");
  infoModal.setAttribute("aria-hidden", "true");
});

function handleNav(action){
  if (action === "home"){
    window.scrollTo({ top:0, behavior:"smooth" });
    return;
  }
  if (action === "contact"){
    openInfo("Contact Us", `
      <p><b>MapCrown Support</b></p>
      <p>For suggestions, bugs, or collaboration:</p>
      <ul>
        <li>Email: <b>your-email-here</b></li>
        <li>Location: Muzaffarpur</li>
      </ul>
    `);
    return;
  }
  if (action === "about"){
    openInfo("About Founder", `
      <p><b>Himanshu Kumar</b> is building MapCrown as a geography learning platform for competitive exam preparation.</p>
      <p><b>Focus:</b> UPSC, NDA, CDS, SSC and map-based learning.</p>
      <p><b>Location:</b> Muzaffarpur</p>
      <p>MapCrown aims to make geography fun, visual and easy to remember with map interaction, quizzes and facts.</p>
    `);
  }
}
window.handleNav = handleNav;

// Desktop nav clicks
document.querySelectorAll(".navLink[data-nav]").forEach(btn=>{
  btn.addEventListener("click", () => handleNav(btn.dataset.nav));
});

// Mobile menu fix: open above map
(function mobileMenu(){
  if (!mMenuBtn || !mMenu || !mobileMenuWrap) return;

  const open = () => { mMenu.classList.remove("hidden"); mMenuBtn.setAttribute("aria-expanded","true"); };
  const close = () => { mMenu.classList.add("hidden"); mMenuBtn.setAttribute("aria-expanded","false"); };
  const toggle = () => mMenu.classList.contains("hidden") ? open() : close();

  mMenuBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });
  mMenu.addEventListener("pointerdown", (e) => e.stopPropagation());

  mMenu.querySelectorAll("[data-nav]").forEach(item=>{
    item.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      close();
      handleNav(item.dataset.nav);
    });
  });

  document.addEventListener("pointerdown", (e)=>{
    if (!mobileMenuWrap.contains(e.target)) close();
  });
})();

// ---------- Pro Onboarding (Spotlight Tour) ----------
(function proTour(){
  const overlay = document.getElementById("tourOverlay");
  const spotlight = document.getElementById("tourSpotlight");
  const card = document.getElementById("tourCard");
  const title = document.getElementById("tourTitle");
  const meta = document.getElementById("tourMeta");
  const text = document.getElementById("tourText");
  const dots = document.getElementById("tourDots");
  const next = document.getElementById("tourNext");
  const back = document.getElementById("tourBack");
  const skip = document.getElementById("tourSkip");

  if (!overlay || !spotlight || !card) return;

  const steps = [
    { t:"Welcome to MapCrown", d:"This is a map learning tool for UPSC, NDA, CDS, SSC. Let’s learn in 30 seconds.", el:()=>document.querySelector(".brand") },
    { t:"Choose Category", d:"Select what you want to study: Countries, States, Cities, Rivers, Mountains.", el:()=>document.getElementById("category") },
    { t:"India Focus", d:"Turn on India Focus for India-only practice (very useful for exams).", el:()=>document.getElementById("indiaToggle") },
    { t:"Click on the map", d:"Tap/click any place. Details will appear on the right panel.", el:()=>document.getElementById("map") },
    { t:"Amazing Facts", d:"After selecting something, click ✨ Facts to see real facts from Wikipedia.", el:()=>document.getElementById("btnFacts") },
    { t:"Quiz", d:"Go to Quiz to test yourself with MCQ. Daily mode gives 10 questions.", el:()=>document.getElementById("btnQuiz") }
  ];

  let i = 0;

  function setDots(){
    dots.innerHTML = "";
    steps.forEach((_, idx)=>{
      const d = document.createElement("div");
      d.className = "tourDot" + (idx===i ? " active" : "");
      dots.appendChild(d);
    });
  }

  function place(target){
    const r = target.getBoundingClientRect();
    const pad = 10;
    const x = Math.max(10, r.left - pad);
    const y = Math.max(10, r.top - pad);
    const w = Math.min(window.innerWidth - 20, r.width + pad*2);
    const h = Math.min(window.innerHeight - 20, r.height + pad*2);

    spotlight.style.left = x + "px";
    spotlight.style.top = y + "px";
    spotlight.style.width = w + "px";
    spotlight.style.height = h + "px";

    const cardW = Math.min(410, window.innerWidth * 0.92);
    const margin = 10;

    let cx = Math.min(window.innerWidth - cardW - margin, x);
    cx = Math.max(margin, cx);

    const below = y + h + margin;
    const above = y - margin;

    let cy;
    if (below + 180 < window.innerHeight) cy = below;
    else cy = Math.max(margin, above - 180);

    card.style.left = cx + "px";
    card.style.top = cy + "px";
  }

  function show(){
    const s = steps[i];
    title.textContent = s.t;
    text.textContent = s.d;
    meta.textContent = `Step ${i+1}/${steps.length}`;
    setDots();

    back.disabled = (i === 0);
    next.textContent = (i === steps.length - 1) ? "Finish" : "Next";

    const el = s.el();
    if (!el) return;

    el.scrollIntoView?.({ block:"center", behavior:"smooth" });
    setTimeout(()=>place(el), 180);
  }

  function open(force=false){
    if (!force && localStorage.getItem("mapcrown_tour_done")) return;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden","false");
    i = 0;
    show();
  }
  function close(save=true){
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden","true");
    if (save) localStorage.setItem("mapcrown_tour_done", "1");
  }

  next.addEventListener("click", ()=>{
    if (i >= steps.length - 1) return close(true);
    i++; show();
  });
  back.addEventListener("click", ()=>{
    if (i <= 0) return;
    i--; show();
  });
  skip.addEventListener("click", ()=>close(true));

  window.addEventListener("resize", ()=>{
    if (!overlay.classList.contains("hidden")) show();
  });

  btnHelp?.addEventListener("click", ()=>open(true));

  window.addEventListener("load", ()=>{
    setTimeout(()=>open(false), 700);
  });
})();

// ---------- Events ----------
elExamMode?.addEventListener("change", ()=> elModeText.textContent = capitalize(elExamMode.value));
elIndiaFocus?.addEventListener("change", ()=> switchCategory(activeCategory));
elCategory?.addEventListener("change", ()=> switchCategory(elCategory.value));

// start
switchCategory(activeCategory);
