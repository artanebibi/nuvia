package artan.extension_sb.web;

import artan.extension_sb.service.GeminiService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = {"chrome-extension://*", "http://localhost:*"})
@RequestMapping("/api/gemini")
public class GeminiController {
    private final GeminiService geminiService;

    public GeminiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @PostMapping("/generate")
    public ResponseEntity<String> generateContent(@RequestBody String prompt,
                                                  Authentication authentication) {
        try {
            String userInfo = authentication != null ? authentication.getName() : "anonymous";
            System.out.println("Gemini request from: " + userInfo);

            String response = geminiService.generateContent(prompt);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body("Error: " + e.getMessage());
        }
    }

    @PostMapping("/generate-special")
    public ResponseEntity<String> generateSpecialContent(@RequestBody String prompt,
                                                         Authentication authentication) {
        try {
            // Log if user is authenticated
            String userInfo = authentication != null ? authentication.getName() : "anonymous";
            System.out.println("Special Gemini request from: " + userInfo);

            String response = geminiService.generateSpecialContent(prompt);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body("Error: " + e.getMessage());
        }
    }
}