### Case INVESTIGATION-COLLECTION-ROOT-001: full validation rejects unknown investigation root members

Entry:

- `tools/investigation-report/tests/parsing-directory.test.ts > full validation rejects unknown investigation root members`
- `bun test --test-name-pattern="^full validation rejects unknown investigation root members$" ./tools/investigation-report/tests/run.ts`

Contract:

- 平铺 Investigation Report 根目录只允许规范报告、派生 index 和 `_resources/`。

Proves:

- 未知根文件返回其必须为根级 Investigation ID Markdown 文件的可行动诊断。
