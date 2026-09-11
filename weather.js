/* ============================================================
   weather.js — HKO Real-time Weather, Forecast, Rainfall, Temps
   香港城市儀表板 v2
   ============================================================ */

"use strict";

/* ── Relative time helper ──────────────────────────────────── */
function relativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    // Handle formats like "2026-04-01 17:00:00+08:00" or ISO strings
    const cleaned = dateStr.replace(" ", "T");
    const dt = new Date(cleaned);
    if (isNaN(dt.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - dt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return "剛剛更新";
    if (diffMins < 60) return diffMins + " 分鐘前更新";
    if (diffHrs < 24) return diffHrs + " 小時前更新";
    // 24+ hours: show actual date
    return dt.toLocaleDateString("zh-HK", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return dateStr;
  }
}

// Expose for use in other modules (health.js etc.)
window.relativeTime = relativeTime;

const WX_BASE = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";
const ICON_BASE = "https://www.hko.gov.hk/images/HKOWxIconOutline/pic";

/* ── Weather icon description map ─────────────────────────── */
const WX_DESC = {
  50: "晴天",
  51: "間有陽光",
  52: "短暫陽光",
  53: "多雲",
  54: "多雲幾陣雨",
  60: "陰天",
  61: "陰天有驟雨",
  62: "雷暴",
  63: "陰天驟雨雷暴",
  64: "霧",
  65: "微風",
  70: "天色良好",
  71: "天色良好",
  72: "天色良好",
  73: "天色良好",
  74: "天色良好",
  75: "天色良好",
  76: "天色良好",
  77: "天色良好",
  80: "大驟雨",
  81: "驟雨",
  82: "短暫時間有雨",
  83: "有雨",
  84: "傾盆大雨",
  85: "有驟雨",
  86: "有驟雨",
  87: "雷暴",
  88: "雷暴",
  89: "龍捲風",
  90: "熱帶氣旋",
  91: "強烈季候風信號",
  92: "偶有陽光",
  93: "多雲",
  94: "天色大致良好",
};

const WARN_LABELS = {
  WTCSGNL: "熱帶氣旋警告",
  WRAIN: "暴雨警告",
  WFROST: "霜凍警告",
  WHOT: "酷熱天氣警告",
  WCOLD: "寒冷天氣警告",
  WWIND: "強烈季候風信號",
  WFIRE: "火災危險警告",
  WTMW: "海嘯警告",
  WL: "山泥傾瀉警告",
  WMSGNL: "強烈季候風信號",
};

/* ── Fetch current weather (rhrread) ────────────────────────── */
async function fetchCurrentWeather() {
  try {
    const url = `${WX_BASE}?dataType=rhrread&lang=tc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    renderCurrentWeather(d);
    renderHomeWeather(d);
  } catch (e) {
    console.error("Weather fetch error:", e);
    showWeatherError();
  }
}

function renderCurrentWeather(d) {
  // Temperature — use first station
  const temps = d.temperature?.data || [];
  const main = temps.find((t) => t.place === "香港天文台") || temps[0] || {};
  setEl("w-temp", main.value ?? "--");
  setEl("h-temp", main.value ?? "--");

  // Humidity
  const hum = d.humidity?.data?.[0]?.value ?? "--";
  setEl("w-hum", hum + (hum !== "--" ? "%" : ""));
  setEl("h-hum", hum);

  // Icon + description
  const iconCode = d.icon?.[0];
  const iconUrl = iconCode ? `${ICON_BASE}${iconCode}.png` : "";
  const desc = WX_DESC[iconCode] || d.weatherMain?.[0]?.text || "天氣資料";
  setImgSrc("w-icon", iconUrl);
  setEl("w-desc", desc);
  setImgSrc("h-wicon", iconUrl);
  setEl("h-wdesc", desc);

  // UV
  const uvArr = d.uvindex?.data || [];
  const uvVal = uvArr[0]?.value ?? "--";
  const uvDesc = uvArr[0]?.desc || "";
  setEl("w-uv", uvVal + (uvVal !== "--" ? ` (${uvDesc})` : ""));
  setEl("h-uv", uvVal);
  setEl("h-uvd", uvDesc ? `紫外線 ${uvDesc}` : "紫外線指數");

  // Sea temp (comes from forecast, not rhrread — set placeholder)
  // Updated by fetchForecast()

  // Update time
  const upd = d.temperature?.recordTime || "";
  setEl("w-upd", upd ? relativeTime(upd) : "");
  setEl("h-wtime", upd ? relativeTime(upd) : "");

  window._lastWeatherUpdate = upd
    ? new Date(upd).toISOString()
    : new Date().toISOString();
  window._lastWeatherTemp = main.value ?? "--";
  window._lastWeatherHumidity = hum !== "--" ? hum + "%" : "--";
  window._lastWeatherUV = uvVal !== "--" ? uvVal : "--";
  window._lastWeatherDesc = desc;
  window._lastWeatherCondition = desc;
  window._lastWeatherAQHI = window._lastWeatherAQHI || "--";

  const windData = d.wind?.data?.[0] || {};
  const windDir = windData.direction || windData.desc || "--";
  const windSpeed = windData.speed || windData.value || windData.ms || "--";
  const windText =
    windDir && windSpeed ? `${windDir} ${windSpeed} km/h` : "-- / --";
  setEl("summary-wind", windText);

  if (typeof updateSummaryWeather === "function") {
    updateSummaryWeather(
      main.value ?? "--",
      window._lastWeatherAQHI || "--",
      desc,
      upd ? relativeTime(upd) : "",
      window._lastWeatherHumidity,
      window._lastWeatherUV,
      desc,
      windText,
    );
  }

  // Warnings
  const warnArr = d.warningMessage || [];
  const warnText = Array.isArray(warnArr) ? warnArr.join(" ") : warnArr;
  const wWarnWrap = document.getElementById("w-warn-wrap");
  const wWarn = document.getElementById("w-warn");
  const warnStatus = document.getElementById("w-warning-status");
  const warnSummary = document.getElementById("w-warning-summary");
  if (warnText && warnText.trim()) {
    if (wWarnWrap) wWarnWrap.classList.remove("hidden");
    if (wWarnWrap) wWarnWrap.style.display = "";
    if (wWarn) wWarn.textContent = warnText;
    if (warnStatus) {
      warnStatus.textContent = "警報生效";
      warnStatus.classList.remove("tag-green", "tag-blue", "tag-muted");
      warnStatus.classList.add("tag-red");
    }
    if (warnSummary) warnSummary.textContent = warnText;
  } else {
    if (wWarnWrap) wWarnWrap.classList.add("hidden");
    if (wWarnWrap) wWarnWrap.style.display = "none";
    if (warnStatus) {
      warnStatus.textContent = "無生效警報";
      warnStatus.classList.remove("tag-red", "tag-green", "tag-blue");
      warnStatus.classList.add("tag-green");
    }
    if (warnSummary) warnSummary.textContent = "暫無警報";
  }

  // Rainfall all districts
  const rain = d.rainfall?.data || [];
  renderRainfall(rain, "h-rain");
  renderRainfall(rain, "w-rain");

  // Temperature stations
  renderTemps(temps, "h-temps");
  renderTemps(temps, "w-temps");
}

function renderHomeWeather(d) {
  // Already handled inside renderCurrentWeather
}

function updateSummaryForecast(text) {
  const el = document.getElementById("summary-forecast");
  if (!el) return;
  if (!text || text.trim() === "") {
    el.textContent = "短期天氣：暫無資料";
    return;
  }
  el.textContent = text;
}

async function fetchAQHI() {
  if (
    typeof Environment !== "undefined" &&
    typeof Environment.fetchAQHI === "function"
  ) {
    return Environment.fetchAQHI();
  }
  console.warn("AQHI refresh skipped: Environment.fetchAQHI unavailable");
  return Promise.resolve();
}

function getDistrictFromCoords(lat, lng) {
  if (lng >= 113.95 && lng <= 114.35 && lat >= 22.25 && lat <= 22.45)
    return "屯門區";
  if (lng >= 113.85 && lng <= 114.25 && lat >= 22.35 && lat <= 22.55)
    return "元朗區";
  if (lng >= 114.05 && lng <= 114.25 && lat >= 22.3 && lat <= 22.4)
    return "沙田區";
  if (lng >= 114.15 && lng <= 114.25 && lat >= 22.3 && lat <= 22.35)
    return "大埔區";
  if (lng >= 114.1 && lng <= 114.25 && lat >= 22.3 && lat <= 22.4)
    return "西貢區";
  if (lng >= 114.1 && lng <= 114.2 && lat >= 22.25 && lat <= 22.35)
    return "葵青區";
  if (lng >= 114.15 && lng <= 114.2 && lat >= 22.3 && lat <= 22.35)
    return "荃灣區";
  if (lng >= 114.16 && lng <= 114.23 && lat >= 22.3 && lat <= 22.35)
    return "中西區";
  if (lng >= 114.15 && lng <= 114.2 && lat >= 22.3 && lat <= 22.35)
    return "九龍區";
  return "香港本地";
}

async function fetchLocationInfo() {
  const locEl = document.getElementById("summary-location");
  const ipEl = document.getElementById("summary-ip");
  if (locEl) locEl.textContent = "定位中...";
  if (ipEl) ipEl.textContent = "IP: 讀取中...";

  function setLocation(text) {
    if (locEl) locEl.textContent = text;
  }
  function setIp(text) {
    if (ipEl) ipEl.textContent = text;
  }

  let district = "香港本地";
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(2);
        const lon = position.coords.longitude.toFixed(2);
        district =
          getDistrictFromCoords(
            position.coords.latitude,
            position.coords.longitude,
          ) || "香港本地";
        setLocation(`${district} · ${lat}°N, ${lon}°E`);
        window._lastWeatherDistrict = district;
      },
      () => {
        setLocation("GPS 位置不可用");
      },
      { timeout: 8000 },
    );
  } else {
    setLocation("GPS 不支援");
  }

  try {
    const resp = await fetch("https://ipapi.co/json/");
    if (resp.ok) {
      const json = await resp.json();
      const city = json.city || json.region || "";
      const ipText = json.ip ? `IP: ${json.ip}` : "IP: 未知";
      setIp(city ? `${ipText} · ${city}` : ipText);
    } else {
      const resp2 = await fetch("https://api.ipify.org?format=json");
      if (resp2.ok) {
        const json = await resp2.json();
        setIp(`IP: ${json.ip || "未知"}`);
      } else {
        setIp("IP: 讀取失敗");
      }
    }
  } catch (e) {
    console.error("IP fetch error:", e);
    setIp("IP: 讀取失敗");
  }
}

function parseTideToday(json) {
  const fields = json.fields || [];
  const data = json.data || [];
  if (!fields.length || !data.length) return null;
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const row = data.find((r) => r[0] === m && r[1] === d);
  if (!row) return null;
  const hours = [];
  for (let h = 1; h <= 24; h++) {
    const field = String(h).padStart(2, "0");
    const idx = fields.indexOf(field);
    if (idx !== -1 && row[idx] !== undefined && row[idx] !== "") {
      hours.push({ hour: h, height: parseFloat(row[idx]) });
    }
  }
  return hours;
}

async function fetchTideSummary() {
  const el = document.getElementById("summary-tide");
  if (!el) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const station = "TMW";
  const url = `https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=HHOT&station=${station}&year=${year}&month=${month}&rformat=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tide HTTP ${res.status}`);
    const json = await res.json();
    const hours = parseTideToday(json);
    if (!hours || !hours.length) {
      el.textContent = "潮汐：暫無資料";
      return;
    }
    const high = hours.reduce(
      (acc, cur) => (cur.height > acc.height ? cur : acc),
      hours[0],
    );
    const low = hours.reduce(
      (acc, cur) => (cur.height < acc.height ? cur : acc),
      hours[0],
    );
    el.textContent = `潮汐：${station} 今日高潮 ${String(high.hour).padStart(2, "0")}:00 ${high.height.toFixed(2)}m · 低潮 ${String(low.hour).padStart(2, "0")}:00 ${low.height.toFixed(2)}m`;
  } catch (e) {
    console.error("Tide summary error:", e);
    el.textContent = "潮汐：載入失敗";
  }
}

async function fetchSunTimes() {
  const sunriseEl = document.getElementById("summary-sunrise");
  const sunsetEl = document.getElementById("summary-sunset");
  if (!sunriseEl && !sunsetEl) return;

  try {
    const res = await fetch(
      "https://api.sunrise-sunset.org/json?lat=22.3193&lng=114.1694&date=today&formatted=0",
    );
    if (!res.ok) throw new Error(`SunTime HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== "OK" || !data.results)
      throw new Error(`SunTime API ${data.status}`);

    const toLocal = (iso) => {
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return "--";
      return dt.toLocaleTimeString("zh-HK", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    if (sunriseEl) sunriseEl.textContent = toLocal(data.results.sunrise);
    if (sunsetEl) sunsetEl.textContent = toLocal(data.results.sunset);
  } catch (e) {
    console.error("Sun time fetch error:", e);
    if (sunriseEl) sunriseEl.textContent = "--";
    if (sunsetEl) sunsetEl.textContent = "--";
  }
}

function setSummaryAlert(text) {
  const el = document.getElementById("summary-alert");
  if (el) el.textContent = text;
}

function updateSummaryWeather(
  currentTemp,
  aqhi,
  desc,
  updatedAt,
  humidity,
  uv,
  condition,
  wind,
) {
  const tempEl = document.getElementById("summary-temp");
  const aqhiEl = document.getElementById("summary-aqhi");
  const descEl = document.getElementById("summary-weather-desc");
  const updatedEl = document.getElementById("summary-updated");
  const humidityEl = document.getElementById("summary-humidity");
  const uvEl = document.getElementById("summary-uv");
  const conditionEl = document.getElementById("summary-condition");
  const visualEl = document.getElementById("summary-weather-visual");
  const windEl = document.getElementById("summary-wind");
  if (tempEl)
    tempEl.textContent =
      currentTemp !== undefined ? `${currentTemp}°C` : "--°C";
  if (aqhiEl) aqhiEl.textContent = aqhi || "--";
  if (descEl) descEl.textContent = desc || "載入中...";
  if (updatedEl) updatedEl.textContent = updatedAt || "-- 分鐘前";
  if (humidityEl) humidityEl.textContent = humidity || "--%";
  if (uvEl) uvEl.textContent = uv || "--";
  if (conditionEl) conditionEl.textContent = condition || desc || "載入中...";
  if (windEl) windEl.textContent = wind || "-- / --";
  if (visualEl) visualEl.textContent = getWeatherEmoji(condition || desc);
}

function renderRainfall(rain, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!rain.length) {
    el.innerHTML =
      '<div style="color:var(--text-faint);font-size:var(--text-sm)">暫無降雨數據</div>';
    return;
  }
  el.innerHTML = rain
    .map((r) => {
      const mm = r.max ?? r.value ?? 0;
      const hasRain = mm > 0;
      return `<div class="row-item" style="flex-direction:column;align-items:flex-start;gap:2px">
      <span style="font-size:var(--text-xs);color:var(--text-muted)">${r.place}</span>
      <span style="font-weight:600;color:${hasRain ? "var(--info)" : "var(--text-faint)"}">${mm} <span style="font-size:10px;font-weight:400">mm</span></span>
    </div>`;
    })
    .join("");
}

function renderTemps(temps, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!temps.length) return;
  el.innerHTML = temps
    .map((t) => {
      const val = t.value ?? "--";
      return `<div class="row-item" style="flex-direction:column;align-items:flex-start;gap:2px">
      <span style="font-size:var(--text-xs);color:var(--text-muted)">${t.place}</span>
      <span style="font-weight:600">${val}<span style="font-size:10px;color:var(--text-faint)"> °C</span></span>
    </div>`;
    })
    .join("");
}

