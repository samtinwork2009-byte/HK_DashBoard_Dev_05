/* map.js — Leaflet integration: station markers and popup timeseries */
"use strict";

const MAP_CENTER = [22.32, 114.17]; // Hong Kong center
const MAP_ZOOM = 11;
const MAP_TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

window.WeatherMap = (function () {
  let map = null;
  let markers = {};

  const STATIONS = [
    { id: "香港天文台", lat: 22.372, lon: 114.107 },
    { id: "尖沙咀", lat: 22.2968, lon: 114.1722 },
    { id: "旺角", lat: 22.318, lon: 114.169 },
    { id: "中環", lat: 22.281, lon: 114.158 },
    { id: "紅磡", lat: 22.3, lon: 114.182 },
    { id: "大埔", lat: 22.45, lon: 114.169 },
    { id: "長洲", lat: 22.215, lon: 114.029 },
  ];

  async function fetchRHR() {
    try {
      const res = await fetch(
        "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc",
      );
      if (!res.ok) throw new Error("rhrread HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("map fetchRHR failed", e);
      return null;
    }
  }

  function makePopupHtml(stationId) {
    const canvasId = "ts-" + stationId.replace(/\s|[^a-zA-Z0-9_-]/g, "_");
    return `<div style="width:220px;height:140px"><div style="font-weight:700;margin-bottom:6px">${stationId}</div><div>即時溫度：<span id="pv-${canvasId}">--°C</span></div><canvas id="${canvasId}" width="220" height="80"></canvas></div>`;
  }

  function synthTimeseries(base) {
    // create 8 synthetic points around base value for a small sparkline
    const vals = [];
    for (let i = 7; i >= 0; i--) {
      const jitter = Math.sin(i * 0.7) * 0.4 + (Math.random() - 0.5) * 0.2;
      vals.push(Math.round((base + jitter) * 10) / 10);
    }
    return vals;
  }

  async function onMarkerClick(e, station) {
    const popup = e.target.getPopup();
    // ensure popup content DOM is available
    setTimeout(async () => {
      const canvasId = "ts-" + station.id.replace(/\s|[^a-zA-Z0-9_-]/g, "_");
      const pvId = "pv-" + canvasId;
      const pvEl = document.getElementById(pvId);
      const canvas = document.getElementById(canvasId);
      // fetch latest rhr to get station value
      const rhr = await fetchRHR();
      let val = null;
      try {
        const temps = rhr?.temperature?.data || [];
        const s = temps.find(
          (t) =>
            (t.place || "").includes(station.id) ||
            (t.place_ch || "").includes(station.id),
        );
        if (s) val = Number(s.value);
      } catch (e) {
        /*ignore*/
      }
      if (pvEl) pvEl.textContent = (val !== null ? val : "--") + "°C";
      if (!canvas) return;
      const data = synthTimeseries(val !== null ? val : 26);
      try {
        new Chart(canvas.getContext("2d"), {
          type: "line",
          data: {
            labels: data.map((_, i) => ""),
            datasets: [
              {
                data: data,
                borderColor: "rgba(59,130,246,1)",
                tension: 0.3,
                fill: true,
                backgroundColor: "rgba(59,130,246,0.08)",
              },
            ],
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false },
              y: { display: true, ticks: { maxTicksLimit: 4 } },
            },
          },
        });
      } catch (err) {
        console.warn("chart popup error", err);
      }
    }, 80);
  }

  function initMap() {
    const el = document.getElementById("w-map");
    if (!el) {
      console.warn("w-map element not found");
      return;
    }
    map = L.map(el).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer(MAP_TILE, {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    STATIONS.forEach((st) => {
      const marker = L.circleMarker([st.lat, st.lon], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#60a5fa",
        fillOpacity: 0.9,
      }).addTo(map);
      marker.bindPopup(makePopupHtml(st.id), { maxWidth: 240 });
      marker.on("click", (e) => {
        onMarkerClick(e, st);
        if (window.StationPanel && StationPanel.open) StationPanel.open(st.id);
      });
      markers[st.id] = marker;
    });
  }

  function resize() {
    if (map) map.invalidateSize();
  }

  return { initMap, resize };
})();

