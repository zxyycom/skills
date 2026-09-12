### Case DECISION-EVOLVE-GROUPED-NODE-SMOKE-001: 分发 Node CLI 接受分组 Evolve 参数

Tests:
- `test:78e557462f0af9ab38aa854a55b21f1f7fec42698480eb93609ce98843ee9a0e`

Tags:
- `decision-records`

Contract:
- 分发制品必须能由真实 Node argv 解析逐 successor 分组并执行 preflight 边界。

Proves:
- 自包含 Node CLI 对闭合分组拆分返回成功的 preflight review，并保持 stderr 为空。
