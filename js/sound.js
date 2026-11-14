// 8-битные звуки на Web Audio API — без единого аудиофайла.
(function (PD) {
  "use strict";

  let ctx = null;

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Последовательность нот: [частота, длительность в секундах]
  function play(notes, type, volume) {
    if (!PD.store.state.settings.sound) return;
    const ac = audio();
    if (!ac) return;
    let t = ac.currentTime;
    notes.forEach(function (note) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(note[0], t);
      gain.gain.setValueAtTime(volume || 0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note[1]);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + note[1]);
      t += note[1] * 0.9;
    });
  }

  const SOUNDS = {
    tap: () => play([[660, 0.06]]),
    action: () => play([[523, 0.07], [784, 0.1]]),
    pet: () => play([[880, 0.06], [988, 0.06], [1175, 0.1]], "triangle", 0.07),
    delete: () => play([[330, 0.08], [220, 0.12]]),
    save: () => play([[523, 0.06], [659, 0.06], [784, 0.12]]),
    achievement: () => play([[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.25]], "square", 0.06),
    error: () => play([[196, 0.15], [165, 0.2]], "sawtooth", 0.04),
  };

  PD.sound = function (name) {
    try {
      (SOUNDS[name] || SOUNDS.tap)();
    } catch {
      // Звук — приятный бонус, ломать ради него приложение не будем
    }
  };
})(window.PD);
