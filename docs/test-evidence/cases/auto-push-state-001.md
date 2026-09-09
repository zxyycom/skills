### Case AUTO-PUSH-STATE-001: 无效节流状态阻止自动推送

Tests:
- `test:a687871d298df96f6913bbd32fb45b378d3c3af63e0dda5c3cbb199a904f6961`

Tags:
- `repository-tooling`

Contract:
- 自动推送只有在节流 ref 指向合法整型时间戳 blob 时才能判断窗口；状态无效时 helper 必须以失败状态退出且不得推送。

Proves:
- 将节流 ref 指向非时间戳 blob 后，helper 返回非零并报告时间戳错误，隔离 bare remote 的 main 保持不变。
