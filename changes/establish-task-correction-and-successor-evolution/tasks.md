# Tasks

本任务清单先复核集成基线与纠正矩阵，再按 state evidence、engine gate、CLI/SDK、稳定 owner、生成产物和测试证据顺序交付。`Implementation` 与 `Verification` 中的未勾选项都是尚未实施的目标工作，不能据此声称当前 runtime 已支持 `correct`。

## Readiness

- [x] 0.1 核对 proposal、design 与 tasks 指向同一目标，并明确未终态修正、错误终态纠正和正确完成后的后继演进是三条不同路径。
- [x] 0.2 盘点 content、control、parent、dependency、exclusion、execution、lease 与 result 在 idle、running、failed、succeeded、cancelled 的现有修改边界，并明确 candidate 是 control 而不是 execution phase。
- [x] 0.3 确认 task-000040 的语义 result 与 Git 版本锚点决策已进入当前基线；`correct` 不做 metadata-only result update、不保存 commit SHA，也不接管 stage/commit。
- [x] 0.4 确认 `correct` 只接受 succeeded/cancelled，要求 expected revision 与 reason，不接受 lease，固定转为 paused idle，追加 previous terminal evidence，并在完整事务内拒绝 terminal ancestor 与 non-idle effective dependent。
- [x] 0.5 确认普通 mutation、failed retry、lease release/recover、cancel、complete 与 successor task 的职责不变；没有阻塞实施的 plan-level 开放问题或待用户选择项。
- [x] 0.6 识别 task-graph source、生成产物、行为说明、长期决策、原生测试和 test-evidence owner，并确认实施任务 `task-000044` 需与 explicit-ID 及 tags/find Change 串行。
- [x] 0.7 仅依据三个 artifacts 重演代表性选择：idle/failed 普通修正、running lease 收敛、错误终态 correct、正确完成后新建 task；实施者无需本次对话即可恢复状态路由、纠正顺序、窄 evidence 边界和 owner 分工。

## Implementation

- [ ] 1.1 通过中央实施任务 `task-000044` 同步最新 task graph 与集成主线，确认 task-000040 的 result/version-anchor 契约仍在基线、没有其他执行者占用 task-graph 核心 owner，并重新确定当前 CLI minor、skill version 与重叠 Change 的串行顺序；事实变化会改变本设计时先返回 plan 复核。
- [ ] 1.2 在 `types.ts` 与 `schema.ts` 增加 `TaskTerminalCorrection`、optional-nonempty `state.terminalCorrections`、canonical serialization 和语义校验，保存 source revision、timestamp、reason、previous control、succeeded/cancelled execution 与配对 result，保持 Schema v2 旧 index 可读。
- [ ] 1.3 在 engine 与 graph owner 中实现单 task `correctTask`：校验 expected revision、标准 1–1000 code-point reason 与 terminal phase，在锁内重算 ancestors 和全部 effective dependents，要求 ancestors 非终态且 dependents 全部 idle；有影响时以 `STATE_CONFLICT` 一次返回两个确定排序的 blocker 集合，否则原子追加 evidence、清除 current result、保留 attempt 并写入 paused idle，最后通过完整 index 校验。
- [ ] 1.4 在 service、公开 exports 与 CLI 增加 `correct <task-id> --expected-revision <n> --reason <text>`，拒绝 lease、陈旧 revision、非终态和歧义参数，固定返回 `{ taskId, phase, control, correctedFrom, correctionCount }`，并把命令纳入 mutation-runtime help catalog 和协议测试。
- [ ] 1.5 复核 update-content、update-control、relations、claim、release、complete、fail、retry、cancel、remove、show/list 与 staging 对 optional evidence 的保留语义；只在现有 owner 不能自然保留或完整校验 evidence 时做最小修正，不扩大 renderer 或 apply operation。
- [ ] 1.6 更新 `skills/task-graph/SKILL.md` 与 `docs/skills/task-graph.md`，用当前行为矩阵说明 running 先 release、failed 用 retry、terminal 用 correct、correct 后先修正再显式 control，以及正确完成后创建 successor task；同步当前 CLI protocol minor 和 skill metadata version。
- [ ] 1.7 新增自包含 task-graph 长期决策，保存 paused terminal correction、窄 evidence、ancestor/dependent gate、current result/version anchor 和 successor task 选择；按实施时事实判断是否需要正式演进关系，使用 decision-records 生命周期命令建立并同步索引，不手改派生索引。
- [ ] 1.8 运行现有 task-graph 生成入口，同步分发 MJS、source map、SDK declaration tree 与 task index JSON Schema；复核生成差异只来自 source 与稳定 owner，并让重叠 Change 以后续 minor/version 重新基线化。

