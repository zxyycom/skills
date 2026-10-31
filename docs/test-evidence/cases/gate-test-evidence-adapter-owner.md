### Case GATE-TEST-EVIDENCE-ADAPTER-OWNER-001: 项目测试证据 adapter 只影响实际项目 Check

Tests:
- `test:4b8de8d1c92da412ead4b71f10412fddb07457c5768ccf156823913422a5b76a`

Tags:
- `repository-tooling`

Contract:
- 项目 snapshot/check/migrate adapter 树归三项 project Check，不扩大核心 Case/runtime 或无关脚本订阅。

Proves:
- adapter 实现/leaf/helper 改动使三项 project Check execute，core/public-boundary reuse；无关 publish 脚本不触发三项重跑。
