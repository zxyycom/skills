### Case LIGHTWEIGHT-JUDGMENT-CLI-026: 失败状态与原始异常正文

Tests:
- `test:e40b077ccd84a9ee43c0a7ddfc4e9873a7968a68e23a694153c31758f00bb854`

Tags:
- `lightweight-judgment`

Contract:
- HTTP 与协议失败、网络结果不确定分别记录；开启响应留存时保留异常正文但不暴露在 CLI 诊断中。

Proves:
- 401、无效 UTF-8 与连接失败各只调用一次并返回原错误类别，前两者保存 failed，网络错误保存 indeterminate。
- 数据库保留 401 原文及无效 UTF-8 的确切字节；stdout 不含远端任意错误文本。
