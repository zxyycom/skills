### Case NATIVE-RELEASE-THREE-ROLES-001: 正式清单第三角色兼容边界

Tests:
- `test:55016724f20768055b6700046c9132ee5d7520aa73b64e39d79fb5d4cdc9b5b8`
- `test:5c94db541e493659ea09dc9febd4a174f09107bdf7e4325b7135f432ff6f4784`
- `test:a5d3455c68dbc21bf358e75aee6d9cc1bc5e92f3046cb5333bb62ee6c09c78e4`

Tags:
- `native-delivery`

Contract:
- 正式 v1 清单允许读取旧双角色，第三角色出现时绑定共同身份；三域装配和资源安装要求第三角色。

Proves:
- 新 parser 接受双域与合法三域，三域缺项和第三角色来源身份不符被拒绝；资源安装器的只读检查拒绝旧双域清单。
- 冻结于 925de860 的旧 parser、bundle 与 overlay 从三域 fixture 验证并实际覆盖安装原两角色，核对落盘版本、文件字节和无关文件保留；程序为合成数据，不证明可执行、完整 CLI、网络发布或旧消费者支持第三角色。
