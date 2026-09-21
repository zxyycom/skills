# Design

本 design 以统一 `stage` 入口和显式 scope 定义选择性 pending 快照的记录、索引与资源边界。

## Context

Stage 操作只构造 Git pending 状态，不提交或推送。每个所选正式 ID 可以映射到两类受管路径：

| 路径类别 | Decision Records | Investigation Report |
| --- | --- | --- |
| 派生索引 | `decision-index.json` 中所选记录对应的完整集合投影。 | `investigation-index.json` 中所选记录对应的完整集合投影。 |
| 领域文件 | 正式 Decision Markdown。 | 正式报告 Markdown 及该报告 ID 拥有的完整受管资源目录子树。 |

Investigation owner 资源树的成员由 owner 目录决定，不由当前正文是否直接引用决定。Selector 只面向正式记录；候选不进入 stage 范围。

## Goals / Non-Goals

目标：

- 两个领域使用相同命令与 scope，调用者可以从输入预测 pending 路径。
- 删除与重命名和新增、更新使用同一 selector 模型。
- 每次替换都保护无关 pending 内容，并在写前验证基线与来源。

范围边界：

- Stage 不执行同步、发布、生命周期 mutation、commit 或 push。
- 每个领域继续拥有索引生成、正式来源有效性和资源归属规则。
- 共享版本控制层只承接受管路径的原子 pending replacement，不解释领域 ID 或 owner。

## Decisions

### Intended Change

两个 CLI 使用：

```text
stage <selector...> [--scope <all|index|domain>]
```

Scope 定义如下：

| Scope | Pending 路径 |
| --- | --- |
| `all` | 默认值；原子写入所选索引投影与领域文件。 |
| `index` | 只写入所选记录对应的派生索引投影。 |
| `domain` | 只写入所选正式 Markdown 和 owner 资源，不改变 pending 索引。 |

Selector 在当前正式集合与 Git `HEAD` 基线的 ID 并集中解析：当前 ID 表示新增或更新，基线-only ID 表示删除。重命名必须同时选择旧 ID 与新 ID，不通过名称相似度推断。

Decision 的 `domain` 是所选正式 Markdown。Investigation 的 `domain` 是所选正式报告 Markdown 与完整 owner 资源树；资源成员取工作区与 `HEAD` 的路径并集，因此新增、修改、删除和未被当前正文直接引用的 owner 资源都进入范围。其他报告拥有的资源保持在范围外。

基线-only ID 在 `domain` 写入正式 Markdown 和 owner 资源删除，在 `index` 写入索引条目删除，在 `all` 原子写入两者。关系、共享引用或集合完整性不允许删除时，由同步与全量检查门禁返回领域失败。

所有 scope 都在已同步且全量检查通过的集合上运行。写入前后验证 `HEAD`、现有 pending 快照、所选来源字节和 owner 资源成员；结果返回规范 selector、实际写入路径、保留的无关 pending 范围和仍由调用方负责的路径。

### Resulting Impacts

- Decision Records 现有 stage 服务扩展 scope 与结果类型，同时复用当前基线/current ID 并集和 pending CAS 能力。
- Investigation Report 将索引-only staging 扩展为共同 `stage`，并增加正式报告与 owner 资源的路径准备和漂移验证。
- 两个领域共同使用 scope、selector 和结果协议；领域路径发现保持在领域层，原子 pending replacement 保持在共享版本控制层。
- Investigation 的旧 `stage-index` 公共入口由 `stage --scope index` 取代；Decision `stage` 采用同一 scope 契约。
- 旧 staging 命令与旧参数只进入普通未知命令或无效参数路径，不保留别名、弃用分支或迁移专用提示。
- 该 Plan 的 CLI 位置解析依赖 `unify-record-cli-location-and-help` 的目标契约，实施顺序需先确认该依赖已经可用或同时协调。
- 两个 skill、人类入口、生成制品、版本、staging 与版本控制测试、Test Evidence 同步更新。
- 公共 pending 快照范围形成或演进一份长期 Decision Record。

## Risks / Trade-offs

| 风险 | 控制 |
| --- | --- |
| 默认 `all` 被理解为暂存整个工作区 | Selector 只映射受管索引与领域路径，结果列出完整实际路径。 |
| 完整 owner 资源树扩大 Investigation 范围 | 写入前展示全部资源成员，范围严格限定在所选报告的 owner 目录。 |
| 基线-only ID 缺少当前来源 | 从 `HEAD` 恢复正式路径、ID 和 owner 资源成员，并以当前集合并集解析。 |
| Scope 间产生不一致 pending 状态 | 每次运行前要求当前领域同步且全量检查通过，并保护已有无关 pending 内容。 |
| 共享版本控制层吸收领域规则 | 共享层只接受已解析路径与预期快照，不解析记录或资源语义。 |

## Open Questions

无。

## Implementation Dependencies

领域 staging service 的硬前置是 `unify-record-cli-location-and-help` 与
`make-record-index-staleness-actionable`：前者提供最终 location/parser，后者提供同步集合和 mutation
freshness gate。候选生命周期与关系维护不是 staging 语义前置，但公共 parser、SDK、help 和生成制品
的集成安排在二者完成后，以最终命令表面一次收口；不把这种集成顺序扩张为共同领域 owner。
