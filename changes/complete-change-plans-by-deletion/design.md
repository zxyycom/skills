# Design

本设计把 Change 定位为实施期间的短期计划目录，以 `complete` 完成最终门禁并删除已记录目录；本文仍处于 Draft，必须先固定删除事务、legacy archive 清理和 Git 恢复输出再进入 Plan。

## Context

- [`保留型工件重名调查`](../../docs/investigations/260903-explore-name-collisions-in-retained-artifacts.md)确认独立 Change archive 只保留原始 artifacts，不承担 OpenSpec archive 的 spec 同步结果。
- 当前固定契约以目录表达 `active`/`archived` status，以 metadata 表达 `draft`/`plan` stage；`archive` 要求有效 Plan 和全部 checkbox 完成，再把目录移动到同名 archive 目标。
- Archived Change 不再由 checker 解释，只能被 `list` 发现或由 `show` 原始读取；`docs/tooling.md` 也把 `changes/archive/**` 排除在持续 Markdown 链接校验之外。
- 当前 active Decision [`validate-only-active-change-plans.md`](../../docs/decisions/validate-only-active-change-plans.md)和 archived predecessor [`simplify-change-lifecycle-to-draft-plan-and-archive.md`](../../docs/decisions/archive/simplify-change-lifecycle-to-draft-plan-and-archive.md)都把 archive 作为完成结果。本 Change 实施前必须以新 Decision 显式演进该方向。
- Change Plan 工具源码位于 `tools/change-plan/`，由 `scripts/build/change-plan.ts` 生成 skill 内 CLI。项目导航、AGENTS、工具链和相关测试目前都可能描述 archive。
- 当前仓库存在既有 `changes/archive/` 成员。删除它们是一次性迁移，不等同于日常 `complete`，但服从相同的 Git 可恢复和未知成员保护边界。
- Decision 与 Investigation 的日期身份和 rename 由 [`adopt-date-prefixed-record-identities`](../adopt-date-prefixed-record-identities/)及 [`add-record-rename-transactions`](../add-record-rename-transactions/)负责；本 Change 与两者没有实施依赖。

## Goals / Non-Goals

目标：

- 让 Change 只在仍需要实施规划、进度和交接时存在，完成后退出当前名称空间。
- 用 Git HEAD 证明删除前的完整内容可恢复，并在失败时保护未记录、已修改、忽略或未知成员。
- 移除 archived status 产生的查询、路径、名称冲突和历史维护责任。
- 保持 Draft、Plan、artifact 结构、Plan Git 距离和任务门禁在 active 期间继续有效。
- 让稳定事实、长期决策和调查证据明确回到各自 owner，而不是依赖完成后的 Change 快照。

非目标：

- 不为 Change 增加日期前缀 ID、名称简写、rename、历史索引或 completed 目录。
- 不修改 OpenSpec 的 propose/apply/archive 工作流；OpenSpec archive 继续按自身 spec 同步语义维护。
- 不把 Git 封装成 Change 历史浏览器，不新增数据库、对象存储或第二备份。
- 不自动从完成 Change 内容生成 Decision、Investigation 或稳定文档；完成前仍由 agent 语义审阅 owner 交接。
- 不删除未进入 Git HEAD 或不能逐项证明可恢复的目录成员。

## Decisions

### Intended Change

#### 生命周期与公开命令

Change 只保留 active status，以及 Draft 和 Plan 两个内容成熟度 stage：

```text
active/draft -> active/plan -> complete -> directory absent
```

`complete <change-directory> [--preflight]` 替代 `archive`。`complete` 是显式破坏性操作，不写入 `completed` metadata、不移动到历史目录，也不建立 tombstone 作为长期成员。`--preflight` 执行相同的读取、Plan、任务、Git 和成员准备，但零写入且不保存 receipt。

公开查询只发现和检查 active Change：

- `list` 移除 `--archived` 与 `--all`；
- `show`、`check`、`plan` 和 `complete` 只接受 active Change；
- `check-all` 继续检查全部 active 直接成员；
- archived status、archive 路径投影和历史 artifact raw reader 退出运行时类型与 JSON 输出。

#### 完成门禁

正式 `complete` 在写前重做以下检查：

1. 目标是规范 active Plan，三个 artifacts 和 metadata 有效，Plan base 可用；
2. Readiness、Implementation 与 Verification 的全部 checkbox 已完成；
3. 当前任务已完成成功标准、稳定 owner、长期 Decision、调查证据和验证结果的语义审阅；CLI 只提示该责任，不把它伪装成机械证明；
4. Change 目录的完整普通文件树已经存在于当前 Git HEAD，文件类型和字节与 HEAD 一致；目录内不存在未跟踪、忽略、已修改、符号链接或其他未记录成员；
5. source 目录身份、成员清单和 HEAD revision 在提交删除前没有漂移。

