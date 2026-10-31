### Case DECISION-CANDIDATE-PUBLISHED-IDENTITIES-001: 候选准备复用正式发布身份而不重读正文

Tests:
- `test:0f162583b051e7265ff3c49b9629715be41975ec87bd00a36e0b95503fd01c93`
- `test:9413f4dbee0a75493ce665ada6c34f5b3f3abc33877b7a88a96913001ef19ad4`
- `test:b451e902ff7ca87920966efd66545098e538905d8597c0bd2487c37b57ad2ddf`

Tags:
- `decision-records`

Contract:
- 合法发布索引提供正式 ID/sourcePath；候选准备不读取已知正式正文，纯索引关系依赖不另读。索引外候选按必要身份发现；已存在正式来源却无索引时明确恢复。

Proves:
- 20 条正式来源（root/archive 各 10，locator 与 ID 不同）及 2 候选下，readiness/list/show 各只安全读取 2 个候选，正式 open/handle.readFile/readFile 均零；new 只读必要候选和自身验收。
- 未知路径必须安全分类；未知正式 header 不冒充已发布身份；候选与发布 ID 重复、已知位置目录或 symlink 均失败。所选候选引用正文已损坏的正式目标时仍仅使用索引，目标正文零读取。
- 坏 JSON/definition 不降级；缺索引且 header 证明有正式来源时明确恢复，无法分类 header 同样失败，不生成索引。root/archive 目录替换被独立目录身份保护拒绝。
