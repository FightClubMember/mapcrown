/* ============================================================
   MapCrown • app.js
   - Countries: Capital+Flag+Currency+CallingCode + PM/President (live)
   - States: India capitals (offline)
   - Cities: no Unknown + clustering
   - Rivers/Mountains: clean details + fallback
   - Mobile menu fixed (only mobile)
   ============================================================ */

const CONFIG = {
  DATA: {
    countries: "/data/countries.min.json",
    states: "/data/states_provinces.min.json",
    cities: "/data/cities_major.min.json",
    rivers: "/data/rivers.min.json",
    mountains: "/data/mountains_peaks.min.json",
  },
  MAP: { minZoom: 2, maxZoom: 10 }
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

  mMenuBtn: $("#mMenuBtn"),
  mMenu: $("#mMenu"),
  mobileMenuWrap: document.querySelector(".mobileMenuWrap"),
};

function safeStr(v){ return (v===null||v===undefined) ? "" : String(v).trim(); }
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function fmtNum(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return safeStr(v);
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

/* ✅ robust name detection (fixes Unknown for cities too) */
function getFeatureName(category, props){
  const name = pick(props, [
    "name","NAME","name_en","NAME_EN","name_long","NAME_LONG",
    "nameascii","NAMEASCII","label","LABEL","title","TITLE",
    "admin","ADMIN","sovereignt","SOVEREIGNT",
    "adm0name","ADM0NAME","adm1name","ADM1NAME",
    "city","CITY","town","TOWN","province","PROVINCE","state","STATE","region","REGION"
  ]);
  return safeStr(name) || "Unknown";
}

/* India filter */
function isIndia(props){
  const a = safeStr(pick(props, ["admin","ADMIN","adm0name","ADM0NAME","country","COUNTRY","sovereignt","SOVEREIGNT"])).toLowerCase();
  const iso2 = safeStr(pick(props, ["iso_a2","ISO_A2"])).toLowerCase();
  const iso3 = safeStr(pick(props, ["iso_a3","ISO_A3"])).toLowerCase();
  return a.includes("india") || iso2 === "in" || iso3 === "ind";
}

/* ✅ India state capitals (offline) */
function getIndiaStateCapital(stateName){
  const s = safeStr(stateName).toLowerCase();
  const MAP = {
    "andhra pradesh":"Amaravati","arunachal pradesh":"Itanagar","assam":"Dispur","bihar":"Patna",
    "chhattisgarh":"Raipur","goa":"Panaji","gujarat":"Gandhinagar","haryana":"Chandigarh",
    "himachal pradesh":"Shimla","jharkhand":"Ranchi","karnataka":"Bengaluru","kerala":"Thiruvananthapuram",
    "madhya pradesh":"Bhopal","maharashtra":"Mumbai","manipur":"Imphal","meghalaya":"Shillong","mizoram":"Aizawl",
    "nagaland":"Kohima","odisha":"Bhubaneswar","punjab":"Chandigarh","rajasthan":"Jaipur","sikkim":"Gangtok",
    "tamil nadu":"Chennai","telangana":"Hyderabad","tripura":"Agartala","uttar pradesh":"Lucknow",
    "uttarakhand":"Dehradun","west bengal":"Kolkata",
    "andaman and nicobar islands":"Port Blair","chandigarh":"Chandigarh",
    "dadra and nagar haveli and daman and diu":"Daman","delhi":"New Delhi",
    "jammu and kashmir":"Srinagar (Summer), Jammu (Winter)","ladakh":"Leh",
    "lakshadweep":"Kavaratti","puducherry":"Puducherry"
  };
  if (MAP[s]) return MAP[s];
  for (const key of Object.keys(MAP)){
    if (s.includes(key) || key.includes(s)) return MAP[key];
  }
  return "";
}

/* ---------- Details mapping (clean) ---------- */
const FIELD_MAP = {
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
  ],
};

const JUNK = new Set(["featurecla","FEATURECLA","scalerank","SCALERANK","labelrank","LABELRANK","min_zoom","MIN_ZOOM","note","NOTE","ne_id","NE_ID","wikidataid","WIKIDATAID","name_alt","NAME_ALT"]);

