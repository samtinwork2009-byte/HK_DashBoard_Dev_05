/* ============================================================
   cctv.js — Traffic CCTV Snapshots (運輸署)
   香港城市儀表板 v4.1 — CORS-fixed, confirmed cameras only
   ============================================================ */

"use strict";

const CCTV_BASE = "https://tdcctv.data.one.gov.hk/";

/* ── All confirmed-working camera codes (tested April 2026) ── */
const CCTV_CAMERAS = [
  { key: "BC101F", label: "青葵公路 — 往葵涌", area: "青葵公路", region: "NT" },
  { key: "BC102F", label: "青葵公路 — 往青衣", area: "青葵公路", region: "NT" },
  { key: "BC103F", label: "青葵公路", area: "青葵公路", region: "NT" },
  { key: "CW103F", label: "城門隧道", area: "城門隧道", region: "NT" },
  { key: "TC101F", label: "大老山隧道 — 往沙田", area: "大老山", region: "NT" },
  { key: "TC104F", label: "大老山隧道 — 往九龍", area: "大老山", region: "NT" },
  { key: "TL101F", label: "大老山公路 1", area: "大老山", region: "NT" },
  { key: "TL102F", label: "大老山公路 2", area: "大老山", region: "NT" },
  { key: "TL103F", label: "大老山公路 3", area: "大老山", region: "NT" },
  { key: "K101F", label: "觀塘繞道 1", area: "觀塘繞道", region: "KLN" },
  { key: "K102F", label: "觀塘繞道 2", area: "觀塘繞道", region: "KLN" },
  { key: "K104F", label: "觀塘繞道 4", area: "觀塘繞道", region: "KLN" },
  { key: "K106F", label: "觀塘繞道 6", area: "觀塘繞道", region: "KLN" },
  { key: "K107F", label: "觀塘繞道 7", area: "觀塘繞道", region: "KLN" },
  { key: "K108F", label: "觀塘繞道 8", area: "觀塘繞道", region: "KLN" },
  { key: "K109F", label: "觀塘繞道 9", area: "觀塘繞道", region: "KLN" },
  { key: "K111F", label: "觀塘繞道 11", area: "觀塘繞道", region: "KLN" },
  { key: "K112F", label: "觀塘繞道 12", area: "觀塘繞道", region: "KLN" },
  { key: "K121F", label: "觀塘繞道 21", area: "觀塘繞道", region: "KLN" },
  { key: "K123F", label: "觀塘繞道 23", area: "觀塘繞道", region: "KLN" },
  { key: "K202F", label: "觀塘繞道 圖K202", area: "觀塘繞道", region: "KLN" },
  { key: "YL101F", label: "元朗公路 1", area: "元朗公路", region: "NT" },
  { key: "YL106F", label: "元朗公路 6", area: "元朗公路", region: "NT" },
  { key: "YL111F", label: "元朗公路 11", area: "元朗公路", region: "NT" },
];

/* ── Group cameras by area ───────────────────────────────────── */
function getCamerasByArea() {
  const groups = {};
  CCTV_CAMERAS.forEach((c) => {
    if (!groups[c.area]) groups[c.area] = [];
    groups[c.area].push(c);
  });
  return groups;
}

function getCamerasByRegion() {
  const groups = { NT: [], KLN: [], HKI: [] };
  CCTV_CAMERAS.forEach((c) => {
    const region = groups[c.region] ? c.region : "HKI";
    groups[region].push(c);
  });
  return groups;
}

/* ── Track loaded cameras ────────────────────────────────────── */
let loadedKeys = new Set();

