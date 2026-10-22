### Case DECISION-STAGE-SCOPE-DOMAIN-DELETION-001: stage --scope domain writes a deletion for a baseline-only ID without touching the pending index

Tests:
- `test:dca3fbd723a76c5f76404de687ea00ed30673148c224a57535df8b257684c1ee`
- `test:e93a001bdc6122e6909c687e476c4d6e423991b8b0af29ac991e4dfe59857594`
- `test:f55a11548dce7c1d02b56114f5abf8ff162f524938ba6a323b622ea4452fa042`

Tags:
- `decision-records`

Contract:
- 基线-only ID 在 domain scope 写入正式 Markdown 删除，pending 索引不受影响。

Proves:
- 真实 all stage 删除所选 old 的 pending 正文和投影，保留 retained，并排除未选 replacement。
- 真实 all scope 的组合入口承接所选删除的 Git 运输；另一个真实 CLI index→domain 入口证明 domain 步骤保留先前 pending 索引字节。
