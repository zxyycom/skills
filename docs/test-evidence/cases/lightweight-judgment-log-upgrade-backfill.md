### Case LIGHTWEIGHT-JUDGMENT-LOG-UPGRADE-BACKFILL-001: 逐字段回填与缺失语义

Tests:
- `test:a2ae6a70b701a265f82007a44c1b6b7c2844e0cc171c195e071cbb3c0136c458`

Tags:
- `lightweight-judgment`

Contract:
- 显式迁移从原始请求文本计算 UTF-8 字节数，从原始响应 BLOB 计算字节数；缺失来源保持 NULL，空响应为 0，不从正文或时间猜测批次、序号和标签。

Proves:
- 随包 SQL 脚本 将含中文与 emoji 的请求回填为 73 字节，已留存但未完成调用的请求为 13 字节，无效 UTF-8 响应仍为 3 字节，空 BLOB 为 0，未留存正文保持 NULL；三个本地元数据字段均为 NULL，即使正文含同名信息也不采用。
- 迁移后 stats 保留全部 4 次调用，两类字节指标均为 2 个有效值、2 个缺失值，请求与响应字节总量分别为 86 和 3。
