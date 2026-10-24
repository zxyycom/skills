### Case DECISION-SCAN-ACQUISITION-FAILURE-001: 首次采集失败不进行隐式重读

Tests:
- `test:865a2885036fed1c6a33c837a7208efa287539480e9119b1778be7f651da3d3c`

Tags:
- `decision-records`

Contract:
- 来源身份和正文复用同次安全采集；该次读取失败必须保留失败，不以稍后重读覆盖。

Proves:
- 首次source open注入EACCES后只尝试一次读取，scan保留一次原始访问失败并将来源标为invalid。
