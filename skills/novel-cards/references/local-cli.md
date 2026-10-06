# 本地 CLI 操作契约

本文件拥有 novel-cards 的命令、批量输入、索引、恢复和运行时边界。字段、身份、引用与变迁效力见 [卡片契约](card-contract.md)；写作判断与修改传播见 [SKILL.md](../SKILL.md)。

## 调用与前置检查

分发入口：`node <skill-directory>/scripts/novel-cards.mjs <arguments>`。本仓库维护入口：`bun run novel-cards -- <arguments>`。`--root <project>` 默认当前目录；所有命令都不联网、不写稿件。

1. 先运行 `check`。索引缺失、陈旧或协议旧版时，核对来源并在写入授权下运行 `sync-index --write`，再查询；非法来源先按诊断修复。
2. 留有未结算事务 journal 时，按下方恢复流程处理，其他读写命令保持阻断。
3. 查询会扫描所有受管区并核对索引，包含参考区的机械字节校验。`--include-reference` 只允许查询输出被选择的参考内容，不表示作者采用，也不是隐私沙箱。

## 命令

| 命令 | 输入与结果 |
| --- | --- |
| `check` | 校验全部卡片、受管引用、组成图、索引当前性及身份/路径/区域投影 |
| `sync-index --write` | 全扫描合法集合，写前复核来源 revision，仅重建 `card-index.json`；不证明文学语义 |
| `show ID[@N] [--include-reference]` | 输出精确目标的 `card`、`area`、`sourcePath`、`markdown`、`explicitRefs` 与 `referenceContext`；参考目标须显式选入 |
| `find --title TEXT [--include-reference]` | 精确标题匹配本作当前普通卡；可显式包括参考，返回 `candidates` 与 `ambiguous` |
| `find --chapter N [--scope ID] [--include-reference]` | 按章号与可选计数范围匹配同上集合，候选包含 `scopeTitle`；缺 scope 时列出所有同号候选 |
| `new-id` | 输出生成时尚未存在的合法 UUID 派生稳定 ID；不创建对象、不预留身份，写入时仍须检查唯一性 |
| `history ID[@N] [--include-reference]` | 先确认所选对象/事件/变迁存在，再投影当前有效变迁；普通 ID 查全部关联版本，版本引用只查该版本；返回版本端点、`mode`、`status` 与记录版本，不输出关联卡正文 |
| `expand ID[@N] [--depth D] [--max-cards C] [--include-reference]` | 只按 `children` 顺序广度展开，读取预算与历史语境规则见下 |
| `apply-transition --input FILE --write` | 按批量输入执行预检、旧版快照、新版卡、变迁记录与索引的受控维护 |
| `recover --write` | 仅在存在 journal 时恢复事务前卡片和索引；发现目标存在事务前后之外的字节时阻断，不覆盖用户另改内容 |

`find` 不检索快照或专门变迁，不以近似标题代替精确匹配。重名和跨 scope 同号均列候选，选择实际 ID 后再 `show`。

### 有界展开与历史语境

- 默认 `--depth 1 --max-cards 100`；深度范围 0–20，卡数范围 1–1000。单次预算不限制卡片模型的递归层数。
- 结果包含 `anchorId`、`complete`、`depth`、`maxCards`、`cards` 与 `frontier`；预算到界是成功的部分结果，`complete=false`。未读边界以 `fromId`、`nextIds`、`reason`（`depth` / `max-cards`）表达，可据此继续查询。
- 同一当前版本的 `id` 与 `id@N` 别名只计一张卡；同一对象的不同版本分别计数。已返回的共享子卡不形成虚假未读边界。
- `complete` 只描述本次 `children` 闭包。`sources`、`refs`、关系和 `state_at` 正文须另行显式读取。
- 展开旧快照时，若其 `children` 含未锁版本引用，命令失败；可分别 `show` 明确版本，但不能把当前引用展开冒充完整历史闭包。快照的其他未锁引用也只表示当前，`referenceContext` 的含义见卡片契约。

## 批量变迁输入与操作顺序

`FILE` 是普通、单硬链接、UTF-8 JSON 文件，最大 20 MiB，只接受以下结构：

