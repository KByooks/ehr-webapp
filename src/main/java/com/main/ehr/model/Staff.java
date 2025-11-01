package com.main.ehr.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "staff")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Staff extends Auditable{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String firstName;
    private String lastName;
    private String role; // Admin, Nurse, Receptionist
    private String phone;
    private String email;

    @OneToOne
    @JoinColumn(name = "user_id")
    private User user;

    @OneToMany(mappedBy = "createdBy", cascade = CascadeType.ALL)
    private List<MedicalNote> createdNotes = new ArrayList<>();

    @OneToMany(mappedBy = "uploadedBy")
    private List<Document> uploadedDocuments;
    
    
}
