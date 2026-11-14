// Пиксельный движок: спрайты питомцев, частицы и живая сцена со сменой дня и ночи.
(function (PD) {
  "use strict";

  // Легенда:  . пусто  o контур  b тело  d тень  l светлое (живот, мордочка)
  //           e глаз  w блик  p розовый (нос, уши)  c румянец  k клюв и лапки
  const SPRITES = {
    cat: [
      "................",
      ".oo..........oo.",
      ".opo........opo.",
      ".oppo......oppo.",
      ".obbboooooobbbo.",
      "obbbbbbbbbbbbbbo",
      "obbbbbbbbbbbbbbo",
      "obbwebbbbbbwebbo",
      "obbeebbbbbbeebbo",
      "occbbbbppbbbbcco",
      ".obbbbbddbbbbbo.",
      "..obbbdbbdbbbo..",
      "...oobbbbbboo...",
      "..obllllllllbo..",
      "..obllllllllbooo",
      "..obbobbbbobbobo",
      "..oooooooooooo..",
    ],
    dog: [
      "................",
      "...oooooooooo...",
      "..obbbbbbbbbbo..",
      ".oddbbbbbbbbddo.",
      "oddobbbbbbbboddo",
      "oddobwebbweboddo",
      "oddobeebbeeboddo",
      ".odobbboobbbodo.",
      "..oobcllllcboo..",
      "....oblpplbo....",
      "...oobbbbbboo...",
      "..obllllllllbo..",
      "..obllllllllbo.o",
      "..obllllllllbobo",
      "..obbobbbbobboo.",
      "..oooooooooooo..",
    ],
    rodent: [
      "................",
      "...oo......oo...",
      "..opbo....obpo..",
      "..obbboooobbbo..",
      ".obbbbbbbbbbbbo.",
      "obbbbbbbbbbbbbbo",
      "obbwebbbbbbwebbo",
      "obbeebbbbbbeebbo",
      "occllllppllllcco",
      "oblllllddlllllbo",
      "obllllllllllllbo",
      "obllllllllllllbo",
      ".obllllllllllbo.",
      ".obbllllllllbbo.",
      "..obpobbbbopbo..",
      "...oooooooooo...",
    ],
    bird: [
      "................",
      "......oooo......",
      ".....obbbbo.....",
      "....obbbbbbo....",
      "...obwebbwebo...",
      "...obeebbeebo...",
      "...ocbbkkbbco...",
      "..oblllkklllbo..",
      ".odbllllllllbdo.",
      ".oddbllllllbddo.",
      ".oddbllllllbddo.",
      "..oddbllllbddo..",
      "...oddbbbbddo...",
      "....oobddboo....",
      ".....ok..ko.....",
      "....okk..kko....",
    ],
    other: [
      "................",
      "................",
      "......oooo......",
      "....oobbbboo....",
      "...obbbbbbbbo...",
      "..obbwbbbbbbbo..",
      "..obbbbbbbbbbo..",
      ".obbwebbbbwebbo.",
      ".obbeebbbbeebbo.",
      ".occbbbddbbbcco.",
      "obbbbbbbbbbbbbbo",
      "obbbbbbbbbbbbbbo",
      "obddbbbbbbbbddbo",
      ".obddddddddddbo.",
      "..oooooooooooo..",
      "................",
    ],
  };

  const PALETTES = {
    ginger: { b: "#f0a04b", d: "#c46a2a", l: "#ffe2b8" },
    gray: { b: "#9aa3ad", d: "#6b7480", l: "#e3e8ee" },
    black: { b: "#3d3a4f", d: "#26243a", l: "#6e6a86", e: "#ffd84a" },
    white: { b: "#f6f2ea", d: "#cfc6b6", l: "#ffffff" },
    brown: { b: "#8b5a3c", d: "#5e3a26", l: "#d1a27c" },
    cream: { b: "#f1d9a8", d: "#cfae72", l: "#fff4de" },
    green: { b: "#6cc551", d: "#3e8a35", l: "#d2f5ab" },
    blue: { b: "#5aa9e6", d: "#2f6fae", l: "#cde8ff" },
  };

  const FIXED = { o: "#2b1d2e", e: "#2b1d2e", w: "#ffffff", p: "#ff8fa3", c: "#ff9fb0", k: "#f7b538" };

  // Маленькие пиксельные эффекты
  const PARTICLES = {
    heart: { rows: [".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."], colors: { r: "#ff4d6d" } },
    zzz: { rows: ["zzz", "..z", ".z.", "z..", "zzz"], colors: { z: "#ffffff" } },
    music: { rows: ["..nn", "..n.", "..n.", "nnn.", "nn.."], colors: { n: "#ffe066" } },
    food: { rows: [".ff.", "ffff", ".ff."], colors: { f: "#c8763c" } },
    drop: { rows: ["..d..", ".ddd.", "ddddd", ".ddd."], colors: { d: "#4cc9f0" } },
    bubble: { rows: [".bb.", "b..b", "b..b", ".bb."], colors: { b: "#bde0fe" } },
    star: { rows: ["..y..", "yyyyy", ".yyy.", ".y.y."], colors: { y: "#ffd60a" } },
    plus: { rows: [".g.", "ggg", ".g."], colors: { g: "#57cc99" } },
    sparkle: { rows: ["y.y", ".y.", "y.y"], colors: { y: "#fff3b0" } },
    tear: { rows: ["t", "t"], colors: { t: "#7ec8ff" } },
  };

  const SUN = ["..yyyy..", ".yyyyyy.", "yyyyyyyy", "yyyyyyyy", "yyyyyyyy", "yyyyyyyy", ".yyyyyy.", "..yyyy.."];
  const MOON = ["..mmm.", ".mmm..", "mmm...", "mmm...", "mmm...", ".mmm..", "..mmm."];
  const CLOUD = ["...www....", ".wwwwwww..", "wwwwwwwwww", ".wwwwwwww."];

  function paletteFor(color) {
    return Object.assign({}, FIXED, PALETTES[color] || PALETTES.ginger);
  }

  // Рисуем спрайт по строкам. opts: closed (глаза закрыты), cheeks, flip
  function drawSprite(ctx, rows, x, y, pal, opts) {
    opts = opts || {};
    const width = rows[0].length;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < width; c++) {
        const ch = row[c];
        if (!ch || ch === ".") continue;
        let color;
        if (ch === "e" || ch === "w") {
          if (opts.closed) {
            const below = rows[r + 1] ? rows[r + 1][c] : ".";
            color = below === "e" || below === "w" ? pal.b : pal.o;
          } else {
            color = ch === "e" ? pal.e : pal.w;
          }
        } else if (ch === "c") {
          color = opts.cheeks ? pal.c : pal.b;
        } else {
          color = pal[ch] || ch;
        }
        ctx.fillStyle = color;
        const px = opts.flip ? x + (width - 1 - c) : x + c;
        ctx.fillRect(px, y + r, 1, 1);
      }
    }
  }

  function drawMap(ctx, rows, colors, x, y) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        if (ch === "." || !colors[ch]) continue;
        ctx.fillStyle = colors[ch];
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }

  // Статичный портрет питомца — для аватарок и иконок
  function drawAvatar(canvas, species, color) {
    const rows = SPRITES[species] || SPRITES.other;
    canvas.width = 18;
    canvas.height = rows.length + 2;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSprite(ctx, rows, 1, 1, paletteFor(color), { cheeks: true });
    return canvas;
  }

  // Время суток по часам: night, dawn, day, dusk
  function phaseOfDay(date) {
    const h = date.getHours();
    if (h >= 22 || h < 5) return "night";
    if (h < 8) return "dawn";
    if (h < 18) return "day";
    return "dusk";
  }

  const SKIES = {
    day: ["#7ec8f5", "#a3dbf7", "#c9ecfb"],
    dawn: ["#7b8cde", "#f4a6b8", "#ffd5a8"],
    dusk: ["#4b3f8f", "#c06c84", "#f8b195"],
    night: ["#0d1b3e", "#16295a", "#223a74"],
  };

  // Детерминированный «рандом» для звёзд и травы, чтобы сцена не мерцала хаотично
  function seeded(n) {
    const x = Math.sin(n * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }

  function PetScene(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = 72;
    this.H = 44;
    canvas.width = this.W;
    canvas.height = this.H;
    this.groundY = this.H - 9;
    this.species = "cat";
    this.pal = paletteFor("ginger");
    this.mood = "neutral";
    this.sleeping = false;
    this.x = Math.floor(this.W / 2 - 8);
    this.targetX = this.x;
    this.dir = 1;
    this.lastStep = 0;
    this.nextWander = 0;
    this.nextBlink = 0;
    this.blinkUntil = 0;
    this.jumpStart = -1;
    this.particles = [];
    this.nextAmbient = 0;
    this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.empty = false;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  PetScene.prototype.setPet = function (pet) {
    this.empty = !pet;
    if (!pet) return;
    this.species = SPRITES[pet.species] ? pet.species : "other";
    this.pal = paletteFor(pet.color);
  };

  PetScene.prototype.setMood = function (mood, sleeping) {
    this.mood = mood;
    this.sleeping = !!sleeping;
  };

  PetScene.prototype.spawn = function (name, count, spread) {
    const p = PARTICLES[name];
    if (!p) return;
    const rows = SPRITES[this.species];
    for (let i = 0; i < (count || 1); i++) {
      this.particles.push({
        p: p,
        x: this.x + 8 + Math.round((Math.random() - 0.5) * (spread || 14)),
        y: this.petY() - 2 + Math.round(Math.random() * 3),
        vx: (Math.random() - 0.5) * 0.006,
        vy: -(0.008 + Math.random() * 0.008),
        born: performance.now() + i * 120,
        life: 1400 + Math.random() * 600,
        h: rows.length,
      });
    }
  };

  PetScene.prototype.react = function (effect) {
    this.jumpStart = performance.now();
    this.spawn(effect || "heart", this.reducedMotion ? 1 : 4);
  };

  PetScene.prototype.poke = function () {
    this.jumpStart = performance.now();
    this.spawn("heart", this.reducedMotion ? 1 : 3, 10);
  };

  PetScene.prototype.petY = function () {
    const rows = SPRITES[this.species];
    return this.groundY - rows.length + 1;
  };

  // Попадание клика по питомцу (в координатах canvas)
  PetScene.prototype.hitTest = function (clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * this.W;
    const y = ((clientY - rect.top) / rect.height) * this.H;
    return x >= this.x - 2 && x <= this.x + 18 && y >= this.petY() - 6 && y <= this.groundY + 2;
  };

  PetScene.prototype.drawBackground = function (now) {
    const ctx = this.ctx;
    const date = new Date();
    const phase = phaseOfDay(date);
    const sky = SKIES[phase];
    const band = Math.ceil(this.groundY / 3);
    sky.forEach(function (color, i) {
      ctx.fillStyle = color;
      ctx.fillRect(0, i * band, this.W, band + 1);
    }, this);
    // Пиксельный дизеринг на стыках полос неба
    for (let i = 1; i < sky.length; i++) {
      ctx.fillStyle = sky[i - 1];
      for (let x = 0; x < this.W; x++) {
        if (x % 2 === 0) ctx.fillRect(x, i * band, 1, 1);
        if (x % 4 === 1) ctx.fillRect(x, i * band + 1, 1, 1);
      }
    }

    if (phase === "night") {
      for (let i = 0; i < 22; i++) {
        const sx = Math.floor(seeded(i) * this.W);
        const sy = Math.floor(seeded(i + 100) * (this.groundY - 6));
        const twinkle = Math.sin(now / 600 + i * 1.7) > 0.3;
        ctx.fillStyle = twinkle ? "#ffffff" : "#8fa3d6";
        ctx.fillRect(sx, sy, 1, 1);
      }
      drawMap(ctx, MOON, { m: "#f5f3ce" }, this.W - 14, 4);
    } else {
      const sunColor = phase === "day" ? "#ffd93d" : "#ffb347";
      const sunY = phase === "day" ? 3 : 10;
      drawMap(ctx, SUN, { y: sunColor }, this.W - 14, sunY);
      const cloudColor = phase === "day" ? "#ffffff" : "#ffe3e3";
      const span = this.W + 14;
      [0, 37].forEach(function (offset, i) {
        const cx = Math.floor(((now / (900 + i * 400) + offset) % span) - 12);
        drawMap(ctx, CLOUD, { w: cloudColor }, cx, 4 + i * 8);
      });
    }

    // Земля: трава и грунт с пиксельным узором
    const night = phase === "night";
    ctx.fillStyle = night ? "#2f6b3a" : "#5cbf60";
    ctx.fillRect(0, this.groundY + 1, this.W, 2);
    ctx.fillStyle = night ? "#3d2a1c" : "#8b5a2b";
    ctx.fillRect(0, this.groundY + 3, this.W, this.H - this.groundY - 3);
    for (let i = 0; i < this.W; i++) {
      if (seeded(i + 7) > 0.55) {
        ctx.fillStyle = night ? "#3f8a4b" : "#7bd67f";
        ctx.fillRect(i, this.groundY, 1, 1);
      }
      if (seeded(i + 300) > 0.7) {
        ctx.fillStyle = night ? "#2b1d14" : "#6b4220";
        ctx.fillRect(i, this.groundY + 4 + Math.floor(seeded(i + 500) * 4), 1, 1);
      }
    }
    // Цветочки
    [9, 27, 51, 64].forEach(function (fx, i) {
      ctx.fillStyle = night ? "#6d597a" : ["#ff6b9d", "#ffd93d", "#ffffff", "#c77dff"][i];
      ctx.fillRect(fx, this.groundY - 1, 1, 1);
      ctx.fillStyle = night ? "#2f6b3a" : "#3e8e41";
      ctx.fillRect(fx, this.groundY, 1, 1);
    }, this);
  };

  PetScene.prototype.update = function (now) {
    if (this.empty) return;
    const calm = this.sleeping || this.reducedMotion;

    // Блуждание по сцене
    if (!calm && now > this.nextWander) {
      this.targetX = 4 + Math.floor(Math.random() * (this.W - 24));
      this.nextWander = now + 3000 + Math.random() * 4000;
    }
    const stepEvery = this.mood === "sad" ? 260 : 140;
    if (this.x !== this.targetX && now - this.lastStep > stepEvery && !calm) {
      this.dir = this.targetX > this.x ? 1 : -1;
      this.x += this.dir;
      this.lastStep = now;
    }

    // Моргание
    if (now > this.nextBlink) {
      this.blinkUntil = now + 140;
      this.nextBlink = now + 2500 + Math.random() * 3000;
    }

    // Фоновые эффекты по настроению
    if (now > this.nextAmbient) {
      if (this.sleeping) this.spawn("zzz", 1, 4);
      else if (this.mood === "happy" && Math.random() < 0.5) this.spawn("sparkle", 1, 18);
      else if (this.mood === "sad") this.spawn("tear", 1, 6);
      this.nextAmbient = now + (this.sleeping ? 1600 : 3200 + Math.random() * 2000);
    }

    this.particles = this.particles.filter((p) => now - p.born < p.life);
  };

  PetScene.prototype.draw = function (now) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this.drawBackground(now);
    if (this.empty) return;

    const rows = SPRITES[this.species];
    let bob = 0;
    if (!this.reducedMotion) {
      const period = this.sleeping ? 1400 : this.mood === "sad" ? 900 : 500;
      bob = Math.floor(now / period) % 2;
    }
    let jump = 0;
    if (this.jumpStart >= 0) {
      const t = (now - this.jumpStart) / 420;
      if (t >= 1) this.jumpStart = -1;
      else jump = -Math.round(Math.sin(Math.PI * t) * 6);
    }

    // Тень
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    const shadowW = jump < -3 ? 10 : 14;
    ctx.fillRect(this.x + 8 - shadowW / 2, this.groundY + 1, shadowW, 1);

    const closed = this.sleeping || now < this.blinkUntil;
    drawSprite(ctx, rows, this.x, this.petY() + bob + jump, this.pal, {
      closed: closed,
      cheeks: this.mood === "happy",
      flip: this.dir < 0,
    });

    this.particles.forEach(function (p) {
      const age = now - p.born;
      if (age < 0) return;
      const px = Math.round(p.x + p.vx * age);
      const py = Math.round(p.y + p.vy * age);
      ctx.globalAlpha = age > p.life * 0.7 ? 0.5 : 1;
      drawMap(ctx, p.p.rows, p.p.colors, px, py);
      ctx.globalAlpha = 1;
    });
  };

  PetScene.prototype.frame = function (now) {
    // ~15 кадров в секунду: и экономно, и честный пиксельный ритм
    if (!this.lastFrame || now - this.lastFrame > 66) {
      this.update(now);
      this.draw(now);
      this.lastFrame = now;
    }
    requestAnimationFrame(this.frame);
  };

  PD.sprites = {
    SPRITES,
    PALETTES,
    PetScene,
    drawAvatar,
    drawSprite,
    paletteFor,
    phaseOfDay,
  };
})(window.PD);
