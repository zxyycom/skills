### Case SKILL-UPDATER-SELF-OVERWRITE-001: TS updater 完整加载后可覆盖自身运行时

Tests:
- `test:0408a8e73a48610e62ed34349fd4e77e3b8affeaff21e0fff1577c5fef5ce6ca`

Tags:
- `skill-updater`

Contract:
- Updater 在写入前加载完整模块图；本次进程使用已加载的版本，下次启动使用被覆盖后的 TS，不删除额外本地文件。

Proves:
- 实际 Node 更新覆盖公开 TS 入口与运行中 index 模块后顺利完成并保留定制；新进程执行替换后的模块内容。
