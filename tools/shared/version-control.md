# 版本管理中间层

`tools/shared/src/version-control/` 是项目内版本管理责任的共享 owner。它向消费者暴露仓库、修订快照、待提交快照和工作区变化语义，并把 Git 库、命令输出、路径校验和错误映射限制在实现内部。

项目级源码与依赖边界见 [项目工具链](../../docs/tooling.md)。

## 当前契约

通用仓库入口是 `tools/shared/src/version-control/index.ts`。`openVersionControl(startDirectory)`
返回 `VersionControlRepository`，承接 revision、pending 与 workspace 操作。

First-parent 枚举由专用子模块 `tools/shared/src/version-control/git-first-parent.ts` 的
`listResolvedFirstParentRevisionChanges(repository, { from, to })` 承接，Change Plan 直接导入该操作。
调用方提供同一仓库已解析的 commit ID；操作核对 ID 格式后读取历史，返回只读提交与路径变化事实。
该操作属于专用子模块，通用仓库入口与 `VersionControlRepository` 保持原有边界。

当前能力包括：

1. 定位仓库根目录，读取当前 revision，并把 revision ref 解析为确定的 commit id。
2. 按显式 commit ID 范围列出 first-parent 历史内每个 revision 的路径与增删行数。
   `from` 不包含，`to` 包含；结果从旧到新排列并保留无路径变化的 commit。文本行数是安全整数，
   Git 无法提供行数的二进制路径将两个计数都返回 `null`；`from` 不在 `to` 的
   first-parent 历史中时，整个操作返回 `null` 表示范围不可用。
3. 列出 revision 文件、两个 revision 之间的路径变化，以及 revision 与 `pending` 之间的路径变化。
4. 通过 `readRevisionFiles(revision, { pathScopes? })` 批量读取 revision 文件内容。每个范围是字面仓库相对文件或目录路径；省略或传入空范围时读取整个 revision，多个范围取并集，没有匹配时返回空数组。结果按规范仓库路径稳定排序，保留普通文件、可执行文件和符号链接的字节与文件表示；Gitlink、非 blob 或异常 tree 记录，以及 tree 或对象读取失败均报告 `operation-failed`；不存在的 revision 保持既有 `revision-not-found` 语义。
5. 读取 revision 中一个确定文件的内容；只有该 revision 确实不存在目标路径时返回 `null`。
6. 通过通用入口导出的 `repositoryRelativePathFromFileSystemPath(rootDirectory, fileSystemPath)`，把仓库内绝对后代路径转换为规范化仓库相对路径，并拒绝相对路径、仓库根本身和仓库外路径。
7. 通过 `listWorkspaceFiles({ pathScopes? })` 列出工作区中已经跟踪或未被 ignore 排除的未跟踪文件。省略 `pathScopes` 时返回完整集合；提供范围时，每个值都是字面仓库相对文件或目录路径，结果取各范围的并集。已经跟踪的文件即使后来命中 ignore 仍保留在结果中。
8. 独立列出工作区变化；工作区文件集合与变化集合不互相替代。
9. 按字面仓库相对路径范围读取 `pending` 文件快照。
10. 通过 `replacePendingFiles({ expectedRevision, expectedFiles?, pathScope, files })`，以精确目标文件集合完整替换一个字面仓库相对路径范围，按下文核对前提和结果。
11. 通过 `readWorkspaceFile(path)` 读取常规非符号链接工作区文件的字节与有效文件表示；`readWorkspaceFiles(paths)` 对显式文件路径集合在一次调用内批量取得同一新读策略与 pending 表示依据。

`revision` 表示已经提交的不可变版本；`pending` 表示准备进入下一版本的内容。首个 Git 实现在内部将 `pending` 映射到 index，公共参数、结果和错误不暴露该映射。工作区文件和工作区变化不是版本快照，通过独立查询暴露，三者不能互相替代。

### 文件快照与表示

每个 `VersionControlFile` 必须携带 `path`、`data` 与 `kind`。`kind` 表达文件表示，不表达完整 POSIX 权限或原始 Git 模式：

