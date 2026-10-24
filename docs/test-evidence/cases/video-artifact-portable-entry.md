### Case VIDEO-ARTIFACT-PORTABLE-ENTRY-001: 实际视频 zip 的双运行时公开入口

Tests:
- `test:1f74def202ab07140558c65235d62c61034888fa3c6d2fa9015425de1d09656f`

Tags:
- `video-understanding`

Contract:
- frozen 安装后的实际分发包可由 Node 与 Bun 从无关 cwd 运行，配置与证据保存在包外；只读与纯复用无需媒体环境，普通导入无 CLI 副作用。

Proves:
- 两种运行时在中文空格路径执行 help、read 与 prepare 纯复用；非法参数保留失败状态和 stderr，窄公开导入不执行 argv，分发文件、包外配置和原素材保持不变。fixture 清理以实际临时根核对目标，目录别名不改变其清理边界。
