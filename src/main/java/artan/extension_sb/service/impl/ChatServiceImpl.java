package artan.extension_sb.service.impl;

import artan.extension_sb.model.domain.Chat;
import artan.extension_sb.repository.ChatRepository;
import artan.extension_sb.service.ChatService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ChatServiceImpl implements ChatService {
    private final ChatRepository chatRepository;

    public ChatServiceImpl(ChatRepository chatRepository) {
        this.chatRepository = chatRepository;
    }


    @Override
    public List<Chat> ListAll(UUID userId) {
        return chatRepository.findAllByUserId(userId);
    }

    @Override
    public Chat GetChat(UUID userId, Long chatId) {
        return chatRepository.findByUserIdAndId(userId, chatId);
    }

    @Override
    public Chat AddChat(UUID userId, Chat chat) {
        return chatRepository.save(chat);
    }

    @Override
    public Chat RemoveChat(Chat chat) {
        chatRepository.delete(chat);
        return chat;
    }
}
