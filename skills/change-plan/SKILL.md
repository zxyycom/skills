---
name: change-plan
description: >-
  创建、查询、更新、审阅或归档可持久保存和交接的 change 计划。用于把一个
  明确 change 的原因、目标、范围、设计判断、开放问题、实施任务和验证任务
  整理为 proposal.md、design.md 与 tasks.md，并用随包 CLI 管理基础生命周期。
metadata:
  version: "2"
---

# Change Plan

## 目标

为一个准备实施的明确 change 建立可版本化、可审阅和可交接的临时计划，使后续实现者能够恢复为什么要改、要达到什么结果、影响哪些 owner、采用什么方案、还存在哪些问题，以及按什么顺序实施和验证。

创建并通过结构检查只表示计划材料完整，不表示方案已经获得实施许可。计划是否可执行还取决于内容审阅、开放问题、项目约定和当前任务授权。

## 使用条件

1. 用户明确要求创建、查询、更新、审阅或归档一个持久 change 计划时使用。
2. 工作将跨越多个文件、owner 或验证阶段，需要在对话之外保存范围、顺序和交接信息时使用。
3. 只需要当前对话中的简短步骤、仍在探索问题、维护长期决策、更新稳定事实 owner，或已经明确要求直接完成一个局部改动时，不创建 change 计划。

## 内容 owner

1. 本文件承接触发、上下文恢复、写作流程、开放问题门禁、语义审阅和交付。
2. [固定结构与 CLI 契约](references/change-plan-contract.md) 唯一承接 change 根目录、artifact 标题、章节顺序、任务语法和 CLI 精确机械行为；创建、查询、更新、结构审阅或归档前完整读取。
3. `scripts/change-plan.mjs` 负责直接目录发现、artifact 展开、结构检查和受门禁的目录归档，不判断目标、方案、事实、决策、验证证据或归档授权是否正确。
4. 项目文档继续拥有当前稳定事实和行为；项目已有长期决策 owner 时，跨 change 持续有效的理由与方向进入该 owner。Change plan 只拥有当前 change 的临时实施上下文。

## 工作流程

### 1. 确定 change

1. 读取目标工作区指令和与 change 直接相关的事实 owner；项目已有决策、调查或测试证据入口时，只读取当前范围需要的材料。
2. 将用户目标压缩成一句结果说明，并确定范围、非目标、成功标准和受影响 owner。
3. 使用用户指定的 change 目录；未指定时遵循项目已有约定，项目没有约定时使用 `changes/<kebab-case-name>/`。
4. 需要从项目现有 changes 中选择目标时，先运行 `list`；同名 active 目录已存在时，把请求解释为更新或审阅现有计划，运行 `show` 并读取全部三个 artifact 后再修改，不覆盖尚未纳入当前请求的内容。
5. 目标、范围或会改变 public contract、架构边界、兼容性和验收的关键选择无法可靠判断时，只询问这一项；其余细节按项目现有约定形成明确假设。

### 2. 写 proposal

1. 按固定结构写 `proposal.md`，先用一句话说明 change 的目标和当前文档性质。
2. `Why` 说明当前问题和做这项 change 的理由；`Outcome` 说明完成后可观察的结果。
3. `Scope` 同时写清纳入与不纳入的内容；`Success Criteria` 使用可检查的完成条件。
4. `Affected Owners` 列出需要读取、修改或验证的稳定 owner，不复制这些 owner 的完整规则。

### 3. 写 design

1. 按固定结构写 `design.md`，只展开兑现 proposal 所需的方案。
2. 在 `Context` 中区分已确认事实、约束和必要假设；事实继续引用原 owner。
3. 在 `Goals / Non-Goals` 收紧设计边界；在 `Decisions` 记录只影响当前 change 的方案和影响。
4. 项目已有长期决策 owner 时，把跨 change 持续有效且已经确认的判断交给该 owner，design 只保留当前 change 需要的摘要或链接。
5. 在 `Risks / Trade-offs` 写明会改变实施或验证方式的风险；在 `Open Questions` 保留尚未回答且会改变范围、方案、权限或验收的问题。没有此类问题时明确写“无”。

### 4. 写 tasks

