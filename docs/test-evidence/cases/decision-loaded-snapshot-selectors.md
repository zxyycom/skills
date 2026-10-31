### Case DECISION-LOADED-SNAPSHOT-SELECTORS-001: 发布快照选择器保留完整身份与名称歧义

Tests:
- `test:556b2a01e779da8681c4f5d40da3012edd1d5d10e6a47b7a1b7f4bcd3cf8aed1`

Tags:
- `decision-records`

Contract:
- 日期 ID 只精确匹配完整 ID，其余 selector 按 name 查找；忽略一次末尾大小写不敏感的 .md，零项失败，多项以 code-unit 词法序报告歧义。

Proves:
- 不依赖原始索引插入顺序，show 与 trace 对 legacy 和日期 ID 的同名记录返回相同有序歧义；缺失名称与完整 ID 均保持错误及退出码，完整日期 ID 可精确 trace。
