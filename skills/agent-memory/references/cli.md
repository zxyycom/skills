# Agent Memory CLI 操作

## 调用

入口：`node <包目录>/scripts/agent-memory.ts`。先用 `--help` 查看命令和 JSON 字段。每次业务调用传入宿主绑定的项目根 `--root` 和库路径 `--db`，两者都用绝对路径。显式 `--db` 优先于 `AGENT_MEMORY_DB`。工具核对实际项目根和数据库 schema。

仅在获准初始化时执行 `init`，输入空对象。库路径的父目录须已存在且位于项目树外；初始化不会覆盖既有文件。

用标准输入或 `--input` 传一个 JSON 对象，`--json` 输出紧凑 JSON。输入只接受声明字段（含批次条目和关联），文本须为有效 Unicode。非零退出的诊断在 stderr，不表示空结果。参数、输入和日志不得含敏感值。

以下 PowerShell 7 示例中的 `$cli`、`$root`、`$db` 分别为 CLI 入口、项目根和库的绝对路径：

```powershell
@{ tags = @('<精确标签>'); terms = @('<原文片段>') } |
  ConvertTo-Json -Compress | node $cli recall --root $root --db $db --json
@{ id = '<候选 ID>' } |
  ConvertTo-Json -Compress | node $cli show --root $root --db $db --json
```

## 查询

- `recall` 至少提供一条线索。标签精确匹配，标题和正文按字面子串匹配。当前可用的单元任一线索匹配即入选；按不同线索数降序、同分按 ID 排序。默认返回前 10 项；`truncated: true` 表示还有候选；`items: []` 表示本次查询成功但未命中。
- `show` 省略 `version` 读取当前结果：`current` 表示当前版及其前提可用，`blocked` 返回阻断原因及相关单元。只有 `current` 返回可供采用的正文，实际适用性仍由任务判断。显式指定 `version` 返回 `historical`；`latest` 表示该版是最新版本，`usable` 表示同时为最新版且通过有效性校验。

## 写入

- `save` 创建稳定 ID。`reason` 可省略（默认为空字符串）；批量保存只在外层传 `requestId`。拆分在同一批中给每个继任单元添加指向当前原单元的 `splits` 关系；替代和拆分退役原单元。
- `revise` 修改活动单元，`review` 复核活动或待复核单元，均核对 `expectedVersion`。新增或明确改用构成关系时，引用当前可用的确切版本；省略 `edges` 保留原关系，提交为活动状态时仍校验整条依赖链。空数组明确移除关系。`composition` 传播失效，一般关联不传播。
- `close` 结束活动或待复核意图，只更新状态及结项理由，保留正文、出处和关系。显式读取结项版本可核对。
- 写入原子提交。失败不新增版本、不占用新请求 ID；已提交请求可用同一 `requestId` 重放相同操作和输入。遇到不同输入或预期版本冲突，先核对当前结果；未知是否提交时不要换 ID 重试。

输入中的 `tags`、`terms` 或 `edges` 为 `null` 时按省略处理。新建未指定的标签和关联为空；修订、复核未指定的字段保留原值。

## 遗忘预览与提交

1. **预览。** `forget` 只传 `id` 和 `action`。`units` 列出目标和本次影响的其他单元，及其预览时的当前版本和状态。
   - `disable`（停用）、`hide`（隐藏）：目标须为活动或待复核单元；其他单元仅列当前新受阻的直接或间接构成依赖项。`removedReferences` 为空。
   - `purge`（库内清除）：范围沿当前和历史构成关系递归扩展，删除列出单元的全部版本。`removedReferences` 列出将从保留单元移除的关系及其来源版本。
2. **提交。** 沿用预览的 `id` 和 `action`，添加唯一 `requestId`，把 `token` 传为 `confirm`。停用和隐藏须传目标 `expectedVersion`；清除可省略，传入时也校验。清除须经用户明确确认该预览。若预览范围、相关版本或状态变化导致拒绝，重新预览并确认。
3. **验证。** 停用和隐藏只改目标状态；受影响的组合无法当前采用，显式历史仍可读。清除后不能读取或召回被清除单元，已撤销的请求不能重放。清除仅覆盖绑定库中的逻辑数据，不是对外部副本、备份或存储介质的擦除。

## 运行时准备

CLI 和 updater 使用 Node.js 24.18 或更高版本，以及随包 `package.json` 声明的兼容依赖。已有兼容依赖可直接使用；需要安装时，获授权后使用 manifest 固定的 pnpm 版本在包目录执行：

```text
pnpm --dir "<包目录绝对路径>" install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated
```

工具不会在调用时自动安装依赖。包资源、manifest 或锁文件损坏时，重新取得完整包。
