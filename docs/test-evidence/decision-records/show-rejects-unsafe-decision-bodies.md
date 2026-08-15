### Case DECISION-FILESYSTEM-QUERY-BODY-001: 查询正文拒绝非普通决策文件

Entry:
- `tools/decision-records/tests/filesystem-boundaries.test.ts > decision show rejects symlink and non-regular bodies without reading outside the decisions directory`
- `bun test --test-name-pattern="^decision\ show\ rejects\ symlink\ and\ non-regular\ bodies\ without\ reading\ outside\ the\ decisions\ directory$" ./tools/decision-records/tests/run.ts`

Contract:
- `show` 读取已索引正文前必须重新确认目标为普通非符号链接文件。

Proves:
- `show` 对目录和指向决策目录外文件的符号链接均返回读取失败，且外部文件内容保持不变。