任一条件不满足时零写入失败并给出下一步。成功输出包括被删除目录、作为恢复基线的 HEAD revision、删除成员数量和 `changed: true`；调用方可以通过 Git 恢复，不声称当前工作树仍保存历史副本。

#### 删除与恢复边界

实现先把已经完整预演的 source 目录不覆盖地移动到同文件系统临时 tombstone，使原 active 路径退出集合，再按预演清单删除 tombstone 中的精确成员。移动前失败保持 `no-change`；移动后清理失败报告 `committed-cleanup-pending` 和 tombstone 位置，不能把部分清理误报为完整成功。未知成员或身份漂移阻止清理。

Git HEAD 是可恢复性门禁，不是 Change lifecycle owner。工具不创建提交、不 stage 删除、不 reset、不自动恢复；调用方按普通版本控制流程审阅并提交目录删除。

#### Legacy archive 迁移

实施阶段枚举当前 `changes/archive/` 的直接成员，对每个目录验证完整成员都已在 Git HEAD 且工作树没有未记录内容，再从当前树删除。任一成员不满足条件时只暂停该成员，不以整目录递归删除绕过证据。全部成员退出后删除空 `archive/`，并移除项目对该路径的发现、校验排除和说明。

Legacy archive 的历史读取改由 Git 提供。迁移记录只需说明删除基线和异常成员，不建立新的 archive manifest、索引或长期兼容 reader。

### Resulting Impacts

- **Change Plan 契约与实现：** status 类型收敛为 active，`archive` 替换为 `complete`，catalog/show/CLI/JSON 输出、删除事务和恢复诊断同步修改；Draft、Plan、check 与 Git 距离保持现有责任。
- **Skill 行为：** 创建、推进、完成和交付流程改为完成前交接稳定结果，确认授权后执行 `complete`；不再提示 archive 或 archived 查询。
- **长期决策：** 以新 Decision 演进“Draft/Plan/archive”和“只检查 active、原始读取 archived”的当前方向，明确 Git 历史承担完成快照恢复。
- **项目文档与工具链：** 更新 `AGENTS.md`、`docs/navigation.md`、`docs/tooling.md` 中的 Change 退出条件、archive 排除和维护命令说明；只修改实际以 archive 为当前契约的 owner。
- **既有数据：** 逐项移除 `changes/archive/` 当前成员和最终空目录；保留 Git 历史，不迁移到日期目录或其他历史容器。
- **分发与验证：** 更新 `tools/change-plan/` 源码与测试、生成 skill CLI、skill 版本及公开分发证据；每个新增或修改的最小原生测试入口维护对应 Test Evidence case 和派生索引。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 文件树删除具有破坏性 | 只删除与 Git HEAD 完全一致且无额外成员的目录；正式操作仍需当前任务授权 |
| 日常文件树不再直接浏览完成计划 | 使用 Git log/show 恢复；稳定事实、长期方向和调查证据在完成前进入对应 owner |
| 一次性删除大量 archive 可能掩盖遗漏 | 按成员逐项验证和报告，不满足门禁的成员单独暂停，不使用无条件递归删除 |
| `archive` 是当前公开命令，直接移除会破坏旧调用 | 作为明确 major 行为演进更新 skill 版本、help、契约和测试；不长期保留会继续制造历史目录的兼容别名 |
| Tombstone 清理失败会留下内部残留 | 返回 `committed-cleanup-pending` 和精确路径；catalog 不把 tombstone 当 active Change，维护恢复后再继续 |
| Git 历史可能被后续仓库重写或浅克隆裁剪 | 当前产品只承诺删除时在本地 HEAD 可恢复，不把 Change Plan 扩展成独立备份系统 |

## Open Questions

1. `complete` 的 tombstone 放在 Change root 内的保留目录还是同级系统临时位置，才能同时保证同文件系统移动、catalog 排除和维护可发现性？
2. Git 可恢复检查是否只接受普通文件，还是需要支持 Git 能记录的可执行位；符号链接继续 fail closed，不在本 Change 中扩展。
3. 一次性 legacy archive 清理应由专用迁移脚本逐项执行，还是复用 `complete` 的底层删除准备但跳过已经不适用的当前 Plan 检查？
