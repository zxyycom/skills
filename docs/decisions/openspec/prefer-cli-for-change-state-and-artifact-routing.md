---
title: 优先用 OpenSpec CLI 恢复 Change 状态与材料路径
status: active
alignment: aligned
createdAt: 2026-08-11T03:26:59Z
purpose: 让 OpenSpec skills 从工具事实源恢复状态、schema、依赖和验证结果，并只在信息不足时读取精确材料。
background: 直接猜测目录与 artifact 状态会复制 CLI 责任，但 CLI 不一定返回完成当前阶段所需的全部正文或旧行为背景。
decision: 优先使用 CLI 查询状态、schema、依赖、路径和验证；失败或正文不足时读取精确当前文件，必要时只把旧版参考用于回放安全回退。
relations:
  - type: 拆分
    target: openspec/260706-gate-temporary-change-plans.md
---

## 目的
- 让各阶段使用 OpenSpec 的当前状态、schema、artifact 依赖和验证结果，而不自行复制工具推导逻辑。
- 在 CLI 不可用或正文不足时提供受控回退，并避免把旧版参考误作当前项目事实。

## 背景
- OpenSpec CLI 能统一解释活动 Change、schema、artifact 状态、生成顺序、输出路径、delta 和验证结果。
- Proposal、design、tasks 等正文可能不完整出现在结构化输出中，阶段工作仍需按精确路径读取当前文件。
- 各 skill 的 `reference-original.md` 保存改写前行为，只适合维护和故障回退对照，不能代替当前 CLI、项目 artifact 或当前 skill 契约。

## 决策
- 采用: OpenSpec skills 优先使用 CLI 获取活动 Change、schema、artifact 状态与依赖、输出路径、delta、任务进度和验证结果，并按当前阶段只运行必要命令。
- 采用: CLI 返回 `contextFiles`、`outputPath` 或其他精确材料路径时按需读取这些当前文件；CLI 未提供所需正文时，只读取完成当前判断所需的目标 artifact 或主 spec。
- 采用: CLI 不可用、命令失败或输出不足时，可以从目标明确的当前项目文件恢复仍可证明的内容，同时明确无法由文件替代的工具状态、验证或外部效果。
- 采用: CLI 失败后需要判断该阶段的安全回退、维护当前 skill、排查改写差异或对照原始行为时，可以读取同目录 `reference-original.md`；它只提供旧行为参考，不作为当前项目状态、当前 artifact 正文或当前 skill 契约的事实源。
- 不采用: 不在常规路径中绕过 CLI 自行推断 schema、artifact 依赖、完成状态或验证结果。
