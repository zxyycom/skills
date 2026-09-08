---
title: 要求已建立决策具有明确对齐状态
id: 260908-require-established-decision-alignment
status: active
alignment: aligned
createdAt: 2026-09-08T11:16:21Z
purpose: 让已建立决策的对齐状态成为可验证、可查询且可回放的明确事实。
background: active 当前判断与 archived 历史判断都需要保留完整对齐语义；允许已建立来源为空会使索引和恢复产生歧义。
decision: active 与 archived 必须保存 aligned 或 unaligned；candidate 保持 null 并留在正式索引外。
tags:
  - decision-records
  - index-runtime
relations: []
---

## 目的

- 让 active 记录明确表达当前事实基线或已确认未来方向，并让 archived 记录保留最后的对齐状态供历史回放。
- 让来源校验、索引投影、查询和恢复基于同一非空事实，而不以缺失字段或 `unknown` 表达语义。
- 保持候选的未建立状态可独立识别，不把尚未审核的方向伪装为已建立记录。

## 背景

- `active + unaligned` 用于表达已确认但尚未成为当前事实的未来方向；归档必须保留最后状态，才能回放判断的历史边界。
- 已建立记录若允许空值，会把未知状态混入来源、索引和列表，使相同记录在维护和查询时得到不同解释。
- `candidate` 尚未建立，合法组合是 `alignment: null`、`createdAt: null` 且位于正式索引之外；这个空值不是已建立记录的未知状态。
- 索引是从权威 Markdown 派生的投影。版本升级只能在当前来源已满足契约时重建，不能由旧索引、默认值或生命周期操作补造历史事实。

## 决策

- 采用: `active` 与 `archived` 都是已建立记录，来源和正式索引中的 `alignment` 必填且只能为 `aligned` 或 `unaligned`。缺失、`null` 或其他值一律是非法来源，不以 `unknown`、字段省略或默认 `unaligned` 兼容。
- 采用: `candidate` 独立保持 `alignment: null` 与 `createdAt: null`，不进入正式索引、正式查询或关系图。首次建立才显式选择非空 alignment 并写入建立时间。
- 采用: 合法归档保留最后 alignment；重新激活时由本次操作显式确认 alignment，不从归档位置、索引或默认值猜测。
- 采用: definition 过期而来源已满足当前契约时，只用当前 CLI 的无选择全量 `sync-index --write` 重建后严格检查；旧 definition 不是正常查询依据，不自动迁移来源，也不改变通用索引 schemaVersion。
- 采用: 已建立来源非法时，检查和同步均零写入并停止集合维护。只有可信 Git 或历史材料能够确定正确值、且已取得针对该原位字段修复的授权时，才修复字段后重新全量同步；不通过 activate、archive 或其他生命周期命令制造历史事件。证据不足时保留来源并请求判断。
