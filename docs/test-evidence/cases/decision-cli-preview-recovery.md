### Case DECISION-CLI-PREVIEW-RECOVERY-001: 决策全量同步预检与恢复写入分离

Tests:
- `test:dd8167ee60e946904db658bf49899dae20f47daa6ae28a5676281d84a7688e27`

Tags:
- `decision-records`

Contract:
- 全量 sync 预检不写入，可从合法来源恢复损坏或缺失索引。

Proves:
- Decision 全量操作对坏索引预检不改字节，正式同步写入；再预检显示 unchanged，删除索引后正式同步重新建立。
