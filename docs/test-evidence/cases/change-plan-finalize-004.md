### Case CHANGE-PLAN-FINALIZE-004: 删除准备拒绝 physical tree 漂移

Tests:
- `test:62f9ab2385068919d31e7005e510e9b093bc587535dbfeedd93495416ccd22e9`

Tags:
- `change-plan`

Contract:
- finalize 的删除准备只接受与 Git HEAD 字节和 owner executable bit 相同的普通文件 tree；修改、ignored/未跟踪成员、空目录和符号链接都不能在移动前越过门禁。

Proves:
- 内容及 executable-bit 漂移分别被 Git byte/mode 比较拒绝。
- ignored file、空目录及 symbolic link 分别产生零移动失败，所有 source Change 仍存在。
