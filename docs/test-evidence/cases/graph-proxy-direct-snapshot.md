### Case GRAPH-PROXY-DIRECT-001: Proxy direct iterator 变化重新快照并晋升

Tests:
- `test:5fb9bb7ee3beaddec94c211ba28df98f5d5caa46399965de1435777752f00224`

Tags:
- `relation-graph`

Contract:
- 冻结 Proxy 数组不足以证明继承 iterator 稳定；合法动态输入继续重新快照。

Proves:
- 同一或不同冻结单位共享 Proxy direct 数组由 a 改为 b 后，b 从 context 晋升 trace，完整输出无 context。
