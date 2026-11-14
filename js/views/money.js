// Расходы: траты по месяцам и категориям, сравнение с прошлым месяцем, график за полгода.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;
  PD.views = PD.views || {};

  let monthOffset = 0; // 0 — текущий месяц, -1 — прошлый…

  function money(amount) {
    return U.formatMoney(amount, S.state.settings.currency);
  }

  function monthKey(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return { key: U.toISODate(d).slice(0, 7), date: d };
  }

  function sumFor(list, key) {
    return list.filter((e) => e.date.slice(0, 7) === key).reduce((s, e) => s + Number(e.amount || 0), 0);
  }

  function openExpenseForm(item) {
    const isNew = !item;
    PD.ui.openForm({
      title: isNew ? "Новый расход" : "Изменить расход",
      fields: [
        { name: "amount", label: "Сумма", type: "number", required: true, min: 0.01, step: "0.01", inputmode: "decimal", value: item ? item.amount : "" },
        {
          name: "category",
          label: "Категория",
          type: "choice",
          compact: true,
          value: item ? item.category : "food",
          options: S.EXPENSE_CATEGORIES.map((c) => ({ value: c.id, label: c.label, icon: c.icon })),
        },
        { name: "date", label: "Дата", type: "date", required: true, value: item ? item.date : U.today(), max: U.today() },
        { name: "note", label: "Комментарий", maxlength: 100, value: item ? item.note || "" : "", placeholder: "Например, корм 10 кг" },
      ],
      validate: (v) => (isNaN(v.amount) || v.amount <= 0 ? "Сумма должна быть больше нуля" : null),
      onSubmit: function (v) {
        const data = { amount: Math.round(v.amount * 100) / 100, category: v.category, date: v.date, note: v.note };
        if (isNew) S.addItem("expenses", data);
        else S.updateItem("expenses", item.id, data);
      },
      onDelete: isNew ? null : () => PD.ui.removeWithUndo("expenses", item.id, "Расход удалён"),
    });
  }

  function init() {
    U.$("#expense-add").addEventListener("click", () => openExpenseForm(null));
    U.$("#month-prev").addEventListener("click", function () {
      monthOffset--;
      render();
    });
    U.$("#month-next").addEventListener("click", function () {
      if (monthOffset < 0) monthOffset++;
      render();
    });
  }

  function render() {
    const pet = S.activePet();
    if (!pet) return;
    const all = S.forPet(S.state.expenses, pet.id);
    const month = monthKey(monthOffset);
    const prevMonth = monthKey(monthOffset - 1);
    const items = all.filter((e) => e.date.slice(0, 7) === month.key).sort((a, b) => (a.date < b.date ? 1 : -1));
    const total = sumFor(all, month.key);
    const prevTotal = sumFor(all, prevMonth.key);

    const title = month.date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    U.$("#month-title").textContent = title.charAt(0).toUpperCase() + title.slice(1);
    U.$("#month-next").disabled = monthOffset >= 0;

    // Сводка
    const summary = U.$("#money-summary");
    summary.innerHTML = "";
    const tile = (label, value, cls) => el("div", { class: "stat" + (cls ? " " + cls : "") }, el("span", { class: "stat-value", text: value }), el("span", { class: "stat-label", text: label }));
    summary.append(tile("за месяц", money(total)));
    if (prevTotal > 0) {
      const diff = Math.round(((total - prevTotal) / prevTotal) * 100);
      summary.append(tile("к прошлому месяцу", (diff > 0 ? "+" : "") + diff + "%", diff > 0 ? "is-up" : diff < 0 ? "is-down" : ""));
    }
    const allTotal = all.reduce((s, e) => s + Number(e.amount || 0), 0);
    summary.append(tile("за всё время", money(allTotal)));

    // Категории
    const cats = U.$("#money-categories");
    cats.innerHTML = "";
    const byCat = {};
    items.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount)));
    const sorted = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    sorted.forEach(function (id) {
      const c = S.expenseCategory(id);
      const share = total ? byCat[id] / total : 0;
      cats.append(
        el(
          "div",
          { class: "cat-bar" },
          el("div", { class: "cat-bar-head" }, el("span", { text: c.icon + " " + c.label }), el("span", { text: money(byCat[id]) + " · " + Math.round(share * 100) + "%" })),
          el("div", { class: "cat-bar-track" }, el("div", { class: "cat-bar-fill", style: "width:" + Math.max(2, share * 100) + "%" }))
        )
      );
    });

    // Полгода
    const chartBox = U.$("#money-chart");
    chartBox.innerHTML = "";
    const months = [];
    for (let i = -5; i <= 0; i++) {
      const m = monthKey(monthOffset + i);
      months.push({ label: m.date.toLocaleDateString("ru-RU", { month: "short" }).replace(".", ""), value: Math.round(sumFor(all, m.key)), highlight: i === 0 });
    }
    if (months.some((m) => m.value > 0)) chartBox.append(PD.charts.barChart(months, { title: "Расходы за полгода" }));
    else chartBox.append(el("p", { class: "muted small", text: "Здесь появится график, когда накопятся траты." }));

    // Список
    const list = U.$("#money-list");
    list.innerHTML = "";
    if (!items.length) {
      list.append(el("li", { class: "empty-inline muted", text: "В этом месяце трат нет. Записывай покупки — увидишь, сколько на самом деле стоит любовь 💸" }));
      return;
    }
    items.forEach(function (e) {
      const c = S.expenseCategory(e.category);
      list.append(
        el(
          "li",
          { class: "list-item" },
          el("span", { class: "list-icon", text: c.icon }),
          el("div", { class: "list-body" }, el("strong", { text: e.note || c.label }), el("span", { class: "muted small", text: U.formatDate(e.date) + " · " + c.label })),
          el("span", { class: "amount", text: money(Number(e.amount)) }),
          el("button", { type: "button", class: "icon-btn small", "aria-label": "Изменить", text: "✎", onclick: () => openExpenseForm(e) })
        )
      );
    });
  }

  PD.views.money = { init, render };
})(window.PD);
