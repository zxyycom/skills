### Case RECORD-CANDIDATE-BOUNDARIES-001: 两域候选按所选范围起草与恢复

Tests:
- `test:cede43da0cc7fbe10afeb73ff44dcd8869a6b70c41d7c6f9df2e73bfae738d03`
- `test:ee7ef8b6f2f86e78e4272fc2724c0a875eb7a84dd8d52424e47d2cd54668696e`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 候选起草只保证自身结构、安全路径与不覆盖；候选读取准备所选对象及必要依赖，坏发布索引须显式恢复。

Proves:
- 两域 API 与源 CLI 允许未来完整关系 ID，新建后 candidates 与 show-candidate 连贯保留同一 ID、scaffoldValid=true/bodyReady=false，不把缺失未来目标当作坏结构；创建事实不被 readiness 未就绪抹去；show-candidate 不接受正式记录，未选坏内容不阻断选中读取。
- 列表 warning/skip 坏内容而显式目标失败；可见重复身份、安全失败及坏索引阻断；存在正式来源时缺索引使列表、创建及精确 ID 候选读取明确失败，合法发布基线下未选正式正文损坏不阻断候选读取。
