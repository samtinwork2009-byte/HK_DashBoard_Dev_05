/*
 * 香港城市儀表板外部 API 連線檢查工具
 * 在瀏覽器開發者工具 Console 載入或貼上此檔案即可執行。
 */
(async function runApiHealthCheck() {
  const timeoutMs = 10000;
  const endpoints = [
    {
      name: "香港天文台天氣",
      host: "data.weather.gov.hk",
      url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc",
    },
    {
      name: "港鐵班次",
      host: "rt.data.gov.hk",
      url: "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TML&sta=TUM",
    },
    {
      name: "九巴路線",
      host: "data.etabus.gov.hk",
      url: "https://data.etabus.gov.hk/v1/transport/kmb/route/60X/outbound/1",
    },
    {
      name: "專線小巴路線",
      host: "data.etagmb.gov.hk",
      url: "https://data.etagmb.gov.hk/route/getroute",
    },
    {
      name: "政府開放資料",
      host: "api.data.gov.hk",
      url: "https://api.data.gov.hk/v1",
    },
    {
      name: "空氣質素預報",
      host: "datagovhk.blob.core.windows.net",
      url: "https://datagovhk.blob.core.windows.net/dataset/aqhi/aqhi-forecast.json",
    },
    {
      name: "醫院管理局資料",
      host: "www.ha.org.hk",
      url: "https://www.ha.org.hk/visitor/ha_visitor_index.asp",
    },
    {
      name: "新聞代理",
      host: "api.allorigins.win",
      url: "https://api.allorigins.win/raw?url=https%3A%2F%2Fwww.hk01.com%2Ffeeds%2Frss",
    },
    {
      name: "道路閉路電視",
      host: "tdcctv.data.one.gov.hk",
      url: "https://tdcctv.data.one.gov.hk/",
    },
    {
      name: "恒生指數資料",
      host: "query1.finance.yahoo.com",
      url: "https://query1.finance.yahoo.com/v8/finance/chart/%5EHSI?range=1d&interval=1d",
    },
    {
      name: "外匯資料",
      host: "api.frankfurter.app",
      url: "https://api.frankfurter.app/latest?from=HKD",
    },
  ];

  async function checkEndpoint(endpoint) {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint.url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      return {
        名稱: endpoint.name,
        網域: endpoint.host,
        狀態碼: response.status,
        延遲毫秒: Math.round(performance.now() - startedAt),
        結果: response.ok ? "成功" : "HTTP 失敗",
        錯誤: "",
      };
    } catch (error) {
      return {
        名稱: endpoint.name,
        網域: endpoint.host,
        狀態碼: "無法取得",
        延遲毫秒: Math.round(performance.now() - startedAt),
        結果: error.name === "AbortError" ? "逾時" : "連線失敗",
        錯誤: error.message || String(error),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  console.info(`開始測試 ${endpoints.length} 個外部 API，單一請求逾時：${timeoutMs} 毫秒`);
  const results = await Promise.all(endpoints.map(checkEndpoint));
  console.table(results);
  console.info(
    `測試完成：${results.filter((item) => item.結果 === "成功").length}/${results.length} 個端點回應成功。`,
  );
  return results;
})();