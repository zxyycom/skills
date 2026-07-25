# 版本管理中间层

`tools/shared/src/version-control/` 是项目内版本管理责任的共享 owner。它向消费者暴露仓库、修订快照、待提交快照和工作区变化语义，并把 Git 库、命令输出、路径校验和错误映射限制在实现内部。

项目级源码与依赖边界见 [项目工具链](../../docs/tooling.md)。

## 当前契约

公共入口是 `tools/shared/src/version-control/index.ts`。`openVersionControl(startDirectory)` 返回 `VersionControlRepository`，当前能力包括：

1. 定位仓库根目录，读取当前 revision，并把 revision ref 解析为确定的 commit id。
2. 列出 revision 文件、两个 revision 之间的路径变化，以及 revision 与 `pending` 之间的路径变化。
3. 读取 revision 中一个确定文件的内容；只有该 revision 确实不存在目标路径时返回 `null`。
4. 列出工作区文件和工作区变化。
5. 按字面仓库相对路径范围读取 `pending` 文件内容。

`revision` 表示已经提交的不可变版本；`pending` 表示准备进入下一版本的内容，Git 实现将其映射到 index。工作区文件和工作区变化不是版本快照，通过独立查询暴露，三者不能互相替代。

## 实现边界

1. 默认实现使用 Git，并把具体 TypeScript Git 库限制在 `tools/shared/src/version-control/` 内部；当前契约不承诺兼容 SVN 或其他后端。
2. 公共接口只增加项目内已经存在的消费者所需能力。父 revision、批量 revision 内容读取或 provider 注册等能力没有现实消费者时不预建。
3. revision 无法解析、Git 读取失败或 revision 文件内容无法读取时必须失败；只有 Git 明确确认目标路径在该 revision 中不存在时，单文件读取才返回 `null`，并由消费者决定是否表示没有基线。
4. 路径校验、错误映射和确定性排序在中间层内完成，不交给领域消费者重复实现。
5. `tools/shared/` 不依赖领域工具；消费者通过公共入口使用该中间层。

当前直接生产消费者是 skill 打包 hash 与独立版本门禁。验证入口是：

```bash
bun run test:version-control
```
