### Case LIGHTWEIGHT-JUDGMENT-CLI-026: 失败状态与原始异常正文

Tests:
- `test:cab64e05cd62a5b88f3e0ce1bfd80eda88dc9e37e6c2b7eb0e2aeb642d4d9617`

Tags:
- `lightweight-judgment`

Contract:
- HTTP 与协议失败、网络结果不确定分别记录；开启响应留存时保留异常正文但不暴露在 CLI 诊断中。

Proves:
- 401、无效 UTF-8 与连接失败各只调用一次并返回原错误类别，前两者保存 failed，网络错误保存 indeterminate。
- 数据库保留 401 原文及无效 UTF-8 的确切字节；stdout 不含远端任意错误文本。
