### Case INVESTIGATION-RELATION-TRANSACTION-REVIEW-001: 共同关系计划区分替换、保留和清空

Tests:
- `test:1aea3633b419ada40c82157c5b1d44c848a2f71d8f28f23850b4a273502ea581`
- `test:bbbef6bec221c129065217e6601a26d96036fadc60e22c685e8ae6c4796d4e9f`

Tags:
- `investigation-report`

Contract:
- 共同关系计划区分显式替换、清空与无变化，未列明来源沿用原关系。

Proves:
- 纯计划中指定来源完整替换并省略摘要，未列明来源的 before 与 after 相同；显式清空已有关系为 replace，已为空者为 unchanged。
