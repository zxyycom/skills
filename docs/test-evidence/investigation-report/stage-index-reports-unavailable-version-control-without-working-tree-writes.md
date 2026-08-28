### Case INVESTIGATION-STAGE-VERSION-CONTROL-001: stage-index reports unavailable version control without working-tree writes

Entry:

- `tools/investigation-report/tests/staging.test.ts > stage-index reports unavailable version control without working-tree writes`
- `bun test --test-name-pattern="^stage-index reports unavailable version control without working-tree writes$" ./tools/investigation-report/tests/run.ts`

Contract:

- 选择性暂存要求可用版本仓库，失败时不改写工作树。

Proves:

- 非 Git fixture 返回错误，报告 Markdown 与派生 index 的完整字节保持不变。