1. 按固定结构写 `tasks.md`，任务使用唯一的层级数字 ID，并保持可独立完成和验证。
2. `Readiness` 位于所有实施任务之前，至少检查三个 artifact 是否围绕同一目标、受影响 owner 是否准确、重要假设是否显式，以及 `Open Questions` 是否没有阻塞实施的未知项。
3. `Implementation` 按依赖顺序列出必要改动；每项说明明确产物或行为结果，不把探索性愿望写成可直接执行的任务。
4. `Verification` 覆盖受影响 owner、实现边界和失败风险；不把计划运行的检查写成已经通过。
5. 创建计划时任务默认未完成。只有存在实际完成证据时才勾选任务，并同步记录发现的设计缺口或阻塞。

### 5. 查询、检查与审阅

1. 让 shell 当前工作目录保持在目标项目根目录，并用 change-plan skill 的实际安装路径调用脚本。以下命令中的 `<change-plan-cli>` 表示 `<skill-directory>/scripts/change-plan.mjs`；列出默认 `changes/` 下的 active changes：

   ```text
   node <change-plan-cli> list
   ```

2. CLI 的默认 `changes/` 和所有相对路径参数都相对 shell 当前工作目录解析，不相对脚本安装目录解析。无法从目标项目根目录调用时，为 `list` 传入显式 change 根目录，并为其他命令传入明确 change 目录；只看历史时追加 `--archived`，同时查看 active 与 archived 时追加 `--all`。
3. 使用 `show <change-directory>` 展开单个计划及其状态、任务进度、结构诊断和三个 artifact；使用 `check <change-directory>` 只做结构检查。需要机器结果时追加 `--json`。
4. 先修复结构错误，再进行语义审阅。语义审阅确认 proposal、design 和 tasks 指向同一结果；范围、owner、设计、任务和验证互相一致；开放问题没有被实现假设掩盖。
5. 存在阻塞开放问题、缺少必要授权或 Readiness 未完成时，将计划报告为草案或未就绪，不开始实现，也不把结构检查通过表述为批准。

### 6. 完成与归档

1. 归档前逐项确认 proposal 的成功标准已经满足，稳定事实 owner 已同步，design 的开放问题没有阻塞完成，tasks 的完成勾选有实际实施与验证证据。
2. 完成语义审阅并获得当前任务的归档授权后运行：

   ```text
   node <change-plan-cli> archive <change-directory>
   ```

3. CLI 只在结构有效且全部 checkbox 任务完成时，把 active change 移入同级 `archive/<change-name>/`；目标已经归档、使用符号链接或归档目标冲突时拒绝。
4. CLI 门禁不证明成功标准、owner 同步或验证充分性，也不自行取得归档授权。命令失败时修复诊断或报告阻塞，不手动绕过完成门禁。
5. 已归档 change 只作为历史参考；本 CLI 不提供 restore。后续工作需要新计划时创建新的 active change，不直接改写归档历史。

## 更新规则

1. 目标或范围变化时先更新 proposal，再同步 design 和 tasks。
2. 方案变化时更新 design，并调整受影响任务和验证；已经不成立的未完成任务直接修正，已完成任务保留实际证据并说明后续修订。
3. 新发现只影响本次实施时进入 design 或 tasks；改变稳定事实时更新对应项目 owner；形成跨 change 长期方向时交给项目已有决策 owner。
4. 额外说明或交付证据可以作为附加文件放在 change 目录中，但不能代替三个必需 artifact。
5. 已归档计划不在原地更新或恢复；需要继续同一方向时创建新的 active change，并在新计划中引用必要的历史上下文。

## 完成标准

1. change 目录名称和三个必需 artifact 通过随包 CLI 检查，且能够由 `list` 与 `show` 按当前目录状态读取。
2. proposal 能说明 why、目标结果、范围、成功标准和受影响 owner。
3. design 能说明上下文、边界、当前 change 的关键判断、风险和开放问题。
4. tasks 包含先于实施的 Readiness、按依赖组织的 Implementation 和范围匹配的 Verification。
5. 结构有效、内容审阅、实施就绪与归档状态分别汇报，没有把计划创建、任务勾选或结构通过误作实施许可。
6. 归档时已经完成人工语义门禁，CLI 成功移动到无冲突的 `archive/<change-name>/`，并保留全部 artifacts 和附加文件。

## 交付

简要说明 change 名称、状态与路径，三个 artifact 的作用，CLI 查询或检查结果，语义审阅结论，当前是否就绪或已经归档，以及仍需用户确认或下游实施处理的事项。