/* ── CORS-safe image URL via allorigins proxy ────────────────── */
function cctvImgSrc(key) {
  const direct = `${CCTV_BASE}${key}.JPG?t=${Date.now()}`;
  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(CCTV_BASE + key + ".JPG?t=" + Date.now())}`;
  return { direct, proxy };
}

/* ── Build camera grid on page load ─────────────────────────── */
function buildCameraGrid() {
  const selGrid = document.getElementById("cctv-area-grid");
  if (!selGrid) return;

  const regions = getCamerasByRegion();
  const labels = { NT: "新界", KLN: "九龍", HKI: "港島" };
  const activeRegion = window._cctvRegion || "NT";

  selGrid.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-4);flex-wrap:wrap">
      <span style="font-size:var(--text-xs);color:var(--text-faint)">共 ${CCTV_CAMERAS.length} 個鏡頭</span>
      <button onclick="loadAllCCTV()"
        style="background:var(--primary);color:white;border:none;border-radius:var(--r-md);
               padding:var(--sp-2) var(--sp-4);font-size:var(--text-xs);font-weight:700;
               cursor:pointer">
        全部載入 Load All
      </button>
      <button onclick="document.getElementById('cctv-grid').innerHTML='';loadedKeys.clear();"
        style="background:var(--surface-2);color:var(--text-muted);border:1px solid var(--border);
               border-radius:var(--r-md);padding:var(--sp-2) var(--sp-4);font-size:var(--text-xs);
               cursor:pointer">
        清除全部 Clear All
      </button>
    </div>
    <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-3)">
      ${Object.entries(labels)
        .map(
          ([code, label]) => `
        <button onclick="window._cctvRegion='${code}'; buildCameraGrid();"
          style="background:${activeRegion === code ? "var(--primary-lt)" : "var(--surface-2)"};border:1px solid ${activeRegion === code ? "var(--primary)" : "var(--border)"};border-radius:999px;padding:6px 12px;font-size:var(--text-xs);font-weight:700;color:${activeRegion === code ? "var(--primary)" : "var(--text)"};cursor:pointer">
          ${label} (${regions[code].length})
        </button>
      `,
        )
        .join("")}
    </div>
    <div style="margin-bottom:var(--sp-4)">
      <div style="font-size:var(--text-xs);font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--sp-2)">${labels[activeRegion]} (${regions[activeRegion].length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
        ${regions[activeRegion]
          .map(
            (c) => `
          <button onclick="loadCCTV('${c.key}','${c.label}')"
            style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);
                   padding:var(--sp-2) var(--sp-3);font-size:var(--text-xs);color:var(--text);
                   cursor:pointer;transition:background .15s"
            onmouseover="this.style.background='var(--primary-lt)'"
            onmouseout="this.style.background='var(--surface-2)'">
            ${c.label}
          </button>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

/* ── Load all cameras at once ────────────────────────────────────── */
window.loadAllCCTV = function () {
  CCTV_CAMERAS.forEach((c, index) => {
    setTimeout(() => loadCCTV(c.key, c.label), index * 60);
  });
};

