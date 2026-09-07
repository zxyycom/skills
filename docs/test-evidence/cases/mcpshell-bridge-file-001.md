### Case MCPSHELL-BRIDGE-FILE-001: workspace put and get preserve binary and empty-file bytes with both endpoint hashes

Tests:
- `test:c2323fa016c1412bcb3c182758ed88f70f5599d53b94c8e05f494a7056abaaed`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put/get 只传输单个常规文件的原始字节，并以 byte count 与 SHA-256 证明两个端点一致；get 的文件 stdout 不是 JSON 文本 capture，不能受其 1 MiB 上限截断。

Proves:
- 大于 1 MiB 的 binary 与 empty file 的 put 成功；get 回到 staging 后 bytes 一致，两个 operation 的 SHA-256 evidence 相同。
