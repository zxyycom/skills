### Case DECISION-RENAME-TRUE-NOOP-001: 候选同身份同路径改名不规范化正文

Tests:
- `test:c0d66e3c64a0eb6bf37d71303c915b5c335591cf4847d9f8c364564e1583a001`

Tags:
- `decision-records`

Contract:
- 同身份同路径的候选 rename 不应规范化未完成正文。

Proves:
- 未完成正文的候选同名 rename 返回未变化、未提交，原字节保持。
