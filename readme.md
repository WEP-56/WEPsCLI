# WEPsCodingCLI

`WEPsCodingCLI` 是一个本地开发工作区，核心目标是在 `agents-core/packages/wepscli` 上持续构建一个 TUI-first 的 coding agent CLI，并逐步把 shell、runtime、审批、中断、会话等能力接到真实共享 runtime。

当前仓库不是一个“纯净的单包项目”，而是一个围绕 `wepscli` 的研发工作区，包含：

- `agents-core/`
  基于 `pi` monorepo 的共享能力层，里面有 `ai`、`agent`、`coding-agent`、`wepscli` 等 package。
- `agents-core/packages/wepscli/`
  当前主开发目标，新的 WEPSCLI TUI 壳和运行时接线都在这里。
- `CLI/tui-learning/`
  用来参考和学习的 TUI 项目与实验目录。
- `docs/`
  项目文档目录。
- `TODO.md`
  当前分阶段路线图。

## 当前进度

根据当前工作区进展，已经推进到：

- P1: tool 执行主链路
- P2: 审批 / 权限交互
- P3: 中断 / 重试 / 错误恢复的最小闭环

后续阶段请直接看 [`TODO.md`](./TODO.md)。

## 目录结构

```text
WEPsCodingCLI/
├─ agents-core/
│  ├─ packages/
│  │  ├─ agent/
│  │  ├─ ai/
│  │  ├─ coding-agent/
│  │  └─ wepscli/
├─ CLI/
│  └─ tui-learning/
├─ docs/
├─ TODO.md
├─ LICENSE
├─ .gitignore
└─ readme.md
```

## 本地开发

建议环境：

- Node.js 20+
- npm
- Windows PowerShell（当前工作区主要在 Windows 下开发）

### 安装依赖

```powershell
cd D:\WEPsCodingCLI\agents-core
npm install
```

### 构建共享工作区

```powershell
cd D:\WEPsCodingCLI\agents-core
npm run build
```

### 运行 WEPSCLI

```powershell
cd D:\WEPsCodingCLI\agents-core\packages\wepscli
npm run shell
```

### 仅构建 wepscli

```powershell
cd D:\WEPsCodingCLI\agents-core\packages\wepscli
node ./scripts/build.mjs
npx tsc -p tsconfig.build.json --noEmit
```

## 仓库说明

- 这个仓库包含本地实验目录和参考目录，不只是最终产品代码。
- `agents-core/` 中保留了共享 runtime 与上游结构；`wepscli` 是当前主要定制开发点。
- 上传 GitHub 时，建议只提交源码、文档、必要锁文件和配置，不提交 `node_modules`、`dist`、本地 agent 状态目录。

## 致谢

- 本项目的共享基础能力与部分结构来源于 [badlogic/pi-mono](https://github.com/badlogic/pi-mono)。
- `agents-core/` 中保留了对应上游代码与许可证信息，详见 `agents-core/LICENSE`。

## 备注

如果后续要公开发布，建议再补：

- 更明确的 upstream / fork 来源说明
- GitHub Releases / 使用截图
- 安装方式与常见问题
