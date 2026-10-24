### Case INVESTIGATION-FRESH-RESOURCE-PHASE-001: 共同新鲜资源验收绑定根并保持独立生命周期检查

Tests:
- `test:4f595580471abb67df14e3abed8b824aa2ed2c48b0023380e05a38916fc5e3ed`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- 当前 fresh 的二进制资源文件保护可使用共同 phase，但根必须显式相同，即使文件集为空；目录证明保留原顺序，move/copy/delete/recovery 未传 phase 时继续独立实时验收。

Proves:
- 含文件、只有目录和完全空保护范围在错误 phase 根下均拒绝；合法二进制资源（非 UTF-8）通过，独立 fresh 拒绝文件 mode 与目录 mode 漂移，未传 phase 的后来生命周期检查拒绝字节漂移且保留外部编辑。该入口不单独证明资源复制/恢复协议或延迟。
