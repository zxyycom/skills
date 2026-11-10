### Case NATIVE-RECORD-SOURCE-WRITE-REJECTION-001: 多源写入及预检失败不改现场

Tests:
- `test:28bf6bde765044fb50f51cd021f1b6f8b344e4d5e91289f64a83835b030a8ad7`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 显式 key 或 defaultWriteKey 展开为多源时，写操作及其预检必须在写入前拒绝，不选首源或回退工作区。

Proves:
- 显式 key 与默认写 key 的多源 new 和 sync-index --preflight 均退出 1，返回 config-error 及恰好单源要求。
- 每次失败后完整私有 fixture 的路径、目录成员及文件字节均与调用前一致，排除创建候选、索引或额外目录。
