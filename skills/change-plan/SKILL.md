---
name: change-plan
description: >-
  创建、查询、审阅或结项明确 Change 计划。用于用 proposal.md、
  design.md、tasks.md 和 .change-plan.json 维护明确 Change 的目标、设计、任务、
  验证与 draft/plan stage，并在结项时删除短期计划目录。
metadata:
  version: "39"
---

# Change Plan

## 目标

以明确 `Outcome` 组织一个 Change 的目标、设计、实施与验证。Draft 用于收敛方案，Plan 用于
推进任务；全部任务完成后保存 Git 完成态，并以 `finalize` 删除临时计划。

`proposal.md` 表达结果、范围和成功标准，`design.md` 记录方案与取舍，`tasks.md` 承接工作与
验收；`.change-plan.json` 记录 Draft/Plan 内容成熟度与 Plan 的 Git 基线。

## 使用条件

- 用户明确要求创建、查询、更新、审阅或结项一个持久 Change 计划。
- 工作跨越多个文件、owner 或验证阶段，需要在对话之外保存范围、设计、进度和交接信息。
- 简短步骤、尚未形成实施 Change 的探索、长期决策和稳定事实留在当前任务或对应 owner；明确要求
  直接完成的局部改动不因存在本 skill 而自动建立 Change。

## 读取路径与职责

- 本文件承接内容判断、任务完成声明、执行流程与授权边界。
- 操作 Change 前完整读取[固定结构与 CLI 契约](references/change-plan-contract.md)。它唯一承接
  目录、metadata、artifact 结构、Git 距离及随包 `scripts/change-plan.ts` 的机械行为。
- Change Plan 保存临时实施上下文；稳定事实与行为归项目文档，跨 Change 的长期理由与方向归项目
  已有决策 owner。执行者核实实际工作与验收证据，CLI 核实结构和删除安全条件。

## 运行前置

运行下文公开 `.ts` CLI/import 或自更新入口时，使用 Node.js `>=24.18` 的原生类型擦除。
依赖沿 Node 正常解析，可复用宿主兼容版本，不要求本地 `node_modules` 或与锁文件精确版本一致。
依赖缺失、实际不兼容或需要复现随包基线时，使用随包 `package.json` 固定的 pnpm 显式安装：

```bash
pnpm --dir "<skill-directory>" install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated
```

运行、import、help 和检查不自动安装。安装副本中的 `scripts/runtime/tools/` 可直接修改，无需构建；
更新会覆盖正式包中的同路径定制文件。领域操作的其他前置仍由各自操作契约承接。

## 任务与结项契约

- 清单：`tasks.md` 完整承接成功标准、预期调整、必要影响、阻塞验收的问题、稳定 owner 同步与必要
  知识交接。将这些条件落实到任务或其验收条件，优先由现有任务承接。
- 勾选：`[x]` 声明对应工作及其验收已完成且有证据。语义审阅、验证与必要交接在勾选前完成；发现
  遗漏、误勾或证据不足时，同步修正清单与状态。
- 结项：Plan 全部任务如实完成即接续版本保存与安全退出，业务验收已经随任务完成。保存最终全勾
  Plan 和 `finalize` 属于结项动作，不列为全勾的前置 checkbox，以免形成循环。
- 授权：接手实施时，依据当前任务与项目规则恢复实施、提交和正常结项删除的授权范围，缺失且影响
  交付时尽早确认；完整交付按已有授权连续结项。只创建、查询或审阅计划时，即使发现全勾也不自动
  提交或删除；checkbox、metadata 和命令成功均不授予额外权限。

## 工作流程

`plan` 与 `finalize` 是受信工作区中的维护写入。命令运行期间，由当前任务保持目标 Change、其
Change 根和 tombstone 路径的命名空间稳定，不与其他操作者或进程并发移动、替换或结项同一目标。

### 1. 定位或建立 Change

1. 读取目标工作区指令与相关事实 owner，按当前范围补读项目已有的决策、调查或测试证据。
2. 将用户目标压缩成一句 `Outcome`，确定预期调整，并从事实 owner 与现有依赖恢复由该调整产生且
   实现 `Outcome` 必须处理的影响，据此确定范围、非目标、成功标准和受影响 owner。具有独立
   `Outcome` 或生命周期的事项建立独立 Change。
3. 使用用户指定目录，其次遵循项目约定，项目没有约定时使用 `changes/<kebab-case-name>/`。
   选择现有 Change 时先 `list` 再 `show`，从 stage、任务进度、诊断与 Git 距离恢复上下文。
