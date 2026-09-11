# Design

本 design 将已确认的产品取舍落实为共享 trace 成功 envelope、确定性的事件原子遍历和两个领域的紧凑索引投影。

## Context

- `decision-records trace` 与 `investigation-report trace` 都从受检派生索引遍历关系，但当前成功类型和 CLI 文本输出不同。
- 关系由后继 entry 指向直接前序。Decision 还定义完整重划二部连通分量；两个领域都定义完整拆分事件和纯归并事件。
- 当前 Decision 索引有 347 条记录、288 条边，最大单向 trace 为 48 条、最大双向连通分量为 65 条、最大拆分事件有 4 个后继。Investigation 索引有 39 条记录、21 条边，最大双向连通分量为 19 条。深度 5 与 50 条记录适合作为普通查询默认值，同时需要显式覆盖语义处理更大图。
- Decision entry 已包含 title、status、alignment、createdAt、purpose、background、decision、tags 与 relations；Investigation entry 已包含 title、formedAt、question、tags、relations、资源和定位字段。它们可从同一索引快照直接投影。
- 原始 entry relations 不按 trace 范围裁剪。只有 source 和 target 都在 `entries` 中的 relation 才是切片内部边；其他 relation 仍是该 entry 的索引事实，不表示请求方向一定缺失。
- `complete-relation-summary-consumption` 负责 relation summary 的生产、覆盖和一般消费策略。本 Change 保留索引中已有的可选 `summary`，缺失时不生成、不填 `null`，两者没有实施前置关系。
- 当前两个领域源码已按输入、查询、关系、输出和生成责任拆分；实施从下文列出的当前 owner 进入。
- 实施者依次使用 proposal 恢复目标和范围、使用本文件恢复契约与算法、使用 tasks 推进和验证。[trace-output-examples.md](trace-output-examples.md) 只保存讨论示例，不参与契约解释。

## Goals / Non-Goals

目标：

- 让 agent 一次取得可直接遍历的领域索引切片。
- 区分主遍历成员和只为关系事件闭合加入的上下文成员。
- 用稳定字段表达查询限制、覆盖状态、原子事件阻断和可行动的续查边界。
- 让相同索引与参数得到确定、字节稳定的 JSON 成功输出。
- 共享图选择和覆盖语义，同时保留 Decision 与 Investigation 的领域字段和事件差异。

责任边界：

| 主题 | 本 Change 的责任 | 相邻 owner 的责任 |
| --- | --- | --- |
| 数据来源 | 从一次受检索引快照选择和投影 entries | Markdown 继续承接权威正文，索引同步继续由各领域维护流程负责 |
| 图语义 | 使用现有方向、关系类型、合法性和事件定义 | 关系建立、生命周期、形成时间和跨领域边界继续由各领域 owner 定义 |
| 结果模型 | 返回领域 entries、成员身份和覆盖边界 | 通用 TraceNode、独立 edges、路径与拓扑 layers 不进入本结果 |
| 继续查询 | frontier 提供下一批直接 anchor 和方向事实 | 调用方负责发起新查询和合并重叠结果；本结果不保存 cursor 或跨调用快照 |
| Relation summary | 原样投影索引中的可选字段 | 缺失、生产、回填和一般消费策略由 `complete-relation-summary-consumption` 决定 |
| 机器契约 | TypeScript 公开类型、稳定文档和行为测试共同定义成功 JSON | 当前没有独立跨语言消费方，因此不新增 JSON Schema |

## Decisions

### Intended Change

