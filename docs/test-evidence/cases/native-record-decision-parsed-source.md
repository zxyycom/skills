### Case NATIVE-RECORD-DECISION-PARSED-SOURCE-001: 决策来源复用的分类与解析

Tests:
- `test:e8452d9d522b22b51829e854526cfb736eda306f297ce877fe1e9ede5bc26179`

Tags:
- `record-rust`

Contract:
- 同一来源的复用解析不得改变分类、元数据及正文有效性判定。

Proves:
- 固定候选、BOM/CRLF 和正式决策输入独立核对身份、分类、元数据及正文；验证元数据有效但正式正文无效、字段无效和缺失身份的边界。
