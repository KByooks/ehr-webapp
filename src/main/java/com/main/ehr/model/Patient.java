package com.main.ehr.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "patients")
public class Patient extends Auditable{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String firstName;
    private String middleName;
    private String lastName;
    private LocalDate dob;
    private String gender;

    private String phonePrimary;
    private String phoneSecondary;
    private String email;

    private String addressLine1;
    private String addressLine2;
    private String city;
    private String state;
    private String zip;

    @ManyToOne
    @JoinColumn(name = "insurance_primary_id")
    private Insurance insurancePrimary;

    @ManyToOne
    @JoinColumn(name = "insurance_secondary_id")
    private Insurance insuranceSecondary;

    @OneToMany(mappedBy = "patient")
    private List<Appointment> appointments;

    @OneToMany(mappedBy = "patient")
    private List<MedicalNote> medicalNotes;

    @OneToMany(mappedBy = "patient")
    private List<Document> documents;

    // --- Constructors ---
    public Patient() {}

    public Patient(Long id, String title, String firstName, String middleName, String lastName,
                   LocalDate dob, String gender, String phonePrimary, String phoneSecondary,
                   String email, String addressLine1, String addressLine2, String city,
                   String state, String zip) {
        this.id = id;
        this.title = title;
        this.firstName = firstName;
        this.middleName = middleName;
        this.lastName = lastName;
        this.dob = dob;
        this.gender = gender;
        this.phonePrimary = phonePrimary;
        this.phoneSecondary = phoneSecondary;
        this.email = email;
        this.addressLine1 = addressLine1;
        this.addressLine2 = addressLine2;
        this.city = city;
        this.state = state;
        this.zip = zip;
    }

    // --- Getters and Setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getMiddleName() { return middleName; }
    public void setMiddleName(String middleName) { this.middleName = middleName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public LocalDate getDob() { return dob; }
    public void setDob(LocalDate dob) { this.dob = dob; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getPhonePrimary() { return phonePrimary; }
    public void setPhonePrimary(String phonePrimary) { this.phonePrimary = phonePrimary; }

    public String getPhoneSecondary() { return phoneSecondary; }
    public void setPhoneSecondary(String phoneSecondary) { this.phoneSecondary = phoneSecondary; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getAddressLine1() { return addressLine1; }
    public void setAddressLine1(String addressLine1) { this.addressLine1 = addressLine1; }

    public String getAddressLine2() { return addressLine2; }
    public void setAddressLine2(String addressLine2) { this.addressLine2 = addressLine2; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getZip() { return zip; }
    public void setZip(String zip) { this.zip = zip; }

    public Insurance getInsurancePrimary() { return insurancePrimary; }
    public void setInsurancePrimary(Insurance insurancePrimary) { this.insurancePrimary = insurancePrimary; }

    public Insurance getInsuranceSecondary() { return insuranceSecondary; }
    public void setInsuranceSecondary(Insurance insuranceSecondary) { this.insuranceSecondary = insuranceSecondary; }

    public List<Appointment> getAppointments() { return appointments; }
    public void setAppointments(List<Appointment> appointments) { this.appointments = appointments; }

    public List<MedicalNote> getMedicalNotes() { return medicalNotes; }
    public void setMedicalNotes(List<MedicalNote> medicalNotes) { this.medicalNotes = medicalNotes; }

    public List<Document> getDocuments() { return documents; }
    public void setDocuments(List<Document> documents) { this.documents = documents; }

    // --- toString ---
    @Override
    public String toString() {
        return "Patient{" +
                "id=" + id +
                ", firstName='" + firstName + '\'' +
                ", lastName='" + lastName + '\'' +
                ", dob=" + dob +
                ", phonePrimary='" + phonePrimary + '\'' +
                ", city='" + city + '\'' +
                ", state='" + state + '\'' +
                '}';
    }
}
