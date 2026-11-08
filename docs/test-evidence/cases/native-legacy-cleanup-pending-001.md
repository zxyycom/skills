### Case NATIVE-LEGACY-CLEANUP-001: 激活后清理冲突保留现场

Tests:
- `test:5c56cb37b5df48a68afb887b2d84260d9fd316badc9347323df13ffb02762ea7`

Tags:
- `repository-tooling`

Contract:
- 新入口激活后的旧文件若已变化，不得删除或宣称整个交接成功；应保留待清理状态和备份。

Proves:
- 私有 fixture 在验证回调后修改旧文件时报告 cleanup pending，新说明与用户变更均保留，receipt 和备份目录可定位。
- 恢复旧文件后可再次校验并续清理；恢复目录中出现未知文件或备份内容被修改时拒绝且不删除，排除冲突后可完成并再次核验。
- 非 Windows fixture 中修改新 descriptor 的 mode 后续清理拒绝；恢复 receipt 中记录的 mode 后才能继续。
- 非 Windows fixture 同时篡改普通文件权限和 receipt 对应 mode 时，独立平台权限策略仍阻断，不以二者自洽冒充授权。
