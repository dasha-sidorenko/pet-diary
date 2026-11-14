// Пиксельные графики на SVG: чёткие края, цвета берутся из CSS-переменных темы.
(function (PD) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => node.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(parent, x, y, value, anchor, cls) {
    const t = svg("text", { x: x, y: y, "text-anchor": anchor || "middle", class: cls || "chart-label" }, parent);
    t.textContent = value;
    return t;
  }

  function niceRange(values) {
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.15;
    return { min: Math.max(0, min - pad), max: max + pad };
  }

  // Линейный график со ступенчатыми квадратными точками (для веса)
  function lineChart(points, opts) {
    opts = opts || {};
    const W = 320;
    const H = 160;
    const L = 34;
    const R = 10;
    const T = 14;
    const B = 24;
    const root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "chart", role: "img", "shape-rendering": "crispEdges" });
    if (opts.title) svg("title", {}, root).textContent = opts.title;

    const values = points.map((p) => p.value);
    const range = niceRange(values);
    const x = (i) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
    const y = (v) => T + (1 - (v - range.min) / (range.max - range.min)) * (H - T - B);

    // Сетка
    for (let i = 0; i <= 3; i++) {
      const v = range.min + ((range.max - range.min) * i) / 3;
      const gy = Math.round(y(v));
      svg("line", { x1: L, x2: W - R, y1: gy, y2: gy, class: "chart-grid" }, root);
      text(root, L - 6, gy + 3, v.toFixed(v < 10 ? 1 : 0), "end");
    }

    // Линия «лесенкой» — как в старых играх
    let d = "";
    points.forEach(function (p, i) {
      const px = Math.round(x(i));
      const py = Math.round(y(p.value));
      if (i === 0) d += "M" + px + " " + py;
      else {
        const midX = Math.round((Math.round(x(i - 1)) + px) / 2);
        d += " H" + midX + " V" + py + " H" + px;
      }
    });
    svg("path", { d: d, class: "chart-line" }, root);

    points.forEach(function (p, i) {
      const px = Math.round(x(i));
      const py = Math.round(y(p.value));
      const dot = svg("rect", { x: px - 3, y: py - 3, width: 6, height: 6, class: "chart-dot" }, root);
      svg("title", {}, dot).textContent = p.label + ": " + p.value + (opts.unit ? " " + opts.unit : "");
      const every = Math.ceil(points.length / 6);
      if (i % every === 0 || i === points.length - 1) text(root, px, H - 8, p.short || p.label);
    });
    return root;
  }

  // Столбики из «пикселей-кирпичиков»
  function barChart(items, opts) {
    opts = opts || {};
    const W = 320;
    const H = 150;
    const T = 16;
    const B = 22;
    const root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "chart", role: "img", "shape-rendering": "crispEdges" });
    if (opts.title) svg("title", {}, root).textContent = opts.title;
    const max = Math.max(1, Math.max.apply(null, items.map((i) => i.value)));
    const slot = W / items.length;
    const barW = Math.min(28, slot * 0.6);
    const brick = 6;
    items.forEach(function (item, i) {
      const cx = slot * i + slot / 2;
      const h = Math.round(((H - T - B) * item.value) / max);
      const bricks = Math.floor(h / brick);
      for (let b = 0; b < bricks; b++) {
        svg("rect", {
          x: Math.round(cx - barW / 2),
          y: H - B - (b + 1) * brick,
          width: Math.round(barW),
          height: brick - 1,
          class: "chart-bar" + (item.highlight ? " is-highlight" : ""),
        }, root);
      }
      if (item.value > 0) text(root, cx, H - B - bricks * brick - 4, item.value, "middle", "chart-value");
      text(root, cx, H - 6, item.label);
    });
    return root;
  }

  PD.charts = { lineChart, barChart };
})(window.PD);
