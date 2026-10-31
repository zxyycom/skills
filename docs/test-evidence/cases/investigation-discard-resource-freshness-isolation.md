### Case INVESTIGATION-DISCARD-RESOURCE-FRESHNESS-001: 删除资源字节保护不被共同正文事实替代

Tests:
- `test:9f0a76ed40579c4b21cc104bde295345565007aecca240ef71a401958af0960b`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- IR discard 的资源源字节证明与正文安全采集各自有效；正文未变不能允许删除已漂移的 owner 资源。

Proves:
- 真实正式删除在 beforePublish 仅改变已准备资源字节后，以 member changed 类别零写入失败；待删报告仍在，外部资源字节未被恢复覆盖。不依赖诊断输出的本地路径明文。
