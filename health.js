/* ============================================================
   health.js — Healthcare services and A&E waiting times
   香港城市儀表板 v2
   ============================================================ */

"use strict";

const AED_URL = "https://www.ha.org.hk/opendata/aed/aedwtdata2-tc.json";

const HEALTH_DATA = {
  publicHospitals: [
    { name: "瑪嘉烈醫院", type: "公立醫院", note: "急症室 · 住院服務" },
    { name: "廣華醫院", type: "公立醫院", note: "專科門診 · 急症室" },
    { name: "仁濟醫院", type: "公立醫院", note: "急症 · 中醫綜合" },
    { name: "香港中文大學醫院", type: "公立醫院", note: "醫療中心 · 急症室" },
  ],
  privateHospitals: [
    { name: "香港醫院", type: "私家醫院", note: "私家醫療 · 專科服務" },
    { name: "國際醫院", type: "私家醫院", note: "高端醫療 · 健康檢查" },
  ],
  clinics: [
    { name: "屯門社區健康中心", type: "診所", note: "普通科 · 預約服務" },
    { name: "元朗診所", type: "診所", note: "家庭醫學 · 慢性病管理" },
    { name: "荃灣社區診所", type: "診所", note: "兒科 · 內科" },
  ],
};

/* ── Hospital region map ─────────────────────────────────────── */
const HOSP_REGION = {
  "\u5ee3\u83ef\u91ab\u9662": "\u4e5d\u9f8d",
  "\u57fa\u7763\u6559\u806f\u5408\u91ab\u9662": "\u4e5d\u9f8d",
  "\u5929\u6c34\u570d\u91ab\u9662": "\u65b0\u754c",
  "\u5c6f\u9580\u91ab\u9662": "\u65b0\u754c",
  "\u535a\u611b\u91ab\u9662": "\u65b0\u754c",
  "\u5317\u5340\u91ab\u9662": "\u65b0\u754c",
  "\u5a01\u723e\u65af\u89aa\u738b\u91ab\u9662": "\u65b0\u754c",
  "\u96c5\u9e97\u6c0f\u4f55\u5999\u9f61\u90a3\u6253\u7d20\u91ab\u9662":
    "\u65b0\u754c",
  "\u4f0a\u5229\u6c99\u4f2f\u90a3\u91ab\u9662": "\u4e5d\u9f8d",
  "\u746a\u5564\u83ef\u91ab\u9662": "\u65b0\u754c",
  "\u4ec1\u6fdf\u91ab\u9662": "\u65b0\u754c",
  "\u746a\u9e97\u91ab\u9662": "\u6e2f\u5cf6",
  "\u5f8b\u6566\u6cbb\u53ca\u9127\u8fdc\u5805\u91ab\u9662": "\u6e2f\u5cf6",
  "\u6771\u5340\u5c24\u5fb7\u592b\u4eba\u90a3\u6253\u7d20\u91ab\u9662":
    "\u6e2f\u5cf6",
  "\u660e\u611b\u91ab\u9662": "\u4e5d\u9f8d",
  "\u9999\u6e2f\u4f5b\u6559\u91ab\u9662": "\u4e5d\u9f8d",
  "\u5c07\u8ecd\u6fb3\u91ab\u9662": "\u65b0\u754c",
  "\u806f\u5408\u91ab\u9662": "\u4e5d\u9f8d",
};

/* ── Wait time string → minutes (for colour coding) ─────────── */
function parseWaitMins(str) {
  if (!str || str === "--") return null;
  // "24 分鐘" → 24
  const minsMatch = str.match(/(\d+(?:\.\d+)?)\s*分/);
  if (minsMatch) return parseFloat(minsMatch[1]);
  // "1 小時" → 60, "1.5 小時" → 90
  const hrsMatch = str.match(/(\d+(?:\.\d+)?)\s*小時/);
  if (hrsMatch) return parseFloat(hrsMatch[1]) * 60;
  // "少於 15 分鐘"
  const ltMatch = str.match(/少於\s*(\d+)/);
  if (ltMatch) return parseInt(ltMatch[1], 10);
  return null;
}

function aedWaitClass(str) {
  const mins = parseWaitMins(str);
  if (mins === null) return "tag-muted";
  if (mins <= 30) return "tag-green";
  if (mins <= 60) return "tag-yellow";
  return "tag-red";
}

/* ── Fetch & render ──────────────────────────────────────────── */
function renderHealthcareOverview() {
  const fullEl = document.getElementById("h-health-full");
  if (!fullEl) return;
  const cards = [
    ...HEALTH_DATA.publicHospitals.map((item) =>
      renderHealthCard(item, "公立醫院"),
    ),
    ...HEALTH_DATA.privateHospitals.map((item) =>
      renderHealthCard(item, "私家醫院"),
    ),
    ...HEALTH_DATA.clinics.map((item) => renderHealthCard(item, "診所")),
  ].join("");
  fullEl.innerHTML = cards;
}

