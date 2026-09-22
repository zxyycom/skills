### Case INVESTIGATION-STAGE-RESOURCE-ADD-001: stage --scope index treats unrelated report resources as outside selected report entries

Tests:
- `test:ec4a918d59b60af7cb3faaa9e42c1b83cf292a849f7d0fb435d81992a6c9d295`

Tags:
- `investigation-report`

Contract:
- 未选报告的资源变化不自动进入已选报告 index entry。

Proves:
- 真实 Git fixture 只选择 first report 时，second 的资源改动不进入 pending index，也不扩大 selected IDs。
