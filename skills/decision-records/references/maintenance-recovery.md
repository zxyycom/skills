# 决策记录维护恢复

本手册只在现有集合冷启动或升级、CLI/Node 不可用、索引缺失或损坏、写入中断，或严格 `check` 失败且普通诊断不足时读取。正常查询、创建、修订、归档、丢弃和同步不读取本手册。格式、生命周期和 CLI 的精确契约仍以 `decision-record-rules.md` 为准。目标工作区必须是 Git 仓库且 Git 命令可用；本手册不提供非 Git 项目的兼容模式。

## 恢复目标

在不丢失 Markdown、生命周期、秒级创建时间和直接关系的前提下，恢复一个能够读取 Git `HEAD` 路径的 CLI，并让固定契约定义的 `check` 重新返回 `0`。暂时无法取得 CLI 时，先依据固定契约和 Git 路径证据构建或更新索引。恢复过程中不要用空索引覆盖已有材料，也不要为消除错误直接删除无法解释的记录。

## 先判断故障类型

1. 先确认工作区位于 Git 仓库内且能够读取 `HEAD` 路径，再运行 `check` 并保存诊断；Git 前提不满足时直接停止，命令无法启动时记录 Node、脚本或权限错误。
2. 决策根目录整体不存在且项目从未记录过决策时，集合只是尚未初始化，不需要恢复。
3. 根目录已有 Markdown，但索引缺失或无法解析时，按“重建索引”处理；仍是 schema v2 时，先按“Schema v2 到 v3 升级报告”确定映射。
4. schema v3 索引可解析，但摘要、关系或排序漂移时，按“刷新投影”处理。
5. 索引引用缺失 Markdown、Markdown 未登记，或上次写入疑似中断时，按“恢复缺失成员”处理。
6. CLI 或 Node 无法运行时，先从“恢复可用工具”选择当前条件下最直接的方案；工具暂时无法恢复且任务必须继续时，再进入“无可用 CLI 时的降级维护”。

## 恢复可用工具

按当前可用条件选择一条最直接的路径，不要求依次尝试全部方案。这里恢复的是 CLI 或运行时，不替代 Git 前提。工具恢复后先运行 `check`，确认当前材料没有结构错误，再继续写命令。

### 使用替代运行时

1. `scripts/decision-records.mjs` 完整但 Node 不可用时，先尝试已有的 Node 兼容运行时，例如从 skill 目录运行 `bun scripts/decision-records.mjs check --root <workspace-root>`。
2. 替代运行时能够启动 CLI 时，继续使用同一 MJS 和固定契约，不维护另一套脚本。
3. 运行时产生明确的模块、文件或参数错误时，按真实错误处理，不继续更换运行时猜测。

### 使用随包更新器

1. Node 或兼容运行时可用、但 decision-records CLI 或分发文件损坏时，优先运行随包的 `scripts/update-skill.mjs`。
2. 先运行 `node scripts/update-skill.mjs --check` 查看是否与最新 release 不同，再运行 `node scripts/update-skill.mjs --yes` 替换整个 skill；使用兼容运行时时保持相同参数。
3. 更新器会校验 release 中的 skill 指纹并整体替换目标目录，比单独复制一个 MJS 更适合修复缺失或相互不匹配的分发文件。

### 从 GitHub release 或源码恢复

