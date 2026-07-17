export function requireAuth(req, res, next) {
  const isNgrokMode = process.env.NGROK_MODE === 'true';
  const secretKey = process.env.API_SECRET_KEY;

  // Detecção inteligente de tráfego local (ADB) vs Tráfego externo (Serveo/Ngrok)
  // Túneis como Serveo sempre injetam cabeçalhos 'x-forwarded-for'.
  // Se não houver esse cabeçalho, é uma conexão direta do cabo USB (ADB).
  const isLocalAdb = !req.headers['x-forwarded-for'] && !req.headers['x-forwarded-host'];

  if (isLocalAdb && req.path === '/sse') {
    // Se for o cabo USB local, sempre libera acesso sem senha!
    // Isso conserta o Claude Desktop e o Antigravity IDE.
    return next();
  }

  // Se não for local, exige token (mesmo se NGROK_MODE estiver ativo)
  let token = null;
  const authHeader = req.headers.authorization;

  // Aceita token via cabeçalho (Bearer) OU via URL (?token=SUA_CHAVE)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing Token. Envie no header 'Authorization: Bearer SUA_CHAVE' ou na URL '?token=SUA_CHAVE'." });
  }

  if (token !== secretKey) {
    console.warn(`[SEGURANÇA] Tentativa de acesso bloqueada. Token inválido: ${token}`);
    return res.status(401).json({ error: "Unauthorized: Invalid Token." });
  }

  next();
}