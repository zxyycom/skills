### Case TEST-EVIDENCE-LEDGER-CLI-NODE-SMOKE-001: Ledger CLI Node smoke 保持进程边界

Entry:
- `tools/test-evidence/tests/ledger-cli.test.ts > ledger CLI Node smoke preserves process argv, output streams, and exit status`
- `bun test --test-name-pattern="^ledger CLI Node smoke preserves process argv, output streams, and exit status$" ./tools/test-evidence/tests/run.ts`

Contract:
- 分发 Ledger CLI 必须可由真实 Node 进程按 argv 启动，并保留 JSON stdout、stderr 和退出状态边界。

Proves:
- 有效 `check` 以退出码 `0` 返回可解析的无诊断 JSON 报告且 stderr 为空。
- 缺少必需 root 的调用以退出码 `2` 保持 stdout 为空，并在 stderr 返回用法诊断。
