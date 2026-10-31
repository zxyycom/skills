### Case INVESTIGATION-PUBLIC-OPTIONS-001: public APIs diagnose malformed runtime options without throwing

Tests:
- `test:f4d061dc60c125c53a6eb54c78e964ff36c357439b78504266ea7a5b55842d08`

Tags:
- `investigation-report`

Contract:
- 公共验证 API 必须把未经信任的运行时选项转换为诊断，而不抛出异常。

Proves:
- 非字符串 workspaceRoot、缺失 publish/discard 必填参数均返回结构化错误。
