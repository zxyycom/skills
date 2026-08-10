# Tasks

本清单按“复核最新事实 → 建立源码依赖 → 调整生成 → 更新 owner → 闭合证据”实施。除非任务明确要求并行，按编号顺序执行；完成出口是直接调用与 CLI 共享领域事实源且现有外部行为不变。

## Readiness

- [x] 0.1 已读取 task-000002、仓库模型、导航、工具链、编码规范、task-graph owner、Change Plan 契约及相关活动决策，并核对当前 Worktree 与中央 task graph 状态。
- [x] 0.2 已审计当前可分发工具的 CLI、领域 operation、直接 import、声明源和生成入口；确认统一责任边界跨多个工具，但首批只实施 task-graph。
- [x] 0.3 已确认 task-graph 的真实路径是 CLI dispatch 直接调用 Service/engine，现有差距是 `cli.ts` 同时承担领域 re-export 与声明根；目标、非目标、兼容边界和成功标准在三个 artifacts 中一致。
- [x] 0.4 已把 argv 表示校验、领域校验、raw result、CLI envelope/renderer、声明生成和稳定性含义分别归属到明确 owner；没有阻塞实施的开放问题。
- [x] 0.5 已识别 `support-explicit-task-ids`、`add-task-tags-and-find` 与中央 task-000037 等并行事项，并要求实施前从最新集成基线复核其当前阶段、状态和 diff，再串行合并生成物；实施不依赖本次对话恢复范围。

## Implementation

- [ ] 1.1 从最新集成基线复核 `cli/index/service`、构建器、`publicRuntimeExports`、相关决策和已知并行事项；若事实已经变化，先更新本 Change 的事实与兼容基线，不吸收并行领域功能。
- [ ] 1.2 更新 `docs/coding-style.md` 与 `docs/tooling.md`：领域实现是 CLI 和直接 import 的唯一行为事实源，直接入口只组合导出，CLI 只适配外部表示与输出，生成声明本身不建立独立 SDK 稳定性、版本或第二套契约。
- [ ] 1.3 新增 task-graph 分发组合入口 `entry.ts`，把主模块启动从 `cli.ts` 移到该入口；让 `index.ts` 拥有领域导出，让 `cli.ts` 只公开 runner/options，并保持 `publicRuntimeExports` 基线不变。
- [ ] 1.4 调整 `scripts/build/task-graph.ts`，从 `entry.ts` 构建 MJS 和编译可达声明闭包；确保根声明、CLI 声明和领域声明均来自实现，且 stale/internal/external 声明仍被拒绝。
- [ ] 1.5 更新 task-graph 源码、CLI、生成分发和 consumer 测试：证明源码/生成模块 import 无副作用、真实 Node CLI 仍启动、runtime export 集合不变、声明从正确入口可达，并覆盖读取、mutation 与领域 failure 三种直接/CLI 等价性。
- [ ] 1.6 更新 `skills/task-graph/SKILL.md`、`docs/skills/task-graph.md` 与 task-graph skill 版本，明确直接调用跳过进程、argv 与序列化，SDK 不拥有独立模型、规则、便利协议、版本或稳定性承诺。
- [ ] 1.7 创建自包含的 task-graph 后继候选决策，以“修订”关系替代 `derive-sdk-declarations-from-runtime-source.md` 的 CLI-root 判断，并通过 decision-records 关系事务建立、同步和严格检查。
- [ ] 1.8 按 `test-evidence-review` 契约更新每个新增或修改的最小原生测试入口对应 case，并同步统一派生索引；不把聚合容器或内部断言记录为独立 Test。
- [ ] 1.9 运行 task-graph 同步入口生成 MJS、source map、声明树和同批次 Schema；Schema 预期内容不变。审阅 Git diff 只包含本 Change 需要的 owner、源码、生成物、决策与证据变化。

## Verification

- [ ] 2.1 运行 task-graph 原生行为测试与真实 Node native 测试；确认固定 clock 下读取结果的 `revision`/`data` 相等，相同 request 与固定 clock 在独立同构 workspace 产生相等的 mutation 领域结果和规范化索引，领域 failure 的 direct/CLI error code 相等。
- [ ] 2.2 运行 `bun run check:task-graph-cli` 并编译独立 consumer，确认生成 bundle、source map、声明闭包、Schema 与 runtime export key 无漂移或缺口。
- [ ] 2.3 运行 decision-records 严格检查、test-evidence 严格检查及受影响索引同步检查，确认后继决策关系和测试证据闭合。
- [ ] 2.4 运行 `bun run typecheck`、`bun run validate` 与 `bun run check --full`，记录实际通过项；若 full 门禁受无关并发变化阻断，保留精确诊断且不降低本 Change 的局部验证。
- [ ] 2.5 对最终 runtime exports、CLI help/protocol version、raw result、错误码、skill 内容版本与 owner 文本做语义复核，确认两个版本 owner 未混淆，也没有引入逐命令 SDK、独立接口版本、稳定性承诺或其他工具迁移。
- [ ] 2.6 仅依据 proposal、design、tasks 及其中链接的稳定 owner 做一次实施阅读复核：实施者能够恢复三入口依赖、校验归属、生成方式、兼容边界、并发处理和完成证据，不再需要本次对话补充判断。
