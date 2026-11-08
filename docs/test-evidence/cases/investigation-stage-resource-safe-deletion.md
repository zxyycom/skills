### Case INVESTIGATION-STAGE-RESOURCE-SAFE-DELETION-001: 缺失资源根的已选资源删除

Tests:
- `test:51e2039addb976c9e176869a41e03b5d8e759ba2a589e42606fbc5c044d876e7`

Tags:
- `investigation-report`

Contract:
- all scope 接纳已删除的所选 owner 资源树，不能因工作区资源根缺失丢失该删除。

Proves:
- 真实 Git 中移除资源文件、owner 目录和资源根后，all scope 暂存基线资源删除并保留未选 pending。
