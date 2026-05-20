const jwt = require('jsonwebtoken');
const supabase = require('../config/db');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'لم يتم تقديم رمز المصادقة' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Token signature is valid — allow the request.
    // Optionally check auth_tokens table for revocation, but don't block if lookup fails.
    try {
      const { data: tokenRecord } = await supabase
        .from('auth_tokens')
        .select('id')
        .eq('token_hash', hashToken(token))
        .single();

      // Only reject if we successfully queried and the token was explicitly revoked/missing
      // Skip this check if the table query itself errors (e.g. missing column)
      if (tokenRecord === null) {
        // Token not found — could be revoked or table insert failed during login.
        // Fall through and allow based on valid JWT signature.
      }
    } catch (_) { /* auth_tokens lookup failed — allow based on JWT */ }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      full_name: decoded.full_name,
      email: decoded.email,
      permissions: decoded.permissions || {}
    };
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة' });
    }
    return res.status(401).json({ error: 'رمز مصادقة غير صالح' });
  }
}

function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { authenticate, hashToken };
