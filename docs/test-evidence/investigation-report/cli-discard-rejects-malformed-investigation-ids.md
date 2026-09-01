### Case INVESTIGATION-CLI-DISCARD-ARGS-001: CLI discard rejects malformed investigation IDs as argument errors

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI discard rejects malformed investigation IDs as argument errors`
- `bun test --test-name-pattern="^CLI discard rejects malformed investigation IDs as argument errors$" ./tools/investigation-report/tests/run.ts`

Contract:
- CLI 的非法 Investigation ID 是调用参数错误，不是领域操作失败。

Proves:
- 直接调用的源码 CLI 入口对 `./report.md` 返回 status 2、空 stdout，且报告未改。
