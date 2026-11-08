### Case NATIVE-CI-WINDOWS-LOCK-EVIDENCE-001: Windows 占用错误证据筛选

Tests:
- `test:3e273d0cf00b78d6c9bcf9e4d80cac541b068102636ee188a0c7db10ab4b26d7`

Tags:
- `repository-tooling`

Contract:
- 私有 Windows 占用验收只能把目标可执行文件实际发生的访问或共享错误作为预期失败；其他路径或无关错误不得冒充此证据。

Proves:
- 合成嵌套错误链中，目标文件的受支持访问错误被识别；无关路径、代码或缺少错误事实被拒绝。此测试不创建 Windows 文件占用，不证明操作系统或 updater 恢复；实际效果须由目标平台 CI 验证。
