# Tasks

本清单按“projection → graph/layout → renderer → CLI route → owner/生成同步 → 证据与集成验证”推进；实现、稳定 owner、生成产物和验证证据全部一致后才进入归档审阅。

## Readiness

- [x] 0.1 已核对 proposal、design、task-graph 行为 owner、`TaskGraphService.listTasks`、`TaskProjection`、CLI 输出路径和生成边界；当前事实与受影响 owner 一致。
- [x] 0.2 已固定实际 task ID、全量 list view、track/layer、blocker folding、run mutex、render context 和逐字节格式，且 `Open Questions` 无阻塞项。
- [x] 0.3 已固定输出路由：实际 `task list` 的默认协议结果使用 list renderer；合法 `--json`、help、version、其他 command 和全局参数 failure 使用 JSON serializer。
- [x] 0.4 已建立测试与证据 owner：projection 进入 graph/service tests，layout/renderer 使用独立测试入口，CLI route 进入 `cli.test.ts`，生成边界进入 `generated-artifacts.test.ts`，每个新增或改名的最小测试节点进入 test-evidence。
- [x] 0.5 已固定实施期协调边界：中央 mutation 继续使用当前稳定 CLI；待集成 CLI 只操作隔离数据，并在集成后的只读验证全部通过后切换。
- [x] 0.6 已通过 AI-ready 实施审计门禁：实现 agent 只读取本 change 与直接引用 owner，即可恢复 projection、输出路由、track/layer、folding、逐字节格式、源码/生成 owner、验证出口和协调切换条件；会随对话或当前工作区状态失效的过程性描述已经清除。

## Implementation

在任务 2.8 完成并确认协调入口已经切换前，中央 task 的 queue、claim、renew 和 complete 始终使用协调方当前已验证的稳定 CLI 及 compatible runtime；待集成 CLI 只操作隔离数据，不修改中央权威 index。

- [x] 1.1 在 `tools/task-graph/src/service.ts` 及公开导出链路中用 `TaskListItem` 直接替换 `TaskSummary`；按 design 复用 `TaskProjection`，增加 title、parentId、phase，不保留旧 alias，并返回实际 task ID 字典。
- [x] 1.2 在 task-list 专属模块实现纯 layout：按 `targetTaskId` 折叠显示 endpoint，计算 track、dependency layer、parent path、track label 和稳定 node 顺序，不把任何派生值写回 projection。
- [x] 1.3 实现 node 显示投影与 success/failure renderer：按 design 固定摘要、字段选择、blocker folding、reason escaping、inline/block form、section 间隔和末尾 LF。
- [x] 1.4 实现 run mutex：规范化并对称去重 effective exclusion pair，按左 endpoint 分组，输出 inline/block group，并从 `exclusion-running` blocker 派生 node mutex 与 `mutex-blocked` 计数。
- [x] 1.5 重构 CLI 输出阶段：解析独立且不可重复的全局 `--json`，传递明确 route kind，区分实际 `task list`、meta command、其他 command 和 global failure，并按内部注入值、TTY columns、`80` 回退建立 render context。
- [x] 1.6 更新 help、公开导出与声明源；把 `taskGraphVersion` 从 `2.0.0` 提升到 `3.0.0`，只公开 `TaskListItem` 等领域 API，不把 renderer、render context、track、layer 或 folded token 扩展为公开领域状态。
- [x] 1.7 更新 `skills/task-graph/SKILL.md`、`docs/skills/task-graph.md` 和达到门槛的 task-graph 决策记录，使默认 list、raw `--json`、track/layer、folding、run mutex 与 breaking change 成为稳定 owner 当前事实。
- [x] 1.8 新增或调整 projection、layout、renderer、mutex、failure 与 CLI route 测试；更新 `docs/test-evidence/test-evidence-topics.json` 的 CLI 责任描述，为每个新增或改名的最小 `test()` 入口维护独立 case，并同步派生索引。
- [x] 1.9 把 `skills/task-graph/SKILL.md` 的 `metadata.version` 从 `5` 提升到 `6`，再通过 `scripts/build/task-graph.ts` 单向生成 ESM、source map、公开声明和声明树；不手改 `skills/task-graph/scripts/`。

## Verification

- [x] 2.1 以空图、孤立 task、单链、分支、汇合、跨 parent dependency、多层 parent 和终态 task 验证 endpoint folding、track/layer、parent path、实际 task ID、每 task 一次、每个 parent/dependency/exclusion endpoint 可定位和稳定排序。
- [x] 2.2 对 success 摘要、track、inline node、block node、`RUN MUTEX` 和 failure 做逐字节断言；覆盖注入 columns `79`/`80`、TTY columns、非 TTY `80` 回退、四个以上显示 item、深 parent、中文、emoji、长 title、section 单空行与单末尾 LF。
- [x] 2.3 验证 display folding：普通 incomplete/control blocker 不重复，terminal/hierarchy blocker 按 kind 与 related task ID 出现，非空 control reason 使用 `JSON.stringify` 且不改变物理行。
- [x] 2.4 以无 exclusion、对称重复、继承来源重复、同/跨 track pair、密集 pair、running endpoint 和 recovery-needed endpoint 验证 mutex 规范化、分组、active token 和摘要计数。
- [x] 2.5 验证输出路由矩阵：默认 `task list`、合法 `--json` 前后位置、默认 `task list --help`、version、其他 command、已识别 list 的 command-local failure、该 failure 加合法 `--json`，以及重复或带值 `--json` 的 global JSON failure；核对 stdout/stderr 与退出码。
- [x] 2.6 验证程序化 `listTasks()`、JSON serializer 和内部 renderer 消费同一 projection；JSON 保留 effective control/reason、关系来源、继承路径和完整 blockers，不包含 layout 派生值；公开声明导出 `TaskListItem` 且不再导出 `TaskSummary`。
- [x] 2.7 运行 `bun run sync:task-graph-cli` 和 `bun run sync:test-evidence-catalog` 同步派生产物，再运行 `node skills/change-plan/scripts/change-plan.mjs check changes/render-task-list-as-layered-dag --json` 与 `bun run check --full`；记录实际结果并确认没有生成漂移或未跟踪打包产物。
- [ ] 2.8 改动集成到中央 checkout 后，从中央入口确认 compatible runtime、无生成漂移，并对默认 `task list` 与 `task list --json` 做只读 smoke check；全部通过后才把后续中央 mutation 切到新版本。
