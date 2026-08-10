### Case TEST-EVIDENCE-STAGE-ISOLATION-001: 单 Case 暂存隔离并保留领域文件边界

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index isolates one case without reading or staging domain files`
- `bun test --test-name-pattern="^stage-index isolates one case without reading or staging domain files$" ./tools/test-evidence/tests/run.ts`

Contract:
- A、B Case 同时改变时，选择 A 只把 A 的索引条目带入 `pending`，并保持领域文件与范围外待提交内容不变。

Proves:
- pending 索引使用 A 的工作区条目和 B 的 revision 条目。
- topic 表、Case Markdown 与工作区索引即使在同步后失效也不会被暂存入口读取、改写或加入 pending。
- JSON 输出符合选择性暂存结果 Schema，目标外 pending 路径保持原样。
