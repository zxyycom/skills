### Case VIDEO-OUTPUT-SAFETY-001: 证据输出不覆盖未知目录或逃逸路径

Tests:
- `test:0666c26d98cb93143519259df8036071ae2b2bb6467d8a90007fe7f3fa8bde1e`
- `test:56be9ac42fe4076f3e8c58735359792b86199ec888369b4390d45fd4dec9ac02`
- `test:b93b29bfb3bebad0406ab7d1323d4708daea48959e837d7471aa952589e80a1a`
- `test:e0476b375b01ff89d17b5c9d4c5b37e77b9079fa98971e78a3a920a674053031`

Tags:
- `video-understanding`

Contract:
- 输出须是明确的本地证据目录；未知内容、无效父目录、非文件字幕与 traversal 不能被覆盖或忽略。

Proves:
- 未知目录与不合法输入产生带阶段和 target 的失败并保留原文件；输出 junction 可读，Unicode 产物合法而路径逃逸被拒绝。
