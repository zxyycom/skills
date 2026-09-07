### Case SKILL-PACKAGE-HASH-003: 要求变化 skill 独立提升版本

Tests:
- `test:105bdfc46b122de21184590bb88fe0670e9c85b2b26431ef4b4351740e43cc73`

Tags:
- `repository-tooling`

Contract:
- 包内容相对基线变化时，只要求对应 skill 的版本高于自身基线。

Proves:
- 当前内存 snapshot 中 alpha 内容变化且仍为 v3 时产生问题；与注入基线比较后提升到 v4，问题消失。
