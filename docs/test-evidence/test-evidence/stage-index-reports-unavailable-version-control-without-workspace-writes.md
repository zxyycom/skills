### Case TEST-EVIDENCE-STAGE-REPOSITORY-001: 无版本仓库时稳定失败且不写工作区

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index reports unavailable version control without workspace writes`
- `bun test --test-name-pattern="^stage-index reports unavailable version control without workspace writes$" ./tools/test-evidence/tests/run.ts`

Contract:
- 选择性索引暂存依赖可用的版本仓库，仓库不可用不能退化成工作区文件写入。

Proves:
- 结果使用 `revision-read-failed` 与 `state-index.repository-unavailable` 诊断。
- 工作区索引和 Case Markdown 字节保持不变。
