### Case DECISION-STAGE-LINEAR-DISCOVERY-001: 每个 stage 写前阶段只发现一次集合

Tests:
- `test:6a24f4973ca685339efb902ea61d7740b67dd11eb391f17fba3e33d0ad03f28d`

Tags:
- `decision-records`

Contract:
- stage 的单个 fresh 验证阶段应按集合读取一次来源，再逐选择核对身份、位置与原始字节；准备阶段不能替代 fresh 验证。

Proves:
- N=10/100 且 S=1/5/20 的所选来源验证均恰好读取 N 个文件，次数不随 S 增长。
