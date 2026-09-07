### Case CHANGE-PLAN-CLI-003: 当前命令的 text、JSON 与退出协议

Tests:
- `test:6b094a3251ef51fff41905eb256e5b1f8c440605a90fd5eac7d19fd61febd589`

Tags:
- `change-plan`

Contract:
- 移除 archive 生命周期后，list、show、check、check-all 与 plan 继续只面向当前 Change，并保留各自 text、JSON 和成功/领域失败退出协议。

Proves:
- stage-filtered list JSON 只返回匹配的当前 Plan，show text 展开固定 artifact，invalid check JSON 以 1 退出，collection text 对无效 member 失败。
- draft plan JSON 写入 Plan metadata 并成功退出。
