package artan.extension_sb.model.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.apache.catalina.LifecycleState;

import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.List;

@Entity
public class Chat {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @OneToMany(fetch = FetchType.EAGER)
    private List<Log> logs;

    @ManyToOne
    private User user;

    public Chat(Long id, List<Log> logs, User user) {
        this.id = id;
        this.logs = logs;
        this.user = user;
    }

    public Chat() {

    }

    public Chat(User user) {
        this.user = user;
    }

    public Long getId() {
        return id;
    }

    public List<Log> getLogs() {
        return logs;
    }

    public User getUser() {
        return user;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setLogs(List<Log> logs) {
        this.logs = logs;
    }

    public void setUser(User user) {
        this.user = user;
    }
}
