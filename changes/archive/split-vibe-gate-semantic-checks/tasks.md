# Tasks

按 owner 先建立可审计 catalog，再调整独立测试入口、Gate 投影、文档证据与 release 验证；每一步只在前置边界已经可复核时推进。

## Readiness

- [x] 0.1 审计 `scripts/lib/vibe-gate.ts`、Vibe machine publication、CI、package scripts 与潜在缓存/外部消费者，确认旧聚合 Check ID 只由仓库内 Gate 定义、测试、文档与未来缓存计划引用。
- [x] 0.2 逐个读取 decision records、change plan、task graph、investigation report、test evidence、index runtime、shared tests 及其 test-evidence cases，确认拟议 Check 的单一证明陈述、直接 owner、最小原生入口和独立执行边界。
- [x] 0.3 确认 catalog 由 `scripts/lib/vibe-gate.ts` 的 TypeScript 常量承接，新语义 Check 使用新稳定 ID；generated/distribution tests 保持原 profile，身份演进通过 Gate Decision Record 维护。
- [x] 0.4 审阅 `cache-vibe-gate-script-results`，确认本 Change 只提供后续语义 Check ID 与入口边界，不实施或复制缓存策略。

## Implementation

- [x] 1.1 在 Vibe Gate owner 建立最小语义 Check catalog，并以类型/测试约束每条记录的 ID、显示名、固定命令和 profile；证明陈述与 owner 留在稳定 ID、测试选择和工具链说明，不复制成运行时字段。
- [x] 1.2 为 Change Plan、Decision Records、Task Graph、Investigation Report 与 Test Evidence 建立对应 catalog 投影和可直接重跑的 package-script/test runner 入口；保持一个 Check 内只含同一完整契约的现有测试文件。
- [x] 1.3 重构 Test Evidence 测试容器，使 catalog 自身 cases 与 ledger cases 可分别选择；更新总 runner，确保每个保留最小原生入口仍恰好执行一次且不改变 case 身份。
- [x] 1.4 将 index runtime、relation graph、version control、Task Graph native runtime/store 和 repository tooling 保持为独立基础 Check；代码消费关系只进入验证选择和后续缓存失效，不建立阻止独立测试结算的 Gate 依赖。
- [x] 1.5 从 catalog 派生 default/full Check 集合、Vibe definition、machine-publication identity 与诊断重跑命令；保持拆分前的 profile 测试覆盖，full 继续包含 default 与原 full-only 完整验证。
- [x] 1.6 重建 release terminal：使 version/hash 检查在 `pack:skills` 前由显式依赖守卫，所有 required Check 可信通过后仅调用一次 packaging，并保留可定位失败结果。
- [x] 1.7 更新 package 配置 validator、Vibe Gate tests、CI 或维护命令，使它们不维护第二份 Check 列表，并验证旧 ID 的兼容映射或有意演进。
- [x] 1.8 更新 `docs/tooling.md` 与实际受影响的 skill/references，说明 catalog owner、profile/release 语义、稳定 ID、直接重跑路径和非性能分组原则；不把缓存设计写入本 Change 的长期规则。
- [x] 1.9 为新增或保留的测试入口维护 `docs/test-evidence/` case，更新受控 topic 表（仅责任实际变化时）并同步派生索引；按门槛创建或演进 Decision Record。

## Verification

- [x] 2.1 运行每个新语义 Check 的直接命令，验证其只选择 catalog 声明的入口，并对照 test-evidence cases 确认所有保留最小原生入口恰好一次。
- [x] 2.2 运行 Vibe Gate 定义与 CLI tests，验证 Check ID 唯一稳定、machine publication 可按 catalog 映射、显示/调度不改变语义，且 default/full 只按交付层级区别。
- [x] 2.3 注入或复用 fixture 验证 shared/version-control、pending-stage、CLI/协议、事务恢复、生成物和 native runtime 的失败分别归到正确 owner；确认不可用环境不会伪装为领域失败。
- [x] 2.4 运行 release prerequisite 与 packaging tests，验证 version/hash → `pack:skills` 依赖顺序、前置失败不启动打包、全部通过时只执行一次。
- [x] 2.5 运行 `bun run check` 与 `bun run check --full --baseline-ref <validated-ref>`，再运行本仓库要求的 generated artifact、test-evidence、decision 与 Change checks；记录未能运行的环境边界。
- [x] 2.6 比较拆分前后 catalog 的唯一入口选择次数与依赖图，确认没有无真实共享理由的重复测试；仅将运行时间作为防退化观测，不以时间决定验收。
- [x] 2.7 人工审阅 catalog、文档和 case，使新的 AI 消费者无需依赖隐含耗时分组即可恢复用途、范围、owner、依赖、profile 与 release 边界。
