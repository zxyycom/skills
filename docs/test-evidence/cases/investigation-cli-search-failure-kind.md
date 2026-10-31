### Case INVESTIGATION-CLI-SEARCH-FAILURE-001: 搜索参数与来源失败保留不同退出状态

Tests:
- `test:6aee7e946ce969beed861b251d0f3eeebc440dd1350a7a97369c60d3ee13d8b0`

Tags:
- `investigation-report`

Contract:
- search 参数错误退出 2，来源或运行失败退出 1；失败诊断在 stderr，成功结果在 stdout。

Proves:
- 非法 match、in、limit 与时间边界退出 2、stdout 为空且零集合写入。
- 合法 metadata 搜索返回 0 并显示发布快照；当前正文非法导致 content 搜索退出 1、stdout 为空。
