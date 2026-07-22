---
status: archived
alignment: null
createdAt: 2026-06-30T16:44:06+08:00
---

# 用 owner 命名决策记录根文档

## 索引摘要
- 目的: 让决策清单和维护规则的 owner 能从文件名直接识别。
- 背景: 通用的 `README.md` 与 `maintenance.md` 无法从文件名区分决策清单和维护规则的职责。
- 决策: `decision-record-index.md` 作为决策清单和影响面导航 owner, 只负责状态速查、影响面说明和决策链接。

## 目的
- 让决策清单和维护规则的 owner 能从文件名直接识别。

## 背景
- `docs/decisions/README.md` 和 `docs/decisions/maintenance.md` 的文件名不能直接说明实际职责, 需要打开文件才能知道哪个负责清单、哪个负责规则。
- 项目入口没有直接引用 `docs/decisions/README.md`, 决策清单入口依赖目录约定而不是明确链接。
- 非 `active` 决策的状态来源只校验为 Markdown 链接格式, 没有确认目标决策文件是否真实存在。

## 决策
- 采用: `decision-record-index.md` 作为决策清单和影响面导航 owner, 只负责状态速查、影响面说明和决策链接。
- 采用: `decision-record-rules.md` 作为决策记录维护规则 owner, 负责记录门槛、命名、状态关系、正文结构、写法要求和更新流程。
- 采用: 项目 README 和相关维护说明直接链接到两个显式 owner 文件, 不再依赖 `docs/decisions/README.md` 的目录默认含义。
- 采用: `scripts/validate-decisions.ts` 校验非 `active` 决策的状态来源链接, 目标必须解析到 `docs/decisions/<impact-area-id>/` 下已存在的决策文件。
- 不采用: 继续使用 `README.md` 承接决策清单。原因是文件名只表达目录入口, 不能表达“决策清单和影响面导航”的实际 owner。
- 不采用: 继续使用 `maintenance.md` 承接规则。原因是文件名过泛, 不能直接说明规则范围包含门槛、命名、状态、正文结构和更新流程。

## 关系
- 修订: [建立决策记录策略](260627-establish-decision-record-policy.md)
