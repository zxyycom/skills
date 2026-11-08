### Case INVESTIGATION-RELATION-GIT-HEAD-001: 检查只提示未记录的直接前序

Tests:
- `test:37d9787b9574a618d832c32f5b08aefec7839a092a6f760a0323de047671d989`

Tags:
- `investigation-report`

Contract:
- 检查历史 warning 只针对尚未进入固定 Git HEAD 的直接前序。

Proves:
- 真实 Git 中 A 已记录、B→A、C→未记录 B；检查历史函数仅给 C→B 一条 warning，不生成间接关系提示。