/* ── Fetch 9-day forecast ───────────────────────────────────── */
async function fetchForecast() {
  try {
    const url = `${WX_BASE}?dataType=fnd&lang=tc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    renderForecast(d);

    const summaryWeather = d.weatherForecast?.[0];
    if (summaryWeather) {
      updateSummaryForecast(
        `短期天氣：${summaryWeather.forecastWeather || summaryWeather.forecastWind || summaryWeather.week || ""}`,
      );
    } else {
      updateSummaryForecast(d.generalSituation || "暫無資料");
    }

    const localSummaryEl = document.getElementById("w-flw-summary");
    const localBodyEl = document.getElementById("w-flw-content");
    if (localSummaryEl) {
      localSummaryEl.textContent = summaryWeather
        ? summaryWeather.forecastWeather ||
          summaryWeather.forecastWind ||
          summaryWeather.week ||
          d.generalSituation ||
          "暫無預報"
        : d.generalSituation || "暫無預報";
    }
    if (localBodyEl) {
      localBodyEl.textContent = summaryWeather
        ? `今日 ${summaryWeather.week || ""} 天氣：${summaryWeather.forecastWeather || summaryWeather.forecastWind || "暫無資料"}。最高 ${summaryWeather.forecastMaxtemp?.value ?? "--"}°C，最低 ${summaryWeather.forecastMintemp?.value ?? "--"}°C。`
        : d.generalSituation || "請稍候載入最新天氣預報。";
    }

    // Sea temp from forecast seaTemp field
    const seaTemp =
      d.seaTemp?.value ?? d.weatherForecast?.[0]?.FSeaTemp ?? "--";
    setEl("w-sea", seaTemp !== "--" ? `${seaTemp}°C` : "--");
    setEl("h-sea", seaTemp !== "--" ? seaTemp : "--");

    // General situation
    const gen = d.generalSituation || "";
    setEl("w-general", gen);
  } catch (e) {
    console.error("Forecast fetch error:", e);
  }
}

function renderForecast(d) {
  const days = d.weatherForecast || [];

  // API uses camelCase: forecastDate, week, forecastMaxtemp, forecastMintemp, ForecastIcon, PSR
  // Home forecast (scroll row, compact)
  const hForecast = document.getElementById("h-forecast");
  if (hForecast) {
    hForecast.innerHTML = days
      .slice(0, 9)
      .map((day) => {
        const iconCode = day.ForecastIcon;
        const iconUrl = iconCode ? `${ICON_BASE}${iconCode}.png` : "";
        const hi = day.forecastMaxtemp?.value ?? "--";
        const lo = day.forecastMintemp?.value ?? "--";
        const rawDate = day.forecastDate || "";
        const dateStr = rawDate
          ? `${rawDate.slice(4, 6)}/${rawDate.slice(6, 8)}`
          : "";
        const dow = day.week || "";
        return `<div class="forecast-chip">
        <div class="fc-date">${dateStr}</div>
        <div class="fc-dow" style="font-size:9px;color:var(--text-faint)">${dow}</div>
        ${iconUrl ? `<img src="${iconUrl}" class="fc-icon" alt="" onerror="this.style.display='none'">` : '<div class="fc-icon" style="width:32px;height:32px"></div>'}
        <div class="fc-temps"><span class="fc-hi">${hi !== "--" ? hi + "°" : "--"}</span><span class="fc-lo">${lo !== "--" ? lo + "°" : "--"}</span></div>
      </div>`;
      })
      .join("");
  }

  // Weather page forecast (larger)
  const wForecast = document.getElementById("w-forecast9");
  if (wForecast) {
    wForecast.innerHTML = days
      .slice(0, 9)
      .map((day) => {
        const iconCode = day.ForecastIcon;
        const iconUrl = iconCode ? `${ICON_BASE}${iconCode}.png` : "";
        const hi = day.forecastMaxtemp?.value ?? "--";
        const lo = day.forecastMintemp?.value ?? "--";
        const psr = day.PSR || ""; // Probability of Significant Rain
        const rawDate = day.forecastDate || "";
        const dateStr = rawDate
          ? `${rawDate.slice(4, 6)}/${rawDate.slice(6, 8)}`
          : "";
        const dow = day.week || "";
        const weather = day.forecastWeather || "";
        return `<div class="forecast-chip" style="min-width:90px">
        <div class="fc-date">${dateStr}</div>
        <div class="fc-dow" style="font-size:9px;color:var(--text-faint)">${dow}</div>
        ${iconUrl ? `<img src="${iconUrl}" class="fc-icon" alt="" onerror="this.style.display='none'">` : '<div class="fc-icon" style="width:32px;height:32px"></div>'}
        <div class="fc-temps"><span class="fc-hi">${hi !== "--" ? hi + "°" : "--"}</span><span class="fc-lo">${lo !== "--" ? lo + "°" : "--"}</span></div>
        ${psr ? `<div style="font-size:9px;color:var(--info);margin-top:2px" title="${weather}">☔${psr}</div>` : ""}
      </div>`;
      })
      .join("");
  }
}

function showWeatherError() {
  setEl("h-wdesc", "無法載入天氣資料");
  setEl("w-desc", "無法載入天氣資料");
}

/* ── DOM helpers ────────────────────────────────────────────── */
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setImgSrc(id, src) {
  const el = document.getElementById(id);
  if (el) {
    el.src = src;
    el.style.display = src ? "" : "none";
  }
}

/* ── Public API ─────────────────────────────────────────────── */

/* ── Fetch weather warning summary (warnsum) ─────────────────── */
async function fetchWarnsum() {
  try {
    const url = `${WX_BASE}?dataType=warnsum&lang=tc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // warnsum returns {} when no active warnings — check explicitly
    if (!data || Object.keys(data).length === 0) {
      renderWarnsum(null);
      return;
    }
    renderWarnsum(data);
    // Fetch detailed warningInfo if there are active warnings
    await fetchWarningInfo();
  } catch (e) {
    console.error("Warnsum fetch error:", e);
  }
}

