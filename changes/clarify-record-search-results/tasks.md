# Tasks

Readiness 记录设计审计，Implementation 交付实现，Verification 验收行为与制品；design 承接各项任务的语义和兼容边界。

## Readiness

- [x] 0.1 确认本 Change 覆盖两个记录型 skill 的 search；Test Evidence 修复和其他 CLI 改造独立于本 Change。
- [x] 0.2 核对查询 owner、默认参数、metadata 差异、共享依赖与复现依据，形成 proposal 和 design。
- [x] 0.3 审计两域结果、筛选与新鲜度路径；在 design「查询元信息」与「公开边界」确定 searchInfo、失败组合、selector 回显、来源映射和声明入口。
- [x] 0.4 审计共享原语与消费者导入链；在 design「共享实现与隔离」选择记录域独立收集入口，保留 Test Evidence 导入链，并明确 2.2 的验证出口。
- [x] 0.5 在 design「默认输出」固定六行摘要和分类 warning，给出零命中、返回限制、最后文件与仅预览限制样例。

## Implementation

- [ ] 1.1 实现独立记录搜索收集入口，复用现有原语，返回扫描、观察计数与实际预算，保留空片段记录的命中身份。
- [ ] 1.2 补齐 Decision metadata/content 元信息、解析后筛选与来源观测，保持各自的返回与预算策略。
- [ ] 1.3 补齐 Investigation metadata 精确计数、限量覆盖与 warning。
- [ ] 1.4 补齐 Investigation content、准备条件、来源观测及公开搜索类型，保持来源验证与身份映射。
- [ ] 1.5 两域 CLI 从同一查询结果输出摘要和分类 warning，保留逐条记录及输出路由。
- [ ] 1.6 更新两域行为 owner、必要 SKILL.md 提示与 help，并审阅长期决策门槛。
- [ ] 1.7 增补最小原生回归测试，维护对应 Case 与测试证据索引。
- [ ] 1.8 运行 `bun run sync:decision-records-cli`、`bun run sync:investigation-report-check`，提升两域必要版本并核对分发影响。

## Verification

- [ ] 2.1 运行 `bun run test:file-text-search`、`bun run test:decision-records-cli`、`bun run test:investigation-report-check`，覆盖按记录计数、实际省略与恰好满额、空片段命中、早停、最后文件、空集、陈旧/未核实来源、降级及必需读取失败。
- [ ] 2.2 运行 `bun run test:test-evidence-cli`、`bun run check:test-evidence-cli` 并审阅生成差异，证明 Test Evidence 调用、行为和版本承载制品按 design 保持兼容。
- [ ] 2.3 运行 `bun run check:decision-records-cli`、`bun run check:investigation-report-check`、`bun run check:decisions`、`bun run check:investigations`，核对生成、声明、help 和领域数据。
- [ ] 2.4 从分发 CLI 验证元信息、计数精度及三种覆盖，确认输出消费同一结果。
- [ ] 2.5 验证 Case、实体覆盖和索引，运行 `bun run check`，复核最终范围。
- [ ] 2.6 对照 proposal 成功标准验收 diff、两域版本与稳定 owner 交接，说明验证及未覆盖边界。
