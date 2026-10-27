# Change Plan CLI 契约

本参考承接命令调用、输出、写入与恢复的精确契约；目录、artifacts 和 Git 距离见[固定结构契约](change-plan-contract.md)，执行流程见 [Change Plan](../SKILL.md)。

## CLI

脚本安装位置与 Change 路径解析基准彼此独立。保持 shell 当前工作目录在目标项目根目录，并用 skill
的实际安装路径调用脚本；以下 `<change-plan-cli>` 表示
`<skill-directory>/scripts/change-plan.ts`。默认根目录和所有相对路径参数都相对 shell 当前
工作目录解析。

CLI 仅提供以下六个命令：

```text
node <change-plan-cli> list [change-root] [--stage <draft|plan>] [--json]
node <change-plan-cli> show <change-directory> [--json]
node <change-plan-cli> check <change-directory> [--json]
node <change-plan-cli> check-all [change-root] [--json]
node <change-plan-cli> plan <change-directory> [--json]
node <change-plan-cli> finalize <change-directory> [--preflight] [--json]
```

`show`、`check`、`plan` 与 `finalize` 的显式目录必须是项目约定 Change 根（未约定时
`changes/`）的直接 active member。单目录命令从目标父目录推导该根，不进行跨根名称搜索；目标父目录
或任一祖先是另一个 Change 的 metadata 边界时视为嵌套路径。`.change-plan-tombstones` 及其 child
和任何嵌套路径都返回 `change-directory-not-active-member`，不会读取或写入其内容。

### 查询命令

| 命令 | 选择与机械结果 |
| --- | --- |
| `list` | 发现当前工作目录 `changes/` 或显式根目录的直接 Change 成员；`--stage` 只筛选规范 `draft` 或 `plan`。无效成员保持可见但没有合法 stage，不使发现操作失败。 |
| `show` | 返回当前 Change 的检查结果和可读取 artifacts；结构无效时以领域失败退出。 |
| `check` | 按当前 stage 检查一个显式 Change 的 metadata、artifacts、任务语法和 Plan 基线。 |
| `check-all` | 门禁当前工作目录 `changes/` 或显式 change root 的全部直接成员。根错误或任一成员无效时集合失败；合法空集合通过。 |

`list` 与 `check-all` 只发现 Change 根的直接成员，按 Change 名称排序；`.change-plan-tombstones`
始终忽略。

### 结构化查询结果

单项 checker 结果由 `check --json` 直接返回；`list` entry 和 `show.check` 复用同一结构：

| 字段 | 含义 |
| --- | --- |
| `changeDirectory`、`changeName` | 规范化后的绝对目录与 Change 名称。 |
| `stage`、`metadata` | 规范 Change 的 stage 与 metadata；metadata 无效时两者均为 `null`。 |
| `taskCount`、`completedTaskCount`、`taskProgress` | 整体任务计数，以及 readiness、implementation、verification 三个区段各自的计数。 |
| `distance` | 可用 Plan 的 `GitDistanceEvidence`；其他场景为 `null`。 |
| `diagnostics`、`valid` | 稳定诊断数组；仅当数组为空时 `valid` 为 `true`。 |

每个 diagnostic 固定包含 `code`、`file` 和 `message`；定位到 Markdown 行时另外包含 `line`。
`code` 的合法值为：

```text
change-directory-not-active-member
change-directory-not-found
change-directory-read-failed
change-path-not-directory
change-root-contains-repository
change-root-read-failed
duplicate-section
duplicate-task-id
empty-introduction
empty-section
file-read-failed
invalid-change-name
invalid-h1
invalid-metadata
invalid-task-syntax
missing-required-file
missing-section
missing-task
base-commit-unavailable
required-path-not-file
section-order
task-outside-required-section
version-control-failed
```

`show` 返回 `changeDirectory`、`changeName`、完整 `check` 和 `artifacts`。`artifacts` 固定包含
`proposal.md`、`design.md`、`tasks.md`；缺失、非普通文件或不可读的值为 `null`。`list` 返回
`changeRoot`、根级 `errors` 与 `entries`；`check-all` 返回 `entries`、`changeRoot`、根级 `errors`、
`checkedCount`、`validCount`、`invalidCount` 与集合 `valid`。

### 写入命令

