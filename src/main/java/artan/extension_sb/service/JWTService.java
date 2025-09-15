package artan.extension_sb.service;


import java.util.UUID;
import io.jsonwebtoken.Claims;

public interface JWTService {
    public String GenerateToken(UUID userID);
    public UUID ExtractUserId(String token);
    boolean validateToken(String token);
    Claims extractAllClaims(String token);
    boolean isTokenExpired(String token);
    void invalidateToken(String token);
    String extractSubject(String token);
}