#!/data/data/com.termux/files/usr/bin/bash
# =============================================================
# 00_zram_setup.sh — Ativar zRAM no Android via Termux
# Objetivo: ampliar memória disponível com swap comprimido
# Hardware-alvo: Android 3.7GB RAM, Chronos Local / Qwen 0.5B
# Autor: Chronos Local + Claude Sonnet 4.6 · 2026-05-30
# =============================================================
# IMPORTANTE: Este script requer ROOT para acessar /proc/sys/vm
# Se o dispositivo não tiver root, use a ALTERNATIVA SWAPFILE.
# =============================================================

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  [OK]${NC} $1"; }
warn() { echo -e "${YELLOW}  [!!]${NC} $1"; }
fail() { echo -e "${RED}  [XX]${NC} $1"; }
info() { echo -e "  [..] $1"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  zRAM Setup — Workspace Mobile"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── DIAGNÓSTICO INICIAL ──────────────────────────────────────
echo ""
info "Estado atual da memória:"
free -h
echo ""
info "Swap atual:"
swapon --show 2>/dev/null || echo "  (nenhum swap ativo)"

# ── VERIFICA SUPORTE A ZRAM ──────────────────────────────────
echo ""
info "Verificando suporte a zRAM no kernel..."

if [ -d "/sys/block/zram0" ]; then
  ok "zRAM detectado: /sys/block/zram0 existe"
  ZRAM_SUPPORTED=true
else
  warn "zRAM nativo não detectado em /sys/block/zram0"
  ZRAM_SUPPORTED=false
fi

# ── VERIFICA ROOT ────────────────────────────────────────────
if command -v su &> /dev/null && su -c 'echo ok' 2>/dev/null | grep -q ok; then
  HAS_ROOT=true
  ok "Root disponível"
else
  HAS_ROOT=false
  warn "Root NÃO disponível — zRAM nativo não pode ser configurado"
fi

# ── CAMINHO 1: zRAM NATIVO COM ROOT ─────────────────────────
if [ "$ZRAM_SUPPORTED" = true ] && [ "$HAS_ROOT" = true ]; then
  echo ""
  info "Configurando zRAM nativo..."

  # Tamanho: 1GB (ideal para 3.7GB RAM com llama-server)
  ZRAM_SIZE=$((1 * 1024 * 1024 * 1024))  # 1GB em bytes
  ZRAM_DEV="/dev/block/zram0"

  # Garante que não há swap ativo no zram0
  su -c "swapoff $ZRAM_DEV 2>/dev/null; true"

  # Reset e configuração
  su -c "echo 1 > /sys/block/zram0/reset"
  su -c "echo lz4 > /sys/block/zram0/comp_algorithm 2>/dev/null || echo lzo > /sys/block/zram0/comp_algorithm"
  su -c "echo $ZRAM_SIZE > /sys/block/zram0/disksize"

  # Formata e ativa como swap
  su -c "mkswap $ZRAM_DEV"
  su -c "swapon -p 100 $ZRAM_DEV"

  echo ""
  ok "zRAM ativado! Estado do swap:"
  swapon --show
  echo ""
  free -h
  echo ""
  ok "✅ zRAM 1GB ativo com prioridade 100"
  echo "  Algoritmo: lz4 (ou lzo como fallback)"
  echo "  Efeito: ~1GB extra de memória comprimida disponível para o llama-server"

# ── CAMINHO 2: SWAPFILE VIA TERMUX (SEM ROOT) ────────────────
else
  echo ""
  warn "Usando ALTERNATIVA: Swapfile via Termux (sem root)"
  echo ""
  info "O Termux suporta criação de swapfile leve via 'swapspace' ou arquivo manual."
  echo ""

  # Verifica se termux-tools tem swap
  if command -v swapon &> /dev/null; then
    SWAP_FILE="/data/data/com.termux/files/home/.swapfile"
    SWAP_SIZE_MB=512  # 512MB — seguro para armazenamento interno

    if [ -f "$SWAP_FILE" ]; then
      warn "Swapfile já existe em $SWAP_FILE"
      info "Ativando swap existente..."
      swapon "$SWAP_FILE" 2>/dev/null && ok "Swap reativado!" || warn "Já estava ativo ou erro"
    else
      info "Criando swapfile de ${SWAP_SIZE_MB}MB..."
      dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$SWAP_SIZE_MB 2>/dev/null
      chmod 600 "$SWAP_FILE"
      mkswap "$SWAP_FILE"
      swapon "$SWAP_FILE" && ok "Swapfile de ${SWAP_SIZE_MB}MB ativado em $SWAP_FILE" || fail "Falha ao ativar swapfile"
    fi

    echo ""
    info "Estado do swap:"
    swapon --show
    echo ""
    free -h

  else
    fail "swapon não disponível no Termux."
    echo ""
    echo "  📋 INSTRUÇÕES MANUAIS para ativar zRAM:"
    echo ""
    echo "  OPÇÃO A — App sem root (recomendado):"
    echo "    1. Instale 'Swap No Root' na Play Store"
    echo "    2. Configure 512MB ou 1GB de swap"
    echo "    3. Ative antes de rodar o llama-server"
    echo ""
    echo "  OPÇÃO B — Via ADB (sem root, PC necessário):"
    echo "    adb shell 'echo 0 > /proc/sys/vm/swappiness'"
    echo "    (Isso não ativa swap mas melhora uso de RAM)"
    echo ""
    echo "  OPÇÃO C — Root + Magisk Module:"
    echo "    Módulo 'zRAM Enabler' disponível no Magisk repo"
    echo "    Ativa zRAM permanente no boot"
  fi
fi

# ── AJUSTE DE SWAPPINESS ─────────────────────────────────────
echo ""
info "Verificando swappiness atual..."
CURRENT_SWAP=$(cat /proc/sys/vm/swappiness 2>/dev/null || echo 'N/A')
echo "  swappiness atual: $CURRENT_SWAP (ideal para llama-server: 10-30)"

if [ "$HAS_ROOT" = true ]; then
  su -c "echo 20 > /proc/sys/vm/swappiness"
  ok "swappiness ajustado para 20 (otimizado para 3.7GB RAM + IA local)"
else
  warn "Sem root — swappiness não pode ser alterado (mantido em $CURRENT_SWAP)"
fi

# ── RELATÓRIO FINAL ──────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Resumo zRAM Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
free -h
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  💡 Para ativar o swap toda vez que iniciar o Termux,"
echo "  adicione ao ~/.bashrc:"
if [ "$HAS_ROOT" = true ] && [ "$ZRAM_SUPPORTED" = true ]; then
  echo "  swapon /dev/block/zram0 2>/dev/null"
else
  echo "  swapon ~/.swapfile 2>/dev/null"
fi
echo ""
