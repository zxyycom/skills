### Case DECISION-LAZY-GRAPH-CONTENT-001: 正文搜索按已发布关系筛选当前正文

Tests:
- `test:a6ec0ac0ecdb0af6634d313b48ecf2c78c2a018ea021740bf03315550052ecdd`

Tags:
- `decision-records`

Contract:
- 正文搜索使用发布投影的关系与当前文本；当前未同步关系不改变发布范围，缺索引明确失败。

Proves:
- 普通/关系搜索成员数正确且无 fallback；当前关系从修订改成替代后，替代筛选零命中，发布修订筛选仍返回准确成员与修订证据。
- 搜索来源为 published-index+current-text；删除索引后失败且不返回 searchInfo。
