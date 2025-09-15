package artan.extension_sb.service.impl;

import artan.extension_sb.service.JWTService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JWTServiceImpl implements JWTService {

    private static final Logger logger = LoggerFactory.getLogger(JWTServiceImpl.class);

    @Value("${jwt.secret:mySecretKey12345678901234567890123456789012345678901234567890}")
    private String jwtSecret;

    // Cache for blacklisted tokens (logout/invalidation)
    private final ConcurrentHashMap<String, Long> blacklistedTokens = new ConcurrentHashMap<>();

    // remove expired blacklisted tokens
    private static final long CLEANUP_INTERVAL = 3600000; // 1 hour
    private long lastCleanup = System.currentTimeMillis();

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public String GenerateToken(UUID userID) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("UserID", userID.toString());

        LocalDateTime expiration = LocalDateTime.now().plusMinutes(30);
        Date expirationDate = Date.from(expiration.atZone(ZoneId.systemDefault()).toInstant());

        String token = Jwts.builder()
                .setClaims(claims)
                .setSubject(userID.toString())
                .setIssuedAt(new Date())
                .setExpiration(expirationDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();

        logger.debug("Generated new JWT token for user: {}, expires: {}", userID, expirationDate);
        return token;
    }

    public UUID ExtractUserId(String token) {
        try {
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            if (isTokenBlacklisted(token)) {
                logger.debug("Token is blacklisted");
                throw new SecurityException("Token has been invalidated");
            }

            var claimsJws = Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token);

            String userIdStr = claimsJws.getBody().get("UserID", String.class);
            UUID userId = UUID.fromString(userIdStr);

            logger.debug("Extracted user ID from token: {}", userId);
            return userId;

        } catch (Exception e) {
            logger.debug("Failed to extract user ID from token: {}", e.getMessage());
            throw e;
        }
    }

    public boolean validateToken(String token) {
        try {
            if (token == null || token.isEmpty()) {
                logger.debug("JWT token is null or empty");
                return false;
            }

            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            if (isTokenBlacklisted(token)) {
                logger.debug("JWT token is blacklisted");
                return false;
            }

            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            if (claims.getExpiration().before(new Date())) {
                logger.debug("JWT token is expired");
                return false;
            }

            String userIdStr = claims.get("UserID", String.class);
            if (userIdStr == null || userIdStr.isEmpty()) {
                logger.debug("JWT token missing UserID claim");
                return false;
            }

            logger.debug("JWT token is valid for user: {}", userIdStr);
            return true;

        } catch (ExpiredJwtException e) {
            logger.debug("JWT token is expired: {}", e.getMessage());
            return false;
        } catch (UnsupportedJwtException e) {
            logger.debug("JWT token is unsupported: {}", e.getMessage());
            return false;
        } catch (MalformedJwtException e) {
            logger.debug("JWT token is malformed: {}", e.getMessage());
            return false;
        } catch (SignatureException e) {
            logger.debug("JWT signature validation failed: {}", e.getMessage());
            return false;
        } catch (IllegalArgumentException e) {
            logger.debug("JWT token compact of handler are invalid: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            logger.debug("JWT token validation failed: {}", e.getMessage());
            return false;
        }
    }

    public Claims extractAllClaims(String token) {
        if (token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        if (isTokenBlacklisted(token)) {
            throw new SecurityException("Token has been invalidated");
        }

        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean isTokenExpired(String token) {
        try {
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            if (isTokenBlacklisted(token)) {
                return true;
            }

            Claims claims = extractAllClaims(token);
            return claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return true;
        }
    }

    public String extractSubject(String token) {
        try {
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            if (isTokenBlacklisted(token)) {
                return null;
            }

            Claims claims = extractAllClaims(token);
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    public void invalidateToken(String token) {
        if (token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            long expiration = claims.getExpiration().getTime();
            blacklistedTokens.put(token, expiration);
            logger.info("Token invalidated for user: {}", claims.get("UserID", String.class));

            // Cleanup old blacklisted tokens
            cleanupBlacklistedTokens();

        } catch (Exception e) {
            logger.warn("Could not invalidate token: {}", e.getMessage());
        }
    }

    private boolean isTokenBlacklisted(String token) {
        Long expiration = blacklistedTokens.get(token);
        if (expiration == null) {
            return false;
        }

        if (expiration < System.currentTimeMillis()) {
            blacklistedTokens.remove(token);
            return false;
        }

        return true;
    }

    private void cleanupBlacklistedTokens() {
        long now = System.currentTimeMillis();

        if (now - lastCleanup < CLEANUP_INTERVAL) {
            return;
        }

        blacklistedTokens.entrySet().removeIf(entry -> entry.getValue() < now);
        lastCleanup = now;

        logger.debug("Cleaned up expired blacklisted tokens. Current size: {}", blacklistedTokens.size());
    }
}