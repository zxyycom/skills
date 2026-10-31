### Case LIGHTWEIGHT-JUDGMENT-CLI-022: 超时记录不被迟到响应改写

Tests:
- `test:9d64d00a01aefbc14da7f35cd8c8065d20ddb8e91c91fe07fb99415669700a49`

Tags:
- `lightweight-judgment`

Contract:
- 超时调用保存远端结果不确定状态；已退出的等待不继续更新日志或触发重发。

Proves:
- mock fetch 超时后返回 timeout/3，数据库为 indeterminate 且无正文；随后交付有效响应并经过事件循环，记录仍与超时完成时完全相同，fetch 仅调用一次。
