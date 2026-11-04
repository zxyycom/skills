### Case RECORD-DIAGNOSTIC-SYSTEM-RENDERING-001: 两域系统证据安全渲染

Tests:
- `test:4587cb0a7749c5a3e17dc9b6d5b103db7c075d6e0738a121907c706f7913bfdf`
- `test:9e5af32740f990629bfbc55478971aae64c3511967041b5857eac62f947ae5e0`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 两域诊断输出保留系统证据的定位和独立字段，同时净化自由文本中的敏感内容和控制字符。

Proves:
- DR 输出与 IR 历史诊断 renderer 分别保留长路径、系统分类、操作和 detail；控制字符不能注入输出，provider token 被净化。
