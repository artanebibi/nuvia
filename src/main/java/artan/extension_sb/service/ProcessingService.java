package artan.extension_sb.service;

import artan.extension_sb.model.domain.Chat;
import artan.extension_sb.model.domain.Response.Response;
import artan.extension_sb.model.domain.TYPE;
import com.fasterxml.jackson.core.JsonProcessingException;

public interface ProcessingService {
    String formatPrompt(TYPE type, String prompt, Chat chat);
    Response handleResponse(String result) throws JsonProcessingException;
}
