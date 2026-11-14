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
    { type: "feed", label: "Покормил", icon: "🍖", effect: "food" },
    { type: "water", label: "Налил воды", icon: "💧", effect: "drop" },
    { type: "walk", label: "Погулял", icon: "🦮", effect: "music" },
    { type: "play", label: "Поиграл", icon: "🎾", effect: "heart" },
    { type: "treat", label: "Вкусняшка", icon: "🍪", effect: "food" },
    { type: "med", label: "Лекарство", icon: "💊", effect: "plus" },
    { type: "groom", label: "Почистил", icon: "🧼", effect: "bubble" },
    { type: "sleep", label: "Поспал", icon: "😴", effect: "zzz" },
    { type: "toilet", label: "Туалет", icon: "🚽", effect: "sparkle" },
    { type: "train", label: "Тренировка", icon: "🎓", effect: "star" },
  ];
  const NOTE_ACTION = { type: "note", label: "Заметка", icon: "📝", effect: "heart" };

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
      achievements: {},
      counters: { pokes: 0, exports: 0 },
      settings: {
        theme: "auto",
        sound: true,
        notifications: false,
        currency: "RUB",
        lastNotifiedDay: null,
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

  function normalize(raw) {
    const state = emptyState();
    if (!raw || typeof raw !== "object") return state;
    ["pets", "entries", "health", "weights", "expenses"].forEach(function (key) {
      if (Array.isArray(raw[key])) state[key] = raw[key];
    });
    if (raw.achievements && typeof raw.achievements === "object") state.achievements = raw.achievements;
    if (raw.counters && typeof raw.counters === "object") Object.assign(state.counters, raw.counters);
    if (raw.settings && typeof raw.settings === "object") Object.assign(state.settings, raw.settings);
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
    return ACTIONS.find((a) => a.type === type) || (type === "note" ? NOTE_ACTION : { type, label: type, icon: "•" });
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
    ["entries", "health", "weights", "expenses"].forEach(function (key) {
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

  function addEntry(type, note, time) {
    return addItem("entries", { type: type, note: note || "", time: time || Date.now() });
  }

  function entriesSorted(petId) {
    return forPet(state.entries, petId).sort((a, b) => b.time - a.time);
  }

  // --- Потребности ---
  // Каждое подходящее действие поднимает шкалу; между действиями она линейно убывает.
  function computeNeeds(petId) {
    const now = Date.now();
    const entries = forPet(state.entries, petId).slice().sort((a, b) => a.time - b.time);
    return NEEDS.map(function (need) {
      const decayPerMs = 1 / (need.hours * U.HOUR);
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
    });
    return list.sort((a, b) => a.days - b.days);
  }

  function exportData() {
    return JSON.stringify(Object.assign({ app: "pet-diary", exportedAt: new Date().toISOString() }, state), null, 2);
  }

  function importData(text) {
    const raw = JSON.parse(text);
    if (!raw || !Array.isArray(raw.pets)) throw new Error("Файл не похож на резервную копию дневника");
    state = normalize(raw);
    commit();
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
