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

  function openEntryForm(entry) {
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
      ],
      validate: function (v) {
        if (new Date(v.time).getTime() > Date.now() + 60 * 1000) return "Запись не может быть из будущего";
        if (v.type === "note" && !v.note) return "Для заметки нужен текст";
        return null;
      },
      onSubmit: function (v) {
        const data = { type: v.type, time: new Date(v.time).getTime(), note: v.note };
        if (isNew) S.addItem("entries", data);
        else S.updateItem("entries", entry.id, data);
      },
      onDelete: isNew ? null : () => PD.ui.removeWithUndo("entries", entry.id),
    });
  }

  // Одна строка записи — используется и на главной, и в журнале
  function entryItem(entry) {
    const info = S.actionInfo(entry.type);
    const body = el("div", { class: "entry-body" }, el("span", { class: "entry-title", text: info.label }));
    if (entry.note) body.append(el("span", { class: "entry-note", text: entry.note }));
    return el(
      "li",
      { class: "entry entry-" + entry.type },
      el("span", { class: "entry-icon", text: info.icon, "aria-hidden": "true" }),
      body,
      el("time", { class: "entry-time", datetime: new Date(entry.time).toISOString(), text: U.formatTime(entry.time) }),
      el(
        "div",
        { class: "entry-actions" },
        el("button", { type: "button", class: "icon-btn small", "aria-label": "Изменить", text: "✎", onclick: () => openEntryForm(entry) }),
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
    const chips = [{ type: "all", label: "Все", icon: "✨" }].concat(allTypes().filter((a) => used.has(a.type)));
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
        const info = S.actionInfo(e.type);
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
