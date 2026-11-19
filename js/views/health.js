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
      // Курс лекарств: появится в «Плане на сегодня» с отметками доз
      { name: "timesPerDay", label: "Раз в день", type: "number", inputmode: "numeric", value: item && item.timesPerDay ? item.timesPerDay : "", placeholder: "Например, 2", course: true },
      { name: "courseDays", label: "Дней курса", type: "number", inputmode: "numeric", value: item && item.courseDays ? item.courseDays : "", placeholder: "Например, 7", course: true, hint: "Дозы появятся в плане на сегодня" },
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
        if (v.kind === "med") {
          if (v.timesPerDay !== "" && (!Number.isInteger(v.timesPerDay) || v.timesPerDay < 1 || v.timesPerDay > 12)) return "Раз в день — от 1 до 12";
          if (v.courseDays !== "" && (!Number.isInteger(v.courseDays) || v.courseDays < 1 || v.courseDays > 365)) return "Дней курса — от 1 до 365";
          if ((v.timesPerDay === "") !== (v.courseDays === "")) return "Для курса укажи и «Раз в день», и «Дней курса»";
        }
        return null;
      },
      onSubmit: function (v) {
        const data = { kind: v.kind, title: v.title, date: v.date, nextDate: v.nextDate, clinic: v.clinic, note: v.note };
        const course = v.kind === "med" && v.timesPerDay !== "";
        data.timesPerDay = course ? v.timesPerDay : 0;
        data.courseDays = course ? v.courseDays : 0;
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

    // Поля курса видны только для лекарств
    const form = U.$("#modal-form");
    const toggleCourse = function (kindValue) {
      ["timesPerDay", "courseDays"].forEach(function (name) {
        const field = form.elements[name].closest(".field");
        field.hidden = kindValue !== "med";
      });
    };
    toggleCourse(kindId);
    form.addEventListener("change", function (event) {
      if (event.target.name === "kind") toggleCourse(event.target.value);
    });

    // При смене типа подставляем подходящее название и интервал повтора
    if (isNew) {
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

  // ---------- Симптомы ----------
  function openSymptomForm(entry) {
    const isNew = !entry;
    PD.ui.openForm({
      title: isNew ? "Что-то не так?" : "Симптом",
      noAutofocus: true,
      fields: [
        { name: "symptom", label: "Что заметили", type: "choice", compact: true, value: entry ? entry.symptom : "vomit", options: S.SYMPTOMS.map((s) => ({ value: s.id, label: s.label, icon: s.icon })) },
        { name: "time", label: "Когда", type: "datetime-local", required: true, value: U.toLocalInput(entry ? entry.time : Date.now()) },
        { name: "note", label: "Подробности", type: "textarea", maxlength: 300, value: entry ? entry.note : "", placeholder: "Например: после еды, с примесью травы, лапу поджимает задняя левая" },
        { name: "photo", label: "Фото — врачу пригодится", type: "photo", value: entry ? entry.photoId : null },
      ],
      validate: function (v) {
        if (new Date(v.time).getTime() > Date.now() + 60 * 1000) return "Запись не может быть из будущего";
        return null;
      },
      onSubmit: function (v) {
        const data = { type: "symptom", symptom: v.symptom, time: new Date(v.time).getTime(), note: v.note };
        const keep = entry ? entry.photoId : null;
        const save = v.photo
          ? PD.photos.save(v.photo).catch(function (err) {
              PD.ui.toast((err && err.message) || "Фото не сохранилось — симптом записан без него", { icon: "⚠️", kind: "error" });
              return keep;
            })
          : Promise.resolve(keep);
        save.then(function (photoId) {
          if (photoId) data.photoId = photoId;
          if (isNew) S.addItem("entries", data);
          else S.updateItem("entries", entry.id, data);
          if (isNew && PD.views.home) PD.views.home.react(S.SYMPTOM_ACTION);
          const alert = S.symptomAlerts().find((a) => a.symptom.id === v.symptom);
          if (alert) PD.ui.toast(alert.symptom.label + " уже " + alert.count + " " + U.plural(alert.count, "раз", "раза", "раз") + " за сутки — стоит позвонить ветеринару", { icon: "⚠️", kind: "error", timeout: 7000 });
        });
      },
      onDelete: isNew ? null : () => PD.ui.removeWithUndo("entries", entry.id),
    });
  }

  function renderSymptoms(pet) {
    const list = U.$("#symptom-list");
    list.innerHTML = "";
    const since = Date.now() - 14 * U.DAY;
    const items = S.entriesSorted(pet.id).filter((e) => e.type === "symptom" && e.time >= since);
    if (!items.length) {
      list.append(el("li", { class: "empty-inline muted", text: "За две недели жалоб нет 💚 Если что-то насторожит — отметь здесь: врачу будет проще понять картину." }));
      return;
    }
    items.slice(0, 6).forEach(function (e) {
      const s = S.symptomInfo(e.symptom);
      list.append(
        el(
          "li",
          { class: "list-item" },
          el("span", { class: "list-icon", text: s.icon }),
          el("div", { class: "list-body" }, el("strong", { text: s.label }), el("span", { class: "muted small", text: U.formatDayTitle(e.time) + ", " + U.formatTime(e.time) + (e.note ? " · " + e.note : "") })),
          e.photoId ? PD.photos.thumb(e.photoId, "entry-photo") : null,
          el("button", { type: "button", class: "icon-btn small", "aria-label": "Изменить", text: "✎", onclick: () => openSymptomForm(e) })
        )
      );
    });
  }

  // Отчёт для ветеринара: всё, что спросят на приёме, — коротко и по датам
  function vetReport(pet) {
    const lines = [];
    const species = S.SPECIES.find((s) => s.id === pet.species).label;
    lines.push(pet.name + " — " + [species.toLowerCase(), pet.breed, U.formatAge(pet.birthDate), pet.sex === "m" ? "мальчик" : pet.sex === "f" ? "девочка" : ""].filter(Boolean).join(", "));
    if (pet.chip) lines.push("Чип: " + pet.chip);
    const weights = S.forPet(S.state.weights, pet.id).sort((a, b) => (a.date > b.date ? 1 : -1));
    if (weights.length) {
      const last = weights[weights.length - 1];
      const monthAgo = weights.filter((w) => w.date <= U.addDaysISO(-25)).pop();
      let w = "Вес: " + String(last.kg).replace(".", ",") + " кг (" + U.formatDate(last.date) + ")";
      if (monthAgo && monthAgo !== last) w += ", месяц назад " + String(monthAgo.kg).replace(".", ",") + " кг";
      lines.push(w);
    }
    if (pet.food) lines.push("Корм: " + pet.food);
    if (pet.allergies) lines.push("Аллергии: " + pet.allergies);
    if (pet.conditions) lines.push("Хронические болезни: " + pet.conditions);

    const since = Date.now() - 14 * U.DAY;
    const symptoms = S.entriesSorted(pet.id)
      .filter((e) => e.type === "symptom" && e.time >= since)
      .reverse();
    lines.push("", "СИМПТОМЫ ЗА 14 ДНЕЙ");
    if (!symptoms.length) lines.push("не отмечались");
    let day = null;
    symptoms.forEach(function (e) {
      const d = U.formatDate(e.time);
      if (d !== day) {
        day = d;
        lines.push(d + ":");
      }
      lines.push("  " + U.formatTime(e.time) + " — " + S.symptomInfo(e.symptom).label + (e.note ? " (" + e.note + ")" : ""));
    });

    // Аппетит и активность за неделю: врачу важно, ест ли питомец и гуляет ли как обычно
    lines.push("", "ЕДА И АКТИВНОСТЬ ЗА 7 ДНЕЙ");
    for (let i = 6; i >= 0; i--) {
      const key = U.addDaysISO(-i);
      const dayEntries = S.forPet(S.state.entries, pet.id).filter((e) => U.toISODate(e.time) === key);
      const n = (t) => dayEntries.filter((e) => e.type === t).length;
      const parts = ["кормлений " + n("feed")];
      if (pet.species === "dog" || n("walk")) parts.push("прогулок " + n("walk"));
      if (n("toilet")) parts.push("туалет " + n("toilet"));
      lines.push(U.formatDate(key) + ": " + parts.join(", "));
    }

    const meds = S.forPet(S.state.health, pet.id).filter((h) => h.kind === "med" && U.daysBetween(U.parseISODate(h.date), new Date()) <= 30);
    if (meds.length) {
      lines.push("", "ЛЕКАРСТВА ЗА МЕСЯЦ");
      meds.forEach((m) => lines.push("• " + m.title + " с " + U.formatDate(m.date) + (m.timesPerDay ? ", " + m.timesPerDay + " р/день, " + m.courseDays + " дн." : "") + (m.note ? " — " + m.note : "")));
    }
    const lastVaccine = S.forPet(S.state.health, pet.id)
      .filter((h) => h.kind === "vaccine")
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .pop();
    if (lastVaccine) lines.push("", "Последняя прививка: " + lastVaccine.title + ", " + U.formatDate(lastVaccine.date, true));
    lines.push("", "Отчёт из Pet Diary · " + U.formatDate(U.today(), true));
    return lines.join("\n");
  }

  function openVetReport() {
    const pet = S.activePet();
    if (!pet) return;
    const text = vetReport(pet);
    const body = PD.ui.openPanel("Отчёт для врача");
    body.append(
      el("p", { class: "muted small", text: "Покажи на приёме или отправь в клинику заранее — так врач быстрее поймёт, что происходит." }),
      el("pre", { class: "memo", text: text }),
      el(
        "div",
        { class: "modal-actions" },
        el("span", { class: "spacer" }),
        el("button", { type: "button", class: "btn btn-ghost", text: "📋 Копировать", onclick: () => PD.ui.copyText(text) }),
        navigator.share ? el("button", { type: "button", class: "btn", text: "📤 Отправить", onclick: () => navigator.share({ title: "Отчёт для врача: " + pet.name, text: text }).catch(() => {}) }) : null
      )
    );
  }

  function init() {
    U.$("#health-add").addEventListener("click", () => openHealthForm(null));
    U.$("#weight-add").addEventListener("click", () => openWeightForm(null));
    U.$("#symptom-add").addEventListener("click", () => openSymptomForm(null));
    U.$("#vet-report-btn").addEventListener("click", openVetReport);
  }

  function renderUpcoming(pet) {
    const box = U.$("#health-upcoming");
    box.innerHTML = "";
    const list = S.reminders(pet.id).filter((r) => r.item);
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
    renderSymptoms(pet);
    renderUpcoming(pet);
    renderWeight(pet);
    renderRecords(pet);
  }

  PD.views.health = { init, render, openSymptomForm };
})(window.PD);
