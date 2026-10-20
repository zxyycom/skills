### Case SKILL-UPDATER-DEPENDENCY-RECOVERY-001: 缺少依赖时给出显式恢复并可重试

Tests:
- `test:f20d3617ee4a2ded0ece98b058a93db34314ea02452e96534d45277075b38538`

Tags:
- `skill-updater`

Contract:
- 普通导入无 CLI 或安装副作用；执行加载失败保留诊断并提示显式 frozen 安装，源码更新与依赖安装不合并为隐式动作。

Proves:
- 干净副本无依赖时导入安静、help 明确失败且未建立依赖目录或改锁；显式 frozen 安装后锁文件不变，真实 Node help 恢复成功。
