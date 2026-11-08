### Case DECISION-UNRECORDED-EVOLUTION-001: 尚未进入 Git HEAD 的决策演进等待显式确认

Tests:
- `test:a86f87a0736f0fda446d75ccdbf73fe6f9529a1256f9de2be45ffe7f2aad2764`

Tags:
- `decision-records`

Contract:
- 建立路径以关系连接候选与尚未进入 Git HEAD 的已建立直接前序时，首次调用必须暂停且不写入；提示标明前序和关系类型，显式确认保留独立决策演进后才能继续。

Proves:
- 真实 Git 基线的原生预检返回包含前序、`修订` 类型和 `--keep-unrecorded-history` 的诊断，并逐字节保留候选、前序和索引。
- 同一 fixture 显式确认后提交成功，归档前序并在索引保存后继到该前序的关系；本节点不声称 CLI 呈现。
