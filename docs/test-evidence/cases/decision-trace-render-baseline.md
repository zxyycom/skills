### Case DECISION-TRACE-RENDER-BASELINE-001: 渲染保留无层级节点与历史事件归属

Tests:
- `test:597da9675c53fac06bd1982e6a195587ffc75b6c2ccbeb5203fd5032fe2d56b6`

Tags:
- `decision-records`

Contract:
- renderer 只解释既有切片，保留节点层级、事件归属、边与成员事实，不重复渲染主体。

Proves:
- 四种独有切片场景中，无层级节点、历史范围外 owner、历史 owner 已在切片内及重叠事件的节点层级、边、owner 与成员按独立语义期望渲染，主体不重复。
