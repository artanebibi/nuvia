package artan.extension_sb.web;

import artan.extension_sb.model.Log;
import artan.extension_sb.service.LogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final LogService logService;

    public ApiController(LogService logService) {
        this.logService = logService;
    }


    @CrossOrigin(origins = {"chrome-extension://*", "http://localhost:*"})
    @GetMapping("/logs")
    public ResponseEntity<List<Log>> listAllLogs() {
        return ResponseEntity.ok(logService.listAll());
    }
}
