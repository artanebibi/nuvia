package artan.extension_sb.service;

import artan.extension_sb.model.domain.Chat;
import artan.extension_sb.model.domain.Log;
import com.fasterxml.jackson.core.JsonProcessingException;

public interface GeminiService {
    Log generateContent(String prompt, Chat chat) throws JsonProcessingException;
//    Log generateLogFromContent(String prompt, Chat chat) throws JsonProcessingException;
    Log generateSpecialContent(String prompt) throws JsonProcessingException;
//    Log generateLogFromSpecialContent(String prompt) throws JsonProcessingException;

}
