### Case TEST-EVIDENCE-STAGE-REPOSITORY-001: 无版本仓库时稳定失败且不写工作区

Tests:
- `test:f3b1110c73debadbd2d84ffd038d1ab62f42bde9b514c6257d16d2c87abd0fa5`

Tags:
- `test-evidence`

Contract:
- 选择性索引暂存依赖可用 Git 基线，仓库不可用不能退化成工作区文件写入。

Proves:
- 无 Git 基线返回 revision-read-failed，且不创建派生索引。
