/* ============================================================
   climate.js — 氣候數據 Climate Data
   香港城市儀表板 v4
   ============================================================ */

"use strict";

const Climate = (function () {
  const HKO_BASE =
    "https://data.weather.gov.hk/weatherAPI/opendata/opendata.php";

  const MONTHS_ZH = [
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
  ];
  const MONTHS_EN = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  /* ── HK Climate facts (static reference data) ─────────────── */
  const CLIMATE_FACTS = [
    {
      icon: "🌡",
      label: "歷史最高氣溫 Record High",
      value: "39.0°C",
      sub: "1900年8月19日",
    },
    {
      icon: "❄",
      label: "歷史最低氣溫 Record Low",
      value: "0.0°C",
      sub: "1893年1月18日",
    },
    {
      icon: "🌧",
      label: "年均降雨量 Annual Rainfall",
      value: "2,431 mm",
      sub: "香港天文台 HKO",
    },
    {
      icon: "☀",
      label: "年均日照時數 Annual Sunshine",
      value: "1,836 hrs",
      sub: "香港天文台 HKO",
    },
    {
      icon: "💧",
      label: "最多雨季 Wettest Month",
      value: "6月 June",
      sub: "平均 ~456 mm",
    },
    {
      icon: "🌬",
      label: "熱帶氣旋 Typhoons (annual avg)",
      value: "~5–6 個",
      sub: "5月至11月",
    },
  ];

  /* ── Build SVG sparkline from data array ──────────────────── */
  function buildSparkline(values, width, height, color) {
    if (!values || values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 20) + 10;
      const y = height - 10 - ((v - min) / range) * (height - 20);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const polyline = pts.join(" ");
    // Area fill
    const areaPoints = `10,${height - 10} ${pts.join(" ")} ${(width - 10).toFixed(1)},${height - 10}`;

    return `
      <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="display:block">
        <defs>
          <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon points="${areaPoints}" fill="url(#spkGrad)"/>
        <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${pts
          .map((pt, i) => {
            const [px, py] = pt.split(",").map(Number);
            const isFirst = i === 0;
            const isLast = i === values.length - 1;
            const isMin = values[i] === min;
            const isMax = values[i] === max;
            if (!isFirst && !isLast && !isMin && !isMax) return "";
            const labelY = py < 18 ? py + 14 : py - 5;
            return `
            <circle cx="${px}" cy="${py}" r="3" fill="${color}"/>
            <text x="${px}" y="${labelY}" text-anchor="middle" font-size="9" fill="${color}" font-family="JetBrains Mono, monospace" font-weight="600">${values[i]}°</text>
          `;
          })
          .join("")}
      </svg>
    `;
  }

  /* ── Render temperature chart ─────────────────────────────── */
  function renderTempChart(tempData, year, month) {
    const chartEl = document.getElementById("climate-temp-chart");
    const titleEl = document.getElementById("climate-temp-title");
    if (!chartEl) return;

    if (!tempData || !tempData.length) {
      chartEl.innerHTML = `<div style="color:var(--text-faint);padding:var(--sp-4);text-align:center">暫無氣溫數據</div>`;
      return;
    }

    const monthZh = MONTHS_ZH[month - 1] || "";
    const monthEn = MONTHS_EN[month - 1] || "";
    if (titleEl) {
      titleEl.textContent = `${year}年${monthZh} ${year} ${monthEn} — 每日平均氣溫 Daily Mean Temperature`;
    }

    // Extract values
    const values = tempData
      .map((d) => parseFloat(d.Value || d.value || 0))
      .filter((v) => !isNaN(v));
    const days = tempData.map((d) =>
      parseInt(d.DayOfMonth || d.dayofmonth || 0),
    );

    if (!values.length) {
      chartEl.innerHTML = `<div style="color:var(--text-faint);padding:var(--sp-4);text-align:center">暫無氣溫數據</div>`;
      return;
    }

    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    const maxV = Math.max(...values).toFixed(1);
    const minV = Math.min(...values).toFixed(1);
    const maxDay = days[values.indexOf(Math.max(...values))];
    const minDay = days[values.indexOf(Math.min(...values))];

    chartEl.innerHTML = `
      <div style="display:flex;gap:var(--sp-4);flex-wrap:wrap;margin-bottom:var(--sp-4)">
        <div style="text-align:center">
          <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">月均 Avg</div>
          <div style="font-family:var(--font-mono);font-size:var(--text-xl);font-weight:700;color:var(--primary)">${avg}°C</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">最高 Max</div>
          <div style="font-family:var(--font-mono);font-size:var(--text-xl);font-weight:700;color:var(--error)">${maxV}°C</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint)">${maxDay}日</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">最低 Min</div>
          <div style="font-family:var(--font-mono);font-size:var(--text-xl);font-weight:700;color:var(--info)">${minV}°C</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint)">${minDay}日</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">數據點 Points</div>
          <div style="font-family:var(--font-mono);font-size:var(--text-xl);font-weight:700;color:var(--text)">${values.length}</div>
        </div>
      </div>
      <div style="overflow-x:auto;padding-bottom:var(--sp-2)">
        ${buildSparkline(values, Math.max(560, values.length * 20), 100, "#60a5fa")}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:var(--sp-3)">
        ${values
          .map((v, i) => {
            const d = days[i] || i + 1;
            const pct =
              values.length > 1
                ? (v - Math.min(...values)) /
                  (Math.max(...values) - Math.min(...values))
                : 0.5;
            const r = Math.round(96 + pct * 152);
            const g = Math.round(165 - pct * 80);
            const b = Math.round(250 - pct * 150);
            return `
            <div style="text-align:center;min-width:28px">
              <div style="font-size:9px;color:var(--text-faint);font-family:var(--font-mono)">${d}</div>
              <div style="font-size:10px;font-weight:600;color:rgb(${r},${g},${b});font-family:var(--font-mono)">${v}°</div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  }

  /* ── Render climate facts ─────────────────────────────────── */
  function renderFacts() {
    const el = document.getElementById("climate-facts");
    if (!el) return;
    el.innerHTML = CLIMATE_FACTS.map(
      (f) => `
      <div class="row-item" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;align-items:center;gap:var(--sp-2)">
          <span style="font-size:1.2em">${f.icon}</span>
          <span style="font-size:var(--text-xs);color:var(--text-faint)">${f.label}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:var(--sp-2)">
          <span style="font-family:var(--font-mono);font-size:var(--text-lg);font-weight:700;color:var(--primary)">${f.value}</span>
          <span style="font-size:var(--text-xs);color:var(--text-muted)">${f.sub}</span>
        </div>
      </div>
    `,
    ).join("");
  }

  /* ── Render monthly average temp for the whole year ────────── */
  function renderMonthlyBar(monthlyAvgs) {
    const el = document.getElementById("climate-monthly-bar");
    if (!el || !monthlyAvgs.length) return;

    const maxT = Math.max(...monthlyAvgs.map((m) => m.avg));
    const minT = Math.min(...monthlyAvgs.map((m) => m.avg));

    el.innerHTML = monthlyAvgs
      .map((m) => {
        const pct = (m.avg - minT) / (maxT - minT + 0.01);
        const barH = Math.round(20 + pct * 60);
        // Color gradient: cool blue → warm red
        const r = Math.round(96 + pct * 152);
        const g = Math.round(165 - pct * 100);
        const b = Math.round(250 - pct * 200);
        return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:42px">
          <div style="font-size:10px;font-weight:600;color:rgb(${r},${g},${b});font-family:var(--font-mono)">${m.avg}°</div>
          <div style="width:28px;height:${barH}px;background:rgb(${r},${g},${b});border-radius:4px 4px 0 0;opacity:0.85"></div>
          <div style="font-size:9px;color:var(--text-faint)">${MONTHS_EN[m.month - 1] || ""}</div>
        </div>
      `;
      })
      .join("");
  }

  /* ── Fetch monthly climate data ───────────────────────────── */
  async function fetchMonthlyTemp(year, month) {
    const url = `${HKO_BASE}?dataType=CLMTEMP&station=HKO&year=${year}&month=${month}&rformat=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    // API returns data as arrays: [year, month, day, value, flag]
    // Normalize to [{DayOfMonth, Value}] for uniform handling
    const rows = (raw.data || [])
      .map((row) => {
        if (Array.isArray(row)) {
          return { DayOfMonth: parseInt(row[2]), Value: row[3] };
        }
        // Already object-shaped (future-proof)
        return {
          DayOfMonth: row.DayOfMonth || row.dayofmonth,
          Value: row.Value || row.value,
        };
      })
      .filter((r) => r.Value && r.Value !== "" && !isNaN(parseFloat(r.Value)));
    return { data: rows };
  }

  /* ── Render 12-month bar chart ────────────────────────────── */
  function render12MonthBar(monthlyAvgs) {
    const el = document.getElementById("climate-monthly-bar");
    if (!el || !monthlyAvgs.length) return;

    const maxT = Math.max(...monthlyAvgs.map((m) => m.avg));
    const minT = Math.min(...monthlyAvgs.map((m) => m.avg));

    // Title for the chart area
    const titleEl = document.getElementById("climate-temp-title");
    if (titleEl && monthlyAvgs.length > 0) {
      const first = monthlyAvgs[0];
      const last = monthlyAvgs[monthlyAvgs.length - 1];
      titleEl.textContent = `過去 ${monthlyAvgs.length} 個月月平均氣溫 — ${MONTHS_EN[first.month - 1]} ${first.year} – ${MONTHS_EN[last.month - 1]} ${last.year}`;
    }

    el.innerHTML = monthlyAvgs
      .map((m) => {
        const pct = maxT === minT ? 0.5 : (m.avg - minT) / (maxT - minT);
        const barH = Math.round(20 + pct * 80);
        // Color gradient: cool blue → warm red
        const r = Math.round(96 + pct * 152);
        const g = Math.round(165 - pct * 100);
        const b = Math.round(250 - pct * 200);
        return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:42px">
          <div style="font-size:10px;font-weight:600;color:rgb(${r},${g},${b});font-family:var(--font-mono)">${m.avg}°</div>
          <div style="width:28px;height:${barH}px;background:rgb(${r},${g},${b});border-radius:4px 4px 0 0;opacity:0.85"></div>
          <div style="font-size:9px;color:var(--text-faint);text-align:center;line-height:1.2">
            ${MONTHS_EN[(m.month - 1) % 12] || ""}<br>
            <span style="font-size:8px;opacity:.7">${m.year}</span>
          </div>
        </div>
      `;
      })
      .join("");
  }

  /* ── Render summary stats for 12 months ───────────────────── */
  function render12MonthStats(monthlyAvgs) {
    const chartEl = document.getElementById("climate-temp-chart");
    if (!chartEl || !monthlyAvgs.length) return;

    const avgs = monthlyAvgs.map((m) => m.avg);
    const overallAvg = (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(
      1,
    );
    const maxM = monthlyAvgs.reduce((a, b) => (a.avg > b.avg ? a : b));
    const minM = monthlyAvgs.reduce((a, b) => (a.avg < b.avg ? a : b));

    chartEl.innerHTML = `
      <div style="display:flex;gap:var(--sp-4);flex-wrap:wrap;margin-bottom:var(--sp-4)">
        <div style="text-align:center">
          <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">12月均 Avg</div>
          <div style="font-family:var(--font-mono);font-size:var(--text-xl);font-weight:700;color:var(--primary)">${overallAvg}°C</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">最熱月 Hottest</div>
          <div style="font-family:var(--font-mono);font-size:var(--text-xl);font-weight:700;color:var(--error)">${maxM.avg}°C</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint)">${MONTHS_EN[(maxM.month - 1) % 12]} ${maxM.year}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">最涼月 Coolest</div>
          <div style="font-family:var(--font-mono);font-size:var(--text-xl);font-weight:700;color:var(--info)">${minM.avg}°C</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint)">${MONTHS_EN[(minM.month - 1) % 12]} ${minM.year}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">月份數 Months</div>
          <div style="font-family:var(--font-mono);font-size:var(--text-xl);font-weight:700;color:var(--text)">${monthlyAvgs.length}</div>
        </div>
      </div>
    `;
  }

  /* ── Main refresh ──────────────────────────────────────────── */
  async function refresh() {
    const chartEl = document.getElementById("climate-temp-chart");
    if (!chartEl) return;

    chartEl.innerHTML = `<div class="skel skel-p" style="margin-bottom:8px"></div><div class="skel skel-p" style="width:60%"></div>`;

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    renderFacts();

    // Build list of last 12 months (going back from current month)
    const monthList = [];
    for (let i = 0; i < 12; i++) {
      let m = curMonth - i;
      let y = curYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      monthList.unshift({ year: y, month: m });
    }

    // Fetch all 12 months in parallel
    const fetches = monthList.map(({ year, month }) =>
      fetchMonthlyTemp(year, month)
        .then((data) => {
          const rows = data.data || [];
          if (!rows.length) return null;
          const vals = rows
            .map((d) => parseFloat(d.Value || d.value || 0))
            .filter((v) => !isNaN(v) && v !== 0);
          if (!vals.length) return null;
          const avg = parseFloat(
            (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
          );
          return { year, month, avg };
        })
        .catch(() => null),
    );

    const results = await Promise.allSettled(fetches);
    const monthlyAvgs = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean);

    if (monthlyAvgs.length > 0) {
      render12MonthStats(monthlyAvgs);
      render12MonthBar(monthlyAvgs);
    } else {
      chartEl.innerHTML = `<div style="color:var(--text-faint);font-size:var(--text-sm);padding:var(--sp-4)">暫無近期氣溫數據</div>`;
    }

    // Render seasonal reference table
    renderSeasonalTable();
  }

  /* ── Seasonal reference (static HKO climatology) ──────────── */
  function renderSeasonalTable() {
    const el = document.getElementById("climate-seasonal");
    if (!el) return;

    // HKO historical monthly averages (1991-2020 normals approx.)
    const normals = [
      { m: "1月 Jan", min: 14.5, max: 19.2, rain: 24.7 },
      { m: "2月 Feb", min: 15.3, max: 19.5, rain: 53.5 },
      { m: "3月 Mar", min: 18.5, max: 22.8, rain: 90.1 },
      { m: "4月 Apr", min: 22.1, max: 26.4, rain: 157.7 },
      { m: "5月 May", min: 25.6, max: 29.8, rain: 305.1 },
      { m: "6月 Jun", min: 27.3, max: 31.5, rain: 456.1 },
      { m: "7月 Jul", min: 27.8, max: 32.4, rain: 383.2 },
      { m: "8月 Aug", min: 27.6, max: 32.3, rain: 440.8 },
      { m: "9月 Sep", min: 26.5, max: 31.2, rain: 299.2 },
      { m: "10月 Oct", min: 23.4, max: 28.3, rain: 100.4 },
      { m: "11月 Nov", min: 18.8, max: 24.5, rain: 36.2 },
      { m: "12月 Dec", min: 15.2, max: 20.9, rain: 22.0 },
    ];

    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:var(--text-xs);font-family:var(--font-mono)">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:var(--sp-2);color:var(--text-faint);font-weight:600">月份</th>
            <th style="text-align:center;padding:var(--sp-2);color:var(--text-faint);font-weight:600">最低°C</th>
            <th style="text-align:center;padding:var(--sp-2);color:var(--text-faint);font-weight:600">最高°C</th>
            <th style="text-align:center;padding:var(--sp-2);color:var(--text-faint);font-weight:600">降雨 mm</th>
          </tr>
        </thead>
        <tbody>
          ${normals
            .map((n, i) => {
              const isCurr = i + 1 === new Date().getMonth() + 1;
              const bg = isCurr ? "var(--primary-lt)" : "transparent";
              return `
              <tr style="background:${bg};border-bottom:1px solid var(--divider)">
                <td style="padding:var(--sp-2);font-weight:${isCurr ? "700" : "400"};color:${isCurr ? "var(--primary)" : "var(--text)"}">${n.m}</td>
                <td style="text-align:center;padding:var(--sp-2);color:var(--info)">${n.min}</td>
                <td style="text-align:center;padding:var(--sp-2);color:var(--error)">${n.max}</td>
                <td style="text-align:center;padding:var(--sp-2);color:var(--teal)">${n.rain}</td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
      <div style="font-size:10px;color:var(--text-faint);margin-top:var(--sp-2)">
        * 1991-2020 氣候標準值 Climatological normals — 香港天文台 Hong Kong Observatory
      </div>
    `;
  }

  return { refresh };
})();
