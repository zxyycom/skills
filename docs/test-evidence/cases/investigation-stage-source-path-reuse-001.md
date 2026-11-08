### Case INVESTIGATION-STAGE-SOURCE-PATH-REUSE-001: 身份更正共用文件位置时保留所选新报告

Tests:
- `test:af7b7418426110fcb814dc47f8d41a77b6410d29ea7afa86f56994e97362bfac`

Tags:
- `investigation-report`

Contract:
- domain 同选新旧 ID 且共用路径时，工作区新 ID 当前路径不得被旧 ID 删除。

Proves:
- 真实 Git 中 zulu 旧身份和 alpha 新身份共用 common.md；pending 为修改且内容为新身份，pending 索引与未选 pending 保持。
