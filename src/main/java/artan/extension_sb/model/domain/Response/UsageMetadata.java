package artan.extension_sb.model.domain.Response;

import java.util.List;

public class UsageMetadata {
    private int promptTokenCount;
    private int candidatesTokenCount;
    private int totalTokenCount;
    private List<TokensDetail> promptTokensDetails;
    private List<TokensDetail> candidatesTokensDetails;

    public UsageMetadata() {
    }

    public int getPromptTokenCount() {
        return promptTokenCount;
    }

    public void setPromptTokenCount(int promptTokenCount) {
        this.promptTokenCount = promptTokenCount;
    }

    public int getCandidatesTokenCount() {
        return candidatesTokenCount;
    }

    public void setCandidatesTokenCount(int candidatesTokenCount) {
        this.candidatesTokenCount = candidatesTokenCount;
    }

    public int getTotalTokenCount() {
        return totalTokenCount;
    }

    public void setTotalTokenCount(int totalTokenCount) {
        this.totalTokenCount = totalTokenCount;
    }

    public List<TokensDetail> getPromptTokensDetails() {
        return promptTokensDetails;
    }

    public void setPromptTokensDetails(List<TokensDetail> promptTokensDetails) {
        this.promptTokensDetails = promptTokensDetails;
    }

    public List<TokensDetail> getCandidatesTokensDetails() {
        return candidatesTokensDetails;
    }

    public void setCandidatesTokensDetails(List<TokensDetail> candidatesTokensDetails) {
        this.candidatesTokensDetails = candidatesTokensDetails;
    }
}