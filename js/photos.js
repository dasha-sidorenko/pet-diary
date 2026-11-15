// Фото в записях: хранятся в IndexedDB (localStorage для картинок слишком мал).
// Перед сохранением ужимаем до 1280 px по длинной стороне — так сотни фото не забьют телефон.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const el = U.el;
  const DB_NAME = "pet-diary-photos";
  const STORE = "photos";
  const MAX_SIDE = 1280;
  const urls = new Map();
  let dbPromise = null;

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        if (!window.indexedDB) {
          reject(new Error("Браузер не поддерживает хранение фото"));
          return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  // Одна операция с хранилищем; возвращает результат запроса после завершения транзакции
  function run(mode, action) {
    return db().then(function (database) {
      return new Promise(function (resolve, reject) {
        const tx = database.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Не хватает места для фото"));
      });
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img: img, url: url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Не получилось открыть картинку"));
      };
      img.src = url;
    });
  }

  function compress(file) {
    return loadImage(file).then(function (loaded) {
      const img = loaded.img;
      const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(loaded.url);
      return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    });
  }

  function save(file) {
    const id = "ph" + U.uid();
    return compress(file)
      .then((blob) => run("readwrite", (store) => store.put(blob, id)))
      .then(() => id);
  }

  function get(id) {
    return run("readonly", (store) => store.get(id));
  }

  // Адрес картинки для <img>; кешируем, чтобы не плодить object URL
  function url(id) {
    if (urls.has(id)) return Promise.resolve(urls.get(id));
    return get(id).then(function (blob) {
      if (!blob) return null;
      const u = URL.createObjectURL(blob);
      urls.set(id, u);
      return u;
    });
  }

  function remove(id) {
    if (urls.has(id)) {
      URL.revokeObjectURL(urls.get(id));
      urls.delete(id);
    }
    return run("readwrite", (store) => store.delete(id));
  }

  // Миниатюра: картинка подгружается асинхронно, по нажатию открывается крупно
  function thumb(id, cls) {
    const img = el("img", { class: "photo-thumb " + (cls || ""), alt: "Фото", loading: "lazy" });
    url(id)
      .then((u) => (u ? (img.src = u) : img.remove()))
      .catch(() => img.remove());
    img.addEventListener("click", function (event) {
      event.stopPropagation();
      view(id);
    });
    return img;
  }

  function view(id) {
    url(id).then(function (u) {
      if (!u) return;
      const body = PD.ui.openPanel("Фото");
      body.append(el("img", { class: "photo-full", src: u, alt: "Фото" }));
    });
  }

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  // Для резервной копии: { id: dataURL }
  function exportAll(ids) {
    const wanted = Array.from(new Set(ids));
    return Promise.all(
      wanted.map((id) =>
        get(id)
          .then((blob) => (blob ? blobToDataURL(blob).then((data) => [id, data]) : null))
          .catch(() => null)
      )
    ).then((pairs) => Object.fromEntries(pairs.filter(Boolean)));
  }

  function importAll(map) {
    const ids = Object.keys(map || {});
    return Promise.all(
      ids.map((id) =>
        fetch(map[id])
          .then((res) => res.blob())
          .then((blob) => run("readwrite", (store) => store.put(blob, id)))
          .catch(() => null)
      )
    );
  }

  // Удаляем фото, на которые больше не ссылается ни одна запись
  function cleanup(usedIds) {
    const used = new Set(usedIds);
    return run("readonly", (store) => store.getAllKeys())
      .then((keys) => Promise.all((keys || []).filter((k) => !used.has(k)).map(remove)))
      .catch(() => {});
  }

  PD.photos = { save, url, thumb, view, remove, exportAll, importAll, cleanup };
})(window.PD);
