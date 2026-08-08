# 版本管理中间层

`tools/shared/src/version-control/` 是项目内版本管理责任的共享 owner。它向消费者暴露仓库、修订快照、待提交快照和工作区变化语义，并把 Git 库、命令输出、路径校验和错误映射限制在实现内部。

项目级源码与依赖边界见 [项目工具链](../../docs/tooling.md)。

## 当前契约

公共入口是 `tools/shared/src/version-control/index.ts`。`openVersionControl(startDirectory)` 返回 `VersionControlRepository`，当前能力包括：

1. 定位仓库根目录，读取当前 revision，并把 revision ref 解析为确定的 commit id。
2. 通过 `listFirstParentRevisionChanges({ from, to? })` 列出 first-parent
   范围内每个 revision 的路径与增删行数。`from` 不包含，`to` 包含且默认当前
   revision；结果从旧到新排列并保留无路径变化的 commit。文本行数是安全整数，
   Git 无法提供行数的二进制路径将两个计数都返回 `null`。
3. 列出 revision 文件、两个 revision 之间的路径变化，以及 revision 与 `pending` 之间的路径变化。
4. 读取 revision 中一个确定文件的内容；只有该 revision 确实不存在目标路径时返回 `null`。
5. 把仓库内绝对后代路径转换为规范化仓库相对路径，并拒绝相对路径、仓库根本身和仓库外路径。
6. 列出工作区文件和工作区变化。
7. 按字面仓库相对路径范围读取 `pending` 文件内容。
8. 通过 `replacePendingFiles({ expectedRevision, pathScope, files })` 用精确目标文件
   集合完整替换一个字面仓库相对路径范围：取得跨进程写入边界后，当前 revision 必须
   仍等于 `expectedRevision`；目标集合中缺失的范围内文件视为删除，范围外 `pending`
   内容保持不变。成功结果返回规范化的 `pathScope`、写入前 `previousPaths` 和写入后
   `pendingPaths`。

`revision` 表示已经提交的不可变版本；`pending` 表示准备进入下一版本的内容。首个 Git 实现在内部将 `pending` 映射到 index，公共参数、结果和错误不暴露该映射。工作区文件和工作区变化不是版本快照，通过独立查询暴露，三者不能互相替代。

## 实现边界

1. 默认实现使用 Git，并把具体 TypeScript Git 库限制在 `tools/shared/src/version-control/` 内部；当前契约不承诺兼容 SVN 或其他后端。
2. 公共接口只增加项目内已经存在的消费者所需能力。父 revision、批量 revision 内容读取或 provider 注册等能力没有现实消费者时不预建。
3. 只有 Git 返回常规非仓库结果且起点及其祖先不存在 Git 工作树标记时，仓库发现才报告 `not-repository`。Git 不可执行、起点不可访问、权限或安全目录限制、损坏的工作树元数据和异常发现输出都报告带有可用底层原因的操作失败，消费者不得把这些故障降级为非 Git 环境。
4. revision 无法解析、Git 读取失败或 revision 文件内容无法读取时必须失败；只有 Git 明确确认目标路径在该 revision 中不存在时，单文件读取才返回 `null`，并由消费者决定是否表示没有基线。
5. 路径校验、错误映射和确定性排序在中间层内完成，不交给领域消费者重复实现。
6. first-parent 变化使用 NUL 分隔协议读取 commit 边界和 numstat 路径，不依赖
   引号或换行切分。格式、行数或路径记录异常时报告 `operation-failed`；`from` 不在
   `to` 的 first-parent 历史中时报告 `revision-not-first-parent`，两者都不能降级为空
   结果。每个 merge revision 相对其 first parent 计算变化。
7. 范围替换在 Git index 的跨进程互斥边界内保存原范围、核对 revision、应用完整
   目标并逐路径、逐字节读回。revision 已变化或写入边界正被占用时报告
   `pending-conflict` 且不写入；其他写入或读回失败丢弃锁定目标并保留原范围，恢复
   完整后报告 `pending-replacement-failed`，无法确认完整恢复时报告
   `pending-recovery-failed`。调用方必须停止且不能回退到底层命令。
8. 目标文件统一作为普通文件写入，不沿用原 `pending` 的可执行或符号链接模式；只有
   失败恢复保留写入前快照的原始表示。
9. 公共写入参数、结果和错误只表达路径、文件内容、`pending` 替换与恢复状态；Git
   命令、index、对象标识、文件模式、锁和第三方实现对象只存在于内部实现。
10. `tools/shared/` 不依赖领域工具；消费者通过公共入口使用该中间层。

当前直接生产消费者包括 skill 打包 hash、独立版本门禁、change-plan 的 first-parent
距离评估，以及 decision-records 的 revision 基线读取与 `pending` 决策范围替换。
验证入口是：

```bash
bun run test:version-control
```
