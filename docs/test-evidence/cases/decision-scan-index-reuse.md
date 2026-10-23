### Case DECISION-SCAN-INDEX-REUSE-001: 全量只读检查验首次采集并保留公共旧 scan 的独立验收

Tests:
- `test:319a51ceaba1128757be601acfabb1ca52f37eddc8e75b3b3ebaec6bffeea77c`
- `test:3e07cb23ec0b546f187d25ad0d951b9420abdc3f1fe46183c6f030ce3dca6a71`
- `test:55f02e74fefca13418ac704c03965cf8da8f810aaffa3f596b43f50f964d066e`
- `test:becfd5c1b1a6cf6eff5c562c480afcee4d2f12cef1b577602f16717a7588247d`

Tags:
- `decision-records`

Contract:
- 完整只读检查验证本次首次安全采集的正式来源投影、原字节指纹与完整预期索引，不承诺结束新鲜或跨文件原子快照，不在结束重读全集来源。
- 外部传入或先前取得的 scan 不承担当前来源证据，独立验证继续重新取得来源；非法来源仍阻断索引检查。

Proves:
- 当前、文本非规范、缺失或损坏索引、来源字节变化与非法字段六种稳定输入下，完整结果与分开的 scan 加公开 validateDecisionScan 精确一致。
- 采集后编辑来源不使本轮只读检查重读；同时损坏索引时报告索引不同步而非结束来源漂移；下一轮检查和调用方持有旧 scan 的独立验证仍发现当前来源使索引陈旧。
