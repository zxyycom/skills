### Case LIGHTWEIGHT-JUDGMENT-CLI-014: 官方模型标识原样传递

Tests:
- `test:63d63d4fbb241f66f549af1260b44ed0ee8cfd87eff9d44657f70852dd1e2b2e`

Tags:
- `lightweight-judgment`

Contract:
- 配置、请求与 CLI 接受官方 bare JEV、作者前缀与 namespaced alias，并保留原标识不改变路由。

Proves:
- 四种官方标识各通过配置、请求与 CLI 三个来源原样送达 mock 接收端，非 JEV 标识在发送前拒绝。
