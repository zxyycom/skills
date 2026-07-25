---
title: 调整 git-commit-organizer 的提交粒度、类型和创建命令
status: active
alignment: aligned
createdAt: 2026-07-02T17:35:51+08:00
purpose: 让每个提交形成可独立理解、审查和回滚的语义单元，并准确表达 agent 配置改动。
background: "`git-commit-organizer` 已经规定提交格式和基础类型, 但没有明确要求按语义单元拆分提交, 也没有区分只影响 AI/agent 配置的改动。"
decision: 在 `git-commit-organizer` 的 skill 本体中增加“提交粒度”规则, 要求一个提交只表达一个可独立理解、审查和回滚的语义单元。
relations: []
---

## 目的
- 让每个提交形成可独立理解、审查和回滚的语义单元，并准确表达 agent 配置改动。

## 背景
- `git-commit-organizer` 已经规定提交格式和基础类型, 但没有明确要求按语义单元拆分提交, 也没有区分只影响 AI/agent 配置的改动。
- 如果继续把 AI/agent 配置归入通用 `chore`, 后续阅读提交历史时难以追踪 AI 配置变化。
- 旧流程使用 stdin 向 `git commit -F -` 传入提交信息, 在部分权限控制方案下容易被拦截; 提交创建方式应优先使用更直接的命令参数。

## 决策
- 采用: 在 `git-commit-organizer` 的 skill 本体中增加“提交粒度”规则, 要求一个提交只表达一个可独立理解、审查和回滚的语义单元。
- 采用: 在提交类型中增加 `ai`, 用于只调整 AI/agent 配置, 例如模型、工具、MCP/app 连接、权限、运行参数或配置化 prompt。
- 采用: 明确 Skill 说明、agent 协作规则、OpenSpec、schema、示例和测试策略不因服务 AI 而使用 `ai`, 应按实际语义选择 `plan`、`spec`、`docs` 或 `test`。
- 采用: 将“提交类型”和“提交创建方式”作为独立规则段落, 工作流只调用这些规则, 避免把合法类型集合、粒度判断、命令选择和执行步骤混在同一层级。
- 采用: 创建提交时优先使用 `git commit -m "type：标题" -m "正文"`; 只有命令参数无法可靠表达多行正文时, 才使用临时提交信息文件配合 `git commit -F <file>`。
- 不采用: 不把多仓库、Git hook 等低频执行场景写入主流程, 避免增加常规提交整理时的执行噪音。
- 不采用: 不再默认使用 stdin 传入提交信息。
