### Case INVESTIGATION-RELATION-GIT-HEAD-002: 损坏历史索引报告不可用

Tests:
- `test:37d9787b9574a618d832c32f5b08aefec7839a092a6f760a0323de047671d989`

Tags:
- `investigation-report`

Contract:
- 历史索引不可用时检查不得伪造未记录前序的结论。

Proves:
- 真实 Git 后续提交损坏历史索引后，检查历史函数只给 history unavailable warning，不含未记录前序提示。
