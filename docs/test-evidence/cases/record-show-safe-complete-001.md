### Case RECORD-SHOW-SAFE-COMPLETE-001: 两域完整正文读取保持安全字节边界

Tests:
- `test:026448ab9563a473616fb961d53eba9156c4955114b372a5704905b61b108f0b`
- `test:b9f5a11b124e38a2873dab76d78907dee7bd7fb6e5f3fc9579aa8d07bd1aed35`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- show 以安全同inode同字节核对ID并严格UTF-8解码，canonical collection不越workspace，返回全文而非搜索preview。

Proves:
- 两域API与CLI返回超过2MiB的完整正文，保留UTF-8 BOM；非法UTF-8、source symlink、读取中的同ID inode替换、保持文件inode/字节的父目录替换及canonical collection越界失败。
