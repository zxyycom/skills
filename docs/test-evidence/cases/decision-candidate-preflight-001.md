### Case DECISION-CANDIDATE-PREFLIGHT-001: Lifecycle preflight 只读且要求 body-ready candidate

Tests:
- `test:3bc7c461e3aff29aa3f34b2c4904c1d4419e6ccb38ca2fb1148d8df3a60fb9a1`

Tags:
- `decision-records`

Contract:
- scaffold 不能通过 lifecycle 建立；body-ready candidate 的 preflight 必须零写入，正式 activate 必须独立执行建立。

Proves:
- 未完成 scaffold 的 activate preflight 失败且 Markdown 不变。
- body-ready candidate 的 activate preflight 成功、不写 Markdown 或索引，并明确指出没有写入。
- 随后非 preflight activate 才创建正式索引。
