### Case INDEX-RUNTIME-PATH-SYMLINK-WRITE-001: 拒绝经符号链接逃逸的索引写入

Tests:
- `test:2ee34a7c5f8bb73c76e517edc531133f9eb2fb89591c08d14f71a8217d5bc68f`

Tags:
- `index-runtime`

Contract:
- 索引同步必须依据规范路径约束在配置根目录内，不能跟随路径中的符号链接写入根目录外目标。

Proves:
- 指向根目录外的中间目录符号链接和最终文件符号链接都返回 `index-path-invalid` 和 `state-index.index-path-invalid`。
- 根目录外文件保持不变。
