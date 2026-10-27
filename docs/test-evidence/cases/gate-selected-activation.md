### Case GATE-SELECTED-ACTIVATION-001: 原生调度只执行必要集及所选能力依赖闭包

Tests:
- `test:a7a38da8ba3bdbf0b40ec72fc813d730962178b1729dfb0b6f8e63b750465e6f`

Tags:
- `repository-tooling`

Contract:
- selected 保留完整 69 项 catalog，执行固定 quick 必要集、显式能力订阅根与 dependsOn 闭包，不从工作区变化扩大范围。
- 必要集不因能力 flag 未选而关闭；非必要的原生材料仅由自身订阅能力激活。

Proves:
- 真实 Vibe 调度在替换执行器的 catalog 上逐项核对通过或 not-applicable：gate-tests 仅追加自身入口，decision-stage-tests 仅追加 pending-stage，mcpshell 加入三个叶子及唯一生成 provider；重复和联合选组不重复执行。
- repository-code 才追加 duplicate/file/function metrics，其余选组不泄漏这些原生材料；全部十项必要 Check 始终执行，未选择的兄弟测试均不适用。
- CLI 不调用全工作区准备或 receipt 发布，controls 只携带去重所选 flags；性能摘要基于原生终态如实给出请求组、适用与执行 ID、计数及唯一生成依赖，无 gate-incremental.json。
