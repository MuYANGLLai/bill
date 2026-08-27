/* 预置数据：账户类型、默认分类（含二级）、线条图标库、颜色 */
window.Preset = {
  accountTypes: {
    cash:       { name: '现金',     svg: '<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/>' },
    debit:      { name: '储蓄卡',   svg: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M15 15h3"/>' },
    credit:     { name: '信用卡',   svg: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M6 14h6"/>' },
    ewallet:    { name: '电子钱包', svg: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M15 15h3"/>' },
    investment: { name: '投资理财', svg: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M22 20H2"/>' },
    other:      { name: '其他',     svg: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10.5" r="1"/><circle cx="12" cy="10.5" r="1"/><circle cx="15.5" cy="10.5" r="1"/>' }
  },

  /* 常用支付方式图标（品牌风格：色块 + 图形/文字） */
  payIcons: [
    { v: 'cash',     n: '现金',       bg: '#DAA520', t: '<svg viewBox="0 0 24 24" width="15" height="15"><circle cx="12" cy="12" r="10" fill="#FFD700" stroke="#B8860B"/><text x="12" y="16.2" text-anchor="middle" font-size="13" font-weight="bold" fill="#B8860B">¥</text></svg>' },
    { v: 'wxpay',    n: '微信',       bg: '#07C160', t: '微' },
    { v: 'alipay',   n: '支付宝',     bg: '#1677FF', t: '支' },
    { v: 'boc',      n: '中国银行',   bg: '#B22222', t: '中' },
    { v: 'icbc',     n: '工商银行',   bg: '#C7000B', t: '工' },
    { v: 'ccb',      n: '建设银行',   bg: '#0057B8', t: '建' },
    { v: 'abc',      n: '农业银行',   bg: '#009B77', t: '农' },
    { v: 'cmb',      n: '招商银行',   bg: '#C7000B', t: '招' },
    { v: 'bcm',      n: '交通银行',   bg: '#0057B8', t: '交' },
    { v: 'psbc',     n: '邮储银行',   bg: '#009E60', t: '邮' },
    { v: 'debit',    n: '银行卡',     bg: '#607D8B', t: '卡' },
    { v: 'credit',   n: '信用卡',     bg: '#9C27B0', t: '信' },
    { v: 'jdpay',    n: '京东',       bg: '#E1251B', t: '京' },
    { v: 'meituan',  n: '美团',       bg: '#FFC300', t: '美' },
    { v: 'unionpay', n: '云闪付',     bg: '#0072CE', t: '闪' },
    { v: 'dcp',      n: '数字人民币', bg: '#E60012', t: '¥' },
    { v: 'visa',     n: 'Visa',       bg: '#1A1F71', t: 'VISA' },
    { v: 'master',   n: '万事达',     bg: '#EB001B', t: 'MC' },
    { v: 'paypal',   n: 'PayPal',     bg: '#003087', t: 'P' },
    { v: 'applepay', n: 'Apple Pay',  bg: '#1c1e26', t: '🅰' }
  ],

  /* 线条简约风图标库：key → SVG 路径（24x24，stroke=currentColor） */
  lineIcons: {    bag:        '<path d="M6 8h12l-1.2 12H7.2L6 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
    bowl:       '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M12 4v3"/><path d="M8 5v1"/><path d="M16 5v1"/>',
    car:        '<path d="M3 16l2-5 1-3h12l1 3 2 5"/><path d="M3 16h18v3H3z"/><circle cx="7" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/>',
    home:       '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
    book:       '<path d="M5 4h14v16H5z"/><path d="M9 4v16"/>',
    gift:       '<path d="M4 12h16v8H4z"/><path d="M4 9h16v3H4z"/><path d="M12 9v11"/><path d="M12 9S8 9 7 6.5 10 3.5 12 9z"/><path d="M12 9s4 0 5-2.5S14 3.5 12 9z"/>',
    plus:       '<path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/><path d="M12 9v5"/><path d="M9.5 11.5h5"/>',
    sofa:       '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 14a2 2 0 0 1 4 0h10a2 2 0 0 1 4 0v4H3z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
    drop:       '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    phone:      '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    bolt:       '<path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z"/>',
    plug:       '<path d="M9 3v5"/><path d="M15 3v5"/><path d="M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v5"/>',
    watch:      '<circle cx="12" cy="12" r="5"/><path d="M12 9v3l2 2"/><path d="M9 4l1-2h4l1 2"/><path d="M9 20l1 2h4l1-2"/>',
    shirt:      '<path d="M9 4L5 7l3 5 1-1v9h6v-9l1 1 3-5-4-3a3 3 0 0 1-6 0z"/>',
    pen:        '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><path d="M13 8l3 3"/>',
    hammer:     '<path d="M15 3l6 6-3 3-6-6 3-3z"/><path d="M11 7l-7 7 3 3 7-7"/><path d="M3 18l3 3"/>',
    leaf:       '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19c3-6 8-10 12-12"/>',
    apple:      '<path d="M16 7c-1-2-4-2-4 0 0-2-3-2-4 0-1 1-1 6 4 11 5-5 5-10 4-11z"/><path d="M12 7c.5-1.5 2-2.5 3.5-2.5"/>',
    moon:       '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
    mug:        '<path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/>',
    rice:       '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M10 4l-2 3"/><path d="M14 4l2 3"/>',
    utensils:   '<path d="M7 3v7"/><path d="M7 10v11"/><path d="M7 3C5.5 3 5 5 5 6.5S6 9 7 9"/><path d="M17 3v18"/><path d="M17 3c2 0 3 2 3 4s-1 3-3 3"/>',
    drink:      '<path d="M7 4h10l-1 16H8L7 4z"/><path d="M7 8h10"/>',
    cookie:     '<circle cx="12" cy="12" r="8"/><path d="M8.5 9.5h.01"/><path d="M15 8.5h.01"/><path d="M9 15.5h.01"/><path d="M15 15.5h.01"/><path d="M12 12h.01"/>',
    fish:       '<path d="M3 12c0-3 4-6 13-5l2 5-2 5c-9 1-13-2-13-5z"/><path d="M16 7l4-4"/><path d="M7.5 12h.01"/>',
    clink:      '<path d="M9 3v8l-4 7a2 2 0 0 0 2 3h2a2 2 0 0 0 2-3l-4-7V3"/><path d="M9 3h2"/><path d="M15 3v8l-4 7a2 2 0 0 0 2 3h2a2 2 0 0 0 2-3l-4-7V3"/><path d="M15 3h-2"/>',
    bus:        '<path d="M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11"/><path d="M5 12h14"/><path d="M5 17h14v3H5z"/><circle cx="8" cy="20" r="1.1"/><circle cx="16" cy="20" r="1.1"/>',
    parking:    '<circle cx="12" cy="12" r="9"/><path d="M9 16V8h4a3 3 0 0 1 0 6H9"/>',
    fuel:       '<path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M4 15h10v6"/><path d="M14 9h3l3 3v4a1.5 1.5 0 0 1-3 0"/>',
    train:      '<path d="M4 5a8 8 0 0 1 16 0v9H4z"/><path d="M4 11h16"/><path d="M8 17l-2 4"/><path d="M16 17l2 4"/>',
    plane:      '<path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>',
    wifi:       '<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5.5 12.5a10 10 0 0 1 13 0"/><path d="M9 16a5 5 0 0 1 6 0"/><path d="M12 20h.01"/>',
    flame:      '<path d="M12 3c1 3 5 5 5 9a5 5 0 0 1-10 0c0-3 3-6 5-9z"/><path d="M12 14a2.5 2.5 0 0 0-2.5 2.5c0 1 1 2 2.5 2.5 1.5-.5 2.5-1.5 2.5-2.5A2.5 2.5 0 0 0 12 14z"/>',
    building:   '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h3a1 1 0 0 1 1 1v11"/><path d="M4 21h17"/><path d="M8 7h2"/><path d="M8 11h2"/><path d="M8 15h2"/>',
    key:        '<circle cx="8" cy="15" r="4.5"/><path d="M11 12l9-9"/><path d="M16 7l3 3"/>',
    broom:      '<path d="M14 4l6 6"/><path d="M11 7l-8 8 3 3 8-8"/><path d="M4 18l-1 3 3-1"/>',
    grad:       '<path d="M22 9L12 5 2 9l10 4 10-4z"/><path d="M6 11.5V16c0 2 2.5 3.5 6 3.5s6-1.5 6-3.5v-4.5"/>',
    news:       '<path d="M4 5h16v14H4z"/><path d="M4 9h16"/><path d="M8 13h5"/>',
    clipboard:  '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4a3 3 0 0 1 6 0"/><path d="M9 12l2 2 4-4"/>',
    heart:      '<path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>',
    envelope:   '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 8l9 6 9-6"/>',
    star:       '<path d="M12 3l2.5 5.5 6 .5-4.5 4 1.5 6-5.5-3-5.5 3 1.5-6-4.5-4 6-.5L12 3z"/>',
    tea:        '<path d="M5 11h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 12h2a2 2 0 0 1 0 4h-2"/><path d="M9 4l1 2"/><path d="M13 4l1 2"/>',
    hospital:   '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M12 8v6"/><path d="M9 11h6"/>',
    pill:       '<circle cx="7" cy="17" r="3.5"/><circle cx="17" cy="7" r="3.5"/><path d="M9 19l10-10"/>',
    person:     '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',
    clover:     '<path d="M12 3v9"/><path d="M12 12c0 2-2 4-4 4s-4-2-4-4 2-4 4-4 4 2 4 4z"/><path d="M12 12c0 2 2 4 4 4s4-2 4-4-2-4-4-4-4 2-4 4z"/><path d="M12 12v8"/>',
    trend:      '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    laptop:     '<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 20h20"/>',
    recycle:    '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v4h-4"/>',
    box:        '<path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4"/><path d="M12 12v9"/>',
    fun:        '<rect x="2.5" y="7" width="19" height="10" rx="3.5"/><path d="M7.5 10v4"/><path d="M5.5 12h4"/><path d="M16 10.5h.01"/><path d="M18.5 13h.01"/>',
    hongbao:    '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M5 9.5c2.3-2.2 11.7-2.2 14 0"/><circle cx="12" cy="14.5" r="2.6"/>',
    refund:     '<polyline points="2 5 2 11 8 11"/><path d="M4.51 15a9 9 0 1 0 2.13-9.36L2 11"/><path d="M14 8.5l1.5 1.5 1.5-1.5"/><path d="M15.5 10v6"/><path d="M13.5 13.5h4"/>'
  },

  /* 功能 UI 线条图标库 */
  uiIcons: {
    home:     '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
    wallet:   '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M15 15h3"/>',
    chart:    '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M22 20H2"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>',
    gear:     '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    time:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    tag:      '<path d="M3 3h7l11 11-7 7L3 10V3z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    clip:     '<path d="M10 13V6a3 3 0 0 1 6 0v9a4 4 0 0 1-8 0V9"/>',
    mic:      '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
    camera:   '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13.5" r="3.5"/>',
    list:     '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    pencil:   '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><path d="M13 8l3 3"/>',
    category: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    data:     '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
    palette:  '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01"/><path d="M12 8h.01"/><path d="M16 10h.01"/><path d="M12 21c-1.5-1-2.5-2.5-2.5-4.5S10.5 13 12 13s2.5 1.5 2.5 3.5S13.5 20 12 21z"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    loan:     '<path d="M7 4l-3 3 3 3"/><path d="M4 7h9"/><path d="M17 20l3-3-3-3"/><path d="M20 17h-9"/>'
  },

  /* 支出：一级分类（icon 为线条图标 key，马卡龙配色） */
  expenseCategories: [
    { name: '购物消费', icon: 'bag', color: '#FFB3BA' },
    { name: '食品餐饮', icon: 'bowl', color: '#FFDFBA' },
    { name: '出行交通', icon: 'car', color: '#BAE1FF' },
    { name: '居家生活', icon: 'home', color: '#FFF3B0' },
    { name: '文化教育', icon: 'book', color: '#D8BFD8' },
    { name: '送礼人情', icon: 'gift', color: '#CDB4DB' },
    { name: '医疗健康', icon: 'plus', color: '#FFDAC1' }
  ],
  /* 支出：二级分类（parent 为一级分类名，颜色继承一级） */
  expenseSubs: [
    { parent: '购物消费', items: [
      { name: '日常家居', icon: 'home' }, { name: '个护美妆', icon: 'drop' },
      { name: '手机数码', icon: 'phone' }, { name: '虚拟充值', icon: 'bolt' },
      { name: '生活电器', icon: 'plug' }, { name: '配饰腕表', icon: 'watch' },
      { name: '服饰运动', icon: 'shirt' }, { name: '办公用品', icon: 'pen' },
      { name: '装修装饰', icon: 'hammer' }, { name: '家具', icon: 'sofa' }
    ] },
    { parent: '食品餐饮', items: [
      { name: '买菜', icon: 'leaf' }, { name: '水果', icon: 'apple' },
      { name: '夜宵', icon: 'moon' }, { name: '早餐', icon: 'mug' },
      { name: '午餐', icon: 'rice' }, { name: '晚餐', icon: 'utensils' },
      { name: '饮料酒水', icon: 'drink' }, { name: '休闲零食', icon: 'cookie' },
      { name: '生鲜食品', icon: 'fish' }, { name: '请客吃饭', icon: 'clink' }
    ] },
    { parent: '出行交通', items: [
      { name: '打车', icon: 'car' }, { name: '公共交通', icon: 'bus' },
      { name: '停车费', icon: 'parking' }, { name: '加油', icon: 'fuel' },
      { name: '火车', icon: 'train' }, { name: '飞机', icon: 'plane' }
    ] },
    { parent: '居家生活', items: [
      { name: '花费宽带', icon: 'wifi' }, { name: '电费', icon: 'bolt' },
      { name: '水费', icon: 'drop' }, { name: '燃气费', icon: 'flame' },
      { name: '物业费', icon: 'building' }, { name: '房租', icon: 'key' },
      { name: '车位费', icon: 'parking' }, { name: '家政', icon: 'broom' }
    ] },
    { parent: '文化教育', items: [
      { name: '学费', icon: 'grad' }, { name: '书报杂志', icon: 'news' },
      { name: '培训考试', icon: 'clipboard' }
    ] },
    { parent: '送礼人情', items: [
      { name: '孝敬长辈', icon: 'heart' }, { name: '礼物', icon: 'gift' },
      { name: '红包', icon: 'envelope' }, { name: '打赏', icon: 'star' }
    ] },
    { parent: '医疗健康', items: [
      { name: '滋补保健', icon: 'tea' }, { name: '医院', icon: 'hospital' },
      { name: '买药', icon: 'pill' }
    ] }
  ],

  /* 收入：一级分类（人名分类统一用 person 线条图标，马卡龙配色） */
  incomeCategories: [
    { name: '妈妈',     icon: 'person', color: '#FFB3BA' },
    { name: '慧慧',     icon: 'person', color: '#FFDAC1' },
    { name: '亮君',     icon: 'person', color: '#BAE1FF' },
    { name: '双双',     icon: 'person', color: '#D8BFD8' },
    { name: '林昌新',   icon: 'person', color: '#CDB4DB' },
    { name: '利远瑞',   icon: 'person', color: '#B5EAD7' },
    { name: '苏靖淇',   icon: 'person', color: '#FFF3B0' },
    { name: '中奖',     icon: 'clover', color: '#FFDFBA' },
    { name: '理财盈利', icon: 'trend', color: '#B5EAD7' },
    { name: '兼职外快', icon: 'laptop', color: '#FFDFBA' },
    { name: '二手闲置', icon: 'recycle', color: '#CDB4DB' }
  ],

  emojis: ['🍜','🍔','☕','🍺','🍎','🎂','🚗','🚌','🚕','🛍️','🏠','🔑','⚡','💡','🎮','🎬','🎵','⚽','💊','🏥','📚','🎓','✈️','🏝️','🎁','🧧','💄','👗','👟','💻','📱','🖥️','📷','🐱','🐶','💼','🏆','📈','💰','📄','🔧','🧻','🌂','🔥','⭐','❤️','🧸','📦','🧺','💎','⌚','✏️','🛠️','🛋️','🥬','🍢','🥛','🍱','🍲','🥤','🍿','🥩','🍻','🅿️','⛽','🚄','🏡','📶','💧','🏢','🧹','📰','📝','👴','🎀','👍','🍵','💉','👩','👨','👭','🍀','♻️'],
  colors: ['#ff6b6b','#ffa94d','#ffd43b','#51cf66','#38d9a9','#4dabf7','#74c0fc','#9775fa','#e599f7','#f783ac','#868e96','#343a40'],
  /* 马卡龙配色（账户/分类通用，柔和低饱和，20 色可选） */
  macaron: [
    '#FFB3BA', '#FFDFBA', '#FFF3B0', '#B5EAD7', '#BAE1FF',
    '#D8BFD8', '#FFDAC1', '#CDB4DB',
    '#F4A7B9', '#FFC9A8', '#F7E8A4', '#A8E6CF', '#A7C7E7',
    '#E0BBE4', '#FBC8D5', '#B8E0D2', '#FADADD', '#D4F0F0',
    '#FDE2E4', '#C9E4DE'
  ],
  /* 可更换字体（设置 → 外观） */
  fonts: [
    { v: 'default', n: '默认', f: '' },
    { v: 'rounded', n: '圆润', f: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' },
    { v: 'serif',  n: '宋体', f: '"Songti SC", "STSong", SimSun, serif' },
    { v: 'hei',    n: '黑体', f: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimHei", sans-serif' },
    { v: 'kai',    n: '楷体', f: '"Kaiti SC", "STKaiti", KaiTi, serif' }
  ],
  defaultAccounts: [
    { name: '现金',     type: 'cash',       icon: '💵', color: '#FFB3BA', initialBalance: 1000 },
    { name: '支付宝',   type: 'ewallet',    icon: '💙', color: '#B5EAD7', initialBalance: 5000 },
    { name: '微信支付', type: 'ewallet',    icon: '💬', color: '#BAE1FF', initialBalance: 3000 },
    { name: '储蓄卡',   type: 'debit',      icon: '💳', color: '#FFDFBA', initialBalance: 20000 }
  ]
};
