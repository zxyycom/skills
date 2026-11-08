### Case DECISION-EVOLVE-DISCARD-RECORDED-FLAG-001: 确认后删除已记录目标

Tests:
- `test:9109869a5094b2240c8b089cf150f7b372f9c15cbc75693355d687bba15b3242`
- `test:ffc5a670666b8e5ab8c7d5bb9daace6bde475cba68489791b6ec277bfec0b2c8`

Tags:
- `decision-records`

Contract:
- 删除已记录目标必须明确确认；无其他关系时，可与空关系后继建立同次提交。

Proves:
- Git 基线未确认时预检要求 delete-recorded；独立 Git fixture 显式确认后同次删除正式来源与索引项、建立 active 空关系后继。此节点不验证 CLI 参数 renderer。
