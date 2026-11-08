#!/usr/bin/env bash
# 바뀐 파일이 발표 파일(live-demo · scene-motion · d03-motion · demo-media/)뿐이면 CRM 시험을 건너뛴다(#680).
# 2026-11-08 Quality Gate 를 여러 컴퓨터로 나누면서 각 작업이 같은 판단을 쓰도록 이 파일로 옮김. 결과는 GITHUB_OUTPUT 의 deck_only.
set -u
deck_only=false
parent=$(git rev-parse HEAD^1 2>/dev/null || true)
if [ -n "$parent" ] && { [ "${EVENT:-}" = "pull_request" ] || { [ "${EVENT:-}" = "push" ] && [ "${BEFORE:-}" = "$parent" ]; }; }; then
  files=$(git diff --name-only "$parent" HEAD)
  echo "$files"
  if [ -n "$files" ] && ! printf '%s\n' "$files" | grep -qvE '^(live-demo\.html|scene-motion\.html|d03-motion\.html|demo-media/.+)$'; then
    deck_only=true
    echo "발표 파일만 바뀌어 CRM 시험을 건너뜁니다."
  fi
fi
echo "deck_only=$deck_only" >> "${GITHUB_OUTPUT:-/dev/null}"
