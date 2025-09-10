package artan.extension_sb.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @GetMapping("/{provider}")
    public RedirectView initiateAuth(@PathVariable String provider) {
        String redirectUrl = "/oauth2/authorization/" + provider;
        return new RedirectView(redirectUrl);
    }

    @GetMapping("/failure")
    public ResponseEntity<Map<String, Object>> authFailure(@RequestParam(required = false) String error) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", "OAuth authentication failed");
        response.put("message", error != null ? error : "Unknown error occurred");

        return ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/google")
    public RedirectView googleAuth() {
        logger.info("POST request to Google auth");
        return new RedirectView("/oauth2/authorization/google");
    }

    @GetMapping("/auth/success")
    public ResponseEntity<String> authSuccess() {
        return ResponseEntity.ok("""
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Successful</title></head>
        <body>
            <h2>Authentication Successful!</h2>
            <p>You can close this tab.</p>
            <script>setTimeout(() => window.close(), 2000);</script>
        </body>
        </html>
        """);
    }
}