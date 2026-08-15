### Case DECISION-CLI-REMOVED-PROTOCOL-001: CLI 拒绝移除的领域和路径查询协议

Entry:
- `tools/decision-records/tests/cli-args.test.ts > decision CLI rejects removed domain and path query protocols`
- `bun test --test-name-pattern="^decision CLI rejects removed domain and path query protocols$" ./tools/decision-records/tests/run.ts`

Contract:
- 当前 CLI 不公开 `domains`、`--domain`、路径式 record ID 或 tag OR/NOT 选择器。

Proves:
- 帮助不含领域协议，五种已移除调用均以非零退出。