/* ── Fetch warning info detail (warningInfo) ─────────────────── */
async function fetchWarningInfo() {
  try {
    const url = `${WX_BASE}?dataType=warningInfo&lang=tc`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const details = data.details || [];
    renderWarningInfo(details);
  } catch (e) {
    console.error("WarningInfo fetch error:", e);
  }
}

/* ── Render warnsum ──────────────────────────────────────────── */
function renderWarnsum(data) {
  const el = document.getElementById("w-warnsum");
  if (!el) return;
  if (!data || Object.keys(data).length === 0) {
    setSummaryAlert("暫無警報");
    el.innerHTML = `<div class="row-item"><span style="color:var(--success)">✅ 目前沒有生效的天氣警告 No active warnings</span></div>`;
    // render history if any
    renderWarnHistory([]);
    return;
  }

  const warnings = Object.values(data);
  // Build alert text for summary
  const alertText = warnings
    .map((w) => (w.name || w.type || "警告") + (w.code ? `(${w.code})` : ""))
    .join(" · ");
  setSummaryAlert(alertText);

  // Render each warning with level-specific visuals
  el.innerHTML = warnings
    .map((w) => {
      const name = w.name || w.type || "警告";
      const code = w.code || "";
      const issueTime = w.issueTime || "";
      const actionCode = (w.actionCode || "").toUpperCase();
      // Determine visual level for rain warnings
      let levelClass = "tag-muted";
      let bannerClass = "";
      let emoji = "⚠️";
      if (
        (w.type || "").toUpperCase().includes("RAIN") ||
        (w.code || "").toUpperCase().includes("RAIN")
      ) {
        // WRAIN codes might be WAMB/WRED/WBLA etc.
        const codeUpper = (w.code || "").toUpperCase();
        if (codeUpper.includes("WRED") || codeUpper.includes("WRED")) {
          bannerClass = "warn-red";
          emoji = "🌧️";
        } else if (codeUpper.includes("WBLA") || codeUpper.includes("WAMB")) {
          bannerClass = "warn-yellow";
          emoji = "🌦️";
        } else {
          bannerClass = "warn-yellow";
          emoji = "🌧️";
        }
      }
      if (actionCode === "ISSUE") levelClass = "tag-red";
      else if (actionCode === "UPDATE") levelClass = "tag-yellow";

      // Safety tips per major categories (simple mapping)
      let tips = "";
      if (bannerClass === "warn-red") {
        tips = "紅雨：注意路面積水、避免到低窪及郊外活動；留意山泥傾瀉風險。";
      } else if (bannerClass === "warn-yellow") {
        tips = "黃雨：小心路面濕滑，駕駛注意減速慢行。";
      } else if ((w.type || "").toLowerCase().includes("typhoon")) {
        tips = "熱帶氣旋：注意風力變化及風球發布；固定鬆動物件。";
      }

      // Save to history
      try {
        saveWarnHistory({
          code: code || actionCode || name,
          name,
          issueTime,
          action: actionCode,
          tips,
        });
      } catch (e) {}

      return `
      <div class="row-item ${bannerClass}" style="flex-direction:column;align-items:flex-start;gap:8px">
        <div style="display:flex;align-items:center;gap:var(--sp-3);width:100%">
          <div style="flex-shrink:0;font-size:1.6rem">${emoji}</div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:var(--text-sm);color:var(--text)">${name} ${code ? "(" + code + ")" : ""}</div>
            ${issueTime ? `<div style="font-size:var(--text-xs);color:var(--text-faint)">發布時間 ${issueTime} · 來源：香港天文台</div>` : ""}
          </div>
          <div style="margin-left:auto"><span class="tag ${levelClass}">${code || actionCode}</span></div>
        </div>
        ${tips ? `<div style="font-size:0.95rem;color:var(--text);">${tips}</div>` : ""}
      </div>
    `;
    })
    .join("");

  // render history
  const hist = loadWarnHistory();
  renderWarnHistory(hist);
}

