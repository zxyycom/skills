### Case GATE-RELEASE-PACKAGE-ISOLATION-001: 发布包只写独占 staging

Tests:
- `test:1475f7f31d3c59cf8dd7c2525f1f403806fde531a4ff98b82ca77bc603b775b7`

Tags:
- `repository-tooling`

Contract:
- release Gate 对冻结快照打包时只能使用本轮独占新目录，不清空已有 `dist` 或旧 staging；不安全名称和目标冲突均不得覆盖已有内容。

Proves:
- 隔离 Git fixture 调用真实 Gate 打包：非法名称写前拒绝；首次发布生成 zip 且保留 dist sentinel、旧 staging；首个打包在清理子目录后以同步栅栏触发同名并发，第二调用拒绝；完成后同名重入失败且首轮 zip 字节不变。
- 该节点不调用真实 GitHub、不证明远端发布或跨平台安装。
