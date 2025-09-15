package artan.extension_sb.web.handler;

import artan.extension_sb.model.dto.AuthUserInfo;
import artan.extension_sb.model.domain.User;
import artan.extension_sb.service.JWTService;
import artan.extension_sb.service.TokenService;
import artan.extension_sb.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import java.net.URLEncoder;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Component
public class AuthHandler implements AuthenticationSuccessHandler {

    private static final Logger logger = LoggerFactory.getLogger(AuthHandler.class);

    private final UserService userService;
    private final JWTService jwtService;
    private final TokenService tokenService;
    private final ObjectMapper objectMapper;

    public AuthHandler(UserService userService, JWTService jwtService,
                       TokenService tokenService, ObjectMapper objectMapper) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }


    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {

        logger.info("SuccessHandler called");

        OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
        String provider = "google";

        try {
            // Extract user information
            AuthUserInfo userInfo = extractUserInfo(oauth2User, provider);

            logger.info("Login Successful");
            logger.info("Name: {}", userInfo.getName());
            logger.info("Email: {}", userInfo.getEmail());

            // if user is already in the db
            User existingUser = userService.findByEmail(userInfo.getEmail());
            String refreshToken = "";
            LocalDateTime refreshTokenExpiryDate = LocalDateTime.now();

            UUID userIdForToken;

            if (existingUser == null) { // sign up

                User newUser = new User();
                newUser.setFirstName(userInfo.getFirstName());
                newUser.setLastName(userInfo.getLastName());
                newUser.setUsername(userInfo.getNickName());
                newUser.setGoogleEmail(userInfo.getEmail());
                newUser.setRefreshToken(tokenService.generateRefreshToken());
                newUser.setRefreshTokenExpiryDate(LocalDateTime.now().plusMonths(6));
                newUser.setAvatarUrl(userInfo.getAvatarUrl());
                newUser.setCreatedAt(LocalDateTime.now());

                User savedUser = userService.save(newUser);
                userIdForToken = savedUser.getId();

                refreshToken = newUser.getRefreshToken();
                refreshTokenExpiryDate = savedUser.getRefreshTokenExpiryDate();

                logger.info("user saved, ID: {}", userIdForToken);

            } else { // sign in
                existingUser.setRefreshToken(tokenService.generateRefreshToken());
                existingUser.setRefreshTokenExpiryDate(LocalDateTime.now().plusDays(30));

                User updatedUser = userService.save(existingUser);
                userIdForToken = updatedUser.getId();

                refreshToken = existingUser.getRefreshToken();
                refreshTokenExpiryDate = existingUser.getRefreshTokenExpiryDate();
            }

            String accessToken = jwtService.GenerateToken(userIdForToken);
            userInfo.setAccessToken(accessToken);

            String redirectUrl = String.format(
                    "http://localhost:8080/auth/success?access_token=%s&refresh_token=%s&email=%s&name=%s",
                    URLEncoder.encode(accessToken, StandardCharsets.UTF_8),
                    URLEncoder.encode(refreshToken, StandardCharsets.UTF_8),
                    URLEncoder.encode(userInfo.getEmail(), StandardCharsets.UTF_8),
                    URLEncoder.encode(userInfo.getName() != null ? userInfo.getName() : userInfo.getEmail(), StandardCharsets.UTF_8)
            );

            logger.info("Redirecting to: {}", redirectUrl);
            response.sendRedirect(redirectUrl);

        } catch (Exception e) {
            logger.error("Error success handling: ", e);

            // Redirect to failure page instead of returning JSON
            response.sendRedirect("http://localhost:8080/auth/failure?error=" +
                    URLEncoder.encode(e.getMessage(), StandardCharsets.UTF_8));
        }
    }

    private AuthUserInfo extractUserInfo(OAuth2User oauth2User, String provider) {
        logger.info("Extracting user info for provider: {}", provider);

        AuthUserInfo userInfo = new AuthUserInfo();

        if ("google".equals(provider)) {
            userInfo.setEmail(oauth2User.getAttribute("email"));
            userInfo.setName(oauth2User.getAttribute("name"));
            userInfo.setFirstName(oauth2User.getAttribute("given_name"));
            userInfo.setLastName(oauth2User.getAttribute("family_name"));
            userInfo.setAvatarUrl(oauth2User.getAttribute("picture"));
            userInfo.setNickName(oauth2User.getAttribute("name"));
        }
        return userInfo;
    }
}