function buildGenericDetailsHTML(category, props, latlng){
  const rows = FIELD_MAP[category] || [];
  const out = [];
  out.push(`<div class="details"><ul>`);

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

  // fallback if few mapped fields
  if (count < 2){
    const entries = Object.entries(props || {})
      .filter(([k,v]) => !JUNK.has(k) && safeStr(v) && String(v).length <= 80)
      .slice(0, 10);

    if (entries.length){
      out.push(`<div style="margin-top:10px;font-weight:900;opacity:.95">More Info</div><ul>`);
      for (const [k,v] of entries){
        out.push(`<li><b>${escapeHtml(cap(k.replaceAll("_"," ")))}:</b> ${escapeHtml(String(v))}</li>`);
      }
      out.push(`</ul>`);
    }
  }

  out.push(`</div>`);
  return out.join("");
}

/* ---------- Country Full Details (REST Countries + Wikidata) ---------- */
function getCountryIdFromProps(props){
  const iso2 = safeStr(pick(props, ["iso_a2","ISO_A2"]));
  const iso3 = safeStr(pick(props, ["iso_a3","ISO_A3"]));
  const name = safeStr(pick(props, ["admin","ADMIN","name","NAME","name_long","NAME_LONG","sovereignt","SOVEREIGNT"]));
  return { iso2:(iso2 && iso2 !== "-99")?iso2:"", iso3:(iso3 && iso3 !== "-99")?iso3:"", name };
}
async function fetchRestCountries({ iso2, iso3, name }){
  let url = "";
  if (iso2) url = `https://restcountries.com/v3.1/alpha/${encodeURIComponent(iso2)}`;
  else if (iso3) url = `https://restcountries.com/v3.1/alpha/${encodeURIComponent(iso3)}`;
  else if (name) url = `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=true`;
  else throw new Error("No ISO/name for country");

  const res = await fetch(url);
  if (!res.ok) throw new Error("REST Countries failed");
  const data = await res.json();
  const c = Array.isArray(data) ? data[0] : data;
  if (!c) throw new Error("No REST Countries data");

  const capital = Array.isArray(c.capital) ? c.capital[0] : (c.capital || "");
  const flag = c.flags?.png || c.flags?.svg || "";
  const population = c.population ?? "";
  const area = c.area ?? "";
  const region = c.region ?? "";
  const subregion = c.subregion ?? "";

  let currency = "";
  if (c.currencies){
    const k = Object.keys(c.currencies)[0];
    if (k) currency = `${k} (${c.currencies[k]?.name || ""})`.trim();
  }

  let calling = "";
  if (c.idd?.root){
    const suf = Array.isArray(c.idd.suffixes) ? c.idd.suffixes[0] : "";
    calling = `${c.idd.root}${suf || ""}`;
  }

  return { capital, flag, population, area, region, subregion, currency, calling };
}
async function fetchWikidataLeaders({ iso2, iso3, name }){
  const filter = iso2
    ? `?country wdt:P297 "${iso2.toUpperCase()}".`
    : (iso3
      ? `?country wdt:P298 "${iso3.toUpperCase()}".`
      : `?country rdfs:label "${name.replace(/"/g, '\\"')}"@en.`);

  const sparql = `
    SELECT ?headOfStateLabel ?headOfGovernmentLabel WHERE {
      ${filter}
      OPTIONAL { ?country wdt:P35 ?headOfState. }
      OPTIONAL { ?country wdt:P6  ?headOfGovernment. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1
  `;
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql);
  const res = await fetch(url, { headers:{ "Accept":"application/sparql-results+json" }});
  if (!res.ok) throw new Error("Wikidata failed");
  const json = await res.json();
  const row = json?.results?.bindings?.[0] || {};
  return {
    headOfState: row.headOfStateLabel?.value || "",
    headOfGovernment: row.headOfGovernmentLabel?.value || ""
  };
}
function buildCountryFullHTML(countryName, latlng, rest, leaders, props){
  const rows = [];
  rows.push(["Country", countryName || "—"]);
  if (rest.capital) rows.push(["Capital", rest.capital]);
  if (leaders.headOfState) rows.push(["Head of State", leaders.headOfState]);
  if (leaders.headOfGovernment) rows.push(["Head of Government", leaders.headOfGovernment]);
  if (rest.region) rows.push(["Region", rest.region]);
  if (rest.subregion) rows.push(["Subregion", rest.subregion]);
  if (rest.population) rows.push(["Population", fmtNum(rest.population)]);
  if (rest.area) rows.push(["Area (km²)", fmtNum(rest.area)]);
  if (rest.currency) rows.push(["Currency", rest.currency]);
  if (rest.calling) rows.push(["Calling Code", rest.calling]);

  const iso2 = safeStr(pick(props, ["iso_a2","ISO_A2"]));
  const iso3 = safeStr(pick(props, ["iso_a3","ISO_A3"]));
  if (iso2) rows.push(["ISO A2", iso2]);
  if (iso3) rows.push(["ISO A3", iso3]);

  if (latlng) rows.push(["Coordinates", `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`]);

  return `
    <div class="details">
      <ul>${rows.map(([k,v])=>`<li><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</li>`).join("")}</ul>
      <div style="margin-top:10px;color:rgba(233,238,252,.70);font-size:12px;line-height:1.6">
        Source: REST Countries + Wikidata (leaders update automatically)
      </div>
    </div>
  `;
}

