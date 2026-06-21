export type SelectMode = 'single' | 'multi';

export type QuickOption = { id: string; zh: string; en: string };

export type QuickCategory = {
  id: string;
  zh: string;
  en: string;
  mode: SelectMode;
  options: QuickOption[];
};

export const tryOnQuickCategories: QuickCategory[] = [
  {
    id: 'nail_shape',
    zh: '甲型',
    en: 'Shape',
    mode: 'single',
    options: [
      { id: 'round',    zh: '圆形',   en: 'Round'    },
      { id: 'oval',     zh: '椭圆形', en: 'Oval'     },
      { id: 'squoval',  zh: '方圆形', en: 'Squoval'  },
      { id: 'square',   zh: '方形',   en: 'Square'   },
      { id: 'almond',   zh: '杏仁形', en: 'Almond'   },
      { id: 'stiletto', zh: '尖形',   en: 'Stiletto' },
      { id: 'coffin',   zh: '棺材形', en: 'Coffin'   },
    ],
  },
  {
    id: 'nail_length',
    zh: '甲长',
    en: 'Length',
    mode: 'single',
    options: [
      { id: 'short',      zh: '短甲',   en: 'Short'      },
      { id: 'medium',     zh: '中长甲', en: 'Medium'     },
      { id: 'long',       zh: '长甲',   en: 'Long'       },
      { id: 'extra_long', zh: '超长甲', en: 'Extra long' },
    ],
  },
  {
    id: 'color',
    zh: '颜色',
    en: 'Color',
    mode: 'multi',
    options: [
      { id: 'nude',       zh: '裸色', en: 'Nude'       },
      { id: 'pink',       zh: '粉色', en: 'Pink'       },
      { id: 'white',      zh: '白色', en: 'White'      },
      { id: 'black',      zh: '黑色', en: 'Black'      },
      { id: 'red',        zh: '红色', en: 'Red'        },
      { id: 'blue',       zh: '蓝色', en: 'Blue'       },
      { id: 'green',      zh: '绿色', en: 'Green'      },
      { id: 'yellow',     zh: '黄色', en: 'Yellow'     },
      { id: 'purple',     zh: '紫色', en: 'Purple'     },
      { id: 'gold',       zh: '金色', en: 'Gold'       },
      { id: 'silver',     zh: '银色', en: 'Silver'     },
      { id: 'multicolor', zh: '多色', en: 'Multicolor' },
    ],
  },
  {
    id: 'color_effect',
    zh: '色彩',
    en: 'Effect',
    mode: 'multi',
    options: [
      { id: 'solid',    zh: '纯色',   en: 'Solid'    },
      { id: 'gradient', zh: '渐变',   en: 'Gradient' },
      { id: 'cat_eye',  zh: '猫眼',   en: 'Cat-eye'  },
      { id: 'aura',     zh: '腮红甲', en: 'Aura'     },
      { id: 'glitter',  zh: '亮片',   en: 'Glitter'  },
      { id: 'matte',    zh: '哑光',   en: 'Matte'    },
      { id: 'chrome',   zh: '魔镜粉', en: 'Chrome'   },
      { id: 'aurora',   zh: '极光粉', en: 'Aurora'   },
      { id: 'jelly',    zh: '透色',   en: 'Jelly'    },
    ],
  },
  {
    id: 'nail_art',
    zh: '款式',
    en: 'Design',
    mode: 'multi',
    options: [
      { id: 'french_basic',   zh: '普通法式', en: 'French tip'    },
      { id: 'french_special', zh: '异形法式', en: 'Shaped French' },
      { id: 'hand_paint',     zh: '手绘',     en: 'Hand paint'    },
      { id: 'line_art',       zh: '线条设计', en: 'Line art'      },
      { id: 'pattern_art',    zh: '图案设计', en: 'Pattern art'   },
      { id: '3d_art',         zh: '立体浮雕', en: '3D embossed'   },
    ],
  },
];

/** Build a natural-language prompt string from the quick-select state. */
export function buildCustomPrompt(
  selections: Record<string, string[]>,
  language: 'zh-CN' | 'en',
): string {
  const parts: string[] = [];

  for (const cat of tryOnQuickCategories) {
    const ids = selections[cat.id];
    if (!ids || ids.length === 0) continue;

    const optionNames = ids
      .map((id) => {
        const opt = cat.options.find((o) => o.id === id);
        return opt ? (language === 'zh-CN' ? opt.zh : opt.en) : id;
      })
      .filter(Boolean);

    if (optionNames.length === 0) continue;

    const catLabel = language === 'zh-CN' ? cat.zh : cat.en;
    const sep = language === 'zh-CN' ? '、' : ', ';
    const colon = language === 'zh-CN' ? '：' : ': ';
    parts.push(`${catLabel}${colon}${optionNames.join(sep)}`);
  }

  const joiner = language === 'zh-CN' ? '，' : ', ';
  return parts.join(joiner);
}
