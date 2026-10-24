### Case VIDEO-QUERY-WINDOW-001: 读取窗口末端归一有界且可见

Tests:
- `test:54e2293fe5a2d559e6ba7fab632a78cc58c1d1e25ebfc032de51a8f3aeb5b265`
- `test:b95d957918643ef94227716484c3262bcb1ed93e09bc9715059adee0b2b3f614`
- `test:ff3070c1245324697a3a0c3df55ec577aad239176a50009472ee4229305ba70c`

Tags:
- `video-understanding`

Contract:
- 读取仅容忍规定范围内的末端舍入误差，并在结果中返回归一上下文；真正越界或归一后空窗口须失败。

Proves:
- 容许值与精确窗口读取一致且不改证据；JSON 和文本均显示归一事实，失败提供请求值、时长和恢复提示。
