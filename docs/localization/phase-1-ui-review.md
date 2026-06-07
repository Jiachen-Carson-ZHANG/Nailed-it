# Phase 1 UI Review

First-wave scope for manual audit: `booking`, `style`, `manage`, and profile language switching. Reviewers should focus on whether the English copy matches the current customer and merchant flow tone, not on final marketing polish.

## Booking Flow

| Key | Screen | zh-CN | en | Review Focus |
| --- | --- | --- | --- | --- |
| booking.upload.title | Booking upload | 上传你的美甲参考图 | Upload your nail reference | Keep action clear and friendly for first-time users. |
| booking.upload.helper | Booking upload | 拍正面近照或上传参考款式，AI 会先帮你识别。 | Take a clear close-up or upload an inspiration photo so AI can identify the style first. | Check if "identify" feels natural for beauty-service context. |
| booking.result.title | Booking result | 款式识别结果 | Style detected | Confirm whether this should sound descriptive or decisional. |
| booking.result.cta | Booking result | 查看报价并预约 | View quote and book | Verify the order matches the actual next action. |
| booking.confirm.summary | Booking confirm | 预约前确认本次款式与时间 | Confirm the style and timing before booking | Keep concise on small screens. |

## Style Discovery

| Key | Screen | zh-CN | en | Review Focus |
| --- | --- | --- | --- | --- |
| style.list.trending | Style list | 热门推荐 | Trending styles | Check whether "styles" is the right noun for customers. |
| style.detail.breakdown | Style detail | 款式构成 | Style breakdown | Make sure it does not sound too technical. |
| style.detail.duration | Style detail | 预计时长 | Estimated time | Confirm whether "time" or "duration" is preferred in product voice. |
| style.detail.book | Style detail | 按这个款式预约 | Book this style | Ensure CTA stays direct and conversion-friendly. |

## Merchant Manage

| Key | Screen | zh-CN | en | Review Focus |
| --- | --- | --- | --- | --- |
| manage.panel.basic | Manage pricing | 基础服务 | Basic services | Align with pricing terminology used elsewhere. |
| manage.panel.structure | Manage pricing | 建构与延长 | Builder and extension | Check whether "builder" needs a more customer-safe term for merchants. |
| manage.panel.color | Manage pricing | 颜色与效果 | Colors and effects | Keep category broad enough for add-ons like cat-eye and chrome. |
| manage.row.duration | Manage pricing | 耗时 | Duration | Confirm this reads naturally in an editable pricing row. |

## Profile Language

| Key | Screen | zh-CN | en | Review Focus |
| --- | --- | --- | --- | --- |
| profile.language.switch | Customer and merchant profile | 切换语言 | Switch language | Keep clear for bilingual users without sounding like a settings page label only. |
| profile.language.zh | Customer and merchant profile | 中文 | Chinese | Confirm whether locale label should stay language-only. |
| profile.language.en | Customer and merchant profile | 英文 | English | Confirm whether locale label should stay language-only. |
