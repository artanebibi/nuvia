package artan.extension_sb.service;

import artan.extension_sb.model.Response.Response;
import artan.extension_sb.model.TYPE;
import com.fasterxml.jackson.core.JsonProcessingException;

public interface ProcessingService {
    String formatPrompt(TYPE type, String prompt);
    Response handleResponse(String result) throws JsonProcessingException;
}
