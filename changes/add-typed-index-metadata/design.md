# Design

本设计在通用索引已有的确定性 state 投影上增加一个最小、类型化的集合元数据层，并按索引构造阶段限定各策略可见的上下文。

## Context

- `tools/index-runtime/README.md` 当前定义索引外壳、领域 definition、revision、新鲜度、查询和同步责任。
- 当前 schema v1 是严格对象，只包含 `definitionVersion`、`entries`、`keyDefinitions`、`namespace`、`schemaVersion` 和 `sourceRevision`。
- 当前 `StateSnapshot<State>` 只返回 `{ revision, states }`，`parseState`、`identify` 和 key `derive` 只接收单条 state。
- 当前消费者是 `decision-records`、`investigation-report` 和 `test-evidence`；共享源码会内联到各自分发模块，因此公共契约变化会影响三个分发单元。
- 三个 change 的实施顺序是 `add-typed-index-metadata`、`derive-decision-establishment-from-markdown`、`organize-decisions-by-domain`。本 change 没有前置 change，并向第三个 change 提供 metadata 契约。
- 最终实现只接受 schema v2。后续 `organize-decisions-by-domain` 将把 `decision-domains.json` 的受控定义作为决策索引 metadata；本 change 不拥有决策领域语义。

## Goals / Non-Goals

目标：

- 让领域用 `Metadata extends JsonObject` 描述整个索引需要携带的非条目数据。
- 保持 metadata、states 和 revision 来自同一次领域读取，并在持久索引、reader 和查询输出中传播同一类型。
- 让逐条策略只依赖在条目投影前已经稳定的 metadata。
- 为确有完整索引校验需求的领域提供构造完成后的单一入口，避免循环依赖和顺序敏感。
- 保持 metadata 是不透明 JSON 对象，通用层只负责结构、确定性和新鲜度。

非目标：

- 不建立 metadata 查询语言、更新 API、缓存、统计字段或通用 collection 模型。
- 不把可从 entries 推导的计数或临时运行状态写入 metadata。
- 不让 id 或 key 依赖尚未完成的其他条目，也不改变 runtime state overlay 的逐条确定性。
- 不读取 schema v1，也不为缺失 metadata 自动插入 `{}`。

## Decisions

1. 通用外壳升级为 `schemaVersion: 2`，并在 `sourceRevision` 前保存必需的 `metadata: JsonObject`。这里的 `JsonObject` 只允许合法 JSON 值，number 必须是有限数值；没有集合级数据的消费者写入 `"metadata": {}`。
2. `StateSnapshot<State, Metadata>` 固定返回 `{ revision, metadata, states }`。领域 `read` 对 metadata 与 states 使用同一时点，`readRevision` 必须覆盖任何会改变二者投影的源变化。
3. `StateIndexDefinition<State, Metadata>` 增加 `parseMetadata(input)`。构建和读取持久索引都先把外部值作为 `unknown` 校验为 `JsonObject`，再交给领域 parser 收窄为 `Metadata`；`createStateIndexSchema` 同时要求领域提供 metadata schema，并把它组合进严格外壳。
4. `parseState`、`identify` 和每个 key strategy 的 `derive` 接收同一个只读 `{ metadata }` 上下文。该上下文不包含 entries 或部分索引，保证投影不依赖条目遍历顺序。
5. 完整索引只通过可选的后置 `validateIndex(index)` 提供给领域。构建新索引和解析持久索引都在通用 schema 校验、条目投影与规范化完成后调用该同步回调；抛出的错误映射为 `state-index.index-validation-failed` 诊断。它只验证静态完整索引，不参与单条 key 派生，也不处理 runtime overlay。
6. `StateIndex<State, Metadata>`、`StateIndexDefinition<State, Metadata>`、`StateSnapshot<State, Metadata>`、`StateIndexReader<State, Metadata>`、`StateIndexRuntime<State, Metadata>` 和 `StateIndexQueryOutput<State, Metadata>` 传播两个泛型。`Metadata` 默认 `JsonObject`，definition helper 应从 `parseMetadata` 与 `read` 推断具体类型。reader 暴露只读 metadata，query output 同时返回 metadata 与分页条目；runtime state overlay 使用同一份 snapshot metadata，不能覆盖它。
7. canonicalization 对 metadata 对象使用既有确定性对象顺序，对数组保留 `parseMetadata` 返回的顺序。领域需要语义数组顺序时，必须在 parser 中完成校验和规范化。
8. `investigation-report` 和 `test-evidence` 使用专用空 metadata 类型与 `{}`；其 state、key 和领域 `definitionVersion` 不因只增加通用外壳字段而变化。决策索引先接入相同类型，实际领域定义由后续 change 填充。
9. 既有“索引不保存通用领域元数据”长期决策必须由新的 index-runtime 决策修订；新决策只确立通用不透明 metadata 和阶段化策略上下文，不把决策领域语义写入共享 owner。

## Risks / Trade-offs

- 两个泛型会贯穿公共 API、三个消费者和声明产物，文件影响面大；通过从 schema 与核心类型开始、逐消费者迁移和类型检查控制遗漏。
- 在 query output 重复返回 metadata 会增加一个小的内存引用和 API 字段，但换来直接查询调用方不需要额外打开 reader 或寻找源文件。
- 后置 `validateIndex` 扩大了 definition 表面；其阶段和职责必须固定为“完整静态索引校验”，否则容易演变为跨条目派生或动态查询钩子。
- schema v2 要求所有仓库内持久索引和 fixture 在同一 change 中重写；残留 schema v1 产物应由检查直接暴露。
- 三个分发单元都会因内联共享源码而变化；版本提升必须相对 Git 基线计算，避免同一组 change 内重复提升 `decision-records`。

## Open Questions

无。

## Implementation Observations

- “只读 metadata”同时由类型和运行时保证：projection context、reader、query output 与完整索引校验使用递归只读类型；通用层只递归冻结 parser 输出经过规范化后形成的内部副本，不冻结 snapshot 或 runtime 调用方传入的原始对象。
- `additionalProperties: false` 的空对象 JSON Schema 会被通用 schema-to-TypeScript 生成器宽化为 `{}`；test-evidence 的生成 owner 因而只在声明编译副本上使用 `tsType: Record<string, never>`，发布 JSON Schema 仍保持标准结构，两份生成声明通过类型测试共同约束。
