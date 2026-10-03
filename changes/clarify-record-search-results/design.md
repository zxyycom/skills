# Design

全文搜索由共享层提供匹配与覆盖事实，metadata 搜索由领域层统计；两个记录域汇总实际参数、来源和结果，CLI 从同一结果生成短摘要。

## Context

[决策查询规则](../../skills/decision-records/references/decision-record-rules.md#派生索引与查询)与[调查查询契约](../../skills/investigation-report/references/investigation-report-contract.md#索引与查询)已定义索引、正文、降级与截断边界；本 Change 将这些事实显式交付给调用方。

| 当前实现 | 相关行为 |
| --- | --- |
| Decision search | 默认 active、全部 alignment；metadata 完整返回。content 固定最多返回 20 个文件、每文件预览 3 个命中范围、总预览 12,000 字符。 |
| Investigation search | 只查正式报告，可按 tag、形成时间和关系筛选；limit 默认 50、最大 1000。content 每文件预览 3 个命中范围、总预览 24,000 字符。metadata 完整匹配后切片，但未标记返回限制。 |
| 共享全文搜索 | 两域调用 `tools/shared/src/file-text-search/index.ts`；记录预算和预览字符预算会停止扫描，仅命中范围预览受限时继续扫描。 |

[权威文件搜索决策](../../docs/decisions/search-authoritative-files-with-index-identity.md)确定共享层承接文件事实、领域按同一快照映射身份；[关系摘要消费决策](../../docs/decisions/separate-relation-summary-consumption-by-reading-task.md)确定文本证据、筛选依据和公开 API 边界。

## Goals / Non-Goals

目标是让两个记录域的搜索直接回答“如何搜索、依据什么、命中与返回多少、哪些部分完整”，保留原有记录展示与有界查询。

范围限于两个 `search` 及必要共享适配，沿用现有查询入口、索引和分发边界。Test Evidence 的搜索修复独立留待后续；其他命令保持现状。本 Change 不增加 CLI 选项、分页或搜索基础设施。

## Decisions

### Intended Change

#### 查询元信息

两域成功结果新增必需的 `searchInfo`，包含 `query`、`source`、`counts`、`coverage` 四组只读字段。Decision 在内部两种 search success 上扩展，通用失败类型不变；Investigation 保留原结果字段，并以 `status` 区分成功的完整 `searchInfo` 与失败的 `searchInfo: null`。失败不伪造命中数。

| 信息 | 定义 |
| --- | --- |
| `query` | `text` 是经校验、用于构造 matcher 的文本；`in`、`match` 为实际模式；`filters` 保存生效领域筛选；`limits` 保存返回、资源与预览预算。匹配规范化沿用领域 owner。 |
| `source` | `kind` 为 `published-index` 或 `validated-source`；`currentness` 为 `current`、`stale` 或 `unchecked`；`fallback` 是是否使用只读来源降级的布尔值。映射见下表。 |
| `counts` | `matched: { value, precision }` 按记录而非文本出现次数计数，value 为非负整数，precision 为 `exact` 或 `lower-bound`，计入已发现但未返回的命中；`returned` 是实际返回记录数。 |
| `coverage` | `scanComplete`、`resultsComplete` 为布尔值；content 的 `previewsComplete` 为布尔值，metadata 为 `null`；`reasons` 为去重的限制原因数组，空数组表示未受限制。 |

`filters` 沿用各域已支持条件：Decision 为 status、alignment、tags 与关系条件；Investigation 为 tags、formedAtFrom/To 与关系条件。默认 tags 为 `[]`，未使用的可选条件省略；有关系目标时回显同一筛选快照解析出的完整 `relatedTo` ID 及实际 direction（默认 `both`）。Investigation 的准备结果须保存已验证条件而非只保留筛选闭包；时间边界以等价 UTC 时间字符串回显。筛选器向结果传递解析事实，renderer 不再次解析 selector。

`limits` 固定分为 `maxRecords`、`resources`、`preview`：Decision metadata 的 maxRecords 为 `null`（无返回上限），其余使用实际返回上限；metadata 的 resources、preview 为 `null`（不适用）。content 回显实际 `maxCandidateFiles`、`maxFileBytes`、`maxTotalBytes`，以及 `contextLines`、`maxMatchesPerFile`、`maxPreviewCharacters`；这些值从同一参数校验结果取得，字节与字符沿用共享搜索单位。

| 来源证据 | `kind` / `currentness` / `fallback` |
| --- | --- |
| metadata 已发布索引与本次读取的来源 revision 相同 | `published-index` / `current` / `false` |
| metadata revision 不同 | `published-index` / `stale` / `false` |
| metadata 索引可读，但来源 revision 核对失败 | `published-index` / `unchecked` / `false`；继续返回快照并 warning。 |
| content 当前来源验证成功 | `validated-source` / `current` / `false`；使用已验证的索引映射。 |
| content 索引不可用或陈旧，完整验证来源后降级成功 | `validated-source` / `current` / `true`；仅为本次查询建立内存投影。 |

来源加载处保留上述证据。两域现有 stale 布尔 helper 会合并 revision 不同与核对失败，search 改用能够区分两者的观测结果；其他调用方保持原有保守布尔行为。`current` 只代表本次已有验证，不增加查询期间锁或跨文件原子快照承诺。

1. scanComplete 的检查对象是所选来源经结构筛选后的全部待匹配记录。检查完毕时 matched 为 exact；提前停止时为已观察命中的 lower-bound。
2. resultsComplete 要求扫描完整、计数精确且全部命中均已返回；previewsComplete 只描述已返回记录的命中范围和上下文片段是否被省略，不代表未返回记录或整份正文完整。content 完整零命中时三者均为 true。
3. 完整空集返回 exact 0。陈旧索引的数量和覆盖仅代表该快照；来源核对只对应本次取得的证据。
4. `reasons` 按 `max-records`、`match-previews`、`preview-characters` 顺序输出实际限制；预览原因只针对已返回记录。来源状态由 source 单独承接。
5. 必需索引或正文读取失败、资源错误和取消沿用 failure、诊断与退出码；metadata 新鲜度核对失败按来源表保留既有快照查询路径。

#### 搜索行为

metadata 保留已计算的精确命中数。Decision 保持完整返回；Investigation 使用切片前的 matched、切片后的 returned，并在隐藏命中时标记返回限制和 warning。

两个记录域显式选择预览仅限制展示的行为：命中范围或字符预算耗尽后，在剩余扫描资源和返回预算内继续识别文件；即使片段为空，也保留已确认的命中身份与计数。仅在实际省略片段时标记预览受限，恰好用满预算本身不表示截断。

保留 content 的有界停止方式：返回预算已满后，发现首个无法返回的命中文件即停止，并将该命中计入 matched；如果还有未检查文件，报告下界与扫描限制。如果该命中来自最后一个待匹配文件，扫描已完整，matched 为 exact，但返回仍受限。资源错误保持失败，不转换为成功的部分结果。

#### 共享实现与隔离

在 `tools/shared/src/file-text-search/` 新增记录搜索收集入口，由两个记录域的 content 搜索直接导入；入口承接命中计数、扫描进度与预览分离，复用现有 `request.ts`、`files.ts`、`previews.ts` 和 matcher 的校验、读取及匹配原语。返回 hits、truncation、已观察命中数、已检查/所选文件数及生效预算，领域层据此映射记录和 searchInfo。

现有 `index.ts`、原语实现与 Test Evidence 的导入链保持不变，新入口不经该 barrel 重导出。相比给现有收集器加运行时策略分支，独立入口可隔离 Test Evidence 的 bundle 变化；新增部分只承担两个记录域共同需要的收集控制，不复制文件安全校验或匹配算法。实际制品与行为由 Verification 2.2 证明。

#### 默认输出

每次成功搜索的 stdout 先输出六行摘要，再输出原有记录或零命中提示。CLI 只渲染同一领域结果，不重读来源或从 warning 文本反推状态。字段顺序固定为 Query、Filters、Source、Limits、Counts、Coverage；字符串使用 JSON 转义，filters 使用紧凑 JSON，limits 只展开适用预算。计数下界显示 `matched>=N`，覆盖显示 `complete`、`limited` 或 `n/a`，限制原因附在 Coverage 行尾。

以下为 Investigation metadata 限量返回的格式样例，数字不是当前集合统计：

```text
Query: text="ci" in=metadata match=all
Filters: {"tags":[]}
Source: kind=published-index currentness=current fallback=false
Limits: maxRecords=1
Counts: matched=11 precision=exact returned=1
Coverage: scan=complete results=limited previews=n/a reasons=max-records
```

Decision metadata 的 Limits 显示 `maxRecords=unlimited`。零命中同样保留六行摘要；空 previews 的命中记录正常展示身份，预览受限由 Coverage 和 warning 说明。Investigation 的程序化 API 返回同一 searchInfo；两个 search 的 CLI 仍只提供现有文本入口。

| 情况 | 数量 | 覆盖 |
| --- | --- | --- |
| metadata 完整零命中 | `matched=0 precision=exact returned=0` | `scan=complete results=complete previews=n/a reasons=none` |
| content 提前停止，已返回记录预览未省略 | `matched>=21 precision=lower-bound returned=20` | `scan=limited results=limited previews=complete reasons=max-records` |
| content 最后一个文件超出返回预算，已返回记录预览未省略 | `matched=21 precision=exact returned=20` | `scan=complete results=limited previews=complete reasons=max-records` |
| content 仅字符预算省略片段 | `matched=2 precision=exact returned=2` | `scan=complete results=complete previews=limited reasons=preview-characters` |

warning 保持领域前缀并写入 stderr，每类原因只输出一次：`search results limited: max-records`；`search previews limited: match-previews,preview-characters`（只列实际原因）；`search source: stale published-index`、`search source: unchecked published-index` 或 `search source: validated-source fallback`。来源 warning 保留快照边界及现有恢复动作；正常预算限制不附带“修复来源”的诊断。

### Resulting Impacts

1. **公开边界**：Investigation 的 `src/types.ts` 与 `api/check-investigations.d.mts` 同步声明 `InvestigationSearchInfo` 及结果判别联合，生成入口仍由 `scripts/build/investigation-report.ts` 承接。现有记录字段、函数参数和错误语义不变，既有内部 diagnostics/truncation 不借此扩成公开 API。Decision 的类型留在 `decision-query-contract.ts`；两域索引与 Schema 不变。两域现有 truncation 由同一事实生成：files 表示实际遗漏返回记录，另两项只表示预览省略。
2. **共享兼容**：`tools/test-evidence/src/core-search.ts` 继续调用现有 `searchFileText`。通过导入链审阅、`test:test-evidence-cli` 与 `check:test-evidence-cli` 验证行为及版本承载制品不变；纯调试生成影响按工具链核对。若该隔离边界无法成立，停止扩展共享改动并重新确认范围。
3. **交付与证据**：在 `tools/` 修改源码，通过 `sync:decision-records-cli`、`sync:investigation-report-check` 更新分发。两域查询 owner 承接完整解释，SKILL.md 与 help 保留必要入口信息；测试按最小原生入口维护 Case，版本按承载变化提升。长期决策按实际边界变化判断记录门槛。

## Risks / Trade-offs

- 预览解耦可能增加读取量；保留文件与请求字节上限、返回预算，有界停止继续是合法结果。
- Investigation 新增必需结果字段；既有字段读取保持兼容，显式构造结果的类型 fixture 需补齐 searchInfo。类型与分发验证分别覆盖运行时和公开声明。
- 查询覆盖与外层工具的输出展示是不同边界。整体预览字符预算不是 stdout 字节上限，外部 UI 仍可能截断输出。

## Open Questions

无。实现按上述契约与隔离入口推进，行为和生成兼容性通过 tasks 的 Verification 验收。
