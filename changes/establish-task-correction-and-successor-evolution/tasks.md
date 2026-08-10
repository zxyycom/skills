# Tasks

本任务清单保留 Change 搁置前确认的实施与验证顺序，不表示当前仍准备执行。Change 阶段以 [.change-plan.json](.change-plan.json) 为准，是否重新探索以[长期延期决策](../../docs/decisions/task-graph/defer-terminal-correction-until-confirmed-recovery-need.md)为准。`Implementation` 与 `Verification` 中的未勾选项没有实施，不是 backlog，也不能据此声称当前 runtime 已支持 `correct`。

## Readiness

以下勾选项只证明搁置前的方案审阅已经完成，不表示方案仍获准实施或当前事实仍与当时相同：

- [x] 0.1 搁置前：核对 proposal、design 与 tasks 指向同一目标，并明确未终态修正、错误终态纠正和正确完成后的后继演进是三条不同路径。
- [x] 0.2 搁置前：盘点 content、control、parent、dependency、exclusion、execution、lease 与 result 在 idle、running、failed、succeeded、cancelled 的修改边界，并明确 candidate 是 control 而不是 execution phase。
- [x] 0.3 搁置前：确认 task-000040 的语义 result 与 Git 版本锚点决策进入当时基线；旧方案中的 `correct` 不做 metadata-only result update、不保存 commit SHA，也不接管 stage/commit。
- [x] 0.4 搁置前：确认旧方案中的 `correct` 只接受 succeeded/cancelled，要求 expected revision 与 reason，不接受 lease，固定转为 paused idle，追加 previous terminal evidence，并在完整事务内拒绝 terminal ancestor 与 non-idle effective dependent。
- [x] 0.5 搁置前：确认普通 mutation、failed retry、lease release/recover、cancel、complete 与 successor task 的职责不变；当时没有未解决的 plan-level 设计选项。
- [x] 0.6 搁置前：识别 task-graph source、生成产物、行为说明、长期决策、原生测试和 test-evidence owner，并记录旧实施任务 `task-000044` 与 explicit-ID 及 tags/find Change 的串行关系；该任务现已取消，关系不可复用。
- [x] 0.7 搁置前：仅依据三个 artifacts 重演代表性选择：idle/failed 普通修正、running lease 收敛、错误终态 correct、正确完成后新建 task；当时的实施者无需本次对话即可恢复旧方案的状态路由、纠正顺序、窄 evidence 边界和 owner 分工。

## Implementation

以下未勾选项是旧方案的候选实施清单，当前不得执行。只有长期决策的重新评估条件全部成立、Change 已 `resume` 且重新确认 `plan` 后，才能按新计划决定保留、修改或删除这些条目。

- [ ] 1.1 恢复候选：若重新规划后仍决定实现，先新建当时适用的中央实施任务；已取消的 `task-000044` 不得复用。新任务同步最新 task graph 与集成主线，确认 result/version-anchor 契约、核心 owner 占用、当前 CLI minor、skill version 与重叠 Change，再决定后续顺序；事实变化会改变设计时先返回 plan 复核。
- [ ] 1.2 旧方案候选：在 `types.ts` 与 `schema.ts` 增加 `TaskTerminalCorrection`、optional-nonempty `state.terminalCorrections`、canonical serialization 和语义校验，保存 source revision、timestamp、reason、previous control、succeeded/cancelled execution 与配对 result，保持 Schema v2 旧 index 可读。
- [ ] 1.3 旧方案候选：在 engine 与 graph owner 中实现单 task `correctTask`：校验 expected revision、标准 1–1000 code-point reason 与 terminal phase，在锁内重算 ancestors 和全部 effective dependents，要求 ancestors 非终态且 dependents 全部 idle；有影响时以 `STATE_CONFLICT` 一次返回两个确定排序的 blocker 集合，否则原子追加 evidence、清除 current result、保留 attempt 并写入 paused idle，最后通过完整 index 校验。
- [ ] 1.4 旧方案候选：在 service、公开 exports 与 CLI 增加 `correct <task-id> --expected-revision <n> --reason <text>`，拒绝 lease、陈旧 revision、非终态和歧义参数，固定返回 `{ taskId, phase, control, correctedFrom, correctionCount }`，并把命令纳入 mutation-runtime help catalog 和协议测试。
- [ ] 1.5 旧方案候选：复核 update-content、update-control、relations、claim、release、complete、fail、retry、cancel、remove、show/list 与 staging 对 optional evidence 的保留语义；只在现有 owner 不能自然保留或完整校验 evidence 时做最小修正，不扩大 renderer 或 apply operation。
- [ ] 1.6 旧方案候选：更新 `skills/task-graph/SKILL.md` 与 `docs/skills/task-graph.md`，用目标行为矩阵说明 running 先 release、failed 用 retry、terminal 用 correct、correct 后先修正再显式 control，以及正确完成后创建 successor task；同步实施时的 CLI protocol minor 和 skill metadata version。
- [ ] 1.7 旧方案候选：新增自包含 task-graph 长期决策，保存 paused terminal correction、窄 evidence、ancestor/dependent gate、current result/version anchor 和 successor task 选择；按实施时事实判断是否需要正式演进关系，使用 decision-records 生命周期命令建立并同步索引，不手改派生索引。
- [ ] 1.8 旧方案候选：运行当时有效的 task-graph 生成入口，同步分发 MJS、source map、SDK declaration tree 与 task index JSON Schema；复核生成差异只来自 source 与稳定 owner，并让重叠 Change 以后续 minor/version 重新基线化。

