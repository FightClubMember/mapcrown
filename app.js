/* ============================================================
   MapCrown - Professional app.js
   Author: Himanshu Kumar
   ============================================================ */

/* -----------------------------
   CONFIG
------------------------------ */
const CONFIG = {
  DEV: false, // set true if you want console logs

  DATA_FILES: {
    countries: "/data/countries.min.json",
    states: "/data/states_provinces.min.json",
    cities: "/data/cities_major.min.json",
    rivers: "/data/rivers.min.json",
    mountains: "/data/mountains_peaks.min.json",
  },

  MAP: {
    startView: { lat: 20, lng: 0, zoom: 2 },
    minZoom: 2,
    maxZoom: 10,
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileMaxZoom: 19,
    bounds: { south: -85, west: -180, north: 85, east: 180 },
  },

  CITIES: {
    // If dataset is huge and mobile lags, set 2 or 3 (loads every 2nd/3rd point)
    samplingStep: 1,
    disableClusteringAtZoom: 8,
    maxClusterRadius: 50,
  },

  ONBOARDING: {
    storageKey: "mapcrown_tour_done",
    openDelayMs: 700,
  },

  FACTS: {
    cachePrefix: "facts_v1_",
    maxFacts: 8,
  },
};

/* -----------------------------
   UTILITIES
------------------------------ */
const Log = {
  info: (...a) => CONFIG.DEV && console.log("[MapCrown]", ...a),
  warn: (...a) => CONFIG.DEV && console.warn("[MapCrown]", ...a),
  err: (...a) => console.error("[MapCrown]", ...a),
};

const $ = (sel) => document.querySelector(sel);

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-IN");
}

