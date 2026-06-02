export const landingRoutes = {
  customer: '/customer/home',
  merchant: '/merchant/calendar'
} as const;

export const problemCards = [
  {
    key: 'pricing',
    title: '报价',
    bullets: [
      '美甲价格差异化大，不同的长度、手绘、贴钻都会影响最终报价。',
      '用户需要反复发图、询价、等待回复，商家需要投入大量人工时间处理重复咨询。',
      '沟通链路越长，用户决策越慢，成交效率也越低。'
    ]
  },
  {
    key: 'selection',
    title: '选款',
    bullets: [
      '美甲款式多、变化快，缺少试戴和结构化筛选，用户常常在“喜欢”和“适合”之间反复犹豫，决策成本高。',
      '对商家来说，做过的款式散落在相册里，难以分类、复用和追踪热门趋势。'
    ]
  },
  {
    key: 'booking',
    title: '预约',
    bullets: [
      '传统预约通常按固定时长安排，但不同款式的制作时间差异很大，导致后续客户到店后仍需等待。',
      '商家难以根据真实服务复杂度安排美甲师时间，最终影响排班效率和客户体验。'
    ]
  }
] as const;

export const featureTabs = [
  {
    key: 'recognition',
    tabLabel: 'AI 识图',
    title: 'AI 识图',
    subtitle: '智能报价， 一键预约',
    paragraphs: [
      '用户上传或选择一张美甲参考图，AI 自动识别甲型、长度、手绘、贴钻、猫眼、渐变等款式元素',
      '系统根据商家的价目表和服务时长规则，生成预估价格与制作时间，并直接匹配合适的预约时段'
    ]
  },
  {
    key: 'cart',
    tabLabel: '款式购物车',
    title: '款式购物车',
    subtitle: '试戴比较， 快速决策',
    paragraphs: [
      '用户可以把喜欢的款式加入款式车，直接上手试戴，看到差异化效果',
      '不同款式的效果、价格、制作时间可以放在一起看，帮助用户更快判断哪一款真正适合自己'
    ]
  },
  {
    key: 'gallery',
    tabLabel: '商家图册',
    title: '商家图册',
    subtitle: '自动归档， 持续种草',
    paragraphs: [
      '每完成一个订单，系统提醒美甲师上传完成图，并自动识别款式特征、分类打标，沉淀为商家的专属图册',
      '商家可以快速管理历史作品、展示热门款式造成持续转化，也可以追踪用户偏好和流行趋势'
    ]
  }
] as const;

export const whyItWorksLines = [
  '试戴选款， 帮助决策',
  'AI识图， 拆解款式',
  '快速报价预约， 促成交易',
  '款式沉淀， 再次转化'
] as const;
