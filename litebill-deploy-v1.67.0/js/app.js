/* 主逻辑：路由、全局事件、键盘、示例数据、导入导出、主题 */
window.App = (() => {
  const $ = id => document.getElementById(String(id).replace(/^#/, ''));
  const esc = UI.esc;
  const money = UI.fmtMoney;
  const ymd = d => d.getFullYear() + '-' + UI.pad(d.getMonth() + 1) + '-' + UI.pad(d.getDate());
  const curWeekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };

  const APP_VERSION = 'v1.67.0'; // 当前版本（与 sw.js 缓存名同步，bump 时一起更新）

  const state = {
    month: UI.monthKey(new Date().getFullYear(), new Date().getMonth() + 1),
    billPeriod: 'month',                      // 明细框周期：all | year | month | week
    billType: 'all',                          // 明细框类型过滤：all | income | expense
    billYear: new Date().getFullYear(),
    billWeekStart: curWeekStart(),
    record: {
      type: 'expense', categoryId: null, editId: null, amount: '0',
      accountId: null, from: null, to: null,
      date: null, time: null, merchant: null, note: null,
      calcAcc: null, calcOp: null, entryFresh: false,
      discountOn: false, discountOrig: '0', discountDisc: '0', discountTarget: 'orig',
      excludeStats: false, excludeBudget: false, attrPanel: false, attachPanel: false, attachments: []
    },
    filters: { type: 'all', cat: 'all', acc: 'all', kw: '' },
    stats: { monthKey: UI.monthKey(new Date().getFullYear(), new Date().getMonth() + 1), year: new Date().getFullYear(), from: '', to: '', bar: 'expense', cat: 'root', type: 'expense', dailyBar: 'expense' },
    settingsCatType: 'expense',
    settingsOpen: { cat: false, rec: false, theme: false, data: false, about: false },
    accOpen: { acc: true },
    expandCats: {},
    pendingCatParent: null,
    calendarDay: UI.todayStr(),
    dt: null,
    modal: null
  };

  const nav = route => {
    const target = String(route).split('?')[0];
    if (location.hash.slice(1).split('?')[0] === target) { render(); } // 同路由（如语音预填）→ 立即重渲染
    else location.hash = route;
  };
  const route = () => location.hash.slice(1) || '/home';
  /* 统计页刷新：按当前路由重渲染对应统计页面 */
  function statsRefresh() {
    const sub = route().split('/')[2];
    if (sub === 'daily') Views.statsDaily();
    else if (sub === 'year') Views.statsYear();
    else if (sub === 'custom') Views.statsCustom();
    else Views.statsMonth();
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    const r = route();
    const [path, qs] = r.split('?');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === path));
    /* 记一笔：沉浸式（隐藏菜单栏） */
    document.body.classList.toggle('is-record', path === '/record');
    const view = $('#view');
    if (path === '/home') Views.home();
    else if (path === '/record') Views.record(new URLSearchParams(qs || '').get('id'));
    else if (path === '/list') nav('/home');            // 明细已并入主页
    else if (path === '/stats') nav('/stats/month');     // 统计默认进入月统计
    else if (path === '/stats/daily') Views.statsDaily();
    else if (path === '/stats/month') Views.statsMonth();
    else if (path === '/stats/year') Views.statsYear();
    else if (path === '/stats/custom') Views.statsCustom();
    else if (path === '/calendar') Views.calendar();
    else if (path === '/budget') Views.budget();
    else if (path === '/accounts') Views.accounts();
    else if (path === '/loans') Views.loans();          // 借贷专属页
    else if (path === '/search') Views.search();        // 搜索页
    else if (path === '/recurring') nav('/settings');   // 周期已并入设置页
    else if (path === '/settings') Views.settings();
    else nav('/home');
    window.scrollTo(0, 0);
  }

  /* ---------------- 记账：键盘输入 + 计算器 ---------------- */
  const OPS = ['+', '-', '*', '/'];
  function calc(a, op, b) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return b === 0 ? Infinity : a / b;
    return b;
  }
  const round2 = n => Math.round(n * 100) / 100;

  function calcError(st) {
    st.amount = '0'; st.calcAcc = null; st.calcOp = null; st.entryFresh = false;
    const el = $('#rec-amount');
    if (el) el.textContent = st.amount;
  }

  function applyOp(st, op) {
    const cur = parseFloat(st.amount) || 0;
    if (st.calcOp !== null && st.calcAcc !== null) {
      const r = calc(st.calcAcc, st.calcOp, cur);
      if (!isFinite(r)) { UI.toast('计算错误', 'err'); calcError(st); return; }
      st.amount = String(round2(r));
      st.calcAcc = parseFloat(st.amount);
    } else {
      st.calcAcc = cur;
    }
    st.calcOp = op;
    st.entryFresh = true;
    const el = $('#rec-amount');
    if (el) el.textContent = st.amount;
  }

  function finishCalc(st) {
    if (st.calcOp === null || st.calcAcc === null) return;
    const cur = parseFloat(st.amount) || 0;
    const r = calc(st.calcAcc, st.calcOp, cur);
    if (!isFinite(r)) { UI.toast('计算错误', 'err'); calcError(st); return; }
    st.amount = String(round2(r));
    st.calcAcc = null; st.calcOp = null;
    st.entryFresh = true; // 计算结果后再输数字 → 开启新输入
    const el = $('#rec-amount');
    if (el) el.textContent = st.amount;
  }

  /* 优惠模式下：键盘输入路由到 原价/优惠 输入框 */
  function routeKeyToDiscount(k) {
    const st = state.record;
    const id = st.discountTarget === 'disc' ? 'disc-disc' : 'disc-orig';
    const el = $(id);
    if (!el) return;
    let s = el.value || '0';
    if (k === 'back') { s = s.length > 1 ? s.slice(0, -1) : '0'; }
    else if (k === 'clear') { s = '0'; }
    else if (k === '.') { if (!s.includes('.')) s = s === '0' ? '0.' : s + '.'; }
    else if (k === '=') { /* 忽略 */ }
    else if (['+', '-', '*', '/'].indexOf(k) !== -1) { /* 忽略 */ }
    else {
      if (s.includes('.')) {
        const parts = s.split('.');
        if (parts[1].length >= 2) return;
        s = parts[0] + '.' + parts[1] + k;
      } else {
        const next = (s === '0' ? '' : s) + k;
        if (next.length > 10) return;
        s = next;
      }
    }
    el.value = s;
    if (st.discountTarget === 'disc') st.discountDisc = s;
    else st.discountOrig = s;
    Views.updateDiscountCalc();
  }

  function pressKey(k) {
    const st = state.record;
    if (st.discountOn) { routeKeyToDiscount(k); return; }
    let s = st.amount;
    if (k === 'back') {
      if (st.entryFresh) { s = '0'; st.entryFresh = false; }
      else s = s.length > 1 ? s.slice(0, -1) : '0';
    }
    else if (k === 'clear') { s = '0'; st.calcAcc = null; st.calcOp = null; st.entryFresh = false; }
    else if (k === '.') {
      if (st.entryFresh) { s = '0.'; st.entryFresh = false; }
      else if (!s.includes('.')) s = s === '0' ? '0.' : s + '.';
    }
    else if (k === 'save') { saveTx(); return; }
    else if (k === '=') { finishCalc(st); return; }
    else if (OPS.indexOf(k) !== -1) { applyOp(st, k); return; }
    else {
      if (st.entryFresh) { s = '0'; st.entryFresh = false; }
      if (s.includes('.')) {
        const parts = s.split('.');
        if (parts[1].length >= 2) return;
        s = parts[0] + '.' + parts[1] + k;
      } else {
        const next = (s === '0' ? '' : s) + k;
        if (next.length > 10) return;
        s = next;
      }
    }
    st.amount = s;
    const el = $('#rec-amount');
    if (el) el.textContent = s;
  }

  function preserveRecordFields() {
    const st = state.record;
    const g = id => { const el = $(id); return el ? el.value : ''; };
    st.note = g('rec-note') || '';
  }

  function resetRecordState() {
    const st = state.record;
    st.amount = '0'; st.categoryId = null; st.editId = null;
    st.accountId = null; st.from = null; st.to = null;
    st.date = null; st.time = null; st.merchant = null; st.note = null;
    st.calcAcc = null; st.calcOp = null; st.entryFresh = false;
    st.discountOn = false; st.discountOrig = '0'; st.discountDisc = '0'; st.discountTarget = 'orig';
    st.excludeStats = false; st.excludeBudget = false; st.attrPanel = false; st.attachPanel = false; st.attachments = [];
    st._prefill = false;
  }

  function saveTx() {
    const st = state.record;
    preserveRecordFields();
    let amt = Math.round((parseFloat(st.amount) || 0) * 100) / 100;
    let originalPrice = null, discount = null;
    if (st.discountOn) {
      const orig = Math.round((parseFloat(st.discountOrig) || 0) * 100) / 100;
      const disc = Math.round((parseFloat(st.discountDisc) || 0) * 100) / 100;
      amt = Math.round(Math.max(0, orig - disc) * 100) / 100;
      originalPrice = orig;
      discount = disc;
    }
    if (!amt || amt <= 0) { UI.toast('请输入有效金额', 'err'); return; }
    const date = st.date || UI.todayStr();
    const time = st.time || UI.nowTime();
    const base = { amount: amt, date, time, merchant: '', note: st.note, originalPrice, discount, excludeStats: !!st.excludeStats, excludeBudget: !!st.excludeBudget, attachments: st.attachments || [] };
    if (st.type === 'transfer') {
      const from = $('#rec-from') ? $('#rec-from').value : null;
      const to = $('#rec-to') ? $('#rec-to').value : null;
      if (!from || !to || from === to) { UI.toast('请选择两个不同的账户', 'err'); return; }
      const tx = Object.assign({ type: 'transfer', accountId: from, toAccountId: to, categoryId: null }, base);
      if (st.editId) Store.updateTransaction(st.editId, tx); else Store.addTransaction(tx);
    } else {
      if (!st.categoryId) { UI.toast('请选择分类', 'err'); return; }
      if (!st.accountId) { UI.toast('请选择账户', 'err'); return; }
      const tx = Object.assign({ type: st.type, categoryId: st.categoryId, accountId: st.accountId }, base);
      if (st.editId) Store.updateTransaction(st.editId, tx); else Store.addTransaction(tx);
    }
    UI.toast(st.editId ? '已保存修改' : '记账成功');
    resetRecordState();
    nav('/home');
  }

  function delTx() {
    const id = state.record.editId;
    if (!id) return;
    UI.confirm('确定删除这条账单吗？删除后无法恢复。', { danger: true }).then(ok => {
      if (!ok) return;
      Store.removeTransaction(id);
      resetRecordState();
      UI.toast('已删除');
      nav('/home');
    });
  }

  function addDaysStr(s, n) {
    const d = new Date(s + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return ymd(d);
  }

  /* ‹ › 导航：日历页翻月；主页明细框按所选周期翻页 */
  function shiftPeriod(delta) {
    const r = route().split('?')[0];
    if (r === '/calendar') {
      const { y, m } = UI.parseMonthKey(state.month);
      const nd = new Date(y, m - 1 + delta, 1);
      state.month = UI.monthKey(nd.getFullYear(), nd.getMonth() + 1);
      Views.calendar();
      return;
    }
    const bp = state.billPeriod;
    if (bp === 'month') {
      const { y, m } = UI.parseMonthKey(state.month);
      const nd = new Date(y, m - 1 + delta, 1);
      state.month = UI.monthKey(nd.getFullYear(), nd.getMonth() + 1);
    } else if (bp === 'week') {
      state.billWeekStart = addDaysStr(state.billWeekStart, delta * 7);
    } else if (bp === 'year') {
      state.billYear += delta;
    }
    Views.home();
  }

  function resetBillAnchors() {
    const now = new Date();
    state.month = UI.monthKey(now.getFullYear(), now.getMonth() + 1);
    state.billYear = now.getFullYear();
    state.billWeekStart = curWeekStart();
  }

  /* ---------------- 预算 ---------------- */
  function saveBudgetTotal() {
    const v = parseFloat($('#budget-total').value);
    Store.data.settings.monthBudget = isNaN(v) || v < 0 ? 0 : Math.round(v * 100) / 100;
    Store.save();
    UI.toast('总预算已保存');
    Views.budget();
  }

  function saveCategoryBudget(el) {
    const id = el.dataset.budgetCat;
    const v = parseFloat(el.value);
    const val = isNaN(v) || v <= 0 ? 0 : Math.round(v * 100) / 100;
    const cb = Store.data.settings.categoryBudgets;
    if (val > 0) cb[id] = val; else delete cb[id];
    Store.save();
    UI.toast('分类预算已保存');
    Views.budget();
  }

  /* ---------------- 账户 ---------------- */
  function saveAcc(id) {
    const box = document.querySelector('#modal-root .modal-overlay');
    if (!box) return;
    const name = $('#acc-name').value.trim();
    if (!name) { UI.toast('请输入账户名称', 'err'); return; }
    const patch = {
      name,
      type: box.dataset.accType || 'other',
      icon: box.dataset.accEmoji || 'cash',
      color: box.dataset.accColor || '#FFB3BA',
      initialBalance: Math.round((parseFloat($('#acc-balance').value) || 0) * 100) / 100,
      hidden: $('#acc-hidden').checked
    };
    if (id) Store.updateAccount(id, patch); else Store.addAccount(patch);
    closeModal();
    UI.toast(id ? '账户已更新' : '账户已创建');
    Views.accounts();
  }

  function delAcc(id) {
    if (Store.accountTxCount(id) > 0) {
      UI.toast('该账户存在账单记录，无法删除，可在编辑中设为隐藏', 'err');
      return;
    }
    const a = Store.getAccount(id);
    UI.confirm('确定删除账户「' + (a ? esc(a.name) : '') + '」吗？', { danger: true }).then(ok => {
      if (!ok) return;
      Store.removeAccount(id);
      closeModal();
      UI.toast('账户已删除');
      Views.accounts();
    });
  }

  function saveTransfer() {
    const from = $('#tf-from').value;
    const to = $('#tf-to').value;
    const amt = Math.round((parseFloat($('#tf-amount').value) || 0) * 100) / 100;
    if (!from || !to || from === to) { UI.toast('请选择两个不同的账户', 'err'); return; }
    if (!amt || amt <= 0) { UI.toast('请输入有效金额', 'err'); return; }
    Store.addTransaction({
      type: 'transfer', accountId: from, toAccountId: to, amount: amt,
      date: $('#tf-date').value, time: UI.nowTime(), merchant: '', note: $('#tf-note').value.trim()
    });
    closeModal();
    UI.toast('转账成功');
    Views.accounts();
  }

  /* ---------------- 分类 ---------------- */
  function saveCat(id) {
    const box = document.querySelector('#modal-root .modal-overlay');
    if (!box) return;
    const name = $('#cat-name').value.trim();
    if (!name) { UI.toast('请输入分类名称', 'err'); return; }
    const parentId = state.pendingCatParent || null;
    const patch = { name, icon: box.dataset.catEmoji || '📦', color: box.dataset.catColor || '#adb5bd' };
    if (id) Store.updateCategory(id, patch);
    else Store.addCategory(Object.assign({ type: state.settingsCatType, parentId }, patch));
    state.pendingCatParent = null;
    closeModal();
    UI.toast(id ? '分类已更新' : '分类已创建');
    Views.settings();
  }

  function delCat(id) {
    const c = Store.getCategory(id);
    if (!c) return;
    const subs = Store.getSubCategories(id);
    const tip = subs.length ? '（含 ' + subs.length + ' 个子分类，将一并删除，其账单归入「其他」）' : '，其下账单将归入「其他」';
    UI.confirm('删除分类「' + esc(c.name) + '」' + tip + '，确定删除？').then(ok => {
      if (!ok) return;
      Store.removeCategory(id);
      UI.toast('分类已删除');
      Views.settings();
    });
  }

  /* ---------------- 借贷 ---------------- */
  function saveLoan(id) {
    const box = document.querySelector('#modal-root .modal-overlay');
    if (!box) return;
    const laSel = $('#loan-la');
    const laId = laSel ? laSel.value : '';
    const la = laId ? Store.getLoanAccount(laId) : null;
    const person = la ? la.name : ($('#loan-person') ? $('#loan-person').value.trim() : '');
    if (!laId || !person) { UI.toast('请选择借贷账户', 'err'); return; }
    const amount = Math.round((parseFloat($('#loan-amount').value) || 0) * 100) / 100;
    if (!amount || amount <= 0) { UI.toast('请输入有效金额', 'err'); return; }
    const patch = {
      type: box.dataset.loanType || 'lend',
      person,
      loanAccountId: laId,
      amount,
      date: $('#loan-date').value,
      dueDate: $('#loan-due').value || '',
      accountId: $('#loan-acc').value || '',
      note: $('#loan-note').value.trim()
    };
    if (id) Store.updateLoan(id, patch); else Store.addLoan(patch);
    closeModal();
    UI.toast(id ? '借贷已更新' : '借贷已记录');
    Views.loans();
  }

  function saveLoanAcc(id) {
    const box = document.querySelector('#modal-root .modal-overlay');
    if (!box) return;
    const name = $('#la-name').value.trim();
    if (!name) { UI.toast('请输入账户名称', 'err'); return; }
    const color = box.dataset.laColor || '#2f9e44';
    if (id) Store.updateLoanAccount(id, { name, color });
    else Store.addLoanAccount({ name, color });
    closeModal();
    UI.toast(id ? '借贷账户已更新' : '借贷账户已创建');
    Views.loans();
  }

  function delLoanAcc(id) {
    const a = Store.getLoanAccount(id);
    if (!a) return;
    const n = Store.loanAccountTxCount(id);
    if (n > 0) { UI.toast('该账户下有 ' + n + ' 笔借贷，请先删除相关记录', 'err'); return; }
    UI.confirm('确定删除借贷账户「' + esc(a.name) + '」吗？', { danger: true }).then(ok => {
      if (!ok) return;
      Store.removeLoanAccount(id);
      closeModal();
      UI.toast('借贷账户已删除');
      Views.loans();
    });
  }

  function delLoan(id) {
    const l = Store.getLoan(id);
    if (!l) return;
    UI.confirm('确定删除与 <b>' + esc(l.person) + '</b> 的这笔借贷记录吗？', { danger: true }).then(ok => {
      if (!ok) return;
      Store.removeLoan(id);
      closeModal();
      UI.toast('借贷记录已删除');
      Views.accounts();
    });
  }

  function confirmSettle(id) {
    const l = Store.getLoan(id);
    if (!l) return;
    const isLend = l.type === 'lend';
    const acc = $('#sl-acc') ? $('#sl-acc').value : '';
    const cat = $('#sl-cat') ? $('#sl-cat').value : '';
    const date = $('#sl-date') ? $('#sl-date').value : UI.todayStr();
    if (!acc || !cat) { UI.toast('请选择账户与分类', 'err'); return; }
    Store.addTransaction({
      type: isLend ? 'income' : 'expense', amount: l.amount, categoryId: cat, accountId: acc,
      date, time: UI.nowTime(), merchant: l.person,
      note: (l.note ? l.note + ' · ' : '') + (isLend ? '收回借出' : '还清借入')
    });
    Store.settleLoan(id, { settledDate: date });
    closeModal();
    UI.toast('已结清并记账');
    Views.accounts();
  }

  /* ---------------- 周期账单 ---------------- */
  function saveRec(id) {
    const box = document.querySelector('#modal-root .modal-overlay');
    if (!box) return;
    const name = $('#rec-name').value.trim();
    if (!name) { UI.toast('请输入名称', 'err'); return; }
    const amount = Math.round((parseFloat($('#rec-amount2').value) || 0) * 100) / 100;
    if (!amount || amount <= 0) { UI.toast('请输入有效金额', 'err'); return; }
    const type = box.dataset.recType || 'expense';
    const cat = $('#rec-cat2').value;
    const acc = $('#rec-acc2').value;
    if (!cat || !acc) { UI.toast('请选择分类与账户', 'err'); return; }
    const patch = {
      name, type, amount, categoryId: cat, accountId: acc,
      frequency: $('#rec-freq').value,
      startDate: $('#rec-start').value,
      endDate: $('#rec-end').value || '',
      note: $('#rec-note2').value.trim(),
      enabled: $('#rec-enabled').checked
    };
    if (id) {
      const old = Store.getRecurring(id);
      Store.updateRecurring(id, patch);
      if (patch.startDate !== old.startDate) Store.updateRecurring(id, { nextDate: patch.startDate });
    } else {
      Store.addRecurring(patch);
    }
    closeModal();
    UI.toast(id ? '周期账单已更新' : '周期账单已创建');
    Views.settings();
  }

  function delRec(id) {
    const r = Store.getRecurring(id);
    if (!r) return;
    UI.confirm('确定删除周期账单「' + esc(r.name) + '」吗？（历史账单不会删除）', { danger: true }).then(ok => {
      if (!ok) return;
      Store.removeRecurring(id);
      closeModal();
      UI.toast('周期账单已删除');
      App.render();
    });
  }

  function processRec(id) {
    const r = Store.getRecurring(id);
    if (!r) return;
    UI.confirm('将为 <b>' + esc(r.name) + '</b> 记一笔' + (r.type === 'expense' ? '支出' : '收入') + ' ' + money(r.amount) +
      '（日期 ' + UI.fmtDateCn(r.nextDate) + '），并自动顺延到下一周期？').then(ok => {
      if (!ok) return;
      Store.recordRecurring(id);
      UI.toast('已入账并顺延');
      App.render();
    });
  }

  function skipRec(id) {
    const r = Store.getRecurring(id);
    if (!r) return;
    Store.advanceRecurring(id);
    UI.toast('已跳过本期，顺延到 ' + UI.fmtDateCn(Store.getRecurring(id).nextDate));
    App.render();
  }

  function toggleRec(id) {
    const r = Store.getRecurring(id);
    if (!r) return;
    Store.updateRecurring(id, { enabled: !r.enabled });
    UI.toast(r.enabled ? '已停用' : '已启用');
    App.render();
  }

  /* ---------------- 数据 ---------------- */
  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    download('litebill-backup-' + UI.todayStr() + '.json', JSON.stringify(Store.data, null, 2));
    UI.toast('备份已导出');
  }

  function exportCSV() {
    download('litebill-export-' + UI.todayStr() + '.csv', Store.exportCSV(), 'text/csv;charset=utf-8');
    UI.toast('CSV 已导出');
  }

  function importJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.accounts) || !Array.isArray(obj.categories) || !Array.isArray(obj.transactions)) throw new Error('bad');
        UI.confirm('导入将<strong>替换</strong>当前全部数据（共 ' + obj.transactions.length + ' 条账单），确定继续？', { danger: true }).then(ok => {
          if (!ok) return;
          Store.data.accounts = obj.accounts;
          Store.data.categories = obj.categories;
          Store.data.transactions = obj.transactions;
          if (obj.settings) Object.assign(Store.data.settings, obj.settings);
          Store.save();
          UI.toast('导入成功');
          render();
        });
      } catch (e) {
        UI.toast('导入失败：文件格式不正确', 'err');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  /* ---------- 示例数据（可复现的伪随机） ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function loadSample() {
    UI.confirm('将在当前数据上<b>追加</b>约 3 个月的示例账单，确定继续？').then(ok => {
      if (!ok) return;
      const rnd = mulberry32(20250618);
      const catsE = Store.getCategories('expense');
      const catsI = Store.getCategories('income');
      const accs = Store.getAccounts();
      const spend = { '购物消费': 400, '食品餐饮': 80, '出行交通': 60, '居家生活': 2200, '文化教育': 150, '送礼人情': 300, '医疗健康': 200, '其他': 100 };
      const now = new Date();
      for (let i = 89; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const date = d.getFullYear() + '-' + UI.pad(d.getMonth() + 1) + '-' + UI.pad(d.getDate());
        const day = d.getDate();
        if (day === 10) {
          Store.addTransaction({ type: 'income', amount: 9000, categoryId: (catsI.find(c => c.name === '兼职外快') || catsI[0]).id, accountId: accs[3] ? accs[3].id : accs[0].id, date, time: '09:00', merchant: '公司', note: '工资' });
        }
        if (day === 20) {
          Store.addTransaction({ type: 'income', amount: Math.round(rnd() * 200 + 50), categoryId: (catsI.find(c => c.name === '理财盈利') || catsI[0]).id, accountId: accs[2] ? accs[2].id : accs[0].id, date, time: '15:00', merchant: '', note: '理财收益' });
        }
        const n = Math.floor(rnd() * 5);
        for (let k = 0; k < n; k++) {
          const c = catsE[Math.floor(rnd() * catsE.length)];
          const max = spend[c.name] || 100;
          const amount = Math.round((rnd() * (max - 5) + 5) * 100) / 100;
          const acc = accs[Math.floor(rnd() * accs.length)];
          Store.addTransaction({ type: 'expense', amount, categoryId: c.id, accountId: acc.id, date, time: UI.pad(Math.floor(rnd() * 8) + 8) + ':' + UI.pad(Math.floor(rnd() * 60)), merchant: '', note: '' });
        }
      }
      UI.toast('已载入示例数据（追加 3 个月账单）');
      render();
    });
  }

  function clearAll() {
    UI.confirm('确定清空<b>全部</b>数据（账户、分类、账单）吗？此操作不可恢复，建议先导出备份。', { danger: true }).then(ok => {
      if (!ok) return;
      Store.reset();
      UI.toast('已清空全部数据');
      render();
    });
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    const t = Store.data.settings.theme;
    let mode = t;
    if (t === 'auto') mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = mode;
  }

  /* 应用所选字体 */
  function applyFont() {
    const f = (Preset.fonts.find(x => x.v === Store.data.settings.font)) || Preset.fonts[0];
    document.body.style.fontFamily = f.f || '';
  }

  /* ---------------- 事件 ---------------- */
  function closeModal() {
    if (state.modal) { state.modal.close(); state.modal = null; }
  }

  /* 检查更新：从当前网页地址（永久地址）拉取最新版，自动下载并刷新 */
  function checkUpdate() {
    if (!('serviceWorker' in navigator)) { UI.toast('当前浏览器不支持自动更新', 'err'); return; }
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) { UI.toast('未检测到应用缓存，请用「添加到主屏幕」方式打开后再更新', 'err'); return; }
      let updated = false;
      reg.addEventListener('updatefound', () => {
        updated = true;
        UI.toast('发现新版本，正在下载…');
        const nw = reg.installing;
        if (nw) nw.addEventListener('statechange', () => {
          if (nw.state === 'activated') {
            UI.toast('更新完成，正在刷新…');
            setTimeout(() => location.reload(), 800);
          }
        });
      });
      reg.update().catch(() => UI.toast('检查更新失败（请检查网络）', 'err'));
      setTimeout(() => { if (!updated) UI.toast('已是最新版本 ' + APP_VERSION); }, 3000);
    });
  }

  function handleAction(el) {
    const act = el.dataset.action;
    const val = el.dataset.val;
    switch (act) {
      case 'nav': nav(el.dataset.nav); break;
      case 'open-search': nav('/search'); break;
      case 'go-record': nav('/record'); break;
      case 'rec-type': {
        const st = state.record;
        st.type = val; st.categoryId = null; st.from = null; st.to = null;
        if (st.type !== 'transfer') {
          const roots = Store.getRootCategories(st.type);
          st.categoryId = roots.length ? roots[0].id : null;
          if (!st.accountId) st.accountId = Store.getAccounts()[0] ? Store.getAccounts()[0].id : null;
        }
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
        Views.renderRecCats();
        Views.renderRecSubs();
        Views.renderRecAccs();
        Views.renderRecFnRow();
        break;
      }
      case 'key': pressKey(el.dataset.key); break;
      case 'pick-cat': {
        const st = state.record;
        st.categoryId = val;
        document.querySelectorAll('.cat-item').forEach(c => c.classList.toggle('active', c.dataset.val === val));
        Views.renderRecSubs();
        break;
      }
      case 'pick-sub':
        state.record.categoryId = val;
        document.querySelectorAll('.sub-chip').forEach(c => c.classList.toggle('active', c.dataset.val === val));
        break;
      case 'rec-meta-acc': Views.openRecAccModal(); break;
      case 'pick-acc':
        state.record.accountId = val;
        closeModal();
        Views.renderRecFnRow();
        break;
      case 'rec-meta-time': Views.openRecTimeModal(); break;
      case 'dt-month': {
        const { y, m } = UI.parseMonthKey(state.dt.month);
        const nd = new Date(y, m - 1 + Number(el.dataset.d), 1);
        state.dt.month = UI.monthKey(nd.getFullYear(), nd.getMonth() + 1);
        Views.renderDt();
        break;
      }
      case 'dt-pick-day':
        state.dt.date = val;
        Views.renderDt();
        break;
      case 'dt-spin': {
        const col = el.dataset.col;
        const d = Number(el.dataset.d);
        if (col === 'h') state.dt.h = (state.dt.h + d + 24) % 24;
        else state.dt.m = (state.dt.m + d + 60) % 60;
        Views.renderDt();
        break;
      }
      case 'save-rec-time':
        state.record.date = state.dt.date;
        state.record.time = UI.pad(state.dt.h) + ':' + UI.pad(state.dt.m);
        closeModal();
        break;
      case 'rec-attr':
        state.record.attrPanel = !state.record.attrPanel;
        Views.renderRecPanels();
        Views.renderRecFnRow();
        break;
      case 'rec-discount':
        state.record.discountOn = !state.record.discountOn;
        if (!state.record.discountOn) { state.record.discountOrig = '0'; state.record.discountDisc = '0'; }
        Views.renderRecPanels();
        Views.renderRecFnRow();
        break;
      case 'rec-attach':
        state.record.attachPanel = !state.record.attachPanel;
        Views.renderRecPanels();
        Views.renderRecFnRow();
        break;
      case 'attach-src': {
        const map = { camera: 'attach-camera', gallery: 'attach-gallery', file: 'attach-file' };
        const input = $(map[el.dataset.src] || 'attach-file');
        if (input) input.click();
        break;
      }
      case 'attach-remove':
        state.record.attachments.splice(Number(val), 1);
        Views.renderRecPanels();
        Views.renderRecFnRow();
        break;
      case 'save-tx': saveTx(); break;
      case 'del-tx': delTx(); break;
      case 'edit-tx': nav('/record?id=' + val); break;
      case 'month-prev': shiftPeriod(-1); break;
      case 'month-next': shiftPeriod(1); break;
      case 'month-today':
        if (route().split('?')[0] === '/calendar') {
          state.month = UI.monthKey(new Date().getFullYear(), new Date().getMonth() + 1);
          state.calendarDay = UI.todayStr();
          Views.calendar();
        } else {
          resetBillAnchors();
          Views.home();
        }
        break;
      case 'bill-cycle': {
        const order = ['all', 'year', 'month'];
        let idx = order.indexOf(state.billPeriod);
        if (idx === -1) idx = order.indexOf('month');
        const val = order[(idx + Number(el.dataset.d) + order.length) % order.length];
        state.billPeriod = val;
        if (val === 'year') state.billYear = new Date().getFullYear();
        else if (val === 'month') resetBillAnchors();
        Views.home();
        break;
      }
      case 'bill-type':
        state.billType = state.billType === val ? 'all' : val;
        Views.home();
        {
          const bb = $('#bill-box');
          if (bb && bb.scrollIntoView) bb.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      case 'cal-pick':
        state.calendarDay = val;
        Views.calendar();
        break;
      case 'cal-jump-open': Views.openMonthJump(); break;
      case 'cal-jump':
        state.month = val;
        state.calendarDay = val + '-01';
        closeModal();
        Views.calendar();
        break;
      case 'cal-today':
        state.month = UI.monthKey(new Date().getFullYear(), new Date().getMonth() + 1);
        state.calendarDay = UI.todayStr();
        Views.calendar();
        break;
      case 'cal-record': {
        const st = state.record;
        st.date = state.calendarDay || UI.todayStr();
        st._prefill = true;
        nav('/record');
        break;
      }
      case 'stat-page': nav('/stats/' + val); break;
      case 'stat-nav': {
        if (route().split('/')[2] === 'year') {
          state.stats.year += parseInt(val, 10);
        } else {
          const { y, m } = UI.parseMonthKey(state.stats.monthKey);
          let ny = y, nm = m + parseInt(val, 10);
          if (nm < 1) { nm = 12; ny--; } else if (nm > 12) { nm = 1; ny++; }
          state.stats.monthKey = UI.monthKey(ny, nm);
        }
        statsRefresh();
        break;
      }
      case 'stat-today':
        state.stats.monthKey = UI.monthKey(new Date().getFullYear(), new Date().getMonth() + 1);
        state.stats.year = new Date().getFullYear();
        statsRefresh();
        break;
      case 'stat-bar': state.stats.bar = val; statsRefresh(); break;
      case 'dly-bar': state.stats.dailyBar = val; Views.statsDaily(); break;
      case 'stat-type': state.stats.type = val; statsRefresh(); break;
      case 'stat-cat': state.stats.cat = val; statsRefresh(); break;
      case 'budget-total-save': saveBudgetTotal(); break;
      case 'add-acc': Views.openAccModal(null); break;
      case 'edit-acc': Views.openAccModal(val); break;
      case 'save-acc': saveAcc(val || null); break;
      case 'del-acc': delAcc(val); break;
      case 'open-transfer': Views.openTransferModal(); break;
      case 'save-transfer': saveTransfer(); break;
      case 'voice': Views.openVoiceModal(); break;
      case 'ocr': Views.openOcrModal(); break;
      case 'text-bill': Views.openTextModal(); break;
      case 'add-loan': Views.openLoanModal(null, val || null); break;
      case 'edit-loan': Views.openLoanModal(val); break;
      case 'add-loan-acc': Views.openLoanAccountModal(null); break;
      case 'edit-loan-acc': Views.openLoanAccountModal(val); break;
      case 'save-loan-acc': saveLoanAcc(val || null); break;
      case 'del-loan-acc': delLoanAcc(val); break;
      case 'loan-acc-open':
        state.loanAccOpen = state.loanAccOpen === val ? null : val;
        Views.loans();
        break;
      case 'save-loan': saveLoan(val || null); break;
      case 'del-loan': delLoan(val); break;
      case 'settle-loan': Views.settleLoanModal(val); break;
      case 'confirm-settle': confirmSettle(val); break;
      case 'add-rec': Views.openRecurringModal(null); break;
      case 'edit-rec': Views.openRecurringModal(val); break;
      case 'save-rec': saveRec(val || null); break;
      case 'del-rec': delRec(val); break;
      case 'process-rec': processRec(val); break;
      case 'skip-rec': skipRec(val); break;
      case 'toggle-rec': toggleRec(val); break;
      case 'add-cat': Views.openCatModal(null); break;
      case 'add-sub-cat': Views.openCatModal(null, val); break;
      case 'toggle-cat-subs':
        state.expandCats[val] = !state.expandCats[val];
        Views.settings();
        break;
      case 'edit-cat': Views.openCatModal(val); break;
      case 'save-cat': saveCat(val || null); break;
      case 'del-cat': delCat(val); break;
      case 'set-cat-type': state.settingsCatType = val; Views.settings(); break;
      case 'set-toggle':
        state.settingsOpen[val] = !state.settingsOpen[val];
        Views.settings();
        break;
      case 'acc-toggle':
        state.accOpen[val] = !state.accOpen[val];
        Views.accounts();
        break;
      case 'theme-set':
        Store.data.settings.theme = val;
        Store.save();
        applyTheme();
        Views.settings();
        break;
      case 'font-set':
        Store.data.settings.font = val;
        Store.save();
        applyFont();
        Views.settings();
        break;
      case 'export-json': exportJSON(); break;
      case 'import-json': $('#import-file').click(); break;
      case 'export-csv': exportCSV(); break;
      case 'open-import': Views.openImportModal(); break;
      case 'imp-pick': $('#imp-file').click(); break;
      case 'imp-back': Views.showImpStep(0); break;
      case 'imp-do': Views.doImport(); break;
      case 'load-sample': loadSample(); break;
      case 'clear-all': clearAll(); break;
      case 'modal-close': closeModal(); break;
      case 'check-update': checkUpdate(); break;
      case 'ico-upload': $('#ico-file').click(); break;
      default: break;
    }
  }


  function bindEvents() {
    document.querySelectorAll('.nav-item').forEach(n =>
      n.addEventListener('click', () => nav(n.dataset.route)));

    document.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (el) handleAction(el);
    });

    document.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'stat-from') { state.stats.from = el.value; statsRefresh(); }
      else if (el.id === 'stat-to') { state.stats.to = el.value; statsRefresh(); }
      else if (el.matches('[data-budget-cat]')) saveCategoryBudget(el);
      else if (el.id === 'import-file') importJSON(el);
      else if (el.id === 'imp-file') { Views.impHandleFile(el.files[0]); el.value = ''; }
      else if (el.id === 'ico-file') {
        const f = el.files && el.files[0];
        el.value = '';
        if (!f) return;
        if (!/^image\//.test(f.type)) { UI.toast('请选择图片文件', 'err'); return; }
        if (f.size > 300 * 1024) { UI.toast('图片需小于 300KB', 'err'); return; }
        const reader = new FileReader();
        reader.onload = () => {
          const box = document.querySelector('#modal-root .modal-overlay');
          if (!box) return;
          if (box.dataset.accEmoji !== undefined) box.dataset.accEmoji = reader.result;
          else if (box.dataset.catEmoji !== undefined) box.dataset.catEmoji = reader.result;
          UI.toast('图标已设置，保存后生效');
        };
        reader.readAsDataURL(f);
      }
      else if (el.id === 'cat-color') {
        Store.data.settings.catIconColor = el.checked;
        Store.save();
        UI.toast(el.checked ? '已开启分类图标颜色' : '已关闭，图标全部为黑色');
        Views.settings();
      }
      else if (el.id === 'attr-exclude-stats') { state.record.excludeStats = el.checked; }
      else if (el.id === 'attr-exclude-budget') { state.record.excludeBudget = el.checked; }
      else if (el.id === 'attach-camera' || el.id === 'attach-gallery' || el.id === 'attach-file') {
        Views.handleAttachFiles(el.files);
        el.value = '';
        Views.renderRecFnRow();
      }
    });

    /* 优惠输入：键盘路由目标 + 实时计算 */
    document.addEventListener('input', e => {
      const el = e.target;
      if (el.id === 'disc-orig' || el.id === 'disc-disc') {
        state.record.discountTarget = el.dataset.discTarget || 'orig';
        if (el.id === 'disc-orig') state.record.discountOrig = el.value;
        else state.record.discountDisc = el.value;
        Views.updateDiscountCalc();
      }
    });
    document.addEventListener('focusin', e => {
      if (e.target && e.target.dataset && e.target.dataset.discTarget) {
        state.record.discountTarget = e.target.dataset.discTarget;
        Views.updateDiscountHighlight();
      }
    });

    /* 记账页键盘输入 */
    document.addEventListener('keydown', e => {
      if (document.querySelector('.modal-overlay')) {
        if (e.key === 'Escape') closeModal();
        return;
      }
      if (route().split('?')[0] !== '/record') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (/^[0-9]$/.test(e.key)) { pressKey(e.key); e.preventDefault(); }
      else if (e.key === '.') { pressKey('.'); e.preventDefault(); }
      else if (e.key === 'Backspace') { pressKey('back'); e.preventDefault(); }
      else if (e.key === '=') { pressKey('='); e.preventDefault(); }
      else if (['+', '-', '*', '/'].indexOf(e.key) !== -1) { pressKey(e.key); e.preventDefault(); }
      else if (e.key === 'Enter') { saveTx(); e.preventDefault(); }
    });

    window.addEventListener('hashchange', render);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (Store.data.settings.theme === 'auto') applyTheme();
      });
    }
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    Store.load();
    if (!Store.persistOk) {
      UI.toast('⚠️ 当前浏览器禁止本地存储，数据仅保存在内存中，刷新后会丢失，建议改用 Chrome/Edge 或本地服务打开', 'err');
    }
    applyTheme();
    applyFont();
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { state, nav, render, closeModal, pressKey, VERSION: APP_VERSION };
})();
