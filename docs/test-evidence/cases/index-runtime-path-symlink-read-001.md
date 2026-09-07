### Case INDEX-RUNTIME-PATH-SYMLINK-READ-001: 拒绝经符号链接逃逸的索引读取

Tests:
- `test:a0d100d1e3966b20762212a793b80a8e055f09cf4041dd22285015ab8fa553f4`

Tags:
- `index-runtime`

Contract:
- 索引读取必须依据规范路径约束在配置根目录内，不能跟随路径中的符号链接访问根目录外目标。

Proves:
- 指向根目录外的中间目录符号链接和最终文件符号链接都返回 `state-index.index-path-invalid`。
- 根目录外文件保持不变。
