# 版本管理中间层

`tools/shared/src/version-control/` 是项目内版本管理责任的共享 owner。它向消费者暴露仓库、修订快照、待提交快照和工作区变化语义，并把 Git 库、命令输出、路径校验和错误映射限制在实现内部。

项目级源码与依赖边界见 [项目工具链](../../docs/tooling.md)。

## 当前契约

通用仓库入口是 `tools/shared/src/version-control/index.ts`。`openVersionControl(startDirectory)` 返回 `VersionControlRepository`；仓库对象负责 revision、pending 与 workspace 操作。First-parent 枚举由专用共享子模块 `tools/shared/src/version-control/git-first-parent.ts` 的独立操作 `listFirstParentRevisionChanges(repository, { from, to? })` 承接，Change Plan 直接导入该子模块；它不是 `VersionControlRepository` 方法，也不由通用仓库入口导出。

当前能力包括：

1. 定位仓库根目录，读取当前 revision，并把 revision ref 解析为确定的 commit id。
2. 通过独立操作 `listFirstParentRevisionChanges(repository, { from, to? })` 列出 first-parent
   范围内每个 revision 的路径与增删行数。`from` 不包含，`to` 包含且默认当前
   revision；结果从旧到新排列并保留无路径变化的 commit。文本行数是安全整数，
   Git 无法提供行数的二进制路径将两个计数都返回 `null`；`from` 不在 `to` 的
   first-parent 历史中时，整个操作返回 `null` 表示范围不可用。
3. 列出 revision 文件、两个 revision 之间的路径变化，以及 revision 与 `pending` 之间的路径变化。
4. 通过 `readRevisionFiles(revision, { pathScopes? })` 批量读取 revision 文件内容。每个范围是字面仓库相对文件或目录路径；省略或传入空范围时读取整个 revision，多个范围取并集，没有匹配时返回空数组。结果按规范仓库路径稳定排序，保留普通文件、可执行文件和符号链接的字节；Gitlink、非 blob 或异常 tree 记录，以及 tree 或对象读取失败均报告 `operation-failed`；不存在的 revision 保持既有 `revision-not-found` 语义。
5. 读取 revision 中一个确定文件的内容；只有该 revision 确实不存在目标路径时返回 `null`。
6. 通过通用入口导出的 `repositoryRelativePathFromFileSystemPath(rootDirectory, fileSystemPath)`，把仓库内绝对后代路径转换为规范化仓库相对路径，并拒绝相对路径、仓库根本身和仓库外路径。
7. 通过 `listWorkspaceFiles({ pathScopes? })` 列出工作区中已经跟踪或未被 ignore 排除的未跟踪文件。省略 `pathScopes` 时返回完整集合；提供范围时，每个值都是字面仓库相对文件或目录路径，结果取各范围的并集。已经跟踪的文件即使后来命中 ignore 仍保留在结果中。
8. 独立列出工作区变化；工作区文件集合与变化集合不互相替代。
9. 按字面仓库相对路径范围读取 `pending` 文件内容。
10. 通过 `replacePendingFiles({ expectedRevision, expectedFiles?, pathScope, files })`
   用精确目标文件集合完整替换一个字面仓库相对路径范围：取得跨进程写入边界后，当前
   revision 必须仍等于 `expectedRevision`。省略 `expectedFiles` 表示不设置内容期望；
   传入时，范围内 `pending` 文件必须仍是同一组普通非可执行文件，路径与字节也与该
   集合完全相同，其中空集合表示范围内必须没有文件。可执行文件、符号链接、Gitlink
   或未解决内容等非普通表示不满足期望。目标集合中缺失的范围内文件视为删除，范围外
   `pending` 内容保持不变。成功结果返回规范化的
   `pathScope`、写入前 `previousPaths` 和写入后 `pendingPaths`。

`revision` 表示已经提交的不可变版本；`pending` 表示准备进入下一版本的内容。首个 Git 实现在内部将 `pending` 映射到 index，公共参数、结果和错误不暴露该映射。工作区文件和工作区变化不是版本快照，通过独立查询暴露，三者不能互相替代。

## 实现边界

