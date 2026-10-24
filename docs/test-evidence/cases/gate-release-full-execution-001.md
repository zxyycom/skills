### Case GATE-RELEASE-FULL-EXECUTION-001: release、cold 与 CI 不按 receipt 省略项目执行

Tests:
- `test:4a4eb24eb3b07c00dc4da66ba95063770fca8cc4278604c9bc30b7c9cbf6a870`
- `test:8c75584b6b46a15fe5996b310b8271f60cf06a367315a9afbb2c2bbd11019978`

Tags:
- `repository-tooling`

Contract:
- release 与 CI 模式不把项目 receipt 计划变成省略选择；release 即使传入 cold 也执行完整 Gate，且不采集或发布项目输入成功证明。

Proves:
- 即使注入可省略全部 Check 的 incremental 计划，CI base、显式 release 与 release cold、兼容 full 与 cold full 仍向 Definition 传入 undefined activeToolIds；命令 flags 保持 base/release 原意，不携带 receipt tool flags，项目 lint 无 activation condition 且违规 Markdown 实际执行失败。
- release 计划选择完整 67 项、snapshot 为 null，禁止探测 receipt 的 captureCommand 未被调用，发布返回 not-incremental。
