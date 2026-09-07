### Case CHANGE-PLAN-COMPLETE-004: 删除准备拒绝 physical tree 漂移

Tests:
- `test:1e7dbb1a3da7b555451e912fbf41589aecf32612965bb2f80832739f815b1384`

Tags:
- `change-plan`

Contract:
- complete 的删除准备只接受与 Git HEAD 字节和 owner executable bit 相同的普通文件 tree；修改、ignored/未跟踪成员、空目录和符号链接都不能在移动前越过门禁。

Proves:
- 内容及 executable-bit 漂移分别被 Git byte/mode 比较拒绝。
- ignored file、空目录及 symbolic link 分别产生零移动失败，所有 source Change 仍存在。
