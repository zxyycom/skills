# Tasks

按“建立严格方向、迁移现有数据、删除兼容实现、同步证据并完整验证”的顺序完成本 Change。

## Readiness

- [x] 0.1 确认规范目标只保留 Draft、Plan 与 archived，不为 implementation、shelved 或 null-base Plan 提供读取、投影、命令别名或自动迁移。
- [x] 0.2 盘点当前 active metadata，确认只有 `check-all-change-plans` 与 `establish-task-correction-and-successor-evolution` 需要一次性迁移，且保留原基线即可维持现有查询语义。
- [x] 0.3 核对 behavior owner、工具源码、生成产物、skill 版本、长期决策、原生测试入口及 test-evidence 账本的维护边界。
- [x] 0.4 确认用户已经选择长期移除兼容层，并准备以完整后继决策修订旧生命周期基线。
- [x] 0.5 确认改动范围只包含本 Change 所需文件，并保留工作区中的并行内容及其 Git 状态。

## Implementation

- [x] 1.1 建立并激活未对齐的 `require-canonical-active-change-metadata` 后继决策，归档被修订的旧生命周期决策并同步决策索引。
- [x] 1.2 将两个现存旧 active metadata 原地改写为规范 Plan，保留各自原 `baseCommit`，并证明没有其他 active Change 使用旧形状。
- [x] 1.3 删除 legacy shelf schema、兼容 active schema/reader/type 和 checker 的 canonical 投影，使 active 读取只调用规范 parser。
- [x] 1.4 收窄 Git-distance 的 baseCommit 类型并删除 null-base 运行分支，让所有 Plan 距离只从规范非空基线开始。
- [x] 1.5 更新 lifecycle、catalog 与 CLI 的失败行为，使旧 metadata 可作为无效目录成员发现但不能被查询为 Plan 或通过 `plan` 写回。
- [x] 1.6 删除固定契约、SKILL、人类介绍和 agent 入口中的旧兼容语义，并提升 change-plan 独立版本。
- [x] 1.7 重组受影响原生测试入口，删除 legacy rewrite 入口，保留并强化 strict rejection、集合可发现性和写入不变性证据。
- [x] 1.8 同步受影响 test-evidence case、统一派生索引及 change-plan 分发 MJS/source map。

## Verification

- [x] 2.1 运行 change-plan 原生测试、类型检查、生成漂移检查、skill 校验和单项 Change 检查。
- [x] 2.2 运行测试证据目录检查与决策严格检查，核对原生入口和 case 一一对应、后继关系闭合且旧决策已归档。
- [x] 2.3 运行 `bun run check` 与 `bun run check --full`，区分本 Change 的验证结果与工作区并行内容，并确认未纳入无关改动。
- [x] 2.4 逐项复核 proposal 成功标准、受影响代码的编码规范、文档 owner 一致性和生成产物无旧兼容实现。
- [x] 2.5 在完整方向成为当前事实后标记后继决策 aligned，并重新运行决策与完整门禁。
- [x] 2.6 使用 AI-ready Docs 审核本次文档，以 `docs/coding-style.md` 为权威全局审核受影响代码；修复发现的问题并重新通过目标验证与完整门禁。
- [x] 2.7 获得用户明确归档授权并完成归档前最终审阅；勾选后运行 `archive` 并复核 archived 结果。
