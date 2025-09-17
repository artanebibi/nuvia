package artan.extension_sb.service.impl;

import artan.extension_sb.model.domain.Chat;
import artan.extension_sb.model.domain.Log;
import artan.extension_sb.model.domain.Response.Response;
import artan.extension_sb.model.domain.TYPE;
import artan.extension_sb.service.GeminiService;
import artan.extension_sb.service.LogService;
import artan.extension_sb.service.ProcessingService;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;

@Service
public class GeminiServiceImpl implements GeminiService {
    @Value("${gemini.api.key}")
    private String API_KEY;
    @Value("${weather.api.key}")
    private String WEATHER_API_KEY;
    private final ProcessingService processingService;
    private final LogService logService;
    private TYPE type;
    private String loggedPrompt;

    public GeminiServiceImpl(ProcessingService processingService, LogService logService) {
        this.processingService = processingService;
        this.logService = logService;
        this.type = TYPE.DEFINE;
    }

    @Override
    public Log generateContent(String prompt, Chat chat) throws JsonProcessingException {
        System.out.println("--- GeminiService: Main Method ---");
        System.out.println("Type before first request: " + type);
        String requestBody = processingService.formatPrompt(type, prompt, chat);
        System.out.println("Request body for first request: " + requestBody);
        String result = sendToApi(requestBody);
        Response response = processingService.handleResponse(result);
        String typeStr = response.getCandidates().get(0)
                .getContent().getParts().get(0)
                .getText();
        typeStr = typeStr.replace("\n", "");
        System.out.println("Type after first request: " + typeStr);
        type = TYPE.valueOf(typeStr);

//        System.out.println("+++ Defined type: " + typeStr);

        // EXTERNAL ENDPOINT USAGE NEEDED FOR STREAMING IN CONTENT
        if (type == TYPE.SUMMARIZATION || type == TYPE.VIDEO || type == TYPE.DOCUMENT) {
//            System.out.println("/// Middle-Returning: " + typeStr);
            System.out.println("Returning in middle");
            type = TYPE.DEFINE;
            loggedPrompt = prompt;
            return new Log(typeStr, typeStr, null, null);
        }

        requestBody = processingService.formatPrompt(type, prompt, chat);
        System.out.println("Request body for second request");
        result = sendToApi(requestBody);
        response = processingService.handleResponse(result);

        if (type == TYPE.WEATHER) {
            String location = response.getCandidates().get(0)
                    .getContent().getParts().get(0).getText();
            System.out.println("Weather location: " + location);
            String weatherData = fetchWeather(location);
            System.out.println("WEATHER DATA:\n" + weatherData);
//            requestBody = processingService.formatPrompt(TYPE.WEATHER_RESULT, location);

            requestBody = processingService.formatPrompt(TYPE.WEATHER_RESULT, prompt + "###" + weatherData, null);
            result = sendToApi(requestBody);
            response = processingService.handleResponse(result);
        }

        Log log = new Log(prompt, response.getCandidates().get(0)
                .getContent().getParts().get(0).getText(),
                LocalDateTime.now(), type);
        logService.save(log);
        System.out.println("Response after second request: " + log.getResponse());
        logService.save(log);
        type = TYPE.DEFINE;
        return log;
    }

//    @Override
//    public Log generateLogFromContent(String prompt, Chat chat) throws JsonProcessingException {
//        String requestBody = processingService.formatPrompt(type, prompt, chat);
//        String result = sendToApi(requestBody);
//        Response response = processingService.handleResponse(result);
//        String typeStr = response.getCandidates().get(0)
//                .getContent().getParts().get(0)
//                .getText();
//        typeStr = typeStr.replace("\n", "");
//        type = TYPE.valueOf(typeStr);
//
//        System.out.println("+++ Defined type: " + typeStr);
//
//        // EXTERNAL ENDPOINT USAGE NEEDED FOR STREAMING IN CONTENT
//        if (type == TYPE.SUMMARIZATION || type == TYPE.VIDEO || type == TYPE.DOCUMENT) {
//            System.out.println("/// Middle-Returning: " + typeStr);
//            type = TYPE.DEFINE;
//            loggedPrompt = prompt;
//            return null;
//        }
//
//        requestBody = processingService.formatPrompt(type, prompt, chat);
//        result = sendToApi(requestBody);
//        response = processingService.handleResponse(result);
//
//        if (type == TYPE.WEATHER) {
//            String location = response.getCandidates().get(0)
//                    .getContent().getParts().get(0).getText();
//
//            String weatherData = fetchWeather(location);
//            System.out.println("WEATHER:\n" + weatherData);
//
//            requestBody = processingService.formatPrompt(TYPE.WEATHER_RESULT, prompt + "###" + weatherData, chat);
//            result = sendToApi(requestBody);
//            response = processingService.handleResponse(result);
//        }
//
//        Log log = new Log(prompt, response.getCandidates().get(0)
//                .getContent().getParts().get(0).getText(),
//                LocalDateTime.now(), type);
//        logService.save(log);
//
//        type = TYPE.DEFINE;
//        return log;
//    }