| `kind` | 文件表示 |
| --- | --- |
| `regular` | 非可执行常规文件 |
| `executable` | 可执行常规文件 |
| `symlink` | 符号链接，`data` 保存链接目标的原始字节 |

消费者保留既有快照时整体传递这三个字段；生成普通文件时显式声明 `regular`。目标按声明的 `kind` 写入。`changedPendingPaths` 识别字节或表示变化，以及增加和删除。

### 范围替换的前提与结果

取得跨进程写入边界后，当前 revision 必须等于 `expectedRevision`。`expectedFiles` 的含义如下：

| 输入 | 必须满足的前提 |
| --- | --- |
| 省略 `expectedFiles` | 只设置 revision 前提，不设置文件期望 |
| `expectedFiles: []` | 范围内没有 pending 文件 |
| 非空 `expectedFiles` | 范围内完整路径集合、字节与 `kind` 等于期望快照 |

仅表示变化也属于期望漂移。Gitlink 或未解决内容不满足文件期望；合法可执行文件和符号链接按其期望表示核对。

目标集合中缺失的范围内文件视为删除，范围外 pending 内容与表示保持不变。成功结果返回规范化 `pathScope`、写前 `previousPaths` 和写后 `pendingPaths`。

### 工作区有效文件表示

`readWorkspaceFile(path)` 接受规范仓库相对路径，只读取常规非符号链接来源，返回字节与 `regular` 或 `executable` 表示。只有来源确实不存在时返回 `null`；来源类型、字节或有效表示无法读取时报告 `operation-failed`。读取保持 workspace 和 pending 不变。

`readWorkspaceFiles(paths, options?)` 批量读取显式文件路径。调用方先按所需范围发现成员，再传入文件路径集合；批量读取本身不发现目录成员。

- 路径归一化、去重并稳定排序；空集合与全缺失集合返回空数组，均不探测 Git。缺失文件省略，其他边界失败阻断整个结果。
- 每次调用重新取得工作区类型、字节与配置，至多读取一次 `core.fileMode`；每个来源仍单独核对常规非符号链接类型并读取字节。单次批量读取不承诺跨文件原子快照，也不建立跨调用缓存。
- `core.fileMode` 关闭时，表示依据按下表取得；调用方需要准备／写前两阶段保护时，每阶段分别取得新 pending 依据。

| pending 依据 | 获取与失败责任 |
| --- | --- |
| 省略 `options.pendingFiles` | adapter 为所选现存来源取得一次新的 pending 表示依据。 |
| 显式 `options.pendingFiles` | 调用方提供本阶段已取得、覆盖全部显式路径的完整 pending 快照；adapter 直接使用，省去重复读取。路径缺失表示该阶段没有条目，不自动补读；重复或非法的所选表示仍失败。完整性与阶段新鲜度由调用方负责。 |

Git adapter 按 `core.fileMode` 确定有效执行位：

| 策略 | 有效表示 |
| --- | --- |
| 启用或未配置 | 使用工作区用户执行位 |
| 关闭，同路径存在唯一 stage-0 常规 pending 文件 | 保留其 `regular` 或 `executable` 表示 |
| 关闭，同路径没有 pending 条目 | 使用 `regular` |

配置无效或读取失败，以及关闭策略时 pending 含未解决、链接或其他非文件表示，均停止读取并报告 `operation-failed`。

## 运行时诊断与恢复边界

`VersionControlError` 是共享层的结构化失败事实：`code` 标识操作事件，
`causeCategory` 只在有可靠信号时细分原因，`operation`、`target` 和经净化的
`detail` 用于定位。`detail` 会收窄换行、长度、绝对路径和常见凭据，消费者不能把原始
异常、命令输出或底层对象直接回显给操作者。

共享层只说明版本控制操作及其原因，不拥有领域事务的写入范围或最终结果。调用方只有在
自己能够证明一次 mutation 的范围与提交/恢复状态时，才能附加 `scope` 和 `outcome`；
不得把普通读取、校验或参数错误伪装成 mutation 结果。

遇到 access、busy、tool 或恢复类诊断时，操作者应先处理当前进程权限、活动进程、工具
可用性或已报告的范围状态。共享层和消费者都不得建议 `sudo`、自动删除锁文件，或在未
重新观察当前事实前自动重试。`pending-recovery-failed` 仍按本文件后文的唯一读取与显式
对账条件恢复。

