### Case VIDEO-REUSE-INTEGRITY-001: 复用受当前性和依赖材料约束

Tests:
- `test:5887f4a9d90a911a4197900849d22084f85a0c29a4a386fa5d209ea00115dc1b`
- `test:78b40a91b3c8884973ed84874ca49a12aa2f96e2fc1263dbe008a30ad2389731`
- `test:f773dcca6c501f0e96fb532779d96f9e879d592f0bbe0f6a9c58269857acf6a1`
- `test:fabff2bc7c1bc81a0b9f8a9eee6f341a263b7dbc4310b0737d168ee84199c607`

Tags:
- `video-understanding`

Contract:
- 只有输入、参数和所采用材料仍有效时才能纯复用；无关旁挂文件不改变既有材料身份。

Proves:
- 重复 prepare 不启动媒体；变更素材、参数、已采用字幕或缺损产物阻止复用，无关新 sidecar 不使已有材料失效。
