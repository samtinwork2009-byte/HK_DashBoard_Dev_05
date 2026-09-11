/* ============================================================
   transport.js — MTR, Light Rail schedule fetching
   香港城市儀表板 v2
   ============================================================ */

"use strict";

const MTR_API = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";
const LRT_API = "https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule";

/* ── Direction label map ─────────────────────────────────────── */
const DIR_LABEL = { UP: "上行", DOWN: "下行", UT: "上行", DT: "下行" };

/* ── MTR station code → Chinese name ────────────────────────── */
const STA_NAMES = {
  TUM: "屯門",
  WKS: "烏溪沙",
  SHT: "沙田",
  MKK: "旺角東",
  LOW: "羅湖",
  SHS: "上水",
  TAW: "大圍",
  OTP: "大埔墟",
  TIS: "天水圍",
  KSR: "錦上路",
  YUL: "元朗",
  LOP: "朗屏",
  HUH: "何文田",
  ETS: "屯門東",
  AUS: "尾竜山",
  QUB: "奧運",
  ADM: "金鐘",
  CEN: "中環",
  SHW: "上環",
  HKU: "香港大學",
  KET: "堅尼地城",
  KWN: "筲箕灣",
  TWO: "荔枝角",
  OCP: "海洋公園",
  BIH: "博覽館",
  HOK: "香港",
  KOT: "觀塘",
  LAT: "藍田",
  WTS: "黃大仙",
  DIH: "鑽石山",
  FOT: "火炭",
  CKT: "彩虹",
  TKO: "將軍澳",
  LHP: "日出康城",
  HAH: "坑口",
  TIK: "天后",
  SWH: "石塘咀",
  CHW: "柴灣",
  TSY: "尖沙咀",
  AWE: "博覽館",
  TUC: "東涌",
  LAK: "荔景",
  TSW: "荃灣",
  KWH: "葵興",
  DEP: "葵芳",
  NAN: "南昌",
  LCK: "荔枝角",
  WCH: "黃竹坑",
  NAC: "南昌",
  SKW: "石硤尾",
  SHS: "上水",
  STK: "大學",
  TCW: "青衣",
  DIH: "鑽石山",
  MOS: "馬鞍山",
  HIK: "恆安",
  CIO: "石圍角",
  DIK: "第一城",
  STW: "石田",
  HOM: "紅磡",
  EXH: "旺角東",
};

function staName(code) {
  return STA_NAMES[code] || code;
}

/* ── MTR ──────────────────────────────────────────────────────── */
function getMTRDirectionFilter() {
  const el = document.getElementById("t-mtr-direction");
  return el?.value || "both";
}

function getCrowdingBadge(mins) {
  if (mins === null || mins === undefined || mins === "--")
    return '<span class="tag tag-blue">班次資訊</span>';
  if (mins <= 2) return '<span class="tag tag-green">🚇 立即出發</span>';
  if (mins <= 5) return '<span class="tag tag-yellow">🟡 較密</span>';
  return '<span class="tag tag-blue">🧊 順暢</span>';
}

