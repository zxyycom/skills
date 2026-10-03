### Case RECORD-SEARCH-FAILURE-001: 显示耗尽后仍保留必需读取与资源失败

Tests:
- `test:18ff13fe0c73f7b18396d4dd73633165597e87d439bd3d79d787989e27858118`

Tags:
- `record-search`

Contract:
- 正文读取、资源上限或取消是失败，不以显示耗尽为由跳过或伪造成功部分结果。

Proves:
- 后续非法 UTF-8、请求字节上限和已取消请求分别保持 invalid-utf8、resource-limit 和 aborted 错误。
