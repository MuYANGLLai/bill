/* 视图层：渲染各页面到 #view */
window.Views = (() => {
  const $ = id => document.getElementById(String(id).replace(/^#/, ''));
  const esc = UI.esc;
  const money = UI.fmtMoney;
  const S = () => App.state;
  /* 分类图标颜色开关：false = 图标全部黑色 */
  const iconColorOn = () => !!(Store.data.settings && Store.data.settings.catIconColor);
  const iconStyle = color => (iconColorOn() ? ' style="color:' + color + '"' : '');

  const emptyHTML = (ico, msg) => '<div class="empty"><span class="empty-ico">' + ico + '</span>' + msg + '</div>';

  function statCard(label, val, cls) {
    return '<div class="stat-card"><div class="stat-label">' + label + '</div><div class="stat-val ' + (cls || '') + '">' + val + '</div></div>';
  }

  function catOfId(id) { const c = Store.getCategory(id); return c || { name: '未分类', icon: 'box', color: '#adb5bd' }; }
  function typeLabel(t) { return t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账'; }

  /* 欢迎语：按时段问候 + 心灵鸡汤（无 emoji） */
  const QUOTES_MORNING = [
    '一日之计在于晨，记下今天的第一笔',
    '美好的一天，从清楚的账目开始',
    '早起的人，连账本都是清醒的',
    '今天的你，比昨天更懂生活',
    '按时记账，让日子有迹可循'
  ];
  const QUOTES_DAY = [
    '每一笔记录，都是认真生活的证据',
    '会记账的人，运气不会太差',
    '收支分明，心里不慌',
    '小账本，大智慧',
    '把日子过明白，从记好每一笔开始'
  ];
  const QUOTES_EVENING = [
    '今天辛苦了，把账记好再休息吧',
    '复盘今天的收支，明天会更从容',
    '晚安前记一笔，安心入睡',
    '积少成多，坚持记账的你很棒',
    '花出去的钱有迹可循，赚到的更有底气'
  ];
  const QUOTES_NIGHT = [
    '夜深了，记得给今天的账本画个句号',
    '早点休息，明天继续加油',
    '记账是为了更好的明天',
    '每一分钱都值得被认真对待',
    '夜深人静，最适合理理账目'
  ];
  function greet() {
    const h = new Date().getHours();
    const list = h < 6 ? QUOTES_NIGHT : h < 11 ? QUOTES_MORNING : h < 14 ? QUOTES_DAY : h < 18 ? QUOTES_DAY : QUOTES_EVENING;
    return list[Math.floor(Math.random() * list.length)];
  }

  function addDaysStr(s, n) {
    const d = new Date(s + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + UI.pad(d.getMonth() + 1) + '-' + UI.pad(d.getDate());
  }

  function weekLabel(ws, we) {
    const y = new Date().getFullYear();
    const a = ws.split('-').map(Number), b = we.split('-').map(Number);
    const head = a[0] !== y ? a[0] + '年' : '';
    if (a[0] === b[0] && a[1] === b[1]) return head + a[1] + '月' + a[2] + '日 - ' + b[2] + '日';
    return head + a[1] + '月' + a[2] + '日 - ' + b[1] + '月' + b[2] + '日';
  }

  /* ================= 首页 ================= */
  function home() {
    const v = $('#view');
    const { y, m } = UI.parseMonthKey(S().month);
    const st = Store.monthStats(y, m);
    /* 首页预算：跟随「月预算」，显示当前月 */
    const bStat = Store.budgetStatus('month', S().month);
    const bPct = bStat.total.budget > 0 ? Math.min(100, Math.round(bStat.total.used / bStat.total.budget * 100)) : 0;
    const remain = Math.round((bStat.total.budget - bStat.total.used) * 100) / 100;
    const daysLeft = Math.max(0, UI.daysInMonth(y, m) - new Date().getDate() + 1);
    const dailyAvail = daysLeft > 0 ? Math.round(remain / daysLeft * 100) / 100 : 0;

    const dueRecs = Store.dueRecurrings(UI.todayStr());

    /* 明细框数据：按 全部/年/月/周 过滤 */
    const bp = S().billPeriod || 'month';
    let boxTxs, boxLabel;
    if (bp === 'all') {
      boxTxs = Store.getTransactions();
      boxLabel = '全部账单';
    } else if (bp === 'year') {
      boxTxs = Store.getTransactions({ from: S().billYear + '-01-01', to: S().billYear + '-12-31' });
      boxLabel = S().billYear + ' 年';
    } else if (bp === 'week') {
      const ws = S().billWeekStart;
      boxTxs = Store.getTransactions({ from: ws, to: addDaysStr(ws, 6) });
      boxLabel = weekLabel(ws, addDaysStr(ws, 6));
    } else {
      boxTxs = Store.getTransactions({ year: y, month: m });
      boxLabel = UI.fmtMonthCn(S().month);
    }
    /* 类型过滤：点资产卡「收入/支出」跳转 */
    const bType = S().billType || 'all';
    if (bType !== 'all') boxTxs = boxTxs.filter(t => t.type === bType);
    const boxTotal = boxTxs.length;
    /* 分页加载：首屏/切换条件后显示 billMore 条，点「加载更多」追加 */
    const moreN = S().billMore || 100;
    const showN = Math.min(moreN, boxTotal);
    const shownTxs = boxTxs.slice(0, showN);
    let bInc = 0, bExp = 0;
    shownTxs.forEach(t => { if (t.excludeStats) return; if (t.type === 'income') bInc += t.amount; else if (t.type === 'expense') bExp += t.amount; });
    const groups = {};
    shownTxs.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
    const dates = Object.keys(groups).sort().reverse();
    const dailySum = d => {
      let e = 0, i = 0;
      groups[d].forEach(t => { if (t.type === 'expense') e += t.amount; else if (t.type === 'income') i += t.amount; });
      return { e, i };
    };
    const hasMore = showN < boxTotal;

    v.innerHTML =
      '<div class="page">' +
        '<div class="hello">' +
          '<div class="hello-top">' +
            '<div class="hello-date">' +
              '<span class="hello-day">' + UI.todayStr().slice(5, 7) + '月' + UI.todayStr().slice(8, 10) + '日 ' + UI.weekday(UI.todayStr()) + '</span>' +
              '<span class="hello-time">' + UI.nowTime() + '</span>' +
            '</div>' +
            '<button class="btn btn-ghost btn-sm" data-action="open-search" aria-label="搜索">' + UI.icon('search', 18) + '</button>' +
          '</div>' +
          '<h1>' + greet() + '</h1>' +
        '</div>' +
        (dueRecs.length
          ? '<div class="card rec-due">' +
              '<div class="card-title"><span>' + UI.icon('calendar', 16) + ' 周期账单待入账（' + dueRecs.length + ' 条）</span>' +
              '<button class="btn btn-ghost btn-sm" data-action="nav" data-nav="/settings">去处理 →</button></div>' +
              dueRecs.map(r => {
                const c = catOfId(r.categoryId);
                return '<div class="rec-due-row">' +
                  '<span class="rec-ico sm"' + iconStyle(c.color) + '>' + UI.catIcon(c.icon) + '</span>' +
                  '<span class="rec-main"><span class="rec-name">' + esc(r.name) + '</span>' +
                  '<span class="rec-sub">' + UI.fmtDateCn(r.nextDate) + ' · ' + (r.type === 'expense' ? '支出' : '收入') + ' ' + money(r.amount) + '</span></span>' +
                  '<span class="rec-due-actions">' +
                    '<button class="btn btn-primary btn-sm" data-action="process-rec" data-val="' + r.id + '">记一笔</button>' +
                    '<button class="btn btn-ghost btn-sm" data-action="skip-rec" data-val="' + r.id + '">跳过</button>' +
                  '</span>' +
                '</div>';
              }).join('') +
            '</div>'
          : '') +
        /* 资产卡：淡绿主题，仅收入/支出/结余 + 预算（无净资产） */
        '<div class="card assets-card">' +
          '<div class="assets-stats">' +
            '<button class="as-item" data-action="bill-type" data-val="income"><div class="as-label">收入</div><div class="as-val as-income">' + money(st.income) + '</div></button>' +
            '<button class="as-item" data-action="bill-type" data-val="expense"><div class="as-label">支出</div><div class="as-val as-expense">' + money(st.expense) + '</div></button>' +
            '<div class="as-item"><div class="as-label">结余</div><div class="as-val ' + (st.balance >= 0 ? 'as-income' : 'as-expense') + '">' + money(st.balance) + '</div></div>' +
          '</div>' +
          '<div class="assets-budget">' +
            '<div class="assets-budget-head"><span>本月预算</span>' +
              '<button class="btn btn-ghost btn-sm" data-action="nav" data-nav="/budget">管理 →</button></div>' +
            (bStat.total.budget > 0
              ? '<div class="progress assets-progress' + (bPct >= 100 ? ' danger' : bPct >= 80 ? ' warn' : '') + '"><i style="width:' + bPct + '%"></i></div>' +
                '<div class="assets-budget-meta">' +
                  '<span>已用 ' + money(bStat.total.used) + '（' + bPct + '%）</span>' +
                  '<span>剩余 ' + money(remain) + '</span>' +
                  '<span>日均可用 ' + money(dailyAvail) + '</span>' +
                '</div>'
              : '<div class="assets-budget-empty"><span>尚未设置预算</span>' +
                  '<button class="btn btn-ghost btn-sm" data-action="nav" data-nav="/budget">去设置</button></div>') +
          '</div>' +
        '</div>' +
        /* 记一笔：资产卡与账单明细中间 */
        '<div class="go-record-bar">' +
          '<button class="btn btn-primary btn-lg btn-block btn-macaron" data-action="go-record">＋ 记一笔</button>' +
        '</div>' +
        /* 明细框（透明无边框） */
        '<div class="card bill-card" id="bill-box">' +
          '<div class="bill-head-row">' +
            '<span class="bill-title">' + UI.icon('list', 15) + ' 账单明细</span>' +
            (bType !== 'all'
              ? '<button class="btn btn-ghost btn-sm" data-action="bill-type" data-val="all">✕ ' + (bType === 'income' ? '仅收入' : '仅支出') + '</button>'
              : '') +
            '<div class="bill-ctl">' +
              '<button class="btn btn-ghost btn-sm" data-action="bill-cycle" data-d="-1">‹</button>' +
              '<span class="bill-cycle-label">' + ({ all: '全部', year: '年', month: '月' }[bp] || '月') + '</span>' +
              '<button class="btn btn-ghost btn-sm" data-action="bill-cycle" data-d="1">›</button>' +
            '</div>' +
            (bp !== 'all'
              ? '<div class="bill-ctl">' +
                  '<button class="btn btn-ghost btn-sm" data-action="month-prev">‹</button>' +
                  '<button class="month-label" data-action="month-today">' + boxLabel + '</button>' +
                  '<button class="btn btn-ghost btn-sm" data-action="month-next">›</button>' +
                '</div>'
              : '') +
          '</div>' +
          '<div class="list-summary" style="padding:2px 0 8px">' +
            '<span>收入 <b class="v-green">' + money(bInc) + '</b></span>' +
            '<span>支出 <b class="v-red">' + money(bExp) + '</b></span>' +
            '<span>' + (hasMore ? '显示 ' + showN + ' / 共 ' + boxTotal : '共 ' + boxTotal) + ' 笔</span>' +
          '</div>' +
          (dates.length === 0
            ? emptyHTML('📭', '这段时间还没有账单<br>点上方「记一笔」开始记录吧～')
            : dates.map(d =>
                '<div class="tx-group flat">' +
                  '<div class="tx-group-head"><span>' + UI.fmtDateCn(d) + ' ' + UI.weekday(d) + '</span><span>支出 ' + money(dailySum(d).e) + ' · 收入 ' + money(dailySum(d).i) + '</span></div>' +
                  groups[d].map(txRow).join('') +
                '</div>'
              ).join('')) +
          (hasMore
            ? '<button class="btn btn-ghost btn-block bill-more" data-action="bill-more">加载更多账单（' + (boxTotal - showN) + ' 条）</button>'
            : '') +
        '</div>' +
        /* 文字记账：右下角圆形浮动入口（主菜单上方），可在设置→功能管理关闭 */
        ((Store.data.settings.funcs && Store.data.settings.funcs.homeTextBill === false) ? '' :
        '<button class="fab-text-bill" data-action="text-bill" aria-label="文字记账">' +
          '<span class="fab-text-ico">' + UI.icon('pencil', 22) + '</span>' +
          '<span class="fab-text-label">文字记账</span>' +
        '</button>') +
      '</div>';
  }

  /* ================= 记一笔 / 编辑 ================= */
  function renderRecCats() {
    const box = $('#rec-cats');
    const st = S().record;
    if (!box || st.type === 'transfer') { if (box) box.innerHTML = ''; return; }
    const cats = Store.getRootCategoriesSorted(st.type); // 按排序配置（手动/频率 + 正反序）
    const activeRoot = activeRootId();
    box.innerHTML = '<div class="cat-grid">' + cats.map(c =>
      '<button class="cat-item ' + (c.id === activeRoot ? 'active' : '') + '" style="--cat-color:' + c.color + ';--cat-tint:' + UI.hexToRgba(c.color, 0.13) + '" data-action="pick-cat" data-val="' + c.id + '">' +
      '<span class="cat-ico"' + iconStyle(c.color) + '>' + UI.catIcon(c.icon) + '</span><span class="cat-name">' + esc(c.name) + '</span></button>'
    ).join('') + '</div>';
  }

  /* 当前选中的一级分类（若选中的是二级则取其父级） */
  function activeRootId() {
    const st = S().record;
    const c = Store.getCategory(st.categoryId);
    return c && c.parentId ? c.parentId : st.categoryId;
  }

  /* 一级分类下方滑出的二级分类条 */
  function renderRecSubs() {
    const box = $('#rec-subs');
    if (!box) return;
    const st = S().record;
    if (st.type === 'transfer') { box.className = 'rec-subs'; box.innerHTML = ''; return; }
    const rootId = activeRootId();
    const subs = Store.getSubCategoriesSorted(rootId); // 按排序配置（手动/频率 + 正反序）
    if (!rootId || !subs.length) { box.className = 'rec-subs'; box.innerHTML = ''; return; }
    const chip = (id, icon, name, active) =>
      '<button class="sub-chip' + (active ? ' active' : '') + '" data-action="pick-sub" data-val="' + id + '">' +
        '<span class="sub-ico">' + UI.catIcon(icon) + '</span><span class="sub-name">' + esc(name) + '</span>' +
      '</button>';
    box.className = 'rec-subs open';
    box.innerHTML =
      '<div class="rec-subs-inner">' +
        subs.map(s => chip(s.id, s.icon, s.name, st.categoryId === s.id)).join('') +
      '</div>';
  }

  function renderRecAccs() {
    const box = $('#rec-accs');
    if (!box) return;
    const st = S().record;
    if (st.type !== 'transfer') { box.innerHTML = ''; return; }
    const accs = Store.getAccounts();
    const opts = accs.map(a => ({ value: a.id, label: a.name }));
    const sel = (id, selected) => '<select id="' + id + '">' + opts.map(o => '<option value="' + o.value + '"' + (o.value === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
    box.innerHTML = '<div class="rec-acc-row">' +
      '<div class="field"><label>转出账户</label>' + sel('rec-from', st.from || (accs[0] ? accs[0].id : '')) + '</div>' +
      '<div class="transfer-arrow">→</div>' +
      '<div class="field"><label>转入账户</label>' + sel('rec-to', st.to || (accs[1] ? accs[1].id : (accs[0] ? accs[0].id : ''))) + '</div>' +
    '</div>';
  }

  /* 账户选择弹窗（显示真实账户图标/颜色） */
  function openRecAccModal() {
    const st = S().record;
    const accs = Store.getAccounts();
    UI.modal('选择账户',
      accs.map(a =>
        '<button class="acc-pick-row' + (a.id === st.accountId ? ' active' : '') + '" data-action="pick-acc" data-val="' + a.id + '">' +
          '<span class="acc-mini" style="background:' + (a.color && a.color !== 'transparent' ? a.color : 'var(--border-soft)') + '">' + UI.catIcon(a.icon) + '</span>' +
          '<span class="rec-meta-txt">' + esc(a.name) + '</span>' +
          (a.hidden ? ' <em class="acc-hidden">已隐藏</em>' : '') +
        '</button>'
      ).join('') +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">取消</button></div>');
  }

  /* 时间（日期+时间）弹窗：上方日历选日期，下方闹钟式滚轮选时间 */
  function dtInit() {
    const st = S().record;
    const d = st.date ? new Date(st.date + 'T00:00:00') : new Date();
    const t = st.time || UI.nowTime();
    const [h, m] = t.split(':').map(Number);
    S().dt = {
      month: UI.monthKey(d.getFullYear(), d.getMonth() + 1),
      date: st.date || UI.todayStr(),
      h: isNaN(h) ? new Date().getHours() : h,
      m: isNaN(m) ? new Date().getMinutes() : m
    };
  }

  function dtCalHTML() {
    const dt = S().dt;
    const { y, m } = UI.parseMonthKey(dt.month);
    const daysIn = UI.daysInMonth(y, m);
    const startWeekday = new Date(y, m - 1, 1).getDay();
    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += '<div class="cal-cell cal-empty"></div>';
    for (let d = 1; d <= daysIn; d++) {
      const date = y + '-' + UI.pad(m) + '-' + UI.pad(d);
      cells += '<button class="cal-cell dt-cell' + (date === dt.date ? ' cal-sel' : '') + '" data-action="dt-pick-day" data-val="' + date + '">' +
        '<span class="cal-day">' + d + '</span></button>';
    }
    return '<div class="dt-cal-head">' +
      '<button class="btn btn-ghost btn-sm" data-action="dt-month" data-d="-1">‹</button>' +
      '<span class="dt-cal-label">' + UI.fmtMonthCn(dt.month) + '</span>' +
      '<button class="btn btn-ghost btn-sm" data-action="dt-month" data-d="1">›</button>' +
    '</div>' +
    '<div class="cal-week">' + ['日', '一', '二', '三', '四', '五', '六'].map(w => '<span>' + w + '</span>').join('') + '</div>' +
    '<div class="cal-grid dt-grid">' + cells + '</div>';
  }

  function renderDt() {
    const box = $('#dt-box');
    if (!box) return;
    const dt = S().dt;
    box.innerHTML = dtCalHTML() +
      '<div class="dt-time">' +
        '<div class="dt-col"><span class="dt-unit">时</span>' +
          '<button class="dt-spin" data-action="dt-spin" data-col="h" data-d="1">＋</button>' +
          '<div class="dt-val" id="dt-h">' + UI.pad(dt.h) + '</div>' +
          '<button class="dt-spin" data-action="dt-spin" data-col="h" data-d="-1">−</button></div>' +
        '<span class="dt-colon">:</span>' +
        '<div class="dt-col"><span class="dt-unit">分</span>' +
          '<button class="dt-spin" data-action="dt-spin" data-col="m" data-d="1">＋</button>' +
          '<div class="dt-val" id="dt-m">' + UI.pad(dt.m) + '</div>' +
          '<button class="dt-spin" data-action="dt-spin" data-col="m" data-d="-1">−</button></div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">取消</button>' +
      '<button class="btn btn-primary" data-action="save-rec-time">确定</button></div>';
  }

  function openRecTimeModal() {
    dtInit();
    UI.modal('时间', '<div id="dt-box"></div>');
    renderDt();
  }

  function record(id) {
    const v = $('#view');
    const st = S().record;
    const prefill = st._prefill === true;
    st._prefill = false;
    st.editId = id || null;
    if (!prefill) {
      st.date = null; st.time = null; st.merchant = null; st.note = null;
      st.discountOn = false; st.discountOrig = '0'; st.discountDisc = '0'; st.discountTarget = 'orig';
      st.excludeStats = false; st.excludeBudget = false; st.attrPanel = false; st.attachments = [];
    }

    let tx = null;
    if (id) {
      tx = Store.getTransaction(id);
      if (tx) {
        st.type = tx.type;
        st.categoryId = tx.categoryId;
        st.amount = String(tx.amount);
        st.accountId = tx.accountId;
        st.from = tx.type === 'transfer' ? tx.accountId : null;
        st.to = tx.type === 'transfer' ? tx.toAccountId : null;
        st.date = tx.date;
        st.time = tx.time || '';
        st.discountOn = !!(tx.originalPrice && tx.originalPrice > 0);
        st.discountOrig = tx.originalPrice ? String(tx.originalPrice) : '0';
        st.discountDisc = tx.discount ? String(tx.discount) : '0';
        st.discountFinal = tx.originalPrice && tx.discount !== undefined
          ? String(Math.round(Math.max(0, tx.originalPrice - (tx.discount || 0)) * 100) / 100)
          : '0';
        st.discountTarget = 'orig';
        st.discT = { orig: tx.originalPrice ? 1 : 0, disc: tx.discount ? 2 : 0, final: tx.originalPrice ? 3 : 0 };
        st.excludeStats = !!tx.excludeStats;
        st.excludeBudget = !!tx.excludeBudget;
        st.attachments = tx.attachments || [];
        st.note = tx.note || '';
        st.merchant = tx.merchant || '';
        st.attrPanel = st.excludeStats || st.excludeBudget;
      }
    } else {
      st.type = st.type || 'expense';
      st.from = null; st.to = null;
      if (st.type !== 'transfer') {
        if (!st.accountId) st.accountId = Store.getAccounts()[0] ? Store.getAccounts()[0].id : null;
        if (!st.categoryId || !Store.getCategory(st.categoryId)) st.categoryId = null;
      }
    }
    if (st.type !== 'transfer' && !st.categoryId) {
      /* 默认分类：按排序配置后的第一个 */
      const cats = Store.getRootCategoriesSorted(st.type);
      st.categoryId = cats.length ? cats[0].id : null;
    }

    const noteVal = st.note || '';

    v.innerHTML =
      '<div class="page page-record">' +
        '<div class="page-head"><h1>' + (id ? '编辑账单' : '记一笔') + '</h1>' +
          (id ? '<button class="btn btn-danger btn-sm" data-action="del-tx">删除</button>' : '') +
        '</div>' +
        '<div class="record-scroll">' +
          '<div class="seg">' +
            '<button class="seg-btn ' + (st.type === 'expense' ? 'active' : '') + '" data-action="rec-type" data-val="expense">支出</button>' +
            '<button class="seg-btn ' + (st.type === 'income' ? 'active' : '') + '" data-action="rec-type" data-val="income">收入</button>' +
            '<button class="seg-btn ' + (st.type === 'transfer' ? 'active' : '') + '" data-action="rec-type" data-val="transfer">转账</button>' +
          '</div>' +
          '<div id="rec-cats"></div>' +
          '<div id="rec-subs"></div>' +
          '<div id="rec-accs"></div>' +
          '<div class="rec-tools">' +
            '<button class="btn btn-ghost btn-sm" data-action="rec-add-cat">' + UI.icon('plus', 15) + ' 新分类</button>' +
            '<button class="btn btn-ghost btn-sm" data-action="text-bill">' + UI.icon('pencil', 15) + ' 文字记账</button>' +
          '</div>' +
        '</div>' +
        '<div class="record-keypad">' +
          /* 历史备注联想栏（备注框上方） */
          '<div class="rec-note-history" id="rec-note-history" style="display:none">' +
            '<div class="rec-note-history-head"></div>' +
            '<div class="rec-note-history-list"></div>' +
          '</div>' +
          '<div class="rec-note-amt">' +
            '<textarea id="rec-note" rows="2" placeholder="备注（支持多行）…">' + esc(noteVal) + '</textarea>' +
            '<div class="amount-box amount-sm' + (st.type === 'income' ? ' amt-income' : st.type === 'expense' ? ' amt-expense' : '') + '"><span class="amount-cur">¥</span><span id="rec-amount">' + esc(st.amount) + '</span></div>' +
          '</div>' +
          '<div class="rec-fn-row" id="rec-fn-row"></div>' +
          '<div id="rec-panels"></div>' +
          '<div class="keypad">' +
            '<button class="key key-num" data-action="key" data-key="7">7</button>' +
            '<button class="key key-num" data-action="key" data-key="8">8</button>' +
            '<button class="key key-num" data-action="key" data-key="9">9</button>' +
            '<button class="key key-op" data-action="key" data-key="/">÷</button>' +
            '<button class="key key-func" data-action="key" data-key="back">⌫</button>' +
            '<button class="key key-num" data-action="key" data-key="4">4</button>' +
            '<button class="key key-num" data-action="key" data-key="5">5</button>' +
            '<button class="key key-num" data-action="key" data-key="6">6</button>' +
            '<button class="key key-op" data-action="key" data-key="*">×</button>' +
            '<button class="key key-func" data-action="key" data-key="clear">C</button>' +
            '<button class="key key-num" data-action="key" data-key="1">1</button>' +
            '<button class="key key-num" data-action="key" data-key="2">2</button>' +
            '<button class="key key-num" data-action="key" data-key="3">3</button>' +
            '<button class="key key-op" data-action="key" data-key="-">−</button>' +
            '<button class="key key-op" data-action="key" data-key="+">+</button>' +
            '<button class="key key-num" data-action="key" data-key="00">00</button>' +
            '<button class="key key-num" data-action="key" data-key="0">0</button>' +
            '<button class="key key-num" data-action="key" data-key=".">.</button>' +
            '<button class="key key-eq" data-action="key" data-key="=">=</button>' +
          '</div>' +
          '<input type="file" id="attach-camera" accept="image/*" capture="environment" style="display:none">' +
          '<input type="file" id="attach-gallery" accept="image/*,video/*" multiple style="display:none">' +
          '<input type="file" id="attach-file" accept="*/*" multiple style="display:none">' +
          '<button class="btn btn-primary btn-block" style="margin-top:8px" data-action="save-tx">保存账单</button>' +
        '</div>' +
      '</div>';

    renderRecCats();
    renderRecSubs();
    renderRecAccs();
    renderRecFnRow();
    renderRecPanels();
    bindRecNoteHistory();
  }

  /* 历史备注联想：按当前分类检索，同一备注取最近出现时间排序（正序），可滚动选择 */
  function renderRecNoteHistory() {
    const st = S().record;
    const box = $('#rec-note-history');
    if (!box || !st.categoryId || st.type === 'transfer') { if (box) box.style.display = 'none'; return; }
    /* note → 最近出现时间（同一备注多次出现时取最新一次） */
    const latest = {};
    Store.data.transactions.forEach(t => {
      if (t.categoryId !== st.categoryId || !t.note) return;
      const n = String(t.note).trim();
      if (!n) return;
      const k = t.date + ' ' + (t.time || '');
      if (!latest[n] || k > latest[n]) latest[n] = k;
    });
    const list = Object.keys(latest).map(note => ({ note, sort: latest[note] }));
    list.sort((a, b) => (a.sort > b.sort ? 1 : -1));
    if (!list.length) { box.style.display = 'none'; return; }
    const catName = (Store.getCategory(st.categoryId) || {}).name || '';
    box.querySelector('.rec-note-history-head').textContent = '历史备注（' + catName + '，' + list.length + '）';
    const listEl = box.querySelector('.rec-note-history-list');
    listEl.innerHTML = list.map(x =>
      '<button type="button" class="rec-note-hist-item" data-note="' + esc(x.note) + '">' + esc(x.note) + '</button>').join('');
    box.style.display = 'block';
    /* 打开时默认滑到最底部（最新备注在底部，正序） */
    requestAnimationFrame(() => { listEl.scrollTop = listEl.scrollHeight; });
  }

  function bindRecNoteHistory() {
    const noteEl = $('#rec-note');
    const box = $('#rec-note-history');
    if (!noteEl || !box) return;
    noteEl.addEventListener('focus', renderRecNoteHistory);
    noteEl.addEventListener('input', renderRecNoteHistory);
    noteEl.addEventListener('blur', () => setTimeout(() => { box.style.display = 'none'; }, 150));
    box.querySelector('.rec-note-history-list').addEventListener('click', e => {
      const it = e.target.closest('.rec-note-hist-item');
      if (!it) return;
      $('#rec-note').value = it.dataset.note;
      box.style.display = 'none';
    });
  }

  /* 记一笔总金额颜色：支出红 / 收入绿 */
  function updateAmountColor() {
    const box = document.querySelector('.amount-sm');
    if (!box) return;
    const st = S().record;
    box.classList.toggle('amt-expense', st.type === 'expense');
    box.classList.toggle('amt-income', st.type === 'income');
  }

  /* 功能栏：账户键显示所选账户图标+名称 */
  function renderRecFnRow() {
    const box = $('#rec-fn-row');
    if (!box) return;
    const st = S().record;
    const acc = Store.getAccount(st.accountId);
    let accBtn = '';
    if (st.type !== 'transfer') {
      accBtn = '<button class="rec-fn-btn" data-action="rec-meta-acc">' +
        '<span class="acc-mini" style="background:' + (acc ? (acc.color || '#2f9e44') : '#adb5bd') + '">' + UI.catIcon(acc ? acc.icon : '💳') + '</span>' +
        '<span class="fn-txt">' + (acc ? esc(acc.name) : '账户') + '</span></button>';
    }
    box.innerHTML = accBtn +
      '<button class="rec-fn-btn" data-action="rec-meta-time"><span class="fn-ico">' + UI.icon('time', 16) + '</span><span class="fn-txt">时间</span></button>' +
      '<button class="rec-fn-btn' + (st.attrPanel ? ' active' : '') + '" data-action="rec-attr"><span class="fn-ico">' + UI.icon('gear', 16) + '</span><span class="fn-txt">属性</span></button>' +
      '<button class="rec-fn-btn' + (st.discountOn ? ' active' : '') + '" data-action="rec-discount"><span class="fn-ico">' + UI.icon('tag', 16) + '</span><span class="fn-txt">优惠</span></button>' +
      '<button class="rec-fn-btn' + (st.attachments.length ? ' active' : '') + '" data-action="rec-attach"><span class="fn-ico">' + UI.icon('clip', 16) + '</span><span class="fn-txt">附件' + (st.attachments.length ? '(' + st.attachments.length + ')' : '') + '</span></button>';
  }

  /* ============ 功能面板：优惠 / 属性 / 附件 ============ */

  /* 优惠计算：优惠后价 = 原价 - 优惠；目标为「优惠后」时反推优惠 */
  function discountFinal() {
    const st = S().record;
    const orig = Math.round((parseFloat(st.discountOrig) || 0) * 100) / 100;
    let disc = Math.round((parseFloat(st.discountDisc) || 0) * 100) / 100;
    if (st.discountTarget === 'final') {
      const fin = Math.round((parseFloat(st.discountFinal) || 0) * 100) / 100;
      disc = Math.round(Math.max(0, orig - fin) * 100) / 100;
    }
    return Math.round(Math.max(0, orig - disc) * 100) / 100;
  }

  /* 优惠三字段联动：输入任意两个，第三个自动计算。
     规则：取「最新编辑字段」+「最早编辑字段」推导第三个
     （最早 = 用户最先设定的基准值，最新 = 本次修改 → 中间字段被重算）。 */
  function updateDiscountCalc() {
    const st = S().record;
    if (!st.discountOn) return;
    const o = Math.round((parseFloat(st.discountOrig) || 0) * 100) / 100;
    const d = Math.round((parseFloat(st.discountDisc) || 0) * 100) / 100;
    const f = Math.round((parseFloat(st.discountFinal) || 0) * 100) / 100;
    const T = st.discT || { orig: 0, disc: 0, final: 0 };
    const edited = [
      { k: 'orig', t: T.orig },
      { k: 'disc', t: T.disc },
      { k: 'final', t: T.final }
    ].filter(x => x.t > 0).sort((a, b) => a.t - b.t); // 编辑时间 旧→新
    let no = o, nd = d, nf = f;
    if (edited.length >= 2) {
      /* 最早编辑 + 最新编辑 → 推导第三个 */
      const first = edited[0].k;   // 最早
      const last = edited[edited.length - 1].k; // 最新
      const pair = [first, last];
      if (!pair.includes('orig')) no = nd + nf;            // 优惠+优惠后 → 原价
      else if (!pair.includes('disc')) nd = Math.max(0, no - nf); // 原价+优惠后 → 优惠
      else if (!pair.includes('final')) nf = Math.max(0, no - nd); // 原价+优惠 → 优惠后
    } else if (edited.length === 1) {
      const only = edited[0].k;
      if (only === 'orig') nf = Math.max(0, no - nd);
      else if (only === 'disc') nf = Math.max(0, no - nd);
      else if (only === 'final') nd = Math.max(0, no - nf);
    } else {
      nf = Math.max(0, no - nd);
    }
    st.discountOrig = String(no);
    st.discountDisc = String(nd);
    st.discountFinal = String(nf);
    /* 写回输入框：跳过最新编辑字段（保留用户正在输入的中间态，如 "2."） */
    const lastK = edited.length ? edited[edited.length - 1].k : null;
    if (lastK !== 'orig') { const el = $('#disc-orig'); if (el) el.value = st.discountOrig; }
    if (lastK !== 'disc') { const el = $('#disc-disc'); if (el) el.value = st.discountDisc; }
    if (lastK !== 'final') { const el = $('#disc-final'); if (el) el.value = st.discountFinal; }
    const el = $('#rec-amount');
    if (el) el.textContent = String(nf);
  }

  /* 高亮当前选中的优惠输入框（原价 / 优惠 / 优惠后） */
  function updateDiscountHighlight() {
    const st = S().record;
    const o = $('#disc-orig');
    const d = $('#disc-disc');
    const f = $('#disc-final');
    if (o) o.classList.toggle('rp-input-active', st.discountTarget === 'orig');
    if (d) d.classList.toggle('rp-input-active', st.discountTarget === 'disc');
    if (f) f.classList.toggle('rp-input-active', st.discountTarget === 'final');
  }

  function renderRecPanels() {
    const box = $('#rec-panels');
    if (!box) return;
    const st = S().record;
    let html = '';
    if (st.discountOn) {
      html += '<div class="rec-panel">' +
        '<div class="rp-head">🏷️ 优惠</div>' +
        '<div class="rp-row">' +
          '<span>原价</span><input type="text" inputmode="decimal" id="disc-orig" class="rp-input' + (st.discountTarget === 'orig' ? ' rp-input-active' : '') + '" data-disc-target="orig" readonly value="' + esc(st.discountOrig) + '" placeholder="0">' +
          '<span class="rp-minus">−</span>' +
          '<span>优惠</span><input type="text" inputmode="decimal" id="disc-disc" class="rp-input' + (st.discountTarget === 'disc' ? ' rp-input-active' : '') + '" data-disc-target="disc" readonly value="' + esc(st.discountDisc) + '" placeholder="0">' +
          '<span class="rp-eq">=</span>' +
          '<span>优惠后</span><input type="text" inputmode="decimal" id="disc-final" class="rp-input' + (st.discountTarget === 'final' ? ' rp-input-active' : '') + '" data-disc-target="final" readonly value="' + esc(st.discountFinal) + '" placeholder="0">' +
        '</div>' +
      '</div>';
    }
    if (st.attrPanel) {
      html += '<div class="rec-panel">' +
        '<div class="rp-head">⚙️ 属性</div>' +
        '<label class="check"><input type="checkbox" id="attr-exclude-stats"' + (st.excludeStats ? ' checked' : '') + '> 不计入收支统计</label>' +
        '<label class="check" style="margin-top:6px"><input type="checkbox" id="attr-exclude-budget"' + (st.excludeBudget ? ' checked' : '') + '> 不计入预算</label>' +
        '<div class="data-tip" style="margin-top:4px">仍会显示在明细中，只是不参与对应统计。</div>' +
      '</div>';
    }
    if (st.attachments.length || st.attachPanel) {
      html += '<div class="rec-panel">' +
        '<div class="rp-head">📎 附件</div>' +
        '<div class="rp-chips">' +
          (st.attachments.length
            ? st.attachments.map((a, i) =>
                '<span class="rp-chip">' + attachIcon(a.type) + ' ' + esc(a.name) +
                '<button class="rp-chip-x" data-action="attach-remove" data-idx="' + i + '">×</button></span>'
              ).join('')
            : '<span class="rp-empty">还没有附件</span>') +
        '</div>' +
        '<div class="rp-add-row">' +
          '<button class="btn btn-ghost btn-sm" data-action="attach-src" data-src="camera">📷 相机</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="attach-src" data-src="gallery">🖼️ 相册</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="attach-src" data-src="file">📁 文件</button>' +
        '</div>' +
      '</div>';
    }
    box.innerHTML = html;
    updateDiscountCalc();
  }

  function attachIcon(type) {
    if (!type) return '📄';
    if (type.indexOf('image') === 0) return '🖼️';
    if (type.indexOf('video') === 0) return '🎬';
    if (type.indexOf('pdf') !== -1 || type.indexOf('word') !== -1 || type.indexOf('document') !== -1 || type.indexOf('sheet') !== -1) return '📑';
    return '📄';
  }

  function attachmentToData(file) {
    return new Promise(resolve => {
      if (file.type && file.type.indexOf('image/') === 0) {
        /* 图片压缩后再存，避免撑爆 localStorage */
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          let w = img.width, h = img.height;
          const max = 900;
          if (w > max) { h = Math.round(h * max / w); w = max; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const data = canvas.toDataURL('image/jpeg', 0.72);
          URL.revokeObjectURL(url);
          resolve({ name: file.name || 'image.jpg', type: file.type, data });
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve({ name: file.name, type: file.type, data: '' }); };
        img.src = url;
      } else {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result) });
        reader.onerror = () => resolve({ name: file.name, type: file.type, data: '' });
        reader.readAsDataURL(file);
      }
    });
  }

  async function handleAttachFiles(files) {
    const st = S().record;
    const list = Array.from(files || []);
    let total = st.attachments.reduce((s, a) => s + (a.data ? a.data.length : 0), 0);
    for (const file of list) {
      if (!file.type || file.type.indexOf('image/') !== 0) {
        if (file.size > 2.5 * 1024 * 1024) { UI.toast('「' + file.name + '」超过 2.5MB，未添加', 'err'); continue; }
      }
      const att = await attachmentToData(file);
      if (!att.data) { UI.toast('「' + file.name + '」读取失败', 'err'); continue; }
      total += att.data.length;
      if (total > 2.8 * 1024 * 1024) { UI.toast('附件总大小超限（约 2.8MB），未添加', 'err'); break; }
      st.attachments.push(att);
    }
    st.attachPanel = true;
    renderRecPanels();
  }

  function txRow(t) {
    const isTransfer = t.type === 'transfer';
    const c = catOfId(t.categoryId);
    const acc = Store.getAccount(t.accountId);
    const toAcc = Store.getAccount(t.toAccountId);
    const color = isTransfer ? '#4DA08B' : c.color;
    const icon = isTransfer ? UI.icon('swap', 28) : UI.catIcon(c.icon);
    const sign = t.type === 'income' ? '+' : '-';
    const cls = t.type === 'income' ? 'v-green' : t.type === 'expense' ? 'v-red' : '';
    const note = (t.note || '').replace(/\n+/g, ' ');
    const sub = [t.merchant, note].filter(Boolean).join(' · ');
    const name = isTransfer
      ? '转账 → ' + esc((toAcc && toAcc.name) || '未知账户')
      : esc(Store.categoryLabel(t.categoryId));
    const subLine = (sub ? esc(sub) + ' · ' : '') +
      (t.originalPrice ? ' · 原价' + money(t.originalPrice) + (t.discount ? ' 省' + money(t.discount) : '') : '') +
      (t.attachments && t.attachments.length ? ' · 📎' + t.attachments.length : '') +
      ((t.excludeStats ? ' · <em class="tx-excluded">不计收支</em>' : '') + (t.excludeBudget ? ' · <em class="tx-excluded">不计预算</em>' : ''));
    /* 账户与时间：紧凑小字，放在价格下方 */
    const meta = (isTransfer
      ? esc((acc && acc.name) || '') + ' → ' + esc((toAcc && toAcc.name) || '')
      : esc((acc && acc.name) || '')) + (t.time ? ' · ' + esc(t.time) : '');
    return '<button class="tx-row" data-action="edit-tx" data-val="' + t.id + '">' +
      '<span class="tx-ico"' + iconStyle(color) + '>' + icon + '</span>' +
      '<span class="tx-main"><span class="tx-name">' + name + '</span>' +
      '<span class="tx-sub">' + subLine + '</span></span>' +
      '<span class="tx-right">' +
        '<span class="tx-amt ' + cls + '">' + (isTransfer ? '' : sign) + money(t.amount) + '</span>' +
        (meta ? '<span class="tx-meta">' + meta + '</span>' : '') +
      '</span>' +
    '</button>';
  }

  /* ================= 统计（重构：日常 / 月 / 年 / 自定义） ================= */
  const STAT_PAGES = [['daily', '日常'], ['month', '月统计'], ['year', '年统计'], ['custom', '自定义']];
  function statsHead(active) {
    return '<div class="stat-nav">' + STAT_PAGES.map(p =>
      '<button class="btn ' + (active === p[0] ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-action="stat-page" data-val="' + p[0] + '">' + p[1] + '</button>'
    ).join('') + '</div>';
  }

  /* 分类聚合：level = root（一级分类）| all（全部分类） */
  function catAgg(type, from, to, level) {
    const map = {};
    Store.categoryStatsRange(type, from, to).forEach(x => {
      const c = Store.getCategory(x.categoryId);
      const key = level === 'root' && c && c.parentId ? c.parentId : x.categoryId;
      map[key] = (map[key] || 0) + x.value;
    });
    return Object.entries(map).map(([id, v]) => ({ categoryId: id, value: Math.round(v * 100) / 100 })).sort((a, b) => b.value - a.value);
  }
  const catColor = id => { const c = Store.getCategory(id); return c ? c.color : '#adb5bd'; };
  const catSeg = () => {
    const s = S().stats;
    return '<div class="seg seg-sm">' +
      '<button class="seg-btn ' + (s.cat === 'root' ? 'active' : '') + '" data-action="stat-cat" data-val="root">一级分类</button>' +
      '<button class="seg-btn ' + (s.cat === 'all' ? 'active' : '') + '" data-action="stat-cat" data-val="all">全部分类</button></div>';
  };
  const typeSeg = () => {
    const s = S().stats;
    return '<div class="seg seg-sm">' +
      '<button class="seg-btn ' + (s.type === 'expense' ? 'active' : '') + '" data-action="stat-type" data-val="expense">支出</button>' +
      '<button class="seg-btn ' + (s.type === 'income' ? 'active' : '') + '" data-action="stat-type" data-val="income">收入</button></div>';
  };

  /* 通用区间统计页：月 / 年 / 自定义共用 */
  function statsRange(o) {
    const v = $('#view');
    const s = S().stats;
    const skMode = s.skMode || 'amt';
    const skRankType = s.rankType || 'expense';
    const txs = Store.getTransactions({ from: o.from, to: o.to });
    let income = 0, expense = 0;
    txs.forEach(t => { if (t.excludeStats) return; if (t.type === 'income') income += t.amount; else if (t.type === 'expense') expense += t.amount; });
    const balance = Math.round((income - expense) * 100) / 100;

    /* 时间分桶 */
    let buckets;
    if (o.unit === 'day') {
      buckets = [];
      const cursor = new Date(o.from + 'T00:00:00');
      const end = new Date(o.to + 'T00:00:00');
      while (cursor <= end) {
        buckets.push({ key: cursor.getFullYear() + '-' + UI.pad(cursor.getMonth() + 1) + '-' + UI.pad(cursor.getDate()), label: (cursor.getMonth() + 1) + '/' + cursor.getDate() });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const map = {};
      let cy = parseInt(o.from.slice(0, 4), 10), cm = parseInt(o.from.slice(5, 7), 10);
      const ey = parseInt(o.to.slice(0, 4), 10), em = parseInt(o.to.slice(5, 7), 10);
      while (cy < ey || (cy === ey && cm <= em)) {
        map[UI.monthKey(cy, cm)] = true;
        if (cm === 12) { cm = 1; cy++; } else cm++;
      }
      buckets = Object.keys(map).sort().map(k => ({ key: k, label: k.slice(5) + '月' }));
    }

    const incBy = {}, expBy = {};
    txs.forEach(t => {
      if (t.excludeStats) return;
      const b = o.unit === 'day' ? t.date : t.date.slice(0, 7);
      if (t.type === 'income') incBy[b] = (incBy[b] || 0) + t.amount;
      else if (t.type === 'expense') expBy[b] = (expBy[b] || 0) + t.amount;
    });
    const barMode = s.bar || 'expense';
    const barItems = buckets.map(b => {
      const i = incBy[b.key] || 0, e = expBy[b.key] || 0;
      const val = barMode === 'income' ? i : barMode === 'expense' ? e : i - e;
      return { label: b.label, value: Math.round(val * 100) / 100 };
    });

    /* 资产走势：资产(某日末) = 当前总资产 - 该日之后的所有收支净额 */
    const allTxs = Store.data.transactions;
    const assetsSeries = buckets.map(b => {
      const k = o.unit === 'day' ? b.key : b.key + '-' + UI.daysInMonth(parseInt(b.key.slice(0, 4), 10), parseInt(b.key.slice(5, 7), 10));
      let n = 0;
      for (const t of allTxs) {
        if (t.type === 'income') { if (t.date > k) n += t.amount; }
        else if (t.type === 'expense') { if (t.date > k) n -= t.amount; }
      }
      return { label: b.label, value: Math.round((Store.totalAssets() - n) * 100) / 100 };
    });

    /* 收支对比（桑基式镜像流） */
    const incCats = catAgg('income', o.from, o.to, s.cat);
    const expCats = catAgg('expense', o.from, o.to, s.cat);
    const incTotal = incCats.reduce((a, x) => a + x.value, 0);
    const expTotal = expCats.reduce((a, x) => a + x.value, 0);

    /* 收支占比（马卡龙配色） */
    const donutRaw = catAgg(s.type, o.from, o.to, s.cat);
    let donutItems = donutRaw.slice(0, 8).map((x, i) => ({ label: Store.categoryLabel(x.categoryId), value: x.value, color: Preset.macaron[i % Preset.macaron.length] }));
    const rest = donutRaw.slice(8).reduce((a, x) => a + x.value, 0);
    if (rest > 0.005) donutItems.push({ label: '其他', value: Math.round(rest * 100) / 100, color: Preset.macaron[7] });

    /* 账单明细 */
    const list = Store.getTransactions({ from: o.from, to: o.to });
    const groups = {};
    list.forEach(t => { const k = o.unit === 'day' ? t.date : t.date.slice(0, 7); (groups[k] = groups[k] || []).push(t); });
    const gkeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

    v.innerHTML =
      '<div class="page">' +
        '<div class="page-head"><h1>统计分析</h1></div>' +
        statsHead(o.mode) +
        /* 时间段选择 + 该区间汇总 */
        '<div class="card stat-ctl-card">' + o.head +
          '<div class="stat-summary">' +
            '<span>总收入 <b class="v-green">' + money(income) + '</b></span>' +
            '<span>总支出 <b class="v-red">' + money(expense) + '</b></span>' +
            '<span>结余 <b class="' + (balance >= 0 ? 'v-green' : 'v-red') + '">' + money(balance) + '</b></span>' +
          '</div>' +
        '</div>' +
        /* 收支统计：每日(月)柱状图，收入/支出/结余切换 */
        '<div class="card"><div class="card-title"><span>收支统计（' + (o.unit === 'day' ? '每日' : '每月') + '）</span>' +
          '<div class="seg seg-sm">' +
            ['income', 'expense', 'balance'].map(md =>
              '<button class="seg-btn ' + (barMode === md ? 'active' : '') + '" data-action="stat-bar" data-val="' + md + '">' + { income: '收入', expense: '支出', balance: '结余' }[md] + '</button>').join('') +
          '</div></div><div id="stat-bar"></div></div>' +
        /* 资产走势 */
        '<div class="card"><div class="card-title">资产走势（' + (o.unit === 'day' ? '每日' : '每月') + '末）</div><div id="stat-assets"></div></div>' +
        /* 收支对比 */
        '<div class="card"><div class="card-title"><span>收支对比</span>' +
          '<div class="seg seg-sm">' +
            '<button class="seg-btn ' + (skMode === 'amt' ? 'active' : '') + '" data-action="stat-sk" data-val="amt">金额</button>' +
            '<button class="seg-btn ' + (skMode === 'pct' ? 'active' : '') + '" data-action="stat-sk" data-val="pct">占比</button>' +
          '</div>' + catSeg() + '</div><div id="stat-sankey"></div></div>' +
        /* 收支占比（参考日统计：小圆环 + 右侧清单） */
        '<div class="card"><div class="card-title"><span>收支占比（' + (s.type === 'income' ? '收入' : '支出') + '）</span>' + typeSeg() + catSeg() + '</div>' +
          '<div class="asset-donut-row">' +
            '<div id="stat-donut" class="asset-donut"></div>' +
            '<div class="asset-donut-list" id="stat-donut-list"></div>' +
          '</div>' +
        '</div>' +
        /* 一级分类排行（同日常页） */
        '<div class="card"><div class="card-title"><span>一级分类排行</span>' +
          '<div class="seg seg-sm">' +
            '<button class="seg-btn ' + (skRankType === 'expense' ? 'active' : '') + '" data-action="catrank-type" data-val="expense">支出</button>' +
            '<button class="seg-btn ' + (skRankType === 'income' ? 'active' : '') + '" data-action="catrank-type" data-val="income">收入</button>' +
          '</div></div><div id="stat-catrank"></div></div>' +
        /* 账单明细 */
        '<div class="card"><div class="card-title">' + o.billTitle + '（' + list.length + ' 笔）</div>' +
          '<div id="stat-bills">' +
            (gkeys.length
              ? gkeys.map(k =>
                  '<div class="tx-group flat">' +
                    '<div class="tx-group-head"><span>' + (o.unit === 'day' ? UI.fmtDateCn(k) + ' ' + UI.weekday(k) : UI.fmtMonthCn(k)) + '</span></div>' +
                    groups[k].map(txRow).join('') +
                  '</div>').join('')
              : emptyHTML('📭', '该时间段内暂无账单')) +
          '</div>' +
        '</div>' +
      '</div>';

    const barEl = $('#stat-bar');
    if (txs.length) {
      if (barMode === 'balance') Charts.bars2(barEl, barItems.map(b => ({ label: b.label, value: b.value, color: b.value >= 0 ? '#B5EAD7' : '#FFB3BA' })), { scrollable: true });
      else Charts.bars(barEl, barItems.map(b => ({ label: b.label, value: b.value, color: barMode === 'income' ? '#B5EAD7' : '#FFB3BA' })), { scrollable: true });
    } else barEl.innerHTML = emptyHTML('🍃', '该时间段暂无收支记录');

    const ae = $('#stat-assets');
    if (txs.length) Charts.line(ae, [{ name: '资产', color: '#BAE1FF', values: assetsSeries.map(a => a.value) }], { labels: assetsSeries.map(a => a.label), scrollable: true });
    else ae.innerHTML = emptyHTML('🍃', '该时间段暂无收支记录');

    /* 收支对比：左右占比柱 + 分类名以分类色虚线连接柱中对应段 */
    const se = $('#stat-sankey');
    const skTop = cats => {
      const list = cats.slice(0, 8).map(x => ({ label: Store.categoryLabel(x.categoryId), value: x.value }));
      const rest = cats.slice(8).reduce((a, x) => a + x.value, 0);
      if (rest > 0.005) list.push({ label: '其他', value: Math.round(rest * 100) / 100 });
      return list;
    };
    const incTop = skTop(incCats);
    const expTop = skTop(expCats);
    const skSide = (title, cls, items, side) => {
      const total = items.reduce((s, x) => s + x.value, 0) || 1;
      const rows = items.map((x, i) => {
        const c = Preset.macaron[i % Preset.macaron.length];
        const pct = Math.round(x.value / total * 100);
        const dot = '<span class="sk2-dot" style="background:' + c + '"></span>';
        const name = '<span class="sk2-name">' + esc(x.label) + '</span>';
        const val = '<span class="sk2-val">' +
          (skMode === 'pct' ? '<em>' + pct + '%</em>' : '<em>¥' + Math.round(x.value) + '</em>') + '</span>';
        return '<div class="sk2-label' + (side === 'right' ? ' sk2-r' : '') + '" style="flex:' + x.value + '">' +
          (side === 'left' ? dot + name + val : val + name + dot) + '</div>';
      }).join('');
      const lines = items.map((x, i) =>
        '<i class="sk2-line" style="flex:' + x.value + ';border-color:' + Preset.macaron[i % Preset.macaron.length] + '"></i>').join('');
      const bar = items.map((x, i) =>
        '<i class="sk2-seg" style="flex:' + x.value + ';background:' + Preset.macaron[i % Preset.macaron.length] + '" title="' + esc(x.label) + '：' + money(x.value) + '（' + Math.round(x.value / total * 100) + '%）"></i>').join('');
      return {
        html: '<div class="sk2-title ' + cls + '">' + title + '</div>' +
          (side === 'right'
            ? '<div class="sk2-body">' +
                '<div class="sk2-bar">' + bar + '</div>' +
                '<div class="sk2-lines">' + lines + '</div>' +
                '<div class="sk2-labels">' + (rows || '<div class="data-tip">无记录</div>') + '</div>' +
              '</div>'
            : '<div class="sk2-body">' +
                '<div class="sk2-labels">' + (rows || '<div class="data-tip">无记录</div>') + '</div>' +
                '<div class="sk2-lines">' + lines + '</div>' +
                '<div class="sk2-bar">' + bar + '</div>' +
              '</div>')
      };
    };
    const inc = skSide('收入', 'v-green', incTop, 'left');
    const exp = skSide('支出', 'v-red', expTop, 'right');
    se.innerHTML = (incTotal + expTotal) > 0
      ? '<div class="sk2">' +
          '<div class="sk2-side">' + inc.html + '</div>' +
          '<div class="sk2-mid">' +
            '<span class="v-green">' + money(incTotal) + '</span>' +
            '<span class="sk2-arrow">⇄</span>' +
            '<span class="v-red">' + money(expTotal) + '</span>' +
          '</div>' +
          '<div class="sk2-side sk2-side-r">' + exp.html + '</div>' +
        '</div>'
      : emptyHTML('🍃', '该时间段暂无收支记录');

    /* 收支占比：小圆环 + 右侧分类清单 */
    const de = $('#stat-donut');
    if (donutItems.length) {
      Charts.donut(de, donutItems, { size: 140, legend: false, centerLabel: s.type === 'income' ? '收入' : '支出' });
      const dl = $('#stat-donut-list');
      const dTotal = donutItems.reduce((a, x) => a + x.value, 0);
      dl.innerHTML = donutItems.map(x =>
        '<div class="asset-list-row">' +
          '<span class="legend-dot" style="background:' + x.color + '"></span>' +
          '<span class="asset-list-name">' + esc(x.label) + '</span>' +
          '<span class="asset-list-val">' + money(x.value) + '</span>' +
          '<span class="asset-list-pct">' + (dTotal > 0 ? Math.round(x.value / dTotal * 100) : 0) + '%</span>' +
        '</div>').join('');
    } else de.innerHTML = emptyHTML('🍃', '该时间段暂无' + (s.type === 'income' ? '收入' : '支出') + '记录');

    /* 一级分类排行（同日常页，统计当前区间） */
    renderCatRank($('#stat-catrank'), skRankType, o.from, o.to);
  }

  /* ---------- 日常 ---------- */
  function statsDaily() {
    const v = $('#view');
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d.getFullYear() + '-' + UI.pad(d.getMonth() + 1) + '-' + UI.pad(d.getDate()));
    }
    const from = days[0], to = days[6];
    const txs = Store.getTransactions({ from, to });
    let inc = 0, exp = 0;
    txs.forEach(t => { if (t.excludeStats) return; if (t.type === 'income') inc += t.amount; else if (t.type === 'expense') exp += t.amount; });
    const avgInc = Math.round(inc / 7 * 100) / 100, avgExp = Math.round(exp / 7 * 100) / 100;

    /* 近七日收支柱状图（可切换收入/支出） */
    const dlyBar = S().stats.dailyBar || 'expense';
    const rankType = S().stats.rankType || 'expense';
    const incBy = {}, expBy = {};
    txs.forEach(t => {
      if (t.excludeStats) return;
      if (t.type === 'income') incBy[t.date] = (incBy[t.date] || 0) + t.amount;
      else if (t.type === 'expense') expBy[t.date] = (expBy[t.date] || 0) + t.amount;
    });
    const barItems = days.map(d => ({
      label: parseInt(d.slice(5, 7), 10) + '/' + parseInt(d.slice(8, 10), 10),
      value: Math.round(((dlyBar === 'income' ? incBy[d] : expBy[d]) || 0) * 100) / 100
    }));

    /* 资产汇总：马卡龙圆环 + 右侧账户清单（负值账户不显示，避免圆环故障） */
    const accItems = Store.getAccounts(false)
      .map(a => ({ label: a.name, value: Store.accountBalance(a.id), color: a.color || '#FFB3BA' }))
      .filter(x => x.value > 0);
    const accTotal = Math.round(accItems.reduce((s, x) => s + x.value, 0) * 100) / 100;

    v.innerHTML =
      '<div class="page">' +
        '<div class="page-head"><h1>统计分析</h1></div>' +
        statsHead('daily') +
        /* 近七日统计卡：收支柱状图在上、统计表格在下（极致压缩） */
        '<div class="card"><div class="card-title"><span>近七日统计</span>' +
          '<div class="seg seg-sm">' +
            '<button class="seg-btn ' + (dlyBar === 'expense' ? 'active' : '') + '" data-action="dly-bar" data-val="expense">支出</button>' +
            '<button class="seg-btn ' + (dlyBar === 'income' ? 'active' : '') + '" data-action="dly-bar" data-val="income">收入</button>' +
          '</div></div>' +
          '<div id="dly-bar"></div>' +
          '<div class="stat-grid dly-stat">' +
            statCard('近7日收入', money(inc), 'v-green') +
            statCard('近7日支出', money(exp), 'v-red') +
            statCard('日均收入', money(avgInc), 'v-green') +
            statCard('日均支出', money(avgExp), 'v-red') +
          '</div>' +
        '</div>' +
        '<div class="card"><div class="card-title">资产汇总</div>' +
          '<div class="asset-donut-row">' +
            '<div id="dly-assets" class="asset-donut"></div>' +
            '<div class="asset-donut-list" id="dly-assets-list"></div>' +
          '</div>' +
        '</div>' +
        /* 一级分类排行 */
        '<div class="card"><div class="card-title"><span>一级分类排行</span>' +
          '<div class="seg seg-sm">' +
            '<button class="seg-btn ' + (rankType === 'expense' ? 'active' : '') + '" data-action="catrank-type" data-val="expense">支出</button>' +
            '<button class="seg-btn ' + (rankType === 'income' ? 'active' : '') + '" data-action="catrank-type" data-val="income">收入</button>' +
          '</div></div><div id="dly-catrank"></div></div>' +
      '</div>';

    const dbe = $('#dly-bar');
    if (txs.length) Charts.bars(dbe, barItems.map(b => ({ label: b.label, value: b.value, color: dlyBar === 'income' ? 'var(--success)' : 'var(--danger)' })), { scrollable: true });
    else dbe.innerHTML = emptyHTML('🍃', '近七日暂无收支记录');

    const ae = $('#dly-assets');
    const ael = $('#dly-assets-list');
    if (accItems.length) {
      Charts.donut(ae, accItems, { size: 140, legend: false, centerLabel: '总资产' });
      ael.innerHTML = accItems.map(x =>
        '<div class="asset-list-row">' +
          '<span class="legend-dot" style="background:' + x.color + '"></span>' +
          '<span class="asset-list-name">' + esc(x.label) + '</span>' +
          '<span class="asset-list-val">' + money(x.value) + '</span>' +
          '<span class="asset-list-pct">' + (accTotal > 0 ? Math.round(x.value / accTotal * 100) : 0) + '%</span>' +
        '</div>').join('');
    } else ae.innerHTML = emptyHTML('💳', '暂无账户余额数据');

    /* 一级分类排行：全部历史按金额降序 */
    const rankEl = $('#dly-catrank');
    renderCatRank(rankEl, rankType, '', '');
  }

  /* 一级分类排行渲染（日常 / 月 / 年 / 自定义共用） */
  function renderCatRank(el, type, from, to) {
    if (!el) return;
    const rank = catAgg(type, from, to, 'root').filter(x => x.value > 0);
    el.innerHTML = rank.length
      ? rank.map(x => {
          const cc = Store.getCategory(x.categoryId);
          return '<button class="catrank-row" data-action="nav" data-nav="/category?id=' + x.categoryId + '">' +
            '<span class="catrank-ico">' + UI.catIcon(cc ? cc.icon : 'box') + '</span>' +
            '<span class="catrank-name">' + esc(cc ? cc.name : '其他') + '</span>' +
            '<span class="catrank-val ' + (type === 'income' ? 'v-green' : 'v-red') + '">' + money(x.value) + '</span>' +
          '</button>';
        }).join('')
      : emptyHTML('🍃', '该时间段暂无' + (type === 'income' ? '收入' : '支出') + '记录');
  }

  /* ---------- 分类专属页 ---------- */
  function categoryPage(id) {
    const v = $('#view');
    const c = Store.getCategory(id);
    if (!c) { App.nav('/home'); return; }
    const cs = S().catStats;
    let from = '', to = '';
    if (cs.period === 'year') { from = cs.year + '-01-01'; to = cs.year + '-12-31'; }
    else if (cs.period === 'month') { const { y, m } = UI.parseMonthKey(cs.monthKey); from = y + '-' + UI.pad(m) + '-01'; to = y + '-' + UI.pad(m) + '-' + UI.daysInMonth(y, m); }
    else if (cs.period === 'custom') { from = cs.from || ''; to = cs.to || ''; if (from && to && from > to) to = from; }
    const txs = Store.getTransactions({ from, to }).filter(t => {
      if (t.categoryId === id) return true;
      const cc = Store.getCategory(t.categoryId);
      return cc && cc.parentId === id;
    });
    let inc = 0, exp = 0;
    txs.forEach(t => { if (t.type === 'income') inc += t.amount; else if (t.type === 'expense') exp += t.amount; });
    const groups = {};
    txs.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
    const keys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));
    const ctl =
      '<div class="stat-ctl cat-ctl">' +
        '<div class="seg seg-sm">' +
          [['all', '全部'], ['year', '年'], ['month', '月'], ['custom', '自定义']].map(p =>
            '<button class="seg-btn ' + (cs.period === p[0] ? 'active' : '') + '" data-action="cat-period" data-val="' + p[0] + '">' + p[1] + '</button>').join('') +
        '</div>' +
        (cs.period === 'year'
          ? '<button class="btn btn-ghost btn-sm" data-action="cat-nav" data-d="-1">‹</button><span class="stat-ctl-label">' + cs.year + ' 年</span><button class="btn btn-ghost btn-sm" data-action="cat-nav" data-d="1">›</button>'
          : cs.period === 'month'
          ? '<button class="btn btn-ghost btn-sm" data-action="cat-nav" data-d="-1">‹</button><button class="stat-ctl-label" data-action="cat-today">' + UI.fmtMonthCn(cs.monthKey) + '</button><button class="btn btn-ghost btn-sm" data-action="cat-nav" data-d="1">›</button>'
          : cs.period === 'custom'
          ? '<input type="date" id="cat-from" value="' + esc(cs.from || '') + '" style="padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:var(--text)"><span>至</span><input type="date" id="cat-to" value="' + esc(cs.to || '') + '" style="padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:var(--text)">'
          : '') +
      '</div>';
    v.innerHTML =
      '<div class="page">' +
        '<div class="page-head">' +
          '<button class="btn btn-ghost btn-sm" data-action="nav" data-nav="/stats/daily">‹ 返回</button>' +
          '<h1>' + UI.catIcon(c.icon) + ' ' + esc(c.name) + '</h1>' +
        '</div>' +
        '<div class="card stat-ctl-card">' + ctl +
          '<div class="stat-summary">' +
            '<span>收入 <b class="v-green">' + money(inc) + '</b></span>' +
            '<span>支出 <b class="v-red">' + money(exp) + '</b></span>' +
            '<span>结余 <b class="' + (inc - exp >= 0 ? 'v-green' : 'v-red') + '">' + money(inc - exp) + '</b></span>' +
          '</div>' +
        '</div>' +
        '<div class="card bill-card">' +
          '<div class="bill-head-row"><span class="bill-title">' + UI.icon('list', 15) + ' 账单明细（' + txs.length + ' 笔）</span></div>' +
          (keys.length
            ? keys.map(k =>
                '<div class="tx-group flat">' +
                  '<div class="tx-group-head"><span>' + UI.fmtDateCn(k) + ' ' + UI.weekday(k) + '</span></div>' +
                  groups[k].map(txRow).join('') +
                '</div>').join('')
            : emptyHTML('📭', '该时间段暂无账单')) +
        '</div>' +
      '</div>';
  }

  /* ---------- 月统计 ---------- */
  function statsMonth() {
    const s = S().stats;
    const { y, m } = UI.parseMonthKey(s.monthKey);
    statsRange({
      mode: 'month',
      head: '<div class="stat-ctl">' +
        '<button class="btn btn-ghost btn-sm" data-action="stat-nav" data-d="-1">‹</button>' +
        '<button class="stat-ctl-label" data-action="stat-today">' + UI.fmtMonthCn(s.monthKey) + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="stat-nav" data-d="1">›</button>' +
      '</div>',
      from: y + '-' + UI.pad(m) + '-01',
      to: y + '-' + UI.pad(m) + '-' + UI.daysInMonth(y, m),
      unit: 'day',
      billTitle: '本月账单'
    });
  }

  /* ---------- 年统计 ---------- */
  function statsYear() {
    const s = S().stats;
    statsRange({
      mode: 'year',
      head: '<div class="stat-ctl">' +
        '<button class="btn btn-ghost btn-sm" data-action="stat-nav" data-d="-1">‹</button>' +
        '<button class="stat-ctl-label" data-action="stat-today">' + s.year + ' 年</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="stat-nav" data-d="1">›</button>' +
      '</div>',
      from: s.year + '-01-01',
      to: s.year + '-12-31',
      unit: 'month',
      billTitle: '年度账单'
    });
  }

  /* ---------- 自定义 ---------- */
  function statsCustom() {
    const s = S().stats;
    const today = UI.todayStr();
    let from = s.from || (today.slice(0, 8) + '01');
    let to = s.to || today;
    if (from > to) to = from;
    const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    statsRange({
      mode: 'custom',
      head: '<div class="stat-ctl stat-ctl-custom">' +
        '<input type="date" id="stat-from" value="' + esc(from) + '"><span>至</span><input type="date" id="stat-to" value="' + esc(to) + '">' +
      '</div>',
      from, to,
      unit: days <= 62 ? 'day' : 'month',
      billTitle: '区间账单'
    });
  }
  /* ================= 日历 ================= */
  function shortMoney(v) {
    if (v >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    if (v >= 1000) return Math.round(v / 100) / 10 + 'k';
    return String(Math.round(v));
  }

  function calendar() {
    const v = $('#view');
    const { y, m } = UI.parseMonthKey(S().month);
    const sel = S().calendarDay || UI.todayStr();
    const today = UI.todayStr();
    const daily = Store.dailyStats(y, m);
    const daysIn = UI.daysInMonth(y, m);
    const startWeekday = new Date(y, m - 1, 1).getDay();

    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += '<div class="cal-cell cal-empty"></div>';
    for (let d = 1; d <= daysIn; d++) {
      const date = y + '-' + UI.pad(m) + '-' + UI.pad(d);
      const info = daily[d - 1] || { income: 0, expense: 0 };
      cells += '<button class="cal-cell' + (date === today ? ' cal-today' : '') + (date === sel ? ' cal-sel' : '') + '" data-action="cal-pick" data-val="' + date + '">' +
        '<span class="cal-day">' + d + '</span>' +
        (info.expense > 0 ? '<span class="cal-exp">- ' + shortMoney(info.expense) + '</span>' : '') +
        (info.income > 0 ? '<span class="cal-inc">+ ' + shortMoney(info.income) + '</span>' : '') +
      '</button>';
    }

    /* 选中日的明细 */
    const dayTxs = Store.getTransactions({ from: sel, to: sel });
    let dInc = 0, dExp = 0;
    dayTxs.forEach(t => { if (t.excludeStats) return; if (t.type === 'income') dInc += t.amount; else if (t.type === 'expense') dExp += t.amount; });

    v.innerHTML =
      '<div class="page">' +
        '<div class="page-head"><h1>收支日历</h1>' +
          '<div class="month-nav">' +
            '<button class="btn btn-ghost btn-sm" data-action="month-prev">‹</button>' +
            '<button class="month-label" data-action="cal-jump-open">' + UI.fmtMonthCn(S().month) + '</button>' +
            '<button class="btn btn-ghost btn-sm" data-action="month-next">›</button>' +
          '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="cal-week">' + ['日', '一', '二', '三', '四', '五', '六'].map(w => '<span>' + w + '</span>').join('') + '</div>' +
          '<div class="cal-grid">' + cells + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-title"><span>' + UI.fmtDateCn(sel) + ' ' + UI.weekday(sel) + '</span>' +
            '<button class="btn btn-primary btn-sm" data-action="cal-record">＋ 记一笔</button></div>' +
          '<div class="list-summary" style="padding:0 0 10px">' +
            '<span>收入 <b class="v-green">' + money(dInc) + '</b></span>' +
            '<span>支出 <b class="v-red">' + money(dExp) + '</b></span>' +
            '<span>' + dayTxs.length + ' 笔</span>' +
          '</div>' +
          (dayTxs.length
            ? '<div class="tx-group" style="box-shadow:none;margin-bottom:0">' + dayTxs.map(txRow).join('') + '</div>'
            : '<div class="data-tip" style="padding:8px 0">这一天还没有账单，点「记一笔」快速记录。</div>') +
        '</div>' +
      '</div>';
    /* 左右滑动切换月份 */
    const gridEl = v.querySelector('.cal-grid');
    if (gridEl) {
      let tx0 = null, ty0 = null;
      const tp = e => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || null;
      gridEl.addEventListener('touchstart', e => { const t = tp(e); if (!t) return; tx0 = t.clientX; ty0 = t.clientY; }, { passive: true });
      gridEl.addEventListener('touchend', e => {
        if (tx0 == null) return;
        const t = tp(e); if (!t) return;
        const dx = t.clientX - tx0, dy = t.clientY - ty0;
        tx0 = null; ty0 = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        const { y: cy, m: cm } = UI.parseMonthKey(S().month);
        let ny = cy, nm = cm + (dx < 0 ? 1 : -1);
        if (nm < 1) { nm = 12; ny--; } else if (nm > 12) { nm = 1; ny++; }
        S().month = UI.monthKey(ny, nm);
        Views.calendar();
      }, { passive: true });
    }
  }

  /* 月份跳转弹窗 */
  function openMonthJump() {
    const { y, m } = UI.parseMonthKey(S().month);
    const modal = UI.modal('跳转月份',
      '<div class="mj-year">' +
        '<button class="btn btn-ghost btn-sm" data-action="mj-year" data-d="-1">‹</button>' +
        '<span class="mj-year-label" id="mj-year-label">' + y + ' 年</span>' +
        '<button class="btn btn-ghost btn-sm" data-action="mj-year" data-d="1">›</button>' +
      '</div>' +
      '<div class="mj-months">' +
        Array.from({ length: 12 }, (_, i) => i + 1).map(mm =>
          '<button class="mj-month' + (mm === m ? ' active' : '') + '" data-action="cal-jump" data-val="' + y + '-' + UI.pad(mm) + '">' + mm + ' 月</button>').join('') +
      '</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">取消</button></div>');
    const label = modal.box.querySelector('#mj-year-label');
    let yy = y;
    modal.box.querySelectorAll('[data-action="mj-year"]').forEach(b => b.addEventListener('click', () => {
      yy += parseInt(b.dataset.d, 10);
      label.textContent = yy + ' 年';
      modal.box.querySelectorAll('[data-action="cal-jump"]').forEach(x => {
        x.dataset.val = yy + '-' + x.dataset.val.slice(5);
      });
    }));
  }

  /* ================= 预算 ================= */
  function budget() {
    const v = $('#view');
    /* 周期状态：period = month|year|week；key 如 2026-08 / 2026 / 2026-W35 */
    const bs = S().budget || { period: 'month', key: '' };
    const period = bs.period || 'month';
    if (!bs.key) bs.key = Store.budgetKey(period);
    /* 当前周期标签 */
    let label = bs.key;
    if (period === 'month') {
      const { y, m } = UI.parseMonthKey(bs.key);
      label = y + '年' + m + '月';
    } else if (period === 'year') {
      label = bs.key + ' 年';
    } else {
      label = '第 ' + bs.key.replace(/^\d{4}-W/, '') + ' 周（' + bs.key.slice(0, 4) + '）';
    }
    const b = Store.budgetStatus(period, bs.key);
    const total = b.total;
    const pct = total.budget > 0 ? Math.min(100, Math.round(total.used / total.budget * 100)) : 0;
    const remain = Math.round((total.budget - total.used) * 100) / 100;
    const withBudget = {};
    b.cats.forEach(x => { withBudget[x.category.id] = x; });

    v.innerHTML =
      '<div class="page">' +
        '<div class="page-head"><h1>预算管理</h1>' +
          '<div class="stat-ctl cat-ctl">' +
            '<div class="seg">' +
              [['month', '月'], ['year', '年'], ['week', '周']].map(p =>
                '<button class="seg-btn ' + (period === p[0] ? 'active' : '') + '" data-action="budget-period" data-val="' + p[0] + '">' + p[1] + '</button>').join('') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card stat-ctl-card">' +
          '<div class="stat-ctl">' +
            '<button class="btn btn-ghost btn-sm" data-action="budget-nav" data-d="-1">‹</button>' +
            '<span class="stat-ctl-label">' + label + '</span>' +
            '<button class="btn btn-ghost btn-sm" data-action="budget-nav" data-d="1">›</button>' +
            '<button class="btn btn-ghost btn-sm" data-action="budget-today">今天</button>' +
          '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="field-inline"><label>' + (period === 'month' ? '本月' : period === 'year' ? '本年' : '本周') + '总预算（¥）</label><input type="number" id="budget-total" min="0" step="100" value="' + (total.budget || '') + '" placeholder="0 = 不设预算">' +
          '<button class="btn btn-primary btn-sm" data-action="budget-total-save">保存</button></div>' +
          (total.budget > 0
            ? '<div class="progress ' + (pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : '') + '"><i style="width:' + pct + '%"></i></div>' +
              '<div class="budget-meta">' +
                '<span>已用 <b class="v-red">' + money(total.used) + '</b>（' + pct + '%）</span>' +
                '<span>剩余 <b>' + money(remain) + '</b></span>' +
              '</div>'
            : '<div class="data-tip">设置预算后，这里会显示使用进度与超支提醒。</div>') +
        '</div>' +
        '<div class="card">' +
          '<div class="card-title">分类预算</div>' +
          Store.getRootCategories('expense').map(c => {
            const x = withBudget[c.id];
            const p = x ? Math.min(100, Math.round(x.used / x.budget * 100)) : 0;
            return '<div class="budget-cat">' +
              '<div class="budget-cat-head"><span>' + UI.catIcon(c.icon) + ' ' + esc(c.name) + '</span>' +
              (x ? '<span class="' + (p >= 100 ? 'v-red' : 'v-muted') + '">' + money(x.used) + ' / ' + money(x.budget) + '</span>' : '') + '</div>' +
              (x ? '<div class="progress ' + (p >= 100 ? 'danger' : p >= 80 ? 'warn' : '') + '"><i style="width:' + p + '%"></i></div>' : '') +
              '<div class="budget-cat-foot"><input type="number" class="budget-cat-input" data-budget-cat="' + c.id + '" min="0" step="50" value="' + (x ? x.budget : '') + '" placeholder="0 = 不设预算"><span>¥/' + (period === 'month' ? '月' : period === 'year' ? '年' : '周') + '</span></div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  /* ================= 账户 ================= */
  function accounts() {
    const v = $('#view');
    const accs = Store.getAccountsSorted(); // 按排序配置（手动/金额/账单数 + 正反序）
    const sums = Store.loanSums();
    const accOpen = S().accOpen || { acc: true };
    const accCfg = Store.sortCfg('acc');
    const orderOn = accCfg.mode === 'manual' && !!Store.data.settings.accOrder; // 手动模式 + 开启「账户页显示排序按钮」才显示 ↑↓
    const accBody = accs.length
      ? '<div class="acc-grid">' + accs.map((a, i) => {
          const bal = Store.accountBalance(a.id);
          const t = Preset.accountTypes[a.type] || Preset.accountTypes.other;
          return '<div class="acc-row">' +
            '<button class="acc-card" data-action="go-acc" data-val="' + a.id + '" data-acc-id="' + a.id + '">' +
              '<span class="acc-ico" style="background:' + (a.color && a.color !== 'transparent' ? a.color : 'var(--border-soft)') + '">' + UI.catIcon(a.icon) + '</span>' +
              '<span class="acc-main"><span class="acc-name">' + esc(a.name) + (a.hidden ? ' <em class="acc-hidden">已隐藏</em>' : '') + '</span>' +
              '<span class="acc-type">' + t.name + '</span></span>' +
              '<span class="acc-bal">' + money(bal) + '</span>' +
            '</button>' +
            (orderOn
              ? '<span class="acc-order">' +
                  '<button class="acc-order-btn" data-action="acc-move" data-d="-1" data-val="' + a.id + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
                  '<button class="acc-order-btn" data-action="acc-move" data-d="1" data-val="' + a.id + '"' + (i === accs.length - 1 ? ' disabled' : '') + '>↓</button>' +
                '</span>'
              : '') +
          '</div>';
        }).join('') + '</div>'
      : '<div class="data-tip" style="padding:6px 0">还没有账户，点右上角「新账户」创建</div>';
    v.innerHTML =
      '<div class="page acc-page">' +
        '<div class="page-head"><h1>账户管理</h1>' +
          '<div class="head-actions">' +
            '<button class="btn btn-primary btn-sm btn-macaron" data-action="add-acc">＋ 新账户</button>' +
          '</div></div>' +
        '<div class="card assets-card"><div class="assets-label">总资产</div><div class="assets-val">' + money(Store.totalAssets()) + '</div></div>' +
        /* 借贷栏目：位于总资产下方，点击整卡进入借贷专属页 */
        '<div class="card loan-box">' +
          '<div class="card-title"><span>' + UI.icon('loan', 16) + ' 借贷</span></div>' +
          '<button class="loan-summary" data-action="nav" data-nav="/loans">' +
            '<span class="ls-item"><span class="ls-label">应收</span><span class="ls-val v-green">' + money(sums.lend) + '</span></span>' +
            '<span class="ls-item"><span class="ls-label">应付</span><span class="ls-val v-red">' + money(sums.borrow) + '</span></span>' +
            '<span class="ls-item"><span class="ls-label">净应收</span><span class="ls-val">' + money(sums.net) + '</span></span>' +
          '</button>' +
        '</div>' +
        /* 账户一级菜单：默认展开，收纳现金/支付宝等 */
        '<div class="card set-item acc-menu">' +
          '<button class="set-head" data-action="acc-toggle" data-val="acc">' +
            '<span class="set-ico">' + UI.icon('wallet', 18) + '</span><span class="set-title">账户</span>' +
            '<span class="set-arrow">' + (accOpen.acc ? '▾' : '▸') + '</span>' +
          '</button>' +
          '<div class="set-body"' + (accOpen.acc ? '' : ' style="display:none"') + '>' + accBody + '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 账户详情页 ---------- */
  function accountDetail(id) {
    const v = $('#view');
    const a = Store.getAccount(id);
    if (!a) { App.nav('/accounts'); return; }
    const as = S().accStats || { period: 'all', year: new Date().getFullYear(), monthKey: UI.monthKey(new Date().getFullYear(), new Date().getMonth() + 1) };
    /* 周期区间 */
    let from = '', to = '';
    if (as.period === 'year') { from = as.year + '-01-01'; to = as.year + '-12-31'; }
    else if (as.period === 'month') { const { y, m } = UI.parseMonthKey(as.monthKey); from = y + '-' + UI.pad(m) + '-01'; to = y + '-' + UI.pad(m) + '-' + UI.daysInMonth(y, m); }
    const all = Store.getTransactions({ from, to });
    const txs = all.filter(t => t.accountId === id || t.toAccountId === id);
    let inc = 0, exp = 0;
    txs.forEach(t => { if (t.type === 'income') inc += t.amount; else if (t.type === 'expense') exp += t.amount; });
    const groups = {};
    txs.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
    const keys = Object.keys(groups).sort((x, y) => (x < y ? 1 : -1));
    const ctl =
      '<div class="stat-ctl cat-ctl acc-ctl">' +
        '<div class="seg">' +
          [['all', '全部'], ['year', '年'], ['month', '月']].map(p =>
            '<button class="seg-btn ' + (as.period === p[0] ? 'active' : '') + '" data-action="acc-period" data-val="' + p[0] + '">' + p[1] + '</button>').join('') +
        '</div>' +
        (as.period === 'year'
          ? '<span class="acc-ctl-nav">' +
              '<button class="btn btn-ghost btn-sm" data-action="acc-nav" data-d="-1">‹</button>' +
              '<button class="stat-ctl-label" data-action="acc-today" title="回到今年">' + as.year + ' 年</button>' +
              '<button class="btn btn-ghost btn-sm" data-action="acc-nav" data-d="1">›</button>' +
            '</span>'
          : as.period === 'month'
          ? '<span class="acc-ctl-nav">' +
              '<button class="btn btn-ghost btn-sm" data-action="acc-nav" data-d="-1">‹</button>' +
              '<button class="stat-ctl-label" data-action="acc-today" title="回到本月">' + UI.fmtMonthCn(as.monthKey) + '</button>' +
              '<button class="btn btn-ghost btn-sm" data-action="acc-nav" data-d="1">›</button>' +
            '</span>'
          : '') +
      '</div>';
    v.innerHTML =
      '<div class="page acc-page">' +
        '<div class="page-head">' +
          '<button class="btn btn-ghost btn-sm" data-action="nav" data-nav="/accounts">‹ 账户</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="acc-more" data-val="' + id + '">⋮</button>' +
        '</div>' +
        /* 余额栏：图标+名称+余额 顶部，收入/支出 上下排列底部 */
        '<div class="card assets-card acc-detail-head">' +
          '<div class="acc-detail-top">' +
            '<span class="acc-ico" style="background:' + (a.color && a.color !== 'transparent' ? a.color : 'var(--border-soft)') + '">' + UI.catIcon(a.icon) + '</span>' +
            '<div class="acc-detail-main">' +
              '<div class="acc-detail-name">' + esc(a.name) + (a.hidden ? ' <em class="acc-hidden">已隐藏</em>' : '') + '</div>' +
              '<div class="acc-detail-type">' + ((Preset.accountTypes[a.type] || {}).name || '') + '</div>' +
            '</div>' +
            '<div class="acc-detail-bal">余额 <b>' + money(Store.accountBalance(id)) + '</b></div>' +
          '</div>' +
          '<div class="acc-detail-flows">' +
            '<div class="acc-flow-row"><span class="acc-flow-label">收入</span><span class="v-green">' + money(inc) + '</span></div>' +
            '<div class="acc-flow-row"><span class="acc-flow-label">支出</span><span class="v-red">' + money(exp) + '</span></div>' +
          '</div>' +
        '</div>' +
        /* 操作栏：记一笔 2/3 左 + 转账 1/3 右 */
        '<div class="acc-actions-row">' +
          '<button class="btn btn-primary btn-macaron acc-action-record" data-action="acc-record" data-val="' + id + '">＋ 记一笔</button>' +
          '<button class="btn btn-ghost acc-action-transfer" data-action="acc-transfer" data-val="' + id + '">⇄ 转账</button>' +
        '</div>' +
        /* 周期栏：与操作栏贴紧 */
        '<div class="card stat-ctl-card acc-ctl-card">' + ctl +
        '</div>' +
        '<div class="card bill-card">' +
          '<div class="bill-head-row"><span class="bill-title">' + UI.icon('list', 15) + ' 账户账单（' + txs.length + ' 笔）</span></div>' +
          (keys.length
            ? keys.map(k =>
                '<div class="tx-group flat">' +
                  '<div class="tx-group-head"><span>' + UI.fmtDateCn(k) + ' ' + UI.weekday(k) + '</span></div>' +
                  groups[k].map(txRow).join('') +
                '</div>').join('')
            : emptyHTML('📭', '该周期暂无账单')) +
        '</div>' +
      '</div>';
  }

  /* 账户 ⋮ 菜单 */
  function accMoreMenu(id) {
    const a = Store.getAccount(id);
    if (!a) return;
    UI.modal('账户操作',
      '<div class="menu-list">' +
        '<button class="menu-item" data-action="acc-edit" data-val="' + id + '">✏️ 编辑账户</button>' +
        '<button class="menu-item" data-action="acc-del" data-val="' + id + '">🗑 删除账户</button>' +
      '</div>');
  }

  /* ---------- 账户弹窗 ---------- */
  function openAccModal(id) {
    const a = id ? Store.getAccount(id) : null;
    const typesGrid = Object.entries(Preset.accountTypes).map(([k, t]) =>
      '<button type="button" class="acc-type-cell' + (a && a.type === k ? ' active' : '') + '" data-acc-type="' + k + '">' +
        '<span class="acc-type-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + t.svg + '</svg></span>' +
        '<span class="acc-type-name">' + t.name + '</span>' +
      '</button>').join('');
    /* 弹窗内一级折叠菜单（默认收起） */
    const fold = (key, title, body) =>
      '<div class="modal-fold">' +
        '<button type="button" class="modal-fold-head" data-fold="' + key + '">' +
          '<span>' + title + '</span><span class="modal-fold-arrow">▸</span>' +
        '</button>' +
        '<div class="modal-fold-body" style="display:none">' + body + '</div>' +
      '</div>';
    const icoBody =
      '<div class="pay-grid">' + Preset.payIcons.map(p =>
        '<button class="pay-cell" data-pay="' + p.v + '">' +
          '<span class="pay-ico">' + UI.catIcon(p.v) + '</span><span class="pay-name">' + p.n + '</span>' +
        '</button>').join('') + '</div>' +
      '<div class="ico-upload">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="ico-upload">📤 上传自定义图标</button>' +
        '<input type="file" id="ico-file" accept="image/*" style="display:none">' +
        '<span class="ico-upload-tip">支持 PNG/JPG，≤300KB；上传后保存到本机</span>' +
      '</div>';
    const colorBody = '<div class="color-row">' +
      '<button class="color-cell transparent" data-color="transparent" title="透明"></button>' +
      Preset.macaron.map(c =>
        '<button class="color-cell" style="background:' + c + '" data-color="' + c + '"></button>').join('') + '</div>';
    const modal = UI.modal(a ? '编辑账户' : '新建账户',
      '<div class="field"><label>账户名称</label><input id="acc-name" value="' + (a ? esc(a.name) : '') + '" placeholder="如：招商银行储蓄卡"></div>' +
      fold('type', '账户类型', '<div class="acc-type-grid">' + typesGrid + '</div>') +
      fold('ico', '图标（支付方式）', icoBody) +
      fold('color', '颜色', colorBody) +
      '<div class="field"><label>初始余额（¥）</label><input type="number" id="acc-balance" step="0.01" value="' + (a ? String(a.initialBalance) : '0') + '"></div>' +
      '<label class="check"><input type="checkbox" id="acc-hidden"' + (a && a.hidden ? ' checked' : '') + '> 隐藏该账户（不参与统计与选择列表）</label>' +
      '<label class="check"><input type="checkbox" id="acc-assets"' + (a && a.includeAssets === false ? '' : ' checked') + '> 计入总资产</label>' +
      '<div class="modal-actions">' +
        (a ? '<button class="btn btn-danger" data-action="del-acc" data-val="' + a.id + '">删除</button>' : '') +
        '<button class="btn btn-ghost" data-action="modal-close">取消</button>' +
        '<button class="btn btn-primary" data-action="save-acc" data-val="' + (a ? a.id : '') + '">保存</button>' +
      '</div>');
    const box = modal.box;
    /* 折叠菜单：展开/收起 */
    box.querySelectorAll('[data-fold]').forEach(h => h.addEventListener('click', () => {
      const body = h.nextElementSibling;
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      h.querySelector('.modal-fold-arrow').textContent = open ? '▸' : '▾';
    }));
    /* 账户类型选择 */
    box.dataset.accType = a ? a.type : 'cash';
    box.querySelectorAll('[data-acc-type]').forEach(b => b.addEventListener('click', () => {
      box.dataset.accType = b.dataset.accType;
      box.querySelectorAll('[data-acc-type]').forEach(x => x.classList.toggle('active', x === b));
    }));
    let emoji = a ? a.icon : Preset.payIcons[0].v;
    let color = a ? a.color : Preset.macaron[Store.getAccounts().length % Preset.macaron.length];
    box.dataset.accEmoji = emoji;
    box.dataset.accColor = color;
    const cells = box.querySelectorAll('.pay-cell');
    const colors = box.querySelectorAll('.color-cell');
    const mark = () => {
      cells.forEach(c => c.classList.toggle('active', c.dataset.pay === emoji));
      colors.forEach(c => c.classList.toggle('active', c.dataset.color === color));
    };
    cells.forEach(c => c.addEventListener('click', () => { emoji = c.dataset.pay; box.dataset.accEmoji = emoji; mark(); }));
    colors.forEach(c => c.addEventListener('click', () => { color = c.dataset.color; box.dataset.accColor = color; mark(); }));
    mark();
  }

  /* ---------- 转账专属页 ----------
     转出账户固定（来自路由 ?id=）；转入账户五列网格（显示余额）；
     各栏位 label 与输入框同一行；确认右上角、取消左上角 */
  function transferPage(id) {
    const v = $('#view');
    const accs = Store.getAccounts();
    if (accs.length < 2) { UI.toast('至少需要两个账户才能转账', 'err'); return; }
    const fromId = id || (S().transfer && S().transfer.from) || accs[0].id;
    const fromAcc = Store.getAccount(fromId) || accs[0];
    const others = accs.filter(a => a.id !== fromId);
    /* 转入账户五列网格：图标 + 名称 + 余额 */
    const grid = others.map(a =>
      '<button type="button" class="tf-acc-cell' + (S().transfer && S().transfer.to === a.id ? ' active' : '') + '" data-action="tf-pick" data-val="' + a.id + '">' +
        '<span class="acc-mini" style="background:' + (a.color && a.color !== 'transparent' ? a.color : 'var(--border-soft)') + '">' + UI.catIcon(a.icon) + '</span>' +
        '<span class="tf-acc-name">' + esc(a.name) + '</span>' +
        '<span class="tf-acc-bal">' + money(Store.accountBalance(a.id)) + '</span>' +
      '</button>'
    ).join('');
    S().transfer = S().transfer || { from: null, to: null, atts: [] };
    S().transfer.from = fromId;
    const atts = S().transfer.atts || [];
    const chips = atts.length
      ? atts.map((a, i) => '<span class="rp-chip">' + (a.type && a.type.indexOf('image') === 0 ? '🖼️' : '📄') + ' ' + esc(a.name) +
          '<button class="rp-chip-x" data-action="tf-att-remove" data-idx="' + i + '">×</button></span>').join('')
      : '<span class="rp-empty">还没有附件</span>';
    v.innerHTML =
      '<div class="page page-transfer">' +
        '<div class="page-head tf-head">' +
          '<button class="btn btn-ghost btn-sm" data-action="nav" data-nav="/account?id=' + fromId + '">取消</button>' +
          '<h1>转账</h1>' +
          '<button class="btn btn-primary btn-sm" data-action="save-transfer">确认</button>' +
        '</div>' +
        '<div class="card">' +
          '<div class="field-inline"><label>转出账户</label>' +
            '<span class="tf-from-fixed">' +
              '<span class="acc-mini" style="background:' + (fromAcc.color && fromAcc.color !== 'transparent' ? fromAcc.color : 'var(--border-soft)') + '">' + UI.catIcon(fromAcc.icon) + '</span>' +
              '<span>' + esc(fromAcc.name) + '</span>' +
              '<span class="tf-from-bal">余额 ' + money(Store.accountBalance(fromId)) + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="field"><label>转入账户</label>' +
            '<div class="tf-acc-grid tf-acc-grid-5" id="tf-acc-grid">' + grid + '</div>' +
            '<div class="tf-acc-sel" id="tf-acc-sel">' +
              (S().transfer.to
                ? '已选择：' + esc((Store.getAccount(S().transfer.to) || {}).name || '')
                : '未选择') +
            '</div>' +
          '</div>' +
          '<div class="field-inline"><label>实际到账金额（¥）</label><input type="number" id="tf-amount" step="0.01" placeholder="0.00"></div>' +
          '<div class="field-inline"><label>手续费（¥）</label><input type="number" id="tf-fee" step="0.01" value="0" placeholder="0"><span class="tf-fee-tip">从当前账户扣除</span></div>' +
          '<div class="field-inline"><label>日期</label><input type="date" id="tf-date" value="' + UI.todayStr() + '"></div>' +
          '<div class="field-inline"><label>备注</label><input type="text" id="tf-note" placeholder="如：还信用卡"></div>' +
          '<div class="field-inline"><label>附件</label>' +
            '<div class="tf-attach-wrap">' +
              '<div class="rp-add-row">' +
                '<button class="btn btn-ghost btn-sm" data-action="tf-attach-src" data-src="camera">📷 相机</button>' +
                '<button class="btn btn-ghost btn-sm" data-action="tf-attach-src" data-src="gallery">🖼️ 相册</button>' +
                '<button class="btn btn-ghost btn-sm" data-action="tf-attach-src" data-src="file">📁 文件</button>' +
              '</div>' +
              '<div class="tf-attach-chips" id="tf-attach-chips">' + chips + '</div>' +
              '<input type="file" id="tf-attach" style="display:none" accept="image/*" multiple>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* 转账页：选择转入账户 */
  function pickTfAccount(id) {
    S().transfer = S().transfer || { from: null, to: null, atts: [] };
    S().transfer.to = id;
    const fromId = S().transfer.from;
    transferPage(fromId);
  }

  /* 转账页：附件选择 */
  function tfAttachPick(src) {
    const input = $('#tf-attach');
    if (!input) return;
    input.removeAttribute('capture');
    if (src === 'camera') input.setAttribute('capture', 'environment');
    input.click();
  }

  async function tfAttachAdd(files) {
    const input = $('#tf-attach');
    if (!input) return;
    const list = Array.from(files || []);
    input.value = '';
    S().transfer = S().transfer || { from: null, to: null, atts: [] };
    const atts = S().transfer.atts || [];
    for (const f of list) {
      if (f.size > 2.5 * 1024 * 1024) { UI.toast('「' + f.name + '」超过 2.5MB，未添加', 'err'); continue; }
      const att = await attachmentToData(f);
      if (!att.data) { UI.toast('「' + f.name + '」读取失败', 'err'); continue; }
      atts.push(att);
    }
    S().transfer.atts = atts;
    transferPage(S().transfer.from);
  }

  function tfAttachRemove(idx) {
    S().transfer = S().transfer || { from: null, to: null, atts: [] };
    S().transfer.atts.splice(Number(idx), 1);
    transferPage(S().transfer.from);
  }

  /* ================= 设置 ================= */
  function settings() {
    const v = $('#view');
    const s = Store.data.settings;
    const t = S().settingsCatType;
    const roots = Store.getRootCategoriesSorted(t);
    const expand = S().expandCats || {};
    const recs = Store.getRecurrings();
    const recsEnabled = recs.filter(r => r.enabled).length;
    const open = S().settingsOpen || {};

    /* 一级菜单项（点击展开/收起） */
    const item = (key, ico, title, body) =>
      '<div class="card set-item">' +
        '<button class="set-head" data-action="set-toggle" data-val="' + key + '">' +
          '<span class="set-ico">' + UI.icon(ico, 18) + '</span><span class="set-title">' + title + '</span>' +
          '<span class="set-arrow">' + (open[key] ? '▾' : '▸') + '</span>' +
        '</button>' +
        '<div class="set-body"' + (open[key] ? '' : ' style="display:none"') + '>' + body + '</div>' +
      '</div>';

    /* 分类管理 */
    const catBody =
      '<label class="check cat-color-switch">' +
        '<input type="checkbox" id="cat-color"' + (iconColorOn() ? ' checked' : '') + '> ' +
        '<span>分类图标颜色</span>' +
        '<em class="cat-color-tip">' + (iconColorOn() ? '已开启：图标使用分类颜色（可在编辑中修改）' : '已关闭：所有图标为黑色') + '</em>' +
      '</label>' +
      '<div class="seg" style="margin-bottom:10px">' +
        '<button class="seg-btn ' + (t === 'expense' ? 'active' : '') + '" data-action="set-cat-type" data-val="expense">支出分类</button>' +
        '<button class="seg-btn ' + (t === 'income' ? 'active' : '') + '" data-action="set-cat-type" data-val="income">收入分类</button>' +
      '</div>' +
      roots.map((c, ri) => {
        const subs = Store.getSubCategories(c.id);
        const openC = !!expand[c.id];
        return '<div class="cat-manage-row">' +
          '<span class="cat-manage-ico"' + iconStyle(c.color) + '>' + UI.catIcon(c.icon) + '</span>' +
          '<span class="cat-manage-name">' + esc(c.name) +
            (subs.length ? ' <em class="cat-sub-count">' + subs.length + ' 个子分类</em>' : '') + '</span>' +
          '<span class="cat-manage-actions">' +
            '<button class="acc-order-btn" data-action="cat-move" data-d="-1" data-val="' + c.id + '"' + (ri === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="acc-order-btn" data-action="cat-move" data-d="1" data-val="' + c.id + '"' + (ri === roots.length - 1 ? ' disabled' : '') + '>↓</button>' +
            (subs.length ? '<button class="btn btn-ghost btn-sm" data-action="toggle-cat-subs" data-val="' + c.id + '">' + (openC ? '收起' : '展开') + '</button>' : '') +
            '<button class="btn btn-ghost btn-sm" data-action="add-sub-cat" data-val="' + c.id + '">＋子</button>' +
            '<button class="btn btn-ghost btn-sm" data-action="edit-cat" data-val="' + c.id + '">编辑</button>' +
          '</span>' +
        '</div>' +
        (openC && subs.length
          ? subs.map((sub, si) =>
              '<div class="cat-manage-row cat-sub-row">' +
                '<span class="cat-manage-ico"' + iconStyle(sub.color) + '>' + UI.catIcon(sub.icon) + '</span>' +
                '<span class="cat-manage-name">↳ ' + esc(sub.name) + '</span>' +
                '<span class="cat-manage-actions">' +
                  '<button class="acc-order-btn" data-action="sub-move" data-d="-1" data-parent="' + c.id + '" data-val="' + sub.id + '"' + (si === 0 ? ' disabled' : '') + '>↑</button>' +
                  '<button class="acc-order-btn" data-action="sub-move" data-d="1" data-parent="' + c.id + '" data-val="' + sub.id + '"' + (si === subs.length - 1 ? ' disabled' : '') + '>↓</button>' +
                  '<button class="btn btn-ghost btn-sm" data-action="edit-cat" data-val="' + sub.id + '">编辑</button>' +
                '</span>' +
              '</div>'
            ).join('')
          : '');
      }).join('') +
      '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-action="add-cat">＋ 新增' + (t === 'expense' ? '支出' : '收入') + '分类</button>';

    /* 周期账单 */
    const recBody =
      '<div class="head-actions" style="margin-bottom:8px"><button class="btn btn-primary btn-sm" data-action="add-rec">＋ 新建周期</button></div>' +
      '<div class="data-tip" style="margin-bottom:8px">房租、订阅、工资等固定收支：到期后在首页提醒，一键入账并自动顺延下一周期。共 ' + recs.length + ' 条，' + recsEnabled + ' 条启用。</div>' +
      (recs.length
        ? recs.map(recRow).join('')
        : '<div class="data-tip" style="padding:6px 0">还没有周期账单，点「新建周期」创建，如每月 15 日交房租。</div>');

    /* 外观 */
    const themeBody =
      '<div class="theme-row">' +
        [['light', '☀️ 浅色'], ['dark', '🌙 深色'], ['auto', '🖥️ 跟随系统']].map(p =>
          '<button class="btn ' + (s.theme === p[0] ? 'btn-primary' : 'btn-ghost') + '" data-action="theme-set" data-val="' + p[0] + '">' + p[1] + '</button>'
        ).join('') +
      '</div>' +
      '<div class="theme-row theme-font">' +
        '<span class="theme-label">字体</span>' +
        Preset.fonts.map(f =>
          '<button class="btn ' + (s.font === f.v ? 'btn-primary' : 'btn-ghost') + '" data-action="font-set" data-val="' + f.v + '">' + f.n + '</button>'
        ).join('') +
      '</div>';

    /* 排序管理 */
    const sortCfg = Store.data.settings.sort || {};
    const sortSeg = (level, type, label) => {
      /* 账户排序配置从 sort.acc 读取（type 为空），分类从 sort[level][type] 读取，保证账户模式按钮高亮/倒序与分类一致 */
      const cfg = level === 'acc'
        ? (sortCfg.acc || { mode: 'manual', desc: false })
        : ((sortCfg[level] || {})[type] || { mode: 'freq', desc: false });
      const modes = level === 'acc'
        ? [['manual', '手动'], ['amount', '按金额'], ['count', '按账单数']]
        : [['manual', '手动'], ['freq', '按使用频率']];
      let descRow;
      if (cfg.mode === 'manual') {
        descRow = level === 'acc'
          ? '<label class="check"><input type="checkbox" data-action="acc-order"' + (Store.data.settings.accOrder ? ' checked' : '') + '> 账户页显示排序按钮（↑↓）</label>'
          : '<span class="sort-desc">手动排序请在对应管理页用 ↑↓ 调整</span>';
      } else {
        descRow = '<label class="check"><input type="checkbox" data-action="sort-desc" data-level="' + level + '" data-type="' + (type || '') + '"' + (cfg.desc ? ' checked' : '') + '> 倒序</label>';
      }
      return '<div class="sort-block">' +
        '<div class="sort-label">' + label + '</div>' +
        '<div class="seg">' + modes.map(md =>
          '<button class="seg-btn ' + (cfg.mode === md[0] ? 'active' : '') + '" data-action="sort-mode" data-level="' + level + '" data-type="' + (type || '') + '" data-val="' + md[0] + '">' + md[1] + '</button>'
        ).join('') + '</div>' +
        '<div class="sort-desc-row">' + descRow + '</div>' +
      '</div>';
    };
    const sortBody =
      '<div class="data-tip" style="margin-bottom:8px">分类手动排序在「分类管理」中调整；账户手动排序在「账户」页调整。使用手动排序后自动切换为手动模式。</div>' +
      sortSeg('cat1', 'expense', '一级支出分类') +
      sortSeg('cat1', 'income', '一级收入分类') +
      sortSeg('cat2', 'expense', '二级支出分类') +
      sortSeg('cat2', 'income', '二级收入分类') +
      sortSeg('acc', '', '账户');

    /* 功能管理 */
    const funcs = Store.data.settings.funcs || { homeTextBill: true };
    const funcBody =
      '<label class="check">' +
        '<input type="checkbox" data-action="func-toggle" data-val="homeTextBill"' + (funcs.homeTextBill !== false ? ' checked' : '') + '> ' +
        '<span>首页文字记账</span>' +
        '<em class="cat-color-tip">' + (funcs.homeTextBill !== false ? '已开启：首页右下角显示「文字记账」圆形按钮' : '已关闭：首页隐藏文字记账入口') + '</em>' +
      '</label>' +
      '<div class="data-tip">控制首页右下角「文字记账」快捷入口是否显示。</div>';

    /* 记账提醒 */
    const reminders = Store.data.settings.reminders || [];
    const remindBody =
      '<div class="data-actions" style="margin-bottom:8px">' +
        '<button class="btn btn-primary btn-sm" data-action="open-remind">＋ 新增提醒</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="remind-notify">🔔 开启系统通知</button>' +
      '</div>' +
      (reminders.length
        ? reminders.map(r =>
            '<div class="remind-row">' +
              '<label class="check" style="margin:0"><input type="checkbox" data-action="toggle-remind" data-val="' + r.id + '"' + (r.enabled ? ' checked' : '') + '></label>' +
              '<span class="remind-main">' +
                '<span class="remind-name">' + esc(remindModeText(r)) + ' ' + esc(r.time) + '</span>' +
                (r.note ? '<span class="remind-note">' + esc(r.note) + '</span>' : '') +
              '</span>' +
              '<button class="btn btn-ghost btn-sm" data-action="edit-remind" data-val="' + r.id + '">编辑</button>' +
            '</div>').join('')
        : '<div class="data-tip">还没有提醒。可设置每天 / 每周 / 每月定时提醒记账；开启系统通知后，应用打开时会按时提醒你。</div>') +
      '<div class="data-tip">提醒在应用打开时生效（网页无法后台常驻），建议把应用添加到主屏幕。</div>';

    /* 数据管理 */
    const dataBody =
      '<div class="data-actions">' +
        '<button class="btn btn-ghost" data-action="open-import">📄 导入 Excel / CSV</button>' +
        '<button class="btn btn-ghost" data-action="export-json">⬇ 导出备份 (JSON)</button>' +
        '<button class="btn btn-ghost" data-action="import-json">⬆ 导入备份</button>' +
        '<button class="btn btn-ghost" data-action="export-csv">📄 导出 CSV</button>' +
        '<button class="btn btn-ghost" data-action="load-sample">🧪 载入示例数据</button>' +
        '<button class="btn btn-ghost danger-text" data-action="clear-all">🗑 清空全部数据</button>' +
      '</div>' +
      '<input type="file" id="import-file" accept=".json,application/json" style="display:none">' +
      '<div class="data-tip">所有数据仅保存在本浏览器 localStorage 中，清除浏览器数据前请先导出备份。</div>';

    /* 安装到桌面 */
    let installBody = '';
    const pwa = (window.App && App.getInstallState) ? App.getInstallState() : { installed: false, canInstall: false, ios: false };
    if (pwa.installed) {
      installBody = '<div class="data-tip" style="margin:0">✅ 已安装到桌面：从主屏幕图标打开，可全屏使用并离线缓存。</div>';
    } else if (pwa.canInstall) {
      installBody =
        '<div class="data-actions">' +
          '<button class="btn btn-primary" data-action="install-pwa">📲 安装到桌面</button>' +
        '</div>' +
        '<div class="data-tip">点击后按系统提示确认，即可在桌面生成轻账单图标（类似普通 App，可全屏、离线使用）。</div>';
    } else if (pwa.ios) {
      installBody =
        '<div class="data-tip" style="line-height:1.9">iPhone / iPad 请按下面步骤添加到主屏幕：<br>' +
        '① 用 <b>Safari 浏览器</b>打开本页<br>' +
        '② 点底部「分享」按钮（方框＋向上箭头）<br>' +
        '③ 选「添加到主屏幕」<br>' +
        '④ 点右上角「添加」即可。</div>';
    } else {
      installBody =
        '<div class="data-tip" style="line-height:1.9">请用手机浏览器菜单添加到桌面：<br>' +
        '· Chrome / Edge：右上角 ⋮ →「安装应用」或「添加到主屏幕」<br>' +
        '· 其他浏览器：菜单 →「添加到主屏幕 / 桌面」<br>' +
        '· 若没有该选项，请用 Chrome 或 Safari 打开本页再试。</div>';
    }

    /* 关于（含安装到桌面） */
    const aboutBody =
      '<div class="about-name">🧾 轻账单 LiteBill<span class="about-ver">' + ((window.App && App.VERSION) || 'v1.117.0') + '</span></div>' +
      '<div class="about-desc">本地优先的个人记账应用：记账、分类、账户、统计、预算、借贷、周期账单、文字记账、导入导出。数据不离开你的设备。</div>' +
      '<div class="about-install">' + installBody + '</div>' +
      '<div class="about-update">' +
        '<button class="btn btn-primary btn-sm" data-action="check-update">🔄 检查更新</button>' +
        '<span class="data-tip">从当前打开的网页地址获取最新版，自动下载并刷新，无需移除图标。</span>' +
      '</div>' +
      '<div class="update-url-row">' +
        '<input type="url" id="update-url" placeholder="填入更新源网址（如新的临时地址/永久地址）">' +
        '<button class="btn btn-primary btn-sm" data-action="update-from-url">从网址更新</button>' +
      '</div>' +
      '<div class="data-tip">隧道或地址更换后，把最新版所在的网址填到上面，即可从该网址更新到最新版。</div>';

    v.innerHTML =
      '<div class="page">' +
        '<div class="page-head"><h1>设置</h1></div>' +
        item('cat', 'category', '分类管理', catBody) +
        item('rec', 'calendar', '周期账单', recBody) +
        item('remind', 'time', '记账提醒', remindBody) +
        item('theme', 'palette', '外观', themeBody) +
        item('sort', 'list', '排序管理', sortBody) +
        item('func', 'gear', '功能管理', funcBody) +
        item('data', 'data', '数据管理', dataBody) +
        item('about', 'info', '关于', aboutBody) +
      '</div>';
  }

  /* ---------- 记账提醒 ---------- */
  const WEEK_NAMES = ['', '一', '二', '三', '四', '五', '六', '日'];
  function remindModeText(r) {
    if (r.mode === 'weekly') return '每周 ' + ((r.weekDays || []).map(d => '周' + (WEEK_NAMES[d] || '日')).join('、') || '—');
    if (r.mode === 'monthly') return '每月 ' + (r.monthDay || 1) + ' 号';
    return '每天';
  }
  function openRemindModal(id) {
    const r = id ? (Store.data.settings.reminders || []).find(x => x.id === id) : null;
    const mode = r ? r.mode : 'daily';
    const modal = UI.modal(r ? '编辑提醒' : '新增提醒',
      '<div class="field"><label>模式</label><div class="seg">' +
        [['daily', '每天'], ['weekly', '每周'], ['monthly', '每月']].map(p =>
          '<button class="seg-btn ' + (mode === p[0] ? 'active' : '') + '" data-action="remind-mode" data-val="' + p[0] + '">' + p[1] + '</button>').join('') +
      '</div></div>' +
      '<div class="field"><label>时间</label><input type="time" id="remind-time" value="' + (r ? esc(r.time) : '20:00') + '" style="padding:9px 10px;border-radius:10px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);font-size:15px"></div>' +
      '<div class="field" id="remind-week-wrap"' + (mode === 'weekly' ? '' : ' style="display:none"') + '><label>星期几（可多选）</label><div class="remind-week">' +
        [1, 2, 3, 4, 5, 6, 7].map(d =>
          '<button type="button" class="remind-day' + ((r && (r.weekDays || []).includes(d)) ? ' active' : '') + '" data-day="' + d + '">' + WEEK_NAMES[d] + '</button>').join('') +
      '</div></div>' +
      '<div class="field" id="remind-month-wrap"' + (mode === 'monthly' ? '' : ' style="display:none"') + '><label>每月几号</label><input type="number" id="remind-day" min="1" max="31" value="' + (r ? esc(String(r.monthDay || 1)) : '1') + '" style="padding:9px 10px;border-radius:10px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);font-size:15px;width:110px"></div>' +
      '<div class="field"><label>备注</label><input id="remind-note" value="' + (r ? esc(r.note || '') : '') + '" placeholder="如：发工资了记得记账"></div>' +
      '<label class="check"><input type="checkbox" id="remind-enabled"' + (!r || r.enabled ? ' checked' : '') + '> 启用</label>' +
      '<div class="modal-actions">' +
        (r ? '<button class="btn btn-danger" data-action="del-remind" data-val="' + r.id + '">删除</button>' : '') +
        '<button class="btn btn-ghost" data-action="modal-close">取消</button>' +
        '<button class="btn btn-primary" data-action="save-remind" data-val="' + (r ? r.id : '') + '">保存</button>' +
      '</div>');
    const box = modal.box;
    box.dataset.remindMode = mode;
    box.dataset.remindDays = (r && (r.weekDays || []).join(',')) || '';
    box.querySelectorAll('[data-action="remind-mode"]').forEach(b => b.addEventListener('click', () => {
      box.dataset.remindMode = b.dataset.val;
      box.querySelectorAll('[data-action="remind-mode"]').forEach(x => x.classList.toggle('active', x === b));
      box.querySelector('#remind-week-wrap').style.display = b.dataset.val === 'weekly' ? '' : 'none';
      box.querySelector('#remind-month-wrap').style.display = b.dataset.val === 'monthly' ? '' : 'none';
    }));
    box.querySelectorAll('.remind-day').forEach(b => b.addEventListener('click', () => {
      const set = new Set((box.dataset.remindDays || '').split(',').filter(Boolean).map(Number));
      const v = Number(b.dataset.day);
      if (set.has(v)) set.delete(v); else set.add(v);
      box.dataset.remindDays = [...set].join(',');
      b.classList.toggle('active', set.has(v));
    }));
  }

  /* ---------- 分类弹窗（parentId 用于创建二级分类） ---------- */
  function openCatModal(id, parentId, typeHint) {
    const c = id ? Store.getCategory(id) : null;
    const parent = parentId ? Store.getCategory(parentId) : null;
    const type = c ? c.type : (parent ? parent.type : (typeHint || S().settingsCatType));
    const title = c ? '编辑分类' : (parent ? '新增「' + parent.name + '」子分类' : '新增' + (type === 'expense' ? '支出' : '收入') + '分类');
    S().pendingCatParent = parentId || null;
    S().settingsCatType = type;
    /* 一级折叠菜单（图标/颜色，默认收起） */
    const fold = (key, ftitle, body) =>
      '<div class="modal-fold">' +
        '<button type="button" class="modal-fold-head" data-fold="' + key + '">' +
          '<span>' + ftitle + '</span><span class="modal-fold-arrow">▸</span>' +
        '</button>' +
        '<div class="modal-fold-body" style="display:none">' + body + '</div>' +
      '</div>';
    const icoKeys = Object.keys(Preset.lineIcons);
    const icoBody = '<div class="line-icon-grid">' + icoKeys.map(k =>
      '<button class="line-icon-cell" data-icon="' + k + '" title="' + k + '">' + UI.catIcon(k) + '</button>').join('') + '</div>' +
      '<div class="ico-upload">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="ico-upload">📤 上传自定义图标</button>' +
        '<input type="file" id="ico-file" accept="image/*" style="display:none">' +
        '<span class="ico-upload-tip">支持 PNG/JPG，≤300KB</span>' +
      '</div>';
    const colorBody = '<div class="color-row">' + Preset.macaron.map(col =>
      '<button class="color-cell" style="background:' + col + '" data-color="' + col + '"></button>').join('') + '</div>';
    const modal = UI.modal(title,
      '<div class="field"><label>分类名称</label><input id="cat-name" value="' + (c ? esc(c.name) : '') + '" placeholder="如：宠物"></div>' +
      fold('ico', '图标（线条简约风）', icoBody) +
      fold('color', '颜色（马卡龙）', colorBody) +
      '<div class="modal-actions">' +
        (c ? '<button class="btn btn-danger" data-action="del-cat" data-val="' + c.id + '">删除</button>' : '') +
        '<button class="btn btn-ghost" data-action="modal-close">取消</button>' +
        '<button class="btn btn-primary" data-action="save-cat" data-val="' + (c ? c.id : '') + '">保存</button></div>');
    const box = modal.box;
    /* 折叠菜单展开/收起 */
    box.querySelectorAll('[data-fold]').forEach(h => h.addEventListener('click', () => {
      const body = h.nextElementSibling;
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      h.querySelector('.modal-fold-arrow').textContent = open ? '▸' : '▾';
    }));
    let icon = c && icoKeys.indexOf(c.icon) !== -1 ? c.icon : icoKeys[0];
    let color = c ? c.color : Preset.macaron[0];
    box.dataset.catEmoji = icon;
    box.dataset.catColor = color;
    const cells = box.querySelectorAll('.line-icon-cell');
    const colors = box.querySelectorAll('.color-cell');
    const mark = () => {
      cells.forEach(x => x.classList.toggle('active', x.dataset.icon === icon));
      colors.forEach(x => x.classList.toggle('active', x.dataset.color === color));
    };
    cells.forEach(x => x.addEventListener('click', () => { icon = x.dataset.icon; box.dataset.catEmoji = icon; mark(); }));
    colors.forEach(x => x.addEventListener('click', () => { color = x.dataset.color; box.dataset.catColor = color; mark(); }));
    mark();
  }

  /* ================= 借贷 ================= */
  function loanRow(l) {
    const isLend = l.type === 'lend';
    const color = isLend ? '#30a46c' : '#e5484d';
    const settled = l.status === 'settled';
    const acc = Store.getAccount(l.accountId);
    const la = Store.getLoanAccount(l.loanAccountId);
    return '<div class="card loan-row">' +
      '<span class="loan-ico" style="background:' + color + '">' + UI.icon('loan', 18) + '</span>' +
      '<span class="loan-main">' +
        '<span class="loan-name">' + esc((la && la.name) || '未命名') +
          ' <em class="loan-badge" style="color:' + color + ';background:' + UI.hexToRgba(color, 0.12) + '">' + (isLend ? '借出' : '借入') + '</em>' +
          (settled ? ' <em class="loan-badge loan-done">已结清</em>' : '') + '</span>' +
        '<span class="loan-sub">' + UI.fmtDateCn(l.date) +
          (l.dueDate ? ' · 应还 ' + UI.fmtDateCn(l.dueDate) : '') +
          (acc ? ' · ' + esc(acc.name) : '') +
          (l.note ? ' · ' + esc(l.note) : '') + '</span>' +
      '</span>' +
      '<span class="loan-right">' +
        '<span class="loan-amt ' + (isLend ? 'v-green' : 'v-red') + '">' + (isLend ? '+' : '-') + money(l.amount) + '</span>' +
        '<span class="loan-actions">' +
          (!settled ? '<button class="btn btn-primary btn-sm" data-action="settle-loan" data-val="' + l.id + '">结清</button>' : '') +
          '<button class="btn btn-ghost btn-sm" data-action="edit-loan" data-val="' + l.id + '">编辑</button>' +
          '<button class="btn btn-ghost btn-sm danger-text" data-action="del-loan" data-val="' + l.id + '">删除</button>' +
        '</span>' +
      '</span>' +
    '</div>';
  }

  /* 借贷专属页面：顶部同款借贷栏目 + 借贷账户 */
  function loans() {
    const v = $('#view');
    const sums = Store.loanSums();
    const accs = Store.getLoanAccounts();
    const openAccId = S().loanAccOpen;
    v.innerHTML =
      '<div class="page">' +
        '<div class="page-head"><h1>借贷管理</h1>' +
          '<div class="head-actions">' +
            '<button class="btn btn-ghost btn-sm" data-action="add-loan-acc">＋ 借贷账户</button>' +
            '<button class="btn btn-primary btn-sm" data-action="add-loan">＋ 记一笔借贷</button>' +
          '</div></div>' +
        /* 同款借贷栏目 */
        '<div class="card">' +
          '<div class="card-title"><span>' + UI.icon('loan', 16) + ' 借贷概览</span>' +
            '<button class="btn btn-ghost btn-sm" data-action="nav" data-nav="/accounts">账户页 →</button></div>' +
          '<div class="loan-summary">' +
            '<span class="ls-item"><span class="ls-label">应收</span><span class="ls-val v-green">' + money(sums.lend) + '</span></span>' +
            '<span class="ls-item"><span class="ls-label">应付</span><span class="ls-val v-red">' + money(sums.borrow) + '</span></span>' +
            '<span class="ls-item"><span class="ls-label">净应收</span><span class="ls-val">' + money(sums.net) + '</span></span>' +
          '</div>' +
        '</div>' +
        /* 借贷账户列表 */
        '<div class="card">' +
          '<div class="card-title">借贷账户</div>' +
          (accs.length
            ? accs.map(a => {
                const s = Store.loanSums(a.id);
                const open = openAccId === a.id;
                return '<div class="loan-acc-card">' +
                  '<button class="loan-acc-head" data-action="loan-acc-open" data-val="' + a.id + '">' +
                    '<span class="loan-acc-ico" style="background:' + (a.color || '#2f9e44') + '">' + UI.icon('person', 16) + '</span>' +
                    '<span class="loan-acc-name">' + esc(a.name) + '</span>' +
                    '<span class="loan-acc-arrow">' + (open ? '▾' : '▸') + '</span>' +
                  '</button>' +
                  '<div class="loan-acc-sub">应收 <span class="v-green">' + money(s.lend) + '</span> · 应付 <span class="v-red">' + money(s.borrow) + '</span></div>' +
                  (open
                    ? '<div class="loan-acc-body">' +
                        '<div class="head-actions" style="margin:8px 0">' +
                          '<button class="btn btn-primary btn-sm" data-action="add-loan" data-val="' + a.id + '">＋ 录入账单</button>' +
                          '<button class="btn btn-ghost btn-sm" data-action="edit-loan-acc" data-val="' + a.id + '">编辑</button>' +
                          '<button class="btn btn-ghost btn-sm danger-text" data-action="del-loan-acc" data-val="' + a.id + '">删除</button>' +
                        '</div>' +
                        (Store.getLoans('all', a.id).length
                          ? Store.getLoans('all', a.id).map(loanRow).join('')
                          : '<div class="data-tip" style="padding:6px 0">还没有账单，点「录入账单」记录一笔</div>') +
                      '</div>'
                    : '') +
                '</div>';
              }).join('')
            : '<div class="data-tip" style="padding:6px 0">还没有借贷账户，点右上角「＋ 借贷账户」创建（如：张三、李四、花呗）</div>') +
        '</div>' +
      '</div>';
  }

  /* 借贷账户弹窗 */
  function openLoanAccountModal(id) {
    const a = id ? Store.getLoanAccount(id) : null;
    const modal = UI.modal(a ? '编辑借贷账户' : '新建借贷账户',
      '<div class="field"><label>名称</label><input id="la-name" value="' + (a ? esc(a.name) : '') + '" placeholder="如：张三、花呗"></div>' +
      '<div class="field"><label>颜色</label><div class="color-row">' + Preset.colors.map(col =>
        '<button class="color-cell" style="background:' + col + '" data-color="' + col + '"></button>').join('') + '</div></div>' +
      '<div class="modal-actions">' +
        (a ? '<button class="btn btn-danger" data-action="del-loan-acc" data-val="' + a.id + '">删除</button>' : '') +
        '<button class="btn btn-ghost" data-action="modal-close">取消</button>' +
        '<button class="btn btn-primary" data-action="save-loan-acc" data-val="' + (a ? a.id : '') + '">保存</button>' +
      '</div>');
    const box = modal.box;
    let color = a ? a.color : Preset.colors[0];
    box.dataset.laColor = color;
    const colors = box.querySelectorAll('.color-cell');
    const mark = () => colors.forEach(x => x.classList.toggle('active', x.dataset.color === color));
    colors.forEach(x => x.addEventListener('click', () => { color = x.dataset.color; box.dataset.laColor = color; mark(); }));
    mark();
  }

  function openLoanModal(id, loanAccountId) {
    const l = id ? Store.getLoan(id) : null;
    const type = l ? l.type : 'lend';
    const accs = Store.getAccounts();
    const las = Store.getLoanAccounts();
    if (!las.length) { UI.toast('请先创建借贷账户', 'err'); Views.openLoanAccountModal(null); return; }
    const laOpts = las.map(a => '<option value="' + a.id + '"' + ((l && l.loanAccountId === a.id) || (!l && loanAccountId === a.id) ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('');
    const accOpts = accs.map(a => '<option value="' + a.id + '"' + (l && l.accountId === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('');
    const modal = UI.modal(l ? '编辑借贷' : '记一笔借贷',
      '<div class="field"><label>借贷账户</label><select id="loan-la">' + laOpts + '</select></div>' +
      '<div class="seg" style="margin-bottom:14px">' +
        '<button class="seg-btn ' + (type === 'lend' ? 'active' : '') + '" data-action="loan-type" data-val="lend">借出（应收）</button>' +
        '<button class="seg-btn ' + (type === 'borrow' ? 'active' : '') + '" data-action="loan-type" data-val="borrow">借入（应付）</button>' +
      '</div>' +
      '<div class="field"><label>金额（¥）</label><input type="number" id="loan-amount" step="0.01" value="' + (l ? String(l.amount) : '') + '" placeholder="0.00"></div>' +
      '<div class="field"><label>日期</label><input type="date" id="loan-date" value="' + (l ? esc(l.date) : UI.todayStr()) + '"></div>' +
      '<div class="field"><label>应还日期（可选）</label><input type="date" id="loan-due" value="' + (l && l.dueDate ? esc(l.dueDate) : '') + '"></div>' +
      '<div class="field"><label>关联账户（可选，结清时用于记账）</label><select id="loan-acc">' + accOpts + '</select></div>' +
      '<div class="field"><label>备注（可选）</label><input type="text" id="loan-note" value="' + (l ? esc(l.note || '') : '') + '"></div>' +
      '<div class="modal-actions">' +
        (l ? '<button class="btn btn-danger" data-action="del-loan" data-val="' + l.id + '">删除</button>' : '') +
        '<button class="btn btn-ghost" data-action="modal-close">取消</button>' +
        '<button class="btn btn-primary" data-action="save-loan" data-val="' + (l ? l.id : '') + '">保存</button>' +
      '</div>');
    modal.box.dataset.loanType = type;
    modal.box.querySelectorAll('[data-action="loan-type"]').forEach(b =>
      b.addEventListener('click', () => {
        modal.box.dataset.loanType = b.dataset.val;
        modal.box.querySelectorAll('[data-action="loan-type"]').forEach(x => x.classList.toggle('active', x === b));
      }));
  }

  function settleLoanModal(id) {
    const l = Store.getLoan(id);
    if (!l) return;
    const isLend = l.type === 'lend';
    const accs = Store.getAccounts();
    const cats = Store.getRootCategories(isLend ? 'income' : 'expense');
    const accOpts = accs.map(a => '<option value="' + a.id + '"' + (l.accountId === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('');
    const catOpts = cats.map(c => '<option value="' + c.id + '"' + (c.name === '人情' ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
    UI.modal('结清 · ' + (isLend ? '收回借出' : '还清借入'),
      '<div class="confirm-text" style="margin-bottom:14px">' + (isLend ? '收回' : '归还') + ' <b>' + esc(l.person) + '</b> 的 ' + money(l.amount) + '，将自动生成一条' + (isLend ? '收入' : '支出') + '账单：</div>' +
      '<div class="field"><label>记账账户</label><select id="sl-acc">' + accOpts + '</select></div>' +
      '<div class="field"><label>分类</label><select id="sl-cat">' + catOpts + '</select></div>' +
      '<div class="field"><label>日期</label><input type="date" id="sl-date" value="' + UI.todayStr() + '"></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">取消</button>' +
      '<button class="btn btn-primary" data-action="confirm-settle" data-val="' + l.id + '">确认结清并记账</button></div>');
  }

  /* ================= 周期账单 ================= */
  const FREQ_LABEL = { daily: '每日', weekly: '每周', monthly: '每月', yearly: '每年' };

  function recRow(r) {
    const c = catOfId(r.categoryId);
    const due = r.nextDate <= UI.todayStr();
    return '<div class="card rec-row">' +
      '<div class="rec-row-head">' +
        '<span class="rec-ico"' + iconStyle(c.color) + '>' + UI.catIcon(c.icon) + '</span>' +
        '<span class="rec-main">' +
          '<span class="rec-name">' + esc(r.name) +
            ' <em class="rec-badge">' + (FREQ_LABEL[r.frequency] || r.frequency) + '</em>' +
            (!r.enabled ? ' <em class="rec-badge rec-off">已停用</em>' : '') + '</span>' +
          '<span class="rec-sub">下次：' + UI.fmtDateCn(r.nextDate) +
            (r.endDate ? ' · 至 ' + UI.fmtDateCn(r.endDate) : '') +
            (r.note ? ' · ' + esc(r.note) : '') + '</span>' +
        '</span>' +
        '<span class="rec-amt ' + (r.type === 'expense' ? 'v-red' : 'v-green') + '">' + (r.type === 'expense' ? '-' : '+') + money(r.amount) + '</span>' +
      '</div>' +
      '<div class="rec-actions">' +
        '<button class="btn btn-sm ' + (due ? 'btn-primary' : 'btn-ghost') + '" data-action="process-rec" data-val="' + r.id + '">📝 记一笔（' + UI.fmtDateCn(r.nextDate) + '）</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="skip-rec" data-val="' + r.id + '">跳过</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="toggle-rec" data-val="' + r.id + '">' + (r.enabled ? '停用' : '启用') + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="edit-rec" data-val="' + r.id + '">编辑</button>' +
        '<button class="btn btn-ghost btn-sm danger-text" data-action="del-rec" data-val="' + r.id + '">删除</button>' +
      '</div>' +
    '</div>';
  }

  function openRecurringModal(id) {
    const r = id ? Store.getRecurring(id) : null;
    const type = r ? r.type : 'expense';
    const accs = Store.getAccounts();
    const catsE = Store.getRootCategories('expense'), catsI = Store.getRootCategories('income');
    const accOpts = accs.map(a => '<option value="' + a.id + '"' + (r && r.accountId === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('');
    const catOpts = (type === 'expense' ? catsE : catsI).map(c =>
      '<option value="' + c.id + '"' + (r && r.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
    const freqOpts = [['daily', '每日'], ['weekly', '每周'], ['monthly', '每月'], ['yearly', '每年']].map(f =>
      '<option value="' + f[0] + '"' + (r && r.frequency === f[0] ? ' selected' : '') + '>' + f[1] + '</option>').join('');
    const modal = UI.modal(r ? '编辑周期账单' : '新建周期账单',
      '<div class="field"><label>名称</label><input id="rec-name" value="' + (r ? esc(r.name) : '') + '" placeholder="如：房租、视频会员、工资"></div>' +
      '<div class="seg" style="margin-bottom:14px">' +
        '<button class="seg-btn ' + (type === 'expense' ? 'active' : '') + '" data-action="rec-type2" data-val="expense">支出</button>' +
        '<button class="seg-btn ' + (type === 'income' ? 'active' : '') + '" data-action="rec-type2" data-val="income">收入</button>' +
      '</div>' +
      '<div class="field"><label>金额（¥）</label><input type="number" id="rec-amount2" step="0.01" value="' + (r ? String(r.amount) : '') + '" placeholder="0.00"></div>' +
      '<div class="field"><label>分类</label><select id="rec-cat2">' + catOpts + '</select></div>' +
      '<div class="field"><label>账户</label><select id="rec-acc2">' + accOpts + '</select></div>' +
      '<div class="field"><label>频率</label><select id="rec-freq">' + freqOpts + '</select></div>' +
      '<div class="field"><label>开始日期（首次发生日）</label><input type="date" id="rec-start" value="' + (r ? esc(r.startDate) : UI.todayStr()) + '"></div>' +
      '<div class="field"><label>结束日期（可选）</label><input type="date" id="rec-end" value="' + (r && r.endDate ? esc(r.endDate) : '') + '"></div>' +
      '<div class="field"><label>备注（可选）</label><input type="text" id="rec-note2" value="' + (r ? esc(r.note || '') : '') + '"></div>' +
      '<label class="check"><input type="checkbox" id="rec-enabled"' + (!r || r.enabled ? ' checked' : '') + '> 启用（到期自动提醒）</label>' +
      '<div class="modal-actions">' +
        (r ? '<button class="btn btn-danger" data-action="del-rec" data-val="' + r.id + '">删除</button>' : '') +
        '<button class="btn btn-ghost" data-action="modal-close">取消</button>' +
        '<button class="btn btn-primary" data-action="save-rec" data-val="' + (r ? r.id : '') + '">保存</button>' +
      '</div>');
    modal.box.dataset.recType = type;
    modal.box.querySelectorAll('[data-action="rec-type2"]').forEach(b =>
      b.addEventListener('click', () => {
        modal.box.dataset.recType = b.dataset.val;
        modal.box.querySelectorAll('[data-action="rec-type2"]').forEach(x => x.classList.toggle('active', x === b));
        const sel = modal.box.querySelector('#rec-cat2');
        const cats = b.dataset.val === 'expense' ? catsE : catsI;
        sel.innerHTML = cats.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
      }));
  }

  /* ================= Excel / CSV 导入 ================= */
  let xlsxPromise = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxPromise) {
      xlsxPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.onload = () => resolve(window.XLSX);
        s.onerror = () => { xlsxPromise = null; reject(new Error('Excel 解析库加载失败（需联网）')); };
        document.head.appendChild(s);
      });
    }
    return xlsxPromise;
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* 忽略 */ }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
  }

  const IMP_FIELDS = [
    ['date', '日期'],
    ['amount', '金额'],
    ['type', '类型'],
    ['category', '分类'],
    ['account', '账户'],
    ['note', '备注'],
    ['merchant', '商家'],
    ['time', '时间'],
    ['original', '原价'],
    ['discount', '优惠金额']
  ];
  const IMP_KW = {
    date: ['日期', '时间'], amount: ['金额', '价格', '合计', '消费', '花费', '实付'],
    type: ['类型', '收支', '收/支'], category: ['分类', '类别', '类目'],
    account: ['账户', '账号', '支付方式', '付款方式'], note: ['备注', '说明', '摘要'],
    merchant: ['商家', '商户', '对方', '收款方'], time: ['时刻'],
    original: ['原价', '原金额'], discount: ['优惠', '折扣']
  };

  function detectImport(rows) {
    let headerIdx = 0;
    for (let i = 0; i < Math.min(6, rows.length); i++) {
      const cells = rows[i].map(x => String(x ?? '').trim());
      let score = 0;
      for (const c of cells) {
        for (const k in IMP_KW) {
          if (IMP_KW[k].some(w => c.includes(w))) { score++; break; }
        }
      }
      if (score >= 2) { headerIdx = i; break; }
    }
    const header = rows[headerIdx] ? rows[headerIdx].map(x => String(x ?? '').trim()) : [];
    const map = {};
    for (const [k] of IMP_FIELDS) {
      let found = null;
      for (let ci = 0; ci < header.length; ci++) {
        const h = header[ci];
        if (h && IMP_KW[k].some(w => h.includes(w))) { found = ci; break; }
      }
      map[k] = found;
    }
    return { headerIdx, map, header };
  }

  function renderImportMapping() {
    const box = $('#imp-map');
    if (!box) return;
    const imp = S().imp;
    const header = imp.header;
    const sel = (k, label, required) =>
      '<div class="imp-field"><span>' + label + (required ? ' *' : '') + '</span>' +
      '<select data-imp-map="' + k + '">' +
        '<option value="">（不导入）</option>' +
        header.map((_, ci) => '<option value="' + ci + '">' + esc(header[ci] || ('第' + (ci + 1) + '列')) + '</option>').join('') +
      '</select></div>';
    const start = imp.headerIdx + 1;
    let tbl = '<div class="imp-preview"><div class="rp-head">数据预览（前 4 行）</div><div class="imp-tbl-wrap"><table class="imp-tbl"><thead><tr>';
    header.forEach(h => { tbl += '<th>' + esc(h || '') + '</th>'; });
    tbl += '</tr></thead><tbody>';
    for (let i = start; i < Math.min(start + 4, imp.rows.length); i++) {
      tbl += '<tr>' + (imp.rows[i] || []).map(c => '<td>' + esc(String(c ?? '')) + '</td>').join('') + '</tr>';
    }
    tbl += '</tbody></table></div></div>';

    box.innerHTML = tbl +
      '<div class="rp-head" style="margin-top:10px">列映射</div>' +
      '<div class="imp-grid">' +
        IMP_FIELDS.map(([k, label]) => sel(k, label, k === 'date' || k === 'amount')).join('') +
      '</div>' +
      '<div class="imp-field"><span>数据起始行</span>' +
      '<input type="number" id="imp-start" min="1" value="' + start + '" style="width:90px;padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:var(--text)"></div>';
    box.querySelectorAll('[data-imp-map]').forEach(selEl => {
      const k = selEl.dataset.impMap;
      if (imp.map[k] != null) selEl.value = String(imp.map[k]);
    });
  }

  async function impHandleFile(file) {
    const st = S();
    if (!file) return;
    let rows = [];
    const name = file.name || '';
    try {
      if (/\.xlsx?$/i.test(name)) {
        const XLSX = await loadXLSX();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      } else if (/\.csv$/i.test(name)) {
        const buf = await file.arrayBuffer();
        let text = new TextDecoder('utf-8').decode(buf);
        if (text.indexOf('\uFFFD') !== -1) text = new TextDecoder('gbk').decode(buf);
        rows = parseCSV(text);
      } else {
        UI.toast('仅支持 .xlsx / .xls / .csv 文件', 'err');
        return;
      }
    } catch (e) {
      UI.toast('文件解析失败：' + (e && e.message ? e.message : '未知错误'), 'err');
      return;
    }
    rows = rows.filter(r => r && r.some(x => String(x).trim() !== ''));
    if (rows.length < 2) { UI.toast('文件内容为空或行数不足', 'err'); return; }
    st.imp = Object.assign({ rows, fileName: name }, detectImport(rows));
    showImpStep(1);
    renderImportMapping();
  }

  function showImpStep(n) {
    S().impStep = n;
    document.querySelectorAll('#imp-modal .imp-step').forEach(el => { el.style.display = 'none'; });
    const el = document.getElementById('imp-step' + n);
    if (el) el.style.display = '';
  }

  function parseDate(v) {
    if (v instanceof Date && !isNaN(v.getTime())) {
      return v.getFullYear() + '-' + UI.pad(v.getMonth() + 1) + '-' + UI.pad(v.getDate());
    }
    if (typeof v === 'number' && v > 20000 && v < 60000) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return d.getFullYear() + '-' + UI.pad(d.getMonth() + 1) + '-' + UI.pad(d.getDate());
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (m) return m[1] + '-' + UI.pad(m[2]) + '-' + UI.pad(m[3]);
    m = s.match(/^(\d{1,2})[-/.月](\d{1,2})[-/.日]?$/);
    if (m) return new Date().getFullYear() + '-' + UI.pad(m[1]) + '-' + UI.pad(m[2]);
    return null;
  }

  function parseAmount(v) {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/[¥￥,\s元]/g, '').replace(/^[+]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : Math.abs(n);
  }

  function parseTime(v) {
    if (v == null) return '';
    if (v instanceof Date) return UI.pad(v.getHours()) + ':' + UI.pad(v.getMinutes());
    const m = String(v).match(/(\d{1,2}):(\d{2})/);
    return m ? UI.pad(Number(m[1])) + ':' + m[2] : '';
  }

  function findOrCreateCat(type, name) {
    const n = String(name || '').trim();
    if (!n) return null;
    let c = Store.getCategories(type).find(x => x.name === n);
    if (!c) c = Store.addCategory({ type, name: n, icon: 'box', color: '#adb5bd' });
    return c.id;
  }

  function findOrCreateAcc(name) {
    const n = String(name || '').trim() || '默认账户';
    let a = Store.getAccounts().find(x => x.name === n);
    if (!a) a = Store.addAccount({ name: n, type: 'other', icon: '💰', color: '#adb5bd', initialBalance: 0 });
    return a.id;
  }

  function buildTxFromRow(row, map) {
    const get = f => { const i = map[f]; return i == null ? '' : String(row[i] ?? '').trim(); };
    const date = parseDate(row[map.date] ?? '');
    if (!date) return { skip: '日期无效' };
    const amount = parseAmount(row[map.amount] ?? '');
    if (!(amount > 0)) return { skip: '金额无效' };
    const tRaw = get('type');
    let type = 'expense';
    if (tRaw) {
      if (/收|入/.test(tRaw) && !/支|出/.test(tRaw)) type = 'income';
      else if (/支|出/.test(tRaw) || /-/.test(tRaw)) type = 'expense';
      else if (/转/.test(tRaw)) return { skip: '转账行请手动记录' };
    } else {
      const n = Number(row[map.amount]);
      type = n < 0 ? 'expense' : (n > 0 ? 'income' : type);
    }
    const categoryId = findOrCreateCat(type, get('category'));
    const accountId = findOrCreateAcc(get('account'));
    const note = get('note');
    const merchant = get('merchant');
    const time = parseTime(row[map.time] ?? '');
    let originalPrice = null, discount = null;
    const op = parseAmount(row[map.original] ?? '');
    if (op > 0) {
      originalPrice = Math.round(op * 100) / 100;
      discount = Math.round(Math.max(0, op - amount) * 100) / 100;
    }
    return {
      tx: { type, amount: Math.round(amount * 100) / 100, categoryId, accountId, date, time, merchant, note, originalPrice, discount, excluded: false, attachments: [] }
    };
  }

  function doImport() {
    const imp = S().imp;
    if (!imp || !imp.rows) return;
    const map = {};
    IMP_FIELDS.forEach(([k]) => {
      const el = document.querySelector('[data-imp-map="' + k + '"]');
      map[k] = el && el.value !== '' ? Number(el.value) : null;
    });
    if (map.date == null || map.amount == null) { UI.toast('请先映射「日期」和「金额」列', 'err'); return; }
    const startEl = document.getElementById('imp-start');
    const startRow = Math.max(1, parseInt((startEl ? startEl.value : String(imp.headerIdx + 1)), 10) || imp.headerIdx + 1);
    let ok = 0, skip = 0, skips = [];
    for (let i = startRow; i < imp.rows.length; i++) {
      const r = buildTxFromRow(imp.rows[i], map);
      if (r.skip) { skip++; if (skips.length < 5) skips.push('第' + (i + 1) + '行：' + r.skip); continue; }
      Store.addTransaction(r.tx);
      ok++;
    }
    const box = $('#imp-result');
    if (box) {
      box.innerHTML = '<div class="rp-head">✅ 导入完成</div>' +
        '<div>成功导入 <b class="v-green">' + ok + '</b> 条' + (skip ? '，跳过 <b class="v-red">' + skip + '</b> 条' : '') + '</div>' +
        (skips.length ? '<div class="data-tip" style="margin-top:6px">' + skips.map(esc).join('<br>') + (skip > 5 ? '<br>…' : '') + '</div>' : '') +
        '<div class="modal-actions"><button class="btn btn-primary" data-action="modal-close">完成</button></div>';
    }
    showImpStep(2);
  }

  function openImportModal() {
    S().imp = null;
    S().impStep = 0;
    const modal = UI.modal('导入账单 (Excel / CSV)',
      '<div class="imp-step" id="imp-step0">' +
        '<input type="file" id="imp-file" accept=".xlsx,.xls,.csv" style="display:none">' +
        '<button class="btn btn-primary btn-block" data-action="imp-pick">📁 选择 Excel / CSV 文件</button>' +
        '<div class="data-tip" style="margin-top:8px">支持 .xlsx / .xls / .csv。<br>建议表头包含：日期、金额、类型（收入/支出）、分类、账户、备注。<br>导入为<b>追加</b>到现有数据，不会覆盖；建议先导出备份。</div>' +
      '</div>' +
      '<div class="imp-step" id="imp-step1" style="display:none"><div id="imp-map"></div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-action="imp-back">上一步</button>' +
        '<button class="btn btn-primary" data-action="imp-do">开始导入</button></div></div>' +
      '<div class="imp-step" id="imp-step2" style="display:none"><div id="imp-result"></div></div>');
    modal.box.id = 'imp-modal';
  }

  /* ================= 搜索账单（独立页面） ================= */
  function search() {
    const v = $('#view');
    v.innerHTML =
      '<div class="page">' +
        '<div class="page-head"><h1>搜索账单</h1>' +
          '<button class="btn btn-ghost btn-sm" data-action="nav" data-nav="/home">返回</button></div>' +
        '<div class="card"><input type="text" id="search-input" placeholder="搜索备注 / 商家 / 分类…"></div>' +
        '<div class="card bill-card" id="search-result"><div class="data-tip">输入关键词，检索所有账单并显示收支情况</div></div>' +
      '</div>';
    const input = $('#search-input');
    const result = $('#search-result');
    const run = () => {
      const kw = input.value.trim().toLowerCase();
      if (!kw) { result.innerHTML = '<div class="data-tip">输入关键词，检索所有账单并显示收支情况</div>'; return; }
      const txs = Store.getTransactions({ keyword: kw }).slice(0, 50);
      let inc = 0, exp = 0;
      txs.forEach(t => { if (t.excludeStats) return; if (t.type === 'income') inc += t.amount; else if (t.type === 'expense') exp += t.amount; });
      result.innerHTML =
        '<div class="list-summary" style="padding:4px 0 8px">' +
          '<span>匹配 <b>' + txs.length + '</b> 笔</span>' +
          '<span>收入 <b class="v-green">' + money(inc) + '</b></span>' +
          '<span>支出 <b class="v-red">' + money(exp) + '</b></span>' +
          '<span>结余 <b class="' + (inc - exp >= 0 ? 'v-green' : 'v-red') + '">' + money(inc - exp) + '</b></span>' +
        '</div>' +
        (txs.length
          ? txs.map(txRow).join('')
          : '<div class="data-tip" style="padding:8px 0">没有匹配的账单</div>');
    };
    input.addEventListener('input', run);
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 50);
  }

  /* ================= 文字记账（智能解析） ================= */
  /* 关键词 → 目标分类名（匹配用户现有分类；不存在时回退一级分类） */
  const TXT_CAT_KW = [
    ['零食', '休闲零食'], ['薯片', '休闲零食'], ['瓜子', '休闲零食'], ['饼干', '休闲零食'],
    ['坚果', '休闲零食'], ['辣条', '休闲零食'], ['巧克力', '休闲零食'], ['蛋糕', '休闲零食'],
    ['面包', '休闲零食'], ['冰淇淋', '休闲零食'], ['糖果', '休闲零食'],
    ['水果', '水果'], ['买菜', '买菜'], ['早餐', '早餐'], ['早饭', '早餐'],
    ['午饭', '午餐'], ['午餐', '午餐'], ['晚饭', '晚餐'], ['晚餐', '晚餐'], ['夜宵', '夜宵'], ['宵夜', '夜宵'],
    ['奶茶', '饮料酒水'], ['咖啡', '饮料酒水'], ['饮料', '饮料酒水'], ['可乐', '饮料酒水'], ['啤酒', '饮料酒水'],
    ['白酒', '饮料酒水'], ['红酒', '饮料酒水'], ['果汁', '饮料酒水'], ['矿泉水', '饮料酒水'], ['外卖', '外卖'],
    ['烧烤', '请客吃饭'], ['火锅', '请客吃饭'], ['聚餐', '请客吃饭'], ['请客', '请客吃饭'],
    ['打车', '打车'], ['出租车', '打车'], ['地铁', '公共交通'], ['公交', '公共交通'], ['巴士', '公共交通'],
    ['加油', '加油'], ['汽油', '加油'], ['停车', '停车费'], ['洗车', '停车费'],
    ['火车', '火车'], ['高铁', '火车'], ['动车', '火车'], ['机票', '飞机'], ['飞机', '飞机'], ['航班', '飞机'],
    ['房租', '房租'], ['电费', '电费'], ['水费', '水费'], ['燃气', '燃气费'], ['煤气', '燃气费'],
    ['话费', '花费宽带'], ['宽带', '花费宽带'], ['流量', '花费宽带'], ['物业', '物业费'],
    ['超市', '日常家居'], ['便利店', '日常家居'], ['网购', '日常家居'], ['快递', '日常家居'],
    ['宠物', '日常家居'], ['日用', '日常家居'], ['清洁', '日常家居'], ['纸巾', '日常家居'],
    ['药店', '买药'], ['买药', '买药'], ['医院', '医院'], ['看病', '医院'], ['体检', '医院'], ['挂号', '医院'],
    ['诊所', '医院'], ['牙科', '医院'], ['门诊', '医院'],
    ['学费', '学费'], ['书', '书报杂志'], ['买书', '书报杂志'], ['文具', '办公用品'], ['培训', '培训考试'],
    ['补习', '培训考试'], ['课程', '培训考试'], ['打印', '办公用品'],
    ['红包', '红包'], ['礼物', '礼物'], ['随礼', '红包'], ['打赏', '打赏'], ['份子钱', '红包'],
    ['衣服', '服饰运动'], ['裤子', '服饰运动'], ['鞋', '服饰运动'], ['裙子', '服饰运动'], ['外套', '服饰运动'],
    ['衬衫', '服饰运动'], ['运动鞋', '服饰运动'], ['化妆品', '个护美妆'], ['面膜', '个护美妆'],
    ['护肤品', '个护美妆'], ['洗发水', '个护美妆'], ['理发', '个护美妆'], ['美发', '个护美妆'],
    ['手机', '手机数码'], ['充电器', '手机数码'], ['耳机', '手机数码'], ['数据线', '手机数码'],
    ['电脑', '手机数码'], ['平板', '手机数码'], ['家电', '生活电器'], ['电饭煲', '生活电器'],
    ['洗衣机', '生活电器'], ['冰箱', '生活电器'], ['电视', '生活电器'], ['空调', '生活电器'],
    ['工资', '工资'], ['奖金', '奖金'], ['报销', '报销'], ['理财', '理财盈利'], ['收益', '理财盈利'],
    ['股票', '理财盈利'], ['基金', '理财盈利'], ['利息', '理财盈利'],
    ['兼职', '兼职外快'], ['外快', '兼职外快'], ['中奖', '中奖'], ['二手', '二手闲置'], ['闲置', '二手闲置'],
    ['电影', '娱乐'], ['游戏', '娱乐'], ['KTV', '娱乐'], ['唱歌', '娱乐'], ['演出', '娱乐'],
    ['门票', '娱乐'], ['球赛', '娱乐'], ['健身', '娱乐'], ['游泳', '娱乐'], ['旅游', '旅行'],
    ['酒店', '旅行'], ['民宿', '旅行'], ['机票', '旅行'], ['景区', '旅行'], ['门票', '旅行']
  ];
  /* 语境兜底：动词/场景词 → 一级分类名 */
  const TXT_CTX = [
    ['食品餐饮', /吃|喝|买零食|餐|饭|外卖|奶茶|咖啡|水果|买菜/],
    ['出行交通', /打车|地铁|公交|加油|停车|火车|飞机|打车|通勤/],
    ['购物消费', /买|购|超市|商场|网购|快递|剁手/],
    ['居家生活', /房租|水电|物业|宽带|燃气|家居|家电/],
    ['文化教育', /书|课|学|培训|考试|文具/],
    ['医疗健康', /药|医院|看病|体检|挂号/],
    ['送礼人情', /红包|礼物|请客|随礼|人情/],
    ['娱乐', /电影|游戏|KTV|唱歌|健身|演出|旅游/],
    ['通讯', /话费|流量|宽带|手机费/],
    ['服饰', /衣服|裤子|鞋|裙子|外套/]
  ];
  /* 常见账户别名关键词 → 目标账户名（别名命中后，按名称匹配用户账户） */
  const ACC_ALIAS = [
    ['现金', ['现金', '现钱', '钱包', '零钱']],
    ['支付宝', ['支付宝', '花呗', '余额宝']],
    ['微信', ['微信', 'wechat', '零钱通']],
    ['银行卡', ['银行卡', '储蓄卡', '借记卡', '信用卡', '借记', '贷记']],
    ['中国银行', ['中国银行', '中行']],
    ['工商银行', ['工商银行', '工行']],
    ['建设银行', ['建设银行', '建行']],
    ['农业银行', ['农业银行', '农行']],
    ['招商银行', ['招商银行', '招行']],
    ['交通银行', ['交通银行', '交行']],
    ['邮储银行', ['邮储', '邮政', '邮储银行']]
  ];
  /* 从文字中匹配账户：完整名 > 账户名核心词（去 支付/银行/卡/账户 后缀）> 别名关键词 */
  function matchAccountFromText(text) {
    const accs = Store.getAccounts();
    const score = c => c.score || 0;
    let best = null;
    const better = cand => {
      if (!best) { best = cand; return; }
      if (score(cand) !== score(best)) { if (score(cand) > score(best)) best = cand; return; }
      if (cand.name.length > best.name.length) best = cand;
    };
    /* 1) 完整账户名 */
    accs.forEach(a => {
      const n = String(a.name || '').trim();
      if (!n || n.length < 2) return;
      if (text.indexOf(n) !== -1) better({ accountId: a.id, name: n, score: 3 });
    });
    /* 2) 账户名核心词（去常见后缀） */
    accs.forEach(a => {
      const n = String(a.name || '').trim();
      if (!n || n.length < 3) return;
      const core = n.replace(/(支付|账户|银行卡|银行卡|银行|卡)$/g, '');
      if (core && core.length >= 2 && core !== n && text.indexOf(core) !== -1) {
        better({ accountId: a.id, name: n, score: 2 });
      }
    });
    /* 3) 别名关键词 */
    for (const [accName, kws] of ACC_ALIAS) {
      const hit = kws.find(k => text.indexOf(k) !== -1);
      if (!hit) continue;
      const a = accs.find(x => x.name === accName) ||
                accs.find(x => x.name.indexOf(accName) !== -1) ||
                accs.find(x => accName.indexOf(x.name) !== -1);
      if (a) better({ accountId: a.id, name: a.name, score: 1 });
    }
    return best ? { accountId: best.accountId, accountName: best.name } : null;
  }
  /* 从文字中匹配分类：
     1) 完整分类名（最长优先）
     2) 关键词表命中目标分类名
     3) 文字 2 字词 ⊂ 分类名（如"零食" ⊂ "休闲零食"）
     4) 语境兜底 → 一级分类
     找不到时返回 null（用默认分类） */
  function matchCategoryFromText(text, type) {
    const cats = Store.getCategories(type);
    let best = null;
    const better = cand => {
      if (!cand) return;
      if (!best || cand.name.length > best.name.length) best = cand;
    };
    /* 1) 完整分类名（最长优先，优先二级） */
    cats.forEach(c => {
      const n = String(c.name || '').trim();
      if (!n || n === '其他' || n.length < 2) return;
      if (text.indexOf(n) !== -1) better({ categoryId: c.id, name: n, score: 2 });
    });
    /* 2) 关键词表：目标分类名 或 包含目标名的一级分类 */
    for (const pair of TXT_CAT_KW) {
      if (text.indexOf(pair[0]) === -1) continue;
      const target = pair[1];
      let c = cats.find(x => x.name === target);
      if (c) { better({ categoryId: c.id, name: c.name, score: 2 }); continue; }
      c = cats.find(x => !x.parentId && x.name === target);
      if (c) { better({ categoryId: c.id, name: c.name, score: 1 }); continue; }
      /* 目标分类名不存在（如用户自定义分类名）→ 找名称包含目标词的分类 */
      c = cats.find(x => x.name.indexOf(target) !== -1 && x.name !== '其他');
      if (c) better({ categoryId: c.id, name: c.name, score: 1 });
    }
    if (best) return { categoryId: best.categoryId, categoryName: best.name };
    /* 3) 2 字词 ⊂ 分类名（覆盖"零食"→"休闲零食"等未列关键词的场景） */
    const words = [];
    for (let i = 0; i < text.length - 1; i++) {
      const w = text.slice(i, i + 2);
      if (/^[\u4e00-\u9fa5]{2}$/.test(w)) words.push(w);
    }
    if (words.length) {
      let wBest = null;
      cats.forEach(c => {
        const n = String(c.name || '').trim();
        if (!n || n === '其他' || n.length < 2) return;
        words.forEach(w => {
          if (n.indexOf(w) !== -1 && (!wBest || n.length > wBest.name.length)) {
            wBest = { categoryId: c.id, name: n };
          }
        });
      });
      if (wBest) return { categoryId: wBest.categoryId, categoryName: wBest.name };
    }
    /* 4) 语境兜底 → 一级分类 */
    for (const [rootName, re] of TXT_CTX) {
      if (!re.test(text)) continue;
      const root = cats.find(x => !x.parentId && x.name === rootName);
      if (root) return { categoryId: root.id, categoryName: root.name };
    }
    /* 5) 保底：该类型第一个一级分类（排除「其他」），保证不落空 */
    const fallback = cats.find(x => !x.parentId && x.name !== '其他');
    if (fallback) return { categoryId: fallback.id, categoryName: fallback.name, guessed: true };
    return null;
  }

  /* 多行文字：每行「文字 数字」→ 备注行 + 金额加和 */
  function parseTextBill(text) {
    const tokens = String(text || '').replace(/[，,。；;：:\s]+/g, ' ').match(/[\u4e00-\u9fa5A-Za-z]+|\d+(?:\.\d+)?/g) || [];
    const notes = [];
    let cur = '', total = 0;
    tokens.forEach(tk => {
      if (/^\d/.test(tk)) {
        const amt = parseFloat(tk);
        total += amt;
        notes.push((cur ? cur : '其他') + ' ' + amt);
        cur = '';
      } else if (!/^[元块角分毛钱圆]$/.test(tk)) {
        cur = (cur ? cur + ' ' : '') + tk;
      }
    });
    if (cur) notes.push(cur);
    return { notes: notes.filter(Boolean), total: Math.round(total * 100) / 100 };
  }

  /* 智能解析：类型 / 金额 / 账户 / 分类 / 备注 */
  function parseTextSmart(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const multi = t.indexOf('\n') !== -1;
    const p = UI.parseBillText(t);               // 类型 + 最优金额（含"花了68"等）
    const type = p ? p.type : 'expense';
    let amount = 0, notes = [];
    if (multi) {
      const r = parseTextBill(t);                // 多行：每行 文字+数字 → 备注行 + 加和
      amount = r.total;
      notes = r.notes;
    } else if (p) {
      amount = p.amount;
    }
    if (!amount && !notes.length) return null;
    const acc = matchAccountFromText(t);
    let cat = matchCategoryFromText(t, type);
    if (!cat && p && p.categoryName) {
      const c = Store.getCategories(type).find(x => x.name === p.categoryName);
      if (c) cat = { categoryId: c.id, categoryName: c.name };
    }
    if (!cat) cat = matchCategoryFromText(t, type); // 二次尝试（含保底一级分类）
    const catGuessed = !!(cat && cat.guessed);
    /* 备注：多行用各行文字；单行剔除账户名与金额语气词 */
    let note = '';
    if (notes.length) {
      note = notes.join('\n');
    } else {
      let s = t;
      if (acc) s = s.split(acc.accountName).join(' ');
      /* 阿拉伯数字金额（可无单位，如「花了68」「花15元」；前缀动词一并删除） */
      s = s.replace(/(?:花了|花了|用了|支付|付款|消费|花费|买了|共|合计|总计|金额|实付|实收|应付|应收|转账|收入|支出|收到|花|用|买|收|付|给|转|交|充|扣|订)?\s*\d+(?:\.\d+)?\s*(?:块|元|圆|毛|角|分|钱)?/g, ' ');
      /* 汉字数字金额（必须带 元/块/圆/角/毛/分/钱 单位，避免误删「零食」的「零」等） */
      s = s.replace(/(?:花了|用了|支付|付款|消费|花费|买了|共|合计|总计|金额|实付|实收|应付|应收|转账|收入|支出|收到|花|用|买|收|付|给|转|交|充|扣|订)?\s*[零〇一二两三四五六七八九十百千万亿]+(?:\s*点\s*[零〇一二三四五六七八九]+)?\s*(?:块|元|圆|毛|角|分|钱)/g, ' ');
      /* 清理残留动词：开头/结尾/孤立动词（收到 花 用 买 充值 等），循环直到稳定 */
      const VERB_MULTI = '收到|花了|用了|支付|付款|消费|花费|买了|充值|使用|转了|交了|充了|扣了|订了|付了|给了|收入|支出|转账|合计|总计|金额|实付|实收|应付|应收';
      const VERB_SINGLE = '买|用|收|付|给|转|交|充|扣|订';
      let prev;
      s = s.trim();
      do {
        prev = s;
        s = s.trim();
        s = s.replace(new RegExp('^(?:' + VERB_MULTI + '|' + VERB_SINGLE + '|花(?=\\s*[0-9零〇一二两三四五六七八九十百千万亿]|元|块))+', 'g'), '');
        s = s.replace(new RegExp('(?:' + VERB_MULTI + '|' + VERB_SINGLE + ')$', 'g'), '');
        s = s.replace(new RegExp('\\s+(?:' + VERB_MULTI + '|' + VERB_SINGLE + ')(?=\\s)', 'g'), ' ');
      } while (s !== prev);
      s = s.replace(/[，,。；;：:！!？?、\s]+/g, ' ').trim();
      note = s;
    }
    return {
      type, amount: Math.round(amount * 100) / 100,
      accountId: acc ? acc.accountId : null, accountName: acc ? acc.accountName : '',
      categoryId: cat ? cat.categoryId : null, categoryName: cat ? cat.categoryName : '',
      catGuessed,
      note
    };
  }

  function openTextModal() {
    const modal = UI.modal('文字记账',
      '<div class="field"><label>输入文字</label>' +
        '<textarea id="txt-input" rows="4" placeholder="如：现金买零食花了68&#10;或 早餐12元&#10;打车35元" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);font-size:14px;outline:none"></textarea></div>' +
      '<div id="txt-preview" class="voice-result"></div>' +
      '<div class="data-tip">自动识别 账户 / 分类 / 金额 / 备注，例如「现金买零食花了68」→ 账户现金、分类休闲零食、支出68元。多行输入按行加和。</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">取消</button>' +
      '<button class="btn btn-primary" data-action="txt-apply">填入账单</button></div>');
    const input = modal.box.querySelector('#txt-input');
    const prev = modal.box.querySelector('#txt-preview');
    const upd = () => {
      const r = parseTextSmart(input.value);
      if (r) {
        const accTxt = r.accountName ? '账户：' + esc(r.accountName) : '账户：当前默认';
        const catTxt = r.categoryName
          ? '分类：' + esc(r.categoryName) + (r.catGuessed ? '（推测）' : '')
          : '分类：未匹配（将用默认）';
        const typeTxt = r.type === 'income' ? '收入' : '支出';
        prev.innerHTML =
          '<div class="vr-line">' + typeTxt + ' · ' + accTxt + ' · ' + catTxt + '</div>' +
          '<div class="vr-line">金额：<b>' + money(r.amount) + '</b></div>' +
          '<div class="vr-line">备注：' + (r.note ? esc(r.note).replace(/\n/g, '<br>') : '（空）') + '</div>';
      } else {
        prev.innerHTML = '<div class="data-tip">等待输入…</div>';
      }
      modal.box.dataset.txtSmart = r ? JSON.stringify(r) : '';
    };
    input.addEventListener('input', upd);
    upd();
    modal.box.querySelector('[data-action="txt-apply"]').addEventListener('click', () => {
      const raw = modal.box.dataset.txtSmart;
      if (!raw) { UI.toast('请先输入有效的文字和数字', 'err'); return; }
      let r;
      try { r = JSON.parse(raw); } catch (e) { r = null; }
      if (!r || !r.amount) { UI.toast('请先输入有效的文字和数字', 'err'); return; }
      const st = S().record;
      st.type = r.type;
      st.amount = String(r.amount);
      st.note = r.note || '';
      if (r.accountId) st.accountId = r.accountId;
      if (r.categoryId) st.categoryId = r.categoryId;
      st.merchant = null; st.date = null; st.time = null;
      st._prefill = true;
      modal.close();
      App.nav('/record');
    });
  }

  return {
    home, record, statsDaily, statsMonth, statsYear, statsCustom, calendar, budget, accounts, settings,
    openMonthJump,
    openLoanModal, settleLoanModal, openRecurringModal,
    openTextModal, parseTextSmart,
    renderRecCats, renderRecSubs, renderRecAccs, renderDt, renderRecPanels, renderRecFnRow, updateAmountColor,
    updateDiscountCalc, updateDiscountHighlight, handleAttachFiles,
    openRecAccModal, openRecTimeModal,
    openImportModal, impHandleFile, renderImportMapping, showImpStep, doImport, search, loans, openLoanAccountModal,
    openAccModal, openCatModal, accountDetail, accMoreMenu, openRemindModal, categoryPage,
    transferPage, pickTfAccount, tfAttachPick, tfAttachAdd, tfAttachRemove,
    txRow, catOfId, typeLabel
  };
})();
