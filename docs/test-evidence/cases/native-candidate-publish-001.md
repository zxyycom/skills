### Case NATIVE-CANDIDATE-PUBLISH-001: 原生 rolling 发布顺序与重入

Tests:
- `test:b687549b63e637b101cff1a739333c15561f8715930fccbe1ed4662867af63f0`
- `test:f1c3ef62550de08ebe55aab35b18903f23174b00b5568c8e8982d619f7482e75`

Tags:
- `repository-tooling`

Contract:
- 发布前验证显式资产；rolling 先上传并核对新资产，再仅移除两个旧名，最后更新 manifest；相同运行时版本和 snapshot 资产不可变。

Proves:
- 隔离远端替身覆盖损坏 ZIP、私有 0.1.0、损坏或跨角色错配的冻结 Schema 在网络前拒绝；观察 decision 旧名删除晚于一个 investigation runtime 上传、无关资产保留、manifest 中断重入、旧 tag 记录、不可变资产冲突和 snapshot 创建/重用/缺项拒绝。
- 暂存输入尚未进入基准 commit 或发布 commit 不匹配时，在远端操作前拒绝。
- 以 release ID 与 tag 核对 Latest；模拟错配时只修复 Latest，修复未生效时拒绝报成功。
- 新建 rolling 在资产完成前保持原 Latest，成功后标记 Latest；生成的说明含两平台名称与摘要校验命令。
- 未直接断言删除调用恰为两个旧名、每项上传后的核对顺序，或首升说明中的显式目标；这些仍是发布契约，不因本 Case 的观察边界而取消。
- 临时 Git 仓库验证 push URL 重写后的实际目标被拒绝；Unix 假 gh 进程验证环境中的其他 GH_HOST/GH_REPO 被覆盖为 github.com 与固定仓库。不访问真实 GitHub，不证明实际发布或远端恢复。
