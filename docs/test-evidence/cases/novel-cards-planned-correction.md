### Case NOVEL-CARDS-PLANNED-CORRECTION-029: 修订计划不替代事实

Tests:
- `test:c35446bbc09ec558bbe89ed9e0e97cfaae6d8acfa85ca6bd3b61b905069f5a90`

Tags:
- `novel-cards`

Contract:
- expected作者修订可以保存计划，但supersedes仅在occurred确认后生效，预期不能替同ID已发生变迁。

Proves:
- 保存预期纠正仍查询到旧故事边且excluded为空；同ID预期替代拒绝；确认修订v2后才排除旧边并保留预期v1快照。
