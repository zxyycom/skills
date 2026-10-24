### Case GATE-TEST-EVIDENCE-ADAPTER-OWNER-001: 项目测试证据 adapter 只影响实际项目 Check

Tests:
- `test:b714dc7470e5dc16af07e803cd6570c5c4c422a052ceb3c001924cf44be80a60`

Tags:
- `repository-tooling`

Contract:
- 项目 snapshot/check/migrate adapter 树归三项 project Check，不扩大核心 Case/runtime 或无关脚本订阅。

Proves:
- adapter 实现/leaf/helper 改动使三项 project Check execute，core/public-boundary reuse；无关 publish 脚本不触发三项重跑。
