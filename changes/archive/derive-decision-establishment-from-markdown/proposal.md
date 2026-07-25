# Proposal

本 change 计划让决策是否已经建立完全由自包含 Markdown 生命周期字段决定；本文是实施前计划，不表示相关行为已经改变。

## Why

当前工具同时使用 Markdown、索引和 Git `HEAD` 判断候选、已建立记录、可归档记录、可丢弃记录和关系目标，因而同一生命周期需要三个来源共同解释。`HEAD` 只能说明路径是否已经提交，不能证明决策是否确认或生效；它还会把明确的领域目录迁移误判为旧路径丢失、新路径 pending 和关系目标不存在。改为由 Markdown 生命周期字段定义建立状态后，查询、维护和后续结构迁移可以使用同一个事实源。

## Outcome

- `createdAt: null` 且满足候选结构的 Markdown 是未激活候选；带非空合法 `createdAt` 的 Markdown 是已建立记录。
- `activate` 写入首次创建时间后，记录立即成为已建立且生效的索引成员，不再产生 pending 状态。
- `sync-index --write` 从当前全部有效已建立 Markdown 完整重建索引；索引只用于派生查询，不拥有成员身份。
- `discard` 只删除未激活候选；已建立记录只能按正常生命周期归档或演进。
- 关系目标只要求是当前扫描到的已建立归档决策，不再要求存在于 Git `HEAD`。
- 查询、检查、写事务、公开类型、文档和测试不再读取或输出 `HEAD/pending`。

## Scope

纳入范围：

- decision-records 扫描、严格检查、索引选源、查询上下文、写事务和生命周期命令。
- `head-decision-paths` 模块、相关 version-control 依赖、pending 输出和 Git 专用诊断的移除。
- 候选、已建立、激活、归档、丢弃、关系和索引重建契约的文档与测试。
- 与 `HEAD/pending` 当前语义冲突的活动长期决策的归档与修订。

不纳入范围：

- 读取或输出旧 pending 状态；最终工具只接受新的 Markdown 生命周期契约。
- 自动推断重命名、维护路径别名、稳定 ID 或历史路径映射。
- 修改 alignment 的单向治理语义或关系类型。
- 实际执行领域目录和全量路径迁移；该迁移由后续 change 承接。
- 修改共享 version-control 组件的其他消费者。

## Success Criteria

- 决策根目录在非 Git 目录中也能完成查询、严格检查和维护。
- 工具源码、公共类型、CLI 输出和当前契约中不再存在 `headDecisionPaths`、pending 状态或 Git `HEAD` 成员判断。
- 候选只由 `createdAt: null` 与当前格式约束识别；索引不包含候选，严格检查在候选残留时继续失败。
- 激活候选后索引立即包含该记录；归档接受任意活动已建立记录；丢弃拒绝任意已建立记录。
- `sync-index --write` 能从全部有效非空 `createdAt` Markdown 重建缺失、损坏或陈旧索引。
- 关系校验只依赖当前扫描集合、已建立状态、归档状态、重复、自环和环路。
- 相关领域测试、生成产物检查、类型检查和完整仓库检查通过。

## Affected Owners

- `skills/decision-records/SKILL.md` 与 `references/decision-record-rules.md`：决策生命周期、候选、关系和 CLI 固定契约。
- `skills/decision-records/references/maintenance-recovery.md`：无 Git 前提下的恢复路径。
- `tools/decision-records/src/`：扫描、验证、事务、命令、类型和索引选源。
- `tools/decision-records/tests/`：生命周期、非 Git 根目录、关系、恢复和失败事务证据。
- `docs/decisions/decision-records/`：当前 HEAD/pending 长期判断的演进。
- `docs/skills/decision-records.md`：面向人类的能力说明。
- `docs/coding-style.md` 与 `docs/tooling.md`：边界解析、类型、生成和验证规则。
