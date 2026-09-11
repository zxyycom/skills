### Case INDEX-RUNTIME-SYNC-MODE-001: 无副作用地拒绝非法同步模式

Tests:
- `test:7cf489ab0d5e8f6b0ce277d6ce71a1bf524bf4fc384cde7a393ad7ece56b3539`

Tags:
- `index-runtime`

Contract:
- 同步入口只能接受受支持模式，非法模式不得创建索引。

Proves:
- 非法模式返回 `mode-invalid` 且目标文件保持不存在。
