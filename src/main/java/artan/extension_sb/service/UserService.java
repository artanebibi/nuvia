package artan.extension_sb.service;

import artan.extension_sb.model.domain.User;

import java.util.UUID;

public interface UserService {
    User getUser(UUID id);
    User save(User user);
    User delete(UUID id);
    User findByEmail(String email);
}
