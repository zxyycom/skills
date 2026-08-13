# Design

Active metadata 只保存 Draft 与 Plan，tasks 表达计划内进度，Git 距离以原始证据和直接行动提示呈现。

## Context

### 变更前需要替换的契约

- `.change-plan.json` 接受 `draft`、`plan`、`implementation` 与 `shelved`；Plan 还允许 `baseCommit: null` 作为 resume 后的过渡状态。
- `tasks.md` 已固定包含 Readiness、Implementation 与 Verification，并分别统计任务总数和完成数。`plan` 要求全部 Readiness 完成且其他两区段没有已勾选任务，`implement` 只把 metadata 从 plan 改成 implementation。
- Plan assessment 使用 `baseCommit` 到当前 `HEAD` 的 first-parent Git 距离并按固定阈值分类；只有 plan stage 参与检查，implementation 与 shelved 返回 `not-applicable`。
- `archive` 要求 implementation stage 与全部任务完成。Archived Change 的 metadata 只作为历史文件保留，checker 不读取或解释它。
- 分发 CLI 从 `tools/change-plan/src/cli.ts` 生成到 skill 目录；源码、测试、行为 owner、生成产物和 test-evidence 账本必须同步。

### 权威决策

- [`simplify-change-lifecycle-to-draft-plan-and-archive.md`](../../docs/decisions/change-plan/simplify-change-lifecycle-to-draft-plan-and-archive.md) 要求 active stage 只保留 draft/plan、任务全部在 Plan 内推进、CLI 只提供六个命令。
- [`report-plan-git-distance-as-context.md`](../../docs/decisions/change-plan/report-plan-git-distance-as-context.md) 要求保留 `baseCommit` 与距离原始证据，并让查询直接提供复核提示。
- [`maintain-change-artifact-and-authorization-boundaries.md`](../../docs/decisions/change-plan/maintain-change-artifact-and-authorization-boundaries.md) 继续要求 artifacts、机械检查、内容审阅和授权彼此分离。
- [`check-change-plan-collections-as-a-gate.md`](../../docs/decisions/change-plan/check-change-plan-collections-as-a-gate.md) 继续拥有 `check-all` 的集合门禁语义；本 Change 只调整成员结果的 stage 与距离字段。

### 兼容约束

- Skill 会更新已经存在 Change 数据的项目，不能把 canonical schema 简化直接变成对旧 active metadata 的破坏性读取升级。
- 设计审计确认既有项目数据可能包含 implementation、shelved 与 `baseCommit: null` Plan；本 Change 不拥有这些 Change 的目标和任务进度，不能为迁移而批量改写它们。
- 因此规范 schema/writer 与兼容 reader 分离：新写入只产生 draft/plan，读取边界识别旧形状并提供 checker、查询、`plan` 与 `archive` 所需信息。Archived 仍绕过 active metadata reader。

## Goals / Non-Goals

目标：

- 让持久状态只保存 Draft 与 Plan 的内容成熟度，任务进度只由 tasks 表达，完成只由 archive 目录 status 表达。
- 让六个 CLI 命令各有不可替代的发现、检查、确认或归档职责。
- 让 Plan 基线变化以人可直接理解的一句话和机器可消费的原始证据呈现。
- 在不增加迁移命令和不改写其他 active Change 的前提下兼容旧 metadata。
- 保持结构检查、Git 故障、归档路径安全、生成产物和测试证据的现有质量边界。

保持不变的边界：

- Task Graph 继续拥有外部等待、执行租约和非线性协调；Change Plan metadata 只保存内容成熟度与 Plan 基线，tasks 保存计划内进度。
- 内容审阅与当前任务授权继续由执行者和任务上下文判断，不进入 metadata 事件或授权记录。
- `plan` 与 `archive` 继续作为受信工作区中的单一操作者写入；命令运行期间由当前任务保持目标
  Change、Change 根和 archive 路径的命名空间稳定，不扩展成抵御恶意并发改名的文件系统沙箱。
