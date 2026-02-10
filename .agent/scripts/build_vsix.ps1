# Copyright by AcmaTvirus
# Script để build VSIX cho Antigravity Agent

$projectRoot = "c:\Users\Administrator\Desktop\antigravity-agent"
Set-Location -Path $projectRoot

Write-Host "Đang kiểm tra dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Đang biên dịch mã nguồn..." -ForegroundColor Cyan
npm run compile

Write-Host "Đang đóng gói VSIX..." -ForegroundColor Cyan
# Sử dụng npx để chạy vsce package
npx @vscode/vsce package --out $projectRoot\antigravity-agent-1.0.0.vsix

Write-Host "Hoàn tất! File VSIX đã được tạo tại: $projectRoot\antigravity-agent-1.0.0.vsix" -ForegroundColor Green
