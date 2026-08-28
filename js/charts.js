/* 零依赖 SVG 图表：环形图、柱状图、折线图 */
window.Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const money = v => window.UI.fmtMoney(v);
  const esc = s => window.UI.esc(s);

  function niceMax(max) {
    max = Math.max(max || 0, 1);
    const mag = Math.pow(10, Math.floor(Math.log10(max)));
    const norm = max / mag;
    let nice;
    if (norm <= 1) nice = 1;
    else if (norm <= 1.5) nice = 1.5;
    else if (norm <= 2) nice = 2;
    else if (norm <= 3) nice = 3;
    else if (norm <= 4) nice = 4;
    else if (norm <= 5) nice = 5;
    else if (norm <= 6) nice = 6;
    else if (norm <= 8) nice = 8;
    else nice = 10;
    return nice * mag;
  }

  function fmtAxis(v) {
    if (v >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    if (v >= 1000) return Math.round(v / 100) / 10 + 'k';
    return String(Math.round(v));
  }

  /* ---------- 环形图 ---------- */
  function arc(cx, cy, R, r, a0, a1, color) {
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R;
    const x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
    const x2 = cx + Math.cos(a1) * r, y2 = cy + Math.sin(a1) * r;
    const x3 = cx + Math.cos(a0) * r, y3 = cy + Math.sin(a0) * r;
    return el('path', {
      d: 'M' + x0.toFixed(2) + ',' + y0.toFixed(2) +
         ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2) +
         ' L' + x2.toFixed(2) + ',' + y2.toFixed(2) +
         ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + x3.toFixed(2) + ',' + y3.toFixed(2) + ' Z',
      fill: color
    });
  }

  function donut(container, items, opts = {}) {
    items = items.filter(i => i.value > 0); // 负值/零值不参与圆环，避免扇形故障
    const total = items.reduce((s, i) => s + i.value, 0);
    const size = opts.size || 190;
    const cx = size / 2, cy = size / 2;
    const R = size / 2 - 6, r = R * 0.6;
    const svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, class: 'chart-svg' });

    if (total <= 0) {
      svg.appendChild(el('circle', { cx, cy, r: (R + r) / 2, fill: 'none', stroke: '#ffffff', 'stroke-width': R - r }));
    } else if (items.length === 1) {
      svg.appendChild(el('circle', { cx, cy, r: (R + r) / 2, fill: 'none', stroke: items[0].color, 'stroke-width': R - r }));
    } else {
      let a0 = -Math.PI / 2;
      for (const it of items) {
        const a1 = a0 + (it.value / total) * Math.PI * 2;
        svg.appendChild(arc(cx, cy, R, r, a0, a1, it.color));
        a0 = a1;
      }
    }
    const t1 = el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', class: 'donut-total' });
    t1.textContent = money(total);
    const t2 = el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', class: 'donut-sub' });
    t2.textContent = opts.centerLabel || '合计';
    svg.appendChild(t1); svg.appendChild(t2);

    container.innerHTML = '';
    container.appendChild(svg);

    if (opts.legend !== false && items.length) {
      const leg = document.createElement('div');
      leg.className = 'donut-legend';
      for (const it of items) {
        const row = document.createElement('div');
        row.className = 'legend-item';
        row.innerHTML = '<span class="legend-dot" style="background:' + it.color + '"></span>' +
          '<span class="legend-name">' + esc(it.label) + '</span>' +
          '<span class="legend-val">' + money(it.value) + '</span>' +
          '<span class="legend-pct">' + (total > 0 ? Math.round(it.value / total * 100) : 0) + '%</span>';
        leg.appendChild(row);
      }
      container.appendChild(leg);
    }
  }

  /* ---------- 柱状图 ---------- */
  /* opts.scrollable: 横向滚动查看（显示部分内容并放大，左右滑动看其余）
     opts.onTap(it): 点击柱条回调（it = {label, value, raw}） */
  function bars(container, items, opts = {}) {
    const h = opts.height || 170;
    const max = niceMax(Math.max.apply(null, items.map(i => i.value).concat([0])));
    const padL = 36, padB = opts.labelEvery === 0 ? 8 : 22, padT = 18, padR = 6;
    const n = items.length || 1;
    /* 每根柱固定间距：scrollable 时用固定组宽放大，否则自适应 */
    const groupW = opts.scrollable ? Math.max(56, Math.floor(240 / Math.min(n, 4))) : (1000 - padL - padR) / n;
    const W = opts.scrollable ? padL + groupW * n + padR : 1000;
    const plotW = W - padL - padR, plotH = h - padT - padB;
    const barW = Math.min(30, groupW * 0.55);
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + h, class: 'chart-svg', style: 'width:' + (opts.scrollable ? Math.max(100, W / 8) : '100%') + 'px;min-width:' + (opts.scrollable ? Math.max(100, W / 8) : '100%') + 'px' });

    for (let g = 0; g <= 4; g++) {
      const y = padT + plotH - (plotH * g / 4);
      svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: '#ffffff', 'stroke-width': 1 }));
      const t = el('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', class: 'chart-axis' });
      t.textContent = fmtAxis(max * g / 4);
      svg.appendChild(t);
    }

    items.forEach((it, i) => {
      const x = padL + i * groupW + (groupW - barW) / 2;
      const bh = it.value > 0 ? Math.max(2, plotH * it.value / max) : 0;
      const y = padT + plotH - bh;
      const rect = el('rect', { x: x.toFixed(2), y: y.toFixed(2), width: barW.toFixed(2), height: bh.toFixed(2), rx: 3, fill: it.color || 'var(--primary)', class: 'chart-bar' });
      const tt = el('title');
      tt.textContent = it.label + ': ' + money(it.value);
      rect.appendChild(tt);
      if (opts.onTap) rect.addEventListener('click', () => opts.onTap(it));
      svg.appendChild(rect);
      if (n <= 15 && it.value > 0) {
        const t = el('text', { x: (x + barW / 2).toFixed(2), y: y - 4, 'text-anchor': 'middle', class: 'chart-val' });
        t.textContent = it.value >= 1000 ? (it.value / 1000).toFixed(1) + 'k' : String(Math.round(it.value));
        svg.appendChild(t);
      }
      if (opts.labelEvery !== 0 && (n <= 12 || i % Math.ceil(n / 12) === 0 || i === n - 1)) {
        const t = el('text', { x: (x + barW / 2).toFixed(2), y: h - 4, 'text-anchor': 'middle', class: 'chart-axis' });
        t.textContent = it.label;
        svg.appendChild(t);
      }
    });
    container.innerHTML = '';
    container.appendChild(svg);
    if (opts.scrollable) container.classList.add('chart-scroll');
  }

  /* ---------- 正负柱状图（结余：绿涨红跌，零线基准） ---------- */
  function bars2(container, items, opts = {}) {
    const h = opts.height || 170;
    const vals = items.map(i => i.value);
    const max = niceMax(Math.max.apply(null, vals.concat([0])));
    const min = -niceMax(Math.max.apply(null, vals.map(v => -v).concat([0])));
    const span = max - min;
    const padL = 36, padB = opts.labelEvery === 0 ? 8 : 22, padT = 12, padR = 6;
    const n = items.length || 1;
    const groupW = opts.scrollable ? Math.max(56, Math.floor(240 / Math.min(n, 4))) : (1000 - padL - padR) / n;
    const W = opts.scrollable ? padL + groupW * n + padR : 1000;
    const plotW = W - padL - padR, plotH = h - padT - padB;
    const barW = Math.min(30, groupW * 0.55);
    const y0 = padT + plotH * max / span;
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + h, class: 'chart-svg', style: 'width:' + (opts.scrollable ? Math.max(100, W / 8) : '100%') + 'px;min-width:' + (opts.scrollable ? Math.max(100, W / 8) : '100%') + 'px' });
    svg.appendChild(el('line', { x1: padL, y1: y0, x2: W - padR, y2: y0, stroke: 'var(--border)', 'stroke-width': 1 }));
    for (let g = 0; g <= 4; g++) {
      const v = min + span * g / 4;
      const y = padT + plotH - plotH * (v - min) / span;
      if (Math.abs(y - y0) < 2) continue;
      svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: '#ffffff', 'stroke-width': 1 }));
      const t = el('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', class: 'chart-axis' });
      t.textContent = fmtAxis(v);
      svg.appendChild(t);
    }
    items.forEach((it, i) => {
      const x = padL + i * groupW + (groupW - barW) / 2;
      const v = it.value;
      const bh = Math.abs(v) > 0.005 ? Math.max(2, plotH * Math.abs(v) / span) : 0;
      const y = v >= 0 ? y0 - bh : y0;
      const rect = el('rect', { x: x.toFixed(2), y: y.toFixed(2), width: barW.toFixed(2), height: bh.toFixed(2), rx: 2, fill: it.color || (v >= 0 ? 'var(--success)' : 'var(--danger)'), class: 'chart-bar' });
      const tt = el('title');
      tt.textContent = it.label + ': ' + money(it.value);
      rect.appendChild(tt);
      if (opts.onTap) rect.addEventListener('click', () => opts.onTap(it));
      svg.appendChild(rect);
      if (n <= 15 && Math.abs(v) > 0.005) {
        const t = el('text', { x: (x + barW / 2).toFixed(2), y: y - 4, 'text-anchor': 'middle', class: 'chart-val' });
        t.textContent = it.value >= 1000 ? (it.value / 1000).toFixed(1) + 'k' : String(Math.round(it.value));
        svg.appendChild(t);
      }
      if (opts.labelEvery !== 0 && (n <= 12 || i % Math.ceil(n / 12) === 0 || i === n - 1)) {
        const t = el('text', { x: (x + barW / 2).toFixed(2), y: h - 4, 'text-anchor': 'middle', class: 'chart-axis' });
        t.textContent = it.label;
        svg.appendChild(t);
      }
    });
    container.innerHTML = '';
    container.appendChild(svg);
    if (opts.scrollable) container.classList.add('chart-scroll');
  }

  /* ---------- 折线图 ---------- */
  function line(container, series, opts = {}) {
    const h = opts.height || 190;
    const labels = opts.labels || (series[0] ? series[0].values.map((_, i) => String(i + 1)) : []);
    const all = [];
    series.forEach(s => s.values.forEach(v => all.push(v)));
    const max = niceMax(Math.max.apply(null, all.concat([0])));
    const padL = 36, padB = 20, padT = 14, padR = 8;
    const n = Math.max(labels.length, 1);
    const groupW = opts.scrollable ? Math.max(64, Math.floor(260 / Math.min(n, 4))) : (1000 - padL - padR) / (n - 1 || 1);
    const W = opts.scrollable ? padL + groupW * (n - 1 || 1) + padR : 1000;
    const plotW = W - padL - padR, plotH = h - padT - padB;
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + h, class: 'chart-svg', style: 'width:' + (opts.scrollable ? Math.max(100, W / 8) : '100%') + 'px;min-width:' + (opts.scrollable ? Math.max(100, W / 8) : '100%') + 'px' });

    for (let g = 0; g <= 4; g++) {
      const y = padT + plotH - (plotH * g / 4);
      svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: '#ffffff', 'stroke-width': 1 }));
      const t = el('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', class: 'chart-axis' });
      t.textContent = fmtAxis(max * g / 4);
      svg.appendChild(t);
    }

    const xAt = i => padL + (n === 1 ? plotW / 2 : plotW * i / (n - 1));
    const yAt = v => padT + plotH - plotH * v / max;

    series.forEach(s => {
      let d = '';
      s.values.forEach((v, i) => {
        const x = xAt(i), y = yAt(v);
        d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
      });
      svg.appendChild(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      s.values.forEach((v, i) => {
        const c = el('circle', { cx: xAt(i).toFixed(1), cy: yAt(v).toFixed(1), r: 3.5, fill: s.color, class: 'chart-dot' });
        const tt = el('title');
        tt.textContent = (labels[i] || '') + ' ' + s.name + ': ' + money(v);
        c.appendChild(tt);
        if (opts.onTap) c.addEventListener('click', () => opts.onTap({ label: labels[i] || '', value: v, name: s.name }));
        svg.appendChild(c);
      });
    });

    labels.forEach((lb, i) => {
      if (n <= 12 || i % Math.ceil(n / 12) === 0 || i === n - 1) {
        const t = el('text', { x: xAt(i).toFixed(1), y: h - 4, 'text-anchor': 'middle', class: 'chart-axis' });
        t.textContent = lb;
        svg.appendChild(t);
      }
    });

    container.innerHTML = '';
    container.appendChild(svg);
    if (opts.scrollable) container.classList.add('chart-scroll');

    if (opts.legend !== false && series.length) {
      const leg = document.createElement('div');
      leg.className = 'donut-legend';
      series.forEach(s => {
        const row = document.createElement('div');
        row.className = 'legend-item';
        row.innerHTML = '<span class="legend-dot" style="background:' + s.color + '"></span><span class="legend-name">' + esc(s.name) + '</span>';
        leg.appendChild(row);
      });
      container.appendChild(leg);
    }
  }

  return { donut, bars, bars2, line };
})();
