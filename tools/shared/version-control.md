# 版本管理中间层

`tools/shared/src/version-control/` 是项目内版本管理责任的共享 owner。它向消费者暴露仓库、修订快照、待提交快照和工作区变化语义，并把 Git 库、命令输出、路径校验和错误映射限制在实现内部。

项目级源码与依赖边界见 [项目工具链](../../docs/tooling.md)。

## 当前契约

公共入口是 `tools/shared/src/version-control/index.ts`。`openVersionControl(startDirectory)` 返回 `VersionControlRepository`，当前能力包括：

1. 定位仓库根目录和读取当前 revision。
2. 列出 revision 文件及两个 revision 之间的路径变化。
3. 列出工作区文件和工作区变化。
4. 按字面仓库相对路径范围读取 `pending` 文件内容。

`revision` 表示已经提交的不可变版本；`pending` 表示准备进入下一版本的内容，Git 实现将其映射到 index。工作区文件和工作区变化不是版本快照，通过独立查询暴露，三者不能互相替代。

## 实现边界

1. 默认实现使用 Git，并把具体 TypeScript Git 库限制在 `tools/shared/src/version-control/` 内部；当前契约不承诺兼容 SVN 或其他后端。
2. 公共接口只增加项目内已经存在的消费者所需能力。父 revision、单文件读取或 provider 注册等能力没有现实消费者时不预建。
3. 路径校验、错误映射和确定性排序在中间层内完成，不交给领域消费者重复实现。
4. `tools/shared/` 不依赖领域工具；消费者通过公共入口使用该中间层。

当前消费者包括 skill 打包 hash、Decision Records 的 `HEAD` 路径判断和 Test Evidence 的 Git 范围读取。验证入口是：

```bash
bun run test:version-control
```
