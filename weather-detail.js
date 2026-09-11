/* weather-detail.js — Weather detail scaffold: multi-city, charts, maps
   Fetches core HKO endpoints and renders simple Chart.js visualizations.
*/
"use strict";

const WD_BASE = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";

window.WeatherDetail = (function () {
  let rainChart = null;
  let tempChart = null;

  function formatHourLabels(hours) {
    return hours.map((h) => (h < 10 ? "0" + h : h) + ":00");
  }

  async function fetchRHR() {
    try {
      const res = await fetch(`${WD_BASE}?dataType=rhrread&lang=tc`);
      if (!res.ok) throw new Error("rhrread HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.error("fetchRHR error", e);
      return null;
    }
  }

  async function fetchFND() {
    try {
      const res = await fetch(`${WD_BASE}?dataType=fnd&lang=tc`);
      if (!res.ok) throw new Error("fnd HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.error("fetchFND error", e);
      return null;
    }
  }

  function render2HRain(rhr) {
    const ctx = document.getElementById("wd-2h-rain");
    if (!ctx || !rhr) return;
    const canvasChart =
      typeof Chart !== "undefined" && typeof Chart.getChart === "function"
        ? Chart.getChart(ctx)
        : null;
    if (canvasChart && !rainChart) rainChart = canvasChart;
    if (rainChart && rainChart.canvas !== ctx) {
      rainChart.destroy();
      rainChart = null;
    }
    // Construct hourly buckets from station rainfall if available
    const buckets = [];
    const labels = [];
    // try to use rhr.rainfall.data which has place and value
    const rainArr = rhr.rainfall?.data || [];
    // We'll show top 6 stations by rainfall as sample
    const top = rainArr
      .slice()
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 6);
    top.forEach((s) => {
      labels.push(s.place || s.place_ch || "站");
      buckets.push(s.value || 0);
    });

    if (!rainChart) {
      rainChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "過去一小時降雨量 (mm)",
              data: buckets,
              backgroundColor: "rgba(96,165,250,0.9)",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } },
        },
      });
    } else {
      rainChart.data.labels = labels;
      rainChart.data.datasets[0].data = buckets;
      rainChart.update();
    }
  }

  function renderHourlyTemp(rhr) {
    const ctx = document.getElementById("wd-hourly-temp");
    if (!ctx || !rhr) return;
    const canvasChart =
      typeof Chart !== "undefined" && typeof Chart.getChart === "function"
        ? Chart.getChart(ctx)
        : null;
    if (canvasChart && !tempChart) tempChart = canvasChart;
    if (tempChart && tempChart.canvas !== ctx) {
      tempChart.destroy();
      tempChart = null;
    }
    // Build a simple hourly series from temperature stations median
    const temps = rhr.temperature?.data || [];
    if (!temps.length) return;
    // pick 6 representative stations
    const sample = temps.slice(0, 6);
    const labels = sample.map((s) => s.place || s.place_ch || "站");
    const values = sample.map((s) => parseFloat(s.value) || 0);

    if (!tempChart) {
      tempChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "現在溫度 (°C)",
              data: values,
              borderColor: "rgba(125,211,252,1)",
              tension: 0.3,
              fill: true,
              backgroundColor: "rgba(125,211,252,0.08)",
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    } else {
      tempChart.data.labels = labels;
      tempChart.data.datasets[0].data = values;
      tempChart.update();
    }
  }

  async function fetchAndRender() {
    const rhr = await fetchRHR();
    const fnd = await fetchFND();
    render2HRain(rhr || {});
    renderHourlyTemp(rhr || {});
    renderStationCards(rhr || {});
    renderRainGrid(rhr || {});
    renderAQHI();
    renderSunTide(fnd || {}, rhr || {});
    // Update textual forecast summary using fnd.generalSituation
    const gen = fnd?.generalSituation || "";
    const el = document.getElementById("w-general");
    if (el && gen) el.textContent = gen;
    // hide empty cards to reduce clutter
    hideEmptyCards();
  }

  /* Render station temperature cards into #w-temps */
  function renderStationCards(rhr) {
    const container = document.getElementById("w-temps");
    if (!container) return;
    const temps = rhr.temperature?.data || [];
    if (!temps.length) {
      container.innerHTML = '<div class="skel skel-p"></div>';
      return;
    }
    // pick top 12 by temperature
    const sample = temps
      .slice()
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      .slice(0, 12);
    container.innerHTML = "";
    sample.forEach((s, idx) => {
      const name = s.place || s.place_ch || "站";
      const val = s.value !== undefined ? s.value : "--";
      const card = document.createElement("div");
      card.className = "station-card";
      card.innerHTML = `<div class="st-name">${name}</div><div class="st-temp">${val}°C</div><canvas id="st-spark-${idx}" class="st-spark"></canvas>`;
      container.appendChild(card);
      // small sparkline using synthetic series
      const canvas = card.querySelector("canvas");
      if (canvas && typeof Chart !== "undefined") {
        const base = Number(val) || 26;
        const ts = [];
        const labels = [];
        for (let i = 7; i >= 0; i--) {
          const t = new Date(Date.now() - i * 3600 * 1000);
          labels.push("");
          ts.push(
            Math.round(
              (base + Math.sin(i * 0.6) * 0.6 + (Math.random() - 0.5) * 0.4) *
                10,
            ) / 10,
          );
        }
        try {
          new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
              labels,
              datasets: [
                {
                  data: ts,
                  borderColor: "rgba(125,211,252,1)",
                  backgroundColor: "rgba(125,211,252,0.06)",
                  tension: 0.25,
                  fill: true,
                },
              ],
            },
            options: {
              responsive: false,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { x: { display: false }, y: { display: false } },
            },
          });
        } catch (e) {
          /* ignore */
        }
      }
    });
  }

  /* Render rainfall heat tiles into #w-rain */
  function renderRainGrid(rhr) {
    const container = document.getElementById("w-rain");
    if (!container) return;
    const rain = rhr.rainfall?.data || [];
    if (!rain.length) {
      container.innerHTML = '<div class="skel skel-p"></div>';
      return;
    }
    container.innerHTML = "";
    rain
      .slice()
      .sort(
        (a, b) => Number(b.max || b.value || 0) - Number(a.max || a.value || 0),
      )
      .forEach((s) => {
        const place = s.place || s.place_ch || "區";
        const mm = Number(s.max ?? s.value ?? s.max) || 0;
        let cls = "heat-low";
        if (mm >= 10) cls = "heat-high";
        else if (mm >= 3) cls = "heat-med";
        const tile = document.createElement("div");
        tile.className = `heat-tile ${cls}`;
        tile.innerHTML = `<div class="heat-place">${place}</div><div class="heat-val" style="font-size:1.4rem">${mm} mm</div><div class="heat-small">過去一小時</div>`;
        container.appendChild(tile);
      });
  }

  /* Render AQHI using Environment.fetchAQHI() if available */
  async function renderAQHI() {
    const el = document.getElementById("w-aqhi");
    const desc = document.getElementById("w-aqhi-desc");
    const details = document.getElementById("w-aqhi-details");
    if (!el) return;
    if (window.Environment && typeof Environment.fetchAQHI === "function") {
      try {
        const data = await Environment.fetchAQHI();
        // data format may vary; try to extract index and summary
        const idx = data?.aqhi ?? data?.aqhi_value ?? data?.index ?? null;
        const label =
          data?.label || data?.status || (idx ? `AQHI ${idx}` : "AQHI");
        el.querySelector("div") &&
          (el.querySelector("div").textContent = idx !== null ? idx : "--");
        if (desc)
          desc.textContent =
            data?.conclusion || data?.advice || label || "資料已更新";
        if (details) details.innerHTML = "";
        return;
      } catch (e) {
        console.warn("AQHI render failed", e);
      }
    }
    if (desc) desc.textContent = "AQHI 資料暫不可用";
  }

  /* Render sunrise/sunset and link to tides page for full tide info */
  function renderSunTide(fnd, rhr) {
    // try to extract sunrise/sunset from fnd forecasts
    const elSunrise = document.getElementById("summary-sunrise");
    const elSunset = document.getElementById("summary-sunset");
    if (elSunrise)
      elSunrise.textContent =
        fnd?.sunrise ||
        fnd?.weatherForecast?.[0]?.sunrise ||
        elSunrise.textContent ||
        "--";
    if (elSunset)
      elSunset.textContent =
        fnd?.sunset ||
        fnd?.weatherForecast?.[0]?.sunset ||
        elSunset.textContent ||
        "--";
    // For tides, link to tide page (full tide data available in Tides section)
    const tideEl = document.getElementById("summary-tide");
    if (tideEl)
      tideEl.innerHTML = `<a href="#" onclick="showPage('tides')" style="color:var(--primary)">查看潮汐詳情</a>`;
  }

  /* ── GPS + nearest-station mapping ── */
  const STATION_COORDS = [
    { id: "香港天文台", lat: 22.372, lon: 114.107 },
    { id: "尖沙咀", lat: 22.2968, lon: 114.1722 },
    { id: "旺角", lat: 22.318, lon: 114.169 },
    { id: "中環", lat: 22.281, lon: 114.158 },
    { id: "紅磡", lat: 22.3, lon: 114.182 },
    { id: "大埔", lat: 22.45, lon: 114.169 },
    { id: "天文台", lat: 22.372, lon: 114.107 },
  ];

  function distanceKm(aLat, aLon, bLat, bLon) {
    function toRad(v) {
      return (v * Math.PI) / 180;
    }
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const lat1 = toRad(aLat),
      lat2 = toRad(bLat);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function pickNearestStation(lat, lon) {
    if (!lat || !lon) return null;
    let best = null;
    let bestD = 1e9;
    STATION_COORDS.forEach((s) => {
      const d = distanceKm(lat, lon, s.lat, s.lon);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    });
    return best ? best.id : null;
  }

  async function locateAndApply() {
    // Update summary-location and IP handled elsewhere; here pick station and display local temp
    const locEl = document.getElementById("summary-location");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          if (locEl)
            locEl.textContent = `座標 ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
          const stationName = pickNearestStation(lat, lon);
          if (!stationName) return;
          // fetch rhr to get station data
          const rhr = await fetchRHR();
          const temps = rhr?.temperature?.data || [];
          const s = temps.find(
            (t) =>
              (t.place || "").includes(stationName) ||
              (t.place_ch || "").includes(stationName),
          );
          if (s) {
            // Update homepage summary elements
            const summaryTemp = document.getElementById("summary-temp");
            const desc = document.getElementById("summary-weather-desc");
            const upd = document.getElementById("summary-updated");
            if (summaryTemp)
              summaryTemp.textContent =
                (s.value !== undefined ? s.value : "--") + "°C";
            if (desc)
              desc.textContent =
                rhr?.weatherMain?.[0]?.text || rhr?.icon?.[0] || "";
            if (upd)
              upd.textContent = rhr?.temperature?.recordTime
                ? new Date(rhr.temperature.recordTime).toLocaleTimeString(
                    "zh-HK",
                    { hour12: false },
                  )
                : "";
          }

          // Also update HQ temp as reference
          const hq = temps.find(
            (t) =>
              (t.place || "").includes("香港天文台") ||
              (t.place || "").includes("天文台"),
          );
          if (hq) {
            const htemp = document.getElementById("h-temp");
            if (htemp)
              htemp.textContent = hq.value !== undefined ? hq.value : "--";
          }

          // Update today's hi/lo from fnd
          const fnd = await fetchFND();
          const today = fnd?.weatherForecast?.[0];
          if (today) {
            const hi = today.forecastMaxtemp?.value ?? "--";
            const lo = today.forecastMintemp?.value ?? "--";
            const elHi = document.getElementById("summary-hi");
            const elLo = document.getElementById("summary-lo");
            if (elHi) elHi.textContent = hi !== "--" ? hi + "°C" : "--";
            if (elLo) elLo.textContent = lo !== "--" ? lo + "°C" : "--";
          }
        },
        (err) => {
          if (locEl) locEl.textContent = "GPS 權限未授權";
        },
        { timeout: 8000 },
      );
    } else {
      if (locEl) locEl.textContent = "此裝置不支援 GPS";
    }
  }

  function hideEmptyCards() {
    // Hide cards that have no meaningful data
    const checks = [
      ["w-rain", "潮汐：載入失敗"],
      ["w-temps", ""],
      ["w-warning-details", ""],
    ];
    checks.forEach(([id, emptyText]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const card = el.closest(".card");
      if (!card) return;
      const txt = el.textContent.trim();
      if (!txt || (emptyText && txt.includes(emptyText)))
        card.style.display = "none";
      else card.style.display = "";
    });
  }

  function init() {
    // Bind city selector
    const sel = document.getElementById("wd-city-select");
    if (sel) {
      sel.addEventListener("change", function () {
        // For now, just re-fetch data — multi-city will be implemented with separate HKO feeds
        fetchAndRender();
      });
    }
    // Initial render
    fetchAndRender();
  }

  return { init, fetchAndRender };
})();

// Auto-init when DOM ready
document.addEventListener("DOMContentLoaded", function () {
  if (typeof Chart !== "undefined") {
    try {
      WeatherDetail.init();
    } catch (e) {
      console.error(e);
    }
  } else {
    console.warn("Chart.js not loaded");
  }
});
