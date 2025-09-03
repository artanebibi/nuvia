package artan.extension_sb.service.impl;

import artan.extension_sb.model.dto.AuthUserInfo;
import artan.extension_sb.service.AuthUserService;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

@Service
public class AuthUserServiceImpl extends DefaultOAuth2UserService implements AuthUserService {

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        return super.loadUser(userRequest);
    }

    public AuthUserInfo extractUserInfo(OAuth2User oauth2User, String provider) {
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
