### Case DECISION-DISCOVERY-CANDIDATE-MEMBERSHIP-001: 排除候选前检查完整来源身份

Tests:
- `test:5011b6c33eb5c22df6a2db281df24edc6ac6b0e791df8765334c6a1c7d2a8a29`

Tags:
- `decision-records`

Contract:
- 全量发布快照与 revision 排除候选，显式 ID 读取可以选择候选；重复身份和非法身份必须在排除候选前失败。

Proves:
- 合法全量读取只含正式 ID，显式读取包含所选候选；候选与正式来源重复 ID 或候选 YAML 破损时，返回原有重复身份或非法 frontmatter 身份错误。