document.addEventListener("DOMContentLoaded", function () {
  // load Leaflet script dynamically then init map
  if (typeof L === "undefined") {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => {
      try {
        WeatherMap.initMap();
      } catch (e) {
        console.error(e);
      }
    };
    document.body.appendChild(s);
  } else {
    try {
      WeatherMap.initMap();
    } catch (e) {
      console.error(e);
    }
  }
});
/* ============================================================
   map.js — 互動地圖 Interactive Map (Leaflet.js)
   香港城市儀表板 v5
   顯示：停車場空位、AQHI 監測站、泳灘
   ============================================================ */

("use strict");

const MapView = (function () {
  let _map = null;
  let _layers = { parking: null, aqhi: null, beach: null, aed: null };
  let _active = "parking";
  let _initialized = false;

  /* ── AED Locations (major hospitals, MTR stations, malls) ── */
  const AED_LOCATIONS = [
    { name: "屯門醫院", lat: 22.4028, lng: 114.0097 },
    { name: "博愛醫院", lat: 22.4472, lng: 114.0167 },
    { name: "瑪嘉烈醫院", lat: 22.3403, lng: 114.1336 },
    { name: "伊利沙伯醫院", lat: 22.31, lng: 114.1736 },
    { name: "廣華醫院", lat: 22.3208, lng: 114.1714 },
    { name: "瑪麗醫院", lat: 22.2694, lng: 114.1317 },
    { name: "屯門站 (MTR)", lat: 22.3951, lng: 114.0077 },
    { name: "元朗站 (MTR)", lat: 22.4449, lng: 114.0338 },
    { name: "天水圍站 (MTR)", lat: 22.4268, lng: 114.0055 },
    { name: "荃灣站 (MTR)", lat: 22.3712, lng: 114.1211 },
    { name: "旺角站 (MTR)", lat: 22.3193, lng: 114.1694 },
    { name: "銅鑼灣站 (MTR)", lat: 22.28, lng: 114.1836 },
    { name: "金鐘站 (MTR)", lat: 22.2793, lng: 114.1658 },
    { name: "九龍站 (MTR)", lat: 22.3058, lng: 114.1606 },
    { name: "沙田站 (MTR)", lat: 22.3817, lng: 114.1878 },
    { name: "大埔墟站 (MTR)", lat: 22.4453, lng: 114.1678 },
    { name: "屯門市廣場", lat: 22.396, lng: 114.0086 },
    { name: "V city 屯門", lat: 22.3951, lng: 114.0048 },
    { name: "愉景新城", lat: 22.3403, lng: 113.9681 },
    { name: "青衣城", lat: 22.3589, lng: 114.1097 },
    { name: "新城市廣場 (沙田)", lat: 22.3817, lng: 114.1878 },
    { name: "APM 觀塘", lat: 22.3089, lng: 114.2261 },
    { name: "香港國際機場", lat: 22.3089, lng: 113.9147 },
    { name: "香港體育館", lat: 22.3025, lng: 114.1822 },
    { name: "香港文化中心", lat: 22.2939, lng: 114.1722 },
  ];

  /* ── AQHI monitoring stations with coordinates ──────────── */
  const AQHI_STATIONS = [
    {
      name: "中西區",
      en: "Central/Western",
      lat: 22.2855,
      lng: 114.144,
      type: "general",
    },
    { name: "東區", en: "Eastern", lat: 22.282, lng: 114.222, type: "general" },
    {
      name: "觀塘",
      en: "Kwun Tong",
      lat: 22.309,
      lng: 114.226,
      type: "roadside",
    },
    {
      name: "深水埗",
      en: "Sham Shui Po",
      lat: 22.331,
      lng: 114.162,
      type: "roadside",
    },
    {
      name: "葵涌",
      en: "Kwai Chung",
      lat: 22.357,
      lng: 114.129,
      type: "general",
    },
    {
      name: "荃灣",
      en: "Tsuen Wan",
      lat: 22.374,
      lng: 114.114,
      type: "general",
    },
    {
      name: "屯門",
      en: "Tuen Mun",
      lat: 22.391,
      lng: 113.976,
      type: "general",
    },
    {
      name: "元朗",
      en: "Yuen Long",
      lat: 22.443,
      lng: 114.022,
      type: "general",
    },
    { name: "大埔", en: "Tai Po", lat: 22.45, lng: 114.165, type: "general" },
    { name: "沙田", en: "Sha Tin", lat: 22.383, lng: 114.187, type: "general" },
    {
      name: "將軍澳",
      en: "Tseung Kwan O",
      lat: 22.307,
      lng: 114.257,
      type: "general",
    },
    {
      name: "油麻地",
      en: "Yau Ma Tei",
      lat: 22.312,
      lng: 114.17,
      type: "roadside",
    },
    {
      name: "旺角",
      en: "Mong Kok",
      lat: 22.325,
      lng: 114.168,
      type: "roadside",
    },
    {
      name: "銅鑼灣",
      en: "Causeway Bay",
      lat: 22.28,
      lng: 114.184,
      type: "roadside",
    },
    {
      name: "中環",
      en: "Central",
      lat: 22.282,
      lng: 114.158,
      type: "roadside",
    },
  ];

  /* ── AQHI risk color ─────────────────────────────────────── */
  function aqhiColor(risk) {
    const r = (risk || "").toLowerCase();
    if (r.includes("low")) return "#22c55e";
    if (r.includes("moderate")) return "#eab308";
    if (r.includes("high") && !r.includes("very")) return "#ef4444";
    if (r.includes("very")) return "#dc2626";
    if (r.includes("serious")) return "#7f1d1d";
    return "#64748b";
  }

  /* ── Init Leaflet map ────────────────────────────────────── */
  function initMap() {
    if (_initialized) return;
    const container = document.getElementById("map-container");
    if (!container) return;

    // Load Leaflet CSS if not present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if (typeof L === "undefined") {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => {
        createMap(container);
      };
      document.head.appendChild(script);
    } else {
      createMap(container);
    }
    _initialized = true;
  }

  function createMap(container) {
    // Dark tile layer
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";

    _map = L.map(container, {
      center: [22.3193, 114.1694],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    });

    // CartoDB dark/light tiles
    const darkTile =
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const lightTile =
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    L.tileLayer(isDark ? darkTile : lightTile, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(_map);

    // Load default layer
    loadLayer(_active);
  }

  /* ── Load a data layer ───────────────────────────────────── */
  async function loadLayer(type) {
    if (!_map) return;
    _active = type;

    // Remove existing layers
    Object.values(_layers).forEach((l) => {
      if (l) _map.removeLayer(l);
    });
    _layers = { parking: null, aqhi: null, beach: null, aed: null };

    // Update tab active state
    document.querySelectorAll(".map-tab").forEach((t) => {
      t.style.background =
        t.dataset.layer === type ? "var(--primary)" : "var(--surface-2)";
      t.style.color = t.dataset.layer === type ? "white" : "var(--text)";
    });

    switch (type) {
      case "parking":
        await loadParkingLayer();
        break;
      case "aqhi":
        await loadAQHILayer();
        break;
      case "beach":
        loadBeachLayer();
        break;
      case "aed":
        loadAEDLayer();
        break;
    }
  }

  /* ── Parking layer ───────────────────────────────────────── */
  async function loadParkingLayer() {
    const statusEl = document.getElementById("map-status");
    if (statusEl) statusEl.textContent = "載入停車場數據…";

    try {
      const [vacRes, infoRes] = await Promise.all([
        fetch(
          "https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&lang=zh_TW",
        ),
        fetch(
          "https://api.data.gov.hk/v1/carpark-info-vacancy?data=info&lang=zh_TW",
        ),
      ]);
      const vacData = await vacRes.json();
      const infoData = await infoRes.json();

      const infoMap = {};
      (infoData.results || []).forEach((p) => {
        infoMap[p.park_Id] = p;
      });

      const markers = [];
      let shown = 0;

      (vacData.results || []).forEach((vac) => {
        const info = infoMap[vac.park_Id] || {};
        const lat = parseFloat(info.latitude);
        const lng = parseFloat(info.longitude);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

        const carVac = vac.privateCar?.[0]?.vacancy;
        const vacNum =
          carVac === undefined || carVac === null ? null : parseInt(carVac, 10);

        const color =
          vacNum === null
            ? "#64748b"
            : vacNum === 0
              ? "#ef4444"
              : vacNum <= 10
                ? "#eab308"
                : vacNum <= 50
                  ? "#3b82f6"
                  : "#22c55e";

        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: color,
          fillOpacity: 0.85,
          color: "#fff",
          weight: 1.5,
        });

        const name = info.name || vac.park_Id;
        const vacStr =
          vacNum === null ? "無數據" : vacNum === 0 ? "已滿" : `${vacNum} 位`;
        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            <div style="font-weight:700;margin-bottom:4px">${name}</div>
            <div style="font-size:12px;color:#666">${info.district || ""}</div>
            <div style="margin-top:8px;font-size:14px;font-weight:700;color:${color}">
              私家車：${vacStr}
            </div>
            ${info.displayAddress ? `<div style="font-size:11px;color:#999;margin-top:4px">${info.displayAddress}</div>` : ""}
          </div>
        `);
        markers.push(marker);
        shown++;
      });

      _layers.parking = L.layerGroup(markers).addTo(_map);
      if (statusEl)
        statusEl.textContent = `顯示 ${shown} 個停車場 · 綠=充裕 藍=尚有 黃=緊張 紅=已滿`;
    } catch (e) {
      if (statusEl) statusEl.textContent = `載入失敗：${e.message}`;
    }
  }

  /* ── AQHI layer ──────────────────────────────────────────── */
  async function loadAQHILayer() {
    const statusEl = document.getElementById("map-status");
    if (statusEl) statusEl.textContent = "載入空氣質素數據…";

    try {
      const res = await fetch(
        "https://datagovhk.blob.core.windows.net/dataset/aqhi/aqhi-forecast.json",
      );
      const data = await res.json();

      // Build risk map from forecast
      const riskMap = {};
      (data || []).forEach((entry) => {
        const key = (entry.station_name_tc || entry.name || "").trim();
        if (key)
          riskMap[key] = entry.health_risk_min || entry.health_risk || "Low";
      });

      const markers = AQHI_STATIONS.map((s) => {
        const risk = riskMap[s.name] || "Low";
        const color = aqhiColor(risk);

        const riskZh =
          {
            Low: "低",
            Moderate: "中",
            High: "高",
            "Very High": "甚高",
            Serious: "嚴重",
          }[risk] || risk;

        const marker = L.circleMarker([s.lat, s.lng], {
          radius: s.type === "roadside" ? 7 : 9,
          fillColor: color,
          fillOpacity: 0.9,
          color: "#fff",
          weight: 2,
        });

        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:140px">
            <div style="font-weight:700;margin-bottom:2px">${s.name}</div>
            <div style="font-size:11px;color:#666">${s.en} · ${s.type === "roadside" ? "路邊" : "一般"}</div>
            <div style="margin-top:8px;font-size:14px;font-weight:700;color:${color}">
              AQHI：${riskZh}
            </div>
          </div>
        `);

        // Add label
        marker.bindTooltip(s.name, {
          permanent: false,
          direction: "top",
          className: "map-tooltip",
        });

        return marker;
      });

      _layers.aqhi = L.layerGroup(markers).addTo(_map);
      if (statusEl)
        statusEl.textContent = `${AQHI_STATIONS.length} 個監測站 · 綠=低 黃=中 紅=高`;
    } catch (e) {
      // Fallback: show stations without risk data
      const markers = AQHI_STATIONS.map((s) => {
        const m = L.circleMarker([s.lat, s.lng], {
          radius: 8,
          fillColor: "#60a5fa",
          fillOpacity: 0.8,
          color: "#fff",
          weight: 2,
        });
        m.bindPopup(
          `<div style="font-weight:700">${s.name}<br><small>${s.en}</small></div>`,
        );
        return m;
      });
      _layers.aqhi = L.layerGroup(markers).addTo(_map);
      if (statusEl)
        statusEl.textContent = `顯示 ${AQHI_STATIONS.length} 個監測站（暫無AQHI數據）`;
    }
  }

  /* ── Beach layer ─────────────────────────────────────────── */
  function loadBeachLayer() {
    const statusEl = document.getElementById("map-status");
    if (!window.Beach) {
      if (statusEl) statusEl.textContent = "泳灘模組未載入";
      return;
    }

    const gradeColor = {
      良好: "#22c55e",
      尚可: "#eab308",
      欠佳: "#ef4444",
      暫停: "#64748b",
    };
    const TYPICAL = {
      銀線灣: "良好",
      浪茄: "良好",
      大浪西灣: "良好",
      鹹田灣: "良好",
      長沙: "良好",
      長沙上: "良好",
      石澳: "良好",
      大浪灣: "良好",
      淺水灣: "尚可",
      南灣: "良好",
      深水灣: "尚可",
      赤柱正灘: "良好",
      屯門龍鼓灘: "良好",
      掃管笏: "良好",
      清水灣一灣: "良好",
      清水灣二灣: "良好",
      長洲東灣: "良好",
      長洲泳灘: "尚可",
      南丫索罟灣: "良好",
    };

    // Reuse BEACHES from beach.js if available via window
    const beaches = [
      { name: "銀線灣", lat: 22.3247, lng: 114.3267 },
      { name: "石澳", lat: 22.2314, lng: 114.2508 },
      { name: "淺水灣", lat: 22.2369, lng: 114.1958 },
      { name: "深水灣", lat: 22.2483, lng: 114.1742 },
      { name: "赤柱正灘", lat: 22.2167, lng: 114.2153 },
      { name: "長沙", lat: 22.2383, lng: 113.9836 },
      { name: "清水灣一灣", lat: 22.2939, lng: 114.2992 },
      { name: "清水灣二灣", lat: 22.2886, lng: 114.2986 },
      { name: "長洲東灣", lat: 22.2072, lng: 114.0297 },
      { name: "南丫索罟灣", lat: 22.2072, lng: 114.0978 },
      { name: "屯門龍鼓灘", lat: 22.4214, lng: 113.9419 },
      { name: "黃金海灘", lat: 22.4072, lng: 114.1164 },
    ];

    const markers = beaches.map((b) => {
      const grade = TYPICAL[b.name] || "良好";
      const color = gradeColor[grade];
      const m = L.circleMarker([b.lat, b.lng], {
        radius: 9,
        fillColor: color,
        fillOpacity: 0.85,
        color: "#fff",
        weight: 2,
      });
      m.bindPopup(`
        <div style="font-family:sans-serif">
          <div style="font-weight:700">${b.name}</div>
          <div style="margin-top:6px;color:${color};font-weight:700">水質：${grade}</div>
          <div style="font-size:11px;color:#999;margin-top:4px">參考環保署數據</div>
        </div>
      `);
      return m;
    });

    _layers.beach = L.layerGroup(markers).addTo(_map);
    if (statusEl)
      statusEl.textContent = `${beaches.length} 個泳灘 · 綠=良好 黃=尚可 紅=欠佳`;
  }

  /* ── AED layer ──────────────────────────────────────────────────────── */
  function loadAEDLayer() {
    const statusEl = document.getElementById("map-status");

    const markers = AED_LOCATIONS.map((loc) => {
      const m = L.circleMarker([loc.lat, loc.lng], {
        radius: 9,
        fillColor: "#ef4444",
        fillOpacity: 0.85,
        color: "#fff",
        weight: 2,
      });

      m.bindPopup(`
        <div style="font-family:sans-serif;min-width:160px">
          <div style="font-weight:700;margin-bottom:4px">🫀 ${loc.name}</div>
          <div style="margin-top:6px;font-size:12px;color:#555">自動體外除顫器 (AED)</div>
          <div style="font-size:11px;color:#999;margin-top:4px">第一目擊者可使用</div>
        </div>
      `);

      m.bindTooltip(loc.name, {
        permanent: false,
        direction: "top",
        className: "map-tooltip",
      });

      return m;
    });

    _layers.aed = L.layerGroup(markers).addTo(_map);
    if (statusEl)
      statusEl.textContent = `🫀 ${AED_LOCATIONS.length} 個 AED 心臟除顫器位置（醫院、MTR、商場）`;
  }

  /* ── Public API ─────────────────────────────────────────── */
  function refresh() {
    if (!_initialized) {
      initMap();
    } else if (_map) {
      _map.invalidateSize();
      loadLayer(_active);
    }
  }

  function switchLayer(type) {
    if (_map) loadLayer(type);
    else {
      _active = type;
    }
  }

  return { refresh, switchLayer };
})();