const CountryCache = new Map(); // key -> {rest, leaders}

/* ---------- Map Setup ---------- */
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

const cityCluster = L.markerClusterGroup({
  chunkedLoading: true,
  showCoverageOnHover: false,
  disableClusteringAtZoom: 8,
  maxClusterRadius: 50
});

/* ---------- Data Cache & Layers ---------- */
const cache = new Map();
const layers = { countries:null, states:null, cities:null, rivers:null, mountains:null };
let activeLayer = null;

async function loadGeo(category){
  if (cache.has(category)) return cache.get(category);
  const url = CONFIG.DATA[category];
  const res = await fetch(url, { cache:"force-cache" });
  if (!res.ok) throw new Error("Failed to load: " + url);
  const geo = await res.json();
  if (!geo || !Array.isArray(geo.features)) throw new Error("Invalid GeoJSON: " + url);
  cache.set(category, geo);
  return geo;
}

function clearActiveLayer(){
  if (activeLayer) map.removeLayer(activeLayer);
  activeLayer = null;
  if (map.hasLayer(cityCluster)) map.removeLayer(cityCluster);
}

function setHeader(name, type){
  UI.title.textContent = name ? "Selected" : "Ready";
  UI.cName.textContent = name || "—";
  UI.cType.textContent = type || "—";
  UI.modeText.textContent = cap(UI.examMode.value);
}

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

/* ---------- Selection ---------- */
let selected = { category:null, name:"", props:null, latlng:null };

async function selectCountry(props, latlng){
  const id = getCountryIdFromProps(props);
  const countryName = id.name || safeStr(pick(props, ["admin","ADMIN","name","NAME"])) || "Unknown";

  selected = { category:"countries", name:countryName, props, latlng };
  setHeader(countryName, "Countries");
  UI.btnFacts.disabled = false;

  UI.flag.classList.add("hidden");
  UI.details.innerHTML = `<div class="details">Loading capital, flag & leaders…</div>`;

  const key = (id.iso2 || id.iso3 || id.name || "").toLowerCase();
  try{
    if (CountryCache.has(key)){
      const cached = CountryCache.get(key);
      if (cached.rest?.flag){
        UI.flag.src = cached.rest.flag;
        UI.flag.classList.remove("hidden");
      }
      UI.details.innerHTML = buildCountryFullHTML(countryName, latlng, cached.rest, cached.leaders, props);
      return;
    }

    const rest = await fetchRestCountries(id);
    const leaders = await fetchWikidataLeaders(id);
    CountryCache.set(key, { rest, leaders });

    if (rest.flag){
      UI.flag.src = rest.flag;
      UI.flag.classList.remove("hidden");
    }
    UI.details.innerHTML = buildCountryFullHTML(countryName, latlng, rest, leaders, props);
  } catch (e){
    UI.flag.classList.add("hidden");
    // fallback to whatever is in geojson
    UI.details.innerHTML = buildGenericDetailsHTML("states", props, latlng) +
      `<div style="margin-top:10px;color:rgba(233,238,252,.75)">Live country details not available right now.</div>`;
  }
}