| 命令 | 源状态与门禁 | 成功结果 |
| --- | --- | --- |
| `plan` | 规范 Draft 或 Plan；目标 Plan 的三个 artifacts 结构有效，当前仓库存在 `HEAD`。不以任何 checkbox 进度为门禁。 | 原子写入 `{ "stage": "plan", "baseCommit": "<当前 HEAD>" }`。 |
| `finalize` | 结构有效、基线可用且全部 checkbox 已完成的 Plan；完整 physical tree 必须与当前 `HEAD` 的同一路径 Git tree 精确匹配。 | 删除 Change 目录；或在 cleanup 无法证明完成时保留 tombstone child。 |

Git-tree 门禁确保当前 `HEAD` 保留全部任务完成的最终 Plan 与恢复所需内容；版本保存由执行者按
当前授权和项目流程完成。

对现有 Plan 运行 `plan` 前，由操作者完成语义复核；命令将调用时的 `HEAD` 记录为新基线。

**删除前条件：** `finalize --preflight` 执行与实际删除相同的 Plan、任务、Git-tree、同设备、tombstone target 和 identity 准备，零写入且不保存 receipt。实际 finalize 在 Change root 下使用私有 `.change-plan-tombstones`，重新核对 Plan/任务/base/HEAD 门禁；其两次准备的生命周期和 HEAD 快照必须一致。声明 tombstone child 前重验 root、source、tombstone 身份、当前 HEAD、完整 physical member 和 target absence。

**保护范围：** 只接受 Git regular file mode `100644`、`100755`，且每个 physical file 的字节及 owner executable bit 一致；symlink、submodule、特殊文件、空/未知目录、已修改、未跟踪或忽略成员均被拒绝。删除以前建立并验证不覆盖既有内容的 tombstone 快照；source 和快照须保持精确匹配。只清理已验证成员，并发 target 或成员漂移时不覆盖、不删除外来内容；不递归删除。

**恢复结果：** 以下 outcome 区分零写、未提交、完成和已提交但仍需清理；恢复位置和 revision 必须以实际结果为准。

`finalize --json` 始终返回 `sourceDirectory`、`check`、`changed`、`outcome`、`headCommit`、
`memberCount`、`tombstoneDirectory` 与 `error`。`outcome` 为：

- `preflight`：所有门禁和删除准备通过，未写入。
- `no-change`：任一门禁、准备、重验或 source 删除未提交，`changed: false`。若独占 target 已出现外来
  内容，`tombstoneDirectory` 指向只可人工检查的未提交声明路径。
- `finalized`：已验证复制且 source 与 tombstone 都已精确清理，`changed: true`、`tombstoneDirectory: null`。
- `committed-cleanup-pending`：已建立可验证 tombstone 副本，但 source 或 tombstone 的精确清理无法完成，
  `changed: true`，`tombstoneDirectory` 是唯一可操作的恢复位置。

finalize 不 stage、commit、reset、revert 或自动 Git restore；`headCommit` 是维护者可用普通 Git
恢复 source 的 revision。source 删除前失败不删除 source 成员；建立验证副本后失败不是 rollback 或完成，
维护者只可检查报告的 tombstone child，或从报告的 `HEAD` 用普通 Git 恢复。

### 退出码与输出

1. `0`：查询成功；`list` 中存在 invalid 成员不使发现操作失败；`check-all` 的合法空集合也成功；
   `finalize` 的 `preflight`、`finalized` 或 `committed-cleanup-pending` 也成功并在文本中明确 outcome。
2. `1`：查询根或目标不可用、结构或 Plan 基线无效、`check-all` 的任一成员无效，或 `plan` / `finalize`
   的领域门禁、准备、重验或写入失败。
3. `2`：CLI 参数无效，或命令不在上述六个命令中。

文本模式把成功结果写入 stdout，把诊断和失败写入 stderr。`committed-cleanup-pending` 在 stdout 明确输出
outcome、source、HEAD recovery revision、member count 与 precise tombstone，并在 stderr 输出 cleanup
diagnostic；JSON 保留同一结构并以 0 退出。
`--json` 把成功和领域失败的结构结果写入 stdout；非法参数始终写入 stderr。

### TS 直接导入边界

`scripts/change-plan.ts` 可以作为 ESM 直接 import，当前运行时导出 list、show、单项 check、集合
check、plan、finalize、metadata 解析与读取以及 CLI runner 对应的底层函数。该能力用于直接复用当前
实现，不建立稳定 SDK：`change-plan.ts` 不配套生成 `.d.mts`、SDK 声明树或 metadata JSON Schema，
也不承诺导出集合和函数签名跨版本兼容。需要稳定交互时使用本节定义的 CLI 与 JSON 输出；直接 import
的调用方需随当前实现同步调整。
