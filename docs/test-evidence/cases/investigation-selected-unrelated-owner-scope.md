### Case INVESTIGATION-SELECTED-UNRELATED-OWNER-SCOPE-001: 旧owner核对不扩大为全库资源审计

Tests:
- `test:b57fb8c86345ac03e9f0f5bd132527c69b17a5974afa552b5ed24e5d8866437f`

Tags:
- `investigation-report`

Contract:
- selected 删除不把无关 owner 符号链接作为门禁或删除范围。

Proves:
- Unix 下无关 owner 为指向外部目录的 symlink，已知旧 owner 移除后 selected 删除提交成功；无关链接及外部 sentinel 保持。节点未测读取次数。
