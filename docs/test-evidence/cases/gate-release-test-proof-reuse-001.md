### Case GATE-RELEASE-TEST-PROOF-REUSE-001: Release 测试批次只复用精确成功证明

Tests:
- `test:f74d47235d0535ea45ea92b1adaf6dae2e047c2d47861284ebada62b2e91cdce`

Tags:
- `repository-tooling`

Contract:
- 本地 release 只有在完整工作区、工具链、环境和批次 catalog 身份精确相同时才可省略已成功的批次测试进程；cold 必须真实重跑，证明只在 fresh 成功且运行前后工作区身份未变时发布。

Proves:
- 第一次成功批次执行全部文件分区并发布证明；相同身份和 catalog 的第二个 session 不再调用任何分区 runner，返回结果与 transcript 明确说明复用。
- 损坏证明按 cache miss 重新执行并由新成功结果替换；cold session 即使已有匹配证明仍执行全部分区；catalog 改变后旧证明不命中并按新分区重新执行。
