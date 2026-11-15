// Главный экран: живой питомец, план дня, обязанности, быстрые действия, лента за сегодня, воспоминания и факт дня.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;
  PD.views = PD.views || {};

  let scene = null;
  let awakeUntil = 0;
  let weather = null;
  let weatherAt = 0;
  let persistAsked = false;
  let speechTimer = null;
  let factShift = 0;

  // Какой сон показать: по самому заметному событию дня
  const DREAM_BY_TYPE = { walk: "walk", play: "ball", train: "ball", feed: "food", treat: "food" };

  // Защита от двойного кормления и двойной дозы лекарства: за сколько минут предупреждать
  const REPEAT_GUARD = { feed: 90, med: 180 };

  const MOOD_TEXT = {
    happy: { icon: "😊", text: "Жизнь удалась" },
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

  // ---------- Реплики питомца ----------
  function say(text) {
    const bubble = U.$("#speech");
    if (!text || !bubble) return;
    bubble.textContent = text;
    bubble.hidden = false;
    bubble.classList.remove("is-in");
    void bubble.offsetWidth; // перезапуск анимации
    bubble.classList.add("is-in");
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => (bubble.hidden = true), 3800);
  }

  function react(action) {
    awakeUntil = Date.now() + 10 * 60 * 1000;
    if (scene) scene.react(action.effect);
    say(PD.content.phrase(action.type, S.activePet()));
  }

  function greet() {
    const me = PD.family.current();
    if (me) say(PD.content.phrase("hello", S.activePet(), { name: me.name }));
  }

  // ---------- Действия ----------
  function recentSame(action, extra) {
    const minutes = REPEAT_GUARD[action.type];
    if (!minutes) return null;
    const since = Date.now() - minutes * 60 * 1000;
    return (
      S.entriesSorted().find(function (e) {
        if (e.type !== action.type || e.time < since || e.time > Date.now()) return false;
        return action.type !== "med" || !extra || !extra.medId || e.medId === extra.medId;
      }) || null
    );
  }

  function doAction(action, note, extra) {
    const pet = S.activePet();
    if (!pet) return;
    const previous = recentSame(action, extra);
    if (previous) {
      const who = previous.by && PD.family.member(previous.by) ? " (" + PD.family.label(PD.family.member(previous.by)) + ")" : "";
      const what = action.type === "med" ? "Лекарство уже давали" : "Уже кормили";
      PD.ui
        .confirmDialog(what + " " + U.timeAgo(previous.time) + who + ". Отметить ещё раз?", { title: "Не двойная ли порция?", okLabel: "Да, отметить" })
        .then((ok) => ok && commitAction(action, note, extra));
      return;
    }
    commitAction(action, note, extra);
  }

  function commitAction(action, note, extra) {
    S.addEntry(action.type, note, Date.now(), extra);
    // После первой записи просим браузер не удалять данные при нехватке места
    if (!persistAsked) {
      persistAsked = true;
      S.requestPersistence();
    }
    react(action);
    PD.sound("action");
    PD.ui.toast(action.label + (note ? ": " + note : ""), { icon: action.icon });
  }

  // Быстрое действие по ярлыку с иконки приложения (?do=feed)
  function runShortcut(type) {
    const action = S.ACTIONS.find((a) => a.type === type);
    if (action && S.activePet()) doAction(action);
  }

  function addPhotoNote(file) {
    const input = U.$("#note-input");
    const text = input.value.trim();
    PD.photos
      .save(file)
      .then(function (photoId) {
        commitAction(S.NOTE_ACTION, text, { photoId: photoId });
        input.value = "";
      })
      .catch((err) => PD.ui.toast(err.message || "Не удалось сохранить фото", { icon: "⚠️", kind: "error" }));
  }

  // ---------- Запас корма ----------
  function openStockForm(pet) {
    const s = pet.stock || {};
    const feeds = Number(pet.feedsPerDay) || 2;
    PD.ui.openForm({
      title: "Новый мешок корма",
      fields: [
        { name: "bagKg", label: "Вес мешка, кг", type: "number", required: true, inputmode: "decimal", value: s.bagKg || "", placeholder: "Например, 12" },
        { name: "dailyG", label: "Корма в день, г", type: "number", required: true, inputmode: "numeric", value: s.dailyG || "", placeholder: "Например, " + feeds * 120, hint: "Порция × число кормлений. Обычно написано на упаковке." },
        { name: "openedAt", label: "Открыли", type: "date", required: true, value: U.today(), max: U.today() },
      ],
      validate: function (v) {
        if (!(v.bagKg > 0 && v.bagKg <= 50)) return "Вес мешка — от 0,1 до 50 кг";
        if (!(v.dailyG >= 1 && v.dailyG <= 3000)) return "Суточная норма — от 1 до 3000 г";
        return null;
      },
      onSubmit: function (v) {
        S.savePet({ id: pet.id, stock: { bagKg: v.bagKg, dailyG: v.dailyG, openedAt: v.openedAt } });
        PD.ui.toast("Следим за запасом корма", { icon: "🛍️" });
      },
      onDelete: pet.stock ? () => S.savePet({ id: pet.id, stock: null }) : null,
    });
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

    U.$("#photo-btn").addEventListener("click", () => U.$("#photo-input").click());
    U.$("#photo-input").addEventListener("change", function (event) {
      const file = event.target.files[0];
      if (file) addPhotoNote(file);
      event.target.value = "";
    });

    U.$("#symptom-btn").addEventListener("click", () => PD.views.health.openSymptomForm());

    U.$("#plan-setup").addEventListener("click", function () {
      const pet = S.activePet();
      if (pet) PD.views.settings.openPetForm(pet);
    });

    U.$("#fact-more").addEventListener("click", function () {
      factShift++;
      renderFact(S.activePet());
      PD.sound("tap");
    });

    // Шкалы убывают со временем — обновляем раз в минуту
    setInterval(function () {
      if (PD.app.currentView() === "home") render();
    }, 60 * 1000);
  }

  function isWalker(pet) {
    return pet.species === "dog" || Number(pet.walksPerDay) > 0;
  }

  function dreamFor(pet) {
    const todayStart = U.startOfDay(new Date()).getTime();
    // После визита к врачу или лекарства снится больница
    const today = U.today();
    if (S.forPet(S.state.health, pet.id).some((h) => h.date === today)) return "vet";
    const counts = {};
    S.forPet(S.state.entries, pet.id)
      .filter((e) => e.time >= todayStart - 6 * U.HOUR)
      .forEach(function (e) {
        if (e.type === "med" || e.type === "symptom") counts.vet = (counts.vet || 0) + 1;
        const dream = DREAM_BY_TYPE[e.type];
        if (dream) counts[dream] = (counts[dream] || 0) + 1;
      });
    if (counts.vet) return "vet";
    const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return best || "heart";
  }

  // ---------- Погода ----------
  function refreshWeather() {
    const settings = S.state.settings;
    if (!settings.weather || !settings.weatherLoc || !PD.weather) {
      weather = null;
      weatherAt = 0;
      return;
    }
    if (Date.now() - weatherAt < 10 * 60 * 1000) return;
    weatherAt = Date.now();
    PD.weather.get(settings.weatherLoc).then(function (w) {
      weather = w;
      if (PD.app.currentView() === "home") render();
    });
  }

  function renderWeather(pet) {
    const box = U.$("#weather");
    box.innerHTML = "";
    const on = !!(S.state.settings.weather && weather);
    box.hidden = !on;
    scene.setWeather(on ? weather.kind : null);
    if (!on) return;
    const feels = weather.feels !== weather.temp ? " (ощущается " + signed(weather.feels) + "°)" : "";
    box.append(
      el(
        "div",
        { class: "weather-now" },
        el("span", { class: "weather-icon", text: weather.icon, "aria-hidden": "true" }),
        el("strong", { text: signed(weather.temp) + "°" }),
        el("span", { class: "muted", text: weather.label + feels + (weather.wind >= 8 ? " · ветер " + weather.wind + " м/с" : "") }),
        weather.stale ? el("span", { class: "muted small", text: "· нет сети, данные старые" }) : null
      )
    );
    if (isWalker(pet)) {
      box.append(el("ul", { class: "weather-tips" }, weather.tips.map((t) => el("li", { text: t }))));
    }
  }

  function signed(n) {
    return n > 0 ? "+" + n : String(n);
  }

  // ---------- План дня ----------
  function planRow(icon, title, sub, pipsEl, tail, done) {
    return el(
      "div",
      { class: "plan-row" + (done ? " is-done" : "") },
      el("span", { class: "plan-icon", text: icon, "aria-hidden": "true" }),
      el("div", { class: "plan-body" }, el("div", { class: "plan-head" }, el("strong", { text: title }), el("span", { class: "muted small", text: sub })), pipsEl),
      tail
    );
  }

  function renderPlan(pet) {
    const box = U.$("#plan");
    box.innerHTML = "";
    const plan = S.dayPlan(pet.id);
    const stock = S.foodStock(pet);
    U.$("#plan-setup").textContent = plan.some((p) => !p.medId) ? "Изменить" : "Настроить";
    if (!plan.some((p) => !p.medId)) {
      box.append(
        el("p", { class: "muted small plan-empty", text: "Укажи в карточке питомца, сколько раз в день его кормить" + (isWalker(pet) ? " и выгуливать" : "") + " — здесь появится план, а шкалы подстроятся под ваш режим." })
      );
    }
    plan.forEach(function (p) {
      const complete = p.done >= p.target;
      const pips = el("div", { class: "plan-pips", "aria-hidden": "true" });
      for (let i = 0; i < Math.max(p.target, p.done); i++) pips.append(el("i", { class: i < p.done ? (i < p.target ? "on" : "extra") : "" }));
      const action = S.ACTIONS.find((a) => a.type === p.type);
      const extra = p.medId ? { medId: p.medId } : null;
      const sub = [p.sub, p.last ? U.timeAgo(p.last) : "ещё не было"].filter(Boolean).join(" · ");
      const tail = complete
        ? el("span", { class: "plan-check", text: "✓", "aria-label": "Выполнено" })
        : el("button", { type: "button", class: "btn btn-small", text: "＋", "aria-label": "Отметить: " + p.label, onclick: () => doAction(action, p.note || "", extra) });
      box.append(planRow(p.icon, p.label + " " + p.done + "/" + p.target, sub, pips, tail, complete));
    });

    // Запас корма
    if (stock) {
      const track = el("div", { class: "stock-track" + (stock.daysLeft <= 5 ? " is-low" : "") }, el("div", { class: "stock-fill", style: "width:" + Math.round(stock.share * 100) + "%" }));
      const title = stock.daysLeft > 0 ? "Корм: ещё ~" + stock.daysLeft + " " + U.plural(stock.daysLeft, "день", "дня", "дней") : "Корм закончился";
      box.append(
        planRow("🛍️", title, stock.daysLeft > 0 ? "до " + U.formatDate(stock.endDate) : "пора купить", track, el("button", { type: "button", class: "btn btn-small btn-ghost", text: "Новый мешок", onclick: () => openStockForm(pet) }), false)
      );
    } else if (Number(pet.feedsPerDay) > 0) {
      box.append(el("button", { type: "button", class: "link-btn plan-stock-link", text: "🛍️ Следить, когда закончится корм", onclick: () => openStockForm(pet) }));
    }
  }

  function renderReminders() {
    const box = U.$("#reminders");
    box.innerHTML = "";
    const pet = S.activePet();
    S.symptomAlerts(pet.id).forEach(function (a) {
      box.append(
        el(
          "a",
          { class: "reminder is-overdue", href: "#health" },
          el("span", { text: "⚠️ " + a.symptom.label + ": " + a.count + " " + U.plural(a.count, "раз", "раза", "раз") + " за сутки. Стоит позвонить ветеринару — отчёт для врача во вкладке «Здоровье»." })
        )
      );
    });
    if (S.backupDue() && !PD.family.isKidMode()) {
      box.append(
        el(
          "div",
          { class: "reminder is-backup" },
          el("span", { text: "💾 Данные живут только в этом браузере. Сделай резервную копию — потеря телефона не должна стереть историю питомца." }),
          el(
            "div",
            { class: "reminder-actions" },
            el("button", { type: "button", class: "btn btn-small", text: "Скачать копию", onclick: () => PD.views.settings.exportBackup() }),
            el("button", { type: "button", class: "btn btn-small btn-ghost", text: "Позже", onclick: () => S.updateSettings({ backupSnoozeUntil: Date.now() + 7 * U.DAY }) })
          )
        )
      );
    }
    const list = S.reminders(pet.id).filter((r) => r.days <= 7);
    list.slice(0, 3).forEach(function (r) {
      const overdue = r.days < 0;
      const node = el(
        "a",
        { class: "reminder" + (overdue ? " is-overdue" : "") + (r.birthday ? " is-birthday" : "") + (r.stock ? " is-stock" : ""), href: r.item ? "#health" : "#home" },
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

  // ---------- Воспоминания: «Год назад в этот день» ----------
  function memoriesFrom(pet, date) {
    const key = U.toISODate(date);
    return S.forPet(S.state.entries, pet.id).filter((e) => U.toISODate(e.time) === key && (e.photoId || (e.note && e.note.length > 3)));
  }

  function renderMemories(pet) {
    const card = U.$("#memories-card");
    const box = U.$("#memories");
    box.innerHTML = "";
    const now = new Date();
    const options = [
      { title: "Год назад в этот день", date: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) },
      { title: "Месяц назад", date: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()), photosOnly: true },
    ];
    let found = null;
    for (const opt of options) {
      const items = memoriesFrom(pet, opt.date).filter((e) => !opt.photosOnly || e.photoId);
      if (items.length) {
        found = { title: opt.title, date: opt.date, items: items };
        break;
      }
    }
    card.hidden = !found;
    if (!found) return;
    U.$("#memories-title").textContent = "📸 " + found.title;
    const photos = found.items.filter((e) => e.photoId).slice(0, 4);
    if (photos.length) box.append(el("div", { class: "memory-photos" }, photos.map((e) => PD.photos.thumb(e.photoId, "memory-photo"))));
    found.items
      .filter((e) => e.note)
      .slice(0, 3)
      .forEach((e) => box.append(el("p", { class: "memory-note" }, el("span", { class: "muted small", text: U.formatDate(e.time, true) + " · " }), document.createTextNode(e.note))));
  }

  function renderFact(pet) {
    U.$("#fact-text").textContent = PD.content.fact(pet.species, factShift);
  }

  function render() {
    const pet = S.activePet();
    if (!pet) return;
    scene.setPet(pet);

    const needs = S.computeNeeds(pet.id);
    const sleeping = isSleeping(needs);
    const mood = S.mood(needs);
    scene.setMood(mood, sleeping);
    scene.setDream(sleeping ? dreamFor(pet) : null);
    refreshWeather();

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
    renderPlan(pet);
    renderWeather(pet);
    PD.family.renderHome(pet);
    renderNeeds(needs);
    renderToday();
    renderMemories(pet);
    renderFact(pet);
  }

  function celebrate() {
    if (scene) scene.react("star");
  }

  PD.views.home = { init, render, celebrate, react, greet, say, runShortcut, doAction };
})(window.PD);
