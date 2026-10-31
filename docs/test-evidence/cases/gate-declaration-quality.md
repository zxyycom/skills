### Case GATE-DECLARATION-QUALITY-001: 声明分发域启动三项质量命令而不启动空指标

Tests:
- `test:e6fe6a30d0b5af823db51baf2eced63eac93f3474fc045b3d62cb77bce7fa558`

Tags:
- `repository-tooling`

Contract:
- selected 的 decision-distribution 与 investigation-distribution 属于声明域，必须启动 typecheck、lint 和 format:check，但不能仅因声明位于 tools 下而启动无维护代码输入的 file/function metrics。

Proves:
- 分别使用两个真实领域 flag 执行 Definition 中的原生指标与三项原生命令 Check，两指标均以 flag-condition-not-matched 结算，区别于已运行但无输入的 no-eligible-input。
- 三项 commandCheck 均实际启动临时工作区的对应 Bun package script、返回 passed，并留下内容精确为 started 的独立文件标记；两个领域之间清除标记，不能复用上一轮启动证明。
