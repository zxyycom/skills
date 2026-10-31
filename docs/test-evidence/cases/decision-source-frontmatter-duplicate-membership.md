### Case DECISION-SOURCE-DUPLICATE-MEMBERSHIP-001: 无效记录仍参与声明身份重复检测

Tests:
- `test:4751e987bce126afe88813abb0fcafaef36efe57bac9dab5270bb73944d05c13`

Tags:
- `decision-records`

Contract:
- 字段验证失败不能抹去可合法提取的声明身份；重复 ID 不能成为关系目标，集合错误优先于各记录正文验证错误。

Proves:
- 一份 tags 为空的记录与另一份合法候选声明同一 ID 时仍报告重复路径；该 ID 被排除出可用集合，引用它的第三份记录报告目标不存在。
