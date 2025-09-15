package artan.extension_sb.web;

import artan.extension_sb.service.JWTService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private final JWTService jwtService;

    public AuthController(JWTService jwtService) {
        this.jwtService = jwtService;
    }

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

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            HttpServletRequest request,
            HttpServletResponse response,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        logger.info("Logout request received");

        Map<String, String> responseBody = new HashMap<>();

        try {
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                jwtService.invalidateToken(token);

                responseBody.put("tokenStatus", "invalidated");
            } else {
                logger.info("No JWT token to invalidate");

                responseBody.put("tokenStatus", "none");
            }

            SecurityContextHolder.clearContext();
            logger.info("Security context cleared");

            if (request.getSession(false) != null) {
                request.getSession().invalidate();

                responseBody.put("sessionStatus", "invalidated");
            } else {
                responseBody.put("sessionStatus", "none");
            }

            responseBody.put("status", "success");
            responseBody.put("message", "Logged out successfully");

            return ResponseEntity.ok(responseBody);

        } catch (Exception e) {
            responseBody.put("status", "error");
            responseBody.put("message", "Logout failed: " + e.getMessage());
            return ResponseEntity.status(500).body(responseBody);
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refreshToken(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {


        Map<String, Object> responseBody = new HashMap<>();

        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                responseBody.put("error", "No valid token provided");
                return ResponseEntity.status(401).body(responseBody);
            }

            String token = authHeader.substring(7);

            if (!jwtService.validateToken(token)) {
                responseBody.put("error", "Invalid or expired token");
                return ResponseEntity.status(401).body(responseBody);
            }

            UUID userId = jwtService.ExtractUserId(token);
            jwtService.invalidateToken(token);

            String newToken = jwtService.GenerateToken(userId);

            responseBody.put("success", true);
            responseBody.put("token", newToken);
            responseBody.put("userId", userId.toString());

            return ResponseEntity.ok(responseBody);

        } catch (Exception e) {
            responseBody.put("error", "Token refresh failed: " + e.getMessage());
            return ResponseEntity.status(500).body(responseBody);
        }
    }
}