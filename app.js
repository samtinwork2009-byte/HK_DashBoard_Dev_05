/* ============================================================
   app.js — Main init, page routing, auto-refresh
   香港城市儀表板 v3 (全方位版)
   ============================================================ */

"use strict";

window._lastWeatherUpdate = null;
window._lastWeatherTemp = null;
window._lastWeatherAQHI = null;

window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  console.error("[HK Dashboard] Unhandled asynchronous error:", event.reason);
});
/* ── Offline / Online Detection ──────────────────────────────────── */
(function initOfflineDetection() {
  // Create the offline banner element
  function getOrCreateBanner() {
    let el = document.getElementById("offline-banner");
    if (el) return el;
    el = document.createElement("div");
    el.id = "offline-banner";
    el.style.cssText = [
      "display:none",
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:9999",
      "background:linear-gradient(135deg,#78350f,#92400e)",
      "color:white",
      "padding:10px 20px",
      "text-align:center",
      "font-size:14px",
      "font-weight:600",
      "border-bottom:2px solid #f59e0b",
    ].join(";");
    el.textContent =
      "\u26a0 \u76ee\u524d\u6c92\u6709\u7db2\u7d61\u9023\u7dda \u00b7 \u986f\u793a\u4e0a\u6b21\u7de9\u5b58\u6578\u64da";
    // Insert before page-body or at start of body
    const pageBody = document.querySelector(".page-body");
    if (pageBody) {
      pageBody.parentNode.insertBefore(el, pageBody);
    } else if (document.body) {
      document.body.insertBefore(el, document.body.firstChild);
    }
    return el;
  }

  function showOfflineBanner() {
    const banner = getOrCreateBanner();
    banner.style.display = "block";
  }

  function hideOfflineBanner() {
    const banner = document.getElementById("offline-banner");
    if (banner) banner.style.display = "none";
  }

  // Check initial state after DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    getOrCreateBanner();
    if (!navigator.onLine) {
      showOfflineBanner();
    }
  });

  window.addEventListener("offline", function () {
    showOfflineBanner();
  });

  window.addEventListener("online", function () {
    hideOfflineBanner();
    // Auto-refresh all data when connection restored
    console.log("[HK Dashboard] Back online — refreshing data…");
    if (typeof loadAllData === "function") loadAllData();
    if (typeof loadNewsSummary === "function") loadNewsSummary();
  });
})();

/* ── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  requestAnimationFrame(() =>
    safeRun("Bootstrap", async () => {
      console.log("[HK Dashboard v4] Initialising…");

      // 1. Show home page after the first layout pass
      installModuleFallbacks();
      enhanceLiquidIcons();
      showPage("home");
      initHomeWidgets();
      initGlobalSearch();
      initSummaryCards();

      // 2. Initial data load (parallel)
      await loadAllData();

      // 3. Start auto-refresh loop
      startAutoRefresh();

      // 4. Render bus preset slots
      initBusPresets();

      console.log("[HK Dashboard v4] Ready.");
    }),
  );
});

function enhanceLiquidIcons() {
  document.querySelectorAll(".nav-tab svg, .bottom-nav-item svg").forEach((icon) => {
    icon.classList.add("liquid-icon");
    if (icon.getAttribute("stroke")) {
      icon.setAttribute("stroke", "url(#liquidIconGradient)");
    }
  });
  document.querySelectorAll(".card svg, .summary-icon svg, .widget-card-icon svg").forEach((icon) => {
    icon.classList.add("liquid-card-icon");
  });
}

/* ── Load all data ─────────────────────────────────────────────── */
async function loadAllData() {
  const tasks = [];
  if (typeof Weather !== "undefined") {
    tasks.push(safeRun("Weather", () => Weather.refresh()));
  }
  if (typeof Transport !== "undefined") {
    tasks.push(safeRun("Transport", () => Transport.refresh()));
  }
  if (typeof Health !== "undefined") {
    tasks.push(safeRun("Health", () => Health.refresh()));
  }
  if (typeof Environment !== "undefined") {
    tasks.push(safeRun("Environment", () => Environment.refresh()));
  }
  if (typeof Finance !== "undefined") {
    tasks.push(safeRun("Finance", () => Finance.refresh()));
  }
  await Promise.allSettled(tasks);
}

