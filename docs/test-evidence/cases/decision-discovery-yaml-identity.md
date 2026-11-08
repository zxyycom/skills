### Case DECISION-DISCOVERY-YAML-IDENTITY-001: 身份发现与正文完整性验收分离

Tests:
- `test:1f02661cd0f74ad261f3532a9a60d4fa418264565d380d22d01a0360c36c1415`

Tags:
- `decision-records`

Contract:
- 身份发现与完整正文验收分离。

Proves:
- 仅含合法 ID 但正文无效的来源仍可取得声明 ID；完整 candidate 解析失败。