function renderHealthCard(item, category) {
  return `
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--sp-3);display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-weight:700;font-size:var(--text-sm)">${item.name}</div>
        <span class="tag tag-blue" style="font-size:10px">${category}</span>
      </div>
      <div style="font-size:var(--text-xs);color:var(--text-muted)">${item.note}</div>
      <div style="font-size:10px;color:var(--text-faint)">${item.type}</div>
    </div>
  `;
}

async function fetchAED() {
  const fullEl = document.getElementById("h-aed-full");
  const updEl = document.getElementById("h-aed-upd");
  const miniEl = document.getElementById("h-aed-content");

  if (fullEl) fullEl.innerHTML = '<div class="skel skel-p"></div>';
  if (miniEl) miniEl.innerHTML = '<div class="skel skel-p"></div>';
  renderHealthcareOverview();

  try {
    const res = await fetch(AED_URL);
    if (!res.ok) throw new Error("AED HTTP " + res.status);
    const d = await res.json();

    const list = d.waitTime || [];
    const upd = d.updateTime || "";

    if (updEl) {
      const rtFn =
        typeof window.relativeTime === "function"
          ? window.relativeTime
          : function (s) {
              return s;
            };
      updEl.textContent = upd ? rtFn(upd) : "";
    }

    // Home mini — show 5 hospitals
    if (miniEl && list.length) {
      miniEl.innerHTML = list
        .slice(0, 5)
        .map((h) => renderAedRow(h))
        .join("");
    }

    // Full page — all hospitals grouped by region
    if (fullEl && list.length) {
      const grouped = {};
      list.forEach(function (h) {
        const reg = HOSP_REGION[h.hospName] || "其他";
        if (!grouped[reg]) grouped[reg] = [];
        grouped[reg].push(h);
      });

      let html = "";
      const order = ["港島", "九龍", "新界", "其他"];
      for (const reg of order) {
        if (!grouped[reg]) continue;
        html +=
          '<div style="grid-column:1/-1;font-size:var(--text-xs);font-weight:700;color:var(--primary);margin:var(--sp-2) 0 4px;text-transform:uppercase;letter-spacing:.05em">' +
          reg +
          "</div>";
        html += grouped[reg].map((h) => renderAedCard(h)).join("");
      }
      fullEl.innerHTML = html;
    }

    if (!list.length) {
      if (fullEl)
        fullEl.innerHTML =
          '<div style="color:var(--text-faint)">暫無急症室等候資料</div>';
      if (miniEl)
        miniEl.innerHTML =
          '<div style="color:var(--text-faint)">暫無資料</div>';
    }
  } catch (e) {
    console.error("AED fetch error:", e);
    const errMsg =
      '<div class="row-item"><span style="color:var(--error)">無法載入急症室等候資料</span></div>';
    if (fullEl) fullEl.innerHTML = errMsg;
    if (miniEl) miniEl.innerHTML = errMsg;
  }
}

/* ── Row renderer (home mini) ────────────────────────────────── */
function renderAedRow(h) {
  const t45 = h.t45p50 || "--";
  const cls = aedWaitClass(t45);
  return (
    '<div class="row-item">' +
    '<span class="row-name" style="font-size:var(--text-xs)">' +
    h.hospName +
    "</span>" +
    '<span class="tag ' +
    cls +
    '" style="font-size:10px">' +
    (t45 !== "--" ? t45 : "—") +
    "</span>" +
    "</div>"
  );
}

/* ── Card renderer (full page) ───────────────────────────────── */
function renderAedCard(h) {
  const t3 = h.t3p50 || "--";
  const t45 = h.t45p50 || "--";
  const t2 = h.t2wt || "";

  const clsT3 = aedWaitClass(t3);
  const clsT45 = aedWaitClass(t45);

  const t2Row = t2
    ? '<div style="font-size:10px;color:var(--text-faint)">乙類 T2: ' +
      t2 +
      "</div>"
    : "";

  return (
    '<div style="background:var(--surface-2);border-radius:var(--r-lg);padding:var(--sp-3);display:flex;flex-direction:column;gap:6px;border:1px solid var(--border)">' +
    '<div style="font-weight:600;font-size:var(--text-sm)">' +
    h.hospName +
    "</div>" +
    t2Row +
    '<div style="display:flex;gap:var(--sp-2);flex-wrap:wrap">' +
    '<div style="flex:1;min-width:80px">' +
    '<div style="font-size:10px;color:var(--text-faint);margin-bottom:2px">甲類 T3 (中位數)</div>' +
    '<span class="tag ' +
    clsT3 +
    '">' +
    (t3 !== "--" ? t3 : "—") +
    "</span>" +
    "</div>" +
    '<div style="flex:1;min-width:80px">' +
    '<div style="font-size:10px;color:var(--text-faint);margin-bottom:2px">乙丙類 T45 (中位數)</div>' +
    '<span class="tag ' +
    clsT45 +
    '">' +
    (t45 !== "--" ? t45 : "—") +
    "</span>" +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

/* ── Public API ──────────────────────────────────────────────── */
window.Health = {
  fetchAED: fetchAED,
  refresh: fetchAED,
};
