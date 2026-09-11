# Proposal

本 Change 将 Decision 与 Investigation 的 `trace` 收敛为面向 agent 的受限索引切片，并以可检查的覆盖信息和完整关系事件替代调用方自行重建图。

## Why

Agent 使用 `trace` 的核心任务，是在一次查询中恢复指定演进范围及其完整关系语义。现有两个领域分别返回节点、ID 或边，缺少主遍历成员、事件上下文和截断边界的统一表达；调用方需要追加读取并自行重建图，也难以判断结果是否完整。

两个领域已经从受检派生索引取得关系和节点摘要，并共享后继指向直接前序的有向图模型。`trace` 应直接返回同一索引快照的领域 entry 投影，同时明确本次查询实际采用的方向、深度、记录预算、覆盖状态和续查边界。

## Outcome

Decision 与 Investigation 的 `trace` 默认沿前序和后继方向、按深度 5、最多 50 条唯一记录选择关系子图。查询以拆分、纯归并和 Decision 重划事件为原子单元补齐语义上下文；成功结果统一为稳定 JSON，并区分主遍历成员、事件上下文、完整结果、深度截断、记录预算截断和原子事件阻断。

Agent 可以直接遍历一次查询得到的领域索引切片；结果受限时，可以根据精确 frontier 和所需容量继续查询，而不会把不完整事件误认为完整事实。

## Scope

### Intended Change

- 为共享关系图查询增加带默认值的 direction、depth、max-records、覆盖状态、frontier 和原子事件预算语义。
- 让 Decision 与 Investigation 分别识别本领域的完整关系事件，并把同一索引快照中的紧凑 entry 投影到共享成功 envelope。
- 将两个领域的 `trace` CLI 成功输出切换为单一 JSON 协议；受限但合法的查询仍成功，参数、selector 或索引失败继续使用非零退出状态和 stderr 诊断。
- 同步两个领域的公开 trace 类型、行为 owner、CLI help、生成制品、测试和 Test Evidence Cases。

命令名、selector、关系方向和图合法性保持不变。数据面只读取一次索引快照，结果模型只使用领域 entries、成员身份与覆盖边界；Markdown 正文、独立 edges、路径枚举、拓扑 layers、分页 cursor 和持久反向 adjacency 分别留在现有 owner 或范围外。

### Resulting Impacts

- 共享关系图层需要从简单可达集合扩展为确定性的受限选择过程，并允许领域 adapter 把一次关系跨越映射为普通记录或完整事件单元。
- Decision 与 Investigation 的 trace 成功类型和 CLI stdout 是不兼容变更；仓库内消费者、断言和生成声明必须在同一 Change 中切换。
- 原始 entry relations 保持完整，因而可能引用切片外 ID；membership、coverage 和 frontier 必须明确区分“请求方向的遍历覆盖”和“entry 自带的全部关系事实”。
- 两个领域的 skill 入口、固定关系规则和人类说明需要解释默认限制、事件上下文、续查边界及 JSON 消费方式。
- 新增或修改的最小原生测试入口需要维护对应 Test Evidence Case，并同步派生索引。
- `complete-relation-summary-consumption` 继续拥有 summary 的生产、缺失和一般消费策略；本 Change 原样投影当前索引中存在的可选 `summary`，因此可以独立实施。

## Success Criteria

1. 两个领域的 trace 成功结果使用同一 envelope；`traceIds`、`contextIds` 与 `entries` 满足精确成员不变量，并只从一次受检索引快照构造。
2. 省略查询选项时实际使用 `direction=both`、`depth=5`、`maxRecords=50`；显式有限深度、`all` 深度和正安全整数记录预算具有一致 API 与 CLI 语义。
3. 关系跨越触发的拆分、纯归并和 Decision 重划事件在预算内完整接纳；超出预算时保留独立 anchor seed、停在事件边界，并返回阻断事件及完成该次接纳所需的最小 `requiredMaxRecords`。
4. `coverage.complete`、`stoppedBy` 和 frontier 能让 agent 区分完整、深度受限和预算受限结果；frontier 是续查事实而不是跨调用 cursor。
5. 相同索引和参数产生字节稳定的 JSON 成功输出；受限结果退出 0，参数错误退出 2，selector 或索引失败退出 1 且不向 stdout 写入伪成功结果。
6. Decision entry 只省略派生 `name` 和定位 `sourcePath`；Investigation entry 另外省略 `resourceIds`。其余选定领域摘要、tags 和完整 relations 与索引快照一致。
7. 共享图测试、两个领域的 API/CLI 测试、生成漂移检查、skill/索引检查、Test Evidence 检查和仓库 Gate 全部通过。

## Affected Owners

| Owner | 本 Change 的责任 |
| --- | --- |
| [`tools/shared/src/graph/`](../../tools/shared/src/graph/) | 共享受限遍历、确定性顺序、覆盖和预算选择原语 |
| [`tools/decision-records/src/`](../../tools/decision-records/src/) | Decision 事件 adapter、entry 投影、公开结果类型与 CLI 输出 |
| [`tools/investigation-report/src/`](../../tools/investigation-report/src/) | Investigation 事件 adapter、entry 投影、公开结果类型与 CLI 输出 |
| [`tools/shared/tests/`](../../tools/shared/tests/)、[`tools/decision-records/tests/`](../../tools/decision-records/tests/)、[`tools/investigation-report/tests/`](../../tools/investigation-report/tests/) | 共享算法、领域语义和外部边界的行为证据 |
| [`skills/decision-records/`](../../skills/decision-records/)、[`skills/investigation-report/`](../../skills/investigation-report/) | Agent 行为、固定关系契约、CLI help 对应的生成制品和独立版本 |
| [`docs/skills/`](../../docs/skills/) | 两个 skill 的人类使用说明；只同步 trace 的公开行为 |
| [`docs/test-evidence/`](../../docs/test-evidence/) | 受影响测试节点的 Case 与派生索引 |
| [`scripts/build/`](../../scripts/build/) | 复用现有两个领域的生成适配；只有当前生成边界无法承接新类型时才修改 |