```json
{
  "transition": "含 frontmatter 和正文的完整变迁 Markdown",
  "updates": [
    {"id": "hero", "markdown": "含 frontmatter 和正文的完整新版人物卡"},
    {"id": "gate", "markdown": "含 frontmatter 和正文的完整新版设定卡"}
  ]
}
```

1. 读取当前对象、依据事件的明确版本及必要历史，先完成作者对变迁含义的确认；卡片字段与端点约束由卡片契约承接。
2. 新变迁使用 `version: 1`；同 ID 的既有变迁更新必须恰好 `version + 1`。输入中的变迁 Markdown 是完整新记录，正文说明原因与影响。
3. 每个 `updates` 目标须已在 `cards/`，同一对象只更新一次；新版保持原 `id`、`domain`、`kind`，版本恰好 `+1`。每个更新必须对应 `changes` 的当前 `before` 与新 `after`。先用通常建卡流程建立新对象，本命令不创建普通对象或替换参考卡。
4. 有对象更新时，变迁须为 `active` 且 `occurred`；`evolution` 的更新后对象也须为 `occurred`。所有模式均不能以 `expected` 覆盖同身份已 `occurred` 的对象或变迁。`expected` 记录只能保存计划，不能应用对象更新。
5. `updates: []` 可记录已有版本之间的变化，或修订/撤回既有记录；端点仍须实际存在。撤回只改变记录效力，不自动恢复对象卡；若还要纠正对象内容，另行用有效修订处理。
6. 运行 `apply-transition --input FILE --write`，核对实际 `changedFiles`，再 `check`、`history` 并读取所需前后版本。`semanticReview: "not-proven"` 表示工具未证明文学语义。

### 发布与恢复

1. 解析输入、读取当前合法来源与索引，验证完整拟议集合，并在隔离目录生成新索引。预检完成后复核来源及写入目标。
2. 旧对象和旧变迁以原 Markdown 完整保存到 `history/snapshots/`，保留 BOM/换行；既有快照不覆盖。写事务 journal 后逐个原子替换目标文件。
3. 运行中失败时恢复旧集合与索引。恢复失败会保留 journal 并报告失败；先停止后续编辑，按诊断运行 `recover --write`。
4. 恢复只接受事务前或事务后的目标字节；外来内容、危险路径或身份变化会阻断。读取失败、非法 UTF-8 或无法证明恢复完成时保持失败，如实报告保留的 journal 与待处理目标，不把恢复失败当成无变化成功。

跨文件发布不是一次原子操作，进程中断后须恢复。运行前后保持可信本地工作区的单写者条件：不得并发编辑，journal 存续期间不能手工删改受管文件。工具不提供跨进程锁、恶意并发隔离或防篡改审计保证。

## 索引、预算与失败输出

- 索引复用共享 Index Runtime：`schemaVersion: 4`、`namespace: novel-cards`、`definitionVersion: 2`。当前条目键为 `id`，旧快照键为 `id@N`；`title`、`sourcePath`、`area` 是定位投影，历史关系从当前 Markdown 派生。
- 来源 revision 包含路径与换行规范化完整文本。查询核对 revision、完整索引投影与实际来源；缺失、陈旧或旧协议索引失败，恢复使用显式同步。
- 受管集合最多 10000 条记录、2 MiB/文件、20 MiB/集合；超限失败而非截断成功。批量 Markdown 字符串拒绝孤立 Unicode surrogate，防止 UTF-8 写入静默改变字节。
- 来源扫描在读取前后核对文件身份；UTF-8 BOM 在 `show`、快照与回滚中完整保留，解析仅在 frontmatter 边界忽略起始 BOM。查询成本随集合增长，不承诺大规模性能。
- 除 `--help` 外，成功与领域失败的 stdout 均为单个 JSON；领域失败保留 `status: error`，stderr 提供可定位诊断。参数错误只写 stderr。
- 退出码 0 成功、1 来源/索引/查询/事务失败、2 参数错误。重复参数、路径伪装引用、无 `--write` 的写命令和超界预算均拒绝；不存在的目标或非法参考保持失败，不以空结果或相似卡替代。
