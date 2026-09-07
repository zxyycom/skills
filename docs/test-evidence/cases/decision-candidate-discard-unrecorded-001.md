### Case DECISION-CANDIDATE-DISCARD-UNRECORDED-001: Discard 删除未进入 Git HEAD 的候选

Tests:
- `test:b932b7fea6ac85ad54bb62fa2fdcf25c9fe6d7d9c1e7640bc141e9ddc3a01348`

Tags:
- `decision-records`

Contract:
- Git 工作树已有已提交基线时，未进入 Git `HEAD` 的完整且未被引用 candidate 可由普通 `discard` 删除，不需要已记录候选删除参数。

Proves:
- 提交既有决策集合后新建 candidate，普通 discard 成功删除该文件。
- 已建立成员的正式索引逐字节不变。
