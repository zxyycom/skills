### Case LIGHTWEIGHT-JUDGMENT-CLI-027: 发送前存储失败关闭调用

Tests:
- `test:7592d59374e2ec26e52c8741acd4f364566cc0fcc90e02fbe6c3abf443c27730`
- `test:8e4d15b7653f6be51b5663d98ff4ee6e97d6e92fff4eb5d4d2b1c421b1f7a656`
- `test:ac3ce12011f3c6525917ec552b9e8e15917c7241d87eb99a7766ff3a18385f42`

Tags:
- `lightweight-judgment`

Contract:
- 无法使用调用库时不发送；拒绝不支持版本、符号链接和公开权限，不覆盖已有数据或自动放宽权限。

Proves:
- 其他应用数据库触发 storage/4、attempts=0 且 fetch 未调用，原表数据与 application_id 不变。
- 父路径为普通文件或 POSIX 数据库权限公开时退出 4 且 attempts=0；公开权限保持原值，不通过改权限掩盖错误。
- 应用 ID 正确但版本不受支持时返回明确 storage 诊断与升级指南路径、退出 4、attempts=0 且 fetch 未调用；目标数据库字节不变。
- POSIX 中同一有效数据库可通过直接路径成功调用，但符号链接路径返回明确拒绝诊断、退出 4、attempts=0 且 fetch 未调用；链接与目标字节不变。
