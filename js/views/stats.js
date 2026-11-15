// Итоги: цифры, активность за неделю, календарь заботы и достижения.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;
  PD.views = PD.views || {};

  const WEEKS = 15;

  function bestStreak(entries) {
    const days = Array.from(new Set(entries.map((e) => U.toISODate(e.time)))).sort();
    let best = 0;
    let run = 0;
    let prev = null;
    days.forEach(function (d) {
      const date = U.parseISODate(d);
      run = prev && U.daysBetween(prev, date) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = date;
    });
    return best;
  }

  function tile(icon, value, label) {
    return el("div", { class: "tile" }, el("span", { class: "tile-icon", text: icon }), el("span", { class: "tile-value", text: value }), el("span", { class: "tile-label", text: label }));
  }

  function renderTiles(pet, entries) {
    const box = U.$("#stats-tiles");
    box.innerHTML = "";
    const since = entries.length ? Math.min.apply(null, entries.map((e) => e.time)) : pet.createdAt;
    const days = U.daysBetween(since || Date.now(), new Date()) + 1;
    const weekAgo = Date.now() - 7 * U.DAY;
    box.append(
      tile("📝", entries.length, U.plural(entries.length, "запись", "записи", "записей")),
      tile("🔥", S.streak(pet.id), "дней подряд"),
      tile("🏅", bestStreak(entries), "рекорд серии"),
      tile("📅", entries.filter((e) => e.time >= weekAgo).length, "за неделю"),
      tile("🗓️", days, U.plural(days, "день", "дня", "дней") + " с дневником"),
      tile("💕", S.state.counters.pokes || 0, "раз погладили")
    );
  }

  function renderWeek(entries) {
    const box = U.$("#stats-week");
    box.innerHTML = "";
    const items = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = U.toISODate(d);
      items.push({
        label: d.toLocaleDateString("ru-RU", { weekday: "short" }),
        value: entries.filter((e) => U.toISODate(e.time) === key).length,
        highlight: i === 0,
      });
    }
    box.append(PD.charts.barChart(items, { title: "Записей по дням" }));
  }

  function renderHeatmap(entries) {
    const box = U.$("#stats-heatmap");
    box.innerHTML = "";
    const counts = {};
    entries.forEach(function (e) {
      const k = U.toISODate(e.time);
      counts[k] = (counts[k] || 0) + 1;
    });
    // Начинаем с понедельника WEEKS недель назад
    const start = U.startOfDay(new Date());
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow - (WEEKS - 1) * 7);
    const todayKey = U.today();
    for (let w = 0; w < WEEKS; w++) {
      const col = el("div", { class: "heat-col" });
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        const key = U.toISODate(date);
        const n = counts[key] || 0;
        const level = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
        const future = key > todayKey;
        col.append(
          el("i", {
            class: "heat l" + level + (future ? " is-future" : "") + (key === todayKey ? " is-today" : ""),
            title: future ? "" : U.formatDate(key) + ": " + n + " " + U.plural(n, "запись", "записи", "записей"),
          })
        );
      }
      box.append(col);
    }
  }

  function renderTypes(entries) {
    const box = U.$("#stats-types");
    box.innerHTML = "";
    const monthAgo = Date.now() - 30 * U.DAY;
    const recent = entries.filter((e) => e.time >= monthAgo);
    if (!recent.length) {
      box.append(el("p", { class: "muted small", text: "За последние 30 дней записей нет." }));
      return;
    }
    const counts = {};
    recent.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
    const max = Math.max.apply(null, Object.values(counts));
    Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .forEach(function (type) {
        const info = S.actionInfo(type);
        box.append(
          el(
            "div",
            { class: "cat-bar" },
            el("div", { class: "cat-bar-head" }, el("span", { text: info.icon + " " + info.label }), el("span", { text: counts[type] + " за 30 дней" })),
            el("div", { class: "cat-bar-track" }, el("div", { class: "cat-bar-fill", style: "width:" + (counts[type] / max) * 100 + "%" }))
          )
        );
      });
  }

  function renderAchievements() {
    const box = U.$("#achievements");
    box.innerHTML = "";
    const unlocked = S.state.achievements;
    const total = PD.ui.ACHIEVEMENTS.length;
    const got = PD.ui.ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
    U.$("#ach-count").textContent = got + " / " + total;
    PD.ui.ACHIEVEMENTS.forEach(function (a) {
      const open = !!unlocked[a.id];
      box.append(
        el(
          "div",
          { class: "badge-card" + (open ? " is-open" : ""), title: open ? "Получено " + U.formatDate(unlocked[a.id]) : "Ещё не получено" },
          el("span", { class: "badge-icon", text: open ? a.icon : "🔒" }),
          el("strong", { class: "badge-title", text: a.title }),
          el("span", { class: "badge-desc", text: a.desc })
        )
      );
    });
  }

  function render() {
    const pet = S.activePet();
    if (!pet) return;
    const entries = S.forPet(S.state.entries, pet.id);
    renderTiles(pet, entries);
    renderWeek(entries);
    renderHeatmap(entries);
    renderTypes(entries);
    renderAchievements();
  }

  function init() {
    U.$("#report-btn").addEventListener("click", () => PD.report.open());
  }

  PD.views.stats = { init, render };
})(window.PD);
