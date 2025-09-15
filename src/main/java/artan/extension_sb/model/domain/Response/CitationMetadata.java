package artan.extension_sb.model.domain.Response;

import java.util.List;

public class CitationMetadata {
    private List<CitationSource> citationSources;

    public List<CitationSource> getCitationSources() {
        return citationSources;
    }

    public void setCitationSources(List<CitationSource> citationSources) {
        this.citationSources = citationSources;
    }
}