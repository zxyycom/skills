### Case INVESTIGATION-CANDIDATE-CLI-001: candidate CLI separates creation success from readiness

Entry:

- `tools/investigation-report/tests/candidate.test.ts > candidate root safety failures block formal checks and candidate CLI keeps creation success separate from readiness`
- `bun test --test-name-pattern="^candidate root safety failures block formal checks and candidate CLI keeps creation success separate from readiness$" ./tools/investigation-report/tests/run.ts`

Contract:

- `new` 成功创建候选后以退出码 0 报告正文 readiness，而保留候选文件名或成员安全错误仍阻断正式集合检查。

Proves:

- CLI 创建空正文 candidate 返回成功、在 stderr 指向编辑和 `publish --preflight`，并可由 `show-candidate` 读取。
- 不规范保留候选文件仍作为根目录安全错误阻断默认检查。
