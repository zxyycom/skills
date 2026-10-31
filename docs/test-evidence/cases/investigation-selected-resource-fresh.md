### Case INVESTIGATION-SELECTED-RESOURCE-FRESH-001: 局部资源必需性与来源fresh

Tests:
- `test:8f2aff7414229ccc1cb90e13660db21fdb418de9575f71b483440cf16b44c0c9`

Tags:
- `investigation-report`

Contract:
- IR selected sync 验证所选直接资源，并独立fresh当前来源，不从发布投影补造资源或吞掉后来的编辑。

Proves:
- 已知直接资源缺失时拒绝且index不变。
- 资源恢复后准备阶段的source后来被编辑，fresh仍拒绝并保留后来正文和原index。
