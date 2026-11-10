### Case NATIVE-RECORD-SOURCE-READ-ROUTING-001: show 逐源回读同 ID 并保留部分成功

Tests:
- `test:a7e282dd523655c6f151ad6f2403e131beaf0c684f70919977b75376f32cd35f`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 按 key 的 show 分别在每源解析同一 selector，不跨来源消歧；任一源失败时汇总失败但保留其他来源结果。

Proves:
- 两个来源共享完整 ID、正文不同，真实 show 按来源顺序返回各自正文。
- 删除第一源索引后退出 1，汇总为 source-query-failed；第一源标记 index-not-found，第二源仍成功返回自身正文。
