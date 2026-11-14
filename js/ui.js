// Общие элементы интерфейса: тосты, модальные формы, подтверждения, достижения, уведомления.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;

  // ---------- Тосты ----------
  function toast(message, opts) {
    opts = opts || {};
    const box = U.$("#toasts");
    const node = el("div", { class: "toast" + (opts.kind ? " toast-" + opts.kind : ""), role: "status" });
    if (opts.icon) node.append(el("span", { class: "toast-icon", text: opts.icon }));
    node.append(el("span", { class: "toast-text", text: message }));
    let timer;
    const close = function () {
      clearTimeout(timer);
      node.classList.add("is-leaving");
      setTimeout(() => node.remove(), 200);
    };
    if (opts.action) {
      node.append(
        el("button", {
          class: "toast-action",
          type: "button",
          text: opts.action.label,
          onclick: function () {
            opts.action.onClick();
            close();
          },
        })
      );
    }
    box.append(node);
    timer = setTimeout(close, opts.timeout || (opts.action ? 6000 : 3000));
    return close;
  }

  // Удаление с возможностью вернуть
  function removeWithUndo(collection, id, message) {
    const removed = S.removeItem(collection, id);
    if (!removed) return;
    PD.sound("delete");
    toast(message || "Запись удалена", {
      icon: "🗑️",
      action: {
        label: "Вернуть",
        onClick: function () {
          S.restoreItem(collection, removed);
        },
      },
    });
  }

  // ---------- Модальное окно с формой ----------
  const modal = U.$("#modal");
  const modalForm = U.$("#modal-form");
  let modalState = null;

  function showModal() {
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function closeModal() {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  modal.addEventListener("close", function () {
    if (modalState && modalState.resolve) modalState.resolve(false);
    modalState = null;
    modalForm.innerHTML = "";
  });

  // Клик по подложке закрывает окно
  modal.addEventListener("click", function (event) {
    if (event.target === modal) closeModal();
  });

  function renderField(field) {
    const id = "f-" + field.name;
    const wrap = el("div", { class: "field" + (field.wide ? " field-wide" : "") });
    const label = el("label", { for: id, class: "field-label", text: field.label + (field.required ? " *" : "") });
    let input;

    if (field.type === "select") {
      input = el("select", { id: id, name: field.name });
      field.options.forEach(function (opt) {
        input.append(el("option", { value: opt.value, text: opt.label, selected: String(opt.value) === String(field.value) }));
      });
    } else if (field.type === "textarea") {
      input = el("textarea", { id: id, name: field.name, rows: 3, maxlength: field.maxlength || 500, placeholder: field.placeholder || "" });
      input.value = field.value || "";
    } else if (field.type === "choice") {
      // Сетка кнопок-радио (вид питомца, цвет, категория)
      input = el("div", { class: "choice-grid" + (field.compact ? " is-compact" : ""), role: "radiogroup", id: id });
      field.options.forEach(function (opt, i) {
        const optId = id + "-" + i;
        const radio = el("input", {
          type: "radio",
          id: optId,
          name: field.name,
          value: opt.value,
          checked: String(opt.value) === String(field.value) || (field.value === undefined && i === 0),
          class: "visually-hidden",
        });
        const tile = el("label", { for: optId, class: "choice", title: opt.label });
        if (opt.render) tile.append(opt.render());
        else if (opt.icon) tile.append(el("span", { class: "choice-icon", text: opt.icon }));
        if (!field.hideLabels) tile.append(el("span", { class: "choice-label", text: opt.label }));
        input.append(radio, tile);
      });
      wrap.append(el("div", { class: "field-label", text: field.label }), input);
      if (field.hint) wrap.append(el("p", { class: "field-hint", text: field.hint }));
      return wrap;
    } else {
      // Числа вводим в текстовое поле: так везде работает и «5,2», и «5.2»
      const isNumber = field.type === "number";
      input = el("input", {
        id: id,
        name: field.name,
        type: isNumber ? "text" : field.type || "text",
        pattern: isNumber ? "[0-9]*[.,]?[0-9]*" : null,
        placeholder: field.placeholder || "",
        maxlength: field.maxlength,
        min: field.min,
        max: field.max,
        step: field.step,
        inputmode: field.inputmode,
        autocomplete: "off",
      });
      if (field.value !== undefined && field.value !== null) input.value = field.value;
    }
    if (field.required) input.required = true;
    wrap.append(label, input);
    if (field.hint) wrap.append(el("p", { class: "field-hint", text: field.hint }));
    return wrap;
  }

  function readForm(form, fields) {
    const data = new FormData(form);
    const values = {};
    fields.forEach(function (f) {
      let v = data.get(f.name);
      if (typeof v === "string") v = v.trim();
      if (f.type === "number") v = v === "" || v === null ? null : Number(String(v).replace(",", "."));
      values[f.name] = v === null ? "" : v;
    });
    return values;
  }

  // Строим форму внутри произвольного контейнера (модалка или онбординг)
  function buildForm(form, opts) {
    form.innerHTML = "";
    const errorBox = el("p", { class: "form-error", role: "alert", hidden: true });
    const grid = el("div", { class: "form-grid" }, opts.fields.map(renderField));
    if (opts.prepend) form.append(opts.prepend);
    form.append(grid, errorBox);

    const buttons = el("div", { class: "modal-actions" });
    if (opts.onDelete) {
      buttons.append(
        el("button", {
          type: "button",
          class: "btn btn-danger btn-small",
          text: "Удалить",
          onclick: function () {
            opts.onDelete();
            if (opts.inModal) closeModal();
          },
        })
      );
    }
    buttons.append(el("span", { class: "spacer" }));
    if (opts.inModal) {
      buttons.append(el("button", { type: "button", class: "btn btn-ghost", text: "Отмена", onclick: closeModal }));
    }
    buttons.append(el("button", { type: "submit", class: "btn", value: "ok", text: opts.submitLabel || "Сохранить" }));
    form.append(buttons);

    if (opts.onInput) {
      form.addEventListener("input", function () {
        opts.onInput(readForm(form, opts.fields));
      });
      form.addEventListener("change", function () {
        opts.onInput(readForm(form, opts.fields));
      });
    }

    form.onsubmit = function (event) {
      event.preventDefault();
      const values = readForm(form, opts.fields);
      const missing = opts.fields.find((f) => f.required && (values[f.name] === "" || values[f.name] === null));
      let error = missing ? "Заполни поле «" + missing.label + "»" : null;
      if (!error && opts.validate) error = opts.validate(values);
      if (error) {
        errorBox.textContent = error;
        errorBox.hidden = false;
        PD.sound("error");
        return;
      }
      opts.onSubmit(values);
      PD.sound("save");
      if (opts.inModal) closeModal();
    };
    return form;
  }

  function openForm(opts) {
    const head = el(
      "div",
      { class: "modal-head" },
      el("h2", { class: "modal-title", text: opts.title }),
      el("button", { type: "button", class: "icon-btn", "aria-label": "Закрыть", text: "✕", onclick: closeModal })
    );
    buildForm(modalForm, Object.assign({}, opts, { inModal: true, prepend: head }));
    modalState = {};
    showModal();
    const first = modalForm.querySelector("input:not([type=radio]):not([type=hidden]), textarea, select");
    if (first && !opts.noAutofocus) setTimeout(() => first.focus(), 30);
  }

  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      modalForm.innerHTML = "";
      modalForm.onsubmit = null;
      modalForm.append(
        el("h2", { class: "modal-title", text: opts.title || "Точно?" }),
        el("p", { class: "confirm-text", text: message }),
        el(
          "div",
          { class: "modal-actions" },
          el("span", { class: "spacer" }),
          el("button", { type: "button", class: "btn btn-ghost", text: "Отмена", onclick: closeModal }),
          el("button", {
            type: "button",
            class: "btn" + (opts.danger ? " btn-danger" : ""),
            text: opts.okLabel || "Да",
            onclick: function () {
              modalState.resolve = null;
              closeModal();
              resolve(true);
            },
          })
        )
      );
      modalState = { resolve: resolve };
      showModal();
    });
  }

  // ---------- Аватарки ----------
  function avatar(pet, cls) {
    const canvas = el("canvas", { class: "avatar " + (cls || ""), "aria-hidden": "true" });
    PD.sprites.drawAvatar(canvas, pet.species, pet.color);
    return canvas;
  }

  function emptyState(icon, text) {
    return el("div", { class: "empty" }, el("div", { class: "empty-icon", text: icon }), el("p", { text: text }));
  }

  // ---------- Достижения ----------
  function entriesAll() {
    return S.state.entries;
  }

  const ACHIEVEMENTS = [
    { id: "first_entry", icon: "✏️", title: "Первая запись", desc: "Сделать первую запись в дневнике", test: () => entriesAll().length >= 1 },
    { id: "entries_50", icon: "📜", title: "Летописец", desc: "50 записей в дневнике", test: () => entriesAll().length >= 50 },
    { id: "entries_300", icon: "📚", title: "Хранитель истории", desc: "300 записей в дневнике", test: () => entriesAll().length >= 300 },
    { id: "streak_3", icon: "🔥", title: "Разогрев", desc: "Вести дневник 3 дня подряд", test: () => maxStreak() >= 3 },
    { id: "streak_7", icon: "🗓️", title: "Неделя заботы", desc: "7 дней подряд", test: () => maxStreak() >= 7 },
    { id: "streak_30", icon: "👑", title: "Месяц без пропусков", desc: "30 дней подряд", test: () => maxStreak() >= 30 },
    { id: "all_actions", icon: "🐾", title: "Мастер на все лапы", desc: "Использовать каждое быстрое действие", test: () => S.ACTIONS.every((a) => entriesAll().some((e) => e.type === a.type)) },
    { id: "pokes_10", icon: "💕", title: "Ласковые руки", desc: "Погладить питомца 10 раз", test: () => S.state.counters.pokes >= 10 },
    { id: "pokes_100", icon: "🫶", title: "Лучший друг", desc: "Погладить питомца 100 раз", test: () => S.state.counters.pokes >= 100 },
    { id: "happy", icon: "😺", title: "Счастливчик", desc: "Довести все шкалы питомца до зелёной зоны", test: () => S.state.pets.some((p) => S.mood(S.computeNeeds(p.id)) === "happy") },
    { id: "health_first", icon: "🩺", title: "Под присмотром", desc: "Добавить запись в медкарту", test: () => S.state.health.length >= 1 },
    { id: "health_plan", icon: "⏰", title: "Всё по графику", desc: "Запланировать следующую прививку или обработку", test: () => S.state.health.some((h) => h.nextDate) },
    { id: "weight_5", icon: "⚖️", title: "На весах", desc: "5 взвешиваний", test: () => S.state.weights.length >= 5 },
    { id: "expense_first", icon: "🧾", title: "Бухгалтер", desc: "Записать первый расход", test: () => S.state.expenses.length >= 1 },
    { id: "two_pets", icon: "🏡", title: "Большая семья", desc: "Завести дневник для двух питомцев", test: () => S.state.pets.length >= 2 },
    { id: "night_owl", icon: "🦉", title: "Ночная смена", desc: "Сделать запись между полуночью и 5 утра", test: () => entriesAll().some((e) => new Date(e.time).getHours() < 5) },
    { id: "backup", icon: "💾", title: "Запасливый", desc: "Скачать резервную копию", test: () => S.state.counters.exports >= 1 },
  ];

  function maxStreak() {
    return S.state.pets.reduce((m, p) => Math.max(m, S.streak(p.id)), 0);
  }

  let onUnlock = null;
  function checkAchievements() {
    const fresh = ACHIEVEMENTS.filter(function (a) {
      let ok = false;
      try {
        ok = a.test();
      } catch {
        ok = false;
      }
      return ok && S.unlockAchievement(a.id);
    });
    if (!fresh.length) return;
    PD.sound("achievement");
    // Несколько сразу (например, после переноса старых данных) — один общий тост вместо лавины
    if (fresh.length > 2) {
      toast("Открыто достижений: " + fresh.length + "! Загляни в «Итоги»", { icon: "🏆", kind: "gold", timeout: 5000 });
    } else {
      fresh.forEach((a) => toast("Достижение: " + a.title, { icon: a.icon, kind: "gold", timeout: 4500 }));
    }
    if (onUnlock) onUnlock(fresh[0]);
  }

  // ---------- Уведомления ----------
  function reminderText(r) {
    if (r.birthday) {
      return r.days === 0 ? "🎂 Сегодня день рождения у " + r.pet.name + "!" : "🎂 День рождения " + r.pet.name + " " + U.relativeDays(U.addDaysISO(r.days));
    }
    const kind = S.healthKind(r.item.kind);
    return kind.icon + " " + r.pet.name + ": " + r.item.title + " — " + U.relativeDays(r.item.nextDate);
  }

  function notifyReminders() {
    const settings = S.state.settings;
    if (!settings.notifications || !("Notification" in window) || Notification.permission !== "granted") return;
    const day = U.today();
    if (settings.lastNotifiedDay === day) return;
    const due = S.reminders().filter((r) => r.days <= 3);
    if (!due.length) return;
    const body = due.slice(0, 4).map(reminderText).join("\n");
    const options = { body: body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "pet-diary-reminders" };
    const show = function () {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => reg.showNotification("Pet Diary", options));
      } else {
        try {
          new Notification("Pet Diary", options);
        } catch {
          // На некоторых мобильных браузерах уведомления работают только через service worker
        }
      }
    };
    show();
    S.updateSettings({ lastNotifiedDay: day });
  }

  PD.ui = {
    toast,
    removeWithUndo,
    openForm,
    buildForm,
    closeModal,
    confirmDialog,
    avatar,
    emptyState,
    ACHIEVEMENTS,
    checkAchievements,
    reminderText,
    notifyReminders,
    set onUnlock(fn) {
      onUnlock = fn;
    },
  };
})(window.PD);
