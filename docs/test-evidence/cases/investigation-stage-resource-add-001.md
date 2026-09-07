### Case INVESTIGATION-STAGE-RESOURCE-ADD-001: stage-index treats unrelated report resources as outside selected report entries

Tests:
- `test:5263f289ea121f94c62969ffea8db5214c1c9686b36ec2c54209b49db095764a`

Tags:
- `investigation-report`

Contract:
- 未选报告的资源变化不自动进入已选报告 index entry。

Proves:
- 真实 Git fixture 只选择 first report 时，second 的资源改动不进入 pending index，也不扩大 selected IDs。
