### Case DECISION-STAGE-DOMAIN-INDEX-STATE-001: 领域暂存保留调用方索引并校验所选旧身份

Tests:
- `test:2bebe4b041eaae3a3f10f3b2ee22917e6595955f1bd7e012d03aa780ece454ea`
- `test:61fa52f513c76f104c6281dd301da0dfdfdc8b78b06e04b73c1421b15aeb3ad4`

Tags:
- `decision-records`

Contract:
- domain scope 按可信 H/W/P 定位所选来源，验证已定位旧正文身份，并保留调用方拥有的 pending 索引。

Proves:
- pending 索引为坏 JSON 或其 blob 缺失时，domain 更新所选正文并保留索引字节或 OID；无关 pending 正文不变。
- H/P/W 三处路径不同且 P 旧正文身份错误时拒绝且 pending 不变；更正后清除 P 旧路径、暂存当前来源，同时保持 P 索引、工作区索引及无关 pending。
