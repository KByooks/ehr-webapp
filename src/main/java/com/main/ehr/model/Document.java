package com.main.ehr.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Document extends Auditable{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fileName;
    private String fileType; // PDF, JPG, etc.
    private String filePath; // or store as blob
    private String documentType; // ID, X-ray, Form, etc.
    private LocalDateTime uploadedAt;

    @ManyToOne
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @ManyToOne
    @JoinColumn(name = "uploaded_by_id")
    private Staff uploadedBy; // or Provider if uploaded by doctor
}
