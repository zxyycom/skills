### Case INVESTIGATION-STAGE-DOMAIN-CLI-001: CLI stage --scope domain stages report Markdown and owner resources without the index

Tests:
- `test:0b9af8406f11b196833c368834a7484da7faa71d6db99c3060d07d3086798d6a`

Tags:
- `investigation-report`

Contract:
- CLI stage --scope domain 写所选报告 Markdown 与 owner 资源，pending 索引保持零变化。

Proves:
- 暂存区含报告与资源变化；索引无 cached 差异；输出报告 caller-owned 索引路径。
