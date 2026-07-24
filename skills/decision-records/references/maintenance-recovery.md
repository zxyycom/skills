# 决策记录维护恢复

本手册只在 CLI/Node 不可用、索引缺失或损坏、写入中断，或严格 `check` 失败且普通诊断不足时读取。格式、状态和 CLI 的精确契约始终以 `decision-record-rules.md` 为准。`--root` 只作为默认位置和相对 `--decisions-dir` 的解析基准；解析后的决策根目录必须位于能够读取 `HEAD` 的 Git 仓库。本手册不提供非 Git 模式。

## 恢复目标

保留全部当前格式 Markdown 及其权威 frontmatter、完整正文和关系，恢复可运行的当前 CLI，并从 Markdown 重建 `schemaVersion: 1`、`namespace: decisions`、`definitionVersion: 2` 的当前通用索引，让严格 `check` 返回 `0`。不要从损坏索引反向覆盖有效 Markdown，不要为消除错误删除无法解释的记录。

## 先判断故障类型

1. 按 `--root` 和可选的 `--decisions-dir` 解析决策根目录，确认该目录位于 Git 仓库内并能读取 `HEAD` 路径；Git 前提不满足时停止。
2. 决策根目录整体不存在且项目从未记录决策时，集合只是尚未初始化。
3. Markdown 均为当前格式而索引缺失、无法解析、投影漂移或成员不完整时，按“重建索引”处理。
4. Markdown 自身元数据、正文或关系无效时，按诊断修复对应事实源；索引不能替代缺失判断。
5. 上次状态命令疑似中断时，按“恢复写入中断”比较工作区和 Git 中最后完整组合。
6. CLI 或 Node 无法启动时，从“恢复可用工具”选择当前条件下最直接的路径。

## 恢复可用工具

### 使用替代运行时

1. `scripts/decision-records.mjs` 完整但 Node 不可用时，可以从 skill 目录使用已有 Node 兼容运行时，例如 `bun scripts/decision-records.mjs check --root <resolution-root>`。
2. 运行时能够启动 CLI 后继续使用同一 MJS 和固定契约，不维护第二套长期脚本。
3. 目标程序已经返回明确的模块、文件、参数或结构错误时，按真实错误处理，不继续更换运行时猜测。

### 使用随包更新器

1. Node 或兼容运行时可用但 CLI 或分发文件损坏时，先运行 `node scripts/update-skill.mjs --check`，再运行 `node scripts/update-skill.mjs --yes` 整体替换当前 skill。
2. 更新器校验 release 中的 skill 指纹并替换完整目录，避免单独复制 MJS、声明或 Schema 形成不一致组合。

### 从 release 或源码恢复

1. 已安装 skill 可以从 [latest release](https://github.com/zxyycom/skills/releases/latest) 下载 `decision-records.zip`，确认包含完整 `decision-records/` 后整体替换。
2. 需要从源码重建时，在主仓库安装锁定依赖并运行：

   ```text
   pnpm install --frozen-lockfile
   bun run sync:decision-records-cli
   ```

3. 构建结果包括 `skills/decision-records/scripts/decision-records.mjs`、类型声明、source map 和当前索引 JSON Schema；按完整 skill 目录交付。
4. 网络不可用但 source map 仍完整时，可以按 `sources` 与 `sourcesContent` 恢复 TypeScript 源；声明文件用于确认公开 API。

## 重建索引

1. 先保留当前索引副本或确认 Git 中存在可回退版本。
2. 完整校验每条 Markdown 的 frontmatter、正文和关系。标题、状态、对齐、创建时间、三项摘要和直接关系只取对应 Markdown frontmatter；索引只做投影，不从文件名、正文或文件时间推断这些字段。
3. 运行：

   ```text
   node scripts/decision-records.mjs sync-index --write --root <resolution-root>
   node scripts/decision-records.mjs check --root <resolution-root>
   ```

4. `sync-index --write` 从全部有效 Markdown 生成完整领域 state、派生 keys 和 source revision，通过通用索引同步原子替换文件。Markdown 无效或 Git 边界不满足时命令失败且保留原索引。
5. 如果某条 Markdown 缺少权威状态或时间，不构造默认值；从 Git 中最后一个可信的当前格式版本恢复该文件，无法恢复时请求用户判断。

## 恢复写入中断

1. 比较当前 Markdown、索引、工作区 diff 和 Git 中最后有效版本，确定状态命令是否留下了不完整组合。
2. Markdown 已形成完整一致的新状态时，以 Markdown 为事实源运行 `sync-index --write`；Markdown 只更新了一部分或目标含义无法确认时，先从 Git 恢复命令前的完整文件组合。
3. 不根据部分更新的索引反向修改 Markdown，也不把关系存在解释为生命周期或对齐状态已经变化。
4. 恢复后运行严格 `check`，再核对受影响记录的 `show` 和必要的 `trace`。

## 工具恢复前停止索引维护

1. 当前 CLI 和兼容运行时都无法执行时，保留 Markdown 与现有索引，不直接构造、修补或替换通用索引，也不运行会改变生命周期、对齐状态或关系的维护事务。
2. 可以只读审阅 Markdown 和 Git 中最后可信版本以定位故障；不得把未通过当前 CLI 校验的手工 JSON 作为可查询索引或交付结果。
3. 先按“恢复可用工具”恢复当前分发单元，再运行 `sync-index --write` 和严格 `check`。工具仍无法恢复且任务要求改变决策集合时，报告阻断并请求新的处理条件。

## 完成检查

1. 全部权威 Markdown 保持完整，没有从索引或默认值反向制造状态。
2. 索引能够从 Markdown 确定性重建，且只包含当前通用外壳、决策 state 和派生 keys。
3. `check` 返回 `0`；`list --status all --alignment all` 能看到预期全部成员。
4. Git diff 没有丢失记录、意外改变 `createdAt`、把当前事实写入决策正文、移除必须遵守的决策约束或删除无法解释的关系。
5. 仍无法确定的决策语义、状态、时间或关系已明确请求用户判断。
