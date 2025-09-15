package artan.extension_sb.service.impl;

import artan.extension_sb.model.domain.User;
import artan.extension_sb.repository.UserRepository;
import artan.extension_sb.service.UserService;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;

    private UserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public User getUser(UUID id) {
        return userRepository.findById(id).orElse(null);
    }

    @Override
    public User save(User user) {
        return userRepository.save(user);
    }

    @Override
    public User delete(UUID id) {
        User user = userRepository.findById(id).orElse(null);
        userRepository.deleteById(id);
        return user;
    }

    @Override
    public User findByEmail(String email) {
        Optional<User> user = userRepository.findByGoogleEmail(email);
        if (user.isEmpty()) {
            user = userRepository.findByGoogleEmail(email);
        }
        return user.orElse(null);
    }
}
