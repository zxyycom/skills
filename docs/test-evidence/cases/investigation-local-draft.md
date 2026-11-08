### Case INVESTIGATION-LOCAL-DRAFT-001: 缺索引的已有正式集合必须显式恢复

Tests:
- `test:cdbbe1727809431145c0d2a70dfb54b66bd95d0c6b8d5ce190d9dcc4cbae5b5f`

Tags:
- `investigation-report`

Contract:
- 已有正式成员但发布索引缺失时，候选资源查询不能隐式建立空基线。

Proves:
- 正式正文移位而资源仍在时，删除发布索引后候选查询返回错误。
