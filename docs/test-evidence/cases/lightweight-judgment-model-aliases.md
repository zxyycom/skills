### Case LIGHTWEIGHT-JUDGMENT-CLI-014: 官方模型标识原样传递

Tests:
- `test:276efd9c1f44bc165df22baa46f7fdcc2336f9ab3c5dd6b6d4563d90ce02f4e5`

Tags:
- `lightweight-judgment`

Contract:
- 配置、请求与 CLI 接受官方 bare JEV、作者前缀与 namespaced alias，并保留原标识不改变路由。

Proves:
- 四种官方标识各通过配置、请求与 CLI 三个来源原样送达 mock 接收端，非 JEV 标识在发送前拒绝。
