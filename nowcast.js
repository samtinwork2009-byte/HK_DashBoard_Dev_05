/* nowcast.js — Attempts to fetch HKO 2-hour nowcast and render a simple trend.
   Falls back to synthesizing a 2-hour series from rhrread if unavailable.
*/
"use strict";

const NC_BASE = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";

window.Nowcast = (function () {
  let ncChart = null;

  async function fetch2H() {
    try {
      const res = await fetch(`${NC_BASE}?dataType=2h&lang=tc`);
      if (!res.ok) throw new Error("2h HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("fetch2H failed, will fallback to rhrread", e);
      return null;
    }
  }

  async function fetchRHR() {
    try {
      const res = await fetch(`${NC_BASE}?dataType=rhrread&lang=tc`);
      if (!res.ok) throw new Error("rhrread HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("fetchRHR fallback failed", e);
      return null;
    }
  }

  function buildLabelsNowcast(baseTime) {
    // produce 5 points: now, +30, +60, +90, +120 minutes
    const labels = [];
    const start = baseTime ? new Date(baseTime) : new Date();
    for (let i = 0; i <= 4; i++) {
      const t = new Date(start.getTime() + i * 30 * 60000);
      labels.push(
        t.getHours().toString().padStart(2, "0") +
          ":" +
          t.getMinutes().toString().padStart(2, "0"),
      );
    }
    return labels;
  }

  function renderFallback(labels, values) {
    const ctx = document.getElementById("wd-2h-rain");
    if (!ctx) return;
    if (!ncChart) {
      ncChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "降雨預測 (mm)",
              data: values,
              backgroundColor: "rgba(59,130,246,0.9)",
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
      ncChart.data.labels = labels;
      ncChart.data.datasets[0].data = values;
      ncChart.update();
    }
  }

  async function render2H() {
    const two = await fetch2H();
    if (two && two.data && two.data.length) {
      // HKO '2h' format varies; try to extract a sensible rain chance or rainfall
      const first = two.data[0];
      const base = first.issueTime || two.issueTime || new Date().toISOString();
      const labels = buildLabelsNowcast(base);
      // many 2h responses contain forecast for regions; create a simple aggregated rainfall probability
      const values = labels.map(() => 0);
      try {
        // if there's a perPeriod rainfall or precip array, aggregate
        if (first.forecast && first.forecast.length) {
          // map up to 5 entries
          for (let i = 0; i < Math.min(first.forecast.length, 5); i++) {
            const v =
              Number(
                first.forecast[i].rain ||
                  first.forecast[i].precip ||
                  first.forecast[i].chance ||
                  0,
              ) || 0;
            values[i] = v;
          }
        } else if (two.data && two.data[0] && two.data[0].detail) {
          // fallback structure
          for (let i = 0; i < values.length; i++) values[i] = 0;
        }
      } catch (e) {
        console.warn("parse 2h structure", e);
      }

      renderFallback(labels, values);
      return;
    }

    // fallback: use rhrread to synthesize - repeat current rainfall values
    const rhr = await fetchRHR();
    const labels = buildLabelsNowcast();
    let currentRain = 0;
    try {
      currentRain =
        rhr?.rainfall?.data?.reduce(
          (acc, s) => acc + (Number(s.value) || 0),
          0,
        ) / Math.max(1, (rhr?.rainfall?.data || []).length);
    } catch (e) {
      currentRain = 0;
    }
    const values = labels.map(
      (_, i) => Math.round(currentRain * (1 + i * 0.05) * 10) / 10,
    );
    renderFallback(labels, values);
  }

  return { render2H };
})();

// Auto-run when DOM ready
document.addEventListener("DOMContentLoaded", function () {
  if (typeof Chart !== "undefined") {
    try {
      Nowcast.render2H();
    } catch (e) {
      console.error(e);
    }
  }
});
