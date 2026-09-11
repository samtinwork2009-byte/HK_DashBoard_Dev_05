/* ============================================================
   ferry.js — NLB 渡輪路線 Ferry Routes
   香港城市儀表板 v4
   ============================================================ */

"use strict";

const Ferry = (function () {
  const NLB_API =
    "https://rt.data.gov.hk/v1/transport/nlb/route.php?action=list";
  const NLB_WEBSITE = "https://www.nlb.com.hk/route/route-bus.htm";

  let _allRoutes = [];
  let _filtered = [];

  /* ── Category detection from routeName_c ─────────────────── */
  function categorize(route) {
    const name =
      (route.routeName_c || "") +
      " " +
      (route.oName_c || "") +
      " " +
      (route.dName_c || "");
    if (/大嶼山|梅窩|長洲|愉景灣|昂坪|東涌/.test(name)) return "大嶼山 Lantau";
    if (/離島|坪洲|蒲台|南丫|索罟灣/.test(name)) return "離島 Outlying Islands";
    if (/北角|鰂魚涌/.test(name)) return "北角 North Point";
    if (/紅磡|九龍/.test(name)) return "紅磡 / 九龍 Hung Hom";
    if (/中環|上環/.test(name)) return "中環 Central";
    if (/沙田|馬料水|烏溪沙/.test(name)) return "沙田 Sha Tin";
    if (/將軍澳|調景嶺|西貢/.test(name)) return "將軍澳 / 西貢 Tseung Kwan O";
    if (/屯門|青山|龍鼓|掃管笏/.test(name)) return "屯門 Tuen Mun";
    if (/馬灣|青衣|荃灣/.test(name)) return "荃灣 / 馬灣 Tsuen Wan";
    return "其他 Other";
  }

  /* ── Parse origin→destination from routeName_c ────────────── */
  function parseRoute(route) {
    const raw = route.routeName_c || "";
    // NLB uses > as separator
    const parts = raw.split(">").map((s) => s.trim());
    const origin = route.oName_c || parts[0] || "—";
    const dest =
      route.dName_c ||
      parts[1] ||
      (parts.length > 1 ? parts[parts.length - 1] : "—");
    const routeNameE = route.routeName_e || "";
    return { origin, dest, routeNameE };
  }

  /* ── Group routes by category ─────────────────────────────── */
  function groupRoutes(routes) {
    const groups = {};
    routes.forEach((r) => {
      const cat = categorize(r);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return groups;
  }

  /* ── Render route card ─────────────────────────────────────── */
  function renderRouteItem(r) {
    const { origin, dest, routeNameE } = parseRoute(r);
    const routeNo = r.routeNo || r.routeId || "—";
    const nlbLink = `https://www.nlb.com.hk/route/detail/${r.routeId || ""}`;
    return `
      <div class="row-item" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2);padding:var(--sp-3) var(--sp-4)">
        <div style="display:flex;align-items:center;gap:var(--sp-2);width:100%;flex-wrap:wrap">
          <span class="tag tag-teal" style="font-size:10px;font-weight:700;font-family:var(--font-mono)">
            ${escHtml(routeNo)}
          </span>
          <span style="font-size:var(--text-sm);font-weight:600;color:var(--text)">
            ${escHtml(origin)} → ${escHtml(dest)}
          </span>
          <a href="${nlbLink}" target="_blank" rel="noopener"
            style="margin-left:auto;font-size:var(--text-xs);color:var(--primary);white-space:nowrap">
            查詢班次 ↗
          </a>
        </div>
        ${routeNameE ? `<div style="font-size:var(--text-xs);color:var(--text-faint)">${escHtml(routeNameE)}</div>` : ""}
      </div>
    `;
  }

  /* ── Render all groups ─────────────────────────────────────── */
  function renderGroups(routes) {
    const cont = document.getElementById("ferry-list");
    if (!cont) return;

    if (!routes.length) {
      cont.innerHTML = `<div style="padding:var(--sp-6);text-align:center;color:var(--text-faint)">無結果 No results</div>`;
      return;
    }

    const groups = groupRoutes(routes);
    // Sort category keys alphabetically
    const sortedCats = Object.keys(groups).sort();

    cont.innerHTML = sortedCats
      .map(
        (cat) => `
      <div style="margin-bottom:var(--sp-5)">
        <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3)">
          <span style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--primary)">
            ${escHtml(cat)}
          </span>
          <span class="tag tag-muted" style="font-size:10px">${groups[cat].length} 條</span>
        </div>
        <div class="row-list">
          ${groups[cat].map((r) => renderRouteItem(r)).join("")}
        </div>
      </div>
    `,
      )
      .join("");

    // Update count
    const countEl = document.getElementById("ferry-count");
    if (countEl) countEl.textContent = `共 ${routes.length} 條路線`;
  }

  /* ── Search / filter ──────────────────────────────────────── */
  function filterRoutes(query) {
    if (!query.trim()) {
      _filtered = _allRoutes;
    } else {
      const q = query.toLowerCase();
      _filtered = _allRoutes.filter((r) => {
        const searchStr = [
          r.routeNo,
          r.routeName_c,
          r.routeName_e,
          r.oName_c,
          r.dName_c,
        ]
          .join(" ")
          .toLowerCase();
        return searchStr.includes(q);
      });
    }
    renderGroups(_filtered);
  }

  /* ── HTML escape helper ────────────────────────────────────── */
  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── Main fetch + render ───────────────────────────────────── */
  async function refresh() {
    const cont = document.getElementById("ferry-list");
    const statsEl = document.getElementById("ferry-count");
    if (!cont) return;

    cont.innerHTML = `
      <div class="skel skel-p" style="margin-bottom:8px"></div>
      <div class="skel skel-p" style="margin-bottom:8px;width:70%"></div>
      <div class="skel skel-p" style="margin-bottom:8px;width:80%"></div>
      <div class="skel skel-p" style="margin-bottom:8px;width:60%"></div>
    `;

    try {
      const res = await fetch(NLB_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const routes = data.routes || [];

      _allRoutes = routes.sort((a, b) => {
        // Sort by routeNo numerically where possible
        const an = parseFloat(a.routeNo) || 999;
        const bn = parseFloat(b.routeNo) || 999;
        return an - bn || (a.routeNo || "").localeCompare(b.routeNo || "");
      });
      _filtered = _allRoutes;

      if (statsEl) statsEl.textContent = `共 ${_allRoutes.length} 條路線`;

      // Clear search
      const searchEl = document.getElementById("ferry-search");
      if (searchEl) searchEl.value = "";

      renderGroups(_allRoutes);
    } catch (e) {
      cont.innerHTML = `
        <div style="padding:var(--sp-6);text-align:center">
          <div style="color:var(--error);font-size:var(--text-sm);margin-bottom:var(--sp-2)">載入失敗 Failed to load</div>
          <div style="color:var(--text-faint);font-size:var(--text-xs)">${escHtml(e.message)}</div>
          <a href="${NLB_WEBSITE}" target="_blank" rel="noopener"
            style="display:inline-block;margin-top:var(--sp-3);color:var(--primary);font-size:var(--text-sm)">
            前往 NLB 官網 →
          </a>
        </div>
      `;
    }
  }

  /* ── Expose search to HTML ─────────────────────────────────── */
  function onSearch(query) {
    filterRoutes(query);
  }

  return { refresh, onSearch };
})();
