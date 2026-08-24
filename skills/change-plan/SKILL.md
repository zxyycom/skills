---
name: change-plan
description: >-
  创建、查询、审阅或归档可持久保存和交接的 Change 计划。用于用 proposal.md、
  design.md、tasks.md 和 .change-plan.json 维护明确 Change 的目标、设计、任务、
  验证、draft/plan active stage 与 archived 目录状态。
metadata:
  version: "19"
---

# Change Plan

## 目标

让一个以明确 `Outcome` 组织的 Change 从可持续改写的 Draft 收敛为 Plan，在 Plan 内完成准备、
实施与验证，并在完成后归档。固定 artifact 结构以 `Intended Change` 记录为实现 `Outcome`
采用的预期调整，以 `Resulting Impacts` 记录由该调整产生且实现 `Outcome` 必须处理的影响；design
和 tasks 将两者落实为同一生命周期中的决定、工作与验证。Draft 与 Plan 表达内容成熟度，tasks
的 checkbox 表达 Plan 内进度，archived 目录 status 表达完成后的历史结果。
机械检查只作用于 active Change；归档前由 `archive` 完成最后一次 Plan 门禁，归档后只保留发现和
原始读取能力，不再按后续契约重新判断历史内容。

Change artifacts、机械检查、内容审阅和当前任务授权分别提供不同证据。CLI 成功只证明固定
机械条件成立；开始实施和归档仍以当前任务授权及执行者的语义判断为准。

## 使用条件

1. 用户明确要求创建、查询、更新、审阅或归档一个持久 Change 计划时使用。
2. 工作跨越多个文件、owner 或验证阶段，需要在对话之外保存范围、设计、任务进度和交接信息时使用。
3. 当前对话中的简短步骤、尚未形成实施 Change 的探索、长期决策和稳定事实分别留在当前任务或对应 owner；已经明确要求直接完成的局部改动不因存在本 skill 而自动建立 Change。

## 内容 owner 与读取路径

1. 本文件承接触发、上下文恢复、内容写作、Plan 内任务推进、语义审阅和授权门禁。
2. [固定结构与 CLI 契约](references/change-plan-contract.md) 唯一承接 Change 目录、`.change-plan.json`、artifact 结构、合法 stage、严格 active metadata、Git 距离、六个命令、结构化输出和退出码。操作 Change 前完整读取。
3. `scripts/change-plan.mjs` 实现固定契约，也允许直接 import 当前底层函数；这些导出是随当前实现变化的复用表面，不是稳定 SDK。脚本不判断目标、方案、事实、长期决策、验证证据或授权是否正确。
4. 项目文档继续拥有当前稳定事实和行为；项目已有长期决策 owner 时，跨 Change 持续有效的理由与方向进入该 owner。Change Plan 只拥有当前 Change 的临时实施上下文。

## 工作流程

`plan` 与 `archive` 是受信工作区中的维护写入。命令运行期间，由当前任务保持目标 Change、
其 Change 根和 archive 路径的命名空间稳定，不与其他操作者或进程并发移动、替换或归档同一目标。

### 1. 定位或建立 Change

1. 读取目标工作区指令、固定契约以及与 Change 直接相关的事实 owner；项目已有决策、调查或测试证据入口时，只读取当前范围需要的材料。
2. 将用户目标压缩成一句 `Outcome`，确定预期调整，并从事实 owner 与现有依赖恢复由该调整产生且实现 `Outcome` 必须处理的影响，据此确定范围、非目标、成功标准和受影响 owner。具有独立 `Outcome` 或生命周期的事项建立独立 Change。
3. 使用用户指定的 Change 目录；未指定时遵循项目已有约定，项目没有约定时使用 `changes/<kebab-case-name>/`。
4. 需要选择现有 Change 时先运行 `list`；目标确定后运行 `show`。Active Change 根据 stage、任务进度、诊断和距离证据恢复当前上下文；archived Change 只读取历史 artifacts，不把其中内容恢复为当前 Plan 或重新校验。
5. 新建 active Change 时，按固定契约写入 Draft metadata、最小 `proposal.md` 和初始 `design.md`，暂不创建 `tasks.md`。目标、范围或会改变 public contract、架构边界、兼容性和验收的关键选择无法可靠判断时，只确认会改变结果的最小问题。

### 2. 将 Draft 收敛为 Plan

