# 决策记录维护恢复

本手册只在现有集合冷启动或升级、CLI/Node 不可用、索引缺失或损坏、写入中断，或严格 `check` 失败且普通诊断不足时读取。正常查询、创建、修订、归档和同步不读取本手册。格式、生命周期和 CLI 的精确契约仍以 `decision-record-rules.md` 为准。

## 恢复目标

在不丢失 Markdown、生命周期、秒级创建时间和直接关系的前提下，让固定契约定义的 `check` 重新返回 `0`。恢复过程中先保留证据和现状，再生成候选索引；不要用空索引覆盖已有材料，也不要为消除错误直接删除无法解释的记录。

## 先判断故障类型

1. 运行 `check` 并保存诊断；命令无法启动时记录 Node、脚本或权限错误。
2. 决策根目录整体不存在且项目从未记录过决策时，集合只是尚未初始化，不需要恢复。
3. 根目录已有 Markdown，但索引缺失或无法解析时，按“重建索引”处理；仍是 schema v2 时，先按“Schema v2 到 v3 升级报告”确定映射。
4. schema v3 索引可解析，但摘要、关系或排序漂移时，按“刷新投影”处理。
5. 索引引用缺失 Markdown、Markdown 未登记，或上次写入疑似中断时，按“恢复缺失成员”处理。
6. CLI 或 Node 无法运行时，先按“运行时不可用”恢复可读性，不执行声称等价于 CLI 的人工生命周期事务。

## Schema v2 到 v3 升级报告

本节只服务旧项目升级，说明 v2 为什么被替换、已有数据如何进入 v3，以及直接导入模块的调用方需要调整什么。分发包只维护当前 v3 结构；v2 项目通过本节的一次性数据和调用方迁移完成切换，当前 v3 的精确格式仍由固定契约承接。

### 为什么升级

1. schema v2 的 `current` 只登记当前成员，归档记录依赖“不在索引中”推断，索引本身不能直接恢复全部生命周期。
2. schema v2 没有独立的 `status` 和 `createdAt`；日期曾由文件名和标题间接表达，也不能区分同日多条记录的参考先后。
3. schema v3 的 `records` 直接登记全部活动和归档记录，并集中保存状态、秒级创建时间、检索投影和直接关系。它让生命周期筛选、历史恢复和运行时不可用时的大致阅读使用同一份索引。

### 如何升级索引

1. 优先使用工作区中可解析且成员可信的 schema v2 索引；当前索引不可用时，从 Git 恢复最后一个可信版本。把 `current[].path` 作为该版本的活动成员集合。
2. 枚举决策根目录中的全部有效 Markdown：路径位于 v2 `current` 的记录映射为 `active`，其余记录按 v2 原有语义映射为 `archived`。v2 成员本身无法确认时先请求判断。
3. 为每条记录按下文“重建索引”的时间证据顺序恢复秒级 `createdAt`，并从当前 Markdown 生成标题、三个摘要投影和直接关系。
4. 生成覆盖全部 Markdown 的 schema v3 候选索引，固定按路径排序；运行 `check`，再按需运行 `sync-index --write` 和一次 `check`。

### 如何升级模块调用

| v2 读取方式 | v3 读取方式 |
| --- | --- |
| `DecisionIndex.current` | 读取 `DecisionIndex.records`；需要活动成员时筛选 `status === "active"`。 |
| `DecisionRecord.current`、`DecisionRecord.archived` | 读取 `status`；需要判断是否已登记时读取 `indexed`。 |
| 记录上的扁平标题、摘要和关系字段 | 索引可恢复投影读取 `projection`，当前 Markdown 解析结果读取 `document`。 |
| `datePrefix`、`fullDate` | 参考时间读取 `createdAt`；文件名只承接稳定身份。 |
| `DecisionScan.currentPaths` | 从 `index.records` 的活动记录派生；未登记 Markdown 读取 `unindexedPaths`。 |
| `DecisionValidationResult.currentCount` | 读取 `activeCount`，并继续处理 `archivedCount`。 |

先按当前 `decision-records.d.mts` 更新直接导入方，再切换到 v3 分发包。

### 如何升级 CLI 调用

| v2 调用 | v3 调用或处理 |
| --- | --- |
| `list` | 保持不变，默认返回活动记录。 |
| `list --archived` | `list --status archived` |
| `list --all` | `list --status all` |
| `archive <old...> --by <new>` | 先运行 `archive <old...>`，再写入声明真实关系的新记录并运行 `activate <new>`。 |

`--topic`、`--full-time` 和 `show` 是新增的按需查询能力，不影响 v2 到 v3 的必要迁移步骤。

## 恢复路径

### 刷新投影

1. 保留现有索引副本或确认 Git 中存在可恢复版本。
2. 运行 `sync-index --write`，让所有记录的标题、摘要、关系和路径排序从 Markdown 重新生成；状态和 `createdAt` 保持不变。
3. 运行 `check`。

### 重建索引

1. 从最近一个可信的 Git 版本恢复最后有效索引，用它保留能够确认的 `status`、`createdAt` 和直接关系。
2. 为决策根目录中的每个 Markdown 建立且只建立一个 schema v3 条目；字段和排序完全按固定契约生成。
3. 缺少既有 `createdAt` 时，沿文件历史取最早 Git 作者时间：

   ```text
   git log --all --follow --format=%aI -- <decision-file>
   ```

   选择时间线上最早的可追溯值并去除小数秒。只有 Git 没有证据时才参考操作系统修改时间或其他可靠来源；只能恢复到日期或来源冲突时标记不确定性并请求判断。
4. 生命周期优先取最后有效索引或 Git 历史中最后可确认的状态；不能从文件名、关系或所在目录猜测。
5. 关系和四个检索投影从当前 Markdown 生成；任何无法确认的语义差异先保留材料并请求判断。
6. 保存候选索引后运行 `check`；若 CLI 能启动，再运行 `sync-index --write` 和一次 `check`。

### 恢复缺失成员

1. 索引仍有条目但 Markdown 缺失时，优先从 Git 恢复原路径 Markdown，不先删除索引条目。
2. 只有一条 Markdown 未登记时，先确认它是已确认决策，再通过 `activate <path>` 登记。
3. 同时存在多条未登记记录表示索引成员不完整；返回“重建索引”逐条确认生命周期和时间，不逐条调用 `activate`，因为其他未登记记录仍会阻断严格事务。
4. 写入中断时比较工作区、索引和 Git 中最后有效版本，保留能够证明的最新完整组合，再执行相应的同步或登记命令。

### 运行时不可用

1. 直接读取 `decision-index.json` 获取大致状态、时间、摘要和关系，再按路径读取 Markdown 正文。
2. 根据本 skill 的 CLI 说明描述预期操作效果，但不把手工编辑索引称为已经完成的校验式事务。
3. 修复或更换可用 Node 运行时，或重新取得完整 skill 分发包；恢复后先运行 `check`，再继续任何写命令。

## 完成检查

1. `check` 返回 `0`。
2. `list --status all` 能看到预期的全部生命周期成员；需要局部复核时可以增加 `--topic <topic-id>`。
3. Git diff 中没有丢失 Markdown、意外改变状态或时间、删除无法解释的关系，也没有把旧 schema 与 schema v3 并存。
4. 对仍只能推断的生命周期、时间或关系明确记录不确定性，并在继续维护前请求判断。
