---
title: 只按最小原生测试入口维护证据目录
status: archived
alignment: null
createdAt: 2026-07-25T08:36:12Z
purpose: 恢复测试证据目录的自然粒度，避免泛化校验把模块、skill 或聚合命令扩成巨型 case。
background: 测试框架有可独立选择和报告的原生节点，工程校验没有统一的最小单位；共用独立验证入口会把聚合容器误当登记单元。
decision: test-evidence-review 只登记最小原生测试入口，目录与索引保持显式维护和快速查询，不接入工程校验、marker、采集或自动注册。
tags:
  - test-evidence-review
relations:
  - type: 替代
    target: register-one-case-per-independent-verification-entry.md
---

## 目的
- 让每个测试 case 保持在 runner 能稳定选择、单独报告且拥有单一测试意图的自然粒度。
- 防止整个模块、skill、测试文件、suite、脚本或 CI job 因可执行而被登记成一个巨型 case。
- 保留低上下文查询价值，同时不恢复源码 marker、入口采集和自动注册机制。

## 背景
- 原始测试用例能控制粒度，是因为测试框架已经提供 `test`、`it`、测试方法和参数化 case 等原生报告节点。
- 工程校验覆盖 lint、schema、生成物、依赖、工作区状态和聚合 gate，没有跨机制一致的最小证明单位；把它们统一成“独立验证入口”后，文件、命令、CI job 甚至整个 skill 都可能满足入口表象。
- “可以单独运行”不足以区分测试本身与聚合容器。package script、runner 命令和 CI job 可以聚合许多可独立失败的测试意图。
- 显式 Markdown 目录和派生索引已经足以支持查找与筛选；自动发现无法可靠判断测试意图和 case 边界，反而需要 marker、角色和注册状态等额外协议。

## 决策
- 采用: 恢复 `test-evidence-review` 身份，只在新增、修改、删除或审查测试实现，或查询、整理测试证据 case 时启用；工程校验由各自 owner 承接，不进入本目录。
- 采用: case 的唯一登记单元是最小原生测试入口，即 runner 能稳定选择、单独报告结果且自身拥有一项完整测试意图的最小命名节点。
- 采用: 测试文件、suite、目录、package script、runner 命令和 CI job 即使可单独运行，只要聚合多个可区分的原生测试节点，就只是容器；fixture、helper、mock、断言和步骤是内部环节，二者都不单独登记。
- 采用: 自定义测试程序只有在确实只产生一个不可再归因且意图单一的最终判定时，才可整体作为入口；混合多个可独立命名、独立失败意图的测试应先拆分，不能维护巨型 case。
- 采用: 每个保留入口使用一个显式 case，字段只包含 `Entry:`、`Contract:` 和 `Proves:`；测试身份由目录本身表达，不保留 `Verification:` 类型字段。
- 采用: 本次修改涉及的每个保留测试入口必须登记；未触及历史测试只有在任务明确要求补齐时进入范围，工具不声称自动证明全仓完整性。
- 采用: Markdown 继续作为权威源，派生索引只按 case ID、标题、Contract、Proves 和 Entry 提供查询；工具校验结构和索引新鲜度，但不扫描源码、不发现测试、不执行 Entry，也不自动收集、注册或生成 case。
- 不采用: 恢复源码 marker、main/derived/exempt 角色、入口采集器、自动注册、状态流转或 test/check 统一分类。
