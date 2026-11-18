# CLI 契约

## 程序与工作区

- **调用程序：**运行安装包的 `bin/resource-records`（Windows 为 `bin/resource-records.exe`）。`--help`、`<command> --help` 和 `help <command>` 显示同一份总览。
- **选择数据：**`--root <path>` 默认当前工作目录；`--resources-dir <relative-path>` 相对工作区，默认 `resources`。CLI 读取该目录下的 `resource-index.json` 和 `records/` 的直接普通 Markdown 文件，拒绝越界和符号链接。
- **传递参数：**参数必须是合法 Unicode，否则按参数错误处理。所有命令支持 `--json`。取值选项的下一个参数是它的值，即使字面为 `--json` 或命令名。单独的 `--` 结束选项解析，例如 `show -- -Base` 或 `search -- --help`。

## 选择命令

参数全表见程序的 `--help`。查询按线索和需要的证据选择：

| 目的 | 命令与读取范围 |
| --- | --- |
| 找候选 | `list` 组合筛选集合、后代、类型、标签和用途槽；多个标签必须全部精确匹配。`--slot` 返回声明该槽的集合。 |
| 确认当前内容 | `show <id>` 由索引定位后读取源文件。按需选 `--version`，定位单个成员还要加 `--member`。 |
| 按文本找线索 | `search <text>` 扫描当前记录正文；`--metadata` 改查索引里的字符串值（含记录的入口路径，不含字段名）。两者均区分大小写、按字面量匹配，不读取被引用的目录或文档。 |
| 查关系 | `trace <id>` 默认查一层直接上游，节点上限 100、边上限 200。按需限定版本、成员、类型、方向和正整数上限，结合终点与截断解释结果。 |
| 验证或更新索引 | `check` 核对所有源记录、引用、图与索引；`sync-index` 从合法源记录生成索引，写入边界见[同步事务](#同步事务)。 |

### 追溯关系类型

`trace --type` 可重复指定；显式指定时只使用所指定的类型，取值如下：

| 类型 | 关系方向（upstream） |
| --- | --- |
| `parent` | 子集合到父集合。 |
| `collection` | 资源到所属集合。 |
| `version-parent` | 版本到制作前序。 |
| `input` | 输出文件到实际输入。 |
| `preview-of` | 预览文件到源文件。 |
| `reference` | 文件到参考对象。 |
| `member` | 图包成员到目标文件。 |
| `selection` | 集合到选择的资源版本或成员。 |

不指定 `--type` 时使用 `input`、`preview-of` 和 `version-parent`；其余类型须显式指定。

## 查询结果与新鲜度

`list` 和 `search` 默认 offset 0、limit 50。索引查询的 `freshness: unchecked` 不证明当前源文件未变；`show` 对所选记录给出 `current` 或 `stale`；默认正文搜索读取当前文件。

`list` 默认输出完整结果。`--brief` 和 `--tree` 是互斥的文本视图；与任一视图一起传 `--json` 时仍输出完整机器 envelope。各视图共用筛选、ID 顺序和分页窗口；文本头部列出 `total`、`offset`、`limit` 和 `freshness`。

| 行标记 | 如何读取 |
| --- | --- |
| `[match]`（摘要）或 `[match depth=…]`（树） | 本页命中，显示 ID、标题与归属。资源显示 `collection`；子集合显示 `parent`，根集合省略此字段。可按 ID 用 `show` 回读当前源记录。 |
| `[context depth=…]`（树） | 为解释命中而显示的祖先集合，不计入 `total` 或分页。上下文可在不同页或不相邻分支重复；同一集合也可能另有一行作为命中。 |

深度从根集合的 0 开始。树表示集合归属；文件位置查 `show`，制作关系查 `trace`。

## 机器协议

JSON envelope 为 `{version: 1, command, ok, result, diagnostics}` 或 `{version: 1, command, ok: false, error, diagnostics}`；error 至少含 code 和 message，可带 path、field、recovery。JSON 输出到 stdout，普通错误到 stderr；退出码 0 成功、1 领域或系统错误、2 参数错误。协议版本独立于索引 schemaVersion。help 和 version 是文本入口。

### 结果字段

下列字段属于 `result`。列表顺序按记录 ID，版本和成员保持声明顺序。未选择文本视图时普通成功输出为该对象的缩进 JSON；`--json` 输出单行 envelope。可选筛选没有匹配时是合法空列表，不表示来源缺失。

| 命令 | 结果字段 |
| --- | --- |
| `list` | `records` 为索引条目（`sourcePath`、`sourceRevision`、`record`），另有 `total`、`offset`、`limit`、`freshness`。`record.selections` 为索引中的选择快照。 |
| `show` | 当前 `record`、`body`、`selected`、`sourcePath`、`freshness`；未指定版本时 selected 为空对象，否则包含 `version`、`file` 或 `member`。 |
| `search` | `hits`、`total`、`offset`、`limit`、`source`、`coverage`；正文命中含 ID、sourcePath、field、正文内一基 line 和 text（跨行时为起始行与匹配文本）；metadata 命中含 ID 和 fields，并附 `freshness`。 |
| `trace` | `anchor`、`resolvedAnchor`、`direction`、`edges`、`nodes`（计数）、`truncated`、`unexpandedTerminals`、`freshness`、`limits`。边含 `from`、`to`、`type`、`evidence`、`terminal`；空终点使用 null，证据终点和未知终点保留原值。 |
| `check` | `valid`、`count`、`freshness`；仅全部通过时成功。 |
| `sync-index` | `changed`、`indexPath`、`count`；不变时不替换文件。 |

trace 节点字符串中记录为 ID，版本为 `resource@version`，成员为 `resource@version#member`；ID 字符集不包含 `@` 和 `#`，因此该展示是无歧义的。默认追溯图包成员时 `resolvedAnchor` 为它所引用的自有文件，原始锚点仍在 `anchor`；内容关系使用解析后的锚点，选择等逻辑关系使用原始成员，显式筛选 `member` 边时不解析锚点。实际输入经成员解析后的边在 `evidence.target` 保留原始精确引用。

`sourceRevision` 是 `sha256:` 加换行归一化后完整记录 UTF-8 文本的 SHA-256 小写十六进制；它不是媒体哈希。[索引 schema](resource-index.schema.json)定义索引数据结构；索引不含同步时刻。

## 同步事务

`sync-index` 先校验全部当前记录，再完整生成唯一索引。已有文件原子替换，首次独占创建；提交前验证生成索引可由普通读取器解析；超出解析深度时拒绝写入。失败按实际状态报告并提示重新同步；提交后 stdout 写失败时以 stderr 报告索引已提交或未变，并建议 check 或 sync-index，退出码为 1。

顺序合作型本地调用期间保持记录集稳定；不承诺跨文件并发隔离或所有失败均零写入。

## 失败分流

- 找不到或无法运行程序：核对安装包 `bin/`、平台和可执行权限；不能修复时直接读源 Markdown 回答，或按授权起草，标明未做 CLI 验收和查询覆盖限制。不要自动安装。
- 索引缺失或陈旧：只读任务不顺便同步，转读当前源记录并说明索引查询可能不完整；维护记录已获授权时，修正源记录后运行 `sync-index`、`check`。
- 源记录、引用或图校验失败：根据诊断定位并在授权范围内修正 Markdown，再重试；不要手改索引或编造缺失事实。若修复超出范围，保留诊断并报告阻塞。
- 同步失败或输出中断：阅读诊断及 stderr 中实际提交状态，不假定零写入；在维护授权内重新 `check` 或 `sync-index`，否则报告状态待核。查询截断或搜索覆盖不足时调整范围、限额或分页并说明仍未覆盖的部分。
