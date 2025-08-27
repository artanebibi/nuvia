package artan.extension_sb.service;

import com.fasterxml.jackson.core.JsonProcessingException;

public interface GeminiService {
    String generateContent(String prompt) throws JsonProcessingException;
    String generateSpecialContent(String prompt) throws JsonProcessingException;
}
