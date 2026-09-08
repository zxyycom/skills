# Tasks

计划审计完成后，先验收历史数据，再实施严格契约并验证全部来源、查询、维护与分发边界。

## Readiness

- [x] 0.1 审计目标、范围、owner、成功标准与任务一致，确认只移除已建立记录空值，保留候选模型。
- [x] 0.2 核对领域 definition 递增、通用 schemaVersion 不变、skill 版本及全量索引重建方案可执行。
- [x] 0.3 核对历史数据前置、长期报告交接、使用项目恢复路径及 updater 非目标，没有待决设计事项。
- [x] 0.4 确认源码、生成物、长期决策、测试 Case 与验证入口责任，审计未把实施或数据验收视为已完成。

## Implementation

- [x] 1.1 验收上游召回报告并重新扫描当前完整来源；未完成时先推进召回 Change，通过后记录本 Change 实施基线。
- [x] 1.2 收紧领域类型、来源解析、索引 Definition 和 JSON Schema 的 alignment 必填约束，保持候选独立状态组合。
- [x] 1.3 删除已建立投影/查询的空值转换与 list unknown 统计，审计全部查询和生命周期 consumer 的拒绝及零写入行为。
- [x] 1.4 递增领域 definition 与 skill 版本，明确过期索引和非法来源诊断；只从合法当前 Markdown 全量重建新索引。
- [x] 1.5 同步 skill 入口、规则、恢复说明及人类升级指引，维护一条完整的长期契约决策及派生索引。
- [x] 1.6 通过现有构建入口生成分发 MJS、source map、声明和 Schema，检查没有手写生成产物。

## Verification

- [x] 2.1 以最小原生入口覆盖 active/archived 合法值及 null/缺失拒绝，candidate 创建、查询、readiness 与首次建立保持原有行为。
- [x] 2.2 验证来源合法旧索引可全量重建、来源非法零写入、查询文本/JSON 非空、统计/筛选不变及维护命令回归。
- [x] 2.3 按 Test Evidence Review 同步受影响 Case 与索引，完成分发 smoke、类型/Schema 和源码一致性验证。
- [x] 2.4 运行领域测试、生成检查、决策/测试证据检查、skill 验证及 bun run check，逐项复核成功标准。
- [x] 2.5 在完整分发输入的 Git pending 快照上运行相对实施基线的 release 门禁，确认版本/制品验证且未发布外部系统。
- [x] 2.6 确认稳定 owner、长期判断和数据证据交接完成，按 Change Plan 契约完成计划。
