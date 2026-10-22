# Proposal

本 Change 以快速默认 Gate、完整变更验收及可观测性能预算分离日常反馈与交付证明。

## Why

默认入口同时承担完整 base 输入证明与原生材料结算，使日常反馈与完成验收共用同一执行范围。分层需要保持现有原生选择、调度与 release 事务，并让快速反馈具有可验证的性能门槛。

## Outcome

日常 `bun run check` 执行快速必要检查并强制性能预算；`bun run check:changed`（`all` 为别名）保留完整变更相关验收；CI base 与 release 仍实际执行各自完整范围，现有 release、`--full`、cold 与同快照打包行为兼容。

## Scope

### Intended Change

- 在同一完整 Definition 中区分 quick、changed、full 与 release；quick 固定必要 eligible 集，changed 沿用完整输入与 receipt，full 执行全部 base。
- quick 强制 total < 30s、Check P90 < 10s、mean < 5s；其他范围只报告。统计只使用本轮实际执行值。
- quick 只消费既有证明、不发布 receipt；changed 保持完整成功事务。CI 将 base scope 提升 full；release 与兼容参数不变。

### Resulting Impacts

- 更新稳定 package 入口、CLI 参数、原生选择条件，保留 learned identity；保持完整 catalog、依赖、资源和打包快照。
- 同步 AGENTS 验收责任、工具链运行 owner、Gate 接入约定及长期决策。
- 覆盖选择、参数兼容、性能边界、receipt 不发布与完整验收回归，并同步新增/改动测试的 Case/index。

## Success Criteria

1. 默认 quick eligible 集正确，未进入其范围的完整验收结果不被冒称已证明；changed/all/full/CI/release 的范围及兼容参数有直接测试证据。
2. quick 任一测量达到预算即使原生质量通过也使 CLI 失败；nearest-rank、null 排除、真实零、缺失/非法数据、报告写入失败政策和 report-only 均有直接证据。
3. quick 不发布或清除 receipt；changed 的精确复用、起止漂移和成功发布约束保持，CI/full/release 不复用。
4. 稳定 owner 与 Decision 自包含、无冲突；运行直接测试、quick、changed，并按真实结果记录未覆盖的冷 release/CI 边界。

## Affected Owners

- `scripts/vibe-check.ts`、`scripts/vibe-check-invocation.ts` 与 `scripts/lib/vibe-gate/`：CLI、选择、性能与输入证明接线。
- `package.json`、项目配置校验及相关 Gate 测试：稳定入口与行为证明。
- `docs/test-evidence/`：受影响最小原生测试的 Case/index。
- `docs/tooling.md`、`docs/gate-check-authoring.md`、`AGENTS.md`：运行、接入和完成验收责任。
- `docs/decisions/`：分层与预算判断及其直接前序；独立工具能力/订阅判断保持。