function selectGeneric(category, props, latlng){
  const name = getFeatureName(category, props);
  selected = { category, name, props, latlng };
  setHeader(name, cap(category));
  UI.btnFacts.disabled = false;
  UI.flag.classList.add("hidden");

  let html = buildGenericDetailsHTML(category, props, latlng);

  // ✅ add India state capital if states
  if (category === "states"){
    const capi = getIndiaStateCapital(name);
    if (capi){
      html += `<div style="margin-top:10px"><b>State Capital:</b> ${escapeHtml(capi)}</div>`;
    }
  }
  UI.details.innerHTML = html;
}

/* ---------- Ensure layer ---------- */
async function ensureLayer(category){
  if (layers[category]) return layers[category];

  const geo = await loadGeo(category);
  const indiaOnly = !!UI.indiaFocus.checked;

  if (category === "cities"){
    cityCluster.clearLayers();
    for (const f of geo.features){
      const props = f.properties || {};
      if (indiaOnly && !isIndia(props)) continue;

      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const latlng = L.latLng(coords[1], coords[0]);
      const name = getFeatureName("cities", props);

      const marker = L.marker(latlng, { title:name });
      marker.bindTooltip(name, { direction:"top", opacity:0.95 });
      marker.on("click", () => {
        selectGeneric("cities", props, latlng);
        map.setView(latlng, Math.max(map.getZoom(), 6), { animate:true });
      });
      cityCluster.addLayer(marker);
    }
    layers.cities = cityCluster;
    return layers.cities;
  }

  const layer = L.geoJSON(geo, {
    filter: (f) => !indiaOnly || isIndia(f.properties || {}),
    style: () => baseStyle(category),
    onEachFeature: (feature, lyr) => {
      const props = feature.properties || {};
      const nm = getFeatureName(category, props);

      lyr.bindTooltip(nm, { sticky:true, opacity:0.9 });
      lyr.on("mouseover", () => lyr.setStyle?.(hoverStyle(category)));
      lyr.on("mouseout", () => lyr.setStyle?.(baseStyle(category)));

      lyr.on("click", (e) => {
        if (category === "countries") selectCountry(props, e.latlng);
        else selectGeneric(category, props, e.latlng);
      });
    }
  });

  layers[category] = layer;
  return layer;
}

/* ---------- Switch category ---------- */
async function switchCategory(category){
  UI.title.textContent = "Loading…";
  UI.details.textContent = "Loading data…";
  UI.btnFacts.disabled = true;
  UI.flag.classList.add("hidden");

  clearActiveLayer();
  selected = { category:null, name:"", props:null, latlng:null };
  setHeader("", "");

  try{
    const layer = await ensureLayer(category);
    activeLayer = layer;
    map.addLayer(layer);

    if (category !== "cities"){
      try{ map.fitBounds(layer.getBounds(), { padding:[20,20] }); } catch {}
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

/* ---------- Professional About/Contact ---------- */
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
          Explore categories, open clean details, read facts, and practice map knowledge.
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

/* ✅ Mobile Menu fix */
(function mobileMenuFix(){
  const btn = UI.mMenuBtn, menu = UI.mMenu, wrap = UI.mobileMenuWrap;
  if (!btn || !menu || !wrap) return;

  const open = () => { menu.classList.remove("hidden"); btn.setAttribute("aria-expanded","true"); };
  const close = () => { menu.classList.add("hidden"); btn.setAttribute("aria-expanded","false"); };

  btn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (menu.classList.contains("hidden")) open(); else close();
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });

  menu.querySelectorAll("[data-nav]").forEach(item=>{
    item.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      close();
      handleNav(item.dataset.nav);
    });
  });
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
