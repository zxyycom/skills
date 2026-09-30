# Tasks

按准备、实现、验证推进：design 承接语义和兼容边界，本文件记录任务与完成证据。

## Readiness

- [x] 0.1 确认本 Change 覆盖两个记录型 skill 的 search；Test Evidence 修复和其他 CLI 改造独立于本 Change。
- [x] 0.2 核对查询 owner、默认参数、metadata 差异、共享依赖与复现依据，形成 proposal 和 design。
- [ ] 0.3 收敛元信息类型、合法组合、selector 回显及两域公开边界。
- [ ] 0.4 选择记录域的预览解耦实现，证明共享消费者调用、行为和版本承载生成边界的兼容性。
- [ ] 0.5 确认摘要、预览不适用与 warning 格式，复核查询结果到输出的单向关系。

## Implementation

- [ ] 1.1 实现记录域显式使用的扫描、观察计数与预览分离，保留空片段记录的命中身份。
- [ ] 1.2 补齐 Decision metadata/content 元信息，保持各自的返回与预算策略。
- [ ] 1.3 补齐 Investigation metadata 精确计数、限量覆盖与 warning。
- [ ] 1.4 补齐 Investigation content 和公开搜索类型，保持来源验证与身份映射。
- [ ] 1.5 两域 CLI 从同一查询结果输出摘要和分类 warning，保留逐条记录及输出路由。
- [ ] 1.6 更新两域行为 owner、必要 SKILL.md 提示与 help，并审阅长期决策门槛。
- [ ] 1.7 增补最小原生回归测试，维护对应 Case 与测试证据索引。
- [ ] 1.8 运行 `bun run sync:decision-records-cli`、`bun run sync:investigation-report-check`，提升两域必要版本并核对分发影响。

## Verification

- [ ] 2.1 运行 `bun run test:file-text-search`、`bun run test:decision-records-cli`、`bun run test:investigation-report-check`，覆盖限量、预览限制、早停、最后候选、空集、陈旧来源、降级及失败。
- [ ] 2.2 验证共享消费者兼容，包括 `bun run test:test-evidence-cli`、`bun run check:test-evidence-cli`；按 design 保持其领域范围。
- [ ] 2.3 运行 `bun run check:decision-records-cli`、`bun run check:investigation-report-check`、`bun run check:decisions`、`bun run check:investigations`，核对生成、声明、help 和领域数据。
- [ ] 2.4 从分发 CLI 验证元信息、计数精度及三种覆盖，确认输出消费同一结果。
- [ ] 2.5 验证 Case、实体覆盖和索引，运行 `bun run check`，复核最终范围。
- [ ] 2.6 对照 proposal 成功标准验收 diff、两域版本与稳定 owner 交接，说明验证及未覆盖边界。
