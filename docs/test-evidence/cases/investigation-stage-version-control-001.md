### Case INVESTIGATION-STAGE-VERSION-CONTROL-001: 索引暂存区分非仓库和损坏 Git

Tests:
- `test:027fd8bef94fc0895ada14464b6216b75694b73715b77ccf5a9d1097fe260b06`
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`

Tags:
- `investigation-report`

Contract:
- index scope 选择性暂存要求可用 Git 仓库，不将损坏 Git metadata 当作普通非仓库。

Proves:
- 共享 stage_index 的 Decision definition 测试区分非仓库和损坏 metadata；IR definition 的真实 Git fixture 调用同一入口成功。
- IR CLI 源码的 index 分支将请求交给该共享入口；本组合不声称真实 IR 非仓库故障 fixture 已执行。
