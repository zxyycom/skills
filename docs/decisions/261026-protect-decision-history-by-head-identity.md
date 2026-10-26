---
title: 按固定 HEAD 身份保护决策演进历史
id: 261026-protect-decision-history-by-head-identity
status: active
alignment: aligned
createdAt: 2026-10-26T08:33:43Z
purpose: 防止未入版本基线的已建立判断被无意遗失，并保持关系语义由调用者决定。
background: Markdown拥有生命周期；同路径存在不能证明稳定身份已进入HEAD，全集blob兜底又扩大读取和掩盖坏索引。
decision: 历史门禁用固定HEAD合法索引定位必要身份；未记录前序零写暂停，显式确认保留后才继续，完整关系不自动合成。
tags:
  - decision-records
  - git-integration
  - version-control
relations:
  - type: 修订
    target: guard-unrecorded-decision-history-during-evolution
    summary: 保留未记录历史保护，改用HEAD身份及当前前序范围
---

## 目的

- 在Git历史与领域生命周期之间保持清楚边界，保护值得独立回放的采用历史。

## 背景

- 首次 publish 即建立，Git 不决定采用或生效。
- 稳定 ID 与 sourcePath 分离后，历史保护需要核对身份，而非只核对同相对路径是否存在。通用局部事实方向与本领域历史保护分别承担责任。

## 决策

### 门禁对象与固定历史身份

- 采用: 以下对象未进入固定 HEAD 时先零写暂停；在精确授权内复核独立回放价值后，才能显式重试 `--keep-unrecorded-history`：
  - 单独 `archive` 的所选目标。
  - `publish`、`evolve` 等关系事务所选后继完整最终关系中的任一已建立前序，无论 active 或 archived。
- 采用: HEAD 历史身份由合法 HEAD 索引定位，仅读取本次门禁所需对象；所选候选不在正式索引时可核对已知来源位置。
  - 有历史来源却无合法索引时明确恢复。
  - 不按同路径存在判断身份，也不全集读 Git blob 兜底为未记录或为省略保护而扫描无关历史正文。

### 历史读取、确认与授权

- 采用: 本次仍需读取历史基线时，非 Git 工作区不设此门禁，unborn HEAD 为空基线。
  - 仓库发现或必要 Git/HEAD 读取失败时停止且零写，不能把失败当非 Git 或未记录。
  - 已显式确认保留未记录历史且没有待确认删除等独立历史义务时，可免读该历史基线；确认参数不代替授权。
- 采用: 已记录对象仍须语义审查；删除、更名使用各自专用历史确认，不用保留历史参数替代。

### 关系与事务责任

- 采用: 完整最终关系由调用者显式提供，CLI 不自动继承、组合、迁移或推断关系；最终活动前序按正常演进归档。
- 采用: 事务依当前提交、验收与恢复契约保护 Markdown 和索引组合，不把“尽力恢复”当作提交后自动回滚承诺。
