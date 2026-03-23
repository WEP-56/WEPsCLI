# WEPS Desktop 接手文档

## 1. 当前状态

`wepsdesktop` 已经从“纯壳子”推进到“可启动、可选工作区、可创建 provider、可创建/打开 session、可发送 prompt”的状态。

当前已打通的能力：

- Electron 窗口可启动。
- `dev` 模式会自动打开 DevTools。
- 首屏不是直接聊天，而是先做 workspace 启动流。
- recent workspaces 已接入主进程持久化。
- provider profiles 不再由 renderer 本地临时维护，而是复用 `wepscli` 的共享服务。
- session metadata 不再由 renderer 本地临时维护，而是复用 `wepscli` 的共享服务。
- session metadata 已按 `workspacePath` 分组。
- 桌面端 runtime 已开始使用 `@mariozechner/pi-coding-agent` 的 `createAgentSession + SessionManager.create/open`。
- `runtimeSessionFile` 已接入并回写到共享 session metadata。

当前还没有完整打通的能力：

- 审批流目前只有 bridge 形状，未真正接入主进程可交互审批状态机。
- 工具消息展示是简化版 transcript，不是 `WEPSCLI-shell` 的完整 tool UI。
- 还没有把 `wepscli` 的全部 slash command / overlay / mode layer 带到 desktop。
- 还没有做 Electron 打包发布脚本，当前重点仍是可行性验证和架构地基。

## 2. 当前运行方式

包目录：

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop`

开发启动：

```bash
cd D:/WEPsCodingCLI/agents-core/packages/wepsdesktop
npm run dev
```

包内静态检查：

```bash
cd D:/WEPsCodingCLI/agents-core/packages/wepsdesktop
npm run check
```

注意：

- 不要为了 desktop 改动直接跑根级 `D:\WEPsCodingCLI\agents-core\package.json` 里的 `npm run check`，因为它会执行 `biome check --write .`，会把整个 `agents-core` 仓库都写一遍。
- 目前开发验证应优先用 `wepsdesktop` 包内的 `npm run check`。

## 3. 入口文件

### Electron 主进程

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\src\main\index.ts`

职责：

- 创建 BrowserWindow
- 开发模式自动打开 DevTools
- 注册 IPC handler
- 在 handler 注册完之后再加载 renderer
- 管理外链打开、工作区选择对话框

关键修复点：

- `dev` 模式必须读取 `process.env.ELECTRON_RENDERER_URL`
- preload 实际产物是 `out/preload/index.mjs`
- IPC 必须先注册，再 `loadURL/loadFile`

### 主进程控制器

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\src\main\desktop-controller.ts`

这是当前 desktop 的核心。

职责：

- 管理当前 workspace
- 管理 recent workspaces
- 复用 `wepscli` 的 provider profile 服务
- 复用 `wepscli` 的 session history 服务
- 创建和维护 `pi-coding-agent` runtime session
- 将 runtime 状态转成 renderer 可消费的 snapshot

### Workspace 持久化

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\src\main\workspace-store.ts`

职责：

- 记录 `currentWorkspacePath`
- 记录 `recentWorkspaces`

### Preload

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\src\preload\index.ts`

职责：

- 暴露 `window.wepsDesktop`
- 封装 IPC
- 提供 snapshot 订阅

### Bridge 类型

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\src\shared\bridge.ts`

职责：

- 定义主进程和 renderer 间的 IPC channel 常量
- 定义 `DesktopSnapshot`
- 定义 provider/session/runtime 的桥接数据结构

### Renderer 入口

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\renderer\main.ts`

职责：

- 首次调用 `getSnapshot()`
- 订阅 `snapshotUpdated`
- 渲染 workspace 选择页
- 渲染主 desktop shell
- 调用 bridge 创建 provider / 创建 session / 发 prompt / 切换 session

### Renderer 样式

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\renderer\app.css`

职责：

- 启动页
- 主 shell
- provider 表单
- session 列表
- transcript
- composer

