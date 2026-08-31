### Case GATE-RELEASE-FINAL-TIMING-001: release 终结 Check 在前置结算后才执行版本校验

Entry:
- `scripts/vibe-check.test.ts > release terminal Check validates its baseline in preflight and waits for every prerequisite`
- `bun test --test-name-pattern="^release terminal Check validates its baseline in preflight and waits for every prerequisite$" ./scripts/vibe-check.test.ts`

Contract:
- full 的 `pack:skills` 是 release 终结 Check；它直接依赖全部 36 个 release-required Check。preflight 只验证 authored `baselineRef` 的 wrapper 输入边界，不解析 Git ref；实际版本校验只能在全部前置有可信 passed 结果后执行。

Proves:
- 终结 Check 以 `origin/release` 作为 authored baseline，preflight 生成该 invocation-local options；空值、首尾空白、前导连字符及 NUL/CR/LF 均以稳定 code 阻断。
- `pack:skills/release-baseline` Record 保留该输入；`hash:skills` 开始时所有原生与项目 release 前置都已结算，之后才执行一次 `pack:skills`。