1. **默认查询意图。** API 和 CLI 省略方向时使用 `both`，省略深度时使用 5，省略记录预算时使用 50。有限 `maxDepth` 接受从 0 到 JavaScript 最大安全整数的整数，`maxDepth=null` 与 CLI `--depth all` 关闭深度限制；`maxRecords` 接受从 1 到 JavaScript 最大安全整数的整数，不增加任意固定硬上限，索引实际记录数形成自然上限。
2. **共享成功 envelope。** 两个领域在成功时返回相同顶层结构：`status`、anchor、实际 limits、coverage、主遍历 IDs、上下文 IDs、frontier、可选阻断事件和领域 entries。CLI 直接稳定序列化这一成功结果。
3. **成员不变量。** anchor 总是 depth 0 的主遍历成员；`traceIds` 与 `contextIds` 互斥，其并集恰好等于 `entries` 的 key。每个 ID 只有一个 entry；上下文成员在请求深度范围内被主遍历实际到达时提升为主遍历成员。
4. **事件原子接纳。** anchor 是独立种子；关系事件在主遍历跨越对应边时才被选择。一次跨越产生的普通记录或完整事件称为“接纳单元”；接纳后会超过唯一记录预算时，保持单元不变并停在当前边界。已经作为种子或早先单元成员存在的记录不重复计数。因此首个关系事件被阻断时，结果仍包含 anchor，并用 `blockedEvent` 表示该事件尚未接纳。
5. **事件闭合。** 拆分事件包含一个前序和全部直接拆分后继；纯归并事件包含归并后继和全部直接前序；Decision 重划事件包含完整重划二部连通分量。当前方向直接到达的端点成为下一深度主遍历成员，其余事件成员成为不递归的上下文成员。普通一对一关系只加入直接到达记录。
6. **确定性与停止。** 使用 breadth-first 选择；同层按 ID 的 UTF-16 code-unit 顺序处理，在 `both` 中先处理 predecessors 再处理 successors。接纳单元依次按直接到达 ID 序列、kind 顺序 `ordinary`、`split`、`merge`、`reallocation` 和完整成员 ID 序列排序。第一个超出预算的单元使记录选择停止，后续单元保持未选择。
7. **覆盖与续查。** `complete=true` 表示请求方向上没有关系扩展因 depth 或 max-records 被省略，且所有已接纳事件完整。上下文成员保持非递归；它被主遍历提升后才参与完整性判断。frontier 返回已发现的直接续查边界，每项都能转换为新的 anchor、direction 查询。
8. **字段投影。** Decision entry 保留 title、status、alignment、createdAt、purpose、background、decision、tags、relations；Investigation entry 保留 title、formedAt、question、tags、relations。ID 已由 object key 承接，因此删除派生 `name` 和定位 `sourcePath`；Investigation 另外删除只服务证据定位的 `resourceIds`。
9. **原始关系与 summary。** 每个 entry 的 relations 从同一索引 entry 完整复制并保持领域规范顺序，即使 target 不在切片内。存在的可选 summary 原样复制；不存在时省略字段。trace 不推断摘要，也不使用 `null` 或 availability 标记替代另一个 Change 的决定。
10. **输出与失败。** 完整和受限成功结果都退出 0，并只向 stdout 写两空格缩进的 JSON 和一个结尾换行；对象字段按下文类型声明顺序构造，`entries` keys 按规定排序。CLI 参数错误退出 2；selector、索引或查询失败退出 1。失败只写 stderr，并沿用领域诊断 owner，不把两个领域的全部失败类型强行合并进共享成功 envelope。

### Resulting Impacts

- `tools/shared/src/graph/` 需要承接共同的 limits、membership、coverage、frontier、稳定顺序和接纳过程；领域工具提供事件分组，不把中文关系类型或领域诊断下沉到共享层。
- Decision 的查询请求、trace success 类型、relation graph adapter 和 CLI output 需要从 records+edges 切换为 trace slice；Investigation 的 options、trace result、query flow 和 CLI output 做同构切换。
- 两个领域的公开 trace options 都需要支持可选 direction、可选 `maxDepth` 和可选 `maxRecords`；`maxDepth=null` 表示 all，省略则表示默认 5。CLI 的 `--depth all` 映射到 `null`。
- 现有依赖文本输出、`records/reportIds` 或独立 `edges` 的测试和仓库内消费者切换到成功 envelope，完成后只保留 JSON 路径。
- 两个 skill 的行为入口、固定契约、CLI help、人类说明、生成 MJS/source map/声明和独立版本需要同步。
- 测试需覆盖共享纯计算、两个领域的事件语义、字段裁剪、索引快照、CLI 通道与退出状态；每个新增或修改的最小测试节点同步 Test Evidence Case。
- 两个领域的其他 Change 与本 Change共享关系类型、文档、测试或生成物时，实施批次按 owner 串行写入；这些 Change 不构成 trace 语义前置。

## Risks / Trade-offs

