Write-Host "Starting Build Process for Antigravity Proxy..." -ForegroundColor Cyan

# Remove old VSIX files
Get-ChildItem *.vsix | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "Cleaned up old VSIX files." -ForegroundColor Green

# Install dependencies (ensure everything is fresh)
Write-Host "Installing/Updating dependencies..." -ForegroundColor Yellow
npm install

# Build the code (compile TS -> JS via esbuild)
Write-Host "Compiling and Bundling..." -ForegroundColor Yellow
npm run package

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

# Package using vsce
Write-Host "Creating VSIX package..." -ForegroundColor Yellow
# Use npx to avoid requiring global vsce installation
npx -y @vscode/vsce package

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build Complete! VSIX file is ready." -ForegroundColor Green
} else {
    Write-Error "Packaging failed!"
}
