### Case INVESTIGATION-CLI-CANDIDATE-VALIDITY-001: 候选查询区分结构无效和机械未就绪

Tests:
- `test:0e86f851f9e19d01c5b918f6312948af129150d2cf25ca4eae92199d4a025d0f`

Tags:
- `investigation-report`

Contract:
- 显式候选查询对结构或 metadata 非法返回 1；合法 scaffold 的 body/resource 未就绪仍成功，三项 readiness 始终可见。

Proves:
- 全部 ready、空正文和缺失资源均退出 0，明确显示各项 true/false 并保留未就绪诊断。
- 非法固定 H2 或 tags 的显式查询退出 1、stdout 为空；列表 warning 后跳过，publish preflight 仍拒绝且不改写候选。
