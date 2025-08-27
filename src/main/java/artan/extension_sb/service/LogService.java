package artan.extension_sb.service;

import artan.extension_sb.model.Log;
import java.util.List;

public interface LogService {
    Log save(Log log);
    List<Log> listAll();
}
