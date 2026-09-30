# Proposal

本 Change 为 Decision Records 与 Investigation Report 的搜索结果补齐查询元信息，让调用方直接判断搜索范围、来源、数量和完整性。

## Why

两个记录型 skill 已返回身份、摘要和文本证据，但查询总览仍依赖调用方手工统计，并结合 help 和 warning 恢复。Investigation metadata 搜索按 limit 返回部分命中时没有标记；共享全文搜索的预览字符预算又会提前结束扫描。这使返回数量、命中总数和预览限制容易混淆。

## Outcome

两个 skill 的成功搜索都从同一查询结果提供实际参数、数据来源、精确命中数或已确认下界、返回数量，以及扫描、返回和预览各自的完整性。默认 CLI 在原有记录之前展示短摘要，使调用方能正确解释本次结果。

## Scope

### Intended Change

- 调整两个记录型 skill 的 `search` 契约、领域结果和默认文本输出，保留各自的筛选与身份语义。
- 补齐实际参数、来源、计数和覆盖信息；修正 Investigation metadata 的限量返回标记。
- 让两个记录域的命中文件识别独立于预览预算，同时保留扫描资源与返回记录上限。
- 范围及兼容边界由 [design](design.md) 承接；Test Evidence 修复留给后续，其他 CLI 保持现状。

### Resulting Impacts

- 共享搜索承接计数与覆盖事实，两个领域分别补充参数、来源和身份；现有其他消费者保持兼容。
- Investigation 公开搜索类型及声明、Decision 内部查询类型与 CLI 同步新增元信息。
- 两域行为说明、help、原生测试、Case、生成制品和独立 skill 版本随实现对齐。

## Success Criteria

1. 两个成功查询结果具有四组元信息；CLI 使用同一结果生成摘要。
2. 完整匹配提供精确计数，提前停止提供已确认下界；metadata 限量返回准确区分扫描与返回覆盖。
3. 预览预算仅限制两个记录域的展示，命中身份与计数继续受扫描及返回预算控制。
4. 完整零命中、返回受限、仅预览受限、陈旧索引、来源降级与读取/资源失败有各自的回归证据。
5. 元信息属于即时查询；原有记录字段、筛选、身份、文本证据、关系依据及失败语义保持兼容。
6. design 的范围边界、两域生成与版本检查、领域测试、Case 检查和 `bun run check` 通过。

## Affected Owners

| Owner | 责任 |
| --- | --- |
| [Decision Records](../../skills/decision-records/SKILL.md)、[决策查询规则](../../skills/decision-records/references/decision-record-rules.md) | Decision 搜索行为与结果解释。 |
| [Investigation Report](../../skills/investigation-report/SKILL.md)、[调查查询契约](../../skills/investigation-report/references/investigation-report-contract.md) | Investigation 查询、公开类型与覆盖边界。 |
| `tools/decision-records/src/decision-query-*.ts`、`cli-output-search.ts` | Decision 查询实现与展示。 |
| `tools/investigation-report/src/query-search*.ts`、`types.ts`、`cli-query-commands.ts` | Investigation 查询、公开类型与展示。 |
| `tools/shared/src/file-text-search/` | 文件匹配、计数、扫描与预览。 |
| [Test Evidence Review](../../skills/test-evidence-review/SKILL.md) | 回归测试的 Case 维护。 |
| [项目工具链](../../docs/tooling.md)、[编码规范](../../docs/coding-style.md) | 源码、构建、分发、版本与验证。 |
