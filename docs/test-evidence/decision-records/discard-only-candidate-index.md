### Case DECISION-CANDIDATE-INDEX-001: 丢弃唯一候选不创建索引

Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discarding the only candidate leaves no established decision index`
- `bun test --test-name-pattern="^discarding the only candidate leaves no established decision index$" ./tools/decision-records/tests/run.ts`

Contract:
- 丢弃最后一条完整候选后，不存在任何 established record 时必须移除而非保留空的 decision-index。

Proves:
- discard 成功后候选文件与 decision-index 均不存在。
