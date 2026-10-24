### Case DECISION-NATIVE-BUILD-VALIDATION-001: 原生构建失败保持严格验收与诊断优先序

Tests:
- `test:73e8a59b0be63cfb10de30a52e7d0eb0bdaa1b4593fc87f93a336c6aca056ac6`

Tags:
- `decision-records`

Contract:
- Decision 索引构建须先完成来源 revision 成员、metadata、state 与 definition 集合验收，再验证完整领域关系图；已取消的构建不得成功。

Proves:
- 同时存在自环关系错误时，revision 成员缺失、非法 metadata、过短标题、非法来源指纹和重复 sourcePath 分别返回对应 native 诊断，metadata 错误优先于同时存在的 state 错误。
- 已取消 signal 返回 state-index.operation-aborted。
