### Case DECISION-STRICT-PREPARATION-SOURCE-PROOF-001: 严格准备交接根绑定来源证明并保留最终全集验收

Tests:
- `test:0d9ea656bceff2309b62ee742ece0bf10bae1ad9031cd01fe15df753e9b0b79e`
- `test:52097c6cdef526521c99338972f75a8fabeff11d4238069670519ff3c0492180`
- `test:6f8defcb471c7df48df73372b8032e00430c1ac88575426f897e4ba7b3d4e8bf`

Tags:
- `decision-records`
- `record-operations`

Contract:
- 严格事务仅在同次 prepare 内交接真实事务根绑定的安全 bytes、严格 UTF-8 正文、文件身份、mode 与完整父链证明，并核对预期路径与正文；未变文档可复用，改变正文重新解析，最终完整关系图与预期索引仍验收。原生索引校验、事务 fresh 与写后保护保持各自义务。

Proves:
- 初始严格采集每个来源打开一次，既有独立索引校验仍产生两次索引打开；随后同 prepare 的计划构造额外打开来源/索引均为零，并消费已验证的未变文档。完整投影与原全量解析一致；没有私有采集证明的 caller-held scan 仍独立捕获来源。
- 不同事务根、不同预期正文与缺少来源证明均拒绝交接；坏 UTF-8 与来源缺失保持读取失败，不回退为空或以第二次读取掩盖。
- 改变正文重新投影与完整解析结果一致，删除仍被引用的正式来源被最终全集关系验收拒绝。采集后 mode 漂移由写前真实保护读取拒绝，正文和后来 mode 均保持不变；该注入单独证明写前保护，不代表领域 fresh 回调或 postverify 全流程已被本 Case 覆盖。
