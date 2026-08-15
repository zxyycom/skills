---
title: 以独立证明单元登记 case 并从当前目录提供只读查询
status: archived
alignment: null
createdAt: 2026-07-25T04:02:05Z
purpose: 让验证目录只保存值得长期找回的独立证明单元，并让只读查询始终基于当前合法目录而不要求先写索引。
background: 将保留实现直接等同于登记 case 会扩大目录库存；只索引首条契约摘要又无法兑现按证明点查找，陈旧索引还会阻断只读审查。
decision: 按独立长期证明单元组织 test/check case，搜索覆盖完整 Contract 与 Proves；持久化索引不可用时只读建立内存投影，严格检查仍要求索引新鲜。
tags:
  - test-evidence-review
relations:
  - type: 修订
    target: review-verification-implementations-with-explicit-indexed-cases.md
  - type: 归并
    target: 260720-organize-proofs-by-shared-execution-chain.md
---

## 目的
- 让 `verification-implementation-review` 继续只由测试与工程校验实现触发，同时避免把每个值得保留的函数、规则或入口机械登记为 case。
- 让 agent 能按契约、输入、错误、输出、规则和实现入口找回当前验证证据，而不依赖索引恰好已经同步。
- 保留 Markdown 权威源、显式登记和严格派生索引检查，同时让只读查询不产生文件写入。

## 背景
- 既有入口把“保留验证实现”直接表述为“登记 case”，容易让 agent 推导出实现与 case 一一对应，重新积累目录维护成本。
- 既有分组判断已经允许共享契约、验证基座或连续执行链路承接多个证明点，但仍以旧 `automated`、main、derived 和 marker 术语作为活动决策。
- 正文要求按输入、错误、输出和规则名搜索，实际索引只包含 case ID、标题、首条 Contract 和 Entry，无法检索只出现在其他 Contract 或 `Proves:` 中的语义。
- 持久化索引缺失、损坏或陈旧时，既有查询直接失败并要求写回，这与只读审查和查询不得修改工作区的边界冲突。

## 决策
- 采用: `verification-implementation-review` 只在新增、修改、删除或审查测试与工程校验实现，或者显式查询和整理其 case 时启用；普通业务修改、仅运行既有检查、只修复被检查对象和业务运行时输入校验不启用。
- 采用: `check` 的主要产物是对工程对象给出可复核的通过、失败或诊断结论；脚本、规则、配置和工具入口只有在定义该判定语义时属于 check，主要产物是业务行为、运行时防御、转换结果或构建产物的实现不属于 check。
- 采用: case 是需要长期找回的独立证明单元，不是测试函数、规则或入口的清单。共享稳定契约、验证基座、输入集合、规则上下文或连续执行链路，且拆分会复制准备、丢失关系或增加维护成本时保留在同一 case；形成独立契约、入口、运行环境或维护周期时再拆分。
- 采用: Markdown 目录继续作为权威源。派生索引的搜索文本由 case ID、标题、全部 `Contract:`、全部 `Proves:` 和全部 `Entry:` 确定性生成；`list` 只返回紧凑摘要，`show` 从 Markdown 展开完整原文。
- 采用: `list` 和 `show` 优先使用当前持久化索引；索引缺失、损坏、定义不兼容或陈旧时，从当前合法 Markdown 在内存中建立同一投影，返回非阻断 warning 且不写文件。目录无效或不可读时查询失败，不使用旧 state。
- 采用: `check` 和 `sync-index` 继续把持久化索引的新鲜度作为严格契约；修改目录后通过 `sync-index --write` 显式同步。索引和内存投影都不发现源码入口、不执行 Entry、不自动登记或修复 case，也不判断证明价值。
