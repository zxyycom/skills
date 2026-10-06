### Case NOVEL-CARDS-AUTHOR-REVISION-022: 作者修订与真实阶段

Tests:
- `test:e1b1815e6f428da3079e2b7e21ac9c1593fe600d0cb9b7a06d1132c2d1482248`

Tags:
- `novel-cards`

Contract:
- 作者revision不能伪装为经历；显式supersedes否定整条旧演进关系，同ID变迁修订旧版不再生效但可回溯。

Proves:
- 作者修订同时归档两个对象的中间状态并排除误写演进；改写原演进为v2后当前查询只采新端点，原记录v1完整保留。