- Proposal、design、tasks 的固定 Markdown 章节和 task ID 语法保持不变。
- Git 距离继续使用 first-parent、排除当前 Change 目录并累计 additions/deletions；本 Change 只移除分类与生命周期责任。
- Archived 历史保持原样，默认 `check-all` 仍只检查 active Change。

## Decisions

### 1. 规范生命周期与任务进度

- `ChangePlanStage` 收窄为 `draft | plan`。Active metadata 的 canonical schema 只接受：

  ```json
  { "stage": "draft" }
  ```

  和：

  ```json
  { "stage": "plan", "baseCommit": "<non-empty-revision>" }
  ```

- Archived 继续由目录决定 status，保留完整 artifacts 与历史 metadata，但不读取 stage。
- Draft 结构检查只检查最小 proposal 与 design；Plan 检查完整 proposal、design 与 tasks。三个 task 区段继续分别统计，但任何单项进度都不产生 stage。
- `plan` 的 artifact 门禁只要求目标 Plan 结构有效，不再要求 Readiness 全部完成，也不拒绝已有 Implementation 或 Verification 证据。这样既能在 Plan 内完成审计，也能把已经发生的事实如实纳入持久计划。

### 2. 旧版 metadata 兼容读取

- 规范 parser 与 writer 只接受新结构；内部 active metadata 读取边界另行接受以下旧形状：
  - `implementation + baseCommit` 投影为 Plan，并保留原基线。
  - `shelved + baseCommit + shelf` 投影为 Plan，忽略只属于旧控制状态的 shelf 字段并保留原基线。
  - `plan + baseCommit: null` 保持为“Plan 已发现但基线缺失”的迁移输入，供查询诊断与 `plan` 重写使用。
- `list`、`show` 与正常 checker 对旧 implementation/shelved 统一报告 stage `plan`；只要基线仍可用，它们不因旧版形状单独失败。调用方下次显式运行 `plan` 时写回 canonical Plan metadata 和当前基线。
- `baseCommit: null` 无法产生距离证据，因此 `check` 返回基线不可用诊断，但 `show`/`list` 仍能发现目标，`plan` 明确接受它并在语义复核后写入当前 `HEAD`。
- 兼容 reader 不写文件、不保留 shelf 的新语义、不增加公共 stage 值，也不读取 archived metadata。测试 fixture 固定这一边界，避免兼容逻辑渗入规范 writer。

### 3. 六个命令及其写入职责

CLI 只提供以下命令：

| 命令 | 唯一职责 |
| --- | --- |
| `list` | 发现并筛选 Change，保留无效成员的可见性。 |
| `show` | 展开一个 Change 的 artifacts、检查结果、任务进度和 Plan 距离。 |
| `check` | 门禁一个 Change 的结构、metadata、任务语法和可用 Plan 基线。 |
| `check-all` | 聚合门禁选定 Change 集合，不改变成员。 |
| `plan` | 把 Draft 确认为 Plan，或在语义复核现有 Plan 后刷新 `baseCommit`。 |
| `archive` | 把结构有效、基线可用且全部任务完成的 active Plan 移入 archive。 |

`plan` 接受 Draft、规范 Plan 和兼容 reader 识别的旧 active metadata。它先按目标 Plan 结构检查 artifacts，再要求仓库有当前 `HEAD`，最后原子写入规范 Plan metadata。`archive` 继续在移动前重验文件系统身份和目标冲突；命令成功不表示已经完成语义验收或获得授权。放弃 Change 使用普通文件删除与版本控制流程，不进入 CLI 状态机。

### 4. Git 距离证据与直接提示

