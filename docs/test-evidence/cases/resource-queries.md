### Case RESOURCE-QUERIES-CASE-001: 查询与索引新鲜度

Tests:
- `test:6bb0a6395b69af96bab825dd164136812417203bab28f70d7eae00fc8d909667`
- `test:8d41794aca24275e115f86cefac5518692fa5331ed79cc6df7e6e0fccb956b65`
- `test:edfdee55a3aaa6a5d098d8a3427069b447cf30c4682d8d3d975265d427ed641a`

Tags:
- `resource-records`

Contract:
- 索引查询标记未核验，show 比较当前来源，正文搜索读取当前文本；指纹规范化换行。

Proves:
- 真实 CLI 检查同步幂等、查询结果、正文变更后 stale 与 unchecked 分离、CRLF 等价及参数和越界拒绝。
