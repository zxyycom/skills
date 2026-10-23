### Case INVESTIGATION-CANDIDATE-PARTIAL-DISCOVERY-001: 局部候选读取拒绝未恢复的必需正式 owner

Tests:
- `test:36cb633c6dc02ddc1e718ed4b3af2ab138af8f6f93b8ad429c84dfffb500da0b`

Tags:
- `investigation-report`

Contract:
- 候选共享资源的必需正式 owner 必须能由有效发布基线可靠解析；位置未同步或索引不可用时须显式恢复，不以来源 fallback 或无索引 header 身份代替正式依赖证明。

Proves:
- 在同一共享资源 fixture 中，正式 owner 从索引记录的位置移到新路径后，show-candidate 返回 error；保持该移动并依次损坏、删除索引时同样返回 error，没有返回成功候选。