    @Override
    public Log generateSpecialContent(String prompt) throws JsonProcessingException {
        String[] parts = prompt.split("###");
        String tmpType = parts[0];
        String tmpPrompt = parts[1];
        TYPE tmpTypeObj = TYPE.valueOf(tmpType);
        String requestBody = "";
        if ("VIDEO".equals(tmpType) || "DOCUMENT".equals(tmpType)) {
            requestBody = processingService.formatPrompt(tmpTypeObj, loggedPrompt + "###" + tmpPrompt, null);
        } else if ("SUMMARIZATION".equals(tmpType)) {
            requestBody = processingService.formatPrompt(tmpTypeObj, tmpPrompt, null);
        }
        String result = sendToApi(requestBody);
        Response response = processingService.handleResponse(result);
        Log log = new Log(loggedPrompt, response.getCandidates().get(0)
                .getContent().getParts().get(0).getText(),
                LocalDateTime.now(), tmpTypeObj);
        logService.save(log);
        return log;
    }

//    @Override
//    public Log generateLogFromSpecialContent(String prompt) throws JsonProcessingException {
//        String[] parts = prompt.split("###");
//        String tmpType = parts[0];
//        String tmpPrompt = parts[1];
//        TYPE tmpTypeObj = TYPE.valueOf(tmpType);
//        String requestBody = "";
//        if ("VIDEO".equals(tmpType)) {
//            requestBody = processingService.formatPrompt(tmpTypeObj, loggedPrompt + "###" + tmpPrompt, null);
//        } else if ("SUMMARIZATION".equals(tmpType)) {
//            requestBody = processingService.formatPrompt(tmpTypeObj, tmpPrompt, null);
//        }
//        String result = sendToApi(requestBody);
//        Response response = processingService.handleResponse(result);
//        Log log = new Log(loggedPrompt, response.getCandidates().get(0)
//                .getContent().getParts().get(0).getText(),
//                LocalDateTime.now(), tmpTypeObj);
//        logService.save(log);
//        return log;
//    }


    private String fetchWeather(String location) {
        String API_URL = "https://api.weatherapi.com/v1/current.json?key=" + WEATHER_API_KEY + "&q=" + location;

        RestTemplate restTemplate = new RestTemplate();
        ResponseEntity<String> response = restTemplate.getForEntity(API_URL, String.class);

        return response.getBody();
    }

    private String sendToApi(String requestBody) {
        String API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + API_KEY;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>(requestBody, headers);

        RestTemplate restTemplate = new RestTemplate();
        ResponseEntity<String> response = restTemplate.exchange(
                API_URL,
                HttpMethod.POST,
                request,
                String.class
        );

        return response.getBody();
    }
}