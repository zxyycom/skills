### Case NATIVE-LEGACY-PREFLIGHT-001: 旧安装冲突在写入前识别

Tests:
- `test:acc159f7a1f056375ba1b9c5f556a403be96a15cf74e40da47aab1e27aa9e9ab`

Tags:
- `repository-tooling`

Contract:
- 旧受管清单必须在原地交接写入前与目标文件匹配；冲突不授权覆盖或退役。

Proves:
- 匹配文件通过，内容修改和缺失被列为冲突，不安全清单路径被拒绝。
- 只读预检保留无关文件；此测试不证明后续安装和并发安全。
- 保留名称及大小写别名被拒绝；非 Windows fixture 另验证符号链接不会被当作受管普通文件。
