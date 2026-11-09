### Case NATIVE-RECORD-MULTI-SOURCE-PREVIEW-001: 多源成功与失败输出保留原始预览编码

Tests:
- `test:e58e00b0e9c2781427e18c7b8f80d8409fc4bf6c5e000a92e4c1bb3754e891a2`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 合法 Unicode 正文按 UTF-16 预算截取的预览可以含转义孤立代理项；多源成功或部分失败输出必须原样保留其代码单元。

Proves:
- 构造 24,001 UTF-16 单元匹配行，使 24,000 单元预览恰在 emoji 高低代理项之间截断；实际 JSON 中定位该预览，核对完整前缀及末尾孤立高代理项，在整体成功和第二源失败两条输出路径均成立。
