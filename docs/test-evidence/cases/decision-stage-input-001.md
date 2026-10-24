### Case DECISION-STAGE-INPUT-001: Stage 在工作区读取前拒绝重复与路径形选择器

Tests:
- `test:7fa71bfe94130acb3bce37c9890b5f3dd1e5431acdb3008030f79d73fc07b39c`

Tags:
- `decision-records`

Contract:
- stage 在访问工作区前拒绝重复和越界的选择输入。

Proves:
- 不存在的 workspace 上，重复 ID 与路径形选择器仍返回退出码 2 参数诊断，不依赖成功打开工作区。
