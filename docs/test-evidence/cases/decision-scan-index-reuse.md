### Case DECISION-SCAN-INDEX-REUSE-001: 全量只读检查验首次采集并保留公共旧 scan 的独立验收

Tests:
- `test:3d60a64188c1bcd06642e31a071accd7797eb61b9540187156605c4587f7deb6`
- `test:53a47ff159d909f08ea196d6610a32de3ccd1d05b84e98d098f251f95303d54e`
- `test:6f0095546ba5f63d3a0a244aebe3969dfa3ff2c108fa9aecf7087c2bc0603c93`
- `test:fc9af7aa2790589c80fe9c0d4d27a83639900a8f09a07d33f7d0338ac45099c3`

Tags:
- `decision-records`

Contract:
- 完整只读检查验证本次首次安全采集的正式来源投影、原字节指纹与完整预期索引，不承诺结束新鲜或跨文件原子快照，不在结束重读全集来源。
- 外部传入或先前取得的 scan 不承担当前来源证据，独立验证继续重新取得来源；非法来源仍阻断索引检查。

Proves:
- 当前、文本非规范、缺失或损坏索引、来源字节变化与非法字段六种稳定输入下，完整结果与分开的 scan 加公开 validateDecisionScan 精确一致。
- 采集后编辑来源不使本轮只读检查重读；同时损坏索引时报告索引不同步而非结束来源漂移；下一轮检查和调用方持有旧 scan 的独立验证仍发现当前来源使索引陈旧。
