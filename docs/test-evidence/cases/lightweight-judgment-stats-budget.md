### Case LIGHTWEIGHT-JUDGMENT-STATS-BUDGET-001: 非法参数资源与精度拒绝

Tests:
- `test:cbba1ea4d534515d26466bdab9fdfbbbd8960a385b30bdc39ae3ecc87a7ea816`

Tags:
- `lightweight-judgment`

Contract:
- 非法统计参数在读取前失败；所选行数预算和安全整数聚合超限失败，不截断或输出不精确结果。

Proves:
- 重复／注入标签键、无效 UTC、逆序桶／未知组字段／零分位数／不安全预算均 input/2；超安全 tokens 总和与 maxRows1 返回 storage/4、result null，提高预算后两条全量统计成功。
