### Case LIGHTWEIGHT-JUDGMENT-STATS-LEGACY-001: 只读 v1 与正文隔离

Tests:
- `test:5a4957d7fe2896225e419cd42073537989d8df52fd855ed4766741fc3c211257`

Tags:
- `lightweight-judgment`

Contract:
- stats 支持读取既有 v1 摘要，不迁移库，也不读取或输出原始请求／响应正文。

Proves:
- 真实 v1 库统计成功且新元数据缺失可见，原文件字节与 user_version 均保持；统计输出没有正文标记。
