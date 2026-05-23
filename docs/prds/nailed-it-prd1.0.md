# Nailed It — PRD v1.0

## One-Liner Summary

基于AI智能拆解美甲款式图片的，集合报价、预约、款式库的美甲商家智能运营系统
(AI-powered nail salon operations platform: smart quoting, booking, and style library built on image decomposition.)

---

## 核心用户 (Target Users)

B2B2C model — merchants register first, then allow their customers to book.

**Primary users**
1. 美甲商家 (Nail salon owners) — full management permissions
2. 美甲师 (Nail technicians employed by the merchant) — style library view + limited booking permissions

**Secondary users**
- 美甲用户 (End customers) — booking only

---

## 核心痛点 (Core Pain Points)

### 预约难 (Booking friction)
款式种类多、差异大，当前预约依赖人工客服的咨询、报价和时间管理，时间无法根据款式自定义，导致后续客户等待前序客户的情况。

- **For customers:** must wait for a manual quote before they can book.
- **For merchants:** extra labour cost for customer service; repeated queries from the same user.

### 款式变动快 (Fast-changing styles)
美甲款式迭代快，受时间/季节/潮流影响大。用户需手动搜索海量款式，且单款保留周期仅 0.5–1 个月，决策成本高。商家款式库通常靠相册人工维护，展示机会少，容易错过营销时机。

---

## 核心功能 (Core Features)

### 智能报价 (Smart Quoting)
AI identifies nail style images, captures hand/nail photos, generates a preview effect. Extracts attributes (nail shape / extension / hand-painted / style detail), then auto-quotes against the merchant's price table — eliminating manual quoting time and cost while accelerating customer decision-making.

> **积木模型 (Building-block model):** AI decomposes each style into a base layer + add-ons, enabling highly personalised, accurate time and price calculation.

### 智能预约 (Smart Booking)
用户选定款式后一键预约，系统根据款式制作时长自动锁定对应美甲师的时间段，实现 **用户 → 款式 → 预约 → 美甲师** 的全自动对应。

### 款式跟踪 (Style Tracking)
每完成订单自动提醒美甲师拍图上传；AI 自动识别并打标后入库，方便分类查询和展示。同时向商家和用户实时推送当下热门款式，辅助营销。

---

## 用户旅程 (User Journeys)

**商家 (Merchant)**
建立 block 拆分的价目表 → 查看日历 → 上传完成图

**用户 (Customer)**
选择或上传美甲图片 → AI 试戴效果图 → 询价 → 选择款式 & 预约 → 到店
