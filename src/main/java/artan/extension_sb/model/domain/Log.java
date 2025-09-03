package artan.extension_sb.model.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import lombok.*;

import java.time.LocalDateTime;

@Data
@Entity
@AllArgsConstructor
@Getter
@Setter
public class Log {
    @Id
    @GeneratedValue
    private Long id;
    @Lob
    private String request;
    @Lob
    private String response;
    private LocalDateTime stamp;
    private TYPE type;

    public Log(String request, String response, LocalDateTime stamp, TYPE type) {
        this.request = request;
        this.response = response;
        this.stamp = stamp;
        this.type = type;
    }

    public Log() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRequest() {
        return request;
    }

    public void setRequest(String request) {
        this.request = request;
    }

    public String getResponse() {
        return response;
    }

    public void setResponse(String response) {
        this.response = response;
    }

    public LocalDateTime getStamp() {
        return stamp;
    }

    public void setStamp(LocalDateTime stamp) {
        this.stamp = stamp;
    }

    public TYPE getType() {
        return type;
    }

    public void setType(TYPE type) {
        this.type = type;
    }
}
