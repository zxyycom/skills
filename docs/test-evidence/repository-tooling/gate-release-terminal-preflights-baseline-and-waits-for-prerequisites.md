### Case GATE-RELEASE-FINAL-TIMING-001: release version Check 在普通前置后许可打包

Entry:
- `scripts/vibe-check.test.ts > release version Check preflights its baseline and gates packaging`
- `bun test --test-name-pattern="^release version Check preflights its baseline and gates packaging$" ./scripts/vibe-check.test.ts`

Contract:
- full 的 `release:skill-version` 直接依赖全部普通 release-required Check，`pack:skills` 只依赖版本节点。version preflight 只验证 authored `baselineRef` 的 wrapper 输入边界，不解析 Git ref；实际版本校验只能在全部普通前置有可信 passed 结果后执行。

Proves:
- version Check 以 `origin/release` 作为 authored baseline，preflight 生成该 invocation-local options；空值、首尾空白、前导连字符及 NUL/CR/LF 均阻断。
- `release:skill-version/release-baseline` Record 保留该输入；版本节点依赖全部普通前置，打包节点只在版本结果可信 passed 后执行。
