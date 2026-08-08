---
name: change-plan
description: >-
  创建、查询、推进、搁置、恢复、审阅或归档可持久保存和交接的 change 计划。
  用于用 proposal.md、design.md、tasks.md 和 .change-plan.json 维护明确 change
  的目标、设计、任务、验证与当前生命周期阶段。
metadata:
  version: "4"
---

# Change Plan

## 目标

让一个明确 change 从可持续改写的 draft 收敛为已确认 plan，再进入 implementation；计划退出当前实施主线时能够被机械识别、显式 shelve，并在 resume 后重新审阅。Active Change 使用可版本化的阶段元数据；归档会保留整个 Change 目录作为历史，但不再把其中的 metadata 解释为 active stage。

结构检查和阶段命令只证明固定机械条件，不表示方案已经获得实施或归档授权。内容审阅、开放问题、项目约定和当前任务授权仍由执行者确认。

## 使用条件

1. 用户明确要求创建、查询、更新、推进、搁置、恢复、审阅或归档一个持久 change 计划时使用。
2. 工作将跨越多个文件、owner 或验证阶段，需要在对话之外保存范围、顺序、阶段和交接信息时使用。
3. 只需要当前对话中的简短步骤、仍在探索问题、维护长期决策、更新稳定事实 owner，或已经明确要求直接完成一个局部改动时，不创建 change 计划。

## 内容 owner

1. 本文件承接触发、上下文恢复、内容写作、阶段推进、语义审阅和授权门禁。
2. [固定结构与 CLI 契约](references/change-plan-contract.md) 唯一承接 change 目录、`.change-plan.json`、artifact 结构、阶段与 assessment、Git 距离规则、命令门禁和退出码；操作 Change 前完整读取。
3. `scripts/change-plan.mjs` 承接固定契约的机械实现，不判断目标、方案、事实、长期决策、验证证据或授权是否正确。
4. 项目文档继续拥有当前稳定事实和行为；项目已有长期决策 owner 时，跨 change 持续有效的理由与方向进入该 owner。Change plan 只拥有当前 change 的临时实施上下文。

## 工作流程

### 1. 定位或建立 Change

1. 读取目标工作区指令和与 change 直接相关的事实 owner；项目已有决策、调查或测试证据入口时，只读取当前范围需要的材料。
2. 将用户目标压缩成一句结果说明，并确定范围、非目标、成功标准和受影响 owner。
3. 使用用户指定的 change 目录；未指定时遵循项目已有约定，项目没有约定时使用 `changes/<kebab-case-name>/`。
4. 需要从现有 Change 中选择目标时先运行 `list`。同名 active 目录已存在时运行 `show`，按其 stage 和 assessment 继续，不覆盖尚未纳入当前请求的内容。
5. 新建 active Change 时，先写入 stage 为 `draft` 的 `.change-plan.json` 和最小 `proposal.md`。目标、范围或会改变 public contract、架构边界、兼容性和验收的关键选择无法可靠判断时，只询问这一项。

### 2. 从 Draft 收敛到 Plan

1. Draft 的 proposal 只需说明 change 目标、`Why` 和 `Outcome`；在方向未稳定时持续修订这些内容，不预填没有执行价值的细节。
2. 准备确认 plan 时，补全 proposal 的范围、成功标准和 owner；按固定结构写 design，区分事实、约束、当前 change 判断、风险与开放问题；按固定结构写 tasks。
3. Tasks 的 `Readiness` 位于实施任务之前，至少确认三个 artifacts 指向同一目标、owner 准确、重要假设显式且开放问题不阻塞实施。`Implementation` 和 `Verification` 使用唯一层级数字 ID，并分别覆盖产物与证据。
4. 只有存在实际完成证据时才勾选任务。确认 plan 前必须完成全部 Readiness，且 Implementation 和 Verification 中都不能已有勾选项。
5. 先提交三个 artifacts，使其内容与当前 `HEAD` 一致，再运行：

   ```text
   node <change-plan-cli> plan <change-directory>
   ```

   `plan` 通过门禁后把当前 `HEAD` 记录为 `baseCommit`。阶段命令产生的 metadata 变更按项目版本控制流程保存。

