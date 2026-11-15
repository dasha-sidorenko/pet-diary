// Хранилище данных: питомцы, журнал, здоровье, вес, расходы, настройки.
// Всё живёт в localStorage одним объектом, с миграцией со старой версии.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const STORAGE_KEY = "pet-diary-v2";
  const LEGACY_PET_KEY = "pet-diary-pet";
  const LEGACY_ENTRIES_KEY = "pet-diary-entries";

  // Быстрые действия. Чтобы добавить новое — достаточно дописать строку сюда.
  const ACTIONS = [
    { type: "feed", label: "Кормление", icon: "🍖", effect: "food" },
    { type: "water", label: "Вода", icon: "💧", effect: "drop" },
    { type: "walk", label: "Прогулка", icon: "🦮", effect: "music" },
    { type: "play", label: "Игра", icon: "🎾", effect: "heart" },
    { type: "treat", label: "Вкусняшка", icon: "🍪", effect: "food" },
    { type: "med", label: "Лекарство", icon: "💊", effect: "plus" },
    { type: "groom", label: "Уход", icon: "🧼", effect: "bubble" },
    { type: "sleep", label: "Сон", icon: "😴", effect: "zzz" },
    { type: "toilet", label: "Туалет", icon: "🚽", effect: "sparkle" },
    { type: "train", label: "Тренировка", icon: "🎓", effect: "star" },
  ];
  const NOTE_ACTION = { type: "note", label: "Заметка", icon: "📝", effect: "heart" };
  const SYMPTOM_ACTION = { type: "symptom", label: "Симптом", icon: "🤒", effect: "tear" };

  // Симптомы для трекера «Что-то не так». alarm — сколько эпизодов за сутки уже повод звонить врачу
  const SYMPTOMS = [
    { id: "vomit", label: "Рвота", icon: "🤮", alarm: 3 },
    { id: "diarrhea", label: "Жидкий стул", icon: "💩", alarm: 3 },
    { id: "appetite", label: "Не ест", icon: "🍽️", alarm: 2 },
    { id: "lethargy", label: "Вялость", icon: "😔", alarm: 2 },
    { id: "cough", label: "Кашель, чихание", icon: "🤧", alarm: 0 },
    { id: "limp", label: "Хромота", icon: "🦵", alarm: 0 },
    { id: "itch", label: "Чешется", icon: "🐾", alarm: 0 },
    { id: "eyes", label: "Глаза, уши", icon: "👁️", alarm: 0 },
    { id: "pee", label: "Проблемы с туалетом", icon: "🚽", alarm: 2 },
    { id: "other", label: "Другое", icon: "❓", alarm: 0 },
  ];

  const SPECIES = [
    { id: "cat", label: "Кошка" },
    { id: "dog", label: "Собака" },
    { id: "rodent", label: "Грызун" },
    { id: "bird", label: "Птица" },
    { id: "other", label: "Другое" },
  ];

  const COLORS = [
    { id: "ginger", label: "Рыжий" },
    { id: "gray", label: "Серый" },
    { id: "black", label: "Чёрный" },
    { id: "white", label: "Белый" },
    { id: "brown", label: "Коричневый" },
    { id: "cream", label: "Кремовый" },
    { id: "green", label: "Зелёный" },
    { id: "blue", label: "Голубой" },
  ];

  const HEALTH_KINDS = [
    { id: "vaccine", label: "Прививка", icon: "💉", repeatMonths: 12 },
    { id: "parasite", label: "Обработка от паразитов", icon: "🐛", repeatMonths: 3 },
    { id: "vet", label: "Визит к ветеринару", icon: "🩺", repeatMonths: 12 },
    { id: "med", label: "Курс лекарств", icon: "💊", repeatMonths: 0 },
    { id: "procedure", label: "Процедура", icon: "✂️", repeatMonths: 0 },
  ];

  const EXPENSE_CATEGORIES = [
    { id: "food", label: "Корм", icon: "🍖" },
    { id: "vet", label: "Ветеринар", icon: "🩺" },
    { id: "meds", label: "Лекарства", icon: "💊" },
    { id: "toys", label: "Игрушки", icon: "🧸" },
    { id: "care", label: "Уход и гигиена", icon: "🧴" },
    { id: "grooming", label: "Груминг", icon: "✂️" },
    { id: "other", label: "Другое", icon: "📦" },
  ];

  // Потребности тамагочи: какие действия их восполняют и за сколько часов шкала падает до нуля.
  const NEEDS = [
    { id: "food", label: "Сытость", icon: "🍖", actions: { feed: 1, treat: 0.35 }, hours: 12 },
    { id: "fun", label: "Радость", icon: "🎾", actions: { play: 1, walk: 0.8, treat: 0.3, train: 0.6 }, hours: 24 },
    { id: "energy", label: "Бодрость", icon: "⚡", actions: { sleep: 1 }, hours: 20 },
    { id: "clean", label: "Чистота", icon: "🧼", actions: { groom: 1, toilet: 0.25 }, hours: 24 * 7 },
  ];

  const LEGACY_ACTION_MAP = {
    "Покормил": "feed",
    "Погулял": "walk",
    "Поиграл": "play",
    "Дал лекарство": "med",
    "Поспал": "sleep",
    "Почистил": "groom",
  };

  const LEGACY_SPECIES_MAP = {
    "Кошка": "cat",
    "Собака": "dog",
    "Грызун": "rodent",
    "Птица": "bird",
    "Другое": "other",
  };

  function emptyState() {
    return {
      version: 2,
      activePetId: null,
      pets: [],
      entries: [],
      health: [],
      weights: [],
      expenses: [],
      members: [],
      chores: [],
      achievements: {},
      counters: { pokes: 0, exports: 0 },
      settings: {
        theme: "auto",
        sound: true,
        notifications: false,
        currency: "RUB",
        lastNotifiedDay: null,
        audience: null,
        kidMode: false,
        memberId: null,
        weather: false,
        weatherLoc: null,
        lastExportAt: null,
        backupSnoozeUntil: null,
      },
    };
  }

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  // Переносим данные из первой версии дневника (одна карточка + журнал строками)
  function migrateLegacy(state) {
    const legacyPet = readJSON(LEGACY_PET_KEY);
    const legacyEntries = readJSON(LEGACY_ENTRIES_KEY);
    if (!legacyPet && !Array.isArray(legacyEntries)) return false;

    let petId = null;
    if (legacyPet && legacyPet.name) {
      petId = U.uid();
      state.pets.push({
        id: petId,
        name: legacyPet.name,
        species: LEGACY_SPECIES_MAP[legacyPet.species] || "other",
        breed: legacyPet.breed || "",
        birthDate: legacyPet.birthDate || "",
        sex: "",
        color: "ginger",
        chip: "",
        createdAt: Date.now(),
      });
      state.activePetId = petId;
    }

    if (Array.isArray(legacyEntries) && legacyEntries.length) {
      if (!petId) {
        petId = U.uid();
        state.pets.push({
          id: petId,
          name: "Питомец",
          species: "cat",
          breed: "",
          birthDate: "",
          sex: "",
          color: "ginger",
          chip: "",
          createdAt: Date.now(),
        });
        state.activePetId = petId;
      }
      legacyEntries.forEach(function (entry) {
        state.entries.push({
          id: U.uid(),
          petId: petId,
          type: LEGACY_ACTION_MAP[entry.action] || "note",
          time: entry.time || Date.now(),
          note: LEGACY_ACTION_MAP[entry.action] ? "" : String(entry.action || ""),
        });
      });
    }
    return true;
  }

  // Проверка записей при загрузке и восстановлении из файла: битая строка не должна ронять экраны
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const VALIDATORS = {
    pets: (p) => p.id && typeof p.name === "string",
    entries: (e) => e.id && e.petId && typeof e.type === "string" && Number.isFinite(Number(e.time)),
    health: (h) => h.id && h.petId && ISO_DATE.test(h.date) && (!h.nextDate || ISO_DATE.test(h.nextDate)),
    weights: (w) => w.id && w.petId && ISO_DATE.test(w.date) && Number(w.kg) > 0,
    expenses: (x) => x.id && x.petId && ISO_DATE.test(x.date) && Number.isFinite(Number(x.amount)),
    members: (m) => m.id && typeof m.name === "string",
    chores: (c) => c.id && c.petId && c.memberId && typeof c.type === "string",
  };

  function cleanList(key, list) {
    return list.filter(function (item) {
      if (!item || typeof item !== "object") return false;
      try {
        return !!VALIDATORS[key](item);
      } catch {
        return false;
      }
    });
  }

  function normalize(raw) {
    const state = emptyState();
    if (!raw || typeof raw !== "object") return state;
    ["pets", "entries", "health", "weights", "expenses", "members", "chores"].forEach(function (key) {
      if (Array.isArray(raw[key])) state[key] = cleanList(key, raw[key]);
    });
    const memberIds = new Set(state.members.map((m) => m.id));
    state.chores = state.chores.filter((c) => memberIds.has(c.memberId));
    state.entries.forEach((e) => (e.time = Number(e.time)));
    state.weights.forEach((w) => (w.kg = Number(w.kg)));
    state.expenses.forEach((x) => (x.amount = Number(x.amount)));
    // Записи без питомца (после ручной правки файла) никому не видны — убираем
    const petIds = new Set(state.pets.map((p) => p.id));
    ["entries", "health", "weights", "expenses", "chores"].forEach(function (key) {
      state[key] = state[key].filter((item) => petIds.has(item.petId));
    });
    if (raw.achievements && typeof raw.achievements === "object") state.achievements = raw.achievements;
    if (raw.counters && typeof raw.counters === "object") Object.assign(state.counters, raw.counters);
    if (raw.settings && typeof raw.settings === "object") Object.assign(state.settings, raw.settings);
    if (state.settings.memberId && !memberIds.has(state.settings.memberId)) state.settings.memberId = null;
    state.activePetId = raw.activePetId || null;
    if (!state.pets.some((p) => p.id === state.activePetId)) {
      state.activePetId = state.pets.length ? state.pets[0].id : null;
    }
    return state;
  }

  function load() {
    const saved = readJSON(STORAGE_KEY);
    if (saved) return normalize(saved);
    const state = emptyState();
    if (migrateLegacy(state)) persist(state);
    return state;
  }

  let storageOk = true;
  function persist(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch {
      // Приватный режим или переполнено — работаем в памяти
      storageOk = false;
    }
  }

  let state = load();
  const listeners = [];

  function commit() {
    persist(state);
    listeners.forEach((fn) => fn(state));
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  function activePet() {
    return state.pets.find((p) => p.id === state.activePetId) || null;
  }

  function forPet(list, petId) {
    const id = petId || state.activePetId;
    return list.filter((item) => item.petId === id);
  }

  function actionInfo(type) {
    if (type === "note") return NOTE_ACTION;
    if (type === "symptom") return SYMPTOM_ACTION;
    return ACTIONS.find((a) => a.type === type) || { type, label: type, icon: "•" };
  }

  function symptomInfo(id) {
    return SYMPTOMS.find((s) => s.id === id) || SYMPTOMS[SYMPTOMS.length - 1];
  }

  // Подпись и иконка конкретной записи (у симптома — название симптома)
  function entryInfo(entry) {
    if (entry.type === "symptom") {
      const s = symptomInfo(entry.symptom);
      return { label: s.label, icon: s.icon };
    }
    return actionInfo(entry.type);
  }

  function healthKind(id) {
    return HEALTH_KINDS.find((k) => k.id === id) || HEALTH_KINDS[0];
  }

  function expenseCategory(id) {
    return EXPENSE_CATEGORIES.find((c) => c.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  }

  // --- Питомцы ---
  function savePet(data) {
    if (data.id) {
      const pet = state.pets.find((p) => p.id === data.id);
      if (pet) Object.assign(pet, data);
    } else {
      data.id = U.uid();
      data.createdAt = Date.now();
      state.pets.push(data);
      state.activePetId = data.id;
    }
    commit();
    return data.id;
  }

  function deletePet(id) {
    state.pets = state.pets.filter((p) => p.id !== id);
    ["entries", "health", "weights", "expenses", "chores"].forEach(function (key) {
      state[key] = state[key].filter((item) => item.petId !== id);
    });
    if (state.activePetId === id) state.activePetId = state.pets.length ? state.pets[0].id : null;
    commit();
  }

  function setActivePet(id) {
    state.activePetId = id;
    commit();
  }

  // --- Универсальные операции для списков ---
  function addItem(collection, item) {
    item.id = item.id || U.uid();
    item.petId = item.petId || state.activePetId;
    // Кто сделал запись — если в дневнике несколько членов семьи
    if (collection === "entries" && !item.by && state.settings.memberId) item.by = state.settings.memberId;
    state[collection].push(item);
    commit();
    return item;
  }

  function updateItem(collection, id, patch) {
    const item = state[collection].find((i) => i.id === id);
    if (item) Object.assign(item, patch);
    commit();
    return item;
  }

  function removeItem(collection, id) {
    const index = state[collection].findIndex((i) => i.id === id);
    if (index === -1) return null;
    const removed = state[collection].splice(index, 1)[0];
    commit();
    return removed;
  }

  function restoreItem(collection, item) {
    state[collection].push(item);
    commit();
  }

  // extra — дополнительные поля записи: by (кто), medId (курс лекарств), symptom, photoId
  function addEntry(type, note, time, extra) {
    return addItem("entries", Object.assign({ type: type, note: note || "", time: time || Date.now() }, extra || {}));
  }

  function entriesSorted(petId) {
    return forPet(state.entries, petId).sort((a, b) => b.time - a.time);
  }

  // --- Потребности ---
  // Каждое подходящее действие поднимает шкалу; между действиями она линейно убывает.
  // Если в карточке указан режим (кормлений/прогулок в день), шкалы убывают под этот ритм:
  // к моменту следующего положенного кормления сытость уже заметно проседает.
  function needHours(need, pet) {
    const feeds = pet ? Number(pet.feedsPerDay) : 0;
    const walks = pet ? Number(pet.walksPerDay) : 0;
    if (need.id === "food" && feeds > 0) return Math.max(6, 36 / feeds);
    if (need.id === "fun" && walks > 0) return Math.max(8, 36 / walks);
    return need.hours;
  }

  function computeNeeds(petId) {
    const now = Date.now();
    const pet = state.pets.find((p) => p.id === (petId || state.activePetId));
    const entries = forPet(state.entries, petId).slice().sort((a, b) => a.time - b.time);
    return NEEDS.map(function (need) {
      const decayPerMs = 1 / (needHours(need, pet) * U.HOUR);
      let level = 0;
      let last = null;
      let lastTime = null;
      entries.forEach(function (entry) {
        const gain = need.actions[entry.type];
        if (!gain || entry.time > now) return;
        if (lastTime !== null) level = Math.max(0, level - (entry.time - lastTime) * decayPerMs);
        level = Math.min(1, level + gain);
        lastTime = entry.time;
        last = entry.time;
      });
      if (lastTime !== null) level = Math.max(0, level - (now - lastTime) * decayPerMs);
      return { id: need.id, label: need.label, icon: need.icon, value: level, last: last };
    });
  }

  function mood(needs) {
    if (!needs.length || needs.every((n) => n.last === null)) return "neutral";
    const avg = needs.reduce((s, n) => s + n.value, 0) / needs.length;
    const min = Math.min.apply(null, needs.map((n) => n.value));
    if (avg > 0.7 && min > 0.3) return "happy";
    if (avg < 0.3 || min < 0.08) return "sad";
    return "neutral";
  }

  // Серия дней подряд, когда в дневнике была хотя бы одна запись
  function streak(petId) {
    const days = new Set(forPet(state.entries, petId).map((e) => U.toISODate(e.time)));
    let count = 0;
    const d = new Date();
    if (!days.has(U.toISODate(d))) d.setDate(d.getDate() - 1);
    while (days.has(U.toISODate(d))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  // --- Здоровье: ближайшие и просроченные события ---
  function reminders(petId) {
    const list = [];
    const pets = petId ? state.pets.filter((p) => p.id === petId) : state.pets;
    pets.forEach(function (pet) {
      state.health.forEach(function (item) {
        if (item.petId !== pet.id || !item.nextDate || item.closed) return;
        const days = U.daysBetween(new Date(), U.parseISODate(item.nextDate));
        if (days <= 14) list.push({ item: item, pet: pet, days: days });
      });
      const bday = U.daysToBirthday(pet.birthDate);
      if (bday !== null && bday <= 7) list.push({ birthday: true, pet: pet, days: bday });
      const stock = foodStock(pet);
      if (stock && stock.daysLeft <= 5) list.push({ stock: true, pet: pet, days: stock.daysLeft });
    });
    return list.sort((a, b) => a.days - b.days);
  }

  // --- Запас корма: мешок, суточная норма и дата, когда открыли ---
  function foodStock(pet) {
    const s = pet && pet.stock;
    if (!s || !(s.bagKg > 0) || !(s.dailyG > 0) || !s.openedAt) return null;
    const used = U.daysBetween(U.parseISODate(s.openedAt), new Date());
    const total = Math.floor((s.bagKg * 1000) / s.dailyG);
    const daysLeft = Math.max(0, total - used);
    return { daysLeft: daysLeft, total: total, endDate: U.addDaysISO(daysLeft), share: Math.max(0, Math.min(1, daysLeft / total)) };
  }

  // --- Тревожные симптомы: несколько эпизодов за сутки ---
  function symptomAlerts(petId) {
    const since = Date.now() - U.DAY;
    const counts = {};
    forPet(state.entries, petId)
      .filter((e) => e.type === "symptom" && e.time >= since)
      .forEach((e) => (counts[e.symptom] = (counts[e.symptom] || 0) + 1));
    return SYMPTOMS.filter((s) => s.alarm && counts[s.id] >= s.alarm).map((s) => ({ symptom: s, count: counts[s.id] }));
  }

  // --- Курсы лекарств: «2 раза в день, 7 дней» ---
  function activeCourses(petId) {
    const now = new Date();
    return forPet(state.health, petId).filter(function (h) {
      if (h.kind !== "med" || h.closed || !(h.timesPerDay > 0) || !(h.courseDays > 0)) return false;
      const day = U.daysBetween(U.parseISODate(h.date), now);
      return day >= 0 && day < h.courseDays;
    });
  }

  // --- Режим дня: сколько раз в день положено кормить и гулять (из карточки питомца) ---
  const ROUTINE = [
    { key: "feedsPerDay", type: "feed", label: "Кормления", icon: "🍖" },
    { key: "walksPerDay", type: "walk", label: "Прогулки", icon: "🦮" },
  ];

  function dayPlan(petId) {
    const pet = state.pets.find((p) => p.id === (petId || state.activePetId));
    if (!pet) return [];
    const now = Date.now();
    const start = U.startOfDay(new Date()).getTime();
    const mine = forPet(state.entries, pet.id);
    const plan = ROUTINE.filter((r) => Number(pet[r.key]) > 0).map(function (r) {
      const ofType = mine.filter((e) => e.type === r.type && e.time <= now);
      const done = ofType.filter((e) => e.time >= start).length;
      const last = ofType.reduce((m, e) => Math.max(m, e.time), 0);
      return { type: r.type, label: r.label, icon: r.icon, done: done, target: Number(pet[r.key]), last: last || null };
    });
    // Активные курсы лекарств — отдельными строками плана
    activeCourses(pet.id).forEach(function (h) {
      const doses = mine.filter((e) => e.medId === h.id && e.time <= now);
      const day = U.daysBetween(U.parseISODate(h.date), new Date()) + 1;
      plan.push({
        type: "med",
        medId: h.id,
        note: h.title,
        label: h.title,
        sub: "день " + day + " из " + h.courseDays,
        icon: "💊",
        done: doses.filter((e) => e.time >= start).length,
        target: Number(h.timesPerDay),
        last: doses.reduce((m, e) => Math.max(m, e.time), 0) || null,
      });
    });
    return plan;
  }

  // --- Сводка за месяц: для отчёта-картинки ---
  function monthSummary(petId, year, month) {
    const from = new Date(year, month, 1).getTime();
    const to = new Date(year, month + 1, 1).getTime();
    const key = year + "-" + String(month + 1).padStart(2, "0");
    const entries = forPet(state.entries, petId).filter((e) => e.time >= from && e.time < to);
    const count = (type) => entries.filter((e) => e.type === type).length;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Math.max(1, Math.min(daysInMonth, Math.ceil((Math.min(Date.now(), to) - from) / U.DAY)));
    const byDate = (a, b) => (a.date > b.date ? 1 : -1);
    const weights = forPet(state.weights, petId).filter((w) => w.date.slice(0, 7) === key).sort(byDate);
    const before = forPet(state.weights, petId).filter((w) => w.date.slice(0, 7) < key).sort(byDate).pop();
    const spent = forPet(state.expenses, petId)
      .filter((x) => x.date.slice(0, 7) === key)
      .reduce((s, x) => s + Number(x.amount || 0), 0);
    return {
      key: key,
      days: days,
      activeDays: new Set(entries.map((e) => U.toISODate(e.time))).size,
      total: entries.length,
      feeds: count("feed"),
      walks: count("walk"),
      plays: count("play") + count("train"),
      notes: count("note"),
      weightStart: before ? before.kg : weights.length ? weights[0].kg : null,
      weightEnd: weights.length ? weights[weights.length - 1].kg : null,
      spent: spent,
      health: forPet(state.health, petId).filter((h) => h.date.slice(0, 7) === key),
    };
  }

  // --- Сохранность данных ---
  // Просим браузер не вычищать хранилище при нехватке места (особенно важно на телефонах)
  function requestPersistence() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
    return navigator.storage
      .persisted()
      .then((already) => already || navigator.storage.persist())
      .catch(() => false);
  }

  // Пора ли напомнить про резервную копию: данных уже прилично, а копии давно не было
  function backupDue() {
    const s = state.settings;
    const now = Date.now();
    if (s.backupSnoozeUntil && now < s.backupSnoozeUntil) return false;
    const total = state.entries.length + state.health.length + state.weights.length;
    if (total < 30) return false;
    return !s.lastExportAt || now - s.lastExportAt > 30 * U.DAY;
  }

  // photos — необязательный словарь { id: dataURL }, чтобы копия переносила и фото
  function exportData(photos) {
    const extra = photos && Object.keys(photos).length ? { photos: photos } : {};
    return JSON.stringify(Object.assign({ app: "pet-diary", exportedAt: new Date().toISOString() }, state, extra), null, 2);
  }

  function importData(text) {
    const raw = JSON.parse(text);
    if (!raw || !Array.isArray(raw.pets)) throw new Error("Файл не похож на резервную копию дневника");
    state = normalize(raw);
    commit();
    return raw.photos && typeof raw.photos === "object" ? raw.photos : null;
  }

  function resetAll() {
    state = emptyState();
    commit();
  }

  function updateSettings(patch) {
    Object.assign(state.settings, patch);
    commit();
  }

  function unlockAchievement(id) {
    if (state.achievements[id]) return false;
    state.achievements[id] = Date.now();
    persist(state);
    return true;
  }

  function bump(counter) {
    state.counters[counter] = (state.counters[counter] || 0) + 1;
    persist(state);
    return state.counters[counter];
  }

  PD.store = {
    bump,
    ACTIONS,
    NOTE_ACTION,
    SYMPTOM_ACTION,
    SYMPTOMS,
    symptomInfo,
    entryInfo,
    foodStock,
    symptomAlerts,
    activeCourses,
    SPECIES,
    COLORS,
    HEALTH_KINDS,
    EXPENSE_CATEGORIES,
    NEEDS,
    get state() {
      return state;
    },
    get storageOk() {
      return storageOk;
    },
    subscribe,
    commit,
    activePet,
    forPet,
    actionInfo,
    healthKind,
    expenseCategory,
    savePet,
    deletePet,
    setActivePet,
    addItem,
    updateItem,
    removeItem,
    restoreItem,
    addEntry,
    entriesSorted,
    dayPlan,
    monthSummary,
    requestPersistence,
    backupDue,
    computeNeeds,
    mood,
    streak,
    reminders,
    exportData,
    importData,
    resetAll,
    updateSettings,
    unlockAchievement,
  };
})(window.PD);