async function fetchMTR(line, sta, targetId, subtitleId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = skelHtml(2);
  try {
    const url =
      MTR_API +
      "?line=" +
      encodeURIComponent(line) +
      "&sta=" +
      encodeURIComponent(sta);
    const res = await fetch(url);
    if (!res.ok) throw new Error("MTR HTTP " + res.status);
    const d = await res.json();

    if (d.status === 0 || d.status === "0") {
      el.innerHTML =
        '<div class="row-item"><span style="color:var(--text-faint)">暫停服務或無班次資料</span></div>';
      return;
    }

    const key = line + "-" + sta;
    const schedData = d.data && d.data[key];
    if (!schedData) {
      el.innerHTML =
        '<div class="row-item"><span style="color:var(--text-faint)">查無此站資料</span></div>';
      return;
    }

    const directionFilter = getMTRDirectionFilter();
    let html = "";
    for (const dir of ["UP", "DOWN"]) {
      if (directionFilter !== "both" && dir !== directionFilter) continue;
      const trains = schedData[dir] || [];
      if (!trains.length) continue;
      const label = DIR_LABEL[dir] || dir;
      html +=
        '<div style="margin-bottom:var(--sp-2)"><div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:4px">' +
        label +
        "</div>";
      html += trains
        .slice(0, 4)
        .map(function (t) {
          const mins = t.ttnt || "--";
          const destCode = t.dest || "";
          const dest = staName(destCode);
          const platform = t.plat ? "月台 " + t.plat : "";
          const minsNum = parseInt(mins, 10);
          const cls = isNaN(minsNum)
            ? "tag-muted"
            : minsNum <= 2
              ? "tag-green"
              : minsNum <= 5
                ? "tag-yellow"
                : "tag-blue";
          const platSpan = platform
            ? ' <span style="color:var(--text-faint);font-size:10px">' +
              platform +
              "</span>"
            : "";
          const crowding = getCrowdingBadge(minsNum);
          return (
            '<div class="row-item" style="align-items:flex-start;gap:10px">' +
            '<span class="row-name">' +
            dest +
            platSpan +
            '<span style="display:block;font-size:10px;color:var(--text-faint);margin-top:4px">下一班約 ' +
            (mins !== "--" ? mins + " 分" : "—") +
            "</span></span>" +
            '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="tag ' +
            cls +
            '">' +
            (mins !== "--" ? mins + " 分鐘" : "—") +
            "</span>" +
            crowding +
            "</span>" +
            "</div>"
          );
        })
        .join("");
      html += "</div>";
    }
    el.innerHTML =
      html ||
      '<div class="row-item"><span style="color:var(--text-faint)">暫無班次</span></div>';

    if (subtitleId) {
      const sub = document.getElementById(subtitleId);
      if (sub)
        sub.textContent =
          "更新: " + new Date().toLocaleTimeString("zh-HK", { hour12: false });
    }
  } catch (e) {
    console.error("MTR fetch error:", e);
    if (el)
      el.innerHTML =
        '<div class="row-item"><span style="color:var(--error)">無法連接港鐵服務</span></div>';
  }
}

/* ── Default MTR (home + transport page) ─────────────────────── */
async function fetchDefaultMTR() {
  await Promise.all([
    fetchMTR("TML", "TUM", "t-mtr"),
    fetchMTR("TML", "TUM", "h-mtr-content"),
  ]);
}

/* ── Custom MTR query (from select) ──────────────────────────── */
window.fetchMTRCustom = async function () {
  const sel = document.getElementById("t-mtr-line");
  if (!sel) return;
  const val = sel.value;
  const parts = val.split("|");
  const line = parts[0];
  const sta = parts[1];
  if (!line || !sta) return;
  await fetchMTR(line, sta, "t-mtr-custom");
};

/* ── Light Rail ──────────────────────────────────────────────── */
async function fetchLRT(staId, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = skelHtml(2);
  try {
    const url = LRT_API + "?station_id=" + encodeURIComponent(staId);
    const res = await fetch(url);
    if (!res.ok) throw new Error("LRT HTTP " + res.status);
    const d = await res.json();

    const platforms = d.platform_list || [];
    if (!platforms.length) {
      el.innerHTML =
        '<div class="row-item"><span style="color:var(--text-faint)">暫無班次資料</span></div>';
      return;
    }

    let html = "";
    for (const plat of platforms) {
      const platNo = plat.platform_id || plat.platformNo || "?";
      const routes = plat.route_list || [];
      if (!routes.length) continue;
      html +=
        '<div style="margin-bottom:var(--sp-2)"><div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:4px">月台 ' +
        platNo +
        "</div>";
      html += routes
        .slice(0, 4)
        .map(function (r) {
          const routeNo = r.route_no || r.routeNo || "--";
          const dest = r.dest_ch || r.destCh || r.dest || "";
          const timeCh = r.time_ch || r.timeCh || "--";
          const minsMatch = timeCh.match(/(\d+)/);
          const mins = minsMatch ? parseInt(minsMatch[1], 10) : null;
          const cls =
            mins === null
              ? "tag-blue"
              : mins <= 2
                ? "tag-green"
                : mins <= 5
                  ? "tag-yellow"
                  : "tag-blue";
          const crowding = getCrowdingBadge(mins);
          return (
            '<div class="row-item" style="align-items:flex-start;gap:10px">' +
            '<span class="row-name"><span style="font-weight:700;color:var(--primary);margin-right:6px">' +
            routeNo +
            "</span>" +
            dest +
            '<span style="display:block;font-size:10px;color:var(--text-faint);margin-top:4px">下一班 ' +
            timeCh +
            "</span></span>" +
            '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="tag ' +
            cls +
            '">' +
            timeCh +
            "</span>" +
            crowding +
            "</span>" +
            "</div>"
          );
        })
        .join("");
      html += "</div>";
    }
    el.innerHTML =
      html ||
      '<div class="row-item"><span style="color:var(--text-faint)">暫無班次</span></div>';
  } catch (e) {
    console.error("LRT fetch error:", e);
    if (el)
      el.innerHTML =
        '<div class="row-item"><span style="color:var(--error)">無法連接輕鐵服務</span></div>';
  }
}

