// Общие помощники: даты, склонения, DOM, форматирование.
window.PD = window.PD || {};

(function (PD) {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Склонение: 1 год, 2 года, 5 лет
  function plural(number, one, few, many) {
    const n = Math.abs(number);
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  // 'YYYY-MM-DD' в локальном времени (без сдвига часового пояса)
  function toISODate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function parseISODate(value) {
    if (!value) return null;
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function today() {
    return toISODate(new Date());
  }

  // Значение для <input type="datetime-local">
  function toLocalInput(timestamp) {
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, "0");
    return toISODate(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Разница в календарных днях: b - a
  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(value, withYear) {
    const d = typeof value === "string" ? parseISODate(value) : new Date(value);
    const opts = { day: "numeric", month: "long" };
    if (withYear || d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("ru-RU", opts);
  }

  function formatDayTitle(timestamp) {
    const diff = daysBetween(timestamp, new Date());
    if (diff === 0) return "Сегодня";
    if (diff === 1) return "Вчера";
    const d = new Date(timestamp);
    const weekday = d.toLocaleDateString("ru-RU", { weekday: "long" });
    return formatDate(timestamp) + ", " + weekday;
  }

  // «5 минут назад», «3 часа назад», «вчера»
  function timeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) return "только что";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return minutes + " " + plural(minutes, "минуту", "минуты", "минут") + " назад";
    const hours = Math.floor(diff / HOUR);
    if (hours < 24) return hours + " " + plural(hours, "час", "часа", "часов") + " назад";
    const days = daysBetween(timestamp, new Date());
    if (days === 1) return "вчера";
    return days + " " + plural(days, "день", "дня", "дней") + " назад";
  }

  // «через 3 дня», «завтра», «просрочено на 2 дня»
  function relativeDays(isoDate) {
    const diff = daysBetween(new Date(), parseISODate(isoDate));
    if (diff === 0) return "сегодня";
    if (diff === 1) return "завтра";
    if (diff === -1) return "вчера";
    if (diff > 0) return "через " + diff + " " + plural(diff, "день", "дня", "дней");
    const n = -diff;
    return "просрочено на " + n + " " + plural(n, "день", "дня", "дней");
  }

  // Возраст по дате рождения: «2 года 3 месяца», «5 месяцев» или «меньше месяца»
  function formatAge(birthDate) {
    if (!birthDate) return null;
    const birth = parseISODate(birthDate);
    const now = new Date();
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months -= 1;
    if (months < 0) return null;
    if (months === 0) return "меньше месяца";
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts = [];
    if (years > 0) parts.push(years + " " + plural(years, "год", "года", "лет"));
    if (rest > 0) parts.push(rest + " " + plural(rest, "месяц", "месяца", "месяцев"));
    return parts.join(" ");
  }

  // Дней до ближайшего дня рождения (0 — сегодня)
  function daysToBirthday(birthDate) {
    if (!birthDate) return null;
    const birth = parseISODate(birthDate);
    const now = startOfDay(new Date());
    let next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
    if (next < now) next = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
    return daysBetween(now, next);
  }

  function formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: currency || "RUB",
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      }).format(amount);
    } catch {
      return amount.toLocaleString("ru-RU") + " " + (currency || "₽");
    }
  }

  function addMonths(isoDate, months) {
    const d = parseISODate(isoDate);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return toISODate(d);
  }

  // Дата через N дней от сегодня в формате 'YYYY-MM-DD'
  function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  // Маленький помощник для создания элементов:
  // el("button", { class: "x", onclick: fn }, "Текст", childNode)
  function el(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else if (key === "dataset") Object.assign(node.dataset, value);
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
        else if (value === true) node.setAttribute(key, "");
        else node.setAttribute(key, value);
      });
    }
    for (let i = 2; i < arguments.length; i++) {
      const child = arguments[i];
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) child.forEach((c) => c && node.append(c));
      else node.append(child);
    }
    return node;
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  PD.utils = {
    DAY,
    HOUR,
    uid,
    plural,
    toISODate,
    parseISODate,
    today,
    toLocalInput,
    startOfDay,
    daysBetween,
    formatTime,
    formatDate,
    formatDayTitle,
    timeAgo,
    relativeDays,
    formatAge,
    daysToBirthday,
    formatMoney,
    addMonths,
    addDaysISO,
    el,
    $,
    $$,
    clamp,
    download,
  };
})(window.PD);
