### Case INVESTIGATION-PUBLISH-BASELINE-RECOVERY-001: 发布基线异常需显式恢复

Tests:
- `test:9b9fcf3acf5252abe4afc91c18f75c8722b27acf00ef86a4aeaa9e7ff7a239f4`

Tags:
- `investigation-report`

Contract:
- 已有正式来源缺索引、坏索引或不兼容版本阻断普通发布并指向全量 sync-index；合法空发布索引可正常建立候选。

Proves:
- 三类异常均保留候选字节且不建立正式来源；显式同步得到合法空索引后，同一候选可成功发布。