## Verification

- [ ] 2.1 用最小原生 Schema 测试证明既有无 evidence 的 Schema v2 index 仍 canonical，optional-nonempty correction records 严格校验 previous phase/result 配对、source revision/时间顺序、未知字段和 round trip。
- [ ] 2.2 用最小原生 lifecycle 测试证明 succeeded 与 cancelled 都能在最新 revision 下 correct 为 paused idle、attempt 保留、current result 清空、previous control/execution/result 与 reason 追加且重复纠正不覆盖旧 evidence；idle/running/failed、空原因和 stale revision 原子拒绝。
- [ ] 2.3 用最小原生 graph/lifecycle 测试证明 terminal ancestor、direct/inherited non-idle dependent、活动/恢复 lease 和父子完成证据阻止 correction；`STATE_CONFLICT` 同时报告确定排序的 `terminalAncestors` 与 `nonIdleDependents`，相关 task 按自身生命周期收敛到 idle 后 correction 成功，dependency projection 立即阻塞 dependent，其他受保护 topology 仍不可改写。
- [ ] 2.4 用最小原生流程测试证明 correct 后普通 content/relations 可以修正但 task 保持 paused，显式 update-control 后才能 claim/parent complete；retry 仍只接受 failed，release 仍要求当前 lease，complete 写入新 current result 并保留全部 earlier evidence。
- [ ] 2.5 用 CLI、service、公开 source exports、生成 SDK 与分发 bundle 测试证明 help、runtime 前置、参数拒绝、success/error JSON envelope、公开 types 和实际 correction 结果一致，根 help protocol command count 与 minor version 同步。
- [ ] 2.6 用 staging 与 Git 边界测试证明 selected corrected task 保留完整 evidence 与 current result 语义，mutation 不自动 stage/commit、不要求旧终态已提交，也不改写或虚构版本锚点；后续 correction/new-terminal anchor 仍由调用方提交 task index 形成。
- [ ] 2.7 修订现有 `TASK-GRAPH-RETRY-001` 及对应原生测试，使其继续证明 retry 与普通 mutation 不能重开终态；为每个新增或拆分的最小原生测试入口新增唯一 task-graph case，并用统一命令同步派生 test-evidence index。
- [ ] 2.8 运行受影响的 task-graph 原生测试、`bun run check:task-graph-cli`、`bun run check:task-graph-index`、skill validator、decision-records 严格检查与 test-evidence 严格检查，确认 source、Schema、CLI、SDK、生成物、稳定说明和决策一致。
- [ ] 2.9 运行 `bun run check --full`，逐项复核 proposal 成功标准、全部任务证据、版本与重叠 Change 协调状态；确认没有引入 generic amend、force/cascade correction、result metadata edit、通用 event log 或 successor relation 后再申请归档。
- [ ] 2.10 仅向未参与设计的实施审阅者提供三个 artifacts 及其指向的稳定 owner，验证其能恢复当前/目标状态、五路生命周期选择、`correct` 输入输出、影响收敛顺序、窄 evidence 与 Git 边界、后继任务规则和完成证据；任何仍需对话补充的产品判断都先返回 plan 修订。
