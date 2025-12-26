rm *.vsix -ErrorAction SilentlyContinue
npm i
npm run package
npx -y @vscode/vsce package
