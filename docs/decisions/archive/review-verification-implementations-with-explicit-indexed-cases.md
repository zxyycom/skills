---
title: 以验证实现为触发边界并显式索引 test/check case
status: archived
alignment: null
createdAt: 2026-07-25T03:32:33Z
purpose: 让 skill 只在测试或工程校验实现发生变化时评估证明价值，并以显式 case 和派生索引保持低成本查找。
background: 入口发现、源码 marker、未登记统计和 Git 范围触发让流程围绕采集完整性展开，也会由普通业务变化间接启用；工程校验又无法被测试入口模型准确承接。
decision: 使用 `verification-implementation-review` 审查 test/check 实现；只登记显式 case，移除采集、marker、自动注册与范围触发，保留派生索引查询。
tags:
  - test-evidence-review
relations:
  - type: 替代
    target: 260720-map-test-entries-and-trigger-scoped-reviews.md
  - type: 修订
    target: index-ledger-by-stable-case-state.md
  - type: 替代
    target: publish-only-layered-test-evidence-interfaces.md
  - type: 修订
    target: read-ledger-contract-on-demand.md
---

## 目的
- 让 skill 的启用对象稳定收窄为测试与工程校验实现本身，避免普通业务代码、仅运行既有检查或业务运行时输入校验触发额外流程。
- 用同一语义准入评估 test 与 check 实际证明什么、信号是否可靠、是否重复以及维护成本是否相称，同时保留两类实现的明确区分。
- 只为已经存在并决定保留的验证实现承担登记成本，并让后续 agent 能用索引快速搜索、筛选和定点展开 case。
- 让目录维护、派生索引和项目验证各自保持单一责任，不让入口发现完整性代替证明价值判断。

## 背景
- 测试入口发现、逐入口 marker、未登记统计和发现豁免占据了旧 skill 的主要契约与工具面，语义评估反而依赖一套无法跨框架可靠完备的采集结果。
- Git `Scope` trigger 会由被验证业务实现的普通变化启用人工审查，使 skill 的触发对象从验证实现扩展为所有潜在风险代码。
- 工程校验可能由脚本、规则、配置、编译器、linter、schema 或产物一致性入口承接，并不一定表现为测试函数，也不适合被迫映射为 main、derived 或 exempt。
- 自动采集无法自动判断一个入口是否值得登记；自动注册还会把发现误报、重复函数和低价值实现直接转化为长期目录成本。
- 已建立的通用状态索引能够独立于入口采集，为显式 Markdown case 提供新鲜度、分页、类型筛选和按 ID 展开，这部分价值仍然成立。

## 决策
- 采用: 将分发身份改为 `verification-implementation-review`，当前行为 owner 位于 `skills/verification-implementation-review/`。只有新增、修改、删除或审查测试与工程校验实现，或者显式查询和整理其 case 时启用；普通业务修改、仅运行既有检查、只修复被检查对象和业务运行时输入校验不启用。
- 采用: `test` 表示通过安排输入、状态或交互并断言结果的验证实现；`check` 表示通过脚本、规则、配置或工具入口判断工程对象是否满足约束的验证实现。被验证业务契约只在 skill 已触发后作为判断上下文。
- 采用: Markdown 目录只登记已经存在且决定保留的 case。每条 case 使用稳定 ID、`Verification: test|check`、非空 `Entry:`、`Contract:` 和 `Proves:`；不保存 planned、review 或 exempt 状态，也不按测试函数或规则条数机械枚举。
- 采用: `Entry:` 是由 agent 完成语义处置后显式登记的文件、规则、task 或命令定位信息。工具不扫描源码、不统计未登记入口、不使用 marker、不自动创建或修复 case，也不执行 Entry。
- 采用: 取消入口采集器、`TestEntryInventory`、main/derived/exempt marker、发现豁免、Git Scope 和 review trigger。只能由人工流程、监控或发布治理承接的风险交给对应 owner，不伪装为验证实现 case。
- 采用: Markdown 目录继续作为权威源；领域适配只投影 case ID、标题、test/check 类型、首条契约摘要、Entry 和源范围，通用索引继续拥有文件协议、新鲜度、同步、文本查询、类型筛选、分页和按 ID 获取。
- 采用: 日常恢复先用 `list` 定位、用 `show` 展开单个 case；只有写入、结构修复、配置调整或精确诊断前完整读取目录契约。`check` 只证明配置、目录结构和索引一致，不证明测试或 check 的语义质量。
- 采用: 新工具只发布一个可安全导入的 `verification-catalog.mjs`，提供 `check`、`sync-index`、`list` 和 `show`。Valibot Schema 继续作为机器结构真源，构建时生成 JSON Schema 与 TypeScript 声明；旧格式只由独立迁移文档承接，不进入运行时兼容分支。
