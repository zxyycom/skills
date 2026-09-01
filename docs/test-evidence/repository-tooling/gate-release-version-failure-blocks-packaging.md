### Case GATE-RELEASE-VERSION-FAILURE-001: 版本校验失败阻断打包

Entry:
- `scripts/vibe-check.test.ts > release version validation failure blocks package execution`
- `bun test --test-name-pattern="^release version validation failure blocks package execution$" ./scripts/vibe-check.test.ts`

Contract:
- `release:skill-version` 在普通前置通过后校验 skill 版本；该节点 failed 时下游 `pack:skills` 失败且本次零调用打包脚本。

Proves:
- 注入的 `hash:skills` 非零退出使 `release:skill-version` 与其下游 `pack:skills` 分别结算为 failed。
- 版本校验恰好运行一次，打包没有被调用。
