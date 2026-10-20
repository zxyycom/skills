### Case INVESTIGATION-STAGE-METADATA-PROJECTION-001: 索引暂存严格核对关系和最终投影

Tests:
- `test:1043afb4daa774cf07917305b9fb7824e0f1b8651f9d001c301e934d46328763`

Tags:
- `investigation-report`

Contract:
- index stage 不读正文但必须验证完整 metadata 图和最终选择性投影。

Proves:
- 纯索引构造中，未选新增目标使最终选择性投影关系不闭合时返回 error；完整 metadata 图含不存在 ID 时抛出相应领域诊断。
