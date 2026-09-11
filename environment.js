/* ============================================================
   environment.js — AQHI Forecast (空氣質素健康指數)
   香港城市儀表板 v2
   ============================================================ */

"use strict";

const AQHI_URL =
  "https://datagovhk.blob.core.windows.net/dataset/aqhi/aqhi-forecast.json";

/* ── AQHI risk text → level ─────────────────────────────── */
const RISK_MAP = {
  low: 1,
  "low to moderate": 2,
  moderate: 5,
  "moderate to high": 6,
  high: 7,
  "very high": 8,
  serious: 11,
  低: 1,
  低至中: 2,
  中: 5,
  中至高: 6,
  高: 7,
  甚高: 8,
  嚴重: 11,
};

function riskToNum(str) {
  if (!str) return 0;
  return RISK_MAP[str.toLowerCase().trim()] || 0;
}

function riskLabel(str) {
  if (!str) return "";
  const s = str.toLowerCase().trim();
  if (s === "low") return "低";
  if (s === "low to moderate") return "低至中";
  if (s === "moderate") return "中";
  if (s === "moderate to high") return "中至高";
  if (s === "high") return "高";
  if (s === "very high") return "甚高";
  if (s === "serious") return "嚴重";
  return str; // already Chinese
}

function riskClass(str) {
  const n = riskToNum(str);
  if (n <= 3) return "tag-green";
  if (n <= 6) return "tag-yellow";
  return "tag-red";
}

/* ── AQHI level colour helpers ──────────────────────────── */
function aqhiColor(str) {
  const n = riskToNum(str);
  if (n <= 3) return "var(--success)";
  if (n <= 6) return "var(--warning)";
  if (n <= 7) return "var(--error)";
  if (n <= 10) return "#ff6b6b";
  return "#ff4081";
}

function aqhiBg(str) {
  const n = riskToNum(str);
  if (n <= 3) return "var(--success-bg)";
  if (n <= 6) return "var(--warning-bg)";
  return "var(--error-bg)";
}

/* ── Fetch & render ──────────────────────────────────────────── */
async function fetchAQHI() {
  const elHome = document.getElementById("h-aqhi-content");
  const elFull = document.getElementById("e-aqhi");
  const elUpd = document.getElementById("e-aqhi-upd");

  if (elHome) elHome.innerHTML = skelHtml(2);
  if (elFull) elFull.innerHTML = skelHtml(3);

  try {
    const res = await fetch(AQHI_URL);
    if (!res.ok) throw new Error(`AQHI HTTP ${res.status}`);
    const raw = await res.json();

    // raw is an array of { type, date, time, health_risk_min, health_risk_max, publish_date }
    const list = Array.isArray(raw) ? raw : raw.forecast || raw.data || [];

    if (!list.length) {
      const msg = `<div style="color:var(--text-faint)">暫無空氣質素預報</div>`;
      if (elHome) elHome.innerHTML = msg;
      if (elFull) elFull.innerHTML = msg;
      return;
    }

    // Separate general and roadside
    const general = list.filter(
      (r) => r.type === "general" || r.type === "一般",
    );
    const roadside = list.filter(
      (r) => r.type === "roadside" || r.type === "路邊",
    );
    const all = list;

    // Publish date from first entry
    const pubDate = list[0]?.publish_date || list[0]?.date || "";
    if (elUpd && pubDate) elUpd.textContent = `預報日期：${pubDate}`;

    // Home mini — show current general AM/PM
    if (elHome) {
      const rows = (general.length ? general : all).slice(0, 4);
      if (rows.length) {
        elHome.innerHTML = rows.map((r) => renderAQHIMini(r)).join("");
      } else {
        elHome.innerHTML = `<div style="color:var(--text-faint)">暫無預報</div>`;
      }
      const currentAqhi = rows[0]
        ? riskLabel(rows[0].health_risk_max || rows[0].aqhi_max || "")
        : "--";
      window._lastWeatherAQHI = currentAqhi;
      if (typeof updateSummaryWeather === "function") {
        updateSummaryWeather(
          window._lastWeatherTemp,
          currentAqhi,
          window._lastWeatherDesc,
          pubDate || "",
          window._lastWeatherHumidity,
          window._lastWeatherUV,
          window._lastWeatherCondition,
        );
      }
    }

    // Full page — all entries grouped by type
    if (elFull) {
      let html = "";

      if (general.length) {
        html += `<div style="grid-column:1/-1;font-size:var(--text-xs);font-weight:700;color:var(--text-muted);margin-bottom:4px">一般監測站 General</div>`;
        html += general.map((r) => renderAQHICard(r)).join("");
      }
      if (roadside.length) {
        html += `<div style="grid-column:1/-1;font-size:var(--text-xs);font-weight:700;color:var(--text-muted);margin:var(--sp-3) 0 4px">路邊監測站 Roadside</div>`;
        html += roadside.map((r) => renderAQHICard(r)).join("");
      }
      if (!general.length && !roadside.length) {
        html = all.map((r) => renderAQHICard(r)).join("");
      }

      elFull.innerHTML =
        html || `<div style="color:var(--text-faint)">暫無預報</div>`;
    }
  } catch (e) {
    console.error("AQHI fetch error:", e);
    const err = `<div style="color:var(--error)">無法載入空氣質素預報</div>`;
    if (elHome) elHome.innerHTML = err;
    if (elFull) elFull.innerHTML = err;
  }
}

/* ── Mini row (home) ─────────────────────────────────────────── */
function renderAQHIMini(r) {
  const loStr = r.health_risk_min || r.aqhi_min || "";
  const hiStr = r.health_risk_max || r.aqhi_max || "";
  const type =
    r.type === "general"
      ? "一般"
      : r.type === "roadside"
        ? "路邊"
        : r.type || "";
  const time = r.time || "";
  const cls = riskClass(hiStr);
  const loLabel = riskLabel(loStr);
  const hiLabel = riskLabel(hiStr);
  return `<div class="row-item">
    <span class="row-name" style="font-size:var(--text-xs)">${type} ${time}</span>
    <span class="tag ${cls}">${loLabel} – ${hiLabel}</span>
  </div>`;
}

/* ── Card (full page) ───────────────────────────────────────── */
function renderAQHICard(r) {
  const loStr = r.health_risk_min || r.aqhi_min || "";
  const hiStr = r.health_risk_max || r.aqhi_max || "";
  const type =
    r.type === "general"
      ? "一般"
      : r.type === "roadside"
        ? "路邊"
        : r.type || "";
  const date = r.date || "";
  const time = r.time || "";
  const cls = riskClass(hiStr);
  const col = aqhiColor(hiStr);
  const bg = aqhiBg(hiStr);
  const loLabel = riskLabel(loStr);
  const hiLabel = riskLabel(hiStr);

  return `<div style="background:${bg};border:1px solid ${col};border-radius:var(--r-lg);padding:var(--sp-3)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div>
        <div style="font-weight:700;font-size:var(--text-sm);color:${col}">${type}</div>
        <div style="font-size:10px;color:var(--text-faint)">${date} ${time}</div>
      </div>
      <span class="tag ${cls}" style="font-size:var(--text-base);padding:4px 10px">${hiLabel}</span>
    </div>
    <div style="font-size:var(--text-xs);color:var(--text-muted)">
      預測範圍：${loLabel} – ${hiLabel}
    </div>
  </div>`;
}

/* ── Public API ──────────────────────────────────────────────── */
window.Environment = {
  fetchAQHI,
  refresh: fetchAQHI,
};
