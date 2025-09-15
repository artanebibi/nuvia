package artan.extension_sb.model.dto;


public class AuthUserInfo {
    private String email;
    private String name;
    private String firstName;
    private String lastName;
    private String nickName;
    private String avatarUrl;
    private String accessToken;

    // Constructors
    public AuthUserInfo() {
    }

    public AuthUserInfo(String email, String name, String firstName, String lastName,
                        String nickName, String avatarUrl, String accessToken) {
        this.email = email;
        this.name = name;
        this.firstName = firstName;
        this.lastName = lastName;
        this.nickName = nickName;
        this.avatarUrl = avatarUrl;
        this.accessToken = accessToken;
    }

    // Getters and Setters
    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getNickName() {
        return nickName;
    }

    public void setNickName(String nickName) {
        this.nickName = nickName;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }
}