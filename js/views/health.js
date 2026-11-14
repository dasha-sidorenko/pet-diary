// Здоровье: прививки, обработки, визиты к врачу с напоминаниями, а также вес с графиком.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;
  PD.views = PD.views || {};

  let filter = "all";

  const TITLE_SUGGESTIONS = {
    vaccine: "Комплексная прививка",
    parasite: "Обработка от клещей и глистов",
    vet: "Плановый осмотр",
    med: "",
    procedure: "",
  };

  function icsEscape(text) {
    return String(text || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  }

  // Файл .ics — событие попадёт в календарь телефона с напоминанием за день
  function exportICS(item) {
    const pet = S.state.pets.find((p) => p.id === item.petId);
    const kind = S.healthKind(item.kind);
    const date = item.nextDate.replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const summary = (pet ? pet.name + ": " : "") + item.title;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pet Diary//RU",
      "BEGIN:VEVENT",
      "UID:" + item.id + "@pet-diary",
      "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + date,
      "SUMMARY:" + icsEscape(kind.icon + " " + summary),
      "DESCRIPTION:" + icsEscape(kind.label + (item.note ? ". " + item.note : "")),
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + icsEscape(summary),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    U.download("pet-diary-" + item.nextDate + ".ics", lines.join("\r\n"), "text/calendar");
    PD.ui.toast("Событие сохранено — открой файл, чтобы добавить в календарь", { icon: "📅" });
  }

  function openHealthForm(item, preset) {
    const isNew = !item;
    const kindId = item ? item.kind : (preset && preset.kind) || "vaccine";
    const kind = S.healthKind(kindId);
    const fields = [
      { name: "kind", label: "Тип", type: "choice", compact: true, value: kindId, options: S.HEALTH_KINDS.map((k) => ({ value: k.id, label: k.label, icon: k.icon })) },
      { name: "title", label: "Название", required: true, maxlength: 80, value: item ? item.title : (preset && preset.title) || TITLE_SUGGESTIONS[kindId], placeholder: "Например, Нобивак DHPPi" },
      { name: "date", label: "Дата", type: "date", required: true, value: item ? item.date : U.today(), max: U.today() },
      {
        name: "nextDate",
        label: "Следующий раз",
        type: "date",
        value: item ? item.nextDate || "" : kind.repeatMonths ? U.addMonths(U.today(), kind.repeatMonths) : "",
        hint: "Напомним заранее. Оставь пустым, если повтор не нужен.",
      },
      { name: "clinic", label: "Клиника / врач", maxlength: 80, value: item ? item.clinic || "" : "", placeholder: "Необязательно" },
    ];
    if (isNew) fields.push({ name: "cost", label: "Стоимость", type: "number", min: 0, step: "0.01", inputmode: "decimal", hint: "Если указать — сразу попадёт в расходы" });
    fields.push({ name: "note", label: "Заметка", type: "textarea", value: item ? item.note || "" : "", placeholder: "Препарат, дозировка, рекомендации врача" });

    PD.ui.openForm({
      title: isNew ? "Новое событие" : "Изменить событие",
      noAutofocus: true,
      fields: fields,
      validate: function (v) {
        if (v.nextDate && v.nextDate < v.date) return "Следующая дата не может быть раньше текущей";
        if (v.cost !== "" && v.cost !== null && (isNaN(v.cost) || v.cost < 0)) return "Проверь стоимость";
        return null;
      },
      onSubmit: function (v) {
        const data = { kind: v.kind, title: v.title, date: v.date, nextDate: v.nextDate, clinic: v.clinic, note: v.note };
        if (isNew) {
          S.addItem("health", data);
          if (v.cost) {
            const category = v.kind === "med" || v.kind === "parasite" ? "meds" : "vet";
            S.addItem("expenses", { date: v.date, amount: v.cost, category: category, note: v.title });
          }
          if (preset && preset.closeId) S.updateItem("health", preset.closeId, { closed: true });
        } else {
          S.updateItem("health", item.id, data);
        }
      },
      onDelete: isNew ? null : () => PD.ui.removeWithUndo("health", item.id, "Событие удалено"),
    });

    // При смене типа подставляем подходящее название и интервал повтора
    if (isNew) {
      const form = U.$("#modal-form");
      form.addEventListener("change", function (event) {
        if (event.target.name !== "kind") return;
        const k = S.healthKind(event.target.value);
        const title = form.elements.title;
        if (!title.value || Object.values(TITLE_SUGGESTIONS).includes(title.value)) title.value = TITLE_SUGGESTIONS[k.id];
        form.elements.nextDate.value = k.repeatMonths ? U.addMonths(form.elements.date.value || U.today(), k.repeatMonths) : "";
      });
    }
  }

  // «Сделано»: создаём новую запись на сегодня, а старое напоминание закрываем
  function markDone(item) {
    openHealthForm(null, { kind: item.kind, title: item.title, closeId: item.id });
  }

  function openWeightForm(item) {
    const isNew = !item;
    const last = S.forPet(S.state.weights).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    PD.ui.openForm({
      title: isNew ? "Взвешивание" : "Изменить вес",
      fields: [
        { name: "kg", label: "Вес, кг", type: "number", required: true, min: 0.01, max: 200, step: "0.01", inputmode: "decimal", value: item ? item.kg : last ? last.kg : "" },
        { name: "date", label: "Дата", type: "date", required: true, value: item ? item.date : U.today(), max: U.today() },
      ],
      validate: function (v) {
        if (isNaN(v.kg) || v.kg <= 0 || v.kg > 200) return "Вес должен быть от 0.01 до 200 кг";
        return null;
      },
      onSubmit: function (v) {
        if (isNew) S.addItem("weights", { kg: v.kg, date: v.date });
        else S.updateItem("weights", item.id, { kg: v.kg, date: v.date });
      },
      onDelete: isNew ? null : () => PD.ui.removeWithUndo("weights", item.id, "Взвешивание удалено"),
    });
  }

  function init() {
    U.$("#health-add").addEventListener("click", () => openHealthForm(null));
    U.$("#weight-add").addEventListener("click", () => openWeightForm(null));
  }

  function renderUpcoming(pet) {
    const box = U.$("#health-upcoming");
    box.innerHTML = "";
    const list = S.reminders(pet.id).filter((r) => !r.birthday);
    const later = S.forPet(S.state.health)
      .filter((h) => h.nextDate && !h.closed && !list.some((r) => r.item.id === h.id))
      .sort((a, b) => (a.nextDate > b.nextDate ? 1 : -1))
      .slice(0, 3)
      .map((h) => ({ item: h, days: U.daysBetween(new Date(), U.parseISODate(h.nextDate)) }));
    const all = list.concat(later);
    if (!all.length) {
      box.append(el("li", { class: "empty-inline muted", text: "Запланированных событий нет. Добавь прививку или обработку — и мы напомним о следующей." }));
      return;
    }
    all.forEach(function (r) {
      const kind = S.healthKind(r.item.kind);
      const status = r.days < 0 ? "is-overdue" : r.days <= 7 ? "is-soon" : "";
      box.append(
        el(
          "li",
          { class: "list-item " + status },
          el("span", { class: "list-icon", text: kind.icon }),
          el("div", { class: "list-body" }, el("strong", { text: r.item.title }), el("span", { class: "muted small", text: U.formatDate(r.item.nextDate) + " · " + U.relativeDays(r.item.nextDate) })),
          el(
            "div",
            { class: "list-actions" },
            el("button", { type: "button", class: "icon-btn small", title: "В календарь", "aria-label": "Добавить в календарь", text: "📅", onclick: () => exportICS(r.item) }),
            el("button", { type: "button", class: "btn btn-small", text: "✓ Сделано", onclick: () => markDone(r.item) })
          )
        )
      );
    });
  }

  function renderWeight(pet) {
    const weights = S.forPet(S.state.weights, pet.id).sort((a, b) => (a.date > b.date ? 1 : -1));
    const summary = U.$("#weight-summary");
    const chart = U.$("#weight-chart");
    const list = U.$("#weight-list");
    summary.innerHTML = "";
    chart.innerHTML = "";
    list.innerHTML = "";

    if (!weights.length) {
      chart.append(PD.ui.emptyState("⚖️", "Взвешивай питомца раз в пару недель — график покажет, всё ли в порядке."));
      return;
    }
    const current = weights[weights.length - 1];
    const prev = weights[weights.length - 2];
    const tile = (label, value, cls) => el("div", { class: "stat" + (cls ? " " + cls : "") }, el("span", { class: "stat-value", text: value }), el("span", { class: "stat-label", text: label }));
    summary.append(tile("сейчас, кг", String(current.kg)));
    if (prev) {
      const diff = Math.round((current.kg - prev.kg) * 100) / 100;
      summary.append(tile("с прошлого раза", (diff > 0 ? "+" : "") + diff, diff > 0 ? "is-up" : diff < 0 ? "is-down" : ""));
    }
    const values = weights.map((w) => w.kg);
    summary.append(tile("мин / макс", Math.min.apply(null, values) + " / " + Math.max.apply(null, values)));

    const recent = weights.slice(-12);
    if (recent.length >= 2) {
      chart.append(
        PD.charts.lineChart(
          recent.map((w) => ({ value: w.kg, label: U.formatDate(w.date), short: U.parseISODate(w.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) })),
          { unit: "кг", title: "График веса" }
        )
      );
    }

    weights
      .slice()
      .reverse()
      .slice(0, 5)
      .forEach(function (w) {
        list.append(
          el(
            "li",
            { class: "list-item" },
            el("div", { class: "list-body" }, el("strong", { text: w.kg + " кг" }), el("span", { class: "muted small", text: U.formatDate(w.date) })),
            el("button", { type: "button", class: "icon-btn small", "aria-label": "Изменить", text: "✎", onclick: () => openWeightForm(w) })
          )
        );
      });
  }

  function renderRecords(pet) {
    const records = S.forPet(S.state.health, pet.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    const chips = U.$("#health-filters");
    chips.innerHTML = "";
    const used = new Set(records.map((r) => r.kind));
    if (filter !== "all" && !used.has(filter)) filter = "all";
    [{ id: "all", label: "Все", icon: "✨" }].concat(S.HEALTH_KINDS.filter((k) => used.has(k.id))).forEach(function (k) {
      chips.append(
        el("button", {
          type: "button",
          class: "chip" + (filter === k.id ? " is-active" : ""),
          "aria-pressed": filter === k.id ? "true" : "false",
          text: k.icon + " " + k.label,
          onclick: function () {
            filter = k.id;
            render();
          },
        })
      );
    });

    const list = U.$("#health-list");
    list.innerHTML = "";
    const shown = filter === "all" ? records : records.filter((r) => r.kind === filter);
    if (!shown.length) {
      list.append(el("li", { class: "empty-inline muted", text: "Медкарта пуста. Здесь будут прививки, обработки, визиты к врачу и лекарства." }));
      return;
    }
    shown.forEach(function (r) {
      const kind = S.healthKind(r.kind);
      const meta = [U.formatDate(r.date, true)];
      if (r.clinic) meta.push(r.clinic);
      const body = el("div", { class: "list-body" }, el("strong", { text: r.title }), el("span", { class: "muted small", text: meta.join(" · ") }));
      if (r.nextDate && !r.closed) body.append(el("span", { class: "small next-date", text: "Следующий раз: " + U.formatDate(r.nextDate) }));
      if (r.note) body.append(el("span", { class: "small entry-note", text: r.note }));
      list.append(
        el(
          "li",
          { class: "list-item" },
          el("span", { class: "list-icon", text: kind.icon }),
          body,
          el("button", { type: "button", class: "icon-btn small", "aria-label": "Изменить", text: "✎", onclick: () => openHealthForm(r) })
        )
      );
    });
  }

  function render() {
    const pet = S.activePet();
    if (!pet) return;
    renderUpcoming(pet);
    renderWeight(pet);
    renderRecords(pet);
  }

  PD.views.health = { init, render };
})(window.PD);
