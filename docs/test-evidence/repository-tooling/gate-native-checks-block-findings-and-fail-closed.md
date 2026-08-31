### Case GATE-VIBE-NATIVE-001: 原生 blocking Check 对 finding 与 unavailable fail closed

Entry:
- `scripts/vibe-check.test.ts > native blocking Checks pass, fail on findings, and fail closed when unavailable`
- `bun test --test-name-pattern="^native blocking Checks pass, fail on findings, and fail closed when unavailable$" ./scripts/vibe-check.test.ts`

Contract:
- 重复、JSON、Schema 与 Markdown 链接的可信 finding 必须阻断 aggregate；输入或执行不可用也不能被解释为成功。

Proves:
- 有效 fixture 全部 passed；真实重复、无效 JSON、Schema 违例和失效链接分别使其原生 Check failed。
- 不存在的项目根使四项原生 blocking Check 均 unavailable，并由 aggregate fail closed。
