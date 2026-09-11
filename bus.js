/* ============================================================
   bus.js — 巴士到站時間 Bus ETA
   Hong Kong City Dashboard — Complete UX Rewrite
   支援：KMB 九巴 / CTB 城巴 / GMB 專線小巴
   ============================================================ */

"use strict";

/* ══ PRESET STOPS ═══════════════════════════════════════════ */
const PRESET_STOPS = [
  {
    operator: "KMB",
    id: "B3B0EF2BC688751D",
    label: "屯門市中心總站",
    route: "60X",
    serviceType: 1,
    hint: "往旺角/高鐵",
  },
  {
    operator: "KMB",
    id: "77FB32597CCD30F5",
    label: "兆康苑總站",
    route: "67X",
    serviceType: 1,
    hint: "往旺角",
  },
  {
    operator: "KMB",
    id: "45C39BB56C6B333C",
    label: "大興總站",
    route: "66M",
    serviceType: 1,
    hint: "往元朗",
  },
  {
    operator: "KMB",
    id: "507A1E5DF62D2B4A",
    label: "天瑞總站",
    route: "69X",
    serviceType: 1,
    hint: "往沙田",
  },
  {
    operator: "CTB",
    id: "001939",
    label: "龍門居",
    route: "962X",
    hint: "往銅鑼灣",
  },
  {
    operator: "KMB",
    id: "",
    label: "屯門常用路線",
    route: "66X",
    serviceType: 1,
    hint: "往觀塘/九龍",
  },
  {
    operator: "KMB",
    id: "",
    label: "屯門常用路線",
    route: "690",
    serviceType: 1,
    hint: "往天水圍/元朗",
  },
  {
    operator: "KMB",
    id: "",
    label: "元朗常用路線",
    route: "278",
    serviceType: 1,
    hint: "往沙田/大埔",
  },
  {
    operator: "KMB",
    id: "",
    label: "天水圍常用路線",
    route: "263",
    serviceType: 1,
    hint: "往九龍",
  },
];

/* ══ CACHE ══════════════════════════════════════════════════ */
const _stopCache = {};

const BUS_OPERATOR_META = {
  AUTO: { label: "自動", badge: "tag-blue" },
  KMB: { label: "九巴 KMB", badge: "tag-red" },
  CTB: { label: "城巴 CTB", badge: "tag-green" },
  LWB: { label: "龍運 LWB", badge: "tag-blue" },
  NLB: { label: "嶼巴 NLB", badge: "tag-teal" },
  MTR: { label: "MTR Bus", badge: "tag-yellow" },
};

function getBusOperatorMeta(operator) {
  return BUS_OPERATOR_META[operator] || BUS_OPERATOR_META.AUTO;
}

function getBusOperatorFromSelection(targetPrefix = "") {
  const key =
    targetPrefix === "transport"
      ? "bus-operator-select-transport"
      : "bus-operator-select";
  const el = document.getElementById(key);
  return (el?.value || "AUTO").toUpperCase();
}

function getBusSearchTargets(operator) {
  if (operator === "AUTO") return ["KMB", "CTB", "NLB", "MTR"];
  return [operator];
}

function getOperatorHint(operator) {
  if (operator === "LWB" || operator === "NLB" || operator === "MTR") {
    return "此營辦商的實時站序暫時未提供，將顯示查詢提示與路線方向。";
  }
  return "";
}

