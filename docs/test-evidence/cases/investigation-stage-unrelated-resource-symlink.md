### Case INVESTIGATION-STAGE-UNRELATED-RESOURCE-SYMLINK-001: 完整所选树安全校验不遍历其他 owner

Tests:
- `test:2ccd5b83766ed66cc4223845e3447e8fe7f6cd252aae3df70c683b9729839d03`

Tags:
- `investigation-report`

Contract:
- 局部 domain 仅检查所选 owner 完整树和必要直接依赖，不把无关资源树健康作为门禁。

Proves:
- 无关 owner 为外部目录符号链接时，真实 FS 校验仍取得所选资源的新字节；受控 lstat/readdir 禁止访问无关 owner 及外部目标，校验成功。
