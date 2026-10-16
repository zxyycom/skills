### Case INVESTIGATION-CLI-SINGLE-OPTIONS-001: 单值选项重复在 CLI 边界拒绝

Tests:
- `test:30bf95bb8658c9f1dcc12c87d71fd70128e8ac1efe63e229b9c3ec39d45077bf`

Tags:
- `investigation-report`

Contract:
- 重复单值参数是参数错误，不能退回默认值、消除过滤或改变候选 ID；合法可重复参数保持集合语义。

Proves:
- new formed-at/title/question、search 范围/匹配/时间/数量/关系过滤及相邻全局、stage、trace、sync 选项重复均退出 2、stdout 为空且不创建集合。
- 单个历史 formed-at 与重复不同 tag 合法，创建完整历史日期 ID 并回显标题。
