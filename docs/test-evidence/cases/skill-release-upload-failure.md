### Case SKILL-RELEASE-UPLOAD-FAILURE-001: zip 上传失败停止滚动发布且可重试

Tests:
- `test:ffc82afa9b4a07b9f456268db1a0b55c284fae9c03dceca0cb275be69b232c42`

Tags:
- `repository-tooling`

Contract:
- zip 上传失败不能继续发布 manifest、删 stale 或 edit release；同现场成功重试仍可完成正确序列。

Proves:
- fake gh 的 zip upload 命中 exit7，CLI 失败含注入诊断且命令只到 zip；解除注入后同 fixture 成功按序 manifest upload、stale delete、edit，没有真实远端调用。
