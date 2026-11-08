### Case DECISION-RELATION-SUMMARY-001: Relation summary normalization preserves the Unicode boundary

Tests:
- `test:41aa45138aa39be3212f03df6301535766ab5eae796833cbcbbfa9a93c9251d9`

Tags:
- `decision-records`

Contract:
- Relation summary 输入先 trim，空值省略；非空值须为单行且至多 40 个 Unicode 码点，超限不截断。

Proves:
- 真实 Decision CLI `new` 将仅含换行/空白的摘要省略；边缘换行和空白被 trim 后，40 个 emoji 保留在创建的正文中。
- trim 后仍有内部换行、或 41 个 emoji 的摘要被拒绝；此节点不覆盖关系修改命令。
