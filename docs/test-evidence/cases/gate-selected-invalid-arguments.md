### Case GATE-SELECTED-INVALID-ARGUMENTS-001: 非法选组在 Gate 副作用之前拒绝

Tests:
- `test:639349ca4bf87aa7fccea522b42a7f3bf60bc3cccbcf4b4214476eea00c3f22a`

Tags:
- `repository-tooling`

Contract:
- 未知、缺失、内部 selected 名称、legacy scope 与能力组混用、release 与能力组混用均不是合法调用。

Proves:
- 逐项覆盖缺值、未知组、重复分隔符、legacy/release/cold/baseline 冲突及未知选项，解析返回 null，CLI 退出 1 并仅输出一条 usage 诊断。
- 拒绝路径不创建 Definition 或调用目录，不准备输入、不运行 Check、不发布 receipt，也不报告成功信息。
