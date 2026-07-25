# Tasks

任务按通用契约、消费者迁移、生成同步和风险验证的顺序执行，完成出口是三个消费者只使用 schema v2。

## Readiness

- [x] 0.1 核对 proposal、design 和 tasks 均以“通用索引增加类型化集合 metadata”为唯一目标，并确认本 change 无前置 change、领域路径迁移由 `organize-decisions-by-domain` 承接。
- [x] 0.2 重新盘点 `StateSnapshot`、`StateIndexDefinition`、`StateIndex`、reader、runtime、query output 在三个消费者、测试、声明和生成器中的全部引用。
- [x] 0.3 确认 `Open Questions` 为“无”，schema v2、策略上下文和后置校验的失败语义足以直接实施。
- [x] 0.4 核对当前工作区未提交改动，确保只延续相关索引与分发文件，不覆盖用户的其他改动。

## Implementation

- [x] 1.1 将通用 schema、JSON Schema 组合入口和核心类型升级到 schema v2，并增加必需的 `metadata: JsonObject` 及 `Metadata` 泛型。
- [x] 1.2 调整 snapshot 构建、持久索引解析、条目重投影、canonicalization、序列化和同步流程，使 metadata 在条目之前完成解析并参与同一 revision 契约。
- [x] 1.3 为 `parseState`、`identify` 和 key `derive` 提供只读 metadata 上下文，并实现只在完整规范化索引上运行、失败映射明确的可选 `validateIndex`。
- [x] 1.4 让 reader、runtime 和 query output 传播 `Metadata` 泛型并提供只读 metadata，同时保持 runtime state overlay 的逐条确定性。
- [x] 1.5 将 investigation-report 和 test-evidence definitions、fixture、持久索引或生成 schema 迁移为显式空 metadata，保持其领域 definitionVersion 不变。
- [x] 1.6 将 decision-records 接入 schema v2 的类型与生成链路；本 change 使用最小 metadata，受控领域定义由 `organize-decisions-by-domain` change 填充。
- [x] 1.7 更新 Index Runtime README，并创建或修订 index-runtime 长期决策，明确不透明 metadata、阶段化策略上下文和不提供通用 metadata 语义。
- [x] 1.8 通过稳定 `sync:*` 入口重建三个 skill 的 MJS、声明、source map 和 JSON Schema；相对基线提升 investigation-report 与 test-evidence-review 版本，并与后续 change 协调 decision-records 的单次最终版本提升。

## Verification

- [x] 2.1 扩展 `test:index-runtime`，覆盖缺失或非法 metadata、schema v1 拒绝、泛型 parser、逐条策略上下文、后置完整索引校验及其诊断、确定性序列化和 revision 失配。
- [x] 2.2 运行三个消费者的行为测试与生成漂移检查，确认空 metadata、领域 metadata、公共声明和自包含分发模块一致。
- [x] 2.3 运行 `bun run typecheck`，证明双泛型在 runtime、消费者和声明源之间没有退化为 `any` 或未经校验的断言。
- [x] 2.4 运行 `bun run check`，并区分实际失败、warning 与未执行项；不得把局部测试通过表述为完整仓库通过。
- [x] 2.5 语义审阅 README、长期决策和实现，确认 metadata 仍是单一集合级数据，不复制可从 entries 推导的信息，且所有消费者都显式提供 metadata。
