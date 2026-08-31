### Case GATE-JSCPD-CONFIG-001: jscpd 兼容 wrapper 对缺失扫描配置 fail closed

Entry:
- `scripts/vibe-check.test.ts > jscpd compatibility wrapper rejects scans without a Vibe config`
- `bun test --test-name-pattern="^jscpd compatibility wrapper rejects scans without a Vibe config$" ./scripts/vibe-check.test.ts`

Contract:
- Vibe 0.0.1 的 jscpd 兼容 wrapper 只允许其 `--version` 探测或带 `--config <path>` 的扫描调用；扫描配置缺失时不能退回 jscpd 默认输入范围。

Proves:
- 不带 `--config` 的扫描调用以退出码 1 失败，并在 stderr 给出稳定的缺失配置诊断。
- 该失败在转交 jscpd 前发生，stdout 保持为空。
