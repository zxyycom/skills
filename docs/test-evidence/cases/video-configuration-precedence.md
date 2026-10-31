### Case VIDEO-CONFIGURATION-PRECEDENCE-001: 位置配置按字段继承且媒体缺省延迟解析

Tests:
- `test:342f9a3611acd480e80105b44c1b7218cac027bdfbceac823515298df94e0134`
- `test:f5fa4c9f251649ac22d1847aa7a05da7cc4459e55436df515d1d361339dc9576`

Tags:
- `video-understanding`

Contract:
- 显式 CLI、显式项目配置、用户配置和适配缺省按字段优先；省略/null 继承低层，路径不插值，媒体 resolver 仅在新媒体操作需要时调用。

Proves:
- 字段独立合并且配置字节不改；Node 公开入口按预期选择证据根和媒体根，纯复用不调用 resolver，新媒体保留其 runtime target 与失败身份。
