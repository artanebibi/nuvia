package artan.extension_sb.web;

import artan.extension_sb.model.domain.Chat;
import artan.extension_sb.model.domain.Log;
import artan.extension_sb.security.SecurityUtil;
import artan.extension_sb.service.ChatService;
import artan.extension_sb.service.GeminiService;
import artan.extension_sb.service.JWTService;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@CrossOrigin(origins = {"chrome-extension://*", "http://localhost:*"})
@RequestMapping("/api/gemini")
public class GeminiController {
    private final GeminiService geminiService;
    private final ChatService chatService;
    private final SecurityUtil securityUtil;
    private final JWTService jwtService;

    public GeminiController(GeminiService geminiService, ChatService chatService, SecurityUtil securityUtil, JWTService jwtService) {
        this.geminiService = geminiService;
        this.chatService = chatService;
        this.securityUtil = securityUtil;
        this.jwtService = jwtService;
    }

    @PostMapping("/generate")
    public ResponseEntity<String> generateContent(@RequestBody String prompt,
                                                  Authentication authentication) {
        try {
            String userInfo = authentication != null ? authentication.getName() : "anonymous";
            System.out.println("Gemini request from: " + userInfo);

            Log log = geminiService.generateContent(prompt, null);
            String response = log.getResponse();
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body("Error: " + e.getMessage());
        }
    }

    @PostMapping("/generate/{id}")
    public ResponseEntity<String> generateContent(@RequestBody String prompt, @RequestHeader(value = "Authorization") String accessToken, @PathVariable Long id, HttpServletResponse httpServletResponse) {
        try {
            UUID userId = securityUtil.getCurrentUserId();
            if (userId != null) {
                if (jwtService.isTokenExpired(accessToken)) {
                    return ResponseEntity.status(401).build();
                }
                if (!jwtService.validateToken(accessToken)) {
                    return ResponseEntity.status(401).build();
                }

                System.out.println("--- GeminiController: Main Method ---");
                System.out.println("Gemini request from: " + userId);
                System.out.println("Gemini request: " + prompt);

                Chat chat = chatService.GetChat(userId, id);
                Log log = geminiService.generateContent(prompt, chat);
                String response = log.getResponse();
//                Log log = geminiService.generateLogFromContent(prompt, chat);
                if(log.getType() != null) {
                    List<Log> logs = chat.getLogs();
                    if (logs == null) {
                        logs = new ArrayList<>();
                    }
                    logs.add(log);
                    chat.setLogs(logs);
                    chatService.AddChat(userId, chat);
                }

                return ResponseEntity.ok(response);
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
        return null;
    }


    @PostMapping("/generate-special")
    public ResponseEntity<String> generateSpecialContent(@RequestBody String prompt,
                                                         Authentication authentication) {
        try {
            // Log if user is authenticated
            String userInfo = authentication != null ? authentication.getName() : "anonymous";
            System.out.println("Special Gemini request from: " + userInfo);

            Log log = geminiService.generateSpecialContent(prompt);
            String response = log.getResponse();
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body("Error: " + e.getMessage());
        }
    }

    @PostMapping("/generate-special/{id}")
    public ResponseEntity<String> generateSpecialContent(@RequestBody String prompt,
                                                         @RequestHeader(value = "Authorization") String accessToken,
                                                         @PathVariable Long id,
                                                         HttpServletResponse httpServletResponse) {
        try {
            UUID userId = securityUtil.getCurrentUserId();
            if (userId != null) {
                if (jwtService.isTokenExpired(accessToken)) {
                    return ResponseEntity.status(401).build();
                }
                if (!jwtService.validateToken(accessToken)) {
                    return ResponseEntity.status(401).build();
                }


                System.out.println("Gemini request from: " + userId);

                Log log = geminiService.generateSpecialContent(prompt);
                String response = log.getResponse();
                Chat chat = chatService.GetChat(userId, id);
//                Log log = geminiService.generateLogFromSpecialContent(prompt);

                List<Log> logs = chat.getLogs();
                if (logs == null) {
                    logs = new ArrayList<>();
                }
                logs.add(log);
                chat.setLogs(logs);
                chatService.AddChat(userId, chat);

                return ResponseEntity.ok(response);
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
        return null;
    }
}