4. 新建时写入 Draft metadata、最小 `proposal.md` 与初始 `design.md`；`tasks.md` 在形成 Plan 时
   派生。目标、范围或涉及 public contract、架构、兼容性、验收的关键选择无法可靠判断时，只确认
   会改变结果的最小问题。

### 2. 将 Draft 收敛为 Plan

1. 持续修订 Draft 的 `Why`、`Outcome` 与 design，保存当前上下文、目标、方向、取舍和开放问题，
   显式标记暂定选择。
2. 在 proposal 的 `Scope` 与 design 的 `Decisions` 中，用 `Intended Change` 表达预期调整，
   用 `Resulting Impacts` 表达由该调整产生且实现 Outcome 必须处理的影响；补全成功标准与受影响 owner。
3. 从 design 派生 `tasks.md`，用 Readiness、Implementation 与 Verification 组织工作，使实施与验证
   覆盖预期调整及必要影响，并符合任务与结项契约。三个 artifacts 已具备 Plan 内容时运行：

   ```text
   node <change-plan-cli> plan <change-directory>
   ```

   `plan` 将运行时的 `HEAD` 写为基线并保留任务进度。成功后按项目版本控制流程保存三个 artifacts
   与 metadata。

### 3. 在 Plan 内实施、查询与复核

1. 按 tasks 的依赖顺序完成 Readiness、Implementation 与 Verification。新发现的必要影响同步进入
   proposal 与 design 的 `Resulting Impacts` 及 tasks；预期调整变化时同步 `Intended Change`，预期结果
   变化时同步 `Outcome` 与 Goals。方案变化时更新 design 和受影响的任务与验证。
2. 实施观察进入 design 或 tasks，稳定事实更新到项目 owner，长期方向交给已有决策 owner；附加说明
   和证据可放在 Change 目录，固定 artifacts 仍按契约维护。
3. 使用 `show` 恢复当前 Change、`check` 检查单项、`list` 发现集合、`check-all` 检查全部直接成员。
   根据 Git 距离确定复核深度，确认项目演进仍与计划一致；可用距离本身不阻断检查或结项。
4. 按诊断恢复输入与基线：
   - metadata 无效：通过普通文件与版本控制流程显式修复，再进入 `plan` 或 `finalize`。
   - 基线不可追溯或主动刷新：先完成当前 Plan 的语义复核，再运行 `plan`。
   - Git 查询失败：先恢复仓库访问或 Git 状态，再执行上述审阅与基线刷新路径。

### 4. 保存完成态并结项删除

1. 在实施或完成 Change 的任务中，全勾后按项目版本控制流程保存当前任务改动。确保完整 Change
   目录，包括最终 artifacts、metadata 与必要附加证据，与当前 `HEAD` 精确匹配；已有相同快照时
   无需重复提交。保留无关工作区与暂存改动。
2. 先预检机械门禁与预计恢复 revision，预检通过后执行删除：

   ```text
   node <change-plan-cli> finalize <change-directory> --preflight
   node <change-plan-cli> finalize <change-directory>
   ```

3. 运行 `list` 确认目录已退出当前成员集合。以 outcome 为 `finalized` 且退出已确认作为结项完成证据。

## 故障与取消

- 版本保存、机械门禁或清理失败时，按[写入命令契约](references/change-plan-contract.md#写入命令)
  处理 outcome 与恢复路径，解除原因后继续；需要外部条件或额外授权时报告具体阻塞。任务状态仍
  按工作与验收事实记录。`committed-cleanup-pending` 表示仍待清理，应检查报告的 tombstone 路径，
  或从报告的 Git revision 恢复。
- 取消实施时，判断内容的独立价值，完成必要 owner 交接与历史保存，再在明确授权范围内按项目
  文件系统与版本控制流程移除目录，并以 `list` 确认退出。后续工作需要计划时建立新的 Change。

## 验收与交付

- 核对 artifacts 是否表达同一 Outcome、必要影响能否回溯到预期调整、任务覆盖与证据是否符合上述
  契约，以及 metadata 和机械检查的实际结果。
- 简要说明 Change 名称、路径、stage、任务进度、Git 距离或基线诊断，以及实际命令与检查结果。
  运行 `finalize` 时另报 outcome、HEAD recovery revision、tombstone 边界与下一步；有阻塞时区分
  未完成的实质工作和结项执行故障。

## 自更新

在本 skill 目录运行 `node scripts/update-skill.ts`，运行前置与依赖修复见[工具运行前置](#运行前置)。
运行时文件或 manifest/锁文件损坏时，重新获取完整 skill 后再安装并重试。
更新覆盖正式包中的同路径文件、保留其余本地文件。源码更新成功不证明依赖兼容；需要时按新包锁文件显式安装。