/* ── Load a CCTV image card ──────────────────────────────────── */
window.loadCCTV = function (key, name) {
  key = key.trim().toUpperCase();
  if (!key) return;

  const grid = document.getElementById("cctv-grid");
  if (!grid) return;

  // Refresh if already loaded
  if (loadedKeys.has(key)) {
    refreshCCTV(key);
    // Scroll to it
    const card = document.getElementById(`cctv-card-${key}`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  loadedKeys.add(key);

  const label = name || key;
  const ts = new Date().toLocaleTimeString("zh-HK", { hour12: false });
  const { direct, proxy } = cctvImgSrc(key);

  const card = document.createElement("div");
  card.id = `cctv-card-${key}`;
  card.style.cssText = `
    background:var(--surface-2);border-radius:var(--r-lg);overflow:hidden;
    border:1px solid var(--border);position:relative;
  `;
  card.innerHTML = `
    <div style="background:var(--surface);padding:var(--sp-2) var(--sp-3);
                display:flex;justify-content:space-between;align-items:center;
                border-bottom:1px solid var(--border)">
      <div>
        <span style="font-size:var(--text-sm);font-weight:600">${escHtml(label)}</span>
        <span style="font-size:10px;color:var(--text-faint);margin-left:6px;font-family:var(--font-mono)">${escHtml(key)}</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span id="cctv-ts-${key}" style="font-size:10px;color:var(--text-faint)">${ts}</span>
        <button onclick="refreshCCTV('${key}')" title="重新整理"
          style="background:var(--primary);color:white;border-radius:var(--r-sm);
                 padding:3px 9px;font-size:11px;font-weight:600">↻</button>
        <button onclick="removeCCTV('${key}')" title="移除"
          style="background:rgba(200,50,50,.15);color:var(--error);border-radius:var(--r-sm);
                 padding:3px 9px;font-size:11px">✕</button>
      </div>
    </div>
    <div id="cctv-wrap-${key}" style="position:relative;min-height:200px;background:#0a0e1a;
         display:flex;align-items:center;justify-content:center">
      <div id="cctv-skel-${key}"
           style="position:absolute;inset:0;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;gap:8px;
                  color:var(--text-faint);font-size:var(--text-xs)">
        <div style="width:32px;height:32px;border:2px solid var(--border);
                    border-top-color:var(--primary);border-radius:50%;
                    animation:spin .8s linear infinite"></div>
        載入中…
      </div>
      <img
        id="cctv-img-${key}"
        src="${direct}"
        alt="${escHtml(label)}"
        loading="eager"
        decoding="async"
        referrerpolicy="no-referrer"
        crossorigin="anonymous"
        style="width:100%;display:block;max-height:300px;object-fit:contain;opacity:0;transition:opacity .3s"
        onload="cctvImgLoaded('${key}')"
        onerror="cctvImgFallback('${key}','${proxy}')"
      >
    </div>
    <div style="padding:4px var(--sp-3);font-size:9px;color:var(--text-faint);
                text-align:right;border-top:1px solid var(--border)">
      每分鐘更新 · 運輸署
    </div>
  `;
  grid.prepend(card);
};

/* ── Fallback: try direct URL if proxy fails ─────────────────── */
window.cctvImgFallback = function (key, fallbackUrl) {
  const img = document.getElementById(`cctv-img-${key}`);
  if (!img) return;

  if (img.dataset.triedDirect === "1") {
    cctvImgError(key);
    return;
  }
  img.dataset.triedDirect = "1";
  img.src = fallbackUrl;
};

/* ── Refresh a specific camera ───────────────────────────────── */
window.refreshCCTV = function (key) {
  const img = document.getElementById(`cctv-img-${key}`);
  const skel = document.getElementById(`cctv-skel-${key}`);
  const ts = document.getElementById(`cctv-ts-${key}`);
  if (!img) return;

  if (skel) {
    skel.style.display = "flex";
  }
  img.style.opacity = "0";
  img.dataset.triedDirect = "";

  const { direct, proxy } = cctvImgSrc(key);
  img.src = proxy;
  img.onerror = () => cctvImgFallback(key, direct);

  if (ts)
    ts.textContent = new Date().toLocaleTimeString("zh-HK", { hour12: false });
};

/* ── Remove a camera card ────────────────────────────────────── */
window.removeCCTV = function (key) {
  const card = document.getElementById(`cctv-card-${key}`);
  if (card) card.remove();
  loadedKeys.delete(key);
};

/* ── Image load success ───────────────────────────────────────── */
window.cctvImgLoaded = function (key) {
  const skel = document.getElementById(`cctv-skel-${key}`);
  const img = document.getElementById(`cctv-img-${key}`);
  if (skel) skel.style.display = "none";
  if (img) img.style.opacity = "1";
};

/* ── Image load failure ──────────────────────────────────────── */
window.cctvImgError = function (key) {
  const skel = document.getElementById(`cctv-skel-${key}`);
  const img = document.getElementById(`cctv-img-${key}`);
  if (skel) {
    skel.style.display = "flex";
    skel.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="3"/>
        <path d="M6.168 18.849A4 4 0 0 1 10 17h4a4 4 0 0 1 3.832 1.849"/>
      </svg>
      <div style="color:var(--text-faint);font-size:11px;margin-top:4px">影像暫不可用</div>
      <div style="color:var(--text-faint);font-size:10px">${window.getDashboardFallbackText ? window.getDashboardFallbackText() : "此項目有待更新，敬請原諒"}</div>
    `;
  }
  if (img) img.style.display = "none";
};

/* ── Load from input field ───────────────────────────────────── */
window.loadCCTVInput = function () {
  const inp = document.getElementById("cctv-input");
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  loadCCTV(val.toUpperCase(), val.toUpperCase());
  inp.value = "";
};

/* ── Spin animation (inject if not present) ──────────────────── */
if (!document.getElementById("cctv-spin-style")) {
  const style = document.createElement("style");
  style.id = "cctv-spin-style";
  style.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
  document.head.appendChild(style);
}

/* ── Enter key in CCTV input ─────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const inp = document.getElementById("cctv-input");
  if (inp)
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadCCTVInput();
    });
  buildCameraGrid();
});

/* ── Auto-refresh all loaded cameras every 60s ───────────────── */
setInterval(() => {
  if (window._currentPage === "cctv") {
    loadedKeys.forEach((key) => refreshCCTV(key));
  }
}, 60000);

/* ── Helper ──────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.CCTV = {
  loadCCTV: window.loadCCTV,
  refreshAll: () => loadedKeys.forEach(refreshCCTV),
};
