// Главный экран: живой питомец, шкалы потребностей, быстрые действия и лента за сегодня.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;
  PD.views = PD.views || {};

  let scene = null;
  let awakeUntil = 0;

  const MOOD_TEXT = {
    happy: { icon: "😊", text: "Доволен жизнью" },
    neutral: { icon: "🙂", text: "Всё в порядке" },
    sad: { icon: "🥺", text: "Скучает по заботе" },
    sleep: { icon: "💤", text: "Сладко спит" },
  };

  const NEED_HINTS = {
    food: "Пора покормить",
    fun: "Хочет поиграть",
    energy: "Пора отдохнуть",
    clean: "Пора почистить",
  };

  function isSleeping(needs) {
    if (Date.now() < awakeUntil) return false;
    const h = new Date().getHours();
    const energy = needs.find((n) => n.id === "energy");
    const lastEntry = S.entriesSorted()[0];
    const quiet = !lastEntry || Date.now() - lastEntry.time > 15 * 60 * 1000;
    return quiet && (h >= 23 || h < 6 || (energy && energy.last && energy.value < 0.05));
  }

  function doAction(action, note) {
    const pet = S.activePet();
    if (!pet) return;
    S.addEntry(action.type, note);
    awakeUntil = Date.now() + 10 * 60 * 1000;
    if (scene) scene.react(action.effect);
    PD.sound("action");
    PD.ui.toast(action.label + (note ? ": " + note : ""), { icon: action.icon });
  }

  function init() {
    scene = new PD.sprites.PetScene(U.$("#scene"));

    U.$("#scene").addEventListener("click", function (event) {
      if (!scene.hitTest(event.clientX, event.clientY)) return;
      awakeUntil = Date.now() + 5 * 60 * 1000;
      scene.poke();
      PD.sound("pet");
      S.bump("pokes");
      PD.ui.checkAchievements();
      render();
    });

    const actions = U.$("#actions");
    S.ACTIONS.forEach(function (action) {
      actions.append(
        el(
          "button",
          { type: "button", class: "action-btn", "data-type": action.type, onclick: () => doAction(action) },
          el("span", { class: "action-icon", text: action.icon }),
          el("span", { class: "action-label", text: action.label })
        )
      );
    });

    U.$("#note-form").addEventListener("submit", function (event) {
      event.preventDefault();
      const input = U.$("#note-input");
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      doAction(S.NOTE_ACTION, text);
      input.value = "";
    });

    // Шкалы убывают со временем — обновляем раз в минуту
    setInterval(function () {
      if (PD.app.currentView() === "home") render();
    }, 60 * 1000);
  }

  function renderReminders() {
    const box = U.$("#reminders");
    box.innerHTML = "";
    const pet = S.activePet();
    const list = S.reminders(pet.id).filter((r) => r.days <= 7);
    list.slice(0, 3).forEach(function (r) {
      const overdue = r.days < 0;
      const node = el(
        "a",
        { class: "reminder" + (overdue ? " is-overdue" : "") + (r.birthday ? " is-birthday" : ""), href: r.birthday ? "#home" : "#health" },
        el("span", { text: PD.ui.reminderText(r) })
      );
      box.append(node);
    });
  }

  function renderNeeds(needs) {
    const box = U.$("#needs");
    box.innerHTML = "";
    needs.forEach(function (need) {
      const segments = Math.round(need.value * 10);
      const level = need.value > 0.6 ? "good" : need.value > 0.3 ? "mid" : "low";
      const bar = el("div", { class: "bar bar-" + level, role: "meter", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(need.value * 100), "aria-label": need.label });
      for (let i = 0; i < 10; i++) bar.append(el("i", { class: i < segments ? "on" : "" }));
      box.append(
        el(
          "div",
          { class: "need" },
          el("div", { class: "need-head" }, el("span", { text: need.icon + " " + need.label }), el("span", { class: "muted small", text: need.last ? U.timeAgo(need.last) : "ещё не было" })),
          bar
        )
      );
    });
  }

  function renderToday() {
    const list = U.$("#today-list");
    list.innerHTML = "";
    const todayStart = U.startOfDay(new Date()).getTime();
    const items = S.entriesSorted().filter((e) => e.time >= todayStart);
    if (!items.length) {
      list.append(el("li", { class: "empty-inline muted", text: "Сегодня ещё ничего не отмечено. Нажми кнопку выше!" }));
      return;
    }
    items.slice(0, 8).forEach((entry) => list.append(PD.views.entryItem(entry)));
    if (items.length > 8) list.append(el("li", { class: "muted small more-line" }, el("a", { href: "#journal", text: "и ещё " + (items.length - 8) + "…" })));
  }

  function render() {
    const pet = S.activePet();
    if (!pet) return;
    scene.setPet(pet);

    const needs = S.computeNeeds(pet.id);
    const sleeping = isSleeping(needs);
    const mood = S.mood(needs);
    scene.setMood(mood, sleeping);

    U.$("#pet-name").textContent = pet.name;
    const meta = [S.SPECIES.find((s) => s.id === pet.species).label];
    if (pet.breed) meta.push(pet.breed);
    const age = U.formatAge(pet.birthDate);
    if (age) meta.push(age);
    const streak = S.streak(pet.id);
    if (streak > 1) meta.push("🔥 " + streak + " " + U.plural(streak, "день", "дня", "дней") + " подряд");
    U.$("#pet-meta").textContent = meta.join(" · ");

    const m = MOOD_TEXT[sleeping ? "sleep" : mood];
    const lowest = needs.slice().sort((a, b) => a.value - b.value)[0];
    const moodBox = U.$("#mood");
    moodBox.innerHTML = "";
    moodBox.append(el("span", { class: "mood-icon", text: m.icon }), el("span", { class: "mood-text", text: m.text }));
    const fresh = needs.every((n) => n.last === null);
    if (fresh) moodBox.append(el("span", { class: "mood-hint", text: "Отметь первую заботу 👇" }));
    else if (!sleeping && lowest && lowest.value < 0.3) moodBox.append(el("span", { class: "mood-hint", text: NEED_HINTS[lowest.id] }));

    renderReminders();
    renderNeeds(needs);
    renderToday();
  }

  function celebrate() {
    if (scene) scene.react("star");
  }

  PD.views.home = { init, render, celebrate };
})(window.PD);
