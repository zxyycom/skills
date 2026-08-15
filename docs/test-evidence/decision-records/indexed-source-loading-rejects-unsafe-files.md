### Case DECISION-FILESYSTEM-INDEX-SOURCE-001: 索引源读取拒绝非普通决策文件

Entry:
- `tools/decision-records/tests/filesystem-boundaries.test.ts > indexed source loading rejects symlink and non-regular decision files before reading them`
- `bun test --test-name-pattern="^indexed\ source\ loading\ rejects\ symlink\ and\ non-regular\ decision\ files\ before\ reading\ them$" ./tools/decision-records/tests/run.ts`

Contract:
- 建立索引时，Decision ID 对应的 root 或 archive 源必须是普通非符号链接文件。

Proves:
- 源读取对目录和指向决策目录外文件的符号链接均在读取前失败，外部文件内容保持不变。
