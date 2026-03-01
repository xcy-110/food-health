#!/bin/bash
# ============================================
# 食光机 - GitHub Pages 一键部署脚本
# 使用方法: 在 d:\XGT-0 目录下执行 bash deploy.sh
# ============================================

set -e

export PATH="$PATH:/c/Program Files/GitHub CLI:/c/Program Files (x86)/GitHub CLI"

REPO_NAME="food-health"

echo "=============================="
echo "  食光机 GitHub Pages 部署"
echo "=============================="
echo ""

# 1. 检查 gh 登录状态
echo "[1/5] 检查 GitHub 登录状态..."
if ! gh auth status &>/dev/null; then
    echo "  未登录 GitHub，正在启动登录..."
    gh auth login -p https -w
fi

# 获取用户名
GH_USER=$(gh api user -q '.login')
echo "  已登录: $GH_USER"
echo ""

# 2. 创建仓库
echo "[2/5] 创建 GitHub 仓库: $REPO_NAME ..."
if gh repo view "$GH_USER/$REPO_NAME" &>/dev/null; then
    echo "  仓库已存在，跳过创建"
else
    gh repo create "$REPO_NAME" --public --description "食光机 - AI智能食品健康助手" --source . --push
    echo "  仓库创建成功"
fi
echo ""

# 3. 推送代码
echo "[3/5] 推送代码..."
if ! git remote get-url origin &>/dev/null; then
    git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
fi
git branch -M main
git push -u origin main
echo "  代码推送成功"
echo ""

# 4. 启用 GitHub Pages
echo "[4/5] 启用 GitHub Pages..."
gh api -X POST "repos/$GH_USER/$REPO_NAME/pages" \
    -f source='{"branch":"main","path":"/"}' \
    --input - <<< '{"source":{"branch":"main","path":"/"}}' 2>/dev/null || \
gh api -X PUT "repos/$GH_USER/$REPO_NAME/pages" \
    --input - <<< '{"source":{"branch":"main","path":"/"}}' 2>/dev/null || \
echo "  (GitHub Pages 可能已启用，或需要在仓库 Settings 中手动开启)"
echo ""

# 5. 更新 SEO 链接
PAGES_URL="https://$GH_USER.github.io/$REPO_NAME"
echo "[5/5] 更新 SEO 链接为: $PAGES_URL ..."

# 替换 canonical 和 sitemap 中的占位域名
sed -i "s|https://example.com|$PAGES_URL|g" index.html chat.html robots.txt sitemap.xml 2>/dev/null || true

# 提交更新
if ! git diff --quiet 2>/dev/null; then
    git add -A
    git commit -m "更新 SEO 链接为 GitHub Pages 地址"
    git push
    echo "  SEO 链接已更新并推送"
fi
echo ""

echo "=============================="
echo "  部署完成!"
echo "=============================="
echo ""
echo "  首页: $PAGES_URL/"
echo "  AI助手: $PAGES_URL/chat.html"
echo ""
echo "  注意: GitHub Pages 部署需要 1-2 分钟生效"
echo "=============================="
