### Case CHANGE-PLAN-SOURCE-LOCK-DRIFT-001: Frozen 安装拒绝 manifest 与锁失配并可显式恢复

Tests:
- `test:ccaf3c4c2f67c6707a8793b2fb255bc2b2739818d61fc0c3d7be619fd279c031`

Tags:
- `change-plan`
- `distribution`

Contract:
- 标准 frozen 命令以随包锁文件复现声明依赖；manifest 与锁失配时失败并保留锁，不把失败当成成功安装。

Proves:
- 有效分发副本中的 manifest 被显式改为不匹配版本后，标准命令返回非零与过期锁诊断，锁文件字节保持不变。
- 恢复 manifest 后显式重跑同一 frozen 安装成功，真实 Node help 恢复执行。
