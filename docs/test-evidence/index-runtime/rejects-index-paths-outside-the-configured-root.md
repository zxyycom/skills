### Case INDEX-RUNTIME-PATH-001: 拒绝配置根目录之外的索引路径
Entry:
- `tools/index-runtime/tests/materialization.test.ts > rejects index paths outside the configured root`
- `bun test --test-name-pattern="^rejects index paths outside the configured root$" ./tools/index-runtime/tests/run.ts`
Contract:
- 索引读写路径必须限制在配置根目录内。
Proves:
- 父目录逃逸路径返回 `index-path-invalid`，且主动路径语义失败不虚构 `filesystem` 事实。
