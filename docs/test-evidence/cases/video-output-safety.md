### Case VIDEO-OUTPUT-SAFETY-001: 证据输出不覆盖未知目录或逃逸路径

Tests:
- `test:3486067f2f92eca4184255f23ce784ef68a63aaba33b9ebc5375d6931f4fd80d`
- `test:9309a374d1817853833046af7605ec4eba97023589c4a54fcf287390ce6c5fbd`
- `test:d74498158d6bab275fd88ea82b3649de69e31b59f243c7c6bf97e71c429502b3`
- `test:dbff72f666b01940172689ca33f6611d0c4185eff1c788c7ca48fcb79f898d9b`

Tags:
- `video-understanding`

Contract:
- 输出须是明确的本地证据目录；未知内容、无效父目录、非文件字幕与 traversal 不能被覆盖或忽略。

Proves:
- 未知目录与不合法输入产生带阶段和 target 的失败并保留原文件；输出 junction 可读，Unicode 产物合法而路径逃逸被拒绝。
