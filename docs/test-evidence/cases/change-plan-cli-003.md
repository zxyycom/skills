### Case CHANGE-PLAN-CLI-003: 当前命令的 text、JSON 与退出协议

Tests:
- `test:71637fa97eee9757d8c042425ffc8638bc921684a9b7440ea35f6146486ae80f`

Tags:
- `change-plan`

Contract:
- 移除 archive 生命周期后，list、show、check、check-all 与 plan 继续只面向当前 Change，并保留各自 text、JSON 和成功/领域失败退出协议。

Proves:
- stage-filtered list JSON 只返回匹配的当前 Plan，show text 展开固定 artifact，invalid check JSON 以 1 退出，collection text 对无效 member 失败。
- draft plan JSON 写入 Plan metadata 并成功退出。
