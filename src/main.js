import "./styles.css";

const CSV_FILES = [
  "/data/CATALOGO_CENTRO_TRABAJO_01_16_CSV.csv",
  "/data/CATALOGO_CENTRO_TRABAJO_17_32_CSV.csv",
  "/CATALOGO_CENTRO_TRABAJO_01_16_CSV.csv",
  "/CATALOGO_CENTRO_TRABAJO_17_32_CSV.csv"
];

const REQUIRED_COLUMNS = {
  cct: "cv_cct",
  name: "c_nombre",
  type: "c_tipo",
  status: "c_estatus",
  state: "inmueble_c_nom_ent",
  municipality: "inmueble_c_nom_mun",
  level: "tiponivelsub_c_servicion1",
  control: "sostenimiento_c_control",
  lat: "latitud",
  lng: "longitud"
};

const state = {
  records: [],
  filtered: [],
  selectedId: null,
  currentView: "list",
  map: null,
  markerLayer: null,
  filters: {
    query: "",
    state: "",
    municipality: "",
    level: "",
    type: "",
    control: "",
    includeInactive: false,
    onlyWithCoords: false
  }
};

const els = {
  dataStatus: document.querySelector("#dataStatus"),
  resultCount: document.querySelector("#resultCount"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  resultsList: document.querySelector("#resultsList"),
  emptyState: document.querySelector("#emptyState"),
  detailPanel: document.querySelector("#detailPanel"),
  stateFilter: document.querySelector("#stateFilter"),
  municipalityFilter: document.querySelector("#municipalityFilter"),
  levelFilter: document.querySelector("#levelFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  controlFilter: document.querySelector("#controlFilter"),
  includeInactive: document.querySelector("#includeInactive"),
  csvFiles: document.querySelector("#csvFiles"),
  clearFilters: document.querySelector("#clearFilters"),
  quickFilters: document.querySelector(".quick-filters"),
  listViewButton: document.querySelector("#listViewButton"),
  mapViewButton: document.querySelector("#mapViewButton"),
  mapPanel: document.querySelector("#mapPanel"),
  themeToggle: document.querySelector("#themeToggle")
};

const debounce = (fn, delay = 180) => {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
};

const clean = (value) => String(value ?? "").trim();
const normalize = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const readable = (value, fallback = "No disponible") => clean(value) || fallback;

const toNumber = (value) => {
  const number = Number.parseFloat(clean(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
};

function normalizeRecord(row, index) {
  const lat = toNumber(row[REQUIRED_COLUMNS.lat]);
  const lng = toNumber(row[REQUIRED_COLUMNS.lng]);
  const record = {
    id: `${clean(row[REQUIRED_COLUMNS.cct]) || "SIN-CCT"}-${index}`,
    cct: clean(row[REQUIRED_COLUMNS.cct]),
    name: clean(row[REQUIRED_COLUMNS.name]),
    type: clean(row[REQUIRED_COLUMNS.type]),
    status: normalize(row[REQUIRED_COLUMNS.status]) || "SIN ESTATUS",
    state: clean(row[REQUIRED_COLUMNS.state]),
    municipality: clean(row[REQUIRED_COLUMNS.municipality]),
    level: clean(row[REQUIRED_COLUMNS.level]),
    control: normalize(row[REQUIRED_COLUMNS.control]),
    lat,
    lng,
    raw: row
  };

  record.searchText = normalize([record.cct, record.name, record.state, record.municipality, record.level, record.type].join(" "));
  return record;
}

function setStatus(message) {
  els.dataStatus.textContent = message;
}

// Carga de datos: primero busca los CSV en /data y en la raiz; si no existen,
// el usuario puede subirlos manualmente desde el selector de archivos.
async function loadAutomaticCsvs() {
  if (!window.Papa) {
    setStatus("No se pudo cargar PapaParse. Revisa la conexion o usa archivos locales.");
    return;
  }

  const groupedFiles = [[CSV_FILES[0], CSV_FILES[2]], [CSV_FILES[1], CSV_FILES[3]]];
  const foundFiles = [];

  for (const candidates of groupedFiles) {
    const available = await findFirstAvailable(candidates);
    if (available) foundFiles.push(available);
  }

  if (!foundFiles.length) {
    setStatus("Coloca los CSV en /data o seleccionalos manualmente.");
    return;
  }

  state.records = [];
  let loaded = 0;
  for (const url of foundFiles) {
    loaded += await parseCsvSource(url);
    setStatus(`Cargando datos: ${state.records.length.toLocaleString("es-MX")} registros`);
  }

  afterDataLoaded(loaded);
}

async function findFirstAvailable(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return url;
    } catch {
      // Algunos servidores estaticos no soportan HEAD; probamos con GET al parsear.
    }
  }
  return null;
}

function parseCsvSource(source) {
  return new Promise((resolve, reject) => {
    let loaded = 0;
    window.Papa.parse(source, {
      download: typeof source === "string",
      header: true,
      skipEmptyLines: true,
      worker: true,
      step(results) {
        const record = normalizeRecord(results.data, state.records.length);
        state.records.push(record);
        loaded += 1;
      },
      complete() { resolve(loaded); },
      error(error) { reject(error); }
    });
  });
}

function afterDataLoaded(loaded) {
  if (!loaded) {
    setStatus("No se encontraron registros en los CSV.");
    return;
  }
  setStatus(`${state.records.length.toLocaleString("es-MX")} registros cargados`);
  populateFilters();
  applyFilters();
}

function populateFilters() {
  fillSelect(els.stateFilter, uniqueValues("state"), "Todos los estados");
  fillSelect(els.levelFilter, uniqueValues("level"), "Todos los niveles");
  fillSelect(els.typeFilter, uniqueValues("type"), "Todos los tipos");
  updateMunicipalities();
}

function fillSelect(select, values, placeholder) {
  const currentValue = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = values.includes(currentValue) ? currentValue : "";
}

function uniqueValues(key) {
  return [...new Set(state.records.map((record) => record[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

function updateMunicipalities() {
  const rows = state.filters.state ? state.records.filter((record) => record.state === state.filters.state) : state.records;
  const values = [...new Set(rows.map((record) => record.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  fillSelect(els.municipalityFilter, values, "Todos los municipios");
}

// Logica de filtrado: trabaja sobre datos normalizados para acelerar busquedas
// repetidas en catalogos grandes y limita el render para mantener fluida la UI.
function applyFilters() {
  const query = normalize(state.filters.query);
  const filtered = [];

  for (const record of state.records) {
    if (!state.filters.includeInactive && record.status !== "ACTIVO") continue;
    if (query && !record.searchText.includes(query)) continue;
    if (state.filters.state && record.state !== state.filters.state) continue;
    if (state.filters.municipality && record.municipality !== state.filters.municipality) continue;
    if (state.filters.level && record.level !== state.filters.level) continue;
    if (state.filters.type && record.type !== state.filters.type) continue;
    if (state.filters.control && record.control !== state.filters.control) continue;
    if (state.filters.onlyWithCoords && !hasCoords(record)) continue;
    filtered.push(record);
  }

  state.filtered = filtered;
  render();
}

function render() {
  els.resultCount.textContent = `${state.filtered.length.toLocaleString("es-MX")} centros encontrados`;
  renderResults();
  renderDetail();
  updateView();
}

function renderResults() {
  els.resultsList.innerHTML = "";
  els.emptyState.hidden = state.filtered.length > 0;
  const fragment = document.createDocumentFragment();
  const visibleRows = state.filtered.slice(0, 120);

  for (const record of visibleRows) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `result-card ${record.id === state.selectedId ? "selected" : ""}`;
    card.dataset.id = record.id;
    card.innerHTML = `
      <div class="result-top">
        <h3 class="result-title">${escapeHtml(readable(record.name, "Centro sin nombre"))}</h3>
        <span class="badge ${record.status !== "ACTIVO" ? "danger" : ""}">${escapeHtml(record.status)}</span>
      </div>
      <div class="result-meta">
        <span>${escapeHtml(readable(record.level))} · ${escapeHtml(readable(record.type))}</span>
        <span>${escapeHtml(readable(record.state))}, ${escapeHtml(readable(record.municipality))}</span>
      </div>
      <div class="badges">
        <span class="badge">${escapeHtml(readable(record.control))}</span>
        <span class="badge">${escapeHtml(readable(record.cct, "Sin CCT"))}</span>
        ${hasCoords(record) ? '<span class="badge">Con mapa</span>' : ""}
      </div>`;
    fragment.append(card);
  }

  if (state.filtered.length > visibleRows.length) {
    const notice = document.createElement("div");
    notice.className = "result-card";
    notice.innerHTML = `<strong>Mostrando ${visibleRows.length} de ${state.filtered.length.toLocaleString("es-MX")}</strong><span class="result-meta">Usa mas filtros para afinar la consulta.</span>`;
    fragment.append(notice);
  }

  els.resultsList.append(fragment);
}

function renderDetail() {
  const selected = state.filtered.find((record) => record.id === state.selectedId);
  if (!selected) {
    els.detailPanel.innerHTML = `<div class="detail-empty"><span>Selecciona una escuela</span><p>Veras aqui la informacion completa disponible del centro de trabajo.</p></div>`;
    return;
  }

  const allFields = Object.entries(selected.raw)
    .filter(([, value]) => clean(value))
    .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");

  els.detailPanel.innerHTML = `
    <h2>${escapeHtml(readable(selected.name, "Centro sin nombre"))}</h2>
    <p class="detail-subtitle">${escapeHtml(readable(selected.cct, "Sin CCT"))}</p>
    <div class="badges">
      <span class="badge ${selected.status !== "ACTIVO" ? "danger" : ""}">${escapeHtml(selected.status)}</span>
      <span class="badge">${escapeHtml(readable(selected.control))}</span>
      ${hasCoords(selected) ? '<span class="badge">Ubicacion disponible</span>' : ""}
    </div>
    <dl class="detail-grid">
      <div><dt>Nivel educativo</dt><dd>${escapeHtml(readable(selected.level))}</dd></div>
      <div><dt>Tipo de centro</dt><dd>${escapeHtml(readable(selected.type))}</dd></div>
      <div><dt>Estado</dt><dd>${escapeHtml(readable(selected.state))}</dd></div>
      <div><dt>Municipio</dt><dd>${escapeHtml(readable(selected.municipality))}</dd></div>
      <div><dt>Latitud</dt><dd>${escapeHtml(readable(selected.lat))}</dd></div>
      <div><dt>Longitud</dt><dd>${escapeHtml(readable(selected.lng))}</dd></div>
      ${allFields}
    </dl>`;
}

function updateView() {
  const showMap = state.currentView === "map";
  els.resultsList.hidden = showMap;
  els.mapPanel.hidden = !showMap;
  els.listViewButton.classList.toggle("active", !showMap);
  els.mapViewButton.classList.toggle("active", showMap);
  if (showMap) window.setTimeout(renderMap, 0);
}

function renderMap() {
  if (!window.L) {
    setStatus("Leaflet no esta disponible. La lista sigue funcionando.");
    return;
  }

  if (!state.map) {
    state.map = window.L.map("map").setView([23.6345, -102.5528], 5);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap"
    }).addTo(state.map);
    state.markerLayer = window.L.layerGroup().addTo(state.map);
  }

  state.markerLayer.clearLayers();
  const rows = state.filtered.filter(hasCoords).slice(0, 500);
  const bounds = [];

  for (const record of rows) {
    const marker = window.L.circleMarker([record.lat, record.lng], {
      radius: 7,
      color: record.control === "PRIVADO" ? "#1f78d1" : "#0b6f76",
      fillColor: record.control === "PRIVADO" ? "#1f78d1" : "#0b6f76",
      fillOpacity: 0.78,
      weight: 2
    });
    marker.bindPopup(`<strong>${escapeHtml(readable(record.name))}</strong><br>${escapeHtml(readable(record.cct))}`);
    marker.on("click", () => {
      state.selectedId = record.id;
      renderDetail();
      renderResults();
    });
    marker.addTo(state.markerLayer);
    bounds.push([record.lat, record.lng]);
  }

  state.map.invalidateSize();
  if (bounds.length) state.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
}

function hasCoords(record) {
  return Number.isFinite(record.lat) && Number.isFinite(record.lng);
}

function escapeHtml(value) {
  return clean(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function wireEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.filters.query = els.searchInput.value;
    applyFilters();
  });

  els.searchInput.addEventListener("input", debounce((event) => {
    state.filters.query = event.target.value;
    applyFilters();
  }));

  els.stateFilter.addEventListener("change", (event) => {
    state.filters.state = event.target.value;
    state.filters.municipality = "";
    updateMunicipalities();
    applyFilters();
  });
  els.municipalityFilter.addEventListener("change", (event) => { state.filters.municipality = event.target.value; applyFilters(); });
  els.levelFilter.addEventListener("change", (event) => { state.filters.level = event.target.value; applyFilters(); });
  els.typeFilter.addEventListener("change", (event) => { state.filters.type = event.target.value; applyFilters(); });
  els.controlFilter.addEventListener("change", (event) => { state.filters.control = event.target.value; applyFilters(); });
  els.includeInactive.addEventListener("change", (event) => { state.filters.includeInactive = event.target.checked; applyFilters(); });

  els.resultsList.addEventListener("click", (event) => {
    const card = event.target.closest(".result-card[data-id]");
    if (!card) return;
    state.selectedId = card.dataset.id;
    render();
  });

  els.quickFilters.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-quick]");
    if (!chip) return;
    const quick = chip.dataset.quick;

    if (quick === "active") {
      state.filters.includeInactive = !state.filters.includeInactive;
      els.includeInactive.checked = state.filters.includeInactive;
      chip.classList.toggle("active", !state.filters.includeInactive);
    }

    if (quick === "public" || quick === "private") {
      const value = quick === "public" ? "PUBLICO" : "PRIVADO";
      state.filters.control = state.filters.control === value ? "" : value;
      els.controlFilter.value = state.filters.control;
      document.querySelector('[data-quick="public"]').classList.toggle("active", state.filters.control === "PUBLICO");
      document.querySelector('[data-quick="private"]').classList.toggle("active", state.filters.control === "PRIVADO");
    }

    if (quick === "map") {
      state.filters.onlyWithCoords = !state.filters.onlyWithCoords;
      chip.classList.toggle("active", state.filters.onlyWithCoords);
    }

    applyFilters();
  });

  els.clearFilters.addEventListener("click", () => {
    state.filters = { query: "", state: "", municipality: "", level: "", type: "", control: "", includeInactive: false, onlyWithCoords: false };
    els.searchInput.value = "";
    els.stateFilter.value = "";
    els.levelFilter.value = "";
    els.typeFilter.value = "";
    els.controlFilter.value = "";
    els.includeInactive.checked = false;
    document.querySelectorAll(".chip").forEach((chip) => chip.classList.remove("active"));
    document.querySelector('[data-quick="active"]').classList.add("active");
    updateMunicipalities();
    applyFilters();
  });

  els.csvFiles.addEventListener("change", async (event) => {
    const files = [...event.target.files].filter((file) => file.name.toLowerCase().endsWith(".csv"));
    if (!files.length) return;
    state.records = [];
    for (const file of files) {
      setStatus(`Cargando ${file.name}`);
      await parseCsvSource(file);
    }
    afterDataLoaded(state.records.length);
  });

  els.listViewButton.addEventListener("click", () => { state.currentView = "list"; updateView(); });
  els.mapViewButton.addEventListener("click", () => { state.currentView = "map"; updateView(); });
  els.themeToggle.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  });
}

wireEvents();
loadAutomaticCsvs().catch((error) => {
  console.error(error);
  setStatus("No se pudieron cargar automaticamente los CSV. Usa el selector manual.");
});
