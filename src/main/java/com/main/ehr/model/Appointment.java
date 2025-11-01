package com.main.ehr.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "appointments")
public class Appointment extends Auditable{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate date;
    private LocalTime timeStart;
    private LocalTime timeEnd;
    private int durationMinutes;
    private String appointmentType;
    private String status;
    private String reason;

    @ManyToOne
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @ManyToOne
    @JoinColumn(name = "provider_id")
    private Provider provider;

    @ManyToOne
    @JoinColumn(name = "room_id")
    private Room room;

    @OneToOne
    @JoinColumn(name = "notes_id")
    private MedicalNote notes;

    // --- Constructors ---
    public Appointment() {}

    public Appointment(Long id, LocalDate date, LocalTime timeStart, LocalTime timeEnd,
                       int durationMinutes, String appointmentType, String status,
                       String reason, Patient patient, Provider provider,
                       Room room, MedicalNote notes) {
        this.id = id;
        this.date = date;
        this.timeStart = timeStart;
        this.timeEnd = timeEnd;
        this.durationMinutes = durationMinutes;
        this.appointmentType = appointmentType;
        this.status = status;
        this.reason = reason;
        this.patient = patient;
        this.provider = provider;
        this.room = room;
        this.notes = notes;
    }

    // --- Getters and Setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getTimeStart() { return timeStart; }
    public void setTimeStart(LocalTime timeStart) { this.timeStart = timeStart; }

    public LocalTime getTimeEnd() { return timeEnd; }
    public void setTimeEnd(LocalTime timeEnd) { this.timeEnd = timeEnd; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public String getAppointmentType() { return appointmentType; }
    public void setAppointmentType(String appointmentType) { this.appointmentType = appointmentType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Patient getPatient() { return patient; }
    public void setPatient(Patient patient) { this.patient = patient; }

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }

    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }

    public MedicalNote getNotes() { return notes; }
    public void setNotes(MedicalNote notes) { this.notes = notes; }

    // --- toString() (optional for debugging/logging) ---
    @Override
    public String toString() {
        return "Appointment{" +
                "id=" + id +
                ", date=" + date +
                ", timeStart=" + timeStart +
                ", timeEnd=" + timeEnd +
                ", durationMinutes=" + durationMinutes +
                ", appointmentType='" + appointmentType + '\'' +
                ", status='" + status + '\'' +
                ", reason='" + reason + '\'' +
                ", patient=" + (patient != null ? patient.getId() : null) +
                ", provider=" + (provider != null ? provider.getId() : null) +
                '}';
    }
}
