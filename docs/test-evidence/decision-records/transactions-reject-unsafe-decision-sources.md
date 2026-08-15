### Case DECISION-FILESYSTEM-TRANSACTION-001: 事务预检拒绝非普通决策文件

Entry:
- `tools/decision-records/tests/filesystem-boundaries.test.ts > decision transactions reject symlink and non-regular sources before writing any target`
- `bun test --test-name-pattern="^decision\ transactions\ reject\ symlink\ and\ non-regular\ sources\ before\ writing\ any\ target$" ./tools/decision-records/tests/run.ts`

Contract:
- 生命周期文件事务必须在写入前确认每个源是普通非符号链接文件。

Proves:
- 目录和指向决策目录外文件的符号链接均使预检报告无写入失败；索引、外部文件和不安全源入口保持原状。
