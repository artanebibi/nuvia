package artan.extension_sb.model.dto;

public class AuthResponse {
    private String message;
    private String token;
    private AuthUserInfo user;
    private String provider;
    private long expiresAt;

    // Constructors
    public AuthResponse() {}

    public AuthResponse(String message, String token, AuthUserInfo user, String provider, long expiresAt) {
        this.message = message;
        this.token = token;
        this.user = user;
        this.provider = provider;
        this.expiresAt = expiresAt;
    }

    // Getters and Setters
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public AuthUserInfo getUser() { return user; }
    public void setUser(AuthUserInfo user) { this.user = user; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public long getExpiresAt() { return expiresAt; }
    public void setExpiresAt(long expiresAt) { this.expiresAt = expiresAt; }
}
