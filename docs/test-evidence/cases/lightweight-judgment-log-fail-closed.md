### Case LIGHTWEIGHT-JUDGMENT-CLI-027: 发送前存储失败关闭调用

Tests:
- `test:27ef848886be7842f677cc171ba20ba3f89c5320a2bf18e7787e9cad43c01e1e`
- `test:89823753ca2305febdb65207230cf18ed987055b3086be70f3d6e08f746f601f`
- `test:ca6bf4ea36ae6d2d5fa0a55250dffff6072d7d45ce47ce0d55b5388d5655b2b0`

Tags:
- `lightweight-judgment`

Contract:
- 无法使用调用库时不发送；拒绝不支持版本、符号链接和公开权限，不覆盖已有数据或自动放宽权限。

Proves:
- 其他应用数据库触发 storage/4、attempts=0 且 fetch 未调用，原表数据与 application_id 不变。
- 父路径为普通文件或 POSIX 数据库权限公开时退出 4 且 attempts=0；公开权限保持原值，不通过改权限掩盖错误。
- 应用 ID 正确但版本不受支持时返回明确 storage 诊断、退出 4、attempts=0 且 fetch 未调用；目标数据库字节不变。
- POSIX 中同一有效数据库可通过直接路径成功调用，但符号链接路径返回明确拒绝诊断、退出 4、attempts=0 且 fetch 未调用；链接与目标字节不变。
