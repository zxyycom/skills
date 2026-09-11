### Case INVESTIGATION-CLI-SHOW-DIAGNOSTIC-001: CLI show renders a scrubbed structured report read failure

Tests:
- `test:e26d75be88818314752491cb2bcb4df945f2aba819715eff6aa93b5dd4d383c8`

Tags:
- `investigation-report`

Contract:
- `show` 在当前 index 已确认目标报告后读取报告文件失败时，必须保留稳定 code、目标、access cause、受控 detail 与恢复步骤，不能把外部 Error message 直接交给 generic renderer。

Proves:
- 注入含 Git token、绝对路径和换行的 EACCES read failure 后，CLI 返回退出码 1、stdout 为空，stderr 含 report-read-failed 与 access-denied，但不含 token 或绝对路径。
