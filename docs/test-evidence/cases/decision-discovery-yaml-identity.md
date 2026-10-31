### Case DECISION-DISCOVERY-YAML-IDENTITY-001: 来源发现从同份 YAML 取得身份与候选状态

Tests:
- `test:e2923b535cc1117a14895d843e0c016fcda22ed7c982ce095e858b705f0e8783`

Tags:
- `decision-records`

Contract:
- 来源发现按 YAML 语义读取 ID 和候选状态，支持 BOM 与 CRLF；完整正文验证仍由后续阶段负责，非法身份不成为合法来源。

Proves:
- 普通、带 BOM/CRLF 和引号 ID 的 YAML 返回同一身份及候选状态；正文未完成不改变发现结果，已建立状态与非法 YAML、非法 ID 保持各自结果。
