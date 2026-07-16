# syntax=docker/dockerfile:1.7

# ===================================
# A股自选股智能分析系统 - Docker 镜像
# ===================================
# 多阶段构建：前端打包 + 后端运行
#
# 可用构建参数（国内构建加速，均可通过 --build-arg 覆盖）：
#   DOCKER_REGISTRY  — Docker Hub 镜像前缀，默认 DaoCloud 镜像
#   PYPI_INDEX_URL   — Python 包索引源，默认清华源
#   NPM_REGISTRY     — npm 包源，默认 npmmirror
#   APT_MIRROR       — Debian apt 源，留空则不替换
#
# 海外环境构建示例：
#   docker build --build-arg DOCKER_REGISTRY=docker.io \
#                --build-arg PYPI_INDEX_URL=https://pypi.org/simple \
#                --build-arg NPM_REGISTRY=https://registry.npmjs.org \
#                --build-arg APT_MIRROR= \
#                -f docker/Dockerfile -t dsa:latest .

# 默认使用国内镜像源加速构建；海外环境可通过 --build-arg 覆盖为官方源
ARG DOCKER_REGISTRY=docker.m.daocloud.io
ARG PYPI_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG APT_MIRROR=mirrors.tuna.tsinghua.edu.cn

FROM ${DOCKER_REGISTRY}/library/node:20-slim AS web-builder

ARG NPM_REGISTRY

WORKDIR /app/apps/dsa-web

COPY apps/dsa-web/package.json apps/dsa-web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set registry "${NPM_REGISTRY}" && \
    npm ci

COPY apps/dsa-web/ ./
RUN npm run build

# Pin to bookworm: wkhtmltopdf was removed from Debian testing (2025)
FROM ${DOCKER_REGISTRY}/library/python:3.11-slim-bookworm

ARG APT_MIRROR
ARG PYPI_INDEX_URL

# 设置工作目录
WORKDIR /app

# 设置时区为上海
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 替换 apt 源为国内镜像（仅在 APT_MIRROR 非空时执行）
RUN if [ -n "${APT_MIRROR}" ]; then \
        sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
        sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list 2>/dev/null || true; \
    fi

# 安装系统依赖（wkhtmltopdf 含 wkhtmltoimage，用于 Markdown 转图片 Issue #289）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    git \
    gosu \
    wkhtmltopdf \
    fontconfig \
    libjpeg62-turbo \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv（Rust 编写的极速 Python 包管理器，比 pip 快 10-100x）
# 通过 pip 从 PyPI 镜像源安装，避免依赖 ghcr.io（国内可能无法访问）
ENV PIP_INDEX_URL=${PYPI_INDEX_URL}
RUN pip install --no-cache-dir uv==0.11.21

# Docker 构建中 cache mount 与目标层不在同一文件系统，强制 copy 模式避免 hardlink 失败
ENV UV_LINK_MODE=copy
# 使用构建参数指定的 PyPI 镜像源（默认清华源）
ENV UV_INDEX_URL=${PYPI_INDEX_URL}

# 创建非 root 用户 (UID 1000)
RUN groupadd -g 1000 dsa && \
    useradd -u 1000 -g dsa -m dsa

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖（使用 uv 替代 pip，大幅加速依赖解析与安装）
# 分两步：先装 PyPI 包（可缓存），再装 git 依赖（易变，单独分层避免缓存失效）
RUN --mount=type=cache,target=/root/.cache/uv \
    grep -v '^git+' requirements.txt > /tmp/pypi-requirements.txt && \
    uv pip install --system -r /tmp/pypi-requirements.txt && \
    rm /tmp/pypi-requirements.txt

RUN --mount=type=cache,target=/root/.cache/uv \
    grep '^git+' requirements.txt | while IFS= read -r dep; do \
        [ -n "$dep" ] && uv pip install --system "$dep"; \
    done

# 复制应用代码
COPY *.py ./
COPY api/ ./api/
COPY data_provider/ ./data_provider/
COPY bot/ ./bot/
COPY src/ ./src/
COPY strategies/ ./strategies/
COPY --from=web-builder /app/static ./static/
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Verify the bundled AlphaSift adapter from requirements.
RUN python -c "import alphasift.dsa_adapter"

# 确保数据目录存在并授权给 non-root 用户
RUN mkdir -p /app/data /app/logs /app/reports && \
    chown -R dsa:dsa /app && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# efinance 将搜索缓存（search-cache.json）写入自身安装包内的 data 目录，
# 该目录默认归 root 所有；容器以非 root 用户 dsa 运行时写入会 PermissionError，
# 导致 efinance 数据源每次抓取 A 股数据都失败并降级。预置目录属主给 dsa 修复此问题。
# 动态解析路径，避免写死 Python 版本目录。
RUN EF_DATA_DIR="$(python -c 'import efinance, pathlib; print(pathlib.Path(efinance.__file__).parent / "data")')" && \
    mkdir -p "$EF_DATA_DIR" && \
    chown -R dsa:dsa "$EF_DATA_DIR"

# 设置环境变量默认值
ENV PYTHONUNBUFFERED=1
ENV LOG_DIR=/app/logs
ENV DATABASE_PATH=/app/data/stock_analysis.db
# Web/API service
ENV WEBUI_HOST=0.0.0.0
ENV API_PORT=8000

# 暴露 API 端口
EXPOSE 8000

# 数据卷（持久化数据）
VOLUME ["/app/data", "/app/logs", "/app/reports"]

# 健康检查（FastAPI 模式）
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || curl -f http://localhost:8000/health \
    || python -c "import sys; sys.exit(0)"

# 启动入口先修复 bind mount 目录权限，再降权为 dsa 执行应用；
# 文档化 docker-compose exec 命令需显式使用 -u dsa，避免手动进程写入 root-owned 文件。
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# 默认命令（可被覆盖）
CMD ["python", "main.py", "--schedule"]