1. Draft proposal 说明 `Why` 与 `Outcome`；初始 design 保存当前上下文、目标、设计方向、取舍与开放问题。两者可以持续修订，暂定选择保持显式。
2. 准备形成 Plan 时，按固定契约在 `Scope` 与 `Decisions` 中分别填写 `Intended Change` 和 `Resulting Impacts`；补全成功标准和受影响 owner，再从 design 派生 `tasks.md`，使 Implementation 与 Verification 覆盖预期调整和必要影响。所有任务继续使用同一进度模型。
3. Readiness、Implementation 与 Verification 共同表达 Plan 内进度。只按实际证据勾选任务，并在目标、设计或新事实变化时同步修订相应 artifacts。
4. 三个 artifacts 已经能够作为 Plan 使用时，运行：

   ```text
   node <change-plan-cli> plan <change-directory>
   ```

   `plan` 记录命令运行时的 `HEAD` 并写入规范 Plan metadata；当前 checklist 进度如实保留在
   `tasks.md`，不产生另一 stage。成功后按项目版本控制流程保存三个 artifacts 与 metadata。

### 3. 在 Plan 内实施、查询与复核

1. 按 tasks 的依赖顺序完成 Readiness、Implementation 与 Verification。新发现的必要影响同步进入 proposal 与 design 的 `Resulting Impacts` 及 tasks；预期调整变化时同步 `Intended Change`，预期结果变化时同步 `Outcome` 与 Goals。方案变化时更新 design 和受影响的任务与验证。
2. 使用 `show` 恢复 active Change 或读取 archived 历史，使用 `check` 门禁单个 active Change，使用 `list` 发现 active 与 archived 集合，使用 `check-all` 门禁全部 active Change。`check` 不接受 archived 路径；`--archived` 与 `--all` 只属于 `list`。查询命令只报告结果；写入只由显式 `plan` 或 `archive` 完成。
3. Plan 距离可用时，根据从 `baseCommit` 到当前 `HEAD` 的 first-parent 提交数和 Change 目录外累计变化行数判断复核深度。零距离只表示自计划基线以来未统计到 Change 目录外的项目变化；非零距离表示继续前需要确认这些项目变化未影响当前计划。可用距离本身不阻断检查或归档。
4. Plan 基线不可追溯时，重新审阅当前 Plan 后运行 `plan` 刷新基线；版本控制查询失败时，先恢复仓库访问或 Git 状态，再执行同一审阅路径。现有 Plan 主动刷新基线时也先完成语义复核。
5. Active metadata 只接受固定契约中的规范 Draft 与 Plan。目录存在但 metadata 无效时仍可由集合查询发现，但 stage 不成立且检查失败；先通过普通文件与版本控制流程显式修复 metadata，再进入正常 `plan` 或 `archive` 流程。
6. 新发现只影响本次实施时进入 design 或 tasks；改变稳定事实时更新对应项目 owner；形成跨 Change 长期方向时交给项目已有决策 owner。附加说明和证据可以放在 Change 目录，但不能替代固定 artifacts。

### 4. 完成并归档

1. 逐项确认 proposal 的成功标准已满足，稳定事实 owner 已同步，design 的开放问题不阻塞完成，所有 task 勾选都有实际实施与验证证据。
2. 完成语义审阅并获得当前任务的归档授权后运行：

   ```text
   node <change-plan-cli> archive <change-directory>
   ```

3. 归档成功后，整个目录进入同级 `archive/<change-name>/` 并作为历史参考；checker 不再读取或判断其中的 metadata、artifact 结构、任务与 Git 基线。后续工作需要新计划时建立新的 active Change。
4. 对不再实施的 active Change，先判断其内容是否仍有独立价值，并把稳定事实、长期方向或调查结果交给对应 owner。只有当前任务已经明确授权删除该具体 Change 时，才按项目的文件系统与版本控制流程移除整个 Change 目录；随后运行 `list`，确认它不再作为 active member 出现。

## 完成标准

1. Draft 或 Plan 的 artifacts 共同表达同一 `Outcome`；`Resulting Impacts` 中的每项影响都能回溯到 `Intended Change`，并符合固定结构；active metadata 表达当前内容成熟度，archived 目录 status 只表达历史结果。
2. Plan 内每项任务的状态都有事实支持，成功标准、稳定 owner、长期决策和验证证据已按实际结果同步。
3. Active Change 查询中的任务进度、Git 距离或阻断诊断已得到处理，metadata 已通过严格规范解析；archived Change 的查询错误已得到处理。无效 active 输入通过普通文件与版本控制流程显式修复，已授权删除的 active Change 已由 `list` 确认退出。
4. 机械检查、内容审阅、实施授权和归档授权在交付中分别说明，没有用 metadata、checkbox 或命令成功代替授权。

## 交付

简要说明 Change 名称与路径、status 与适用的 stage、三个 artifacts 和 metadata 的当前作用；active
Change 另行说明任务进度、Plan 距离或基线诊断与检查结果，archived Change 明确说明只读取了历史内容。
同时说明实际运行的命令、语义审阅结论，以及仍需用户决定或下游处理的事项。
