### Case GATE-RELEASE-VERSION-UNAVAILABLE-001: 版本校验不可用阻断打包

Entry:
- `scripts/vibe-check.test.ts > release version validation unavailable or throws blocks package execution`
- `bun test --test-name-pattern="^release version validation unavailable or throws blocks package execution$" ./scripts/vibe-check.test.ts`

Contract:
- release 终结 Check 的 `hash:skills` 无法形成可信结果时必须 unavailable，aggregate 必须失败，且本次零调用 `pack:skills`。

Proves:
- 注入的版本 runner 显式返回 unavailable 或抛出异常，都会使终结 `pack:skills` Check 以 `package-script-start-failed` unavailable 结算。
- 两种不可用路径都恰好尝试一次版本校验而从不调用打包。
