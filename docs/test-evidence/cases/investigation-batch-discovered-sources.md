### Case INVESTIGATION-BATCH-DISCOVERED-SOURCES-001: 选中发现移动来源与重复身份

Tests:
- `test:64a7128e1db0ce1e1ea3ff99392c661d1b996b1530553e65c52b150971f4d658`
- `test:ae42ded23d29f2af769d620f3edcda11d54a8d40e8f3ab7902350380ed51de59`

Tags:
- `investigation-report`

Contract:
- 选中检查发现移动的身份时，不把无关正文损坏当作所选正文错误；所选身份不唯一必须失败。

Proves:
- 索引旧位置已被其他身份占据且其正文有非法字节时，所选 ID 从新位置发现并通过选中检查，indexChecked 为 false。
- 非法无关正文位于有效身份头之后时不阻断选中检查；重复所选 ID 返回 duplicate-id，所选正文非法编码返回 source-encoding。
