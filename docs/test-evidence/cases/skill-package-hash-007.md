### Case SKILL-PACKAGE-HASH-007: 版本门禁保留已捕获的 pending 快照

Tests:
- `test:fffd574a9937dc01ec5227f64eae50589ec4d1f27f48771307f287e276c31bac`

Tags:
- `repository-tooling`

Contract:
- Skill 版本门禁必须把已捕获的 pending 快照与一次解析出的不可变基线 revision 比较，后续 index 变化不能改写本次判断输入。

Proves:
- 捕获 alpha 未升版的内容变化后重置 index，基线比较仍识别 alpha 的 v3 基线并报告必须提升版本。