| 风险或代价 | 设计控制 |
| --- | --- |
| 默认 `both` 比单向查询返回更多内容 | depth 5 和 maxRecords 50 默认限流，limits 与 coverage 明示实际范围 |
| 不设任意硬上限允许调用方显式请求很大输出 | 只接受正安全整数，默认值承担常规成本控制；实际索引基数是自然上限，显式大值由调用方承担 |
| 大型事件需要高于当前预算才能进入 | 接纳单元保持完整；`blockedEvent.requiredMaxRecords` 给出推进当前边界所需的最小预算 |
| 原始 relations 可引用切片外 ID | 明确 entry 事实与请求 coverage 的区别；内部边由两端 membership 判定，frontier 只解释请求方向边界 |
| frontier 不是 cursor，后续查询可能重叠或看到新索引快照 | 明确其用途是建议续查 anchor；需要复现时由调用方固定仓库 revision，不在 trace 中建立会话状态 |
| JSON 单轨切换破坏文本消费者 | 在 readiness 完整枚举仓库内消费者，同一 Change 同步源码、测试、文档与生成声明 |
| 两个领域同时修改增加集成面 | 共享无领域语义的纯选择核心，领域 adapter 和验证保持分开；按生成 owner 串行同步 |

## Open Questions

无。默认方向、限制、硬上限、事件原子性、字段裁剪、续查模型、输出通道和 summary 边界均已确认。

## Output Contract

### Shared success shape

以下类型定义字段和不变量；两个领域以各自 entry 类型替换 `Entry`：

```ts
type TraceDirection = "predecessors" | "successors" | "both";

type TraceFrontier = Readonly<{
  fromId: string;
  direction: "predecessors" | "successors";
  reason: "depth" | "max-records";
  nextIds: readonly string[];
}>;

type TraceBlockedEvent = Readonly<{
  kind: "split" | "merge" | "reallocation";
  recordIds: readonly string[];
  requiredMaxRecords: number;
}>;

type RelationTraceSuccess<Entry> = Readonly<{
  status: "ok";
  anchorId: string;
  direction: TraceDirection;
  limits: Readonly<{
    depth: number | "all";
    maxRecords: number;
  }>;
  coverage: Readonly<{
    complete: boolean;
    stoppedBy: readonly ("depth" | "max-records")[];
  }>;
  traceIds: readonly string[];
  contextIds: readonly string[];
  frontier: readonly TraceFrontier[];
  blockedEvent?: TraceBlockedEvent;
  entries: Readonly<Record<string, Entry>>;
}>;
```

附加不变量：

- `coverage.complete === true` 当且仅当 `stoppedBy` 与 `frontier` 都为空且没有 `blockedEvent`。
- `stoppedBy` 去重并固定按 `depth`、`max-records` 排序；一个查询可以同时遇到两类边界。
- `blockedEvent` 只在第一个超出预算的接纳单元是多记录语义事件时出现。普通单记录接纳超出预算时只使用 max-records frontier。
- `requiredMaxRecords` 等于当前已选唯一记录数加上完整接纳单元尚未选中的唯一记录数。
- `traceIds`、`contextIds`、`recordIds`、`nextIds` 和 `entries` keys 使用 UTF-16 code-unit 顺序；这些数组不表达路径或 BFS 层。
- 每个 frontier 的 `fromId` 属于 `traceIds`；`nextIds` 是 selector 因对应限制未跨越的该方向直接邻居，可以包含已经作为 context 加入的 ID。frontier 覆盖停止点上全部尚未处理的请求方向扩展。
- frontier 按 `fromId`、direction（predecessors 在前）、reason 排序；同一三元组的 `nextIds` 合并去重。
- 顶层对象、`limits`、`coverage`、frontier、阻断事件和领域 entry 的字段顺序按本节 TypeScript 类型中的声明顺序；relation 对象继续使用领域索引契约的字段顺序。

### Domain entries

```ts
type DecisionTraceEntry = Readonly<{
  title: string;
  status: "active" | "archived";
  alignment: "aligned" | "unaligned";
  createdAt: string;
  purpose: string;
  background: string;
  decision: string;
  tags: readonly string[];
  relations: readonly DecisionRelation[];
}>;

type InvestigationTraceEntry = Readonly<{
  title: string;
  formedAt: string;
  question: string;
  tags: readonly string[];
  relations: readonly InvestigationRelation[];
}>;
```

### Selection examples

下表只说明选择结果；entry 字段继续服从上面的领域类型，讨论阶段的完整代码块位于 [trace-output-examples.md](trace-output-examples.md)。

