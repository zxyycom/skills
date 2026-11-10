### Case RECORD-NATIVE-RELEASE-PREPARE-001: 打包门禁先准备本地原生运行时

Tests:
- `test:ee64c48f3fbbb5db7cb5476eb86b3e5746b13369d7cd2ffe19e83e42e4ed5bf3`

Tags:
- `repository-tooling`

Contract:
- Package Skills 在完整 release Gate 前显式预取锁定依赖、准备并检查本地原生运行时，不能依赖已有 `.local` 状态或退回旧业务实现。
- 正式候选准备与组装须使用同一冻结源码的原生版本。

Proves:
- 读取实际 workflow，核对锁定 Cargo fetch、prepare 与无写检查按序位于完整 release Gate 之前；本节点不执行真实 GitHub Actions 或证明目标平台构建。
- 静态核对候选准备和组装命令传递同一冻结版本变量。
