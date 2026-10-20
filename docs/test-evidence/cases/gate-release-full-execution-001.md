### Case GATE-RELEASE-FULL-EXECUTION-001: release、cold 与 CI 不按 receipt 省略项目执行

Tests:
- `test:4a4eb24eb3b07c00dc4da66ba95063770fca8cc4278604c9bc30b7c9cbf6a870`
- `test:8c75584b6b46a15fe5996b310b8271f60cf06a367315a9afbb2c2bbd11019978`

Tags:
- `repository-tooling`

Contract:
- release 与 CI 模式不把项目 receipt 计划变成省略选择；release 即使传入 cold 也执行完整 Gate，且不采集或发布项目输入成功证明。

Proves:
- CI base、普通 full 与 cold full 向 Definition 传入 undefined activeCheckIds，命令 flags 保持 base/release 原意。
- release 计划选择完整 64 项、snapshot 为 null，禁止探测 receipt 的 captureCommand 未被调用，发布返回 not-incremental。