1. 只需要恢复已安装 skill 时，直接下载 latest release 的 [`decision-records.zip`](https://github.com/zxyycom/skills/releases/latest/download/decision-records.zip)。解压后确认存在完整的 `decision-records/` 目录，再整体替换损坏的 skill；release 页面位于 <https://github.com/zxyycom/skills/releases/latest>。
2. 需要检查或重建 CLI 时，从 <https://github.com/zxyycom/skills> 下载或克隆仓库源码，在仓库根目录安装依赖并构建：

   ```text
   pnpm install --frozen-lockfile
   bun run sync:decision-records-cli
   ```

   构建结果位于 `skills/decision-records/scripts/decision-records.mjs`，同时生成 `decision-records.d.mts` 和 `decision-records.mjs.map`；将完整 `skills/decision-records/` 目录复制到安装位置。
3. Git 或包管理器不可用时，仍可以通过浏览器或任意下载工具取得 release zip；`decision-records.mjs` 和 `update-skill.mjs` 文件头也保存了仓库、源码目录和重建命令，`node scripts/update-skill.mjs --help` 会输出相同入口。
4. 网络不可用但相邻 `decision-records.mjs.map` 或 `decision-records.d.mts` 仍可读取时，解析 source map，将 `sources[i]` 与 `sourcesContent[i]` 一一对应即可恢复 TypeScript 实现；类型声明用于确认公开函数和结果结构。可以据此修补现有 MJS，或按下一节复现当前需要的命令。

### 复现一个最小 CLI

1. 选择当前任务需要的最小命令集合。索引损坏时优先实现 `check` 和 `sync-index`；日常写入按需增加 `activate`、`archive` 或 `discard`；只需要查询时实现 `list` 或 `show`。
2. 先读取随包的 `references/decision-index.schema.json` 建立索引字段、类型和枚举，再从固定契约补充 Markdown 投影、生命周期、关系和排序规则。以 `--root <workspace-root>` 作为工作区入口；需要兼容自定义目录时再增加 `--decisions-dir`。每次调用先用一次 `git -C <decision-root> ls-tree -r -z --name-only HEAD -- .` 批量取得 `HEAD` Markdown 路径；仅在命令失败时确认 `HEAD` 是否仍为符号引用且尚不能解析到版本，其他 Git 错误继续失败。
3. 把公共逻辑拆成扫描 Markdown、读取索引、生成记录投影、验证集合和写候选索引五部分。各命令只组合这些部分：
   - `list`：读取索引，默认筛选 `active`，再按主题或状态筛选并输出基础元数据。
   - `show`：读取目标索引元数据并附上原始 Markdown。
   - `check`：检查 JSON、Markdown 与索引一一对应、路径排序、时间、投影和关系。
   - `sync-index`：从全部 Markdown 重算标题、摘要和关系，保留既有 `status` 与 `createdAt`。
   - `activate`：新增条目时写入当前秒级 `createdAt`，已有条目只改为 `active`。
   - `archive`：只把路径已经存在于 `HEAD` 的目标条目改为 `archived`。
   - `discard`：只删除路径不在 `HEAD` 且没有被引用的 Markdown 和索引条目，不修改 Git 暂存区。
4. 写命令先生成完整候选索引或临时文件，按路径排序 `records`，使用两空格缩进和文件末尾换行；比较 Markdown、原索引和 Git diff 后再替换正式索引。
5. 若完整复现成本过高，只实现当前需要的命令即可；后续可以直接换回 release CLI，无需让临时实现长期兼容所有查询和恢复能力。

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

1. `HEAD` 中存在的 Markdown 路径从工作区缺失时，优先从 Git 恢复原路径 Markdown，不先删除索引条目，也不把另一个新路径猜成重命名结果。
2. 只有一条 Markdown 未登记时，先确认它是已确认决策，再通过 `activate <path>` 登记。
3. 同时存在多条未登记记录表示索引成员不完整；返回“重建索引”逐条确认生命周期和时间，不逐条调用 `activate`，因为其他未登记记录仍会阻断严格事务。
4. 写入中断时比较工作区、索引和 Git 中最后有效版本，保留能够证明的最新完整组合，再执行相应的同步或登记命令。

## 无可用 CLI 时的降级维护

只有工具暂时无法恢复、当前任务又必须继续时才使用本节。先读取固定契约并保留现有索引、Markdown 与 Git 证据，再直接构建与正常命令相同的目标文件状态。

### 构建或修复索引

1. 索引缺失、损坏或成员不完整时，按“重建索引”恢复全部记录，不只处理当前目标。
2. 仍有可信索引时保留其中能够确认的 `status` 和 `createdAt`；标题、摘要与直接关系从当前 Markdown 重新生成。
3. 先写候选索引，确认覆盖全部 Markdown、没有丢失既有条目后再替换正式文件。

### 完成日常维护

1. 新增决策：按固定契约写入 Markdown，在候选索引中新增 `active` 条目，使用当前秒级时间作为 `createdAt`，并从 Markdown 写入投影和直接关系；路径首次进入 `HEAD` 前只作为临时 `pending` 观察。
2. 编辑性修正：更新 Markdown 和对应投影、关系，保留原 `status` 与 `createdAt`。
3. 独立归档或重新激活：只有目标 Markdown 路径存在于 `HEAD` 时才改变目标条目的 `status`，保留 Markdown、`createdAt`、投影和关系。
4. 待提交记录放弃：确认路径不在 `HEAD` 且没有其他关系引用后删除 Markdown 和索引条目；若文件已暂存，提醒调用方重新暂存决策改动。
5. 决策演进：让新记录完整表达当前结论并只指向路径存在于 `HEAD` 的直接前序，把前序改为 `archived`，再登记新的 `active` 条目；关系本身不代替状态变化。
6. 每次写回都按路径排序全部 `records`，使用两空格缩进和文件末尾换行，不在 schema 中加入 `pending` 或“待校验”等临时字段。

### 手工检查与后续校验

1. 使用 `references/decision-index.schema.json` 或等价检查确认 JSON 结构，再确认 Markdown 与索引一一对应且没有意外删除记录。
2. 确认新时间符合秒级格式，既有时间和未涉及记录的状态保持不变，四个投影与关系均来自对应 Markdown。
3. 确认关系目标路径存在于 `HEAD` 且当前已经归档，没有自环、重复关系或明显环路，索引仍按路径排序。
4. 检查 Git diff，并在交付中说明本次由临时工具或手工维护完成，尚未运行正式 CLI 的 `check`。
5. CLI 恢复后先运行 `check`；只有派生投影或排序漂移时再运行 `sync-index --write`，随后再次运行 `check`。生命周期、时间或关系不确定时从 Git 证据恢复或请求判断，不用同步命令猜测。

## 完成检查

1. 已恢复可用 CLI 并让 `check` 返回 `0`，或已生成候选索引并完成手工检查。
2. CLI 可用时 `list --status all` 能看到预期的全部生命周期成员；降级维护时已直接检查索引中的全部条目。
3. Git diff 中没有丢失 Markdown、意外改变状态或时间、删除无法解释的关系，也没有把旧 schema 与 schema v3 并存。
4. 对仍只能推断的生命周期、时间或关系明确记录不确定性，并在继续维护前请求判断。
