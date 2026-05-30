#!/bin/bash
echo "Iniciando provisionamento do Workspace Operacional..."

# Requisita permissão de storage (o app vai pedir confirmação na tela)
echo "Requisitando storage. Por favor, permita o acesso na tela do celular."
termux-setup-storage
sleep 2

# Atualiza os pacotes
echo "Atualizando repositórios e pacotes do Termux..."
pkg update && pkg upgrade -y

# Instala ferramentas essenciais (adicionados vim, nano, wget, curl, tmux para melhor desempenho operacional)
echo "Instalando Node.js, Python, Java, C/C++ e ferramentas utilitárias..."
pkg install nodejs git python openjdk-17 clang make binutils vim nano wget curl tmux -y

# Instala IDE Code-Server
echo "Instalando IDE code-server globalmente..."
npm install -g code-server

echo "Provisionamento finalizado! Para iniciar o code-server, use:"
echo "code-server --bind-addr 127.0.0.1:8080"
