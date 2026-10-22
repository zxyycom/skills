### Case DECISION-TRACE-RENDER-BASELINE-001: 渲染保留无层级节点与历史事件归属

Tests:
- `test:b531a63a9b25deb098d500f4802666f7f611b3327caef2bbb27460b6bc553fe9`

Tags:
- `decision-records`

Contract:
- renderer 只解释既有切片，保留节点层级、事件归属、边与成员事实，不重复渲染主体。

Proves:
- 四种独有切片场景中，无层级节点、历史范围外 owner、历史 owner 已在切片内及重叠事件的节点层级、边、owner 与成员按独立语义期望渲染，主体不重复。
