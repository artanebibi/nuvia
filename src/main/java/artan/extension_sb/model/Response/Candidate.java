package artan.extension_sb.model.Response;

public class Candidate {
    private Content content;
    private String finishReason;
    private Double avgLogprobs;
    private CitationMetadata citationMetadata; // ✅ ADD THIS

    public Candidate() {
    }

    public CitationMetadata getCitationMetadata() {
        return citationMetadata;
    }

    public void setCitationMetadata(CitationMetadata citationMetadata) {
        this.citationMetadata = citationMetadata;
    }

    public Content getContent() {
        return content;
    }

    public void setContent(Content content) {
        this.content = content;
    }

    public String getFinishReason() {
        return finishReason;
    }

    public void setFinishReason(String finishReason) {
        this.finishReason = finishReason;
    }

    public Double getAvgLogprobs() {
        return avgLogprobs;
    }

    public void setAvgLogprobs(Double avgLogprobs) {
        this.avgLogprobs = avgLogprobs;
    }
}