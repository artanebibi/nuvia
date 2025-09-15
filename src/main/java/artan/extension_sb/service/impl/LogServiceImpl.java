package artan.extension_sb.service.impl;

import artan.extension_sb.model.domain.Log;
import artan.extension_sb.repository.LogRepository;
import artan.extension_sb.service.LogService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LogServiceImpl implements LogService {
    private final LogRepository logRepository;

    public LogServiceImpl(LogRepository logRepository) {
        this.logRepository = logRepository;
    }

    @Override
    public Log save(Log log) {
        return logRepository.save(log);
    }

    @Override
    public List<Log> listAll() {
        return logRepository.findAll();
    }
}
