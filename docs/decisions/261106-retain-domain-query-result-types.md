---
title: 保留两域独立强类型查询结果
id: 261106-retain-domain-query-result-types
status: active
alignment: aligned
createdAt: 2026-11-06T10:54:23Z
purpose: 保持各记录领域查询结果及警告契约局部、强类型且可演进。
background: 重复检测发现两域结果载体形状相同，但载荷和 Trace 警告语义不同。
decision: 保留独立闭合结果类型，并仅为已审阅片段使用精确位置原生 waiver。
tags:
  - gate
  - record-cli
  - types
relations: []
---

## 目的

记录 CLI 的决策与调查查询各自保持封闭、可穷尽的强类型结果，同时让重复检测的审阅结论可追溯，不以消除指标而扭曲领域模型。

## 背景

两域查询各有 `QueryResult`，变体名称和多数警告访问分派同形，但结果载荷是各域不同 DTO。决策域 Trace 不携带 warnings，调查域 Trace 则携带。将结果降为动态 JSON 会丢失静态契约；共享泛型结果族、关联类型或宏仍需适配多个不同载荷与警告契约，增加间接层并使读者跨域恢复局部行为。重复检测仍正确报告形状相似，不能声称不存在重复。

## 决策

- 采用: 保留两域独立、强类型的闭合结果类型及各自警告分派；对唯一已审阅的同形结果载体片段使用 Gate 原生精确位置 waiver，不扩展到其他重复片段、不降低阈值或排除路径。两域语义收敛、重复边界变化或产生更小且不损失类型与局部性的共享契约时重新评估。

Waiver 保留原始 Finding 与理由，但其 identity 只有完整路径和行号，不绑定内容 hash；unused 或 overmatched 只形成审计记录和 warning，不自动阻断。维护者必须复核位置、实际内容与审计结果，不能把 waiver 当作内容未变或重复为零的证明。精确配置与当前结算由 `docs/gate-policy.md` 和 Gate 实现维护。
