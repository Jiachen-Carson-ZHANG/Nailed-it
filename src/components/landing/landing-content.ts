import { getMockSession } from '@/domain/session';

export const landingRoutes = {
  customer: getMockSession('customer').homePath,
  merchant: getMockSession('merchant').homePath
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

export const journeyRows = [
  {
    key: 'merchant',
    title: '商家旅程',
    theme: 'cool',
    items: [
      {
        title: '设置价格',
        description:
          '不同甲型、延长、建构、手绘、贴钻、猫眼、渐变等项目，都可以配置对应价格和制作时长，保存后用于 AI 报价。'
      },
      {
        title: '管理日历',
        description:
          '商家可以查看每个预约对应的用户、款式、时间和美甲师，减少排班冲突和等待。'
      },
      {
        title: '联系客户',
        description:
          '商家可以查看预约详情以沟通具体细节或者调整报价，系统也可以在预约时间之前自动提醒用户准时到达。'
      },
      {
        title: '建立图册',
        description:
          '订单完成后，系统提示商家上传完成图，AI 自动识别款式特征、分类打标后沉淀为图册，方便后续展示、复用，并在用户主页展示。'
      }
    ]
  },
  {
    key: 'user',
    title: '用户旅程',
    theme: 'warm',
    items: [
      {
        title: '选择款式',
        description:
          '用户可以在主页浏览热门美甲款式，看到喜欢的款式，可以直接加入款式购物车，也可以上传自己喜欢的款式。'
      },
      {
        title: '一键试戴',
        description:
          '款式详情页点击试戴功能，可以快速查看款式上手效果，直观看到哪一款更适合自己的手型和风格。'
      },
      {
        title: '智能报价',
        description:
          'AI 会自动拆解美甲图片，识别甲型、长度、款式等元素，根据商家的设置，智能生成预估价格和制作时间。'
      },
      {
        title: '立即预约',
        description:
          '用户确认款式后，可以直接查看可预约时段，快速完成下单，减少反复沟通和等待。'
      }
    ]
  }
] as const;

export const whyItWorksLines = [
  '试戴选款， 帮助决策',
  'AI识图， 拆解款式',
  '快速报价预约， 促成交易',
  '款式沉淀， 再次转化'
] as const;
