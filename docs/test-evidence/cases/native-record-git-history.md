### Case NATIVE-RECORD-GIT-HISTORY-001: 缺失历史索引的 stage 安全边界

Tests:
- `test:8e9f09c73aaa7c1d5316cc2b8583a841731b32c11cb76be65edfddeb31a877cf`
- `test:9f5ca95c45c861c78d7e5dc343489c9a51ba9cbe2ec22a123378cf13dabaee20`

Tags:
- `record-rust`

Contract:
- 缺失历史索引不能被默认为空历史，只有可证明为空的 namespace 才能继续。

Proves:
- 真实提交下区分歧义或正式成员与空 namespace，并核对拒绝时 pending。
