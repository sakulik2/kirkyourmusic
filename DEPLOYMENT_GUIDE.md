# kym (Kirk Your Music) - Deployment & Git Guide

为了安全地将项目提交到 GitHub 并托管到 Vercel，请遵循以下步骤：

## 1. 确保安全 (.gitignore)
我们绝不能将包含 API Key 的 `.env.local` 提交到 GitHub。Next.js 默认已经配置好了 `.gitignore`，请确认文件中包含以下内容：

```text
# local env files
.env*.local
```

## 2. 提交到 GitHub
在您的本地终端（项目根目录 `e:/code/kirkyourmusic`）运行以下命令：

```powershell
# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交更改
git commit -m "feat: Initial release of kym with Nano Banana integration"

# 在 GitHub 上创建一个新仓库，然后关联远程地址
git remote add origin https://github.com/您的用户名/kym.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

## 3. 在 Vercel 中部署
1. 登录 [Vercel](https://vercel.com/) 并点击 **"Add New" -> "Project"**。
2. 导入您的 `kym` 仓库。
3. **关键步骤**：在 "Environment Variables"（环境变量）部分，添加以下键值对：
   - **Key**: `OPENROUTER_API_KEY`
   - **Value**: `您的 OpenRouter API Key`
4. 点击 **"Deploy"**。

## 4. 验证服务
部署完成后，访问 Vercel 提供的 URL。上传一张图片，后端将通过 Vercel Serverless Function 安全地调用 OpenRouter，而不会暴露您的 API Key。
