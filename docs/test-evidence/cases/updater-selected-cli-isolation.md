### Case UPDATER-SELECTED-CLI-ISOLATION-001: 真实生成 CLI 隔离无关损坏但阻断所选漂移

Tests:
- `test:1a1f243474e04020631f8cb4c41c5ada3fe8bc7bad6bce06f4e65a29751bc152`

Tags:
- `repository-tooling`

Contract:
- 公开 check:skill-updaters --skill 在实际读取之前收窄输入，只读检查所选 skill 的完整 runtime；无关损坏不得阻断，所选或共同依赖漂移必须阻断。

Proves:
- 隔离 fixture 复制真实工具执行闭包，以最小独立源初始化健康全量生成；公开命令支持健康两域联合与重复选组。
- 无关域坏生成、SKILL.md 删除与无关 escaped import 同时存在时，仅检查 ai-ready-docs 成功且 stdout 为空、文件树字节不变；全量入口仍因缺失 SKILL 失败。
- 所选生成字节漂移与选中 shared source 漂移分别退出 1 并定位所选产物；失败检查均不改写文件。