## 实现边界

1. 默认实现使用 Git，并把具体 TypeScript Git 库限制在 `tools/shared/src/version-control/` 内部；当前契约不承诺兼容 SVN 或其他后端。
2. 共享能力只增加项目内已经存在的消费者所需边界，或项目明确选定、具有独立快照、路径、内容或文件表示契约的基础原语。First-parent 枚举保持在专用子模块中，并作为接收仓库对象的独立操作供 Change Plan 使用；批量 revision 内容读取与工作区有效文件表示读取属于这类基础原语，当前分别由 Decision Records 与 Investigation Report 消费。除这类基础原语外，不为单一消费者扩张 `VersionControlRepository` 或通用仓库入口；父 revision 或 provider 注册等能力没有现实消费者时不预建。
3. 只有 Git 返回常规非仓库结果且起点及其祖先不存在 Git 工作树标记时，仓库发现才报告 `not-repository`。Git 不可执行、起点不可访问、权限或安全目录限制、损坏的工作树元数据和异常发现输出都报告带有可用底层原因的操作失败，消费者不得把这些故障降级为非 Git 环境。
4. revision 无法解析、Git 读取失败或 revision 文件内容无法读取时必须失败；只有 Git 明确确认目标路径在该 revision 中不存在时，单文件读取才返回 `null`，并由消费者决定是否表示没有基线。
5. 路径校验、错误映射和确定性排序在中间层内完成，不交给领域消费者重复实现。
6. first-parent 变化使用 NUL 分隔协议读取 commit 边界和 numstat 路径，不依赖
   引号或换行切分。Git 命令、格式、行数或路径记录异常时报告 `operation-failed`，
   不能降级为空结果；只有完整输出表明 `from` 不在 `to` 的 first-parent 历史中时
   返回 `null`。每个 merge revision 相对其 first parent 计算变化。
7. Git adapter 在 index 互斥边界内核对上述替换前提，再构造目标；条目复用要求 stage-0、同路径、同字节和同目标模式。目标 entries 完全相同时清理未发布的锁并成功返回；有变化时核对读回条目的路径、模式、对象及字节后才发布。前提漂移或写入边界忙碌返回 `pending-conflict`；其他写入或读回失败丢弃锁定目标并保留原范围，恢复完整后返回 `pending-replacement-failed`，恢复无法确认时返回 `pending-recovery-failed`。
8. Git 外部记录 parser 只解码并收窄记录形状，不决定公共失败语义。pending 读取遇到
   未解决、重复或非文件表示时报告 `operation-failed`；带 `expectedFiles` 的替换先核对
   成员和期望文件表示，不满足时在读取对象字节前报告 `pending-conflict`；未设置该期望
   的替换若无法读取原范围，按可恢复替换失败报告 `pending-replacement-failed`。
   外部记录中的路径不能规范化时报告 `operation-failed`；调用方传入的非法 `pathScope`
   或文件路径仍报告 `invalid-path`。
9. 公共参数、结果和错误表达路径、内容、文件表示、`pending` 替换与恢复状态；
    Git 模式值、命令、index、对象标识、锁和第三方实现对象只存在于内部实现。
10. `tools/shared/` 不依赖领域工具；消费者按本文件声明的通用入口或专用共享子模块使用该中间层。

收到 `pending-recovery-failed` 后，只有目标范围能由本层公共 API 唯一读取，且调用方已经
把当前内容与原期望和本次目标显式对账或恢复，才能重试。若范围含未解决或其他无法唯一
读取的表示，或调用方无法判定当前内容，必须停止并交给该范围的 owner；不得调用底层
Git 命令绕过公共读取和恢复语义。

当前直接生产消费者包括 skill 打包 hash、独立版本门禁、change-plan 的 first-parent 距离评估、decision-records 的基线读取与决策范围替换、investigation-report 的来源读取与调查范围替换，以及 index-runtime 和 task-graph 的基线读取与受期望保护的单索引替换。
验证入口是：

```bash
bun run test:version-control
```
