# CLAUDE.md — 项目开发指引

## 项目概述

这是一个一比一复刻 Minecraft Java Edition 的浏览器游戏项目。
- **技术栈**: React 18 + TypeScript + Vite 4 + Three.js (WebGL)
- **部署**: GitHub Pages (`npm run build` → `dist/`)
- **仓库**: `origin` → `https://github.com/rushairer/mc.git`，主分支 `master`

## 开发规范

### 开发路线图

**所有开发工作必须按照 `docs/DEVELOPMENT_ROADMAP.md` 中的分阶段计划进行。**

1. 每次开发前，先阅读 `docs/DEVELOPMENT_ROADMAP.md` 确认当前阶段和待办任务
2. 从当前阶段的下一个未完成任务（⬜）开始开发
3. 完成任务后，将该任务状态从 ⬜ 改为 ✅
4. 更新 `DEVELOPMENT_ROADMAP.md` 顶部的完成度表格
5. 更新底部的"进度记录"表格

### 提交规范

- 每完成一个功能点即提交（小步提交）
- 提交信息格式: `feat: <功能描述>` / `fix: <修复描述>` / `refactor: <重构描述>`
- 每次提交前确保 `npm run build` 通过
- 提交后推送到 `origin/master`
- 每个阶段（Stage）完成后，在进度记录中添加一行

### 代码规范

- TypeScript 严格模式
- 不添加自动化测试（当前阶段）
- 新方块：注册到 `BlockRegistry.ts` + 纹理到 `TextureAtlas.ts` + 特殊渲染到 `Chunk.ts`
- 新物品：注册到 `ItemRegistry.ts` + 配方到 `CraftingRecipes.ts` / `SmeltingRecipes.ts`
- 新生物：在 `MobSystem.ts` 中定义 + `Mob.ts` 中建模
- 新系统：创建独立文件到 `src/systems/` 目录
- UI 组件：React 组件放到 `src/ui/` 目录

### 当前阶段

**阶段 4: 渲染与体验** — 参见 `docs/DEVELOPMENT_ROADMAP.md` 阶段 4 详细任务列表

### 重要提示

- 不要跳过阶段，按顺序推进
- 每个功能完成后更新 ROADMAP 文档中的状态
- Game.ts 是主循环入口，新系统通过 Game.ts 编排调用
- 所有纹理是程序化生成的（`TextureAtlas.ts` 中 `drawTile()`），不使用外部资源文件
- 所有音效是 Web Audio API 合成的（`SoundSystem.ts`），不使用外部音频文件
- 存档使用 IndexedDB（`SaveSystem.ts`），新数据需要兼容旧存档
