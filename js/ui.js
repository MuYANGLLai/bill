/* UI 工具：格式化、日期、弹窗、确认框、Toast */
window.UI = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtMoney = n => {
    const neg = n < 0;
    const v = Math.abs(n || 0);
    const s = v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + '¥' + s;
  };

  const pad = n => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const monthKey = (y, m) => y + '-' + pad(m);
  const parseMonthKey = k => { const [y, m] = k.split('-').map(Number); return { y, m }; };
  const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const fmtDateCn = s => { const [y, m, d] = s.split('-').map(Number); return m + '月' + d + '日'; };
  const fmtMonthCn = k => { const { y, m } = parseMonthKey(k); return y + '年' + m + '月'; };
  const weekday = s => '周' + '日一二三四五六'[new Date(s + 'T00:00:00').getDay()];

  const hexToRgba = (hex, a) => {
    let h = String(hex || '#adb5bd').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return 'rgba(173,181,189,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  /* 分类/账户图标：上传图片（dataURL）→ img；支付品牌（payIcons）→ 色块；线条 SVG；否则 emoji/文本 */
  function catIcon(icon) {
    const key = String(icon || '');
    if (key.indexOf('data:image') === 0) return '<img class="ico-img" src="' + key + '" alt="">';
    const pay = window.Preset.payIcons.find(p => p.v === key);
    if (pay) return '<span class="pay-brand" style="background:' + pay.bg + '">' + pay.t + '</span>';
    const paths = window.Preset.lineIcons[key];
    if (paths) {
      return '<svg class="line-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
    }
    return esc(key || '📦');
  }

  /* 功能 UI 线条图标（key 命中 uiIcons，size 可指定像素） */
  function icon(key, size) {
    const paths = window.Preset.uiIcons[key];
    if (!paths) return '';
    const attrs = size
      ? 'width="' + size + '" height="' + size + '"'
      : 'class="line-ico"';
    return '<svg ' + attrs + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  /* ============ 中文金额解析（语音 / OCR 共用） ============ */
  const CN_DIGITS = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };

  function cnInt(s) {
    if (!s) return NaN;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    let total = 0, section = 0, num = 0;
    for (const ch of s) {
      if (CN_DIGITS[ch] !== undefined) num = CN_DIGITS[ch];
      else if (ch === '十') { section += (num || 1) * 10; num = 0; }
      else if (ch === '百') { section += (num || 1) * 100; num = 0; }
      else if (ch === '千') { section += (num || 1) * 1000; num = 0; }
      else if (ch === '万') { total += (section + num) * 10000; section = 0; num = 0; }
      else if (ch === '亿') { total = (total + section + num) * 100000000; section = 0; num = 0; }
      else return NaN;
    }
    return total + section + num;
  }

  function cnNum(s) {
    if (!s) return NaN;
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    if (s.includes('点')) {
      const parts = s.split('点');
      let frac = 0;
      for (let i = 0; i < parts[1].length; i++) {
        const d = CN_DIGITS[parts[1][i]] !== undefined ? CN_DIGITS[parts[1][i]] : parseInt(parts[1][i], 10);
        if (!isNaN(d)) frac += d * Math.pow(10, -(i + 1));
      }
      const base = cnInt(parts[0]);
      return isNaN(base) ? NaN : base + frac;
    }
    return cnInt(s);
  }

  const cnDigitOrNum = s => (CN_DIGITS[s] !== undefined ? CN_DIGITS[s] : parseInt(s, 10));

  /* 把「十二块五」「35元」「五毛」「一百二十三元」「12.5」解析为数字 */
  function parseCnAmount(s) {
    if (!s) return NaN;
    s = String(s).replace(/[，,、\s]/g, '').trim();
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    let m;
    // X块/元/圆 [Y毛] [Z分]
    m = /^([零〇一二两三四五六七八九十百千万亿\d]+(?:点[零〇一二三四五六七八九\d]*)?)(?:块|元|圆)\s*([零〇一二三四五六七八九\d]+)?(?:\s*(?:毛|角)\s*([零〇一二三四五六七八九\d]+)?)?(?:\s*分\s*([零〇一二三四五六七八九\d]+)?)?$/.exec(s);
    if (m) {
      const base = cnNum(m[1]);
      const jiao = m[2] ? cnDigitOrNum(m[2]) : 0;
      const fen = m[3] ? cnDigitOrNum(m[3]) : (m[4] ? cnDigitOrNum(m[4]) : 0);
      const v = (isNaN(base) ? 0 : base) + (isNaN(jiao) ? 0 : jiao) / 10 + (isNaN(fen) ? 0 : fen) / 100;
      return Math.round(v * 100) / 100;
    }
    // Y毛/角 [Z分]
    m = /^([零〇一二三四五六七八九\d]+)(?:毛|角)\s*([零〇一二三四五六七八九\d]+)?分?$/.exec(s);
    if (m) {
      const jiao = cnDigitOrNum(m[1]);
      const fen = m[2] ? cnDigitOrNum(m[2]) : 0;
      const v = (isNaN(jiao) ? 0 : jiao) / 10 + (isNaN(fen) ? 0 : fen) / 100;
      return Math.round(v * 100) / 100;
    }
    // Z分
    m = /^([零〇一二三四五六七八九\d]+)分$/.exec(s);
    if (m) return Math.round((cnDigitOrNum(m[1]) || 0) / 100 * 100) / 100;
    return NaN;
  }

  /* 从一段话/一段文字中提取金额、收支类型、分类 */
  function parseBillText(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const type = /收入|工资|进账|收到|收款|入账|红包|奖金|报销|理财收益/.test(t) ? 'income' : 'expense';
    const catMap = [
      ['餐饮', /早餐|午饭|晚饭|午餐|晚餐|吃饭|外卖|奶茶|咖啡|火锅|烧烤|餐厅|食堂|夜宵|小吃|吃面|喝/],
      ['交通', /打车|地铁|公交|加油|停车|火车|高铁|机票|过路费|骑车|共享单车/],
      ['购物', /淘宝|京东|拼多多|网购|下单|超市|商场|买菜|便利店|购物/],
      ['居住', /房租|水电|物业|燃气|宽带/],
      ['娱乐', /电影|游戏|唱|KTV|演出|门票|球赛|娱乐/],
      ['医疗', /药|医院|看病|诊所|挂号|体检/],
      ['教育', /学费|培训|课程|书本|买书|补习/],
      ['旅行', /酒店|机票|旅行|旅游|民宿/],
      ['人情', /红包|礼物|请客|随礼/],
      ['通讯', /话费|流量|手机费/],
      ['服饰', /衣服|裤子|鞋|连衣裙|外套|衬衫/],
      ['工资', /工资|薪水|发薪/],
      ['奖金', /奖金/],
      ['理财', /理财|收益/],
      ['报销', /报销/]
    ];
    let categoryName = null;
    for (const pair of catMap) if (pair[1].test(t)) { categoryName = pair[0]; break; }

    const cands = [];
    const re1 = /([零〇一二两三四五六七八九十百千万亿\d]+(?:点[零〇一二三四五六七八九\d]*)?)\s*(块|元|圆)\s*([零〇一二三四五六七八九\d]+)?(?:\s*(?:毛|角)\s*([零〇一二三四五六七八九\d]+)?)?(?:\s*分\s*([零〇一二三四五六七八九\d]+)?)?|([零〇一二三四五六七八九\d]+)\s*(?:毛|角)(?:\s*([零〇一二三四五六七八九\d]+)\s*分)?|([零〇一二三四五六七八九\d]+)\s*分/g;
    let m;
    while ((m = re1.exec(t))) {
      let v = NaN;
      if (m[2]) {
        const base = m[1] ? cnNum(m[1]) : 0;
        const jiao = m[3] ? cnDigitOrNum(m[3]) : 0;
        const fen = m[4] ? cnDigitOrNum(m[4]) : (m[5] ? cnDigitOrNum(m[5]) : 0);
        v = (isNaN(base) ? 0 : base) + (isNaN(jiao) ? 0 : jiao) / 10 + (isNaN(fen) ? 0 : fen) / 100;
      } else if (m[6]) {
        const jiao = cnDigitOrNum(m[6]);
        const fen = m[7] ? cnDigitOrNum(m[7]) : 0;
        v = (isNaN(jiao) ? 0 : jiao) / 10 + (isNaN(fen) ? 0 : fen) / 100;
      } else if (m[8]) {
        v = (cnDigitOrNum(m[8]) || 0) / 100;
      }
      if (!isNaN(v)) cands.push({ v: Math.round(v * 100) / 100, idx: m.index, kw: moneyKwNear(t, m.index) });
    }
    const re3 = /(\d+(?:\.\d+)?)/g;
    while ((m = re3.exec(t))) cands.push({ v: Math.round(parseFloat(m[1]) * 100) / 100, idx: m.index, kw: moneyKwNear(t, m.index) });
    if (!cands.length) return null;
    cands.sort((a, b) => (b.kw - a.kw) || (b.v - a.v));
    return { amount: cands[0].v, type, categoryName };
  }

  function moneyKwNear(t, idx) {
    const win = t.slice(Math.max(0, idx - 6), idx + 6);
    return /合计|共计|总额|金额|支付|花费|付款|小计|总计|共|花了|用了|消费|实收|实付|应收|应付/.test(win) ? 1 : 0;
  }

  const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* ---------- Toast ---------- */
  function toast(msg, type = 'ok') {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const t = el('<div class="toast toast-' + type + '">' + esc(msg) + '</div>');
    root.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2200);
  }

  /* ---------- Modal ---------- */
  function modal(title, bodyHtml) {
    const root = document.getElementById('modal-root');
    const box = el(
      '<div class="modal-overlay"><div class="modal-card" role="dialog">' +
      '<div class="modal-head"><div class="modal-title">' + esc(title) + '</div>' +
      '<button class="modal-x" data-action="modal-close">✕</button></div>' +
      '<div class="modal-body">' + bodyHtml + '</div></div></div>'
    );
    root.appendChild(box);
    const handle = { box, close };
    function close() { box.remove(); if (window.App && App.state.modal === handle) App.state.modal = null; }
    box.addEventListener('click', e => { if (e.target === box) close(); });
    if (window.App) App.state.modal = handle;
    return handle;
  }

  /* ---------- Confirm ---------- */
  function confirm(msg, opts = {}) {
    return new Promise(resolve => {
      const m = modal('确认操作',
        '<div class="confirm-text">' + msg + '</div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-action="modal-cancel">取消</button>' +
        '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-action="modal-ok">确定</button></div>'
      );
      const box = m.box;
      box.querySelector('[data-action="modal-cancel"]').addEventListener('click', () => { m.close(); resolve(false); });
      box.querySelector('[data-action="modal-ok"]').addEventListener('click', () => { m.close(); resolve(true); });
    });
  }

  return {
    esc, fmtMoney, pad, todayStr, nowTime, monthKey, parseMonthKey, daysInMonth,
    fmtDateCn, fmtMonthCn, weekday, hexToRgba, el, toast, modal, confirm,
    parseCnAmount, parseBillText, catIcon, icon
  };
})();
