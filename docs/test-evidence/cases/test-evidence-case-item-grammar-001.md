### Case TEST-EVIDENCE-CASE-ITEM-GRAMMAR-001: Case 列表项按文本与 token 契约验证

Tests:
- `test:2e104228b8e1825cade3c23dc0ddc77bd3233ffda4fc9d1b0f7c2c27d4a0c7bc`
- `test:b800b4dc3c40a3fd89badaeb0b2b11221869a5c18041082d53917ce1edbf884e`
- `test:fa2b119afef53bfa31d6a3ea198501e94c3c14abb44b15467cda65b08d43fb65`
- `test:fd3cf41c6619c20f1df91e9a6ad687bc1cc695db9f470c6314d755801f824345`

Tags:
- `test-evidence`

Contract:
- Tests 与 Tags 使用各自 token 语法、唯一且词法排序，Contract 与 Proves 使用非空且无首尾空白的文本项；诊断须能区分关系重复与集合重复。

Proves:
- 合法文本、Test token 和 tag 可解析；含空白 Test、非法 tag、未 trim 或空文本项产生对应语法诊断。
- 同一 Test 连续出现三次时每个重复关系各有包含 Case ID 和 testId 的诊断；重复 Tags 集合只产生一次诊断。
- Tests 和 Tags 倒序分别产生 tests-unsorted 与 tags-unsorted 诊断。