### 3. 查询并处理 Plan 状态

1. 在项目根目录运行 `list`，用 `show <change-directory>` 展开单个 Change，用 `check <change-directory>` 检查当前阶段。相对路径均相对 shell 当前工作目录解析；机器消费时追加 `--json`。
2. 对 active plan 按 assessment 采取动作：
   - `current`：计划内容仍匹配确认基线，可以运行 `implement`。
   - `shelve-candidate`：项目演进距离已经命中固定规则；复核后仍准备实施时重新运行 `plan` 更新基线，接受机械判定为已搁置时运行 `reconcile`，另有明确暂停原因时运行 `shelve --reason <text>`。
   - `plan-review-required`：计划尚未确认、基线不可用或 artifacts 已变化；重新审阅并提交 artifacts，再运行 `plan`。
   - assessment 不可用：版本控制查询失败；先按 `version-control-failed` 诊断恢复仓库访问或 Git 状态，不把操作故障当作计划需要复核。
3. `list`、`show` 和 `check` 只发现并报告 assessment，不改变 stage。`reconcile` 只接受 `shelve-candidate`。
4. 确认计划需要明确暂停时运行：

   ```text
   node <change-plan-cli> shelve <change-directory> --reason <text>
   ```

5. Shelved Change 恢复时先运行 `resume`。它返回 `baseCommit: null` 的 plan；重新核对目标、当前事实、依赖、风险和任务，提交更新后的 artifacts，再运行 `plan`。Shelved Change 不能直接进入 implementation。

### 4. 实施与更新

1. 对 assessment 为 `current` 的 plan 运行 `implement <change-directory>`，再按 tasks 的依赖顺序实施和验证。
2. 目标或范围变化时先更新 proposal，再同步 design 和 tasks；方案变化时更新 design，并调整受影响任务和验证。
3. 新发现只影响本次实施时进入 design 或 tasks；改变稳定事实时更新对应项目 owner；形成跨 change 长期方向时交给项目已有决策 owner。
4. 额外说明或交付证据可以作为附加文件放在 change 目录中，但不能代替当前 stage 要求的 artifacts。

### 5. 完成与归档

1. 归档前逐项确认 proposal 的成功标准已经满足，稳定事实 owner 已同步，design 的开放问题不阻塞完成，tasks 的勾选有实际实施与验证证据。
2. 完成语义审阅并获得当前任务的归档授权后运行：

   ```text
   node <change-plan-cli> archive <change-directory>
   ```

3. `archive` 只接受结构有效、处于 implementation 且全部任务完成的 active Change，并移动到无冲突的 `archive/<change-name>/`。
4. 已归档 Change 只作为历史参考；CLI 不提供 restore。后续工作需要新计划时创建新的 active Change，不直接改写归档历史。

## 完成标准

1. Active Change 拥有合法 `.change-plan.json`，stage 与当前 artifacts、任务进度和实际工作状态一致；archived Change 位于固定历史目录，其保留的 metadata 只作为历史内容而不产生 stage。
2. Draft 能清楚表达方向；plan 的 proposal、design 和 tasks 通过完整结构与 Readiness 门禁，且具有已确认的 Git 基线。
3. 查询结果能够区分 status、stage 和 assessment；查询不自动改变候选，`reconcile` 以 Git 距离证据搁置，`shelve` 以明确原因搁置，resume 后重新确认 plan。
4. 实施完成时，成功标准、稳定 owner、长期决策和验证证据已同步，所有任务勾选均有事实支持。
5. 结构检查、语义审阅、实施就绪、阶段转换和归档授权分别汇报，不把任何机械成功误作内容批准。

## 交付

简要说明 change 名称、路径、status、stage 与 assessment，三个 artifacts 和 metadata 的当前作用，实际运行的 CLI 与检查结果，语义审阅结论，以及仍需用户确认或下游处理的事项。
