### Case VIDEO-EVIDENCE-LOCATION-001: 规范素材路径决定集合身份

Tests:
- `test:4fb38b9cd438f447e694430fe4c50c5fa1295167800ae07fdff06f0674b89b0e`
- `test:6b4d6753292ef3638bc6e7d7ba49df12d53288a2d54a4f429a2851656c093a03`
- `test:93d00bcf0302599749c4465aba4b27168026554f05c5f8c7502a889307750d7a`

Tags:
- `video-understanding`

Contract:
- 集合叶目录以素材 realpath 的摘要识别，不依赖 cwd；显式 output 为单视频覆盖，附带 input 仍须核对身份。

Proves:
- 路径别名和 Windows 大小写指向相同 scope，另一素材路径分离；纯读不建目录，写入只创建所选 scope，错误 input 不被静默忽略。