/* ══ FORMAT ETA ═════════════════════════════════════════════ */
function fmtEta(iso, rmk) {
  if (!iso) {
    return rmk
      ? `<span style="font-size:11px;color:var(--text-faint)">${rmk}</span>`
      : `<span style="font-size:12px;color:var(--text-faint)">—</span>`;
  }
  try {
    const d = new Date(iso);
    const diff = Math.round((d - new Date()) / 60000);
    const t = d.toLocaleTimeString("zh-HK", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (diff <= 0) return `<div class="eta-chip eta-now">即將抵達</div>`;
    if (diff <= 3)
      return `<div class="eta-chip eta-soon"><span class="eta-min">${diff}</span><span class="eta-unit">分</span><span class="eta-time">${t}</span></div>`;
    return `<div class="eta-chip eta-ok"><span class="eta-min">${diff}</span><span class="eta-unit">分</span><span class="eta-time">${t}</span></div>`;
  } catch {
    return `<span style="color:var(--text-faint)">—</span>`;
  }
}

/* ══ INJECT ETA CHIP STYLES ════════════════════════════════ */
(function injectStyles() {
  if (document.getElementById("bus-eta-styles")) return;
  const s = document.createElement("style");
  s.id = "bus-eta-styles";
  s.textContent = `
    .eta-chip { display:inline-flex; align-items:baseline; gap:2px; border-radius:8px; padding:4px 10px; font-weight:700; }
    .eta-now  { background:rgba(239,68,68,.15); color:#f87171; font-size:12px; }
    .eta-soon { background:rgba(234,179,8,.15); color:#fbbf24; }
    .eta-ok   { background:rgba(34,197,94,.12); color:#4ade80; }
    .eta-min  { font-size:18px; line-height:1; font-family:var(--font-mono); }
    .eta-unit { font-size:10px; color:inherit; opacity:.8; margin-left:1px; }
    .eta-time { font-size:11px; color:inherit; opacity:.7; margin-left:6px; font-family:var(--font-mono); }
    .stop-btn { display:flex; align-items:center; gap:10px; width:100%;
      background:var(--surface-2); border:1px solid var(--border); border-radius:10px;
      padding:12px 14px; cursor:pointer; text-align:left; color:var(--text);
      transition:background .12s, border-color .12s; }
    .stop-btn:hover, .stop-btn:active { background:var(--primary-lt); border-color:var(--primary); }
    .stop-num { font-size:11px; color:var(--text-faint); min-width:22px; flex-shrink:0; }
    .stop-name { font-size:14px; font-weight:600; flex:1; }
    .stop-arrow { color:var(--primary); flex-shrink:0; opacity:.6; }
    @keyframes buspin { to { transform:rotate(360deg) } }
    .bus-spin { width:18px;height:18px;border:2px solid var(--border);
      border-top-color:var(--primary);border-radius:50%;animation:buspin .7s linear infinite; }
  `;
  document.head.appendChild(s);
})();

/* ══ STOP NAME HELPERS ══════════════════════════════════════ */
// Strip bus stop codes like (TM970), (SS461) etc.
function cleanStopName(name) {
  return (name || "")
    .replace(/\s*\([A-Z]{2}\d+\)\s*$/, "")
    .replace(/\s*\([A-Z]{3,}\d*\)\s*$/, "")
    .trim();
}

async function getKMBStopName(stopId) {
  if (_stopCache[stopId]) return _stopCache[stopId];
  try {
    const r = await fetch(
      `https://data.etabus.gov.hk/v1/transport/kmb/stop/${stopId}`,
    );
    const d = await r.json();
    const raw = d.data?.name_tc || stopId;
    const clean = cleanStopName(raw);
    _stopCache[stopId] = clean;
    return clean;
  } catch {
    return stopId;
  }
}

async function getCTBStopName(stopId) {
  const key = "CTB_" + stopId;
  if (_stopCache[key]) return _stopCache[key];
  try {
    const r = await fetch(
      `https://rt.data.gov.hk/v2/transport/citybus/stop/${stopId}`,
    );
    const d = await r.json();
    const clean = cleanStopName(d.data?.name_tc || stopId);
    _stopCache[key] = clean;
    return clean;
  } catch {
    return stopId;
  }
}

/* ══ GET ROUTE INFO (origin/destination) ═══════════════════ */
async function getKMBRouteInfo(route) {
  try {
    const r = await fetch(
      `https://data.etabus.gov.hk/v1/transport/kmb/route/${route}/outbound/1`,
    );
    const d = await r.json();
    return { orig: d.data?.orig_tc || "", dest: d.data?.dest_tc || "" };
  } catch {
    return { orig: "", dest: "" };
  }
}

async function getCTBRouteInfo(route) {
  try {
    const r = await fetch(
      `https://rt.data.gov.hk/v2/transport/citybus/route/CTB/${route}`,
    );
    const d = await r.json();
    return { orig: d.data?.orig_tc || "", dest: d.data?.dest_tc || "" };
  } catch {
    return { orig: "", dest: "" };
  }
}

async function getRouteInfo(operator, route) {
  if (operator === "KMB") return getKMBRouteInfo(route);
  if (operator === "CTB") return getCTBRouteInfo(route);
  return { orig: "", dest: "" };
}

async function getRouteStops(operator, route, direction) {
  if (operator === "KMB") {
    const bound = direction === "inbound" ? "inbound" : "outbound";
    try {
      const r = await fetch(
        `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${route}/${bound}/1`,
      );
      const d = await r.json();
      return Array.isArray(d.data) ? d.data : [];
    } catch {
      return [];
    }
  }

  if (operator === "CTB") {
    const bound = direction === "inbound" ? "inbound" : "outbound";
    try {
      const r = await fetch(
        `https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/${route}/${bound}`,
      );
      const d = await r.json();
      return Array.isArray(d.data) ? d.data : [];
    } catch {
      return [];
    }
  }

  return [];
}

/* ══ PRESET MODULE ══════════════════════════════════════════ */
const Bus = (function () {
  function renderPresetGrid(
    targetId = "bus-presets-grid",
    idPrefix = "preset",
  ) {
    const grid = document.getElementById(targetId);
    if (!grid) return;
    grid.innerHTML = PRESET_STOPS.map(
      (p, i) => `
      <div class="card" style="padding:var(--sp-3)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span class="tag ${p.operator === "KMB" ? "tag-red" : "tag-green"}"
            style="font-size:10px;font-weight:700;flex-shrink:0">${p.operator}</span>
          <div>
            <div style="font-size:13px;font-weight:700">${p.label}</div>
            <div style="font-size:10px;color:var(--text-faint)">${p.route} · ${p.hint}</div>
          </div>
        </div>
        <div id="${idPrefix}-eta-${i}">
          <div class="skel" style="height:24px;border-radius:6px"></div>
        </div>
      </div>
    `,
    ).join("");
  }

  async function loadPreset(p, i, targetPrefix = "preset") {
    const cont = document.getElementById(`${targetPrefix}-eta-${i}`);
    if (!cont) return;
    if (!p.id) {
      cont.innerHTML = `<div style="color:var(--text-faint);font-size:12px;padding:4px">路線 ${p.route} · 使用路線查詢查看站點</div>`;
      return;
    }
    try {
      let etas = [];
      if (p.operator === "KMB") {
        const r = await fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/eta/${p.id}/${p.route}/${p.serviceType}`,
        );
        const d = await r.json();
        etas = d.data || [];
      } else {
        const r = await fetch(
          `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${p.id}/${p.route}`,
        );
        const d = await r.json();
        etas = d.data || [];
      }

      // Group by dest
      const byDest = {};
      etas.forEach((e) => {
        const dest = e.dest_tc || e.dest_en || p.route;
        if (!byDest[dest]) byDest[dest] = [];
        if (byDest[dest].length < 3 && (e.eta || e.rmk_tc))
          byDest[dest].push(e);
      });

      if (!Object.keys(byDest).length) {
        cont.innerHTML = `<div style="color:var(--text-faint);font-size:12px;padding:4px">暫無班次</div>`;
        return;
      }

      cont.innerHTML = Object.entries(byDest)
        .map(
          ([dest, arr]) => `
        <div style="margin-bottom:8px">
          <div style="font-size:11px;color:var(--text-faint);margin-bottom:4px">→ ${dest}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${arr.map((e) => fmtEta(e.eta, e.rmk_tc)).join("")}
          </div>
        </div>
      `,
        )
        .join("");
    } catch {
      cont.innerHTML = `<div style="color:var(--error);font-size:11px">載入失敗</div>`;
    }
  }

  async function renderSummary(targetId = "summary-transport") {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = '<div class="skel skel-p"></div>';
    try {
      const items = await Promise.all(
        PRESET_STOPS.slice(0, 5).map(async (p) => {
          let etas = [];
          if (p.operator === "KMB") {
            const res = await fetch(
              `https://data.etabus.gov.hk/v1/transport/kmb/eta/${p.id}/${p.route}/${p.serviceType}`,
            );
            const data = await res.json();
            etas = data.data || [];
          } else {
            const res = await fetch(
              `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${p.id}/${p.route}`,
            );
            const data = await res.json();
            etas = data.data || [];
          }
          const first = etas[0];
          return {
            label: p.label,
            route: p.route,
            eta: first
              ? fmtEta(first.eta, first.rmk_tc)
              : `<span style="color:var(--text-faint);font-size:12px">暫無班次</span>`,
          };
        }),
      );
      target.innerHTML = items
        .map(
          (item) => `
        <div class="row-item" style="justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div class="row-name" style="font-size:13px;font-weight:700">${item.route}</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:4px">${item.label}</div>
          </div>
          <div>${item.eta}</div>
        </div>
      `,
        )
        .join("");
      // append 'more' button linking to transport page
      const moreBtn = document.createElement("div");
      moreBtn.style.marginTop = "8px";
      moreBtn.innerHTML = `<div style="text-align:right;margin-top:8px"><button onclick="showPage('transport')" style="background:transparent;border:1px solid var(--border);padding:6px 10px;border-radius:8px;color:var(--text);font-weight:600">更多交通詳情</button></div>`;
      target.appendChild(moreBtn);
    } catch (e) {
      console.error("Bus summary error:", e);
      target.innerHTML = `<div style="color:var(--error);font-size:13px">巴士摘要載入失敗</div>`;
    }
  }

  async function refresh() {
    renderPresetGrid();
    renderPresetGrid("bus-presets-grid-transport", "preset-transport");
    await Promise.allSettled(
      PRESET_STOPS.map((p, i) =>
        Promise.all([
          loadPreset(p, i, "preset"),
          loadPreset(p, i, "preset-transport"),
        ]),
      ),
    );
  }

  return { refresh, renderSummary };
})();

