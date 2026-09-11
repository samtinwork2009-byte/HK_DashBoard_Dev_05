/* ============================================================
   waste.js — 廢物回收 / 垃圾收集提示 Waste & Recycling Info
   香港城市儀表板 v1
   資料：靜態資訊 + 環保署 EPD
   ============================================================ */

"use strict";

const Waste = (function () {
  const EPD_HOTLINE = "2838 3111";
  const EPD_URL =
    "https://www.epd.gov.hk/epd/tc_chi/environmentinhk/waste/prob_solutions/prob_solutions.html";
  const RECYCLING_URL =
    "https://www.wastereduction.gov.hk/tc/household/index.html";
  const BULK_PICKUP_URL =
    "https://www.epd.gov.hk/epd/tc_chi/environmentinhk/waste/collections/bulky_waste.html";
  const FOOD_WASTE_URL =
    "https://www.wastereduction.gov.hk/tc/foodwaste/food_waste_recycling.html";

  const DAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];

  /* ── District recycling info ─────────────────────────────── */
  const DISTRICTS = [
    {
      id: "TM",
      name: "屯門區 Tuen Mun",
      foodWaste: true,
      note: "屯門各屋邨均設有廚餘機",
    },
    {
      id: "YL",
      name: "元朗區 Yuen Long",
      foodWaste: true,
      note: "元朗市中心多個廚餘收集點",
    },
    {
      id: "TSW",
      name: "天水圍 Tin Shui Wai",
      foodWaste: true,
      note: "嘉湖山莊設廚餘機",
    },
    {
      id: "TW",
      name: "荃灣區 Tsuen Wan",
      foodWaste: true,
      note: "荃灣多個屋邨設廚餘機",
    },
    { id: "KC", name: "葵青區 Kwai Tsing", foodWaste: false, note: "" },
    {
      id: "ST",
      name: "沙田區 Sha Tin",
      foodWaste: true,
      note: "沙田各大型屋邨設廚餘機",
    },
    { id: "TP", name: "大埔區 Tai Po", foodWaste: false, note: "" },
    { id: "NO", name: "北區 North District", foodWaste: false, note: "" },
    { id: "SK", name: "西貢區 Sai Kung", foodWaste: false, note: "" },
    {
      id: "KT",
      name: "觀塘區 Kwun Tong",
      foodWaste: true,
      note: "觀塘多個公共屋邨設廚餘機",
    },
    {
      id: "WC",
      name: "灣仔區 Wan Chai",
      foodWaste: true,
      note: "灣仔市區多個收集點",
    },
    { id: "E", name: "東區 Eastern", foodWaste: false, note: "" },
    { id: "S", name: "南區 Southern", foodWaste: false, note: "" },
    {
      id: "CW",
      name: "中西區 Central & Western",
      foodWaste: true,
      note: "上環及中環多個廚餘收集點",
    },
    { id: "YTM", name: "油尖旺區 Yau Tsim Mong", foodWaste: false, note: "" },
    { id: "SSP", name: "深水埗區 Sham Shui Po", foodWaste: false, note: "" },
    { id: "KS", name: "九龍城區 Kowloon City", foodWaste: false, note: "" },
    { id: "WT", name: "黃大仙區 Wong Tai Sin", foodWaste: false, note: "" },
    { id: "IS", name: "離島區 Islands", foodWaste: false, note: "" },
  ];

  /* ── Recycling bin colors ────────────────────────────────── */
  const RECYCLING_BINS = [
    {
      color: "#0066cc",
      colorName: "藍色",
      emoji: "🔵",
      accepts: "廢紙",
      en: "Paper",
      examples: "報紙、雜誌、紙皮、紙盒（乾淨無污染）",
    },
    {
      color: "#FFD700",
      colorName: "黃色",
      emoji: "🟡",
      accepts: "金屬",
      en: "Metal",
      examples: "鋁罐、鐵罐、金屬製品（清空並沖洗）",
    },
    {
      color: "#228B22",
      colorName: "啡色",
      emoji: "🟤",
      accepts: "膠樽",
      en: "Plastic",
      examples: "飲料膠樽（PET）、清潔劑瓶（HDPE）",
    },
  ];

  /* ── Determine collection status ────────────────────────── */
  function getCollectionStatus() {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const hour = now.getHours();

    // Waste collection in Hong Kong: Mon-Sat (most areas)
    const isCollectionDay = dow >= 1 && dow <= 6;
    const isCollectionTime = hour >= 7 && hour <= 18;

    if (isCollectionDay) {
      return {
        today: true,
        ongoing: isCollectionTime,
        message: isCollectionTime
          ? "今日垃圾收集進行中 (07:00–18:00)"
          : hour < 7
            ? "今日垃圾收集將於 07:00 開始"
            : "今日垃圾收集已完成",
        color: isCollectionTime ? "var(--success)" : "var(--text-muted)",
        icon: "🗑",
      };
    } else {
      // Sunday — find next Monday
      const daysUntilMon = 1; // always 1 day away from Sunday
      return {
        today: false,
        ongoing: false,
        message: `今天（星期日）不收垃圾，下次收集：明天（星期一）07:00`,
        color: "var(--text-faint)",
        icon: "📅",
        nextDay: "明天 (星期一)",
        hoursUntil: 24 - hour + 7,
      };
    }
  }

  /* ── Render today collection status ─────────────────────── */
  function renderCollectionStatus() {
    const el = document.getElementById("waste-collection-status");
    if (!el) return;

    const status = getCollectionStatus();
    const now = new Date();
    const dowZh = DAYS_ZH[now.getDay()];

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--sp-3);flex-wrap:wrap">
        <div style="font-size:2rem">${status.icon}</div>
        <div>
          <div style="font-size:var(--text-sm);font-weight:700;color:${status.color}">
            ${status.message}
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-faint);margin-top:2px">
            今天：星期${dowZh} · 一般廢物收集：星期一至六 07:00–18:00
          </div>
        </div>
        ${
          status.today && status.ongoing
            ? `
          <div style="margin-left:auto">
            <span class="tag tag-green" style="font-size:var(--text-xs)">收集中</span>
          </div>
        `
            : status.today
              ? `
          <div style="margin-left:auto">
            <span class="tag tag-muted" style="font-size:var(--text-xs)">今日完成/未開始</span>
          </div>
        `
              : `
          <div style="margin-left:auto">
            <span class="tag tag-muted" style="font-size:var(--text-xs)">休息日</span>
          </div>
        `
        }
      </div>
    `;
  }

  /* ── Render recycling bin guide ──────────────────────────── */
  function renderRecyclingGuide() {
    const el = document.getElementById("waste-recycling-guide");
    if (!el) return;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--sp-3);margin-bottom:var(--sp-4)">
        ${RECYCLING_BINS.map(
          (bin) => `
          <div style="padding:var(--sp-4);background:var(--surface-2);border-radius:var(--r-lg);
                      border-left:4px solid ${bin.color}">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2)">
              <span style="font-size:1.5rem">${bin.emoji}</span>
              <div>
                <div style="font-weight:700;font-size:var(--text-sm)">${bin.colorName}回收桶</div>
                <div style="font-size:var(--text-xs);color:var(--text-faint)">${bin.accepts} · ${bin.en}</div>
              </div>
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.5">
              ${bin.examples}
            </div>
          </div>
        `,
        ).join("")}
      </div>
      <div style="padding:var(--sp-3);background:var(--surface-2);border-radius:var(--r-md);
                  border-left:3px solid var(--info);margin-bottom:var(--sp-3)">
        <div style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.6">
          <strong>♻ 三色回收桶位置：</strong>全港各屋邨、公共屋苑、政府場所及主要街道均設有三色回收桶。
          回收物需清洗乾淨、去除殘留食物。玻璃樽需投放於專設玻璃回收桶（橙色）。
        </div>
      </div>
    `;
  }

  /* ── Render bulk waste + special services ───────────────── */
  function renderSpecialServices() {
    const el = document.getElementById("waste-special-services");
    if (!el) return;

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--sp-3)">

        <!-- Bulk item pickup -->
        <div class="row-item" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2)">
          <div style="display:flex;align-items:center;gap:var(--sp-2)">
            <span style="font-size:1.2rem">🛋</span>
            <span style="font-weight:600;font-size:var(--text-sm)">大型家電 / 廢棄家具回收</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.5">
            免費預約上門收集：電話 <strong style="color:var(--primary);font-family:var(--font-mono)">${BULK_PICKUP_URL.includes("epd") ? "2311 8888" : "2311 8888"}</strong><br>
            接受：雪櫃、冷氣機、洗衣機、電視機、電腦、打印機等
          </div>
          <a href="${BULK_PICKUP_URL}" target="_blank" rel="noopener"
             style="font-size:var(--text-xs);color:var(--primary)">環保署 大型廢物收集 ↗</a>
        </div>

        <!-- Food waste -->
        <div class="row-item" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2)">
          <div style="display:flex;align-items:center;gap:var(--sp-2)">
            <span style="font-size:1.2rem">🍃</span>
            <span style="font-weight:600;font-size:var(--text-sm)">廚餘機 Food Waste Recycler</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.5">
            全港多個公共屋邨及屋苑設有智能廚餘機，可回收廚餘獲積分獎賞。<br>
            適用廚餘：剩飯剩菜、蔬果廚餘（去除包裝及固體廢物）
          </div>
          <a href="${FOOD_WASTE_URL}" target="_blank" rel="noopener"
             style="font-size:var(--text-xs);color:var(--primary)">廚餘回收計劃詳情 ↗</a>
        </div>

        <!-- Chemical waste -->
        <div class="row-item" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2)">
          <div style="display:flex;align-items:center;gap:var(--sp-2)">
            <span style="font-size:1.2rem">🔋</span>
            <span style="font-weight:600;font-size:var(--text-sm)">廢電池 / 慳電燈泡回收</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.5">
            各大型超市（百佳、惠康）、政府場所均設有廢電池回收箱。<br>
            慳電燈泡：惠康、百佳、豐澤均有回收點。
          </div>
        </div>

        <!-- EPD hotline -->
        <div style="padding:var(--sp-3);background:var(--surface-2);border-radius:var(--r-md);
                    border-left:3px solid var(--primary)">
          <div style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.6">
            <strong>📞 環保署廢物回收熱線：</strong>
            <span style="font-family:var(--font-mono);font-size:var(--text-sm);
                         color:var(--primary);font-weight:700">${EPD_HOTLINE}</span><br>
            服務時間：星期一至五 09:00–13:00 / 14:00–17:45（公眾假期除外）
          </div>
          <div style="margin-top:var(--sp-2);display:flex;gap:var(--sp-2);flex-wrap:wrap">
            <a href="${RECYCLING_URL}" target="_blank" rel="noopener"
               style="font-size:var(--text-xs);color:var(--primary)">廢物減少辦公室 ↗</a>
            <a href="${EPD_URL}" target="_blank" rel="noopener"
               style="font-size:var(--text-xs);color:var(--primary)">環保署廢物管理 ↗</a>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Render district selector + food waste info ─────────── */
  function renderDistrictInfo() {
    const el = document.getElementById("waste-district-info");
    if (!el) return;

    el.innerHTML = `
      <div style="margin-bottom:var(--sp-3)">
        <select id="waste-district-select" onchange="Waste.onDistrictChange()"
          style="background:var(--surface-2);border:1px solid var(--border);
                 border-radius:var(--r-md);padding:var(--sp-2) var(--sp-3);
                 color:var(--text);font:inherit;font-size:var(--text-sm);width:100%;max-width:300px">
          <option value="">— 選擇地區 —</option>
          ${DISTRICTS.map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}
        </select>
      </div>
      <div id="waste-district-detail" style="font-size:var(--text-xs);color:var(--text-faint)">
        請選擇您所在地區查看詳細資訊
      </div>
    `;
  }

  /* ── District change handler ─────────────────────────────── */
  function onDistrictChange() {
    const sel = document.getElementById("waste-district-select");
    const detailEl = document.getElementById("waste-district-detail");
    if (!sel || !detailEl) return;

    const d = DISTRICTS.find((x) => x.id === sel.value);
    if (!d) {
      detailEl.innerHTML = `<span style="color:var(--text-faint)">請選擇您所在地區查看詳細資訊</span>`;
      return;
    }

    detailEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--sp-2)">
        <div class="row-item">
          <span class="row-name">垃圾收集日</span>
          <span class="row-val">星期一至六（公眾假期順延）</span>
        </div>
        <div class="row-item">
          <span class="row-name">三色回收桶</span>
          <span class="row-val">各屋邨、公共場所均設</span>
        </div>
        <div class="row-item">
          <span class="row-name">廚餘機</span>
          <span class="row-val">
            ${
              d.foodWaste
                ? `<span class="tag tag-green">設有</span>` +
                  (d.note ? ` · ${d.note}` : "")
                : '<span class="tag tag-muted">暫無/待確認</span>'
            }
          </span>
        </div>
        <div class="row-item">
          <span class="row-name">大件廢物回收</span>
          <span class="row-val">預約熱線 2311 8888</span>
        </div>
      </div>
    `;
  }

  /* ── Main refresh ────────────────────────────────────────── */
  function refresh() {
    renderCollectionStatus();
    renderRecyclingGuide();
    renderSpecialServices();
    renderDistrictInfo();
  }

  return { refresh, onDistrictChange };
})();
