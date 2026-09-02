### Case DECISION-CANDIDATE-PREFLIGHT-001: Lifecycle preflight 只读且要求 body-ready candidate

Entry:
- `tools/decision-records/tests/candidate-scaffold.test.ts > lifecycle preflight is read-only and still requires a body-ready candidate`
- `bun test --test-name-pattern="^lifecycle preflight is read-only and still requires a body-ready candidate$" ./tools/decision-records/tests/run.ts`

Contract:
- scaffold 不能通过 lifecycle 建立；body-ready candidate 的 preflight 必须零写入，正式 activate 必须独立执行建立。

Proves:
- 未完成 scaffold 的 activate preflight 失败且 Markdown 不变。
- body-ready candidate 的 activate preflight 成功、不写 Markdown 或索引，并明确指出没有写入。
- 随后非 preflight activate 才创建正式索引。
