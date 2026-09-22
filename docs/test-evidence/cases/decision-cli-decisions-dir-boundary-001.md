### Case DECISION-CLI-DECISIONS-DIR-BOUNDARY-001: 绝对与越界决策目录按普通参数错误失败

Tests:
- `test:114023e49e3df8d6fd4bbdc8e2c0044662de1754f4092bb0d6ffc91a545371fc`

Tags:
- `decision-records`

Contract:
- `--decisions-dir` 只接受解析后仍位于 `--root` 内的相对路径；绝对目录与越界相对路径都按普通参数错误失败，不保留旧绝对目录解析分支。

Proves:
- 绝对目录与 `../` 越界目录的 CLI 调用都以退出码 `2` 结束，stdout 为空，stderr 分别给出相对与包含约束诊断。