- 删除 `ChangePlanAssessment`、`not-applicable`、`current`、`shelve-candidate`、`plan-review-required` 和固定阈值；Git 距离模块只返回 measured evidence 或可映射为诊断的不可用结果。
- Plan 距离可用时，检查结果保存 `baseCommit`、`headCommit`、`commitCount` 与 `changedLines`；Draft 与 archived 的 `distance` 为 `null`。
- 文本 renderer 从原始证据使用固定模板：
  - 距离为零：`自计划基线以来，未统计到 Change 目录外的项目变化。`
  - 距离非零：`距离计划基线已过去 <commitCount> 个提交，Change 目录外累计变化 <changedLines> 行；继续前请确认这些变化没有影响当前计划。`
- 普通 measured distance 永远不产生阻断 diagnostic，也不限制 `plan` 或 `archive`。基线缺失、无法解析、不在 first-parent 历史上、当前仓库没有 `HEAD` 或版本控制操作失败时，保留稳定诊断和行动建议；`plan` 写入成功后重新查询即可恢复。

### 5. 查询与集合结果

- 单项 check/show 和 catalog entry 删除 assessment 字段，改为直接携带可用的 distance evidence；文本模式不先输出分类词组再解释。
- `list --stage` 只接受 `draft` 或 `plan`，旧 implementation/shelved 通过兼容投影进入 plan 过滤结果。
- `list` 继续在成员内容无效时保持发现成功，`check-all` 继续在根错误或任一成员无效时失败；集合 status、计数、排序、archive 选择和诊断聚合保持不变。
- JSON 变更属于当前 CLI 结果契约的有意简化。Skill 没有承诺稳定程序化 API 或跨版本兼容类型，不为删除字段保留别名。

### 6. Owner、生成与决策对齐

- `SKILL.md` 负责语义流程、内容审阅和授权边界，固定 contract 负责 stage、metadata、命令与精确结果；源码只实现这些 owner，不成为第二规则源。
- `AGENTS.md` 与 `agents/openai.yaml` 只同步当前能力概览和默认提示，不复制完整契约。
- 修改 `tools/change-plan/` 源码与测试后，通过 `bun run sync:change-plan-cli` 更新 MJS 与 source map；生成文件不直接编辑。Skill 行为改变后提升其独立正整数版本。
- 修改或删除的每个原生测试入口都按 test-evidence-review 契约更新唯一 case，再同步统一派生索引。
- 两条 governing decision 只有在行为 owner、源码、生成产物和验证全部成为当前事实后才标记 aligned；Change 归档仍等待全部任务证据和用户授权。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 兼容 reader 会暂时增加 canonical schema 之外的读取分支 | 把它限制在 active metadata 边界，writer 与公共 stage 始终只产生 draft/plan，并用旧 fixture 防止扩散 |
| 旧 shelved 被投影成 Plan 后不再保留暂停约束 | 新决策已经认定 shelf 没有稳定机械意义；原 reason 仍在文件与 Git 历史中，工具不自动改写，真正等待由对应协调 owner 表达 |
| 普通距离不再通过阈值提醒强弱 | 文本始终提供原始提交数、变化行数和一致行动建议，避免内部阈值掩盖事实；调用方按当前 Change 风险判断复核深度 |
| 允许现有 Plan 随时刷新基线可能掩盖未经审阅的变化 | 行为 owner 明确要求先完成语义复核；CLI 只记录调用时 HEAD，不声称完成审阅或授权 |
| 文件系统路径检查无法替代跨进程锁或平台原生目录句柄 | 写入命令只在单一操作者保持命名空间稳定时运行；工具拒绝已观察到的链接、身份变化和目标冲突，不增加伪原子抽象 |
| 删除命令和 JSON assessment 字段会破坏依赖旧 CLI 表面的调用方 | 这是已确认的有意简化；help、版本、测试与说明同步，不维护隐藏别名或第二输出契约 |
| 已有项目可能保存多种旧 active stage | 不批量改写其他 Change；兼容投影保持它们可发现、可检查，并允许目标在下次 plan 或 archive 时自然收敛 |

## Open Questions

无。生命周期、六个命令、Plan 内任务推进、旧 metadata 兼容读取、canonical 写入、Git 距离证据、文本提示、阻断条件和 owner 边界均已确定。
