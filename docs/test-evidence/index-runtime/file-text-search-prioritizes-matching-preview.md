### Case FILE-TEXT-SEARCH-PREVIEW-BUDGET-001: 文件搜索先保留命中预览再消耗上下文预算

Entry:
- `tools/shared/tests/file-text-search.test.ts > preserves a clipped matching preview before spending budget on context`
- `bun test --test-name-pattern="^preserves a clipped matching preview before spending budget on context$" ./tools/shared/tests/file-text-search.test.ts`

Contract:
- 预览字符预算不足时，文件文本搜索必须优先保留命中行，而不是由上下文耗尽预算。

Proves:
- 上下文行超过预算时仍输出完整可容纳的命中行及其范围。
- 省略上下文后结果标记 previewCharacters 截断。
