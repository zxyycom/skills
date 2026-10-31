### Case DECISION-CANDIDATE-DISCARD-INVALID-001: Discard 拒绝生命周期或正文无效的候选

Tests:
- `test:4311a94697d265533268429a3adaf4942eb8ba2271c9588ba9a154ec2736c873`

Tags:
- `decision-records`

Contract:
- Discard 只接受生命周期字段与必需正文均完整合法的可审核候选。

Proves:
- 带非空 alignment、非空 createdAt 或缺少必需正文的 candidate 均返回不可审核诊断。
- 每次拒绝都保留目标 Markdown 与正式索引的原始内容。
