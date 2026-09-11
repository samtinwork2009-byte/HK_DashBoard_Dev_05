/* ============================================================
   parking.js — 停車場實時空位 Car Park Vacancy
   香港城市儀表板 v3
   資料來源：data.gov.hk 停車場資料 API
   ============================================================ */

"use strict";

const Parking = (function () {
  const API_VACANCY =
    "https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&lang=zh_TW";
  const API_INFO =
    "https://api.data.gov.hk/v1/carpark-info-vacancy?data=info&lang=zh_TW";

  /* ── District mapping ───────────────────────────────────────── */
  const DISTRICTS = {
    C: "中西區",
    E: "東區",
    S: "南區",
    WC: "灣仔",
    KC: "九龍城",
    KT: "觀塘",
    SSP: "深水埗",
    WTS: "黃大仙",
    YTM: "油尖旺",
    IS: "離島",
    KTS: "葵青",
    N: "北區",
    SK: "西貢",
    ST: "沙田",
    TP: "大埔",
    TW: "荃灣",
    TM: "屯門",
    YL: "元朗",
  };

  let _allParks = [];
  let _filtered = [];

  /* ── Fetch info + vacancy and merge ─────────────────────────── */
  async function fetchAllParking() {
    const [vacRes, infoRes] = await Promise.all([
      fetch(API_VACANCY),
      fetch(API_INFO),
    ]);
    if (!vacRes.ok) throw new Error(`Vacancy API HTTP ${vacRes.status}`);
    const vacData = await vacRes.json();
    const infoData = infoRes.ok ? await infoRes.json() : { results: [] };

    const vacList = vacData.results || [];
    const infoList = infoData.results || [];

    // Build info lookup by park_Id
    const infoMap = {};
    infoList.forEach((p) => {
      infoMap[p.park_Id] = p;
    });

    // Merge vacancy with info
    return vacList.map((vac) => {
      const info = infoMap[vac.park_Id] || {};
      return {
        park_Id: vac.park_Id,
        name: info.name || vac.park_Id,
        district: info.district || "",
        address: info.displayAddress || "",
        nature: info.nature || "",
        // Normalise vehicle types into array format
        vehicle_type: [
          { type: "privateCar", vacancy: vac.privateCar?.[0]?.vacancy ?? null },
          { type: "motorCycle", vacancy: vac.motorCycle?.[0]?.vacancy ?? null },
          { type: "LGV", vacancy: vac.LGV?.[0]?.vacancy ?? null },
        ],
        lastupdate: vac.privateCar?.[0]?.lastupdate || "",
      };
    });
  }

  /* ── Get vacancy number ─────────────────────────────────────── */
  function getVacancy(park, type = "privateCar") {
    const spaces = park.vehicle_type || [];
    const entry = spaces.find((v) => v.type === type);
    if (!entry) return null;
    const vac = entry.vacancy;
    if (
      vac === undefined ||
      vac === null ||
      vac === -1 ||
      vac === "-" ||
      vac === ""
    )
      return null;
    return parseInt(vac, 10);
  }

  /* ── Vacancy color tag ──────────────────────────────────────── */
  function vacancyTag(vac) {
    if (vac === null) return `<span class="tag tag-muted">—</span>`;
    if (vac === 0) return `<span class="tag tag-red">滿 Full</span>`;
    if (vac <= 10) return `<span class="tag tag-yellow">${vac}</span>`;
    if (vac <= 50) return `<span class="tag tag-blue">${vac}</span>`;
    return `<span class="tag tag-green">${vac}</span>`;
  }

  /* ── Build district options ─────────────────────────────────── */
  function buildDistrictOptions() {
    const sel = document.getElementById("parking-district");
    if (!sel) return;
    const districts = [
      ...new Set(_allParks.map((p) => p.district).filter(Boolean)),
    ].sort();
    sel.innerHTML =
      `<option value="">全部地區 All</option>` +
      districts
        .map((d) => `<option value="${d}">${DISTRICTS[d] || d}</option>`)
        .join("");
  }

  /* ── Filter and render ──────────────────────────────────────── */
  function applyFilter() {
    const district =
      (document.getElementById("parking-district") || {}).value || "";
    const search =
      (document.getElementById("parking-search") || {}).value?.toLowerCase() ||
      "";
    const showFull = (document.getElementById("parking-show-full") || {})
      .checked;

    _filtered = _allParks.filter((p) => {
      if (district && p.district !== district) return false;
      if (
        search &&
        !(p.name_zh_hk || p.park_Id || "").toLowerCase().includes(search)
      )
        return false;
      if (!showFull) {
        const vac = getVacancy(p);
        if (vac === 0) return false;
      }
      return true;
    });

    renderParks();
  }

  /* ── Render park cards ──────────────────────────────────────── */
  function renderParks() {
    const cont = document.getElementById("parking-grid");
    const count = document.getElementById("parking-count");
    if (!cont) return;

    const display = _filtered.slice(0, 120); // cap at 120 for performance

    if (count)
      count.textContent = `顯示 ${display.length} / ${_filtered.length} 個停車場`;

    if (!display.length) {
      cont.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:var(--sp-6);color:var(--text-faint)">無符合條件的停車場</div>`;
      return;
    }

    cont.innerHTML = display
      .map((p) => {
        const name = p.name || p.park_Id || "未知";
        const district = p.district || ""; // already Chinese from info API
        const carVac = getVacancy(p, "privateCar");
        const mcVac = getVacancy(p, "motorCycle");
        const lvVac = getVacancy(p, "LGV");

        return `
        <div class="card" style="padding:var(--sp-3)">
          <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--sp-2);line-height:1.3">${name}</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint);margin-bottom:var(--sp-2)">${district}${p.park_Id ? ` · ${p.park_Id}` : ""}</div>
          <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
            <div style="text-align:center">
              <div style="font-size:9px;color:var(--text-faint)">私家車</div>
              ${vacancyTag(carVac)}
            </div>
            ${
              mcVac !== null
                ? `<div style="text-align:center">
              <div style="font-size:9px;color:var(--text-faint)">電單車</div>
              ${vacancyTag(mcVac)}
            </div>`
                : ""
            }
            ${
              lvVac !== null
                ? `<div style="text-align:center">
              <div style="font-size:9px;color:var(--text-faint)">輕型貨車</div>
              ${vacancyTag(lvVac)}
            </div>`
                : ""
            }
          </div>
        </div>
      `;
      })
      .join("");
  }

  /* ── Summary stats ───────────────────────────────────────────── */
  function renderSummary(parks) {
    const cont = document.getElementById("parking-summary");
    if (!cont) return;
    const total = parks.length;
    const withData = parks.filter((p) => getVacancy(p) !== null).length;
    const available = parks.filter((p) => {
      const v = getVacancy(p);
      return v !== null && v > 0;
    }).length;
    const full = parks.filter((p) => getVacancy(p) === 0).length;

    cont.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-4)">
        <div style="text-align:center">
          <div class="big-num" style="font-size:var(--text-2xl)">${total}</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint)">停車場總數</div>
        </div>
        <div style="text-align:center">
          <div class="big-num" style="font-size:var(--text-2xl);color:var(--success)">${available}</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint)">有空位</div>
        </div>
        <div style="text-align:center">
          <div class="big-num" style="font-size:var(--text-2xl);color:var(--error)">${full}</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint)">已滿</div>
        </div>
        <div style="text-align:center">
          <div class="big-num" style="font-size:var(--text-2xl);color:var(--text-faint)">${total - withData}</div>
          <div style="font-size:var(--text-xs);color:var(--text-faint)">無數據</div>
        </div>
      </div>
    `;
  }

  /* ── Main refresh ────────────────────────────────────────────── */
  async function refresh() {
    const cont = document.getElementById("parking-grid");
    const upd = document.getElementById("parking-upd");
    if (!cont) return;

    cont.innerHTML = `
      <div class="skel" style="height:80px;border-radius:var(--r-lg)"></div>
      <div class="skel" style="height:80px;border-radius:var(--r-lg)"></div>
      <div class="skel" style="height:80px;border-radius:var(--r-lg)"></div>
      <div class="skel" style="height:80px;border-radius:var(--r-lg)"></div>
      <div class="skel" style="height:80px;border-radius:var(--r-lg)"></div>
      <div class="skel" style="height:80px;border-radius:var(--r-lg)"></div>
    `;

    try {
      const parks = await fetchAllParking();
      _allParks = parks;

      buildDistrictOptions();
      renderSummary(_allParks);
      _filtered = _allParks;
      applyFilter();

      if (upd)
        upd.textContent = `最後更新：${new Date().toLocaleTimeString("zh-HK", { hour12: false })}`;
    } catch (e) {
      cont.innerHTML = `<div style="grid-column:1/-1;color:var(--error);padding:var(--sp-4)">停車場數據載入失敗：${e.message}</div>`;
    }
  }

  return { refresh, applyFilter };
})();
