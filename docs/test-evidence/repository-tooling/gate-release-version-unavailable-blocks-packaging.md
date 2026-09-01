### Case GATE-RELEASE-VERSION-UNAVAILABLE-001: 版本校验不可用阻断打包

Entry:
- `scripts/vibe-check.test.ts > release version validation unavailable or throws blocks package execution`
- `bun test --test-name-pattern="^release version validation unavailable or throws blocks package execution$" ./scripts/vibe-check.test.ts`

Contract:
- `release:skill-version` 的 `hash:skills` 无法形成可信结果时必须 unavailable，aggregate 必须失败，且下游实际打包零调用。

Proves:
- 注入的版本 runner 显式返回 unavailable 或抛出异常，都会使版本节点 unavailable，并让依赖它的 `pack:skills` 无可信结果可执行。
- 两种不可用路径都恰好尝试一次版本校验而从不调用打包。
