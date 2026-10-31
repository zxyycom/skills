### Case INDEX-RUNTIME-SYNC-MODE-001: 无副作用地拒绝非法同步模式

Tests:
- `test:1afabcb4f32193a71b024a818a8af09e8dd12982211a0238a5f12a1cf897eba7`

Tags:
- `index-runtime`

Contract:
- 同步入口只能接受受支持模式，非法模式不得创建索引。

Proves:
- 非法模式返回 `mode-invalid` 且目标文件保持不存在。
