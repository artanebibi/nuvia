package artan.extension_sb.service.impl;

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
    public String generateContent(String prompt) throws JsonProcessingException {
        String requestBody = processingService.formatPrompt(type, prompt);
        String result = sendToApi(requestBody);
        Response response = processingService.handleResponse(result);
        String typeStr = response.getCandidates().get(0)
                .getContent().getParts().get(0)
                .getText();
        typeStr = typeStr.replace("\n", "");
        type = TYPE.valueOf(typeStr);

        System.out.println("+++ Defined type: " + typeStr);

        // EXTERNAL ENDPOINT USAGE NEEDED FOR STREAMING IN CONTENT
        if(type == TYPE.SUMMARIZATION || type == TYPE.PHOTO || type == TYPE.VIDEO) {
            System.out.println("/// Middle-Returning: " + typeStr);
            type = TYPE.DEFINE;
            loggedPrompt = prompt;
            return typeStr;
        }

        requestBody = processingService.formatPrompt(type, prompt);
        result = sendToApi(requestBody);
        response = processingService.handleResponse(result);

        if(type == TYPE.WEATHER){
            String location = response.getCandidates().get(0)
                    .getContent().getParts().get(0).getText();

            String weatherData = fetchWeather(location);
            System.out.println("WEATHER:\n" + weatherData);
//            requestBody = processingService.formatPrompt(TYPE.WEATHER_RESULT, location);

            requestBody = processingService.formatPrompt(TYPE.WEATHER_RESULT, prompt + "###" + weatherData);
            result = sendToApi(requestBody);
            response = processingService.handleResponse(result);
        }

        Log log = new Log(prompt, response.getCandidates().get(0)
                .getContent().getParts().get(0).getText(),
                LocalDateTime.now(), type);
        logService.save(log);

//        logService.save(log);
        type = TYPE.DEFINE;
        return log.getResponse();
    }

        @Override
    public Log generateLogFromContent(String prompt) throws JsonProcessingException {
        String requestBody = processingService.formatPrompt(type, prompt);
        String result = sendToApi(requestBody);
        Response response = processingService.handleResponse(result);
        String typeStr = response.getCandidates().get(0)
                .getContent().getParts().get(0)
                .getText();
        typeStr = typeStr.replace("\n", "");
        type = TYPE.valueOf(typeStr);

        System.out.println("+++ Defined type: " + typeStr);

        // EXTERNAL ENDPOINT USAGE NEEDED FOR STREAMING IN CONTENT
        if(type == TYPE.SUMMARIZATION || type == TYPE.PHOTO || type == TYPE.VIDEO) {
            System.out.println("/// Middle-Returning: " + typeStr);
            type = TYPE.DEFINE;
            loggedPrompt = prompt;
            return null;
        }

        requestBody = processingService.formatPrompt(type, prompt);
        result = sendToApi(requestBody);
        response = processingService.handleResponse(result);

        if(type == TYPE.WEATHER){
            String location = response.getCandidates().get(0)
                    .getContent().getParts().get(0).getText();

            String weatherData = fetchWeather(location);
            System.out.println("WEATHER:\n" + weatherData);

            requestBody = processingService.formatPrompt(TYPE.WEATHER_RESULT, prompt + "###" + weatherData);
            result = sendToApi(requestBody);
            response = processingService.handleResponse(result);
        }

        Log log = new Log(prompt, response.getCandidates().get(0)
                .getContent().getParts().get(0).getText(),
                LocalDateTime.now(), type);
        logService.save(log);

        type = TYPE.DEFINE;
        return log;
    }

    @Override
    public String generateSpecialContent(String prompt) throws JsonProcessingException {
        String[] parts = prompt.split("###");
        String tmpType = parts[0];
        String tmpPrompt = parts[1];
        TYPE tmpTypeObj = TYPE.valueOf(tmpType);
        String requestBody = "";
        if("VIDEO".equals(tmpType)){
            requestBody = processingService.formatPrompt(tmpTypeObj, loggedPrompt + "###" + tmpPrompt);
        }
        else if("SUMMARIZATION".equals(tmpType)) {
            requestBody = processingService.formatPrompt(tmpTypeObj, tmpPrompt);
        }
        String result = sendToApi(requestBody);
        Response response = processingService.handleResponse(result);
        Log log = new Log(loggedPrompt, response.getCandidates().get(0)
                .getContent().getParts().get(0).getText(),
                LocalDateTime.now(), tmpTypeObj);
        logService.save(log);
        return log.getResponse();
    }

    @Override
    public Log generateLogFromSpecialContent(String prompt) throws JsonProcessingException {
        String[] parts = prompt.split("###");
        String tmpType = parts[0];
        String tmpPrompt = parts[1];
        TYPE tmpTypeObj = TYPE.valueOf(tmpType);
        String requestBody = "";
        if("VIDEO".equals(tmpType)){
            requestBody = processingService.formatPrompt(tmpTypeObj, loggedPrompt + "###" + tmpPrompt);
        }
        else if("SUMMARIZATION".equals(tmpType)) {
            requestBody = processingService.formatPrompt(tmpTypeObj, tmpPrompt);
        }
        String result = sendToApi(requestBody);
        Response response = processingService.handleResponse(result);
        Log log = new Log(loggedPrompt, response.getCandidates().get(0)
                .getContent().getParts().get(0).getText(),
                LocalDateTime.now(), tmpTypeObj);
        logService.save(log);
        return log;
    }



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