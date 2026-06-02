# Backup de configuração do Termux — 01/06/2026
# Gerado antes da migração Play Store → F-Droid

## .bashrc

```bash
# ============================================================
# Workspace Mobile — Atalhos
# ============================================================
WS_BOOTSTRAP="/storage/emulated/0/Workspace/Scripts/bootstrap/03_start_services.sh"

alias ws='bash $WS_BOOTSTRAP'                   # Sobe tudo
alias ws-status='bash $WS_BOOTSTRAP --status'   # Checa saude
alias ws-restart='bash $WS_BOOTSTRAP --restart' # Reinicia tudo
alias ws-logs='tail -f /storage/emulated/0/Workspace/Logs/llama_server.log'
alias ws-agent='tail -f /storage/emulated/0/Workspace/Logs/agent.log'
alias ws-bot='tail -f /storage/emulated/0/Workspace/Logs/bot.log'
```

## Pacotes instalados (116 total)

Pacotes críticos para reinstalar no Termux F-Droid:

```bash
pkg update && pkg install -y \
  nodejs git python curl wget nano vim tmux \
  clang make binutils patch \
  openssh termux-api termux-am \
  llama-cpp \
  code-server \
  ripgrep net-tools procps
```

## Restaurar .bashrc

```bash
cat >> ~/.bashrc << 'EOF'
# ============================================================
# Workspace Mobile — Atalhos
# ============================================================
WS_BOOTSTRAP="/storage/emulated/0/Workspace/Scripts/bootstrap/03_start_services.sh"

alias ws='bash $WS_BOOTSTRAP'
alias ws-status='bash $WS_BOOTSTRAP --status'
alias ws-restart='bash $WS_BOOTSTRAP --restart'
alias ws-logs='tail -f /storage/emulated/0/Workspace/Logs/llama_server.log'
alias ws-agent='tail -f /storage/emulated/0/Workspace/Logs/agent.log'
alias ws-bot='tail -f /storage/emulated/0/Workspace/Logs/bot.log'
EOF
```

## Pós-instalação — subir serviços

```bash
termux-setup-storage
cd /storage/emulated/0/Workspace
bash Scripts/bootstrap/03_start_services.sh
```

## Verificação Termux:API funcionando

```bash
termux-battery-status  # deve retornar JSON
termux-wifi-connectioninfo  # deve retornar JSON (requer app F-Droid)
```
