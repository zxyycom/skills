### Case INDEX-RUNTIME-STAGING-REPOSITORY-001: 暂存前报告可执行的仓库发现失败

Entry:
- `tools/index-runtime/tests/staging.test.ts > reports an actionable repository discovery failure before staging`
- `bun test --test-name-pattern="^reports an actionable repository discovery failure before staging$" ./tools/index-runtime/tests/run.ts`

Contract:
- 按 ID 暂存依赖可用的版本管理仓库；仓库发现失败必须与 revision 文件读取失败分开诊断并给出下一步。

Proves:
- 非仓库根目录返回 `revision-read-failed` 和 `state-index.repository-unavailable`。
- 诊断要求选择由仓库承载的根目录后重试。