function saveWarnHistory(entry) {
  if (!entry || !entry.code) return;
  try {
    const raw = localStorage.getItem("hk_warn_history") || "[]";
    const arr = JSON.parse(raw);
    // push with timestamp
    arr.unshift({ ts: new Date().toISOString(), ...entry });
    // keep last 50
    const trimmed = arr.slice(0, 50);
    localStorage.setItem("hk_warn_history", JSON.stringify(trimmed));
  } catch (e) {
    console.error("saveWarnHistory", e);
  }
}

function loadWarnHistory() {
  try {
    return JSON.parse(localStorage.getItem("hk_warn_history") || "[]");
  } catch (e) {
    return [];
  }
}

function renderWarnHistory(arr) {
  const el = document.getElementById("w-warning-details");
  if (!el) return;
  if (!arr || !arr.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML =
    '<div class="warn-timeline">' +
    arr
      .slice(0, 20)
      .map(
        (i) =>
          `\n    <div class="tl-item">\n      <div class="tl-time">${new Date(i.ts).toLocaleString("zh-HK", { hour12: false })}</div>\n      <div class="tl-desc">${i.action || ""} ${i.code || ""} ${i.name ? "- " + i.name : ""} ${i.issueTime ? '<div style="font-size:0.85rem;color:var(--text-faint);margin-top:6px">發佈時間: ' + i.issueTime + "</div>" : ""}${i.tips ? '<div style="margin-top:6px;font-size:0.9rem;color:var(--text-muted)">' + i.tips + "</div>" : ""}</div>\n    </div>`,
      )
      .join("") +
    "\n</div>";
}

/* ── Render warningInfo details ─────────────────────────────── */
function renderWarningInfo(details) {
  const el = document.getElementById("w-warning-details");
  if (!el || !details.length) return;
  el.innerHTML = details
    .map((d) => {
      const contents = d.contents || [];
      return `
      <div class="card" style="border-color:var(--warning);margin-top:var(--sp-3)">
        <div style="font-weight:700;color:var(--warning);margin-bottom:var(--sp-2)">${d.warningStatementCode || d.subtype || "警告"}</div>
        ${contents
          .map((c) => {
            const lines = c.value || [];
            return lines
              .map(
                (line) =>
                  `<div style="font-size:var(--text-sm);color:var(--text-muted);line-height:1.6;margin-bottom:4px">${line}</div>`,
              )
              .join("");
          })
          .join("")}
      </div>
    `;
    })
    .join("");
}

/* ── Weather Warning Banner ─────────────────────────────────── */
async function fetchWarningBanner() {
  try {
    const r = await fetch(
      "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc",
    );
    const data = await r.json();
    const banner = document.getElementById("warning-banner");
    const bannerText = document.getElementById("warning-banner-text");
    if (!banner || !bannerText) return;

    const warningKeys = Object.keys(data || {});
    if (warningKeys.length === 0) {
      banner.classList.remove("visible");
      return;
    }

    const WARN_LABELS = {
      WTCSGNL: "熱帶氣旋警告",
      WRAIN: "暴雨警告",
      WFROST: "霜凍警告",
      WHOT: "酷熱天氣警告",
      WCOLD: "寒冷天氣警告",
      WWIND: "強烈季候風信號",
      WFIRE: "火災危險警告",
      WTMW: "海嘯警告",
      WL: "山泥傾瀉警告",
      WMSGNL: "強烈季候風信號",
    };

    const meta = getWarningMeta(data);
    banner.style.background = meta.bannerBg;
    banner.style.borderBottom = "2px solid " + meta.bannerBorder;
    banner.style.animation = meta.bannerAnimation;

    bannerText.textContent = meta.labelText;
    bannerText.style.fontSize = meta.fontSize;

    const iconEl = banner.querySelector(".warning-banner-icon");
    if (iconEl) iconEl.textContent = meta.icon;

    banner.classList.add("visible");
    renderWarningPopupContent(data);

    try {
      if (warningKeys.length) {
        const first = data[warningKeys[0]] || {};
        const label = first.name || first.type || warningKeys[0];
        if (window.showNotification)
          window.showNotification("天文台警報：" + label, { duration: 8000 });
      }
    } catch (e) {}
  } catch (e) {
    const banner = document.getElementById("warning-banner");
    if (banner) banner.classList.remove("visible");
  }
}

function getWarningMeta(data) {
  const keys = Object.keys(data || {});
  const meta = {
    bannerBg: "linear-gradient(135deg,#7f1d1d,#991b1b)",
    bannerBorder: "#ef4444",
    bannerAnimation: "pulse-warn 2s ease-in-out infinite",
    fontSize: "var(--text-sm)",
    icon: "⚠️",
    labelText: "現時生效警告：",
  };
  if (!keys.length) return meta;

  const entries = keys.map((k) => data[k]);
  const primary =
    entries.find(
      (e) =>
        e.type?.toUpperCase().includes("TY") ||
        e.type?.toUpperCase().includes("TYPHOON"),
    ) ||
    data["WTCSGNL"] ||
    data["WRAIN"] ||
    entries[0];

  const primaryKey = keys.find((k) => data[k] === primary) || keys[0];
  const primaryLabel = primary?.name || WARN_LABELS[primaryKey] || primaryKey;
  const primaryCode = primary?.code || primary?.type || "";

  meta.labelText =
    "現時生效警告：" +
    keys
      .map((k) => {
        const entry = data[k];
        const label = WARN_LABELS[k] || entry?.name || entry?.type || k;
        const code = entry?.code || entry?.type || "";
        return label + (code ? " (" + code + ")" : "");
      })
      .join(" · ");

  if (primaryKey === "WTCSGNL") {
    const tcCode = (primaryCode || "").toUpperCase();
    const signal = parseInt(tcCode.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(signal) && signal >= 8) {
      meta.bannerBg = "linear-gradient(135deg,#7f0000,#cc0000)";
      meta.bannerBorder = "#ff0000";
      meta.bannerAnimation = "pulse-warn-fast 1s ease-in-out infinite";
      meta.fontSize = "var(--text-lg)";
      meta.icon = "🌀";
      return meta;
    }
  }

  if (primaryKey === "WRAIN") {
    const rainCode = (primaryCode || "").toUpperCase();
    if (rainCode === "WBLA") {
      meta.bannerBg = "linear-gradient(135deg,#2d1b69,#4c1d95)";
      meta.bannerBorder = "#7c3aed";
      meta.icon = "🌦️";
    } else if (rainCode === "WRED") {
      meta.bannerBg = "linear-gradient(135deg,#7c2d12,#c2410c)";
      meta.bannerBorder = "#f97316";
      meta.icon = "🌧️";
    } else if (rainCode === "WAMB") {
      meta.bannerBg = "linear-gradient(135deg,#78350f,#b45309)";
      meta.bannerBorder = "#f59e0b";
      meta.icon = "🌧️";
    }
  }

  if (
    primaryKey === "WFIRE" ||
    primaryKey === "WWIND" ||
    primaryKey === "WTMW" ||
    primaryKey === "WL"
  ) {
    meta.icon = "⚠️";
    meta.bannerBg = "linear-gradient(135deg,#b45309,#f59e0b)";
    meta.bannerBorder = "#f59e0b";
  }

  return meta;
}

function renderWarningPopupContent(data) {
  const contentEl = document.getElementById("warning-popup-content");
  const updateEl = document.getElementById("warning-popup-update");
  if (!contentEl || !updateEl) return;

  const keys = Object.keys(data || {});
  if (!keys.length) {
    contentEl.innerHTML =
      '<div class="warning-popup-item"><div>目前沒有生效警告。</div></div>';
    updateEl.textContent =
      "最後更新：" + new Date().toLocaleString("zh-HK", { hour12: false });
    return;
  }

  contentEl.innerHTML = keys
    .map((key) => {
      const entry = data[key] || {};
      const name = entry.name || entry.type || key;
      const code = entry.code || entry.type || "";
      const issue = entry.issueTime || entry.issuedAt || entry.validFrom || "";
      const action = (entry.actionCode || "").toUpperCase();
      const status =
        action === "ISSUE" ? "發布" : action === "UPDATE" ? "更新" : "生效中";
      const guidance = getWarningGuidance(key, code);
      const details = [];
      if (entry.forecast || entry.details)
        details.push(entry.forecast || entry.details);
      if (entry.remarks) details.push(entry.remarks);
      const detailText = details.filter(Boolean).join("；");
      return `
      <div class="warning-popup-item">
        <h3>${name}${code ? " · " + code : ""}</h3>
        <div>狀態：<strong>${status}</strong></div>
        ${issue ? `<div>發布時間：${issue}</div>` : ""}
        ${detailText ? `<div style="margin-top:var(--sp-2);">${detailText}</div>` : ""}
        ${guidance ? `<div style="margin-top:var(--sp-3);font-weight:600;color:var(--warning);">建議：${guidance}</div>` : ""}
      </div>`;
    })
    .join("");

  updateEl.textContent =
    "最後更新：" + new Date().toLocaleString("zh-HK", { hour12: false });
}

function getWarningGuidance(key, code) {
  const upper = (key || code || "").toUpperCase();
  if (upper.includes("WTCSGNL"))
    return "熱帶氣旋警告：固定鬆動物件，避免外出及海邊活動。";
  if (upper.includes("WRAIN"))
    return "暴雨警告：注意路面積水及山泥傾瀉，駕駛請減速慢行。";
  if (upper.includes("WFROST")) return "霜凍警告：戶外低溫，注意保暖及防滑。";
  if (upper.includes("WHOT"))
    return "酷熱警告：多喝水，避免長時間暴露在陽光下。";
  if (upper.includes("WCOLD")) return "寒冷警告：注意防寒保暖，留意管道結凍。";
  if (upper.includes("WWIND")) return "強風警告：固定鬆動物件，避免高空作業。";
  if (upper.includes("WFIRE")) return "火災危險警告：小心野外用火及焚燒活動。";
  if (upper.includes("WTMW")) return "海嘯警告：遠離海岸及低窪地區。";
  if (upper.includes("WL"))
    return "山泥傾瀉警告：遠離山坡及低窪地區，注意疏散指示。";
  return "請留意官方最新天氣通告，並確保行動安全。";
}

function toggleWarningPopup(open) {
  const popup = document.getElementById("warning-popup");
  if (!popup) return;
  if (open) {
    popup.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  } else {
    popup.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

window.toggleWarningPopup = toggleWarningPopup;

// Add to Weather public API
const _origWeatherRefresh = window.Weather?.refresh;
window.Weather = {
  ...window.Weather,
  fetchCurrent: fetchCurrentWeather,
  fetchForecast: fetchForecast,
  refresh: async function () {
    await Promise.all([
      fetchCurrentWeather(),
      fetchForecast(),
      fetchAQHI(),
      fetchWarnsum(),
      fetchWarningBanner(),
      fetchLocationInfo(),
      fetchTideSummary(),
      fetchSunTimes(),
    ]);
  },
};

// Also run banner check on init
fetchWarningBanner();
// Re-check every 5 minutes
setInterval(fetchWarningBanner, 300000);
