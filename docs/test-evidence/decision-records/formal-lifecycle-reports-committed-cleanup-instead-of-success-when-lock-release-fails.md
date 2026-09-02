### Case DECISION-CANDIDATE-LOCKED-RELEASE-001: 正式生命周期在锁释放失败时报告已提交待清理

Entry:
- `tools/decision-records/tests/candidate-scaffold.test.ts > formal lifecycle reports committed cleanup instead of success when lock release fails`
- `bun test --test-name-pattern="^formal lifecycle reports committed cleanup instead of success when lock release fails$" ./tools/decision-records/tests/run.ts`

Contract:
- 正式候选建立已写入后，集合锁释放失败不能输出成功；诊断必须如实说明提交已发生但清理待处理。

Proves:
- activate 退出 1、stdout 不含成功消息，stderr 报告 `committed-cleanup-pending` 与 lock release 诊断。
- 正式索引仍存在，证明诊断没有错误宣称零写入。
