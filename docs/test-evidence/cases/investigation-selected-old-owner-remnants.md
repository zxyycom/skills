### Case INVESTIGATION-SELECTED-OLD-OWNER-REMNANTS-001: 删除不可留下已知旧owner路径

Tests:
- `test:1ebaff9644f828b66f2a3fe6fdda21aa5eb7ccbee7e74e57c71cf760be3ff936`

Tags:
- `investigation-report`

Contract:
- 被删或换ID的旧owner是已知受影响位置，任何残留均阻断局部index更新，不代删资源。

Proves:
- 旧owner为普通文件、空树、大小写变体或symlink时，即使没有报告资源引用也拒绝删除索引条目。
- 失败保持index字节与实际owner成员，不自动治理资源。
