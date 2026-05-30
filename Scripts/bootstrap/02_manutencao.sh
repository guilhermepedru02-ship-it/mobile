#!/bin/bash
# Protocolos Práticos de Manutenção

echo "Limpando cache do NPM para liberar espaço na RAM e Storage..."
npm cache clean --force
echo "Cache limpo."

echo ""
echo "Dica Operacional:"
echo "Para persistência da sessão no terminal (manter code-server e scripts rodando mesmo se o Termux for minimizado), inicie uma sessão tmux digitando:"
echo "tmux"
echo "Para sair da sessão sem fechá-la: Pressione Ctrl+B e depois a tecla D."
echo "Para voltar para a sessão: tmux attach"
