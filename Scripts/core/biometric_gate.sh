#!/data/data/com.termux/files/usr/bin/bash
# biometric_gate.sh — Gate biométrico para operações críticas do Chronos
# Versão: 1.0.0 · Data: 2026-06-09 · TASK-0609-C
#
# Uso:
#   ./biometric_gate.sh "operacao_descricao"
#   Ex: ./biometric_gate.sh "git push para GitHub"
#
# Retorno:
#   0 = autorizado (AUTH_RESULT_SUCCESS)
#   1 = negado ou cancelado
#   2 = erro (termux-api indisponível)

OPERATION="${1:-Autorizar operação}"
LOG_FILE="/storage/emulated/0/Workspace/Logs/android-bridge-audit.log"
TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S')

# Garantir que o diretório de logs existe
mkdir -p /storage/emulated/0/Workspace/Logs

# Verificar se termux-fingerprint está disponível
if ! command -v termux-fingerprint &> /dev/null; then
  echo "[BIOMETRIC] ERROR: termux-fingerprint não encontrado. Instale o Termux:API." >&2
  echo "$TIMESTAMP | BIOMETRIC | UNAVAILABLE | $OPERATION | ERROR_NO_API" >> "$LOG_FILE"
  exit 2
fi

# Solicitar autenticação biométrica
RESULT=$(termux-fingerprint -t "Chronos: $OPERATION" 2>/dev/null)

# Verificar resultado
if echo "$RESULT" | grep -q 'AUTH_RESULT_SUCCESS'; then
  echo "[BIOMETRIC] ✅ AUTORIZADO: $OPERATION"
  echo "$TIMESTAMP | BIOMETRIC | GRANT | $OPERATION | AUTH_RESULT_SUCCESS" >> "$LOG_FILE"
  exit 0
elif echo "$RESULT" | grep -q 'AUTH_RESULT_FAILURE\|AUTH_RESULT_FAILURE'; then
  echo "[BIOMETRIC] ❌ NEGADO: $OPERATION" >&2
  echo "$TIMESTAMP | BIOMETRIC | DENY | $OPERATION | AUTH_RESULT_FAILURE" >> "$LOG_FILE"
  exit 1
elif echo "$RESULT" | grep -q 'AUTH_RESULT_UNKNOWN\|canceled\|CANCELED'; then
  echo "[BIOMETRIC] ⚠️ CANCELADO: $OPERATION" >&2
  echo "$TIMESTAMP | BIOMETRIC | DENY | $OPERATION | AUTH_RESULT_CANCELED" >> "$LOG_FILE"
  exit 1
else
  # Resposta inesperada — negar por segurança (fail-safe)
  echo "[BIOMETRIC] ⚠️ RESULTADO DESCONHECIDO: $RESULT" >&2
  echo "$TIMESTAMP | BIOMETRIC | DENY | $OPERATION | AUTH_RESULT_UNKNOWN" >> "$LOG_FILE"
  exit 1
fi
