package com.main.ehr.model;

import java.time.LocalDateTime;

import jakarta.persistence.*;

@Entity
@Table(name = "user_audit_log")
public class UserAuditLog {
    @Id @GeneratedValue private Long id;
    private String username;
    private String action;
    private String entityType;
    private Long entityId;
    private LocalDateTime timestamp = LocalDateTime.now();
}
