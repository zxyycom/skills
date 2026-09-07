### Case TEST-EVIDENCE-STAGE-REPOSITORY-001: 无版本仓库时稳定失败且不写工作区

Tests:
- `test:8a8c1b1b6e6df7a6da169731c2830eb5ad2d0aadce5cca1331b45dc9562405ee`

Tags:
- `test-evidence`

Contract:
- 选择性索引暂存依赖可用 Git 基线，仓库不可用不能退化成工作区文件写入。

Proves:
- 无 Git 基线返回 revision-read-failed，且不创建派生索引。