### Electron Vite 配置

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\electron.vite.config.ts`

关键点：

- renderer root 显式指向 `renderer`
- `rollupOptions.input` 显式指向 `renderer/index.html`

## 4. 当前复用的共享服务

### 来自 wepscli

Provider 服务：

- `D:\WEPsCodingCLI\agents-core\packages\wepscli\src\provider-profiles\provider-profile-service.ts`

Session metadata 服务：

- `D:\WEPsCodingCLI\agents-core\packages\wepscli\src\session-history\session-history-service.ts`

本次为了 desktop 做的共享增强：

- `ShellSessionRecord` 新增了 `workspacePath`
- `SessionHistoryService.listSessions()` 现在支持按 workspace 过滤
- `SessionHistoryService` 新增了 `getSession()`
- `wepscli` 入口新增导出：
  - `D:\WEPsCodingCLI\agents-core\packages\wepscli\src\index.ts`

### 来自 pi-coding-agent

当前 desktop runtime 绑定走的是：

- `AuthStorage`
- `ModelRegistry`
- `SessionManager`
- `SettingsManager`
- `createAgentSession`

相关参考：

- `D:\WEPsCodingCLI\agents-core\packages\coding-agent\src\index.ts`
- `D:\WEPsCodingCLI\agents-core\packages\coding-agent\src\core\sdk.ts`
- `D:\WEPsCodingCLI\agents-core\packages\coding-agent\src\core\session-manager.ts`
- `D:\WEPsCodingCLI\agents-core\packages\coding-agent\src\core\model-registry.ts`

## 5. 当前数据流

### Workspace 启动流

1. renderer 调用 `window.wepsDesktop.getSnapshot()`
2. 若没有 `currentWorkspacePath`，显示 workspace launcher
3. renderer 调用 `chooseWorkspaceDirectory()`
4. 主进程选择目录后调用 `activateWorkspace(workspacePath)`
5. controller 记录 recent workspace，并尝试加载该 workspace 下最近的 session

### Provider / session 共享流

1. renderer 创建 provider
2. bridge 调到主进程 controller
3. controller 调用 `ProviderProfileService`
4. provider profile 写入共享 `wepscli` agent dir
5. snapshot 回推 renderer

session metadata 同理，写入共享 `sessions.json`

### Runtime 绑定流

1. 打开或创建 session
2. controller 根据 `workspacePath + runtimeSessionFile + active provider/model` 创建 `AgentSession`
3. 若 session 已有 `runtimeSessionFile`，则 `SessionManager.open(...)`
4. 否则 `SessionManager.create(...)`
5. 新得到的 `runtimeSessionFile` 会写回 `SessionHistoryService`

这就是当前“开始对接 wepscli runtime binding”的落点。

## 6. 当前版本 / 发布策略

现在已经拆成独立轨道：

- core `@mariozechner/*`：lockstep
- `wepscli`：独立版本，单独 npm 发布
- `wepsdesktop`：独立版本，不进 npm 发布链

相关脚本入口：

- `D:\WEPsCodingCLI\agents-core\package.json`
- `D:\WEPsCodingCLI\agents-core\scripts\package-groups.mjs`
- `D:\WEPsCodingCLI\agents-core\scripts\version-workspace-group.mjs`
- `D:\WEPsCodingCLI\agents-core\scripts\publish-workspace-group.mjs`
- `D:\WEPsCodingCLI\agents-core\scripts\sync-versions.js`

有用的命令：

- `npm run desktop:check`
- `npm run desktop:build`
- `npm run desktop:release:prepare`
- `npm run desktop:version:patch`
- `npm run cli:publish`

## 7. 已知问题 / 风险

### 1. 审批流未完成

`bridge.ts` 里保留了审批相关类型与 channel，但当前 controller 还没有真正生成 `pendingApproval`。

当前状态：

- renderer UI 已有 `renderApprovalBanner()`
- preload/main 已有 `resolveApproval(...)`
- 但主进程 runtime 还没有将工具调用审批事件转成 snapshot 状态

### 2. transcript 是桌面定制简化版

当前 transcript 由 `desktop-controller.ts` 的 `buildTranscript()` 直接从 `AgentMessage[]` 构造。

优点：

- 不依赖 `WEPSCLI-shell` 的 TSX 类型链
- 更容易先跑通桌面端

代价：

- 工具消息、思考块、diff 呈现还比较简化

### 3. 当前仍未做独立 desktop release 流

现在只做了版本/发布轨道隔离，还没有做：

- GitHub Release 产物生成
- Electron 打包脚本
- 更新策略

## 8. 优先建议的下一步

### 第一优先级

把主进程 runtime 的工具调用事件接成真正的审批状态机。

目标：

- 生成 `pendingApproval`
- renderer 显示审批条
- 用户 allow/reject/cancel 后继续 runtime

### 第二优先级

补桌面端 provider profile 管理能力：

- 编辑 profile
- 删除 profile
- 显示 validation 状态
- 手动 refresh models

### 第三优先级

提升 transcript/tool UI：

- 更完整地映射 tool result
- 展示 reasoning block
- 展示文件改动摘要

### 第四优先级

再考虑是否抽真正共享的 `weps-core / weps-app-core`

当前已经有共享服务雏形，但还没有独立包。

## 9. 快速排错提示

如果 `npm run dev` 再次出白屏，优先看这些点：

### preload 没加载

检查：

- `D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\src\main\index.ts`

确认：

- `preloadPath` 指向 `out/preload/index.mjs`

### dev server 没被主进程使用

检查：

- 是否读取的是 `process.env.ELECTRON_RENDERER_URL`

不要再读：

- `VITE_DEV_SERVER_URL`

### IPC 竞态

检查：

- 是否在 `loadURL/loadFile` 之前就注册了 `ipcMain.handle(...)`

### renderer 空白但无窗口错误

优先查看：

- DevTools Console
- `window.wepsDesktop` 是否存在
- `getSnapshot()` 是否抛错

## 10. 当前一句话总结

`wepsdesktop` 现在已经不是 demo 页面，而是一个“以 workspace 为入口、以 wepscli 共享 provider/session 服务为元数据层、以 pi-coding-agent 为 runtime binding”的 Electron 先行版。
