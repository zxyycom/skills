### Case DECISION-RENAME-CHANGED-BATCH-001: 大量真实更名写集与保护采用同一批量验收

Tests:
- `test:ed4cb00ba42cbaab48c92305db1fa84eb04b859c5b4f725a596661f82a365d0c`

Tags:
- `decision-records`
- `record-operations`

Contract:
- 共同阶段的批量验收调度不依赖来源是否列在 writes 或 guards；DR 大量真实 changed 来源同样进入批量路径，实际更名保持正式源移动、候选引用和索引职责。

Proves:
- 一个 archived 正式源和达到既有 worker 阈值的候选修订入边经真实严格准备生成全部 changed 提案；共同 verifyPlan 与 verifyWritten 各自交接超过阈值的完整队列，全部候选引用新 ID，旧源退出。fixture 直接建立新字节后，通过独立安全同步读取取得 actual written facts，并核对新 bytes、mode 及当前文件 dev/ino，不从 plan.next 构造身份。
- 此入口验证真实领域计划到共同两阶段的接线与实际文件验收，不证明 1000 次完整 journal 提交/恢复或延迟；真实提交/恢复由相邻小集成承接。节点等待界限不是性能预算。