## Verification

以下未勾选项是旧方案对应的候选验证，不是已经运行的证据；恢复时应随新设计重新取舍：

- [ ] 2.1 旧方案候选验证：用最小原生 Schema 测试证明既有无 evidence 的 Schema v2 index 仍 canonical，optional-nonempty correction records 严格校验 previous phase/result 配对、source revision/时间顺序、未知字段和 round trip。
- [ ] 2.2 旧方案候选验证：用最小原生 lifecycle 测试证明 succeeded 与 cancelled 都能在最新 revision 下 correct 为 paused idle、attempt 保留、current result 清空、previous control/execution/result 与 reason 追加且重复纠正不覆盖旧 evidence；idle/running/failed、空原因和 stale revision 原子拒绝。
- [ ] 2.3 旧方案候选验证：用最小原生 graph/lifecycle 测试证明 terminal ancestor、direct/inherited non-idle dependent、活动/恢复 lease 和父子完成证据阻止 correction；`STATE_CONFLICT` 同时报告确定排序的 `terminalAncestors` 与 `nonIdleDependents`，相关 task 按自身生命周期收敛到 idle 后 correction 成功，dependency projection 立即阻塞 dependent，其他受保护 topology 仍不可改写。
- [ ] 2.4 旧方案候选验证：用最小原生流程测试证明 correct 后普通 content/relations 可以修正但 task 保持 paused，显式 update-control 后才能 claim/parent complete；retry 仍只接受 failed，release 仍要求当前 lease，complete 写入新 current result 并保留全部 earlier evidence。
- [ ] 2.5 旧方案候选验证：用 CLI、service、公开 source exports、生成 SDK 与分发 bundle 测试证明 help、runtime 前置、参数拒绝、success/error JSON envelope、公开 types 和实际 correction 结果一致，根 help protocol command count 与 minor version 同步。
- [ ] 2.6 旧方案候选验证：用 staging 与 Git 边界测试证明 selected corrected task 保留完整 evidence 与 current result 语义，mutation 不自动 stage/commit、不要求旧终态已提交，也不改写或虚构版本锚点；后续 correction/new-terminal anchor 仍由调用方提交 task index 形成。
- [ ] 2.7 旧方案候选验证：修订现有 `TASK-GRAPH-RETRY-001` 及对应原生测试，使其继续证明 retry 与普通 mutation 不能重开终态；为每个新增或拆分的最小原生测试入口新增唯一 task-graph case，并用统一命令同步派生 test-evidence index。
- [ ] 2.8 旧方案候选验证：运行受影响的 task-graph 原生测试、`bun run check:task-graph-cli`、`bun run check:task-graph-index`、skill validator、decision-records 严格检查与 test-evidence 严格检查，确认 source、Schema、CLI、SDK、生成物、稳定说明和决策一致。
- [ ] 2.9 旧方案候选验证：运行 `bun run check --full`，逐项复核 proposal 成功标准、全部任务证据、版本与重叠 Change 协调状态；确认没有引入 generic amend、force/cascade correction、result metadata edit、通用 event log 或 successor relation 后再申请归档。
- [ ] 2.10 旧方案候选验证：仅向未参与设计的实施审阅者提供三个 artifacts 及其指向的稳定 owner，验证其能恢复重新确认后的当前/目标状态、生命周期选择、`correct` 输入输出、影响收敛顺序、窄 evidence 与 Git 边界、后继任务规则和完成证据；任何仍需对话补充的产品判断都先返回 plan 修订。
