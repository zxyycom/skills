### Case DECISION-SHOW-OUTPUT-001: Show 返回元数据并报告正文读取失败

Entry:
- `tools/decision-records/tests/queries.test.ts > decision show returns metadata and reports body read failures`
- `bun test --test-name-pattern="^decision show returns metadata and reports body read failures$" ./tools/decision-records/tests/run.ts`

Contract:
- show 返回稳定 ID/sourcePath 元数据；正文读取失败时不输出部分结果。

Proves:
- 模拟读取失败，断言空 stdout、定位诊断和单次读取。
