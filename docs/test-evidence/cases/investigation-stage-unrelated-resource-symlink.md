### Case INVESTIGATION-STAGE-UNRELATED-RESOURCE-SYMLINK-001: 完整所选树安全校验不遍历其他 owner

Tests:
- `test:1cd8f8276bd2380c236c1708ae5dec3f656c91e65f2431c114188e28e3a0a270`

Tags:
- `investigation-report`

Contract:
- 局部 domain 仅检查所选 owner 完整树和必要直接依赖，不把无关资源树健康作为门禁。

Proves:
- 无关 owner 是外部目录符号链接时 domain 仍仅写入所选资源变化，未 lstat 无关 owner、readdir 其目录或检查外部目标内容。
