### Case NATIVE-CANDIDATE-PUBLISH-001: 原生 rolling 发布顺序与重入

Tests:
- `test:b687549b63e637b101cff1a739333c15561f8715930fccbe1ed4662867af63f0`

Tags:
- `repository-tooling`

Contract:
- 发布前验证显式资产；rolling 先上传并核对新资产，再仅移除两个旧名，最后更新 manifest；相同运行时版本和 snapshot 资产不可变。

Proves:
- 隔离远端替身覆盖损坏 ZIP、私有 0.1.0、损坏或跨角色错配的冻结 Schema 在网络前拒绝；上传后复核、仅移除旧名并保留无关资产、manifest 中断重入、旧 tag 记录、不可变资产冲突和 snapshot 创建/重用/缺项拒绝。
- 暂存输入尚未进入基准 commit 或发布 commit 不匹配时，在远端操作前拒绝。
- 以 release ID 与 tag 核对 Latest；模拟错配时只修复 Latest，修复未生效时拒绝报成功。
- 新建 rolling 在资产完成前保持原 Latest；生成并回读含两平台下载、摘要校验和显式目标的首升说明，再标记 Latest。
- 临时 Git 仓库验证 push URL 重写后的实际目标被拒绝；Unix 假 gh 进程验证环境中的其他 GH_HOST/GH_REPO 被覆盖为 github.com 与固定仓库。不访问真实 GitHub，不证明实际发布或远端恢复。