1. 默认实现使用 Git，并把具体 TypeScript Git 库限制在 `tools/shared/src/version-control/` 内部；当前契约不承诺兼容 SVN 或其他后端。
2. 共享能力只增加项目内已经存在的消费者所需边界，或项目明确选定、具有独立 revision/path/bytes 契约的基础原语。First-parent 枚举保持在专用子模块中，并作为接收仓库对象的独立操作供 Change Plan 使用；批量 revision 内容读取属于这类基础原语，当前由 Decision Records 消费。除这类基础原语外，不为单一消费者扩张 `VersionControlRepository` 或通用仓库入口；父 revision 或 provider 注册等能力没有现实消费者时不预建。
3. 只有 Git 返回常规非仓库结果且起点及其祖先不存在 Git 工作树标记时，仓库发现才报告 `not-repository`。Git 不可执行、起点不可访问、权限或安全目录限制、损坏的工作树元数据和异常发现输出都报告带有可用底层原因的操作失败，消费者不得把这些故障降级为非 Git 环境。
4. revision 无法解析、Git 读取失败或 revision 文件内容无法读取时必须失败；只有 Git 明确确认目标路径在该 revision 中不存在时，单文件读取才返回 `null`，并由消费者决定是否表示没有基线。
5. 路径校验、错误映射和确定性排序在中间层内完成，不交给领域消费者重复实现。
6. first-parent 变化使用 NUL 分隔协议读取 commit 边界和 numstat 路径，不依赖
   引号或换行切分。Git 命令、格式、行数或路径记录异常时报告 `operation-failed`，
   不能降级为空结果；只有完整输出表明 `from` 不在 `to` 的 first-parent 历史中时
   返回 `null`。每个 merge revision 相对其 first parent 计算变化。
7. 范围替换在 Git index 的跨进程互斥边界内依次核对 current revision、保存原范围、
   核对可选期望集合的成员与普通文件表示、读取并核对字节、构造完整目标。内部只可复用锁内
   已验证为 stage-0、普通非可执行、同路径且同字节的当前条目；其余目标创建普通文件表示。
   只有完成上述核对和目标构造后，若目标 entries 与当前范围完全相同，操作才清理未发布的锁
   并成功返回；否则逐路径逐字节读回，最后才发布结果。revision 或期望文件已变化，或写入边界正被占用时报告
   `pending-conflict`，且在读取非普通表示或创建目标内容前停止；其他写入或读回失败丢弃
   锁定目标并保留原范围，恢复完整后报告 `pending-replacement-failed`；无法确认完整恢复时
   报告 `pending-recovery-failed`。`pending-conflict` 是三类冲突条件的统一分类，不承诺
   指出具体原因；消费者必须重新观察公共 revision 与 `pending` 状态，不得检查底层实现
   来分流；重新观察后可按最新状态重试。`pending-recovery-failed` 的停止与恢复条件由
   下文承接；所有失败均不得绕过本层调用底层 Git。
8. Git 外部记录 parser 只解码并收窄记录形状，不决定公共失败语义。pending 读取遇到
   未解决、重复或非文件表示时报告 `operation-failed`；带 `expectedFiles` 的替换先核对
   成员和普通文件表示，不满足时在读取对象字节前报告 `pending-conflict`；未设置该期望的
   替换若无法读取原范围，则按可恢复替换失败报告 `pending-replacement-failed`。写入后的
   读回也先核对记录集合，再读取对象字节。外部记录中的路径不能规范化时属于记录解析
   失败并报告 `operation-failed`；调用方传入的非法 `pathScope` 或文件路径仍报告
   `invalid-path`。
9. 目标文件统一作为普通文件写入，不沿用原 `pending` 的可执行或符号链接模式；只有
   失败恢复保留写入前快照的原始表示。
10. 公共写入参数、结果和错误只表达路径、文件内容、`pending` 替换与恢复状态；Git
   命令、index、对象标识、文件模式、锁和第三方实现对象只存在于内部实现。
11. `tools/shared/` 不依赖领域工具；消费者按本文件声明的通用入口或专用共享子模块使用该中间层。

收到 `pending-recovery-failed` 后，只有目标范围能由本层公共 API 唯一读取，且调用方已经
把当前内容与原期望和本次目标显式对账或恢复，才能重试。若范围含未解决或其他无法唯一
读取的表示，或调用方无法判定当前内容，必须停止并交给该范围的 owner；不得调用底层
Git 命令绕过公共读取和恢复语义。

当前直接生产消费者包括 skill 打包 hash、独立版本门禁、change-plan 的 first-parent
距离评估、decision-records 的 revision 基线读取与 `pending` 决策范围替换，以及
index-runtime 按 ID 暂存和 task-graph 按 task ID 暂存时的 revision 基线读取与受期望
保护的单索引替换。
验证入口是：

```bash
bun run test:version-control
```
