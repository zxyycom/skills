### Case DECISION-CLI-REMOVED-PROTOCOL-001: CLI 拒绝移除的领域和路径查询协议

Entry:
- `tools/decision-records/tests/cli-args.test.ts > decision CLI rejects removed domain and path query protocols`
- `bun test --test-name-pattern="^decision CLI rejects removed domain and path query protocols$" ./tools/decision-records/tests/run.ts`

Contract:
- 当前 CLI 不公开 `domains`、`--domain`、路径式 record ID 或 tag OR/NOT 选择器。

Proves:
- 帮助不含领域协议，五种已移除调用均以参数错误码 `2` 退出、不写 stdout，并在 stderr 报告多余位置参数、未知选项或无效 Decision ID。