/* ── Default LRT ─────────────────────────────────────────────── */
async function fetchDefaultLRT() {
  await fetchLRT("001", "t-lrt");
}

/* ── Custom LRT query (from select) ─────────────────────────── */
window.fetchLRTCustom = async function () {
  const sel = document.getElementById("t-lrt-sta");
  if (!sel) return;
  await fetchLRT(sel.value, "t-lrt-custom");
};

/* ── MTR Service Status ──────────────────────────────────────── */
// Lines to check: line code | representative station
const MTR_STATUS_LINES = [
  { line: "AEL", sta: "AWE", label: "機場快線" },
  { line: "TCL", sta: "TUC", label: "東涌線" },
  { line: "TML", sta: "TUM", label: "屯馬線" },
  { line: "EAL", sta: "FOT", label: "東鐵線" },
  { line: "KTL", sta: "KOT", label: "觀塘線" },
  { line: "TWL", sta: "TSW", label: "荃灣線" },
  { line: "ISL", sta: "KWN", label: "港島線" },
  { line: "SIL", sta: "OCP", label: "南港島線" },
];

async function fetchMTRLineStatus(line, sta) {
  try {
    const url =
      MTR_API +
      "?line=" +
      encodeURIComponent(line) +
      "&sta=" +
      encodeURIComponent(sta);
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    return {
      status: d.status,
      message: d.message || d.url || "",
    };
  } catch (e) {
    return { status: -1, message: "無法連接" };
  }
}

async function renderMTRStatus() {
  const el = document.getElementById("t-mtr-status");
  if (!el) return;
  el.innerHTML = skelHtml(1);

  const results = await Promise.all(
    MTR_STATUS_LINES.map(async function (info) {
      const r = await fetchMTRLineStatus(info.line, info.sta);
      return { label: info.label, line: info.line, ...r };
    }),
  );

  el.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">' +
    results
      .map(function (r) {
        if (r.status === 1 || r.status === "1") {
          return (
            '<div class="row-item" style="flex-direction:column;align-items:flex-start;gap:4px;min-width:110px;flex:1">' +
            '<span style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600">' +
            r.label +
            "</span>" +
            '<span class="tag tag-green" style="font-size:11px">服務正常</span>' +
            "</div>"
          );
        } else if (r.status === 0 || r.status === "0") {
          const msg = r.message
            ? '<div style="font-size:10px;color:var(--error);margin-top:2px;line-height:1.4">' +
              r.message +
              "</div>"
            : "";
          return (
            '<div class="row-item" style="flex-direction:column;align-items:flex-start;gap:4px;min-width:110px;flex:1;border-color:var(--error)">' +
            '<span style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600">' +
            r.label +
            "</span>" +
            '<span class="tag tag-red" style="font-size:11px">⚠ 服務受阻</span>' +
            msg +
            "</div>"
          );
        } else {
          return (
            '<div class="row-item" style="flex-direction:column;align-items:flex-start;gap:4px;min-width:110px;flex:1">' +
            '<span style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600">' +
            r.label +
            "</span>" +
            '<span class="tag tag-muted" style="font-size:11px">— 未知</span>' +
            "</div>"
          );
        }
      })
      .join("") +
    "</div>";
}

/* ── Public API ──────────────────────────────────────────────── */
window.Transport = {
  fetchDefaultMTR: fetchDefaultMTR,
  fetchDefaultLRT: fetchDefaultLRT,
  renderMTRStatus: renderMTRStatus,
  refresh: async function () {
    await Promise.all([
      fetchDefaultMTR(),
      fetchDefaultLRT(),
      renderMTRStatus(),
    ]);
  },
};
