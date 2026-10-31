### Case CHANGE-PLAN-SOURCE-INSTALL-001: 独立 frozen 安装后的 TS 可运行可改且公开类型可消费

Tests:
- `test:8c9ec196038cd5049392823b7becafecc2278a5a848985c16d18c366810bbdab`

Tags:
- `change-plan`
- `distribution`

Contract:
- Change Plan TS 制品显式按随包锁文件独立安装，使用 Node 运行且无需构建即可调整业务源码。

Proves:
- Frozen 安装不改变锁文件且无需 workspace 配置；独立 tsgo 消费者取得实际 TS 导出与类型。
- 真实 Node 的 help、Draft JSON check、无输出 import 和错误参数退出状态符合 CLI 责任；修改包内 TS 后新进程立即观察到结果。
