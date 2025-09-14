package artan.extension_sb.repository;

import artan.extension_sb.model.domain.Chat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatRepository extends JpaRepository<Chat, Long> {
    Chat findByUserIdAndId(UUID userId, Long chatId);
    List<Chat> findAllByUserId(UUID userId);
}
