package com.main.ehr.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.List;

@Entity
@Table(name = "insurances")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Insurance extends Auditable{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String providerName;
    private String policyNumber;
    private String groupNumber;
    private String type; // Primary/Secondary
    private String phone;
    private String address;

    @OneToMany(mappedBy = "insurancePrimary")
    private List<Patient> primaryPatients;

    @OneToMany(mappedBy = "insuranceSecondary")
    private List<Patient> secondaryPatients;
}
