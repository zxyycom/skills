---
title: 将记录发现语义投影到命令级帮助
id: 261004-project-record-discovery-semantics-into-cli-help
status: active
alignment: aligned
createdAt: 2026-10-04T15:22:39Z
purpose: 让 list 与 search 的运行时帮助自足说明普通发现的结果边界与后续读取方式。
background: 只列参数的帮助需要调用者另读完整契约；复制完整契约又会产生第二语义 owner。
decision: 两域 list 与 search help 用紧凑 Semantics 与 Examples 投影发现规则，精确契约继续拥有完整语义。
tags:
  - cli-help
  - decision-records
  - investigation-report
  - responsibility-boundaries
relations:
  - type: 拆分
    target: 260922-front-load-record-context-recovery
    summary: 独立承接 list/search 帮助的发现语义投影
---

## 目的

- 让 Decision Records 与 Investigation Report 的 `list` 和 `search` 命令级帮助成为自足的普通发现入口，调用者不离开运行时帮助也能理解结果边界和后续读取方式。
- 保持帮助与固定契约的单向投影关系，不建立第二份查询规则。

## 背景

- 命令级 help 只列主要参数时，筛选组合、匹配范围、candidate 边界、截断结果与后续读取方式仍散落在固定契约中。
- 普通发现只需要足以选择参数和解释返回结果的边界；完整查询、降级和机器结构由契约拥有。
- 后续查询输出、预算或示例变化可以独立影响帮助投影，而不改变新建排重和调查复用政策；两者需要可分别核对的长期依据。

## 决策

- 采用: 两域 `list` 与 `search` 的命令级 help 以紧凑 `Semantics` 和 `Examples` 说明普通发现所需的筛选组合、关系参数依赖、结果上限与 warning。
- 帮助区分正式记录与 candidate 的发现范围，并说明结果来源、截断或未核对当前性对结论的限制；命中身份后通过 `show` 读取完整正文和完整直接关系。
- 精确查询、降级与机器结构由各领域固定契约、Schema 与当前实现承接，帮助修改须核对投影一致性。记录恢复、复用、复查与授权政策仍由行为入口拥有。
