### Case INDEX-RUNTIME-SYNC-MODE-001: 无副作用地拒绝非法同步模式

Tests:
- `test:a1394e5ec13558b44c9c9f45435cff5e291a1e0d6ac3aca8247988d28495374c`

Tags:
- `index-runtime`

Contract:
- 同步入口只能接受受支持模式，非法模式不得创建索引。

Proves:
- 非法模式返回 `mode-invalid` 且目标文件保持不存在。
