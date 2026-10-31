### Case INDEX-RUNTIME-PATH-001: 拒绝配置根目录之外的索引路径

Tests:
- `test:390b5cc073b784ec4c05ff3a61342f855fd4243371ff2c57935a3f4da60391b9`

Tags:
- `index-runtime`

Contract:
- 索引读写路径必须限制在配置根目录内。

Proves:
- 父目录逃逸路径返回 `index-path-invalid`，不虚构 `filesystem` 事实；受控根外 sentinel 字节及目录成员保持不变。
