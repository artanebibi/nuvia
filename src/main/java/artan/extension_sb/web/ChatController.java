package artan.extension_sb.web;

import artan.extension_sb.model.domain.Chat;
import artan.extension_sb.model.domain.User;
import artan.extension_sb.security.SecurityUtil;
import artan.extension_sb.service.ChatService;
import artan.extension_sb.service.JWTService;
import artan.extension_sb.service.UserService;
import jakarta.transaction.Transactional;
import lombok.Getter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@CrossOrigin(origins = {"chrome-extension://*", "http://localhost:*"})
@RequestMapping("/api/chats")
public class ChatController {
    private final ChatService chatService;
    private final JWTService jwtService;
    private final SecurityUtil securityUtil;
    private final UserService userService;

    public ChatController(ChatService chatService, JWTService jwtService, SecurityUtil securityUtil, UserService userService) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.securityUtil = securityUtil;
        this.userService = userService;
    }

    @GetMapping("/")
    public ResponseEntity<List<Chat>> GetAll(@RequestHeader(value = "Authorization") String accessToken) {
        UUID userId = securityUtil.getCurrentUserId();
        if (userId != null) {
            if (jwtService.isTokenExpired(accessToken)) {
                return ResponseEntity.status(401).build();
            }
            if (!jwtService.validateToken(accessToken)) {
                return ResponseEntity.status(401).build();
            }

            return ResponseEntity.ok().body(chatService.ListAll(userId));
        }
        return ResponseEntity.status(401).build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Chat> GetById(@RequestHeader(value = "Authorization") String accessToken, @PathVariable Long id) {
        UUID userId = securityUtil.getCurrentUserId();
        if (userId != null) {
            if (jwtService.isTokenExpired(accessToken)) {
                return ResponseEntity.status(401).build();
            }
            if (!jwtService.validateToken(accessToken)) {
                return ResponseEntity.status(401).build();
            }

            return ResponseEntity.ok().body(chatService.GetChat(userId, id));
        }
        return ResponseEntity.status(401).build();
    }

    @PostMapping("/add")
    public ResponseEntity<Chat> Add(@RequestHeader(value = "Authorization") String accessToken) {
        UUID userId = securityUtil.getCurrentUserId();
        if (userId != null) {
            if (jwtService.isTokenExpired(accessToken)) {
                return ResponseEntity.status(401).build();
            }
            if (!jwtService.validateToken(accessToken)) {
                return ResponseEntity.status(401).build();
            }
            User user = userService.getUser(userId);
            return ResponseEntity.ok().body(chatService.AddChat(userId, new Chat(user)));
        }
        return ResponseEntity.status(401).build();
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Chat> Delete(@RequestHeader(value = "Authorization") String accessToken, @PathVariable Long id) {
        UUID userId = securityUtil.getCurrentUserId();
        if (userId != null) {
            if (jwtService.isTokenExpired(accessToken)) {
                return ResponseEntity.status(401).build();
            }
            if (!jwtService.validateToken(accessToken)) {
                return ResponseEntity.status(401).build();
            }
            Chat chat = chatService.GetChat(userId, id);
            return ResponseEntity.ok().body(chatService.RemoveChat(chat));
        }
        return ResponseEntity.status(401).build();
    }

}