/* ── Bus preset init ──────────────────────────────────────────── */
function initBusPresets() {
  if (typeof Bus === "undefined") return;
  // Bus.refresh() now handles rendering preset grid internally
  safeRun("Bus", () => Bus.refresh());
}

/* ── Auto-refresh ────────────────────────────────────────────── */
function startAutoRefresh() {
  const shouldRefresh = () => {
    return document.visibilityState === "visible" && navigator.onLine;
  };

  // Refresh weather/health/environment every 60 seconds
  setInterval(async () => {
    if (!shouldRefresh()) return;
    await Promise.allSettled([
      typeof Weather !== "undefined" && safeRun("Weather", () => Weather.refresh()),
      typeof Health !== "undefined" && safeRun("Health", () => Health.refresh()),
      typeof Environment !== "undefined" && safeRun("Environment", () => Environment.refresh()),
    ].filter(Boolean));
  }, 60000);

  // Transport-specific refresh every 10 seconds
  setInterval(async () => {
    if (!shouldRefresh()) return;
    if (typeof Transport !== "undefined") {
      await safeRun("Transport", () => Transport.refresh());
    }
  }, 10000);

  // Bus presets every 45 seconds
  setInterval(async () => {
    if (!shouldRefresh()) return;
    if (typeof Bus !== "undefined") {
      await safeRun("Bus", () => Bus.refresh());
    }
  }, 45000);

  // Parking every 5 minutes
  setInterval(async () => {
    if (!shouldRefresh() || window._currentPage !== "parking") return;
    if (typeof Parking !== "undefined") {
      await safeRun("Parking", () => Parking.refresh());
    }
  }, 300000);
}

