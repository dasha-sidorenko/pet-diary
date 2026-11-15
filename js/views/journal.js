// Журнал: все записи по дням, фильтр по типу, поиск, добавление задним числом и редактирование.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;
  PD.views = PD.views || {};

  const PAGE = 60;
  let filter = "all";
  let query = "";
  let limit = PAGE;

  function allTypes() {
    return S.ACTIONS.concat([S.NOTE_ACTION]);
  }

  // Если выбрано новое фото — сохраняем его и отдаём id, иначе оставляем прежнее
  function withPhoto(file, current) {
    if (!file) return Promise.resolve(current || null);
    return PD.photos.save(file).catch(function (err) {
      PD.ui.toast(err.message || "Фото не сохранилось", { icon: "⚠️", kind: "error" });
      return current || null;
    });
  }

  function openEntryForm(entry) {
    // Симптомы редактируются в своей форме
    if (entry && entry.type === "symptom") {
      PD.views.health.openSymptomForm(entry);
      return;
    }
    const isNew = !entry;
    PD.ui.openForm({
      title: isNew ? "Новая запись" : "Изменить запись",
      noAutofocus: true,
      fields: [
        {
          name: "type",
          label: "Что было",
          type: "choice",
          compact: true,
          value: entry ? entry.type : "feed",
          options: allTypes().map((a) => ({ value: a.type, label: a.label, icon: a.icon })),
        },
        { name: "time", label: "Когда", type: "datetime-local", required: true, value: U.toLocalInput(entry ? entry.time : Date.now()) },
        { name: "note", label: "Заметка", type: "textarea", value: entry ? entry.note : "", placeholder: "Необязательно", maxlength: 300 },
        { name: "photo", label: "Фото", type: "photo", value: entry ? entry.photoId : null },
      ],
      validate: function (v) {
        if (new Date(v.time).getTime() > Date.now() + 60 * 1000) return "Запись не может быть из будущего";
        if (v.type === "note" && !v.note && !v.photo && !(entry && entry.photoId)) return "Для заметки нужен текст или фото";
        return null;
      },
      onSubmit: function (v) {
        const data = { type: v.type, time: new Date(v.time).getTime(), note: v.note };
        withPhoto(v.photo, entry && entry.photoId).then(function (photoId) {
          if (photoId) data.photoId = photoId;
          if (isNew) S.addItem("entries", data);
          else S.updateItem("entries", entry.id, data);
        });
      },
      onDelete: isNew ? null : () => PD.ui.removeWithUndo("entries", entry.id),
    });
    addTimeShortcuts();
  }

  // Кнопки под полем времени: «Сейчас», «−15 мин», «−1 ч», «Вчера»
  function addTimeShortcuts() {
    const form = U.$("#modal-form");
    const input = form.elements.time;
    if (!input) return;
    const shift = function (ms) {
      const base = ms === 0 ? Date.now() : new Date(input.value).getTime() || Date.now();
      input.value = U.toLocalInput(Math.min(Date.now(), base + ms));
      PD.sound("tap");
    };
    const row = el(
      "div",
      { class: "time-shortcuts" },
      [
        ["Сейчас", 0],
        ["−15 мин", -15 * 60 * 1000],
        ["−1 ч", -U.HOUR],
        ["−1 день", -U.DAY],
      ].map((s) => el("button", { type: "button", class: "chip", text: s[0], onclick: () => shift(s[1]) }))
    );
    input.after(row);
  }

  // Правка заметки прямо в ленте: клик по тексту → поле ввода, Enter сохраняет, Esc отменяет
  function editInline(entry, body) {
    if (body.querySelector("input")) return;
    const original = Array.from(body.childNodes);
    const input = el("input", { class: "inline-edit", maxlength: 300, value: entry.note || "", placeholder: "Добавь заметку…", "aria-label": "Текст заметки" });
    let done = false;
    const finish = function (save) {
      if (done) return;
      done = true;
      const text = input.value.trim();
      if (save && text !== (entry.note || "")) {
        if (entry.type === "note" && !text) {
          PD.ui.toast("Заметка не может быть пустой", { icon: "⚠️" });
          body.replaceChildren(...original);
          return;
        }
        S.updateItem("entries", entry.id, { note: text });
        PD.sound("save");
      } else {
        body.replaceChildren(...original);
      }
    };
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") finish(true);
      if (event.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    body.replaceChildren(original[0], input);
    input.focus();
  }

  function repeatEntry(entry) {
    const extra = {};
    if (entry.symptom) extra.symptom = entry.symptom;
    if (entry.medId) extra.medId = entry.medId;
    S.addEntry(entry.type, entry.note, Date.now(), extra);
    PD.sound("action");
    PD.ui.toast("Повторено: " + S.entryInfo(entry).label, { icon: "↻" });
  }

  // Одна строка записи — используется и на главной, и в журнале
  function entryItem(entry) {
    const info = S.entryInfo(entry);
    const who = entry.by ? PD.family.member(entry.by) : null;
    const title = el("span", { class: "entry-title", text: info.label });
    if (who) title.append(el("span", { class: "entry-by", text: " · " + PD.family.label(who) }));
    const body = el("div", { class: "entry-body", title: "Нажми, чтобы изменить заметку" }, title);
    if (entry.note) body.append(el("span", { class: "entry-note", text: entry.note }));
    else body.append(el("span", { class: "entry-note entry-note-empty", text: "+ заметка" }));
    body.addEventListener("click", () => editInline(entry, body));
    return el(
      "li",
      { class: "entry entry-" + entry.type },
      el("span", { class: "entry-icon", text: info.icon, "aria-hidden": "true" }),
      body,
      entry.photoId ? PD.photos.thumb(entry.photoId, "entry-photo") : null,
      el("time", { class: "entry-time", datetime: new Date(entry.time).toISOString(), text: U.formatTime(entry.time) }),
      el(
        "div",
        { class: "entry-actions" },
        el("button", { type: "button", class: "icon-btn small", "aria-label": "Повторить сейчас", title: "Повторить сейчас", text: "↻", onclick: () => repeatEntry(entry) }),
        el("button", { type: "button", class: "icon-btn small", "aria-label": "Изменить", title: "Изменить", text: "✎", onclick: () => openEntryForm(entry) }),
        el("button", { type: "button", class: "icon-btn small danger", "aria-label": "Удалить", text: "✕", onclick: () => PD.ui.removeWithUndo("entries", entry.id) })
      )
    );
  }

  function init() {
    U.$("#journal-add").addEventListener("click", () => openEntryForm(null));
    U.$("#journal-search").addEventListener("input", function (event) {
      query = event.target.value.trim().toLowerCase();
      limit = PAGE;
      renderList();
    });
    U.$("#journal-more").addEventListener("click", function () {
      limit += PAGE;
      renderList();
    });
  }

  function renderFilters() {
    const box = U.$("#journal-filters");
    box.innerHTML = "";
    const used = new Set(S.forPet(S.state.entries).map((e) => e.type));
    const chips = [{ type: "all", label: "Все", icon: "✨" }].concat(allTypes().concat([S.SYMPTOM_ACTION]).filter((a) => used.has(a.type)));
    chips.forEach(function (c) {
      box.append(
        el("button", {
          type: "button",
          class: "chip" + (filter === c.type ? " is-active" : ""),
          "aria-pressed": filter === c.type ? "true" : "false",
          text: c.icon + " " + c.label,
          onclick: function () {
            filter = c.type;
            limit = PAGE;
            render();
          },
        })
      );
    });
  }

  function renderList() {
    const box = U.$("#journal-list");
    box.innerHTML = "";
    let items = S.entriesSorted();
    if (filter !== "all") items = items.filter((e) => e.type === filter);
    if (query) {
      items = items.filter(function (e) {
        const info = S.entryInfo(e);
        return (info.label + " " + (e.note || "")).toLowerCase().includes(query);
      });
    }

    if (!items.length) {
      box.append(PD.ui.emptyState(query ? "🔍" : "📖", query ? "Ничего не нашлось" : "Записей пока нет. Отмечай заботу на главной или добавь запись задним числом."));
      U.$("#journal-more").hidden = true;
      return;
    }

    const dayCounts = {};
    items.forEach(function (e) {
      const d = U.toISODate(e.time);
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    });
    let currentDay = null;
    let list = null;
    items.slice(0, limit).forEach(function (entry) {
      const day = U.toISODate(entry.time);
      if (day !== currentDay) {
        currentDay = day;
        const count = dayCounts[day];
        box.append(el("h3", { class: "day-title" }, el("span", { text: U.formatDayTitle(entry.time) }), el("span", { class: "muted small", text: count + " " + U.plural(count, "запись", "записи", "записей") })));
        list = el("ul", { class: "timeline" });
        box.append(list);
      }
      list.append(entryItem(entry));
    });
    U.$("#journal-more").hidden = items.length <= limit;
  }

  function render() {
    if (filter !== "all" && !S.forPet(S.state.entries).some((e) => e.type === filter)) filter = "all";
    renderFilters();
    renderList();
  }

  PD.views.entryItem = entryItem;
  PD.views.journal = { init, render, openEntryForm };
})(window.PD);