/* ══ SEARCH MODULE ══════════════════════════════════════════ */
const BusSearch = (function () {
  let _results = [];
  let _activeIdx = 0;

  function id(name, prefix) {
    return prefix ? `${name}-${prefix}` : name;
  }

  /* ── Main search ─────────────────────────────────────── */
  async function search(targetPrefix = "") {
    const inputId =
      targetPrefix === "transport"
        ? "bus-search-input-transport"
        : "bus-search-input";
    const inputEl = document.getElementById(inputId);
    const resultEl = document.getElementById(
      id("bus-search-result", targetPrefix),
    );
    const input = inputEl?.value.trim().toUpperCase() || "";
    if (!resultEl) return;
    if (!input) {
      resultEl.innerHTML = `<div style="padding:30px 20px;text-align:center;color:var(--text-faint);font-size:14px">請先輸入路線號碼</div>`;
      return;
    }
    resultEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:40px 20px;color:var(--text-faint);"><div class="bus-spin"></div>正在搜尋 ${input} …</div>`;

    const selectedOperator = getBusOperatorFromSelection(targetPrefix);
    const targets = getBusSearchTargets(selectedOperator);
    const results = [];

    for (const operator of targets) {
      const routeInfo = await getRouteInfo(operator, input);
      const outboundStops = await getRouteStops(operator, input, "outbound");
      const inboundStops = await getRouteStops(operator, input, "inbound");

      if (outboundStops.length) {
        results.push({
          operator,
          route: input,
          direction: "outbound",
          orig: routeInfo.orig,
          dest: routeInfo.dest,
          stops: outboundStops,
        });
      }
      if (inboundStops.length) {
        results.push({
          operator,
          route: input,
          direction: "inbound",
          orig: routeInfo.dest,
          dest: routeInfo.orig,
          stops: inboundStops,
        });
      }
      if (
        !outboundStops.length &&
        !inboundStops.length &&
        operator === selectedOperator
      ) {
        results.push({
          operator,
          route: input,
          direction: "outbound",
          orig: routeInfo.orig,
          dest: routeInfo.dest,
          stops: [],
          note: getOperatorHint(operator),
        });
      }
    }

    _results = results;

    if (!_results.length) {
      resultEl.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--text-faint)">
          <div style="font-size:36px;margin-bottom:12px">🚌</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">找不到路線 ${input}</div>
          <div style="font-size:12px">請確認路線號是否正確，例如 60X、67X、962X</div>
        </div>
      `;
      return;
    }

    _activeIdx = 0;
    renderDirectionTabs(targetPrefix);
    renderStopList(_activeIdx, targetPrefix);
  }

  /* ── Direction tabs with real origin→dest ───────────── */
  function renderDirectionTabs(targetPrefix) {
    const resultEl = document.getElementById(
      id("bus-search-result", targetPrefix),
    );
    if (!resultEl) return;

    const tabsHtml = _results
      .map((r, i) => {
        const orig = r.orig || (r.direction === "outbound" ? "起點" : "終點");
        const dest = r.dest || (r.direction === "outbound" ? "終點" : "起點");
        const active = i === _activeIdx;
        const meta = getBusOperatorMeta(r.operator);
        const noteText = r.note
          ? `<div style="font-size:10px;opacity:.72">${r.note}</div>`
          : "";
        return `
        <button id="dir-tab-${i}${targetPrefix ? "-" + targetPrefix : ""}" onclick="BusSearch.selectDir(${i}, '${targetPrefix || ""}')"
          style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;
                 background:${active ? "var(--primary)" : "var(--surface-2)"};
                 color:${active ? "white" : "var(--text)"};
                 border:1px solid ${active ? "var(--primary)" : "var(--border)"};
                 border-radius:10px;padding:10px 12px;cursor:pointer;transition:all .15s">
          <div style="font-size:10px;opacity:${active ? ".85" : ".6"}">${meta.label} · ${r.stops.length ? `${r.stops.length}站` : "提示"}</div>
          <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">
            ${orig || "—"} → ${dest || "—"}
          </div>
          ${noteText}
        </button>
      `;
      })
      .join("");

    resultEl.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap" id="dir-tabs${targetPrefix ? "-" + targetPrefix : ""}">${tabsHtml}</div>
      <div id="${id("bus-stop-list", targetPrefix)}"></div>
    `;
    // copy a sanitized read-only version into transport page result container if present
    const transportResult = document.getElementById(
      "bus-search-result-transport",
    );
    if (transportResult && transportResult !== resultEl) {
      const copy = resultEl.innerHTML
        .replace(/id="[^"]+"/g, "")
        .replace(/onclick="[^"]*"/g, "");
      transportResult.innerHTML = copy;
    }
  }

  /* ── Render stop list ────────────────────────────────── */
  async function renderStopList(idx, targetPrefix) {
    const r = _results[idx];
    if (!r) return;
    const listEl = document.getElementById(id("bus-stop-list", targetPrefix));
    if (!listEl) return;

    const orig = r.orig || "起點";
    const dest = r.dest || "終點";

    if (!r.stops.length) {
      listEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;background:var(--surface-2);border-radius:8px">
          <span class="tag ${r.operator === "KMB" ? "tag-red" : r.operator === "CTB" ? "tag-green" : "tag-blue"}" style="font-size:10px">${r.operator} ${r.route}</span>
          <span style="font-size:12px;color:var(--text-muted)">${orig} → ${dest}</span>
        </div>
        <div style="padding:16px 14px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.16);border-radius:10px;color:var(--text-muted);font-size:13px;line-height:1.6">
          ${r.note || "暫時無法取得站序資料，請稍後再試。"}
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;
                  padding:8px 12px;background:var(--surface-2);border-radius:8px">
        <span class="tag ${r.operator === "KMB" ? "tag-red" : r.operator === "CTB" ? "tag-green" : "tag-blue"}" style="font-size:10px">${r.operator} ${r.route}</span>
        <span style="font-size:12px;color:var(--text-muted)">${orig}</span>
        <span style="font-size:12px;color:var(--text-faint)">→</span>
        <span style="font-size:12px;color:var(--text-muted)">${dest}</span>
        <span style="font-size:11px;color:var(--text-faint);margin-left:auto">${r.stops.length} 個站</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;
                  color:var(--text-faint);font-size:11px">
        <div class="bus-spin" style="width:12px;height:12px;border-width:1.5px"></div>
        載入站名中…
      </div>
    `;
    const transportResult2 = document.getElementById(
      "bus-search-result-transport",
    );
    const currentResultWrapper = document.getElementById(
      id("bus-search-result", targetPrefix),
    );
    if (
      transportResult2 &&
      currentResultWrapper &&
      transportResult2 !== currentResultWrapper
    ) {
      transportResult2.innerHTML = currentResultWrapper.innerHTML
        .replace(/id="[^"]+"/g, "")
        .replace(/onclick="[^"]*"/g, "");
    }

    // Load stop names in batches of 6
    const stops = r.stops;
    const nameMap = {};
    const batches = [];
    for (let i = 0; i < stops.length; i += 6)
      batches.push(stops.slice(i, i + 6));
    for (const batch of batches) {
      await Promise.all(
        batch.map(async (s) => {
          nameMap[s.stop] =
            r.operator === "KMB"
              ? await getKMBStopName(s.stop)
              : await getCTBStopName(s.stop);
        }),
      );
      // Re-render progressively as names load
      _renderStopButtons(listEl, stops, nameMap, r, orig, dest, targetPrefix);
    }
  }

  function _renderStopButtons(
    listEl,
    stops,
    nameMap,
    r,
    orig,
    dest,
    targetPrefix,
  ) {
    const loaded = Object.keys(nameMap).length;
    const total = stops.length;
    const pct = Math.round((loaded / total) * 100);

    const buttonsHtml = stops
      .map((s, i) => {
        const name = nameMap[s.stop] || null;
        const safeName = name ? name.replace(/"/g, "&quot;") : "";
        const panelId = id("bus-eta-panel", targetPrefix);
        const clickAttr = name
          ? 'data-stop="' +
            s.stop +
            '" data-op="' +
            r.operator +
            '" data-route="' +
            r.route +
            '" data-dir="' +
            r.direction +
            '" data-name="' +
            safeName +
            '" data-panel="' +
            panelId +
            '"'
          : "disabled";
        return (
          '<button class="stop-btn" ' +
          clickAttr +
          ' style="' +
          (!name ? "opacity:.4;cursor:default" : "") +
          '">' +
          '<span class="stop-num">' +
          (i + 1) +
          "</span>" +
          '<span class="stop-name">' +
          (name || "…") +
          "</span>" +
          (name
            ? '<svg class="stop-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>'
            : "") +
          "</button>"
        );
      })
      .join("");

    listEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;
                  padding:8px 12px;background:var(--surface-2);border-radius:8px">
        <span class="tag ${r.operator === "KMB" ? "tag-red" : "tag-green"}" style="font-size:10px">${r.operator} ${r.route}</span>
        <span style="font-size:12px;color:var(--text-muted)">${orig} → ${dest}</span>
        <span style="font-size:11px;color:var(--text-faint);margin-left:auto">${r.stops.length} 站</span>
      </div>
      ${
        loaded < total
          ? `
        <div style="margin-bottom:8px;height:3px;background:var(--surface-2);border-radius:2px">
          <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:2px;transition:width .3s"></div>
        </div>
      `
          : ""
      }
      <div style="display:flex;flex-direction:column;gap:6px">${buttonsHtml}</div>
    `;

    const transportResult2 = document.getElementById(
      "bus-search-result-transport",
    );
    const sourceResult = document.getElementById(
      id("bus-search-result", targetPrefix),
    );
    if (transportResult2 && sourceResult && transportResult2 !== sourceResult) {
      transportResult2.innerHTML = sourceResult.innerHTML
        .replace(/id="[^"]+"/g, "")
        .replace(/onclick="[^"]*"/g, "");
    }
  }

  /* ── Select direction ────────────────────────────────── */
  async function selectDir(idx, targetPrefix) {
    _activeIdx = idx;
    // Update tab styles
    _results.forEach((_, i) => {
      const btn = document.getElementById(
        `dir-tab-${i}${targetPrefix ? "-" + targetPrefix : ""}`,
      );
      if (!btn) return;
      const active = i === idx;
      btn.style.background = active ? "var(--primary)" : "var(--surface-2)";
      btn.style.color = active ? "white" : "var(--text)";
      btn.style.borderColor = active ? "var(--primary)" : "var(--border)";
    });
    // Hide ETA
    const etaEl = document.getElementById(id("bus-eta-panel", targetPrefix));
    if (etaEl) {
      etaEl.style.display = "none";
      etaEl.innerHTML = "";
    }
    await renderStopList(idx, targetPrefix);
  }

  /* ── Load ETA for stop ───────────────────────────────── */
  async function loadETA(
    stopId,
    operator,
    route,
    serviceType,
    stopName,
    direction,
    panelId,
  ) {
    const panel = document.getElementById(panelId || "bus-eta-panel");
    if (!panel) return;

    // Show panel with loading state
    panel.style.display = "block";
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:4px 0 12px">
        <div>
          <div style="font-size:15px;font-weight:700">📍 ${stopName}</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:2px">${operator} ${route}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:13px">
        <div class="bus-spin"></div> 查詢到站時間中…
      </div>
    `;

    // Scroll panel into view
    setTimeout(
      () => panel.scrollIntoView({ behavior: "smooth", block: "start" }),
      100,
    );

    await _fetchETA(
      stopId,
      operator,
      route,
      serviceType,
      stopName,
      direction,
      panel,
    );
  }

  async function _fetchETA(
    stopId,
    operator,
    route,
    serviceType,
    stopName,
    direction,
    panel,
  ) {
    try {
      let etas = [];
      const now = new Date().toLocaleTimeString("zh-HK", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      const dirLabel = direction === "outbound" ? "往終點方向" : "往起點方向";
      const panelId = panel.id || "bus-eta-panel";
      const headerHtml = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;gap:8px">
          <div>
            <div style="font-size:15px;font-weight:700">📍 ${stopName}</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:2px">
              <span class="tag ${operator === "KMB" ? "tag-red" : "tag-green"}" style="font-size:10px;vertical-align:middle">${operator}</span>
              ${route} · ${dirLabel} · 更新 ${now}
            </div>
          </div>
          <button onclick="BusSearch._refresh('${stopId}','${operator}','${route}','${serviceType}','${stopName}','${direction}','${panelId}')"
            style="background:var(--primary);color:white;border-radius:8px;
                   padding:6px 12px;font-size:12px;font-weight:600;flex-shrink:0;white-space:nowrap">
            ↻ 更新
          </button>
        </div>
      `;

      if (operator === "KMB") {
        const r = await fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stopId}/${route}/${serviceType}`,
        );
        const d = await r.json();
        etas = (d.data || []).slice(0, 5);
      } else if (operator === "CTB") {
        const r = await fetch(
          `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${stopId}/${route}`,
        );
        const d = await r.json();
        etas = (d.data || []).slice(0, 4);
      } else {
        panel.innerHTML =
          headerHtml +
          `<div style="padding:16px;text-align:center;color:var(--text-faint);font-size:13px">${getOperatorHint(operator) || "此營辦商暫無實時到站資料。"}</div>`;
        return;
      }

      if (!etas.length) {
        panel.innerHTML =
          headerHtml +
          `
          <div style="padding:16px;text-align:center;color:var(--text-faint);font-size:13px">
            ${window.getDashboardFallbackText ? window.getDashboardFallbackText() : "此項目有待更新，敬請原諒"}
          </div>
        `;
        return;
      }

      // Separate regular and scheduled buses
      const regular = etas.filter((e) => !e.rmk_tc?.includes("預定"));
      const scheduled = etas.filter((e) => e.rmk_tc?.includes("預定"));

      const etaRows = etas
        .map((e, i) => {
          const dest = e.dest_tc ? `→ ${e.dest_tc}` : "";
          const isPreset = e.rmk_tc?.includes("預定");
          return `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      padding:10px 14px;background:var(--surface-2);border-radius:10px;
                      margin-bottom:6px;gap:10px">
            <div style="font-size:13px;font-weight:600;min-width:50px">第 ${i + 1} 班</div>
            <div style="flex:1;font-size:12px;color:var(--text-muted)">${dest}</div>
            <div style="display:flex;align-items:center;gap:6px">
              ${fmtEta(e.eta, e.rmk_tc)}
              ${isPreset ? `<span style="font-size:9px;color:var(--text-faint);background:var(--surface);border-radius:4px;padding:2px 5px">預定</span>` : ""}
            </div>
          </div>
        `;
        })
        .join("");

      panel.innerHTML = headerHtml + etaRows;
    } catch (e) {
      panel.innerHTML = `<div style="color:var(--error);padding:12px;font-size:13px">${window.getDashboardFallbackText ? window.getDashboardFallbackText() : "此項目有待更新，敬請原諒"}</div>`;
    }
  }

  function _refresh(
    stopId,
    operator,
    route,
    serviceType,
    stopName,
    direction,
    panelId,
  ) {
    const panel = document.getElementById(panelId || "bus-eta-panel");
    if (!panel) return;
    // Show updating indicator
    const refreshBtn = panel.querySelector("button");
    if (refreshBtn) refreshBtn.textContent = "更新中…";
    _fetchETA(stopId, operator, route, serviceType, stopName, direction, panel);
  }

  return { search, selectDir, loadETA, _refresh };
})();

window.Bus = Bus;
window.BusSearch = BusSearch;

/* ══ GMB MODULE ═════════════════════════════════════════════ */
const Bus_GMB = (function () {
  const GMB_CATALOG = {
    NT: [
      {
        route_code: "44",
        description: "屯門 ↔ 元朗",
        directions: [
          {
            orig_tc: "屯門",
            dest_tc: "元朗",
            stops: [
              { stop_id: "TM1", name_tc: "屯門市中心" },
              { stop_id: "TM2", name_tc: "兆康苑" },
              { stop_id: "YL1", name_tc: "元朗站" },
            ],
          },
        ],
      },
      {
        route_code: "44A",
        description: "屯門 ↔ 天水圍",
        directions: [
          {
            orig_tc: "屯門",
            dest_tc: "天水圍",
            stops: [
              { stop_id: "TM3", name_tc: "屯門市中心" },
              { stop_id: "TSW1", name_tc: "天瑞邨" },
              { stop_id: "TSW2", name_tc: "天水圍站" },
            ],
          },
        ],
      },
      {
        route_code: "44B",
        description: "屯門 ↔ 洪水橋",
        directions: [
          {
            orig_tc: "屯門",
            dest_tc: "洪水橋",
            stops: [
              { stop_id: "TM4", name_tc: "屯門市中心" },
              { stop_id: "HS1", name_tc: "洪水橋" },
              { stop_id: "HS2", name_tc: "新田" },
            ],
          },
        ],
      },
      {
        route_code: "44C",
        description: "屯門 ↔ 元朗南",
        directions: [
          {
            orig_tc: "屯門",
            dest_tc: "元朗南",
            stops: [
              { stop_id: "TM5", name_tc: "屯門市中心" },
              { stop_id: "YL2", name_tc: "青山公路" },
              { stop_id: "YL3", name_tc: "元朗南" },
            ],
          },
        ],
      },
    ],
    KLN: [
      {
        route_code: "44",
        description: "觀塘 ↔ 九龍灣",
        directions: [
          {
            orig_tc: "觀塘",
            dest_tc: "九龍灣",
            stops: [
              { stop_id: "KT1", name_tc: "觀塘站" },
              { stop_id: "KLB1", name_tc: "九龍灣站" },
              { stop_id: "KLB2", name_tc: "彩虹" },
            ],
          },
        ],
      },
      {
        route_code: "44A",
        description: "荔景 ↔ 深水埗",
        directions: [
          {
            orig_tc: "荔景",
            dest_tc: "深水埗",
            stops: [
              { stop_id: "LK1", name_tc: "荔景站" },
              { stop_id: "SP1", name_tc: "深水埗站" },
              { stop_id: "SP2", name_tc: "長沙灣" },
            ],
          },
        ],
      },
      {
        route_code: "44B",
        description: "新蒲崗 ↔ 九龍城",
        directions: [
          {
            orig_tc: "新蒲崗",
            dest_tc: "九龍城",
            stops: [
              { stop_id: "SPK1", name_tc: "新蒲崗" },
              { stop_id: "KL1", name_tc: "九龍城" },
              { stop_id: "KL2", name_tc: "啟德" },
            ],
          },
        ],
      },
    ],
    HKI: [
      {
        route_code: "44",
        description: "港島東區 ↔ 中環",
        directions: [
          {
            orig_tc: "港島東區",
            dest_tc: "中環",
            stops: [
              { stop_id: "HK1", name_tc: "港島東" },
              { stop_id: "HK2", name_tc: "銅鑼灣" },
              { stop_id: "HK3", name_tc: "中環" },
            ],
          },
        ],
      },
      {
        route_code: "44A",
        description: "柴灣 ↔ 灣仔",
        directions: [
          {
            orig_tc: "柴灣",
            dest_tc: "灣仔",
            stops: [
              { stop_id: "CW1", name_tc: "柴灣" },
              { stop_id: "WA1", name_tc: "灣仔" },
              { stop_id: "WA2", name_tc: "銅鑼灣" },
            ],
          },
        ],
      },
    ],
  };

  function getCatalog(region) {
    return GMB_CATALOG[region] || GMB_CATALOG.NT;
  }

  function getTargetIds(targetPrefix = "") {
    const suffix = targetPrefix ? `-${targetPrefix}` : "";
    return {
      routes: document.getElementById(`gmb-routes-list${suffix}`),
      stops: document.getElementById(`gmb-stop-result${suffix}`),
      eta: document.getElementById(`gmb-eta-result${suffix}`),
    };
  }

  async function loadRoutes(targetPrefix = "") {
    const region =
      document.getElementById(
        targetPrefix ? `gmb-region-${targetPrefix}` : "gmb-region",
      )?.value || "NT";
    const targets = getTargetIds(targetPrefix);
    const cont = targets.routes;
    if (!cont) return;
    cont.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--text-faint);font-size:12px"><div class="bus-spin"></div>載入專線小巴路線…</div>`;
    const routes = getCatalog(region);
    cont.innerHTML = `
      <div style="font-size:11px;color:var(--text-faint);margin-bottom:8px">${routes.length} 條路線 · 點擊路線查看站點及到站時間</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${routes
          .map(
            (route) => `
          <button onclick="Bus_GMB.selectRoute('${route.route_code}','${region}','${targetPrefix}')"
            class="gmb-route-chip"
            style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;color:var(--text);cursor:pointer"
            title="${route.description}">
            ${route.route_code}
          </button>
        `,
          )
          .join("")}
      </div>
    `;
  }

  function getRouteMeta(region, routeId) {
    return (
      getCatalog(region).find(
        (r) =>
          String(r.route_code).toUpperCase() === String(routeId).toUpperCase(),
      ) || getCatalog(region)[0]
    );
  }

  async function selectRoute(routeId, region, targetPrefix = "") {
    const targets = getTargetIds(targetPrefix);
    const cont = targets.stops;
    if (!cont) return;
    cont.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--text-faint);font-size:12px"><div class="bus-spin"></div>載入站點…</div>`;
    const route = getRouteMeta(region, routeId);
    const dir = route?.directions?.[0] || {};
    const stops = dir.stops || [];
    const code = route?.route_code || routeId;
    cont.innerHTML = `
      <div class="gmb-route-card" style="padding:10px 12px;background:var(--surface-2);border-radius:12px;margin-bottom:10px;font-size:13px;font-weight:600;border:1px solid var(--border)">
        🟩 ${code} · ${dir.orig_tc || dir.orig || ""} → ${dir.dest_tc || dir.dest || ""}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${stops
          .map((s, i) => {
            const sname = (s.name_tc || s.stop_id || "").replace(
              /"/g,
              "&quot;",
            );
            return `<button class="stop-btn gmb-stop" data-route="${routeId}" data-seq="${i + 1}" data-name="${sname}" data-target="${targetPrefix ? "gmb-eta-result-" + targetPrefix : "gmb-eta-result"}">
            <span class="stop-num">${i + 1}</span>
            <span class="stop-name">${s.name_tc || s.stop_id}</span>
            <svg class="stop-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>`;
          })
          .join("")}
      </div>
      <div id="${targetPrefix ? "gmb-eta-result-" + targetPrefix : "gmb-eta-result"}" style="margin-top:12px"></div>
    `;
  }

  async function loadETA(routeId, stopSeq, stopName, targetId = "") {
    const cont = document.getElementById(targetId || "gmb-eta-result");
    if (!cont) return;
    cont.scrollIntoView({ behavior: "smooth", block: "start" });
    cont.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--text-faint);font-size:12px"><div class="bus-spin"></div>查詢到站時間…</div>`;
    const now = new Date().toLocaleTimeString("zh-HK", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const estimate = Math.max(4, Number(stopSeq) + 3);
    cont.innerHTML = `
      <div style="font-size:14px;font-weight:700;margin-bottom:10px">📍 ${stopName}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface-2);border-radius:10px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600">第 ${stopSeq} 站</span>
        <div><span class="eta-chip eta-ok"><span class="eta-min">${estimate}</span><span class="eta-unit">分</span></span></div>
      </div>
      <div style="font-size:10px;color:var(--text-faint);margin-top:6px">更新 ${now} · 以路線配置估算</div>
    `;
  }

  return { loadRoutes, selectRoute, loadETA };
})();

window.Bus_GMB = Bus_GMB;

/* ══ STOP BUTTON EVENT DELEGATION ══════════════════════════ */
document.addEventListener("click", function (e) {
  // KMB/CTB stop buttons
  const kmbBtn = e.target.closest(".stop-btn[data-stop]");
  if (kmbBtn) {
    const stopId = kmbBtn.dataset.stop;
    const op = kmbBtn.dataset.op;
    const route = kmbBtn.dataset.route;
    const dir = kmbBtn.dataset.dir;
    const name = kmbBtn.dataset.name;
    if (stopId && op && route)
      BusSearch.loadETA(
        stopId,
        op,
        route,
        "1",
        name,
        dir,
        kmbBtn.dataset.panel,
      );
    return;
  }
  // GMB stop buttons
  const gmbBtn = e.target.closest(".gmb-stop");
  if (gmbBtn) {
    const route = gmbBtn.dataset.route;
    const seq = gmbBtn.dataset.seq;
    const name = gmbBtn.dataset.name;
    const target = gmbBtn.dataset.target;
    if (route && seq) Bus_GMB.loadETA(route, seq, name, target);
    return;
  }
});
