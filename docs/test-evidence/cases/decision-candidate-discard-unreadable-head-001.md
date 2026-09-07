### Case DECISION-CANDIDATE-DISCARD-UNREADABLE-HEAD-001: Discard 在 Git HEAD 不可读取时零写入失败

Tests:
- `test:72413e552692af0810a7b435a2ec720609c9c504e614691a7f4b60cb14023ee7`

Tags:
- `decision-records`

Contract:
- 完整 candidate 的 discard 需要判定其是否已进入 Git `HEAD`；Git `HEAD` 不能读取时，CLI 必须在删除前失败，不能将该异常当作未记录 candidate。

Proves:
- 已提交 candidate 的引用被破坏后，discard 返回 Git HEAD 检查错误。
- candidate 原文和正式索引逐字节不变。
