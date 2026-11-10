### Case NATIVE-RECORD-SOURCE-NON-UTF8-WRITE-001: 选源写入保持非 UTF-8 工作区身份

Tests:
- `test:9c476c1da30d2e3a4d4eeab9c215c08270ae972a066f06083af038da870bcb28`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- Unix 工作目录含非 UTF-8 字节时，显式单源 key 的写入继续使用原生路径身份，不通过有损字符串转换改写实际目标。

Proves:
- 私有 fixture 同时建立带原始 0xff 字节的 cwd 与 U+FFFD 替代字符同名兄弟目录，在原 cwd 中配置 root 为 . 的单源 key。
- 固定 formedAt 的真实 new --key one --json 成功，仅在原字节路径的 reports 下创建候选；替代字符兄弟目录的完整成员和字节保持不变。
