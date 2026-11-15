// Погода для прогулок: Open-Meteo (без ключей и регистрации), советы хозяину и окно без осадков.
// Включается только по желанию в настройках; координаты округляются до ~1 км.
(function (PD) {
  "use strict";

  const CACHE_KEY = "pet-diary-weather";
  const TTL = 30 * 60 * 1000;
  const API = "https://api.open-meteo.com/v1/forecast";

  // Коды погоды WMO → наш тип сцены, подпись и иконка
  function describe(code, isDay) {
    if (code === 0) return { kind: "clear", label: "Ясно", icon: isDay ? "☀️" : "🌙" };
    if (code <= 2) return { kind: "clear", label: "Малооблачно", icon: isDay ? "🌤️" : "🌙" };
    if (code === 3) return { kind: "cloud", label: "Пасмурно", icon: "☁️" };
    if (code === 45 || code === 48) return { kind: "fog", label: "Туман", icon: "🌫️" };
    if (code >= 51 && code <= 57) return { kind: "rain", label: "Морось", icon: "🌦️" };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: "rain", label: "Дождь", icon: "🌧️" };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: "snow", label: "Снег", icon: "🌨️" };
    if (code >= 95) return { kind: "storm", label: "Гроза", icon: "⛈️" };
    return { kind: "cloud", label: "Облачно", icon: "☁️" };
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch {
      return null;
    }
  }

  function writeCache(value) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    } catch {
      // Без кеша просто чаще ходим в сеть
    }
  }

  function locate() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error("Браузер не умеет определять местоположение"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          const round = (n) => Math.round(n * 100) / 100;
          resolve({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) });
        },
        function (err) {
          const msg = err.code === 1 ? "Доступ к местоположению запрещён в браузере" : "Не удалось определить место, попробуй ещё раз";
          reject(new Error(msg));
        },
        { timeout: 15000, maximumAge: 60 * 60 * 1000 }
      );
    });
  }

  function fetchRaw(loc) {
    const params = new URLSearchParams({
      latitude: loc.lat,
      longitude: loc.lon,
      current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
      hourly: "precipitation_probability,precipitation,weather_code,apparent_temperature",
      forecast_hours: "12",
      timezone: "auto",
      wind_speed_unit: "ms",
    });
    return fetch(API + "?" + params).then(function (res) {
      if (!res.ok) throw new Error("Сервис погоды недоступен");
      return res.json();
    });
  }

  // Ближайший час без осадков, если сейчас льёт или метёт
  function dryWindow(hourly) {
    if (!hourly || !hourly.time) return null;
    const now = Date.now();
    for (let i = 0; i < hourly.time.length; i++) {
      const t = new Date(hourly.time[i]).getTime();
      if (t < now - 30 * 60 * 1000) continue;
      const kind = describe(hourly.weather_code[i], true).kind;
      const wet = kind === "rain" || kind === "snow" || kind === "storm";
      if (!wet && (hourly.precipitation_probability[i] || 0) < 35 && (hourly.precipitation[i] || 0) < 0.2) {
        return { hour: new Date(t).getHours(), index: i };
      }
    }
    return false;
  }

  function advise(w) {
    const tips = [];
    const wet = w.kind === "rain" || w.kind === "snow" || w.kind === "storm";
    if (w.kind === "storm") tips.push("Гроза — лучше переждать. Многие собаки боятся грома: держи поводок крепче.");
    if (wet && w.kind !== "storm") {
      if (w.window && w.window.index > 0) tips.push("Окно без осадков — около " + w.window.hour + ":00.");
      else if (w.window === false) tips.push("Без просвета ближайшие 12 часов — полотенце у двери пригодится.");
    }
    if (w.feels >= 30) tips.push("Жара: гуляй рано утром или после заката. Асфальт обжигает лапы — проверь ладонью: если не выдержать 7 секунд, слишком горячо.");
    else if (w.feels >= 25) tips.push("Тепло: возьми воду и выбирай тень.");
    else if (w.feels <= -20) tips.push("Сильный мороз: 10–15 минут. Мелким и короткошёрстным — комбинезон и ботинки.");
    else if (w.feels <= -10) tips.push("Мороз: сократи прогулку и следи, не поджимает ли лапы.");
    if (w.temp <= 1 && (w.kind === "snow" || w.temp <= -3)) tips.push("На дорогах реагенты — после прогулки помой лапы тёплой водой.");
    if (w.wind >= 12) tips.push("Сильный ветер — держись подальше от деревьев и рекламных щитов.");
    if (!tips.length) tips.push(w.feels >= 10 && w.feels < 25 && !wet ? "Отличная погода для долгой прогулки 👌" : "Нормальная погода для прогулки.");
    return tips.slice(0, 2);
  }

  function summarize(raw) {
    const c = raw.current;
    const d = describe(c.weather_code, c.is_day === 1);
    const w = {
      temp: Math.round(c.temperature_2m),
      feels: Math.round(c.apparent_temperature),
      wind: Math.round(c.wind_speed_10m),
      isDay: c.is_day === 1,
      code: c.weather_code,
      kind: d.kind,
      label: d.label,
      icon: d.icon,
    };
    w.window = w.kind === "rain" || w.kind === "snow" || w.kind === "storm" ? dryWindow(raw.hourly) : null;
    w.tips = advise(w);
    return w;
  }

  let pending = null;

  // Погода для сохранённой точки: из кеша, если свежая, иначе из сети
  function get(loc) {
    if (!loc) return Promise.resolve(null);
    const cached = readCache();
    if (cached && cached.lat === loc.lat && cached.lon === loc.lon && Date.now() - cached.at < TTL) {
      return Promise.resolve(summarize(cached.raw));
    }
    if (pending) return pending;
    pending = fetchRaw(loc)
      .then(function (raw) {
        writeCache({ at: Date.now(), lat: loc.lat, lon: loc.lon, raw: raw });
        return summarize(raw);
      })
      .catch(function () {
        // Офлайн: покажем последнюю известную погоду, если она не старше 3 часов
        if (cached && Date.now() - cached.at < 3 * 60 * 60 * 1000) return Object.assign(summarize(cached.raw), { stale: true });
        return null;
      })
      .finally(function () {
        pending = null;
      });
    return pending;
  }

  PD.weather = { locate, get, describe };
})(window.PD);
