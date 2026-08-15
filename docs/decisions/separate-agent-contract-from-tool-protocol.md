---
title: 分离 Agent 决策契约与工具协议
status: active
alignment: aligned
createdAt: 2026-07-25T02:10:02Z
purpose: 让 agent 只加载完成判断与维护所需的决策语义，并把机器细节交给对应 owner。
background: 固定契约同时解释决策模型、索引运行时和 CLI 精确行为，造成重心偏移并重复 Schema 与实现。
decision: "`SKILL.md` 承接 agent 流程，领域契约承接语义与维护不变量，Schema 和 CLI 自身承接机器细节。"
tags:
  - decision-records
relations:
  - type: 修订
    target: 260720-focus-entry-on-behavior-routing.md
---

## 目的
- 让 agent 触发 skill 后先恢复相关决定、判断当前任务并选择动作，而不是先加载存储和索引协议。
- 让写入前读取的领域契约只包含 agent 必须理解和保持的决策语义、内容边界与维护不变量。
- 让索引格式和 CLI 细节各自回到可机械校验的 owner，减少文档重复和漂移。

## 背景
- 既有决定正确地把精确维护细节从高频入口移入固定契约，但又让单个固定契约承接目录、Markdown、生命周期、索引运行时、CLI 精确输出、退出状态和恢复事务。
- 固定契约的篇幅和层级因而集中在索引与工具细节，真正影响 agent 判断的决策门槛、相关性、冲突分类和动作选择反而不突出。
- 当前索引已经有随包 JSON Schema，CLI 已有 `--help`、实现和测试；继续在领域契约复制版本、字段顺序、派生键、revision 和完整命令协议没有独立价值。
- “行为 owner”同时被用于文档责任和当前事实来源，容易让 agent 混淆规则由谁维护与决策落实应去哪里核对。
- 分发包内的 `SKILL.md` 和 references 服务 agent；仓库中的 `docs/skills/decision-records.md` 仍只是面向人类的定位入口，不承接操作规则。

## 决策
- 采用: `SKILL.md` 面向 agent，承接读取路径、决策恢复、候选门槛、冲突分类、动作选择、命令用途和交付验收。
- 采用: `decision-record-rules.md` 作为 agent 写入前读取的领域契约，只完整承接决策模型、领域与身份语义、Markdown 内容、生命周期、关系和维护不变量。
- 采用: `decision-index.schema.json` 承接索引的精确字段、合法值、版本和机器结构；领域契约只解释索引是可重建查询投影、何时同步以及陈旧查询如何处理。
- 采用: CLI 的 `--help`、实现和测试承接参数、精确输出、退出状态与索引操作细节；skill 只列出命令用途和 agent 可预期的效果。
- 采用: `maintenance-recovery.md` 只处理工具不可用、索引故障和中断写入，不复制 release、源码构建、source map 或通用 updater 说明。
- 采用: 文档责任使用“内容 owner”，代码、配置、规范和项目文档统一称为“当前事实来源”，领域目录表与决策 Markdown 明确称为决策权威来源。
