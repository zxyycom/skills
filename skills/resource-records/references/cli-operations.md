# CLI 契约

二进制名 `resource-records`。工作区默认当前目录，`--root <path>` 指定工作区；`--resources-dir <relative-path>` 默认 `resources`。仅 `records/` 直接普通 Markdown 文件及 `resource-index.json` 在读取范围内，拒绝越界及符号链接。所有命令支持 `--json`；单独的 `--help`、`<command> --help` 和 `help <command>` 显示同一份总览。`--` 结束选项解析，之后的值作为位置参数，例如 `show -- -Base` 或 `search -- --help`。精确参数和结果见下文。

- `list [--collection <id>] [--descendants] [--kind <collection|resource>] [--tag <tag> ...] [--slot <slot>] [--offset <n>] [--limit <n>]`：按索引组合筛选，标签精确 AND；按 ID 稳定排序，返回 total 和窗口。
- `show <id> [--version <id>] [--member <id>]`：索引定位、读取当前文件并核对该记录来源指纹。member 必须与 version 一同指定。
- `search <text> [--metadata] [--offset <n>] [--limit <n>]`：默认扫描当前正文，metadata 查询索引；字面量匹配，正文支持跨行查询，返回命中字段或位置、实际覆盖；跨行命中的 text 为匹配文本，line 为起始行。
- `trace <id> [--version <id>] [--member <id>] [--type <type> ...] [--direction <upstream|downstream>] [--depth <n>] [--max-nodes <n>] [--max-edges <n>]`：默认直接来源，深度 1、节点 100、边 200；所有上限为正整数。集合、图包、选择及 reference 关系仅显式按类型纳入；返回终点、截断与证据。
- `check`：核对全部源记录、引用、分类型图和索引；缺失或陈旧索引是可通过 sync-index 修复的错误。
- `sync-index`：先校验全部当前记录，再完整生成唯一索引。已有文件原子替换，首次独占创建；提交前验证生成索引可由普通读取器解析；超出解析深度时拒绝写入。失败按实际状态报告并提示重新同步；提交后 stdout 写失败时以 stderr 报告索引已提交或未变，并建议 check 或 sync-index，退出码为 1。

分页默认为 offset 0、limit 50。查询索引标记 `freshness: unchecked`；show 对所选记录标记 `current` 或 `stale`；正文搜索标明当前文件来源。JSON envelope 为 `{version: 1, command, ok, result, diagnostics}` 或 `{version: 1, command, ok: false, error, diagnostics}`；error 至少含 code 和 message，可带 path、field、recovery。JSON 输出到 stdout，普通错误到 stderr；退出码 0 成功、1 领域或系统错误、2 参数错误。协议版本独立于索引 schemaVersion。help 和 version 是文本入口。

索引来源指纹规范化换行，正文变化改变指纹，纯换行差异不改变。顺序合作型本地调用期间保持记录集稳定；不承诺跨文件并发隔离或所有失败均零写入。

## 失败分流

- 找不到或无法运行程序：核对安装包 `bin/`、平台和可执行权限；不能修复时直接读源 Markdown 回答，或按授权起草，标明未做 CLI 验收和查询覆盖限制。不要自动安装。
- 索引缺失或陈旧：只读任务不顺便同步，转读当前源记录并说明索引查询可能不完整；维护记录已获授权时，修正源记录后运行 `sync-index`、`check`。
- 源记录、引用或图校验失败：根据诊断定位并在授权范围内修正 Markdown，再重试；不要手改索引或编造缺失事实。若修复超出范围，保留诊断并报告阻塞。
- 同步失败或输出中断：阅读诊断及 stderr 中实际提交状态，不假定零写入；在维护授权内重新 `check` 或 `sync-index`，否则报告状态待核。查询截断或搜索覆盖不足时调整范围、限额或分页并说明仍未覆盖的部分。

## 结果字段

下列字段属于 `result`。列表顺序按记录 ID，版本和成员保持声明顺序。普通成功输出为该对象的缩进 JSON；`--json` 输出单行 envelope。可选筛选没有匹配时是合法空列表，不表示来源缺失。

| 命令 | 结果字段 |
| --- | --- |
| `list` | `records` 为索引条目（`sourcePath`、`sourceRevision`、`record`），另有 `total`、`offset`、`limit`、`freshness`；`--slot` 筛选声明该槽位的集合。 |
| `show` | 当前 `record`、`body`、`selected`、`sourcePath`、`freshness`；未指定版本时 selected 为空对象，否则包含 `version`、`file` 或 `member`。 |
| `search` | `hits`、`total`、`offset`、`limit`、`source`、`coverage`；正文命中含 ID、sourcePath、field、正文内一基 line 和 text；metadata 命中含 ID 和 fields，并附 `freshness`。 |
| `trace` | `anchor`、`resolvedAnchor`、`direction`、`edges`、`nodes`（计数）、`truncated`、`unexpandedTerminals`、`freshness`、`limits`。边含 `from`、`to`、`type`、`evidence`、`terminal`；空终点使用 null，证据终点和未知终点保留原值。 |
| `check` | `valid`、`count`、`freshness`；仅全部通过时成功。 |
| `sync-index` | `changed`、`indexPath`、`count`；不变时不替换文件。 |

trace 节点字符串中记录为 ID，版本为 `resource@version`，成员为 `resource@version#member`；ID 字符集不包含 `@` 和 `#`，因此该展示是无歧义的。默认追溯图包成员时 `resolvedAnchor` 为它所引用的自有文件，原始锚点仍在 `anchor`；内容关系使用解析后的锚点，选择等逻辑关系使用原始成员，显式筛选 `member` 边时不解析锚点。实际输入经成员解析后的边在 `evidence.target` 保留原始精确引用。

`sourceRevision` 是 `sha256:` 加换行归一化后完整记录 UTF-8 文本的 SHA-256 小写十六进制；它不是媒体哈希。`resource-index.schema.json` 定义索引数据结构；索引不含同步时刻。索引条目和当前来源不一致由 `check` 拒绝，索引查询不自行证明新鲜度。
