### Case INVESTIGATION-PUBLIC-OPTIONS-001: public APIs diagnose malformed runtime options without throwing

Tests:
- `test:66943ec9108b5d14c1b201631c4f2fcdb2df7a02bcbc2e55cb5d98ad75e7e15d`

Tags:
- `investigation-report`

Contract:
- 公共验证 API 必须把未经信任的运行时选项转换为诊断，而不抛出异常。

Proves:
- 非字符串 workspaceRoot、缺失 publish/discard-candidate 必填参数均返回结构化错误。
