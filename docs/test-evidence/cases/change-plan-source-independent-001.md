### Case CHANGE-PLAN-SOURCE-INDEPENDENT-001: 独立 frozen 安装允许兼容版本差异且互不改写

Tests:
- `test:f6521d6e64250531b924171676a6027152e94c1b000ae6667f23ba064f5bf74a`

Tags:
- `change-plan`
- `distribution`

Contract:
- 单个 skill 的 manifest、锁文件与安装目录独立管理，可选用不同兼容依赖基线，重装一份不改写另一份。

Proves:
- 两个隔离副本分别显式选择 valibot 1.4.2 和随包基线 1.5.0 后完成 frozen 安装并通过真实 Node help。
- 再次 frozen 安装较旧版本副本后，另一份 manifest、lock 和实际依赖版本保持不变。
