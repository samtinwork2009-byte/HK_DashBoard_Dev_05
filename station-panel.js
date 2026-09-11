/* station-panel.js — Side-panel UI for station detail, tries HKO historical endpoints then falls back to synthesis.
   Features: open(stationId), fetchHistory, render chart, populate table, export CSV.
*/
"use strict";

const HKO_BASE = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";

window.StationPanel = (function () {
  const panel = document.getElementById("station-panel");
  const titleEl = document.getElementById("station-panel-title");
  const metaEl = document.getElementById("station-panel-meta");
  const rowsEl = document.getElementById("station-panel-rows");
  const exportBtn = document.getElementById("station-export");
  const refreshBtn = document.getElementById("station-refresh");
  const formatSel = document.getElementById("station-format");
  const unitBtn = document.getElementById("station-unit-toggle");
  let unit = "C";
  const closeBtn = document.getElementById("station-panel-close");
  const chartCanvas = document.getElementById("station-panel-chart");
  let chart = null;
  let lastData = null;
  let currentStation = null;

  function show() {
    panel.style.transform = "translateX(0)";
  }
  function hide() {
    panel.style.transform = "translateX(100%)";
  }

  async function fetchHistoricCandidates(stationId, fromISO, toISO) {
    // Candidate endpoints to try; these are best-effort guesses — HKO historical APIs vary.
    const candidates = [
      `${HKO_BASE}?dataType=historicalObs&station=${encodeURIComponent(stationId)}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&lang=tc`,
      `${HKO_BASE}?dataType=historic&station=${encodeURIComponent(stationId)}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&lang=tc`,
      `${HKO_BASE}?dataType=obs&station=${encodeURIComponent(stationId)}&lang=tc`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const j = await res.json();
        // simple heuristics to check shape
        if (j && (j.data || j.observations || j.items || j.temperature))
          return { url, data: j };
      } catch (e) {
        /*try next*/
      }
    }
    return null;
  }

  async function fetchFallbackRHR() {
    try {
      const res = await fetch(`${HKO_BASE}?dataType=rhrread&lang=tc`);
      if (!res.ok) throw new Error("rhrread HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("rhrread fallback failed", e);
      return null;
    }
  }

  function synthHistoryFromRHR(stationId, rhr, points = 24) {
    const temps = rhr?.temperature?.data || [];
    const recTime = rhr?.temperature?.recordTime
      ? new Date(rhr.temperature.recordTime)
      : new Date();
    let base = temps.find(
      (t) =>
        (t.place || "").includes(stationId) ||
        (t.place_ch || "").includes(stationId),
    );
    let baseVal = base
      ? Number(base.value)
      : temps.length
        ? Number(temps[0].value)
        : 26;
    const out = [];
    for (let i = points - 1; i >= 0; i--) {
      const t = new Date(recTime.getTime() - i * 60 * 60 * 1000);
      const jitter = Math.sin(i * 0.7) * 0.5 + (Math.random() - 0.5) * 0.4;
      out.push({
        t: t.toISOString(),
        v: Math.round((baseVal + jitter) * 10) / 10,
      });
    }
    return out;
  }

  function renderChart(timeseries) {
    if (!chartCanvas) return;
    const labels = timeseries.map((p) =>
      new Date(p.t).toLocaleString("zh-HK", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    const data = timeseries.map((p) => p.v);
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update();
      return;
    }
    chart = new Chart(chartCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "溫度 (°C)",
            data,
            borderColor: "rgba(96,165,250,1)",
            backgroundColor: "rgba(96,165,250,0.08)",
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  }

  function renderTable(timeseries) {
    rowsEl.innerHTML = "";
    timeseries
      .slice()
      .reverse()
      .forEach((p) => {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        td1.style.padding = "6px";
        td1.textContent = new Date(p.t).toLocaleString("zh-HK");
        const td2 = document.createElement("td");
        td2.style.padding = "6px";
        td2.style.textAlign = "right";
        td2.textContent = p.v !== undefined ? p.v : "--";
        tr.appendChild(td1);
        tr.appendChild(td2);
        rowsEl.appendChild(tr);
      });
  }

  function exportCSV(timeseries, stationId) {
    const fmt = formatSel ? formatSel.value : "csv";
    if (fmt === "json") {
      const json = JSON.stringify(timeseries);
      const blob = new Blob([json], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${stationId.replace(/\s/g, "_")}_timeseries.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    const hdr = "timestamp,temperature\n";
    const csv = hdr + timeseries.map((p) => `${p.t},${p.v}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stationId.replace(/\s/g, "_")}_timeseries.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function loadAndRender(stationId) {
    currentStation = stationId;
    titleEl.textContent = stationId;
    metaEl.textContent = "載入資料…";

    // try historical endpoints for past 24h
    const toISO = new Date().toISOString();
    const fromISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const cand = await fetchHistoricCandidates(stationId, fromISO, toISO);
    let timeseries = null;
    if (cand) {
      // attempt to normalize
      const j = cand.data;
      // many shapes possible — try common keys
      if (j.data && Array.isArray(j.data))
        timeseries = j.data.map((it) => ({
          t: it.time || it.timestamp || it.t || it.obsTime || it.dateTime,
          v: Number(it.value || it.temp || it.temperature || it.t) || null,
        }));
      else if (j.observations && Array.isArray(j.observations))
        timeseries = j.observations.map((it) => ({
          t: it.obsTime || it.time,
          v: Number(it.temperature),
        }));
      else if (j.items && Array.isArray(j.items))
        timeseries = j.items.map((it) => ({
          t: it.issued || it.time || it.t,
          v: Number(it.temp || it.value),
        }));
    }

    if (!timeseries || !timeseries.length) {
      // fallback to rhrread synthesis
      const rhr = await fetchFallbackRHR();
      timeseries = synthHistoryFromRHR(stationId, rhr, 24);
      metaEl.textContent = "使用 rhrread 合成最近 24 小時";
    } else {
      metaEl.textContent = "使用 HKO 歷史資料";
    }

    lastData = timeseries;
    // apply unit conversion for display
    const displaySeries = timeseries.map((p) => ({
      t: p.t,
      v: unit === "C" ? p.v : Math.round(((p.v * 9) / 5 + 32) * 10) / 10,
    }));
    renderChart(displaySeries);
    renderTable(displaySeries);

    exportBtn.onclick = () => exportCSV(displaySeries, stationId);
    refreshBtn.onclick = () => loadAndRender(stationId);
    if (unitBtn)
      unitBtn.onclick = () => {
        unit = unit === "C" ? "F" : "C";
        unitBtn.textContent = unit === "C" ? "°C" : "°F";
        const ds = lastData.map((p) => ({
          t: p.t,
          v: unit === "C" ? p.v : Math.round(((p.v * 9) / 5 + 32) * 10) / 10,
        }));
        renderChart(ds);
        renderTable(ds);
      };
  }

  function open(stationId) {
    show();
    loadAndRender(stationId);
  }
  function close() {
    hide();
  }

  if (closeBtn) closeBtn.addEventListener("click", close);

  return { open, close };
})();