| 场景 | 主遍历成员 | 上下文成员 | coverage 与边界 |
| --- | --- | --- | --- |
| `direction-a` 以 predecessors、depth 1 跨越拆分关系，事件包含前序 `original-direction` 和 sibling `direction-b` | `direction-a`、`original-direction` | `direction-b` | 图在请求方向没有其他前序时 `complete=true`，frontier 为空 |
| 同一事件另有 `direction-c`，但 maxRecords=2 | 只保留 anchor `direction-a` | 无 | `complete=false`；frontier 从 `direction-a` 指向 `original-direction`；blocked split event 列出四个成员并返回 `requiredMaxRecords=4` |

第一种场景的三个 ID 都出现在 `entries`。第二种场景把 anchor 作为独立种子保留，拆分事件仍停留在 frontier；`blockedEvent` 描述下一次完整接纳所需的记录集合。

## Traversal and Event Admission

1. 从同一受检索引快照解析 anchor，先把 anchor 作为 depth 0 主遍历成员加入；`maxRecords >= 1` 保证 seed 可返回。
2. 使用 breadth-first queue 扩展主遍历成员。达到有限 depth 时不跨越该成员的请求方向边，并把仍存在的直接邻居记录为 depth frontier。
3. 每条待跨越关系先由领域 adapter 映射为 ordinary、split、merge 或 reallocation 接纳单元。相同事件只闭合一次；单元内区分当前方向直接到达的主遍历端点和只为闭合加入的上下文端点。
4. 计算接纳后 `traceIds ∪ contextIds` 的唯一记录数。预算允许时完整加入；上下文成员已经或同时作为主遍历端点到达时归入 `traceIds`，并按最小到达深度继续排队。
5. 接纳单元超出预算时保留当前成员集合，记录 max-records frontier；多记录事件同时输出 `blockedEvent`。选择在该单元停止，并把全部主遍历成员上尚未处理的请求方向扩展归入 max-records frontier；此前形成的 depth frontier 保持不变。
6. 成功选择结束后按输出契约排序 IDs、frontier 和 entries；relations 保持各领域索引的规范顺序，不按切片重新排序或裁剪。

事件 adapter 只闭合当前主遍历实际跨越的事件。上下文成员参与的其他事件保持未选择；它后来被主遍历到达时才以主遍历成员身份产生新的接纳。

## Implementation Boundaries

- 共享层拥有纯数据选择、不变量与 coverage 计算，不读取索引、不识别中文关系类型、不投影领域字段、不写 CLI。
- Decision adapter 复用现有拆分、纯归并判断和 `decisionReallocationComponents`；Investigation adapter 复用其拆分与纯归并规则。
- 两个查询入口各自负责加载一次当前索引、解析 selector、调用共享选择并投影 entry；失败继续由现有领域 diagnostics 映射。
- CLI 只解析 `--direction`、`--depth`、`--max-records` 并序列化领域成功结果；不重新计算 coverage 或事件语义。
- 生成产物只通过 `sync:decision-records-cli` 与 `sync:investigation-report-check` 更新；实现不直接编辑 bundled MJS、source map 或生成声明。
- 本 Plan 的实现批次独占两个领域的 trace、文档和生成物 owner；其他 Change 需要写入同一 owner 时按批次串行。

### Current owner map

| 责任 | 当前入口 |
| --- | --- |
| 共享建图与 trace | `tools/shared/src/graph/relations.ts`、`tools/shared/tests/relation-graph.test.ts` |
| Decision 输入与公开类型 | `types.ts`、`decision-query-contract.ts`、`cli-args.ts`、`cli-command-{options,arguments}.ts`、`cli-program-queries.ts` |
| Decision 查询与输出 | `relation-graph.ts`、`decision-query-{record-queries,service}.ts`、`cli-query-commands.ts`、`cli-output.ts` |
| Investigation 输入与公开类型 | `types.ts`、`options.ts`、`cli-{contract,parser,help}.ts` |
| Investigation 查询与输出 | `query-{report,results}.ts`、`query.ts`、`cli-query-commands.ts`、`cli.ts` |
| 分发声明与制品 | `tools/investigation-report/api/check-investigations.d.mts` 及两个 skill 的 `scripts/` 生成输出 |
| 行为证据 | 三个工具测试根及 `docs/test-evidence/cases/` 中现有 trace Cases |

当前仓库没有上述查询、CLI、测试和分发入口之外的 trace 结果消费方；实施时以 readiness 的重新扫描保护后续新增调用方。
