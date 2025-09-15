package artan.extension_sb.service;

import artan.extension_sb.model.domain.Chat;

import java.util.List;
import java.util.UUID;

public interface ChatService {
    List<Chat> ListAll(UUID userId);
    Chat GetChat(UUID userId, Long chatId);
    Chat AddChat(UUID userId, Chat chat);
    Chat RemoveChat(Chat chat);
}