function renderWidget(title, data, icon, link) {
  const container = document.getElementById("home-widgets");
  if (!container) return null;
  const card = document.createElement("a");
  card.className = "card widget-card";
  card.href = link || "#";
  if (link && !link.startsWith("http") && !link.startsWith("#")) {
    card.href = "#";
    card.addEventListener("click", function (event) {
      event.preventDefault();
      if (typeof showPage === "function") showPage(link);
      if (typeof toggleMoreMenu === "function") toggleMoreMenu(false);
    });
  }
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--sp-3);">
      <div class="widget-card-icon">${icon}</div>
      <div>
        <div class="widget-card-title">${title}</div>
        <div class="widget-card-data">${data}</div>
      </div>
    </div>
  `;
  container.appendChild(card);
  return card;
}

function initHomeWidgets() {
  const widgets = [
    {
      title: "天氣總覽",
      data: "最新天氣警告與預報",
      icon: "☀️",
      link: "weather",
    },
    {
      title: "交通快訊",
      data: "即時巴士、港鐵與車況",
      icon: "🚌",
      link: "transport",
    },
    {
      title: "環保數據",
      data: "AQHI、空氣質素與海況",
      icon: "🌿",
      link: "environment",
    },
    {
      title: "醫療資訊",
      data: "急症室與醫療服務狀況",
      icon: "🏥",
      link: "health",
    },
  ];
  const container = document.getElementById("home-widgets");
  if (!container) return;
  container.innerHTML = "";
  widgets.forEach((widget) =>
    renderWidget(widget.title, widget.data, widget.icon, widget.link),
  );
}

const TOOL_CATALOG = [
  { page: "weather", title: "天氣", description: "即時天氣、預報及警告", keywords: "天氣 氣象 預報 警告" },
  { page: "transport", title: "交通", description: "港鐵及交通服務狀況", keywords: "交通 港鐵 輕鐵" },
  { page: "bus", title: "巴士", description: "巴士路線及到站時間", keywords: "巴士 九巴 城巴 到站" },
  { page: "parking", title: "停車場", description: "搜尋附近停車場空位", keywords: "停車場 車位 空位" },
  { page: "environment", title: "環境", description: "空氣質素及健康指數", keywords: "環境 空氣 AQHI" },
  { page: "health", title: "醫療", description: "急症室等候時間", keywords: "醫療 急症室 醫院" },
  { page: "tides", title: "潮汐", description: "潮汐及地震資料", keywords: "潮汐 海浪 地震" },
  { page: "map", title: "地圖", description: "城市資料地圖圖層", keywords: "地圖 AED 泳灘" },
  { page: "cctv", title: "道路快拍", description: "查看道路攝影機", keywords: "道路 CCTV 攝影機" },
  { page: "waste", title: "回收", description: "回收及廢物資訊", keywords: "回收 垃圾 廢物" },
];
function renderSearchResults(query) {
  const results = document.getElementById("global-search-results");
  if (!results) return;
  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? TOOL_CATALOG.filter((tool) => `${tool.title} ${tool.description} ${tool.keywords}`.toLowerCase().includes(normalized))
    : TOOL_CATALOG;
  results.replaceChildren();
  if (!matches.length) {
    results.textContent = "找不到相符工具。";
    return;
  }
  matches.forEach((tool) => {
    const row = document.createElement("div");
    row.className = "global-search-result";
    const open = document.createElement("button");
    open.className = "global-search-result-open";
    open.type = "button";
    open.innerHTML = `<strong>${tool.title}</strong><small>${tool.description}</small>`;
    open.addEventListener("click", () => {
      window.showPage?.(tool.page);
      document.getElementById("global-search")?.classList.add("hidden");
    });
    row.append(open);
    results.appendChild(row);
  });
}

function initGlobalSearch() {
  const search = document.getElementById("global-search");
  const input = document.getElementById("global-search-input");
  const openButtons = [document.getElementById("global-search-toggle")].filter(Boolean);
  const close = document.getElementById("global-search-close");

  function openSearch() {
    if (!search) return;
    search.classList.remove("hidden");
    renderSearchResults(input?.value || "");
    input?.focus();
  }
  function closeSearch() {
    search?.classList.add("hidden");
  }

  openButtons.forEach((button) => button.addEventListener("click", openSearch));
  close?.addEventListener("click", closeSearch);
  search?.addEventListener("click", (event) => {
    if (event.target === search) closeSearch();
  });
  input?.addEventListener("input", () => renderSearchResults(input.value));
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
      event.preventDefault();
      openSearch();
    }
    if (event.key === "Escape") closeSearch();
  });
}

function initSummaryCards() {
  updateSummaryTime();
  setInterval(updateSummaryTime, 1000);
  loadNewsSummary();
  renderTransportSummary("mtr");
  bindSummaryControls();
}

function bindSummaryControls() {
  document.querySelectorAll(".seg-btn[data-view]").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".seg-btn[data-view]")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      renderTransportSummary(this.dataset.view);
    });
  });
}

function updateSummaryTime() {
  const now = new Date();
  const timeEl = document.getElementById("summary-time");
  const dateEl = document.getElementById("summary-date");
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString("zh-HK", { hour12: false });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString("zh-HK", {
      weekday: "short",
      month: "long",
      day: "numeric",
    });
  }
}

function getWeatherEmoji(desc) {
  const text = (desc || "").toLowerCase();
  switch (true) {
    case text.includes("雷"):
      return "⛈️";
    case text.includes("雪"):
      return "❄️";
    case text.includes("雨"):
      return "🌧️";
    case text.includes("晴"):
      return "☀️";
    case text.includes("雲"):
      return "⛅";
    case text.includes("霧"):
      return "🌫️";
    case text.includes("風"):
      return "🌬️";
    default:
      return "🌤️";
  }
}

function updateSummaryWeather(
  currentTemp,
  aqhi,
  desc,
  updatedAt,
  humidity,
  uv,
  condition,
) {
  const tempEl = document.getElementById("summary-temp");
  const aqhiEl = document.getElementById("summary-aqhi");
  const descEl = document.getElementById("summary-weather-desc");
  const updatedEl = document.getElementById("summary-updated");
  const humidityEl = document.getElementById("summary-humidity");
  const uvEl = document.getElementById("summary-uv");
  const conditionEl = document.getElementById("summary-condition");
  const visualEl = document.getElementById("summary-weather-visual");
  if (tempEl)
    tempEl.textContent =
      currentTemp !== undefined ? `${currentTemp}°C` : "--°C";
  if (aqhiEl) aqhiEl.textContent = aqhi || "--";
  if (descEl) descEl.textContent = desc || "載入中...";
  if (updatedEl) updatedEl.textContent = updatedAt || "-- 分鐘前";
  if (humidityEl) humidityEl.textContent = humidity || "--%";
  if (uvEl) uvEl.textContent = uv || "--";
  if (conditionEl) conditionEl.textContent = condition || desc || "載入中...";
  if (visualEl) visualEl.textContent = getWeatherEmoji(condition || desc);
}

function renderTransportSummary(view) {
  const target = document.getElementById("summary-transport");
  if (!target) return;
  target.innerHTML = '<div class="skel skel-p"></div>';
  if (
    view === "mtr" &&
    typeof Transport !== "undefined" &&
    typeof window.fetchMTR === "function"
  ) {
    window.fetchMTR("TML", "TUM", "summary-transport");
    return;
  }
  if (view === "bus" && typeof Bus !== "undefined") {
    if (typeof Bus.renderSummary === "function") {
      Bus.renderSummary("summary-transport");
      return;
    }
  }
  target.innerHTML =
    '<div class="row-item"><span style="color:var(--text-faint)">目前無法顯示交通摘要。</span></div>';
}

const NEWS_CACHE_KEY = "hk_dashboard_news_cache";
const GOVERNMENT_NEWS_API =
  "https://api.data.gov.hk/v1/pressrelease/search?lang=tc&type=press";
const GOVERNMENT_NEWS_RSS = [
  "https://www.news.gov.hk/tc/common/html/topstories.rss.xml",
  "https://www.news.gov.hk/tc/common/html/ticker.rss.xml",
  "https://www.info.gov.hk/gia/rss/general_zh.xml",
];

async function loadNewsSummary() {
  const container = document.getElementById("summary-news");
  if (!container) return;
  try {
    const items = await fetchGovernmentNews();
    if (!items.length) {
      throw new Error("no news");
    }
    saveNewsCache(items);
    renderNewsItems(container, items);
  } catch (e) {
    console.warn("News fetch error:", e);
    const cached = loadNewsCache();
    if (cached.length) {
      renderNewsItems(container, cached, true);
      return;
    }
    container.innerHTML = "<div class='news-empty'>政府新聞暫時無法載入，請稍後重試。</div>";
  }
}

function renderNewsItems(container, items, isCache = false) {
  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const safeLink = (value) => {
    try {
      const url = new URL(value || "#", window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch (e) {
      return "#";
    }
  };
  const inner = document.createElement("div");
  inner.className = "marquee-inner";
  inner.innerHTML = items
    .slice(0, 5)
    .map(
      (item) => `
      <a href="${escapeHtml(safeLink(item.link))}" target="_blank" rel="noopener noreferrer" class="marquee-item">
        ${escapeHtml(item.title)}<time>${new Date(item.pubDate).toLocaleTimeString("zh-HK", { hour12: false, hour: "2-digit", minute: "2-digit" })}</time>
      </a>
    `,
    )
    .join("");
  container.innerHTML = "";
  container.appendChild(inner);
  if (isCache) {
    const note = document.createElement("div");
    note.style.cssText = "font-size:0.75rem;color:var(--text-faint);margin-top:8px";
    note.textContent = "使用離線緩存新聞。";
    container.appendChild(note);
  }
}

function saveNewsCache(items) {
  try {
    localStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), items: items.slice(0, 5) }),
    );
  } catch (e) {
    console.warn("Unable to save news cache", e);
  }
}

function loadNewsCache() {
  try {
    const stored = localStorage.getItem(NEWS_CACHE_KEY);
    if (!stored) return [];
    return JSON.parse(stored).items || [];
  } catch (e) {
    console.warn("Unable to read news cache", e);
    return [];
  }
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchGovernmentNews() {
  try {
    const response = await fetchWithTimeout(GOVERNMENT_NEWS_API);
    const payload = await response.json();
    const items = parseGovernmentNewsResponse(payload);
    if (items.length) return items;
  } catch (error) {
    console.warn("Government news API failed:", error);
  }
  for (const rssUrl of GOVERNMENT_NEWS_RSS) {
    try {
      const response = await fetchWithTimeout(rssUrl);
      const xmlText = await response.text();
      const items = parseRssTextResponse(xmlText);
      if (items.length) return items;
    } catch (error) {
      console.warn(`Government news RSS failed: ${rssUrl}`, error);
    }
  }
  return [];
}

function parseGovernmentNewsResponse(data) {
  const candidates = [data, data?.data, data?.items, data?.results, data?.pressReleases];
  const rows = candidates.find((value) => Array.isArray(value)) || [];
  return rows
    .map((item) => ({
      title: item.title || item.subject || item.name || item.title_tc || "(無標題)",
      link: item.url || item.link || item.href || item.uri || "#",
      pubDate: item.publishTime || item.publish_time || item.pubDate || item.date || item.datetime || new Date().toISOString(),
    }))
    .filter((item) => item.title && item.link);
}

function notifyUnavailableModule(label) {
  const message = `${label}功能暫時無法使用，相關模組未能載入。`;
  if (typeof window.showNotification === "function") {
    window.showNotification(message, { duration: 5000 });
  } else {
    console.warn(`[HK Dashboard] ${message}`);
  }
}

function installModuleFallbacks() {
  const fallbackMethods = {
    BusSearch: { search: () => notifyUnavailableModule("巴士搜尋") },
    Bus_GMB: { loadRoutes: () => notifyUnavailableModule("專線小巴") },
    MapView: { switchLayer: () => notifyUnavailableModule("地圖") },
    Parking: {
      applyFilter: () => notifyUnavailableModule("停車場"),
      refresh: () => notifyUnavailableModule("停車場"),
    },
    Tides: { changeStation: () => notifyUnavailableModule("潮汐") },
    Beach: { filterSearch: () => notifyUnavailableModule("泳灘") },
    Ferry: { onSearch: () => notifyUnavailableModule("嶼巴") },
  };
  Object.entries(fallbackMethods).forEach(([moduleName, methods]) => {
    const module = window[moduleName] || {};
    Object.entries(methods).forEach(([methodName, fallback]) => {
      if (typeof module[methodName] !== "function") module[methodName] = fallback;
    });
    window[moduleName] = module;
  });
  if (typeof window.fetchMTRCustom !== "function") {
    window.fetchMTRCustom = () => notifyUnavailableModule("港鐵");
  }
  if (typeof window.fetchLRTCustom !== "function") {
    window.fetchLRTCustom = () => notifyUnavailableModule("輕鐵");
  }
  if (typeof window.loadCCTVInput !== "function") {
    window.loadCCTVInput = () => notifyUnavailableModule("道路快拍");
  }
}

function parseRssTextResponse(xmlText) {
  if (!xmlText) return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) return [];
    return Array.from(doc.querySelectorAll("item")).slice(0, 5).map((item) => {
      const title = item.querySelector("title")?.textContent || "(無標題)";
      const link = item.querySelector("link")?.textContent || "#";
      const pubDate =
        item.querySelector("pubDate")?.textContent ||
        item.querySelector("dc\\:date")?.textContent ||
        new Date().toISOString();
      return { title, link, pubDate };
    });
  } catch (e) {
    return [];
  }
}

const DB_NAME = "hk_dashboard_history";
const DB_STORE = "history";
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const store = db.createObjectStore(DB_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

async function saveHistoryRecord(type, payload) {
  try {
    const db = await openDb();
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    store.add({ type, timestamp: new Date().toISOString(), payload });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("IndexedDB transaction aborted"));
    });
  } catch (e) {
    console.error("IndexedDB save failed:", e);
  }
}

async function queryHistory(type, hours) {
  try {
    const db = await openDb();
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const idx = store.index("type");
    const req = idx.getAll(IDBKeyRange.only(type));
    return new Promise((resolve, reject) => {
      req.onsuccess = function () {
        const now = Date.now();
        const cutoff = now - hours * 3600000;
        const results = (req.result || []).filter(
          (item) => new Date(item.timestamp).getTime() >= cutoff,
        );
        resolve(
          results.map((item) => ({
            timestamp: item.timestamp,
            ...item.payload,
          })),
        );
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  } catch (e) {
    console.error("IndexedDB query failed:", e);
    return [];
  }
}

setInterval(async () => {
  const hasUpdate =
    typeof window._lastWeatherUpdate === "string" &&
    !Number.isNaN(Date.parse(window._lastWeatherUpdate));
  const hasValue =
    (window._lastWeatherTemp !== null && window._lastWeatherTemp !== "--") ||
    (window._lastWeatherAQHI !== null && window._lastWeatherAQHI !== "--");
  if (document.visibilityState === "visible" && hasUpdate && hasValue) {
    await saveHistoryRecord("weather", {
      temperature: window._lastWeatherTemp ?? null,
      aqhi: window._lastWeatherAQHI ?? null,
    });
  }
}, 3600000);

/* ── Safe run wrapper ────────────────────────────────────────── */
async function safeRun(label, fn) {
  try {
    if (typeof fn !== "function") return;
    await fn();
  } catch (e) {
    console.error(`[${label}] refresh error:`, e);
  }
}

function refreshModule(label, moduleName) {
  return safeRun(label, () => {
    const module = window[moduleName];
    if (!module || typeof module.refresh !== "function") return;
    return module.refresh();
  });
}

/* ── Page change hook ────────────────────────────────────────── */
const _origShowPage = typeof window.showPage === "function" ? window.showPage : function () {};
window.showPage = function (name) {
  _origShowPage(name);
  // Trigger immediate refresh for the newly visible page
  switch (name) {
    case "weather":
      refreshModule("Weather", "Weather");
      loadWeatherForecastText();
      break;
    case "transport":
      refreshModule("Transport", "Transport");
      break;
    case "health":
      refreshModule("Health", "Health");
      break;
    case "environment":
      refreshModule("Environment", "Environment");
      break;
    case "bus":
      // Only reload if presets are empty
      break;
    case "tides":
      refreshModule("Tides", "Tides");
      break;
    case "parking":
      // Only load on first visit
      if (!window._parkingLoaded) {
        window._parkingLoaded = true;
        refreshModule("Parking", "Parking");
      }
      break;
    case "ferry":
      if (!window._ferryLoaded) {
        window._ferryLoaded = true;
        refreshModule("Ferry", "Ferry");
      }
      break;
    case "beach":
      if (!window._beachLoaded) {
        window._beachLoaded = true;
        refreshModule("Beach", "Beach");
      }
      break;
    case "map":
      refreshModule("Map", "MapView");
      break;
    case "holidays":
      // Load on first visit
      if (!window._holidaysLoaded) {
        window._holidaysLoaded = true;
        refreshModule("Holidays", "Holidays");
      }
      break;
    case "climate":
      // Load on first visit
      if (!window._climateLoaded) {
        window._climateLoaded = true;
        refreshModule("Climate", "Climate");
      }
      break;
    // CCTV: don't auto-load, let user choose cameras
    case "waste":
      if (!window._wasteLoaded) {
        window._wasteLoaded = true;
        refreshModule("Waste", "Waste");
      }
      break;
  }
};

/* ── Load weather forecast text for weather page ─────────────── */
async function loadWeatherForecastText() {
  const cont = document.getElementById("w-flw-content");
  if (!cont) return;
  cont.innerHTML = `<div class="skel skel-p"></div><div class="skel skel-p" style="margin-top:8px"></div>`;
  try {
    const r = await fetch(
      "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=tc",
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const { generalSituation, forecastDesc, outlook } = data;
    cont.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--sp-4)">
        ${
          generalSituation
            ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">天氣概況 General Situation</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${generalSituation}</div>
          </div>
        `
            : ""
        }
        ${
          forecastDesc
            ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">天氣預測 Forecast</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${forecastDesc}</div>
          </div>
        `
            : ""
        }
        ${
          outlook
            ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">展望 Outlook</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${outlook}</div>
          </div>
        `
            : ""
        }
      </div>
    `;
  } catch (e) {
    cont.innerHTML = `<div style="color:var(--error);font-size:var(--text-xs)">載入失敗：${e.message}</div>`;
  }
}

/* ── Refresh indicator in footer ─────────────────────────────── */
(function initRefreshIndicator() {
  const footer = document.querySelector(".dashboard-footer-inner");
  if (!footer) return;
  const div = document.createElement("div");
  div.id = "footer-refresh";
  div.style.cssText = "font-size:10px;color:var(--text-faint)";
  div.textContent = `載入中…`;
  footer.appendChild(div);

  function updateIndicator() {
    const now = new Date().toLocaleTimeString("zh-HK", { hour12: false });
    const el = document.getElementById("footer-refresh");
    if (el) el.textContent = `最後更新 Last updated: ${now}`;
  }

  setTimeout(updateIndicator, 2000);
  setInterval(updateIndicator, 60000);
})();

/* ── PWA Install Prompt ──────────────────────────────────────── */
(function initPWAPrompt() {
  let _deferredPrompt = null;

  // iOS detection
  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isInStandaloneMode =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  // Don't show if already installed or already shown this session
  if (isInStandaloneMode) return;

  function createBanner(message, onInstall, onDismiss) {
    const existing = document.getElementById("pwa-install-banner");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "pwa-install-banner";
    banner.style.cssText = `
      position: fixed;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: min(420px, calc(100vw - 32px));
      width: 100%;
      animation: slideUp 0.3s ease;
    `;

    banner.innerHTML = `
      <span style="font-size:1.4rem">📱</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--text-sm);font-weight:600;color:var(--text)">
          加入主屏幕 Add to Home Screen
        </div>
        <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px;line-height:1.4">
          ${message}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        ${
          onInstall
            ? `<button id="pwa-install-btn"
          style="background:var(--primary);color:white;border:none;border-radius:var(--r-md);
                 padding:6px 14px;font-size:var(--text-xs);font-weight:700;cursor:pointer">
          安裝
        </button>`
            : ""
        }
        <button id="pwa-dismiss-btn"
          style="background:var(--surface-2);color:var(--text-muted);border:1px solid var(--border);
                 border-radius:var(--r-md);padding:6px 10px;font-size:var(--text-xs);cursor:pointer">
          ✕
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    if (onInstall) {
      document
        .getElementById("pwa-install-btn")
        ?.addEventListener("click", () => {
          onInstall();
          banner.remove();
        });
    }

    document
      .getElementById("pwa-dismiss-btn")
      ?.addEventListener("click", () => {
        onDismiss?.();
        banner.remove();
      });
  }

  // Android/Chrome: listen for beforeinstallprompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;

    if (window._pwaPromptShown) return;
    window._pwaPromptShown = true;

    // Delay slightly to not interrupt initial load
    setTimeout(() => {
      createBanner(
        "像App一樣使用 — 快速存取、離線瀏覽",
        async () => {
          if (_deferredPrompt) {
            _deferredPrompt.prompt();
            const { outcome } = await _deferredPrompt.userChoice;
            _deferredPrompt = null;
            console.log("[PWA] Install outcome:", outcome);
          }
        },
        () => {
          console.log("[PWA] Prompt dismissed");
        },
      );
    }, 3000);
  });

  // iOS: show manual instructions (no beforeinstallprompt event)
  if (isIOS) {
    if (window._pwaPromptShown) return;

    setTimeout(() => {
      if (window._pwaPromptShown) return;
      window._pwaPromptShown = true;

      createBanner(
        "點擊 Safari 分享按鈕 → 加入主畫面",
        null, // no programmatic install on iOS
        () => {
          console.log("[PWA] iOS prompt dismissed");
        },
      );
    }, 4000);
  }

  // Add slideUp animation if not present
  if (!document.getElementById("pwa-style")) {
    const style = document.createElement("style");
    style.id = "pwa-style";
    style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
})();
