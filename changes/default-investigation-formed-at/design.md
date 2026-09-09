# Design

本 design 将当前形成时间的缺省解析收口到 investigation candidate 创建边界，并保持 `formedAt` 的显式覆盖和不可变语义。

## Context

- 固定契约要求 `formedAt` 使用带时区、无小数秒的 RFC 3339；标准 Investigation ID 的日期等于该值的 UTC 日。
- `new` 的 name 输入依据 `formedAt` 生成 `YYMMDD-<name>`，完整 ID 输入校验同日，因此 effective formedAt 必须在身份归一化前确定。
- CLI 和 `InvestigationCandidateCreateOptions` 当前都要求调用方提供 `formedAt`；候选创建后，各维护入口只读取并保留该值。
- `tools/investigation-report/` 拥有实现源码；skill 中的 MJS、source map、声明和索引 Schema 由 `bun run sync:investigation-report-check` 生成。
- 现有 candidate 与 CLI 测试已覆盖显式时间、非法输入和 readiness，可在保留这些契约的基础上增加缺省路径。

## Goals / Non-Goals

目标：

- 让工具拥有当前形成时间的缺省值，调用方拥有历史或已知形成时间的显式覆盖。
- 让 CLI 和公开 API 共享一个解析点，并让 ID 与 frontmatter 使用同一 effective formedAt。
- 保持持久格式、UTC 日期身份、显式输入校验和创建后的不可变语义。
- 通过原生测试、生成检查和稳定说明交付完整行为。

范围边界：

- `formedAt` 继续表示形成时间；本 Change 不增加或推导最后修改时间。
- 缺省值在 `new` 创建时确定；publish 继续发布候选中已有的时间和身份。
- 持久 candidate 始终写入合法字符串，不引入待发布时再补齐的 `null` 状态。
- 显式 RFC 3339 输入继续保留合法时区偏移，既有记录和索引继续使用当前格式。

## Decisions

### Intended Change

1. **一次性解析 effective formedAt。** `InvestigationCandidateCreateOptions.formedAt` 与对应运行时字段改为可选。候选创建准备逻辑先选择显式值或工具当前时钟，再把内部必填字符串交给现有 normalize、validate 和 writer。默认格式固定为 `YYYY-MM-DDTHH:mm:ssZ`。
2. **CLI 复用领域默认。** `new` 允许省略 `--formed-at`，CLI 将缺失状态交给候选创建入口，不建立独立时钟。Help 将该参数说明为历史或已知时点的可选覆盖，缺参诊断只保留其他必填参数。
3. **显式值继续走同一校验。** 字段存在时直接进入现有 RFC 3339 和 ID UTC 日期校验；空字符串或非法格式属于无效显式输入，不解释为缺省。Name-only 输入从 effective formedAt 派生 ID；完整日期 ID 必须与同一值匹配。
4. **创建后保持不可变。** Publish、sync-index、set-relations、rename、资源维护和正文编辑继续保留候选中的 `formedAt`，不再读取时钟。

### Resulting Impacts

1. **API 与分发。** 公开 options 和声明源码把 `formedAt` 标为可选，形成向后兼容的输入扩展。生成 bundle、source map 和分发声明随源码重建；持久 index state 仍要求 `formedAt`，索引 Schema 保持原有契约。
2. **稳定说明。** 固定契约和 skill 入口说明默认取时、显式覆盖及后续不可变；人类入口提供相同摘要。Skill 独立版本按实施时基线递增。
3. **验证证据。** API 测试依据输出的 `formedAt` 核对 UTC 格式与 ID 日期，避免使用容易跨日失效的外部日期断言。CLI 与生成分发测试覆盖省略参数；现有测试继续覆盖显式偏移值和非法输入。每个新增或修改的最小测试入口同步对应 Test Evidence Case。

该调整只改变局部缺省责任，长期语义由上述行为 owner 完整承接；当前没有需要独立演进的 Decision Record。

## Risks / Trade-offs

- 默认值对应候选创建时点，可能早于正文完成或 publish；它与当前调用方在 `new` 前即时取时的位置一致。需要其他真实形成时点时使用显式值。
- 省略时间并传入完整日期 ID 时，ID 需要匹配工具读取的当前 UTC 日；推荐当前调查使用 name-only 输入，由工具派生日期。
- 公开字段变为可选后，内部代码必须先收敛为必填结构再执行身份和 writer 逻辑，防止 `undefined` 扩散到持久层。

## Open Questions

无。默认发生位置、格式、显式覆盖、身份约束、不可变边界和验证方式均已确定。
