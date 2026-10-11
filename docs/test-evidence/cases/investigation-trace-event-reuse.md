### Case IR-TRACE-REUSE-001: 完整事件双向查询保留 anchor 与深度边界

Tests:
- `test:7a988e5ad0704d0ace22f584ac78434e7415c3d42286c98668b221148a666144`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 拆分和纯归并按整体接纳；方向 trace 端点与闭合 context 区分，depth 限制不递归扩展 context。

Proves:
- 全部中心及成员 anchor 的 both 查询得到完整事件；预算不足返回完整 blockedEvent；成员 depth1 保留其余 context 与准确 frontier。
