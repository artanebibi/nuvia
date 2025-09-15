package artan.extension_sb.service;

import artan.extension_sb.model.domain.Log;
import com.fasterxml.jackson.core.JsonProcessingException;

public interface GeminiService {
    String generateContent(String prompt) throws JsonProcessingException;
    Log generateLogFromContent(String prompt) throws JsonProcessingException;
    String generateSpecialContent(String prompt) throws JsonProcessingException;
    Log generateLogFromSpecialContent(String prompt) throws JsonProcessingException;

}
