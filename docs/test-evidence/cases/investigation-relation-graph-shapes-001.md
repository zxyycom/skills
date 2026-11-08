### Case INVESTIGATION-RELATION-GRAPH-SHAPES-001: 调查普通关系与环校验

Tests:
- `test:4e572abfeea52b35c3c4bffc062551f60a2a20ffd64dd908e460bd7d795d107a`

Tags:
- `investigation-report`

Contract:
- 合法普通前序关系可构成调查关系图；形成环的关系不能接纳。

Proves:
- 两个调查状态间的复查关系通过且保留一条出边；加入反向关系后图校验失败。
