# Agent Memory CLI 操作

## 运行时准备

CLI 和 updater 需要 Node.js ≥24.18 与随包 `package.json` 声明的兼容依赖，其中 CLI 使用 `valibot`。可复用可解析的兼容依赖；需要补齐依赖或复现包版本时，由准备者按授权在包目录使用 manifest 固定的 pnpm 版本安装：

```text
pnpm --dir "<包目录绝对路径>" install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated
```

CLI 和 updater 不自动安装依赖。包内容、manifest 或锁文件损坏时，重新取得完整包。

## 入口与固定绑定

入口为 `node <包目录>/scripts/agent-memory.ts`；用 `--help` 查看当前包支持的命令和 JSON 字段。

每次业务调用使用宿主绑定的项目根 `--root` 和库 `--db`，均为绝对路径。显式 `--db` 优先于 `AGENT_MEMORY_DB`。只有 `init` 能在已有、获授权的项目树外目录创建库，不覆盖已有文件。后续调用核对实际项目根和 schema。

JSON 可经标准输入或 `--input` 传入，用 `--json` 获取机器结果。新写入和遗忘预览拒绝未声明的字段，包括批次条目和关联中的字段；`init` 使用空对象。参数、输入和日志不得含敏感值。以下 PowerShell 7 调用中的 `$cli`、`$root`、`$db` 分别为入口、项目根、库的绝对路径：

```powershell
@{ tags = @('<精确标签>'); terms = @('<短原文线索>') } |
  ConvertTo-Json -Compress | node $cli recall --root $root --db $db --json
@{ id = '<候选 ID>' } |
  ConvertTo-Json -Compress | node $cli show --root $root --db $db --json
```

## 查询结果

- `recall` 至少提供一条线索；任一线索匹配即入选，结果按命中数降序、同分按 ID 排序。默认返回前十项；`truncated: true` 表示还有候选；`items: []` 表示本次查询成功但未命中。
- `show` 不带 `version` 用于当前读取。`status: "current"` 表示库内版本和前提可用；`status: "blocked"` 返回阻断原因和相关单元，不返回正文。显式传 `version` 返回 `status: "historical"`：`latest` 表示是否最新，`usable` 表示同时最新且通过有效性校验。采用时始终走当前读取。
- 非零退出附诊断，不能当无命中。核对原绑定或输入，不用建库或换库恢复查询。

## 写入与控制

- `save` 创建稳定 ID；批量保存只在外层传 `requestId`，各个 `items` 条目只传内容字段。`revise`、`review`、`close` 校验预期版本。只用 `composition` 表达会传播失效的构成依赖；采用前提时引用当前可用版本。替代或拆分会退役原单元。
- 写入在事务中生效。被拒绝的操作不占用新请求 ID、不生成版本、不部分提交。已提交的 `requestId` 仅重放相同操作和内容；不同内容或预期版本过时会冲突。结果未知时先核对后态，不换 ID 重做。
- `close` 结束活动或待复核意图，不改正文、出处或关系。当前读取可核对阻断原因；回看结项说明或原证据时显式读取相应版本。

### 遗忘预览与提交

1. **预览。** `forget` 只传 `id` 和 `action`（`disable` 停止使用、`hide` 停止召回、`purge` 库内清除）。`units` 始终列出目标，并按操作列出以下其他单元；每项显示预览时的当前版本和状态。
   - 停用、隐藏：目标须处于活动或待复核状态。只列出会因目标变化而新失去当前可用性的直接或间接构成依赖项。仅属历史的依赖，以及本来已受阻的单元，不列入此范围。`removedReferences` 为空。
   - 清除：沿历次版本的构成关系递归找依赖项，即使其当前版已解除依赖也包含。清除会删除列出的单元及其全部版本；`removedReferences` 列出将从保留单元移除的关联及来源版本。
2. **提交。** 确认授权后沿用预览的 `id` 和 `action`，添加唯一 `requestId`，并把 `token` 传为 `confirm`。令牌只适用于该目标、动作和预览范围。`disable` 和 `hide` 必须传目标 `expectedVersion`；`purge` 可省略，传入时也校验。清除须经用户明确确认该预览；若范围或版本变化导致拒绝，重新预览并确认。
3. **核对后态。** 停用和隐藏只改目标状态，不改其他单元状态或删除任何版本；受影响构成依赖项的当前读取不返回可采用正文，显式历史仍可读。清除后既不能读取或召回被清除单元，也不能重试被撤销的 `requestId` 恢复它们。
