// Token revocation (logout): a revoked token is treated as no token at all.
export function createTokenService({ tokenRepository, logger }) {
  return {
    async isRevoked(jti) {
      if (!tokenRepository.enabled || !jti) return false;
      try {
        return await tokenRepository.isRevoked(jti);
      } catch (err) {
        logger.warn({ err: err.message }, "redis revocation check unavailable");
        return false; // fail open: a cache outage must not lock every user out
      }
    },
  };
}
