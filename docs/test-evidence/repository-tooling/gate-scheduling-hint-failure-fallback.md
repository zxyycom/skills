### Case GATE-SCHEDULING-NONBLOCKING-FALLBACK-003: scheduling-hint I/O 与未完成 Run 不改变门禁真值

Entry:
- `scripts/vibe-check.test.ts > scheduling-hint I/O failures never change Vibe gate results or store incomplete Runs`
- `bun test --test-name-pattern="^scheduling-hint I/O failures never change Vibe gate results or store incomplete Runs$" ./scripts/vibe-check.test.ts`

Contract:
- scheduling hints 只是性能建议；读取或写入失败不能改变 Vibe aggregate、CLI 退出码或诊断边界，aggregate failed 或非 completed Run 不写入提示。

Proves:
- 注入读写失败时 Gate 仍保留原有成功或失败结果。
