### Case TEST-EVIDENCE-CORE-SHOW-001: Show 检测 Case 源替换且搜索读取权威正文

Tests:
- `test:6151b76a7790c1e47b252dc936b689ea49509f039035b18ca071d549474aab90`

Tags:
- `test-evidence`

Contract:
- show 必须核对索引身份与当前 Case 原文，全文 search 必须读取权威 Case 正文。

Proves:
- 正文未漂移时搜索匹配；Case 字节变化后 show 阻断而不返回替换后的混合结果。
