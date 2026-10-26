---
title: 在完整决策入口恢复上下文与专用快照能力
id: 261026-discover-decision-work-at-complete-entry-points
status: active
alignment: aligned
createdAt: 2026-10-26T08:29:46Z
purpose: 让真正的长期判断、上下文恢复及专用快照任务发现决策能力，同时避免普通执行误触发。
background: 发现入口先于正文加载；长期取舍和stage曾分次采用，恢复与写入授权需要分别表达。
decision: 长期取舍、恢复审阅、冲突及显式待提交快照进入决策管理；先恢复上下文，写入和提交另按授权。
tags:
  - decision-records
  - skill-invocation
relations:
  - type: 归并
    target: 260718-trigger-on-long-term-decision-points
    summary: 保留长期取舍与冲突恢复，补足完整入口边界
  - type: 归并
    target: make-independent-decision-staging-discoverable
    summary: 保留独立stage发现并收束为完整触发判断
---

## 目的

- 维护可发现、可恢复且不过宽的长期决策入口。

## 背景

- description是主要路由，正文在触发后才加载；仅在正文描述专用能力不足以保证发现。
- 仅凭任务可能改变长期行为触发会将普通执行纳入；只等待显式记录请求又会错过实际取舍。
- 独立stage晚于原触发基线采用；普通路径暂存不能代替所选决策与完整索引快照。

## 决策

### 发现入口与上下文恢复

- 采用: 入口先声明长期决策管理；正在作出可能持续影响后续行为、owner、边界、兼容性、风险处理或验收的决定时进入，不以普通任务潜在影响替代实际长期取舍。
- 采用: 恢复或审阅已有长期判断、拟议决定与已有决定冲突、明确构造决策待提交快照时也进入；直接维护操作仍由能力领域覆盖，不枚举全部 CLI 细节。
- 采用: 进入后先恢复直接相关的当前决策及必要完整正文，结合当前事实区分遵守基线、未来方向、一次性例外、长期修订与一致性问题。

### 建立授权与专用快照

- 采用: 主动恢复或只读审阅不等于自动写入；只有值得长期回放且在授权范围内确认的判断才建立，候选、生命周期、alignment 各按领域规则维护。
- 采用: 专用 `stage` 只构造所选 pending 快照；加载后沿任务路由读取所需契约。
  - 与提交整理的交接不扩大选择、commit 或 push 授权。
  - 专用入口不可用时按恢复 owner 处理，不以普通路径暂存冒充完整领域结果。
