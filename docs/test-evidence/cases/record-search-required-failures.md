### Case RECORD-SEARCH-FAILURE-001: 显示耗尽后仍保留必需读取与资源失败

Tests:
- `test:bfba9235d789831d4ca06cbb2815ee6567b7a7771a074b33544ca667f5804268`

Tags:
- `record-search`

Contract:
- 显示预算耗尽后仍需完成必需读取，非法 UTF-8 或请求字节上限不能伪装成功。

Proves:
- 较早命中耗尽显示后，后续非法 UTF-8 与请求字节上限分别保持 invalid-utf8/resource-limit 错误。
