#!/bin/bash
rm -f *.vsix
npm i
npm run package
npx -y @vscode/vsce package
