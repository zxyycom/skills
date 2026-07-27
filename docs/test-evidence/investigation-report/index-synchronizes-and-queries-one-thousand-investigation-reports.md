### Case INVESTIGATION-SCALE-INDEX-001: 千份调查报告可同步并查询
Entry:
- `tools/investigation-report/tests/scale.test.ts > index synchronizes and queries one thousand investigation reports`
- `bun test --test-name-pattern="^index synchronizes and queries one thousand investigation reports$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查索引必须支持至少一千份报告的同步与查询。
Proves:
- 规模夹具完整写入索引并返回正确筛选结果。
