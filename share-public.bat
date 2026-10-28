@echo off
title CommunityFouchena - Public Cloudflare Tunnel
echo ========================================================
echo   CommunityFouchena - Public Live Tunnel
echo ========================================================
echo Starting Cloudflare secure tunnel on port 3001...
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3001
pause
