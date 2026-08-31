/* 数据层：localStorage 持久化 + CRUD + 统计计算 */
window.Store = (() => {
  const KEY = 'litebill.data.v1';
  const CAT_VERSION = '2026-04';   // 分类结构版本（升级时自动重建分类）

  let data = null;
  let persistOk = true;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const r2 = n => Math.round(n * 100) / 100;

  /* 按预设构建分类（含二级分类，二级颜色继承一级） */
  function buildPresetCategories() {
    const cats = [];
    const rootIds = {};
    const addRoots = (type, roots, subs) => {
      roots.forEach(c => {
        const o = Object.assign({ id: uid(), type }, c);
        cats.push(o);
        rootIds[type + ':' + c.name] = o.id;
      });
      (subs || []).forEach(spec => {
        const pid = rootIds[type + ':' + spec.parent];
        if (!pid) return;
        const rootColor = roots.find(r => r.name === spec.parent).color;
        spec.items.forEach(sub => cats.push(Object.assign({ id: uid(), type, parentId: pid, color: rootColor }, sub)));
      });
    };
    addRoots('expense', Preset.expenseCategories, Preset.expenseSubs);
    addRoots('income', Preset.incomeCategories, []);
    /* 兜底「其他」 */
    if (!cats.some(c => c.type === 'expense' && !c.parentId && c.name === '其他')) {
      cats.push({ id: uid(), type: 'expense', name: '其他', icon: '📦', color: '#adb5bd' });
    }
    if (!cats.some(c => c.type === 'income' && !c.parentId && c.name === '其他')) {
      cats.push({ id: uid(), type: 'income', name: '其他', icon: '💰', color: '#adb5bd' });
    }
    return cats;
  }

  /* 迁移：重建分类为最新预设，旧账单分类失效时归入「其他」 */
  function migrateCategories() {
    const cats = buildPresetCategories();
    const validIds = {};
    cats.forEach(c => { validIds[c.id] = true; });
    const fallbackOf = type => {
      const f = cats.find(c => c.type === type && !c.parentId && c.name === '其他');
      return f ? f.id : null;
    };
    data.transactions.forEach(t => {
      if (t.categoryId && !validIds[t.categoryId]) {
        t.categoryId = fallbackOf(t.type === 'income' ? 'income' : 'expense');
      }
    });
    data.categories = cats;
    data.settings.categoryBudgets = {};
    data.settings.catVersion = CAT_VERSION;
    save();
  }

  function defaults() {
    return {
      version: 1,
      settings: {
        currency: '¥',
        monthBudget: 3000,
        categoryBudgets: {},
        theme: 'auto',           // light | dark | auto
        startDay: 1,
        catVersion: CAT_VERSION,
        colorVersion: 'macaron-1',
        catPalette: 'macaron-2',
        catIconColor: false,     // 分类图标颜色开关：false = 全部黑色
        catColorVersion: 'macaron-1',
        font: 'default',         // 字体：default | rounded | serif | hei | kai
        accOrder: false,         // 账户页是否显示排序按钮（默认关闭）
        reminders: [],           // 记账提醒：[{id, mode, time, weekDays, monthDay, note, enabled}]
        budgets: { month: {}, year: {}, week: {} },   // 按周期存储的预算 {period: {key: {total, cats}}}
        sort: {                  // 排序管理
          cat1: { expense: { mode: 'freq', desc: false }, income: { mode: 'freq', desc: false } },
          cat2: { expense: { mode: 'freq', desc: false }, income: { mode: 'freq', desc: false } },
          acc: { mode: 'manual', desc: false }
        },
        funcs: { homeTextBill: true }  // 功能管理：首页文字记账入口开关
      },
      accounts: Preset.defaultAccounts.map(a => Object.assign({ id: uid(), includeAssets: true }, a)),
      categories: buildPresetCategories(),
      transactions: [],
      loans: [],
      recurrings: [],
      loanAccounts: []
    };
  }

  /* 预设分类查询表：type|父级名|名称 → {icon, color} */
  function buildPresetLookup() {
    const map = {};
    const key = (type, p, n) => type + '|' + (p || '') + '|' + n;
    Preset.expenseCategories.forEach(c => { map[key('expense', '', c.name)] = { icon: c.icon, color: c.color }; });
    Preset.expenseSubs.forEach(spec => {
      const root = Preset.expenseCategories.find(r => r.name === spec.parent);
      spec.items.forEach(sub => {
        map[key('expense', spec.parent, sub.name)] = { icon: sub.icon, color: root ? root.color : '#adb5bd' };
      });
    });
    Preset.incomeCategories.forEach(c => { map[key('income', '', c.name)] = { icon: c.icon, color: c.color }; });
    return map;
  }

  /* 定向迁移：仅同步内置分类的图标/颜色（不删除自定义分类、不动账单） */
  function syncPresetIcons() {
    const lookup = buildPresetLookup();
    data.categories.forEach(c => {
      const p = c.parentId ? ((data.categories.find(x => x.id === c.parentId) || {}).name || '') : '';
      const hit = lookup[c.type + '|' + p + '|' + c.name];
      if (hit) { c.icon = hit.icon; c.color = hit.color; }
    });
    save();
  }

  /* 迁移：内置分类颜色 → 马卡龙（保留自定义分类的颜色） */
  function syncPresetColors() {
    const lookup = buildPresetLookup();
    data.categories.forEach(c => {
      const p = c.parentId ? ((data.categories.find(x => x.id === c.parentId) || {}).name || '') : '';
      const hit = lookup[c.type + '|' + p + '|' + c.name];
      if (hit) c.color = hit.color;
    });
    save();
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        data = JSON.parse(raw);
        if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.categories)) throw new Error('bad data');
        if (!data.settings) data.settings = defaults().settings;
        if (!Array.isArray(data.loans)) data.loans = [];
        if (!Array.isArray(data.recurrings)) data.recurrings = [];
        /* 迁移：借贷账户（旧 loans.person 自由文本 → 借贷账户） */
        if (!Array.isArray(data.loanAccounts)) data.loanAccounts = [];
        {
          const accByName = {};
          data.loanAccounts.forEach(a => { accByName[a.name] = a; });
          let needSave = false;
          data.loans.forEach(l => {
            if (!l.loanAccountId) {
              const name = String(l.person || '未命名').trim() || '未命名';
              if (!accByName[name]) {
                const na = { id: uid(), name, color: '#adb5bd' };
                data.loanAccounts.push(na);
                accByName[name] = na;
              }
              l.loanAccountId = accByName[name].id;
              needSave = true;
            }
          });
          if (needSave) save();
        }
        /* 迁移：默认账户补齐颜色（老数据无 color 字段） */
        const defColors = { '现金': '#30a46c', '支付宝': '#4dabf7', '微信支付': '#07c160', '储蓄卡': '#ffa94d' };
        data.accounts.forEach(a => { if (!a.color && defColors[a.name]) a.color = defColors[a.name]; });
        /* 迁移：账户配色 → 马卡龙（按账户顺序分配，覆盖旧颜色） */
        if (data.settings.colorVersion !== 'macaron-1') {
          data.accounts.forEach((a, i) => { a.color = Preset.macaron[i % Preset.macaron.length]; });
          data.settings.colorVersion = 'macaron-1';
          save();
        }
        /* 迁移：旧 excluded 标记 → excludeStats + excludeBudget 独立标记 */
        data.transactions.forEach(t => {
          if (t.excludeStats === undefined) t.excludeStats = !!t.excluded;
          if (t.excludeBudget === undefined) t.excludeBudget = !!t.excluded;
        });
        /* 迁移：分类结构版本不一致 → 清空旧分类并重建 */
        if (data.settings.catVersion === '2026-02' || data.settings.catVersion === '2026-03') {
          /* 小版本：只同步内置分类图标/颜色，保护自定义分类与账单 */
          syncPresetIcons();
          data.settings.catVersion = CAT_VERSION;
        } else if (data.settings.catVersion !== CAT_VERSION) {
          migrateCategories();
        }
        /* 迁移：分类配色 → 马卡龙（仅同步内置分类颜色，保护自定义分类） */
        if (data.settings.catPalette !== 'macaron-2') {
          syncPresetIcons();
          data.settings.catPalette = 'macaron-2';
          save();
        }
        if (data.settings.catIconColor === undefined) data.settings.catIconColor = false;
        if (data.settings.font === undefined) data.settings.font = 'default';
        if (data.settings.accOrder === undefined) data.settings.accOrder = false; // 账户排序默认关闭
        if (data.settings.accOrderInit === undefined) { data.settings.accOrder = false; data.settings.accOrderInit = 'v1.115'; }
        if (!Array.isArray(data.settings.reminders)) data.settings.reminders = [];
        /* 迁移：预算按周期存储 */
        if (!data.settings.budgets || typeof data.settings.budgets !== 'object') {
          data.settings.budgets = { month: {}, year: {}, week: {} };
          if (data.settings.monthBudget) {
            const now = new Date();
            const mk = now.getFullYear() + '-' + pad(now.getMonth() + 1);
            data.settings.budgets.month[mk] = { total: data.settings.monthBudget, cats: Object.assign({}, data.settings.categoryBudgets || {}) };
          }
        }
        /* 迁移：排序管理配置 */
        if (!data.settings.sort) {
          data.settings.sort = {
            cat1: { expense: { mode: 'freq', desc: false }, income: { mode: 'freq', desc: false } },
            cat2: { expense: { mode: 'freq', desc: false }, income: { mode: 'freq', desc: false } },
            acc: { mode: 'manual', desc: false }
          };
        }
        data.settings.sort.cat1 = data.settings.sort.cat1 || { expense: { mode: 'freq', desc: false }, income: { mode: 'freq', desc: false } };
        data.settings.sort.cat2 = data.settings.sort.cat2 || { expense: { mode: 'freq', desc: false }, income: { mode: 'freq', desc: false } };
        data.settings.sort.acc = data.settings.sort.acc || { mode: 'manual', desc: false };
        ['cat1', 'cat2'].forEach(k => {
          ['expense', 'income'].forEach(tp => {
            const c = data.settings.sort[k][tp];
            if (!c || !c.mode) data.settings.sort[k][tp] = { mode: 'freq', desc: false };
            if (c && c.desc === undefined) c.desc = false;
          });
        });
        if (!data.settings.sort.acc.mode) data.settings.sort.acc = { mode: 'manual', desc: false };
        /* 迁移：功能管理 */
        if (!data.settings.funcs) data.settings.funcs = { homeTextBill: true };
        if (data.settings.funcs.homeTextBill === undefined) data.settings.funcs.homeTextBill = true;
        /* 迁移：账户「计入总资产」标记默认 true；初始金额默认 0；默认透明色 */
        data.accounts.forEach(a => {
          if (a.includeAssets === undefined) a.includeAssets = true;
          if (a.initialBalance === undefined) a.initialBalance = 0;
        });
        /* 迁移 v1.115：所有账户初始金额清零、默认透明色（一次性） */
        if (data.settings.accInitCleanup !== 'v1.115') {
          data.accounts.forEach(a => {
            a.initialBalance = 0;
            a.color = 'transparent';
          });
          data.settings.accInitCleanup = 'v1.115';
          save();
        }
        /* 迁移：删除指定人名收入分类（用户不再使用），相关账单归入该类型「其他」 */
        if (data.settings.incomeCleanup !== 'v1.87') {
          const REMOVE_INCOME = ['妈妈', '慧慧', '亮君', '双双', '林昌新', '利远瑞', '苏靖淇'];
          const removed = new Set();
          data.categories = data.categories.filter(c => {
            if (c.type === 'income' && REMOVE_INCOME.indexOf(c.name) !== -1) { removed.add(c.id); return false; }
            return true;
          });
          if (removed.size) {
            const other = data.categories.find(c => c.type === 'income' && !c.parentId && c.name === '其他');
            data.transactions.forEach(t => {
              if (removed.has(t.categoryId)) t.categoryId = other ? other.id : null;
            });
            /* 删除空置的父分类引用（子分类） */
            data.categories.forEach(c => { if (c.parentId && removed.has(c.parentId)) c.parentId = null; });
          }
          data.settings.incomeCleanup = 'v1.87';
          save();
        }
        return data;
      }
    } catch (e) { persistOk = false; /* localStorage 不可用（如部分浏览器 file:// 模式）→ 使用内存数据 */ }
    data = defaults();
    save();
    return data;
  }

  function save() {
    if (!persistOk) return;
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { persistOk = false; }
  }

  function reset() { data = defaults(); save(); }

  /* ---------- 分类 ---------- */
  const getCategories = type => data.categories.filter(c => c.type === type);
  const getRootCategories = type => data.categories.filter(c => c.type === type && !c.parentId);
  const getSubCategories = parentId => data.categories.filter(c => c.parentId === parentId);
  const getCategory = id => data.categories.find(c => c.id === id);

  /* 一级分类按使用频率降序（账单笔数最多者排前；频率相同保持原顺序）。
     二级分类的账单计入其一级分类。 */
  function getRootCategoriesByUsage(type) {
    const roots = getRootCategories(type);
    const count = {};
    data.transactions.forEach(t => {
      if (!t.categoryId) return;
      const c = getCategory(t.categoryId);
      if (!c || c.type !== type) return;
      const rootId = c.parentId || c.id;
      count[rootId] = (count[rootId] || 0) + 1;
    });
    return roots.slice().sort((a, b) => (count[b.id] || 0) - (count[a.id] || 0));
  }

  /* 指定一级分类下的二级分类按使用频率降序（频率相同保持原顺序） */
  function getSubCategoriesByUsage(parentId) {
    const subs = getSubCategories(parentId);
    const count = {};
    data.transactions.forEach(t => {
      if (t.categoryId && subs.some(s => s.id === t.categoryId)) {
        count[t.categoryId] = (count[t.categoryId] || 0) + 1;
      }
    });
    return subs.slice().sort((a, b) => (count[b.id] || 0) - (count[a.id] || 0));
  }

  /* 排序配置：level = cat1|cat2|acc，type 仅分类用 */
  const sortCfg = (level, type) => {
    const s = data.settings.sort || {};
    if (level === 'acc') return s.acc || { mode: 'manual', desc: false };
    const g = s[level] || {};
    return g[type] || { mode: 'freq', desc: false };
  };

  /* 一级分类按配置排序：manual = 分类管理中的手动顺序（数组顺序），freq = 使用频率 */
  function getRootCategoriesSorted(type) {
    const cfg = sortCfg('cat1', type);
    let list = getRootCategories(type);
    if (cfg.mode === 'manual') {
      list = list.slice();
    } else {
      const byUsage = getRootCategoriesByUsage(type);
      const idx = {};
      byUsage.forEach((c, i) => { idx[c.id] = i; });
      list = list.slice().sort((a, b) => (idx[a.id] ?? 999) - (idx[b.id] ?? 999));
    }
    if (cfg.desc) list.reverse();
    return list;
  }

  /* 二级分类按配置排序 */
  function getSubCategoriesSorted(parentId) {
    const parent = getCategory(parentId);
    if (!parent) return getSubCategories(parentId);
    const cfg = sortCfg('cat2', parent.type);
    let list = getSubCategories(parentId);
    if (cfg.mode !== 'manual') {
      const byUsage = getSubCategoriesByUsage(parentId);
      const idx = {};
      byUsage.forEach((c, i) => { idx[c.id] = i; });
      list = list.slice().sort((a, b) => (idx[a.id] ?? 999) - (idx[b.id] ?? 999));
    } else {
      list = list.slice();
    }
    if (cfg.desc) list.reverse();
    return list;
  }

  /* 账户按配置排序：manual = 账户页手动顺序（数组顺序），amount = 余额，count = 账单笔数 */
  function getAccountsSorted() {
    const cfg = sortCfg('acc');
    let list = getAccounts().slice();
    if (cfg.mode === 'amount') {
      list.sort((a, b) => accountBalance(b.id) - accountBalance(a.id));
    } else if (cfg.mode === 'count') {
      list.sort((a, b) => accountTxCount(b.id) - accountTxCount(a.id));
    }
    if (cfg.desc) list.reverse();
    return list;
  }

  function addCategory(c) { c.id = uid(); data.categories.push(c); save(); return c; }
  function updateCategory(id, patch) { Object.assign(getCategory(id), patch); save(); }

  function removeCategory(id) {
    const c = getCategory(id);
    if (!c) return;
    const ids = [id];
    data.categories.forEach(x => { if (x.parentId === id) ids.push(x.id); });
    let fallback = data.categories.find(x => x.type === c.type && !x.parentId && x.name === '其他');
    if (!fallback) {
      fallback = { id: uid(), type: c.type, name: '其他', icon: '📦', color: '#adb5bd', parentId: null };
      data.categories.push(fallback);
    }
    data.transactions.forEach(t => { if (ids.indexOf(t.categoryId) !== -1) t.categoryId = fallback.id; });
    data.categories = data.categories.filter(x => ids.indexOf(x.id) === -1);
    const cb = data.settings.categoryBudgets;
    ids.forEach(i => { delete cb[i]; });
    save();
  }

  /* 显示名：二级分类显示为「父级·子级」 */
  function categoryLabel(id) {
    const c = getCategory(id);
    if (!c) return '未分类';
    if (c.parentId) {
      const p = getCategory(c.parentId);
      if (p) return p.name + '·' + c.name;
    }
    return c.name;
  }

  /* ---------- 账户 ---------- */
  const getAccounts = (includeHidden = true) => data.accounts.filter(a => includeHidden || !a.hidden);
  const getAccount = id => data.accounts.find(a => a.id === id);

  function addAccount(a) { a.id = uid(); data.accounts.push(a); save(); return a; }
  function updateAccount(id, patch) { Object.assign(getAccount(id), patch); save(); }
  function removeAccount(id) { data.accounts = data.accounts.filter(a => a.id !== id); save(); }
  const accountTxCount = id => data.transactions.filter(t => t.accountId === id || t.toAccountId === id).length;

  function accountBalance(id) {
    const a = getAccount(id);
    if (!a) return 0;
    let b = a.initialBalance;
    for (const t of data.transactions) {
      if (t.type === 'expense' && t.accountId === id) b -= t.amount;
      else if (t.type === 'income' && t.accountId === id) b += t.amount;
      else if (t.type === 'transfer') {
        if (t.accountId === id) b -= t.amount + (t.fee || 0); // 手续费从转出账户扣除
        if (t.toAccountId === id) b += t.amount;
      }
    }
    return r2(b);
  }

  const totalAssets = () => r2(data.accounts.reduce((s, a) => s + (a.includeAssets === false ? 0 : accountBalance(a.id)), 0));

  /* ---------- 账单 ---------- */
  function addTransaction(t) { t.id = uid(); t.createdAt = Date.now(); data.transactions.push(t); save(); return t; }
  const getTransaction = id => data.transactions.find(t => t.id === id);
  function updateTransaction(id, patch) { Object.assign(getTransaction(id), patch, { updatedAt: Date.now() }); save(); }
  function removeTransaction(id) { data.transactions = data.transactions.filter(t => t.id !== id); save(); }

  const inMonth = (t, y, m) => t.date.startsWith(y + '-' + pad(m));
  const inRange = (t, from, to) => (!from || t.date >= from) && (!to || t.date <= to);

  function getTransactions(opts = {}) {
    let list = data.transactions.slice();
    const { type, categoryId, accountId, keyword, from, to, year, month } = opts;
    if (type && type !== 'all') list = list.filter(t => t.type === type);
    if (categoryId && categoryId !== 'all') list = list.filter(t => t.categoryId === categoryId);
    if (accountId && accountId !== 'all') list = list.filter(t => t.accountId === accountId || t.toAccountId === accountId);
    if (keyword) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(t => {
        return (t.note || '').toLowerCase().includes(kw) ||
               (t.merchant || '').toLowerCase().includes(kw) ||
               categoryLabel(t.categoryId).toLowerCase().includes(kw); // 一级+二级分类名均可匹配
      });
    }
    if (from && to) list = list.filter(t => inRange(t, from, to));
    else if (year && month) list = list.filter(t => inMonth(t, year, month));
    list.sort((a, b) => a.date === b.date
      ? ((a.time || '') < (b.time || '') ? 1 : -1)
      : (a.date < b.date ? 1 : -1));
    return list;
  }

  /* ---------- 统计 ---------- */
  function monthStats(y, m) {
    let income = 0, expense = 0, count = 0;
    for (const t of data.transactions) {
      if (!inMonth(t, y, m)) continue;
      if (t.excludeStats) continue; // 属性：不计入收支
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') { expense += t.amount; count++; }
    }
    return { income: r2(income), expense: r2(expense), balance: r2(income - expense), count };
  }

  function categoryStats(y, m, type) {
    const map = {};
    for (const t of data.transactions) {
      if (t.type !== type || !inMonth(t, y, m)) continue;
      if (t.excludeStats) continue;
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    }
    return Object.entries(map).map(([id, v]) => ({ categoryId: id, value: r2(v) })).sort((a, b) => b.value - a.value);
  }

  function categoryStatsRange(type, from, to) {
    const map = {};
    for (const t of data.transactions) {
      if (t.type !== type || !inRange(t, from, to)) continue;
      if (t.excludeStats) continue;
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    }
    return Object.entries(map).map(([id, v]) => ({ categoryId: id, value: r2(v) })).sort((a, b) => b.value - a.value);
  }

  function dailyStats(y, m) {
    const days = new Date(y, m, 0).getDate();
    const res = [];
    for (let d = 1; d <= days; d++) {
      const day = y + '-' + pad(m) + '-' + pad(d);
      let income = 0, expense = 0;
      for (const t of data.transactions) {
        if (t.date !== day) continue;
        if (t.excludeStats) continue;
        if (t.type === 'income') income += t.amount;
        else if (t.type === 'expense') expense += t.amount;
      }
      res.push({ day: d, label: pad(d), income: r2(income), expense: r2(expense) });
    }
    return res;
  }

  function monthlyTrend(n) {
    const now = new Date();
    let y = now.getFullYear(), m = now.getMonth() + 1;
    const res = [];
    for (let i = 0; i < n; i++) {
      const st = monthStats(y, m);
      res.unshift({ label: (y % 100) + '-' + pad(m), year: y, month: m, income: st.income, expense: st.expense });
      m--; if (m === 0) { m = 12; y--; }
    }
    return res;
  }

  /* 预算按周期查询：period = month|year|week，key = 'YYYY-MM' | 'YYYY' | 'YYYY-Www' */
  function budgetStatus(period, key) {
    const budgets = data.settings.budgets || { month: {}, year: {}, week: {} };
    const bk = (budgets[period] || {})[key] || {};
    let expense = 0;
    const catMap = {};
    const inPeriod = t => {
      if (t.type !== 'expense' || t.excludeBudget) return false;
      if (period === 'month') return inMonth(t, parseInt(key.slice(0, 4), 10), parseInt(key.slice(5, 7), 10));
      if (period === 'year') return t.date.slice(0, 4) === key.slice(0, 4);
      /* week：按周一为一周起点计算 */
      if (period === 'week') {
        const m = key.match(/^(\d{4})-W(\d{1,2})$/);
        if (!m) return false;
        const y = parseInt(m[1], 10), wn = parseInt(m[2], 10);
        const jan1 = new Date(y, 0, 1);
        const firstMon = new Date(y, 0, 1 + ((1 - jan1.getDay() + 7) % 7));
        const weekStart = new Date(firstMon);
        weekStart.setDate(firstMon.getDate() + (wn - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const ds = y + '-' + pad(weekStart.getMonth() + 1) + '-' + pad(weekStart.getDate());
        const de = weekEnd.getFullYear() + '-' + pad(weekEnd.getMonth() + 1) + '-' + pad(weekEnd.getDate());
        return t.date >= ds && t.date <= de;
      }
      return false;
    };
    for (const t of data.transactions) {
      if (!inPeriod(t)) continue;
      expense += t.amount;
      catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount;
    }
    const cats = getCategories('expense').map(c => ({
      category: c,
      budget: (bk.cats || {})[c.id] || 0,
      used: r2(catMap[c.id] || 0)
    })).filter(x => x.budget > 0);
    return { total: { budget: bk.total || 0, used: r2(expense) }, cats };
  }

  /* 保存某周期的总预算 */
  function saveBudgetTotal(period, key, total) {
    const budgets = data.settings.budgets || { month: {}, year: {}, week: {} };
    budgets[period] = budgets[period] || {};
    budgets[period][key] = budgets[period][key] || {};
    budgets[period][key].total = Math.round((parseFloat(total) || 0) * 100) / 100;
    data.settings.budgets = budgets;
    save();
  }

  /* 保存某周期的分类预算 */
  function saveCategoryBudget(period, key, catId, val) {
    const budgets = data.settings.budgets || { month: {}, year: {}, week: {} };
    budgets[period] = budgets[period] || {};
    budgets[period][key] = budgets[period][key] || {};
    budgets[period][key].cats = budgets[period][key].cats || {};
    const v = Math.round((parseFloat(val) || 0) * 100) / 100;
    if (v > 0) budgets[period][key].cats[catId] = v;
    else delete budgets[period][key].cats[catId];
    data.settings.budgets = budgets;
    save();
  }

  /* 当前周期的 key */
  function budgetKey(period, base) {
    const d = base || new Date();
    if (period === 'month') return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    if (period === 'year') return String(d.getFullYear());
    /* week */
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const firstMon = new Date(d.getFullYear(), 0, 1 + ((1 - jan1.getDay() + 7) % 7));
    const days = Math.floor((d - firstMon) / 86400000);
    const wn = Math.floor(days / 7) + 1;
    return d.getFullYear() + '-W' + wn;
  }

  /* ---------- 借贷账户 ---------- */
  const getLoanAccounts = () => data.loanAccounts.slice().sort((a, b) => (a.name < b.name ? -1 : 1));
  const getLoanAccount = id => data.loanAccounts.find(a => a.id === id);
  function addLoanAccount(a) { a.id = uid(); data.loanAccounts.push(a); save(); return a; }
  function updateLoanAccount(id, patch) { Object.assign(getLoanAccount(id), patch); save(); }
  function removeLoanAccount(id) {
    data.loanAccounts = data.loanAccounts.filter(a => a.id !== id);
    save();
  }
  const loanAccountTxCount = id => data.loans.filter(l => l.loanAccountId === id).length;

  /* ---------- 借贷记录 ---------- */
  const getLoans = (status = 'all', loanAccountId) => {
    let list = data.loans.slice();
    if (loanAccountId) list = list.filter(l => l.loanAccountId === loanAccountId);
    if (status === 'open') list = list.filter(l => l.status === 'open');
    else if (status === 'settled') list = list.filter(l => l.status === 'settled');
    list.sort((a, b) => (a.status === b.status ? (a.date < b.date ? 1 : -1) : (a.status === 'open' ? -1 : 1)));
    return list;
  };
  const getLoan = id => data.loans.find(l => l.id === id);
  function addLoan(l) { l.id = uid(); l.status = l.status || 'open'; data.loans.push(l); save(); return l; }
  function updateLoan(id, patch) { Object.assign(getLoan(id), patch); save(); }
  function removeLoan(id) { data.loans = data.loans.filter(l => l.id !== id); save(); }
  function settleLoan(id, patch) {
    const l = getLoan(id);
    if (!l) return;
    Object.assign(l, patch, { status: 'settled', settledDate: patch.settledDate || todayStr() });
    save();
    return l;
  }
  function loanSums(loanAccountId) {
    let lend = 0, borrow = 0;
    data.loans.forEach(l => {
      if (l.status !== 'open') return;
      if (loanAccountId && l.loanAccountId !== loanAccountId) return;
      if (l.type === 'lend') lend += l.amount;
      else borrow += l.amount;
    });
    return { lend: r2(lend), borrow: r2(borrow), net: r2(lend - borrow) };
  }

  /* ---------- 周期账单 ---------- */
  const getRecurrings = () => data.recurrings.slice().sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
  const getRecurring = id => data.recurrings.find(r => r.id === id);
  function addRecurring(r) {
    r.id = uid();
    r.enabled = r.enabled !== false;
    r.nextDate = r.nextDate || r.startDate;
    data.recurrings.push(r);
    save();
    return r;
  }
  function updateRecurring(id, patch) { Object.assign(getRecurring(id), patch); save(); }
  function removeRecurring(id) { data.recurrings = data.recurrings.filter(r => r.id !== id); save(); }

  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function nextOccurrence(r, afterStr) {
    const d = new Date(afterStr + 'T00:00:00');
    if (isNaN(d.getTime())) return afterStr;
    if (r.frequency === 'daily') d.setDate(d.getDate() + 1);
    else if (r.frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (r.frequency === 'monthly') {
      const day = d.getDate();
      d.setMonth(d.getMonth() + 1);
      if (d.getDate() !== day) d.setDate(0); // 月末自动收敛（如 1/31 → 2/28）
    }
    else if (r.frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return ymd(d);
  }

  const dueRecurrings = (today) => data.recurrings.filter(r => r.enabled && r.nextDate <= today);

  function advanceRecurring(id) {
    const r = getRecurring(id);
    if (!r) return;
    r.nextDate = nextOccurrence(r, r.nextDate);
    if (r.endDate && r.nextDate > r.endDate) r.enabled = false;
    save();
    return r;
  }

  function recordRecurring(id) {
    const r = getRecurring(id);
    if (!r) return null;
    const tx = addTransaction({
      type: r.type, amount: r.amount, categoryId: r.categoryId, accountId: r.accountId,
      date: r.nextDate, time: nowTime(), merchant: r.name,
      note: (r.note ? r.note + ' · ' : '') + '周期账单'
    });
    advanceRecurring(id);
    return tx;
  }

  /* ---------- 导出 ---------- */
  function exportCSV() {
    const head = ['日期', '时间', '类型', '分类', '账户', '转入账户', '金额', '备注', '商家'];
    const rows = data.transactions.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map(t => {
      const cat = getCategory(t.categoryId);
      const acc = getAccount(t.accountId);
      const toAcc = getAccount(t.toAccountId);
      return [
        t.date, t.time || '',
        t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账',
        cat ? cat.name : '', acc ? acc.name : '', toAcc ? toAcc.name : '',
        t.amount, t.note || '', t.merchant || ''
      ];
    });
    return '\ufeff' + [head, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  }

  return {
    load, save, reset, uid, defaults, todayStr, nowTime,
    getCategories, getRootCategories, getRootCategoriesByUsage, getSubCategories, getSubCategoriesByUsage, getCategory, addCategory, updateCategory, removeCategory, categoryLabel,
    getRootCategoriesSorted, getSubCategoriesSorted, getAccountsSorted, sortCfg,
    getAccounts, getAccount, addAccount, updateAccount, removeAccount,
    accountTxCount, accountBalance, totalAssets,
    addTransaction, getTransaction, updateTransaction, removeTransaction, getTransactions,
    monthStats, categoryStats, categoryStatsRange, dailyStats, monthlyTrend, budgetStatus,
    saveBudgetTotal, saveCategoryBudget, budgetKey,
    getLoanAccounts, getLoanAccount, addLoanAccount, updateLoanAccount, removeLoanAccount, loanAccountTxCount,
    getLoans, getLoan, addLoan, updateLoan, removeLoan, settleLoan, loanSums,
    getRecurrings, getRecurring, addRecurring, updateRecurring, removeRecurring,
    dueRecurrings, nextOccurrence, advanceRecurring, recordRecurring,
    exportCSV,
    get data() { return data; },
    get persistOk() { return persistOk; }
  };
})();
