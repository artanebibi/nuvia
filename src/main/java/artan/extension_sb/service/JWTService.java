package artan.extension_sb.service;


import java.util.UUID;

public interface JWTService {
    public String GenerateToken(UUID userID);
}