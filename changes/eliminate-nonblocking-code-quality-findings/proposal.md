# Proposal

本 Change 以不改变工具行为为前提，分 owner 消除当前 Gate 记录的非阻断代码质量 finding。

## Why

最近一次完整 base Gate 在 `file-metrics` 中记录 84 条超长文件信号，在 `function-metrics` 中记录 305 条函数密度、圈复杂度、嵌套深度或参数数量信号。它们不是阻断性违规，但高密度地集中在 Investigation Report、Decision Records、Task Graph 等核心工具，也包含少量因分析器无法正确识别字符串或正则边界而形成的假性超长结果。继续叠加功能会扩大局部推理和回归验证成本；直接提高阈值、批量豁免或为压数字机械拆 helper 又会掩盖真实责任。

## Outcome

当前维护代码在不提高指标阈值、不增加 finding waiver 且不改变公开行为的前提下，通过责任驱动的模块与流程重构，使 cold Gate 的 `file-metrics` 和 `function-metrics` 都不再产生非阻断 finding。

## Scope

### Intended Change

先校正会误导函数分析器的等价源码表达，再按 `scripts/` 与各 `tools/<tool-name>/` owner 逐批审阅并重构真实多职责文件、复杂函数和超长测试；模块拆分以独立边界、领域阶段或可单独验证的契约为依据。移动测试时同步 Test Evidence Case 与索引，改变可分发工具源码组织时同步构建适配、生成产物和工具链模块说明。

### Resulting Impacts

- 生产源码的内部模块边界、导入关系和局部类型可能变化，但 CLI、SDK、文件格式、诊断、退出码和持久化语义保持兼容。
- 测试入口可能按行为责任拆成多个文件；package scripts、Gate catalog、Test Evidence Case 和索引必须同步。
- `tools/` 下可分发源码的拆分会影响构建输入和 skill 内生成产物，必须通过对应 build/check 入口同步并验证漂移。
- 指标清零不能依赖提高限制、删除有效测试、批量 waiver、无责任转发层或只改变统计归属的包装函数。

## Success Criteria

1. cold release Gate 的 `file-metrics` 与 `function-metrics` 各记录 0 条 finding，且原有阈值与空 waiver 配置保持不变。
2. 每个新增模块或 helper 都能以独立责任、边界、阶段、不变量或验证责任解释；没有为规避统计而切碎连续流程。
3. 公开 CLI、SDK、文件格式、诊断和失败语义没有非预期变化；所有受影响原生测试及项目级 Gate 通过。
4. 测试移动后的 package scripts、Gate catalog、Test Evidence Case/index，以及工具源码拆分后的生成产物与 owner 文档保持一致。

## Affected Owners

- `docs/coding-style.md`：实现质量、边界、类型、组织与验证规则。
- `docs/tooling.md`：源码/生成边界、稳定命令、Gate catalog 与模块归属。
- `scripts/`：主仓库自动化、环境、Gate 与 Test Evidence 项目适配。
- `tools/change-plan/`、`tools/decision-records/`、`tools/index-runtime/`、`tools/investigation-report/`、`tools/mcpshell-workspace-bridge/`、`tools/shared/`、`tools/skill-updater/`、`tools/task-graph/`、`tools/test-evidence/`：各工具实现与局部契约。
- `skills/test-evidence-review/` 与 `docs/test-evidence/`：测试入口移动后的 Case 账本事务。
