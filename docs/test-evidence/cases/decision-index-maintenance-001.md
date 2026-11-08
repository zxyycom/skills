### Case DECISION-INDEX-MAINTENANCE-001: 索引规范重建与严格投影校验

Tests:
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`
- `test:dd8167ee60e946904db658bf49899dae20f47daa6ae28a5676281d84a7688e27`

Tags:
- `decision-records`

Contract:
- 全量 sync 从合法来源恢复索引；严格 check 不接受旧 definition 或失同步来源。

Proves:
- DR 全量操作可恢复坏或缺失索引；真实 CLI check 对 definition 10 和当前正文漂移报错。
