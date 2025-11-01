package com.main.ehr.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "medical_notes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicalNote extends Auditable{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @ManyToOne
    @JoinColumn(name = "created_by_id")
    private Staff createdBy; // can also be Provider if needed

    private LocalDateTime createdAt;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String type; // Visit Note, Lab Note, etc.
}
