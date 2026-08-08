### Case INVESTIGATION-SCALE-INDEX-001: 千份调查报告可同步并查询
Entry:
- `tools/investigation-report/tests/scale.test.ts > index synchronizes and queries one thousand investigation reports`
- `bun test --test-name-pattern="^index synchronizes and queries one thousand investigation reports$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查 ID-keyed 索引的一千份报告回归必须完成同步、快速新鲜度读取与查询；记录的墙钟值只用于发现明显退化，不构成持续性能 SLO。
Proves:
- 规模夹具完整写入一千个 keyed entries，快速读取与查询返回正确数量并记录同步、freshness-read 和 freshness-query 墙钟测量。
