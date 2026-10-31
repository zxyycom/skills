### Case VIDEO-QUERY-WINDOW-001: 读取窗口末端归一有界且可见

Tests:
- `test:6109aef8a026319ecbbb9f9562b04bf6ea67ddae839b803255d58e17c2c7ee87`
- `test:b0f74c8c269863ed0691f8d7836c2dc83751bf4c50ffefa11599b8c339716c63`
- `test:e696485a22e2e0fec6d53783e8eb4a70b5bcefddcbcbb071a18f129f934b9a95`

Tags:
- `video-understanding`

Contract:
- 读取仅容忍规定范围内的末端舍入误差，并在结果中返回归一上下文；真正越界或归一后空窗口须失败。

Proves:
- 容许值与精确窗口读取一致且不改证据；JSON 和文本均显示归一事实，失败提供请求值、时长和恢复提示。
