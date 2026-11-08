### Case DECISION-STAGE-SCOPE-DOMAIN-001: stage --scope domain writes only formal Markdown and preserves the pending index

Tests:
- `test:2bebe4b041eaae3a3f10f3b2ee22917e6595955f1bd7e012d03aa780ece454ea`

Tags:
- `decision-records`

Contract:
- stage --scope domain 只写所选正式 Markdown，pending 索引按当前字节原样保留。

Proves:
- 真实 Git 中原生 stage domain 把所选当前 Markdown 写入 pending，保留预先暂存的索引字节，并将索引路径报告为 caller-owned；该节点调用原生 stage 接口，不证明 CLI 呈现。
