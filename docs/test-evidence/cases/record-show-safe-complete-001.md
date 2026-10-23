### Case RECORD-SHOW-SAFE-COMPLETE-001: 两域完整正文读取保持安全字节边界

Tests:
- `test:87a6a7eea8fde9d5abb21891e6188651e13576cbd6f455c6cc54d19377ea430c`
- `test:a4c41c0f4744d19825b1397dc64e6cf8daad986ccd5450cc7be6458e5eee914b`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- show 以安全同inode同字节核对ID并严格UTF-8解码，canonical collection不越workspace，返回全文而非搜索preview。

Proves:
- 两域API与CLI返回超过2MiB的完整正文，保留UTF-8 BOM；非法UTF-8、source symlink、读取中的同ID inode替换、保持文件inode/字节的父目录替换及canonical collection越界失败。
