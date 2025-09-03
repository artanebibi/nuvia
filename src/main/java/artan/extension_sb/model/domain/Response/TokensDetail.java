package artan.extension_sb.model.domain.Response;

public class TokensDetail {
    private String modality;
    private int tokenCount;

    public TokensDetail() {
    }

    public String getModality() {
        return modality;
    }

    public void setModality(String modality) {
        this.modality = modality;
    }

    public int getTokenCount() {
        return tokenCount;
    }

    public void setTokenCount(int tokenCount) {
        this.tokenCount = tokenCount;
    }
}