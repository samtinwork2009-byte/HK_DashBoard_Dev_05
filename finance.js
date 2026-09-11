/* ============================================================
   finance.js — Exchange Rates (HKD) + Hang Seng Index
   香港城市儀表板 v2
   ============================================================ */

"use strict";

const FX_API =
  "https://api.frankfurter.app/latest?from=HKD&to=USD,CNY,GBP,JPY,EUR";
const HSI_API =
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EHSI?interval=1d&range=1d";

/* ── Currency display labels ──────────────────────────────── */
const CURRENCY_LABELS = {
  USD: "USD 美元",
  CNY: "CNY 人民幣",
  GBP: "GBP 英鎊",
  JPY: "JPY 日圓",
  EUR: "EUR 歐元",
};

/* ── Fetch exchange rates ─────────────────────────────────── */
async function fetchExchangeRates() {
  const el = document.getElementById("fin-fx");
  if (!el) return;
  el.innerHTML = skelHtml(5);
  try {
    const res = await fetch(FX_API);
    if (!res.ok) throw new Error("FX HTTP " + res.status);
    const d = await res.json();
    // d.rates gives: how many USD,CNY,etc per 1 HKD
    // We want to show: 1 USD = X HKD (i.e. invert)
    const rates = d.rates || {};
    const date = d.date || "";
    el.innerHTML =
      Object.entries(rates)
        .map(function ([ccy, rate]) {
          const hkdPerUnit = rate > 0 ? (1 / rate).toFixed(4) : "--";
          const label = CURRENCY_LABELS[ccy] || ccy;
          // Format nicely — JPY gets fewer decimals
          const displayRate =
            ccy === "JPY" ? (1 / rate).toFixed(2) : (1 / rate).toFixed(4);
          return (
            '<div class="row-item">' +
            '<span class="row-name">1 ' +
            label +
            "</span>" +
            '<span class="row-val">HK$\u00a0' +
            displayRate +
            "</span>" +
            "</div>"
          );
        })
        .join("") +
      (date
        ? '<div style="font-size:10px;color:var(--text-faint);margin-top:var(--sp-2)">匯率日期 ' +
          date +
          "</div>"
        : "");

    // Update subtitle
    const sub = document.getElementById("fin-fx-sub");
    if (sub) sub.textContent = date ? "更新日期 " + date : "即時匯率";
  } catch (e) {
    console.error("FX fetch error:", e);
    if (el)
      el.innerHTML =
        '<div class="row-item"><span style="color:var(--error)">無法載入匯率</span></div>';
  }
}

/* ── Fetch Hang Seng Index ────────────────────────────────── */
async function fetchHSI() {
  const el = document.getElementById("fin-hsi");
  if (!el) return;
  el.innerHTML = skelHtml(2);
  try {
    const res = await fetch(HSI_API);
    if (!res.ok) throw new Error("HSI HTTP " + res.status);
    const d = await res.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("No HSI data");

    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose;
    const change = price - prev;
    const pct = (change / prev) * 100;
    const isUp = change >= 0;
    const sign = isUp ? "+" : "";
    const color = isUp ? "var(--success)" : "var(--error)";
    const arrow = isUp ? "▲" : "▼";

    el.innerHTML =
      '<div style="display:flex;align-items:flex-end;gap:var(--sp-3);flex-wrap:wrap">' +
      "<div>" +
      '<div style="font-size:var(--text-xs);color:var(--text-faint);margin-bottom:2px">恒生指數 Hang Seng Index</div>' +
      '<div class="big-num" style="color:' +
      color +
      '">' +
      price.toLocaleString("en-HK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) +
      "</div>" +
      "</div>" +
      '<div style="padding-bottom:4px">' +
      '<span style="font-size:var(--text-sm);color:' +
      color +
      ';font-weight:700">' +
      arrow +
      " " +
      sign +
      change.toFixed(2) +
      " (" +
      sign +
      pct.toFixed(2) +
      "%)" +
      "</span>" +
      '<div style="font-size:10px;color:var(--text-faint)">前收市 ' +
      prev.toFixed(2) +
      "</div>" +
      "</div>" +
      "</div>";

    // Update subtitle
    const sub = document.getElementById("fin-hsi-sub");
    if (sub) {
      const t = meta.regularMarketTime;
      const dt = t
        ? new Date(t * 1000).toLocaleTimeString("zh-HK", { hour12: false })
        : "";
      sub.textContent = dt ? "更新 " + dt : "即時";
    }
  } catch (e) {
    console.error("HSI fetch error:", e);
    if (el)
      el.innerHTML =
        '<div class="row-item"><span style="color:var(--error)">無法載入恒指</span></div>';
  }
}

/* ── Public API ─────────────────────────────────────────── */
window.Finance = {
  fetchExchangeRates: fetchExchangeRates,
  fetchHSI: fetchHSI,
  refresh: async function () {
    await Promise.all([fetchExchangeRates(), fetchHSI()]);
  },
};