function capitalize(s) {
  s = safeStr(s);
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

function pick(props, keys) {
  for (const k of keys) {
    const v = props?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return "";
}

function isProbablyIndia(props) {
  const a = safeStr(pick(props, ["admin", "ADMIN", "adm0name", "ADM0NAME", "country", "COUNTRY"])).toLowerCase();
  const b = safeStr(pick(props, ["sovereignt", "SOVEREIGNT"])).toLowerCase();
  const iso = safeStr(pick(props, ["iso_a2", "ISO_A2", "iso_a3", "ISO_A3"])).toLowerCase();
  return a.includes("india") || b.includes("india") || iso === "in" || iso === "ind";
}

/* Remove useless keys like featurecla/scalerank/min_zoom etc */
const JUNK_KEYS = new Set([
  "featurecla","FEATURECLA","scalerank","SCALERANK","min_zoom","MIN_ZOOM",
  "labelrank","LABELRANK","note","NOTE","name_alt","NAME_ALT","name_en","NAME_EN",
  "name_long","NAME_LONG","nameascii","NAMEASCII","wikidataid","WIKIDATAID",
  "ne_id","NE_ID","adm0_a3","ADM0_A3","adm1_a3","ADM1_A3","fclass","FCLASS",
  "geonunit","GEONUNIT","subunit","SUBUNIT","sov_a3","SOV_A3"
]);

/* -----------------------------
   DOM REFERENCES
------------------------------ */
const UI = {
  category: $("#category"),
  examMode: $("#examMode"),
  indiaFocus: $("#indiaFocus"),
  indiaToggle: $("#indiaToggle"),
  modeText: $("#modeText"),

  title: $("#title"),
  cName: $("#cName"),
  cType: $("#cType"),
  details: $("#details"),
  flag: $("#flag"),

  btnFacts: $("#btnFacts"),
  btnHelp: $("#btnHelp"),

  // Modals
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

  // Menu
  mMenuBtn: $("#mMenuBtn"),
  mMenu: $("#mMenu"),
  mobileMenuWrap: $("#mobileMenuWrap"),
};

/* -----------------------------
   APP STATE
------------------------------ */
const State = {
  activeCategory: "countries",
  indiaOnly: false,

  selected: {
    category: null,
    name: "",
    props: null,
    latlng: null,
  },

  // caches
  geoCache: new Map(), // category -> GeoJSON
  layers: {
    countries: null,
    states: null,
    rivers: null,
    mountains: null,
    cities: null,
  },
  activeLayer: null,

  facts: {
    list: [],
    idx: 0,
    key: "",
  },
};

/* -----------------------------
   MAP SERVICE
------------------------------ */
const MapService = {
  map: null,
  cityCluster: null,

  init() {
    const m = L.map("map", {
      zoomControl: true,
      preferCanvas: true,
      minZoom: CONFIG.MAP.minZoom,
      maxZoom: CONFIG.MAP.maxZoom,
      worldCopyJump: true,
    }).setView([CONFIG.MAP.startView.lat, CONFIG.MAP.startView.lng], CONFIG.MAP.startView.zoom);

    // bounds lock
    const b = CONFIG.MAP.bounds;
    const worldBounds = L.latLngBounds(L.latLng(b.south, b.west), L.latLng(b.north, b.east));
    m.setMaxBounds(worldBounds);
    m.on("drag", () => m.panInsideBounds(worldBounds, { animate: false }));

    L.tileLayer(CONFIG.MAP.tileUrl, {
      maxZoom: CONFIG.MAP.tileMaxZoom,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);

    // clusters
    this.cityCluster = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: CONFIG.CITIES.disableClusteringAtZoom,
      maxClusterRadius: CONFIG.CITIES.maxClusterRadius,
    });

    this.map = m;
    return m;
  },

  clearActiveLayer() {
    if (State.activeLayer) {
      this.map.removeLayer(State.activeLayer);
      State.activeLayer = null;
    }
    if (this.map.hasLayer(this.cityCluster)) this.map.removeLayer(this.cityCluster);
  },

  fitLayer(layer) {
    try {
      const bounds = layer.getBounds?.();
      if (bounds && bounds.isValid()) this.map.fitBounds(bounds, { padding: [20, 20] });
    } catch {}
  },

  zoomTo(latlng, zoom = 6) {
    try {
      this.map.setView(latlng, Math.max(this.map.getZoom(), zoom), { animate: true });
    } catch {}
  }
};

/* -----------------------------
   DATA SERVICE
------------------------------ */
const DataService = {
  async loadCategory(category) {
    if (State.geoCache.has(category)) return State.geoCache.get(category);

    const url = CONFIG.DATA_FILES[category];
    if (!url) throw new Error(`No data file configured for category: ${category}`);

    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Failed to load GeoJSON: ${url}`);

    const geo = await res.json();
    if (!geo || !Array.isArray(geo.features)) throw new Error(`Invalid GeoJSON: ${url}`);

    State.geoCache.set(category, geo);
    return geo;
  }
};

/* -----------------------------
   DETAILS (Professional)
------------------------------ */
const DetailRenderer = {
  FIELD_MAP: {
    countries: [
      ["Capital", ["capital", "CAPITAL"]],
      ["Continent", ["continent", "CONTINENT"]],
      ["Region", ["region_un", "REGION_UN", "region", "REGION"]],
      ["Subregion", ["subregion", "SUBREGION"]],
      ["Population", ["pop_est", "POP_EST", "population", "POPULATION"]],
      ["Area (km²)", ["area_km2", "AREA_KM2", "area", "AREA"]],
      ["ISO Code", ["iso_a2", "ISO_A2", "iso_a3", "ISO_A3"]],
      ["Currency", ["currency", "CURRENCY"]],
      ["Timezones", ["timezones", "TIMEZONES"]],
    ],
    states: [
      ["State / Province", ["name", "NAME", "name_en", "NAME_EN"]],
      ["Country", ["adm0name", "ADM0NAME", "admin", "ADMIN", "country", "COUNTRY"]],
      ["Type", ["type", "TYPE", "engtype_1", "ENGTYPE_1"]],
      ["ISO-3166-2", ["iso_3166_2", "ISO_3166_2"]],
      ["Region", ["region", "REGION"]],
    ],
    cities: [
      ["City", ["name", "NAME", "name_en", "NAME_EN"]],
      ["Country", ["adm0name", "ADM0NAME", "country", "COUNTRY", "admin", "ADMIN"]],
      ["State / Region", ["adm1name", "ADM1NAME", "region", "REGION"]],
      ["Population", ["pop_max", "POP_MAX", "population", "POPULATION"]],
    ],
    rivers: [
      ["River", ["name", "NAME", "name_en", "NAME_EN"]],
      ["Country / Region", ["adm0name", "ADM0NAME", "country", "COUNTRY", "region", "REGION"]],
      ["Length (km)", ["length_km", "LENGTH_KM", "length", "LENGTH"]],
      ["Source", ["source", "SOURCE"]],
      ["Mouth", ["mouth", "MOUTH"]],
      ["Basin", ["basin", "BASIN"]],
    ],
    mountains: [
      ["Peak", ["name", "NAME", "name_en", "NAME_EN"]],
      ["Country / Region", ["adm0name", "ADM0NAME", "country", "COUNTRY", "region", "REGION"]],
      ["Elevation (m)", ["elevation", "ELEVATION", "elev_m", "ELEV_M", "elev", "ELEV"]],
      ["Range", ["range", "RANGE", "mountain_range", "MOUNTAIN_RANGE"]],
    ],
  },

  getDisplayName(category, props) {
    // fallback name detection
    const candidate = pick(props, ["name", "NAME", "name_en", "NAME_EN", "admin", "ADMIN", "name_long", "NAME_LONG"]);
    return safeStr(candidate) || "Unknown";
  },

  render(category, props, latlng) {
    // Build clean list
    const rows = [];
    const fieldSpec = this.FIELD_MAP[category] || [];

    for (const [label, keys] of fieldSpec) {
      let val = pick(props, keys);
      if (!safeStr(val)) continue;

      if (label.toLowerCase().includes("population")) val = fmtNum(val);
      if (label.toLowerCase().includes("area")) val = fmtNum(val);
      if (label.toLowerCase().includes("length")) val = fmtNum(val);
      if (label.toLowerCase().includes("elevation")) val = fmtNum(val);

      rows.push([label, safeStr(val)]);
    }

    // Coordinates always nice (for non-country too)
    if (latlng) {
      rows.push(["Coordinates", `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`]);
    }

    // Add extra useful props (but filtered)
    // If dataset has extra good fields, we include them safely.
    const extra = this.extractExtraProps(props, rows.map(r => r[0]));
    for (const [k, v] of extra) rows.push([k, v]);

    if (!rows.length) return `<div>No details available for this item.</div>`;

    return `
      <div class="detailsRows">
        ${rows.map(([k, v]) => `
          <div class="detailsRow">
            <div class="detailsKey">${escapeHtml(k)}</div>
            <div class="detailsVal">${escapeHtml(v)}</div>
          </div>
        `).join("")}
      </div>
    `;
  },

  extractExtraProps(props, alreadyLabels) {
    const keep = [];
    const usedLabelsLower = new Set(alreadyLabels.map(x => x.toLowerCase()));

    // pick up to 6 extra properties that look meaningful
    const entries = Object.entries(props || {});
    for (const [kRaw, vRaw] of entries) {
      const k = safeStr(kRaw);
      if (!k) continue;
      if (JUNK_KEYS.has(k)) continue;

      const v = safeStr(vRaw);
      if (!v) continue;

      // ignore too long / noisy
      if (v.length > 80) continue;

      // ignore numeric IDs
      if (/^\d+$/.test(v) && v.length > 5) continue;

      const label = this.prettyKey(k);
      if (usedLabelsLower.has(label.toLowerCase())) continue;

      keep.push([label, v]);
      if (keep.length >= 6) break;
    }
    return keep;
  },

  prettyKey(k) {
    // Make "adm1name" -> "Adm1name" etc. (simple)
    return capitalize(k.replaceAll("_", " "));
  }
};

/* -----------------------------
   UI RENDER
------------------------------ */
const UIRender = {
  setLoading(text = "Loading…") {
    UI.title.textContent = text;
    UI.details.textContent = "Loading data…";
    UI.btnFacts.disabled = true;
  },

  setReady() {
    UI.title.textContent = "Ready";
    if (!State.selected.name) UI.details.textContent = "Click on the map to see details…";
  },

  setSelected(category, name, props, latlng) {
    UI.title.textContent = "Selected";
    UI.cName.textContent = name;
    UI.cType.textContent = capitalize(category);
    UI.modeText.textContent = capitalize(UI.examMode.value);

    UI.flag.classList.add("hidden");
    UI.details.innerHTML = DetailRenderer.render(category, props, latlng);

    UI.btnFacts.disabled = false;
  },

  showError(msg) {
    UI.title.textContent = "Error";
    UI.details.innerHTML = `<b>Error:</b> ${escapeHtml(msg)}<br><br><small>Check /data filenames and extensions (.json)</small>`;
    UI.btnFacts.disabled = true;
  }
};

/* -----------------------------
   LAYERS (Professional)
------------------------------ */
const LayerManager = {
  async ensure(category) {
    if (State.layers[category]) return;

    const geo = await DataService.loadCategory(category);
    const indiaOnly = !!State.indiaOnly;

    if (category === "cities") {
      MapService.cityCluster.clearLayers();

      const feats = geo.features || [];
      const step = Math.max(1, CONFIG.CITIES.samplingStep);

      for (let idx = 0; idx < feats.length; idx += step) {
        const f = feats[idx];
        const props = f.properties || {};
        if (indiaOnly && !isProbablyIndia(props)) continue;

        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;

        const latlng = L.latLng(coords[1], coords[0]);
        const name = DetailRenderer.getDisplayName(category, props);

        const marker = L.marker(latlng, { title: name });
        marker.bindTooltip(name, { direction: "top", opacity: 0.9 });

        marker.on("click", () => {
          App.selectFeature(category, name, props, latlng);
          MapService.zoomTo(latlng, 6);
        });

        MapService.cityCluster.addLayer(marker);
      }

      State.layers.cities = MapService.cityCluster;
      return;
    }

    // Polygons / lines
    const layer = L.geoJSON(geo, {
      filter: (f) => !indiaOnly || isProbablyIndia(f.properties || {}),
      style: () => this.baseStyle(category),
      onEachFeature: (feature, lyr) => {
        const props = feature.properties || {};
        const name = DetailRenderer.getDisplayName(category, props);

        lyr.bindTooltip(name, { sticky: true, opacity: 0.9 });

        lyr.on("mouseover", () => lyr.setStyle?.(this.hoverStyle(category)));
        lyr.on("mouseout", () => lyr.setStyle?.(this.baseStyle(category)));
        lyr.on("click", (e) => App.selectFeature(category, name, props, e.latlng));
      }
    });

    State.layers[category] = layer;
  },

  baseStyle(category) {
    if (category === "rivers") return { color: "#5aa7ff", weight: 2, fillOpacity: 0 };
    if (category === "mountains") return { color: "#d6b36a", weight: 2, fillOpacity: 0.08 };
    if (category === "states") return { color: "#7cc4ff", weight: 1.5, fillOpacity: 0.10 };
    return { color: "#7cc4ff", weight: 1.5, fillOpacity: 0.08 };
  },

  hoverStyle(category) {
    const s = this.baseStyle(category);
    return { ...s, weight: (s.weight || 2) + 1, fillOpacity: Math.min(0.22, (s.fillOpacity || 0.1) + 0.1) };
  }
};

/* -----------------------------
   FACTS (Wikipedia)
------------------------------ */
const FactsService = {
  async fetchSummary(title) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("Facts not found on Wikipedia.");
    return await res.json();
  },

  toSentences(text) {
    return safeStr(text)
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= 35);
  },

  async buildFacts(category, name) {
    const key = `${CONFIG.FACTS.cachePrefix}${category}:${name}`;
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);

    const titleCandidates = this.titleCandidates(category, name);

    let summary = null;
    for (const t of titleCandidates) {
      try {
        summary = await this.fetchSummary(t);
        if (summary?.extract) break;
      } catch {}
    }

    if (!summary?.extract) throw new Error("No facts available for this item.");

    const sentences = this.toSentences(summary.extract).slice(0, CONFIG.FACTS.maxFacts);
    const facts = sentences.map(s => `✨ ${s}`);

    sessionStorage.setItem(key, JSON.stringify(facts));
    return facts;
  },

  titleCandidates(category, name) {
    const list = [name];

    // smarter guesses
    if (category === "rivers") list.unshift(`${name} River`);
    if (category === "mountains") list.unshift(`${name} mountain`, `${name} peak`);
    if (category === "cities") list.unshift(`${name} (city)`);
    return Array.from(new Set(list));
  }
};

/* -----------------------------
   ONBOARDING (Pro Tour)
------------------------------ */
const Onboarding = {
  overlay: $("#tourOverlay"),
  spotlight: $("#tourSpotlight"),
  card: $("#tourCard"),
  title: $("#tourTitle"),
  meta: $("#tourMeta"),
  text: $("#tourText"),
  dots: $("#tourDots"),
  btnNext: $("#tourNext"),
  btnBack: $("#tourBack"),
  btnSkip: $("#tourSkip"),

  steps: [
    { t:"Welcome to MapCrown", d:"Learn maps for UPSC / NDA / CDS / SSC. This tour will show how to use the site.", el:()=>$(".brand") },
    { t:"Choose Category", d:"Pick Countries, States, Cities, Rivers or Mountains.", el:()=>$("#category") },
    { t:"India Focus", d:"Enable India Focus for India-only practice.", el:()=>$("#indiaToggle") || $("#indiaFocus") },
    { t:"Tap on Map", d:"Click/tap a region to open details on the right panel.", el:()=>$("#map") },
    { t:"Amazing Facts", d:"After selecting, click ✨ Facts for real interesting facts.", el:()=>$("#btnFacts") },
    { t:"Quiz", d:"Use Quiz for MCQ practice. Daily mode gives 10 questions.", el:()=>$("#btnQuiz") },
  ],
  idx: 0,

  init() {
    if (!this.overlay) return;

    this.btnNext?.addEventListener("click", () => {
      if (this.idx >= this.steps.length - 1) return this.close(true);
      this.idx++;
      this.show();
    });

    this.btnBack?.addEventListener("click", () => {
      if (this.idx <= 0) return;
      this.idx--;
      this.show();
    });

    this.btnSkip?.addEventListener("click", () => this.close(true));

    window.addEventListener("resize", () => {
      if (!this.overlay.classList.contains("hidden")) this.show();
    });

    UI.btnHelp?.addEventListener("click", () => this.open(true));

    window.addEventListener("load", () => {
      setTimeout(() => this.open(false), CONFIG.ONBOARDING.openDelayMs);
    });
  },

  open(force) {
    if (!force && localStorage.getItem(CONFIG.ONBOARDING.storageKey)) return;
    this.overlay.classList.remove("hidden");
    this.overlay.setAttribute("aria-hidden", "false");
    this.idx = 0;
    this.show();
  },

  close(save) {
    this.overlay.classList.add("hidden");
    this.overlay.setAttribute("aria-hidden", "true");
    if (save) localStorage.setItem(CONFIG.ONBOARDING.storageKey, "1");
  },

  show() {
    const step = this.steps[this.idx];
    const target = step.el?.();
    if (!target) return;

    this.title.textContent = step.t;
    this.text.textContent = step.d;
    this.meta.textContent = `Step ${this.idx + 1}/${this.steps.length}`;

    this.btnBack.disabled = (this.idx === 0);
    this.btnNext.textContent = (this.idx === this.steps.length - 1) ? "Finish" : "Next";

    this.renderDots();
    target.scrollIntoView?.({ block: "center", behavior: "smooth" });

    setTimeout(() => this.position(target), 160);
  },

  renderDots() {
    this.dots.innerHTML = "";
    for (let i = 0; i < this.steps.length; i++) {
      const d = document.createElement("div");
      d.className = "tourDot" + (i === this.idx ? " active" : "");
      this.dots.appendChild(d);
    }
  },

  position(target) {
    const r = target.getBoundingClientRect();
    const pad = 10;

    const x = Math.max(10, r.left - pad);
    const y = Math.max(10, r.top - pad);
    const w = Math.min(window.innerWidth - 20, r.width + pad * 2);
    const h = Math.min(window.innerHeight - 20, r.height + pad * 2);

    this.spotlight.style.left = `${x}px`;
    this.spotlight.style.top = `${y}px`;
    this.spotlight.style.width = `${w}px`;
    this.spotlight.style.height = `${h}px`;

    const cardW = Math.min(420, window.innerWidth * 0.92);
    const margin = 10;

    let cx = Math.min(window.innerWidth - cardW - margin, x);
    cx = Math.max(margin, cx);

    const below = y + h + margin;
    const above = y - margin;

    const cy = (below + 190 < window.innerHeight) ? below : Math.max(margin, above - 190);

    this.card.style.left = `${cx}px`;
    this.card.style.top = `${cy}px`;
  }
};

/* -----------------------------
   MENU (Mobile Fix)
------------------------------ */
const Menu = {
  init() {
    if (!UI.mMenuBtn || !UI.mMenu || !UI.mobileMenuWrap) return;

    const open = () => { UI.mMenu.classList.remove("hidden"); UI.mMenuBtn.setAttribute("aria-expanded", "true"); };
    const close = () => { UI.mMenu.classList.add("hidden"); UI.mMenuBtn.setAttribute("aria-expanded", "false"); };
    const toggle = () => UI.mMenu.classList.contains("hidden") ? open() : close();

    UI.mMenuBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      toggle();
    });

    UI.mMenu.addEventListener("pointerdown", (e) => e.stopPropagation());

    UI.mMenu.querySelectorAll("[data-nav]").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        close();
        App.handleNav(item.dataset.nav);
      });
    });

    document.addEventListener("pointerdown", (e) => {
      if (!UI.mobileMenuWrap.contains(e.target)) close();
    });
  }
};

/* -----------------------------
   APP (Main Controller)
------------------------------ */
const App = {
  init() {
    MapService.init();
    Menu.init();
    Onboarding.init();

    // initial UI
    State.activeCategory = UI.category?.value || "countries";
    State.indiaOnly = !!UI.indiaFocus?.checked;

    // events
    UI.category?.addEventListener("change", () => this.switchCategory(UI.category.value));
    UI.indiaFocus?.addEventListener("change", () => {
      State.indiaOnly = !!UI.indiaFocus.checked;
      this.switchCategory(State.activeCategory, { keepSelection: false });
    });

    UI.examMode?.addEventListener("change", () => {
      UI.modeText.textContent = capitalize(UI.examMode.value);
    });

    UI.btnFacts?.addEventListener("click", () => this.openFacts());
    UI.closeFacts?.addEventListener("click", () => this.closeFacts());
    UI.nextFact?.addEventListener("click", () => this.nextFact());

    UI.infoClose?.addEventListener("click", () => this.closeInfo());

    document.querySelectorAll(".navLink[data-nav]").forEach(btn => {
      btn.addEventListener("click", () => this.handleNav(btn.dataset.nav));
    });

    // start
    this.switchCategory(State.activeCategory);
  },

  async switchCategory(category, opts = {}) {
    State.activeCategory = category;
    UIRender.setLoading("Loading…");

    MapService.clearActiveLayer();

    // reset selection if needed
    if (!opts.keepSelection) {
      State.selected = { category: null, name: "", props: null, latlng: null };
      UI.cName.textContent = "—";
      UI.cType.textContent = "—";
    }

    try {
      await LayerManager.ensure(category);

      const layer = State.layers[category];
      State.activeLayer = layer;

      if (category === "cities") {
        MapService.map.addLayer(layer);
      } else {
        MapService.map.addLayer(layer);
        MapService.fitLayer(layer);
      }

      UIRender.setReady();
    } catch (e) {
      Log.err(e);
      UIRender.showError(e.message || "Failed to load category.");
    }
  },

  selectFeature(category, name, props, latlng) {
    State.selected = { category, name, props, latlng };
    UIRender.setSelected(category, name, props, latlng);

    // facts reset
    State.facts = { list: [], idx: 0, key: "" };
  },

  // -------- Facts UI --------
  async openFacts() {
    if (!State.selected?.name) return;

    UI.factsModal.classList.remove("hidden");
    UI.factsTitle.textContent = State.selected.name;
    UI.factsMeta.textContent = "Loading facts…";
    UI.factsBox.textContent = "Loading…";

    const key = `${State.selected.category}:${State.selected.name}`;
    if (State.facts.key === key && State.facts.list.length) {
      this.renderFact();
      return;
    }

    try {
      const list = await FactsService.buildFacts(State.selected.category, State.selected.name);
      State.facts = { list, idx: 0, key };
      this.renderFact();
    } catch (e) {
      UI.factsMeta.textContent = "Facts not found";
      UI.factsBox.textContent = "No facts available for this item (Wikipedia not found). Try a bigger/known place.";
    }
  },

  closeFacts() {
    UI.factsModal.classList.add("hidden");
  },

  nextFact() {
    if (!State.facts.list.length) return;
    State.facts.idx = (State.facts.idx + 1) % State.facts.list.length;
    this.renderFact();
  },

  renderFact() {
    const { list, idx } = State.facts;
    if (!list.length) return;
    UI.factsBox.textContent = list[idx];
    UI.factsMeta.textContent = `${idx + 1}/${list.length} • Source: Wikipedia`;
  },

  // -------- Nav / Modals --------
  handleNav(action) {
    if (action === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action === "contact") {
      this.openInfo("Contact Us", `
        <p><b>MapCrown Support</b></p>
        <p>For feedback, bugs or suggestions:</p>
        <ul>
          <li><b>Email:</b> your-email-here</li>
          <li><b>Location:</b> Muzaffarpur</li>
        </ul>
      `);
      return;
    }
    if (action === "about") {
      this.openInfo("About Founder", `
        <p><b>Himanshu Kumar</b> is building MapCrown as a geography learning platform for competitive exam preparation.</p>
        <p><b>Focus:</b> UPSC • NDA • CDS • SSC</p>
        <p><b>Location:</b> Muzaffarpur</p>
        <p>Mission: Make map learning visual, easy and exam-ready with details, quizzes and facts.</p>
      `);
    }
  },

  openInfo(title, html) {
    UI.infoTitle.textContent = title;
    UI.infoBody.innerHTML = html;
    UI.infoModal.classList.remove("hidden");
  },

  closeInfo() {
    UI.infoModal.classList.add("hidden");
  }
};

/* -----------------------------
   BOOT
------------------------------ */
App.init();
