### Case DECISION-SCAN-INDEX-REUSE-001: 同轮来源检查复用并保留独立漂移验证

Tests:
- `test:10be3894f60837c5ad666daeb00cdf9813f0494bdc1d6ee0681549a7ce57b37c`
- `test:55f02e74fefca13418ac704c03965cf8da8f810aaffa3f596b43f50f964d066e`
- `test:6be46e3773a6916f8d5d11a8a08ea31c39683fa0c22f9d0f8bcf4278b652e5e3`
- `test:becfd5c1b1a6cf6eff5c562c480afcee4d2f12cef1b577602f16717a7588247d`

Tags:
- `decision-records`

Contract:
- 完整检查复用本次扫描已验证的正式来源投影和原字节指纹，索引检查仍独立读取来源 revision 并比较完整预期索引文本；来源漂移先于索引文本差异报告。
- 外部传入或先前取得的 scan 不承担当前来源证据，独立验证继续重新取得来源；非法来源仍阻断索引检查。

Proves:
- 正常完整检查每份来源恰读两次，扫描结果与来源错误保留；独立复读并未被复用快照替代。
- 当前、文本非规范、缺失或损坏索引、来源字节变化与非法字段六种稳定输入下，完整结果与分开的 scan 加公开 validateDecisionScan 精确一致。
- 扫描后同时改变来源与损坏索引时，独立 revision 复读报告来源漂移而非索引文本不同；调用方持有旧 scan 时仍检测新来源使索引陈旧。
