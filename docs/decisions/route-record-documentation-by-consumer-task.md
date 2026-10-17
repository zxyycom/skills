---
title: 按消费任务组织调查与决策文档
id: 261017-route-record-documentation-by-consumer-task
status: active
alignment: aligned
createdAt: 2026-10-17T03:23:05Z
purpose: 让记录使用者只读取当前任务所需契约，让工具维护者恢复实现与验证责任。
background: 统一契约同时承接领域判断、命令操作和实现细节，全量必读及多处复制增加阅读负担与口径漂移。
decision: 两项记录 skill 按任务选择领域规则、操作契约和恢复路径，工具实现约束归源码维护入口。
tags:
  - ai-ready-docs
  - decision-records
  - investigation-report
  - responsibility-boundaries
relations:
  - type: 修订
    target: separate-agent-contract-from-tool-protocol
    summary: 保留领域与机器分工，按消费任务区分操作和实现契约
---

## 目的
- 让调查报告和决策记录的使用者先完成领域判断，再只读取当前操作需要的前提、影响与结果边界。
- 让工具维护者恢复实现约束及验证责任，保持公开操作契约与内部实现规则各有唯一 owner。
- 让拆分后的内容形成真实按需阅读路径，避免入口缩短但下游材料仍被无条件全量加载。

## 背景
- `separate-agent-contract-from-tool-protocol` 已采用入口承接行为、领域契约承接语义、Schema 与 CLI 承接机器细节的方向，并用于约束决策 skill 的文档组织。
- 调查与决策的常见任务同时包含阅读记录、写作与结构审阅、执行命令、异常恢复和修改工具实现。它们需要的证据与约束不同；维护记录本身仍是工具使用，不等于维护工具源码。
- 只有把操作前提和实现约束分开，并让入口按任务选择章节，才能减少无关读取而保留写入范围、授权、历史保真及失败恢复等必要边界。
- 索引 Schema 与命令 help 已分别拥有精确机器结构与参数说明，人类介绍和行为入口重复维护这些细节会产生口径漂移。

## 决策
- 采用: 本规则适用于 `skills/investigation-report/` 和 `skills/decision-records/`，保留前序的领域与机器分工，增加按消费任务区分操作契约和实现约束的责任边界。
- 采用: 两项 `SKILL.md` 拥有触发、领域判断、工作流程、任务路由和交付验收。查询、写作与结构审阅、工具操作、异常恢复、实现维护分别路由；普通任务按公共必读和所选操作展开，整体审阅某层契约时才完整读取该层。
- 采用: `references/investigation-report-contract.md` 与 `references/decision-record-rules.md` 分别拥有身份、正文、记录边界、关系及各领域不变量；只保留执行判断需要的验证含义，不承接内部读取策略或渲染实现。
- 采用: 两项 skill 各自的 `references/cli-operations.md` 拥有使用者可观察的操作前提、选择范围、写入影响、结果证据和失败边界。普通查询按来源和命令读取；写入先读操作前提，再读目标操作及关联领域规则。
- 采用: `tools/investigation-report/README.md` 与 `tools/decision-records/README.md` 拥有实现维护入口、内部投影与阶段事实等实现约束，并路由到公开行为与项目验证要求。这些材料不进入 skill 包，也不成为普通记录操作的依赖。
- 采用: 索引 Schema 继续拥有精确机器结构，CLI help 拥有命令参数；`references/maintenance-recovery.md` 拥有工具、索引与中断恢复路径。源码构建与分发验证由源码项目维护入口承接，避免恢复手册复制整套工具链。
- 采用: `docs/skills/` 中的人类介绍只承接定位和入口，`docs/navigation.md` 路由稳定 owner。文档责任称为内容 owner，代码、配置、规范和项目文档作为当前事实来源；领域 Markdown 仍为记录权威来源，索引保持单向派生。
- 采用: 阅读路径精简保留授权、删除范围、真实历史、资源安全、完整关系与来源证据边界；不以移动文档改变 CLI 行为。调用示例区分脚本安装位置和目标工作区，跨目录调用显式指定工作区根。
