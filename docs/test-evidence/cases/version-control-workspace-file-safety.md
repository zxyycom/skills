### Case VERSION-CONTROL-WORKSPACE-FILE-SAFETY-001: 工作区文件读取安全失败不降级

Tests:
- `test:4ca882c16324d23ccdc11ff6aecb29d313600b10b9c25d2205422d5ede572875`

Tags:
- `version-control`

Contract:
- 工作区文件读取只接受常规非符号链接来源，要求路径合法且有效表示可唯一确定；只有不存在时返回 null。

Proves:
- 缺失路径返回 null，目录和符号链接返回 operation-failed，越界路径返回 invalid-path，无效 core.fileMode 不能猜测普通表示。
- core.fileMode 关闭时，未合并 pending 条目或同路径符号链接表示返回 operation-failed，无法唯一确定表示时停止读取。
