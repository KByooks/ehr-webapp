package com.main.ehr.repository;

import com.main.ehr.model.Provider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProviderRepository extends JpaRepository<Provider, Long> {

    /**
     * Flexible provider search:
     * - firstName: single letter → "starts with", longer → "contains"
     * - specialty: partial match
     * - null Boolean filters are ignored (show all)
     * - uses COALESCE for shorter syntax
     */
    @Query("""
        SELECT p FROM Provider p
        WHERE
          (COALESCE(:inPracticeOnly, p.inPractice) = p.inPractice)
          AND (COALESCE(:activeOnly, p.active) = p.active)
          AND (
            :firstName IS NULL
            OR (
                (LENGTH(:firstName) <= 1 AND LOWER(p.firstName) LIKE LOWER(CONCAT(:firstName, '%')))
                OR (LENGTH(:firstName) > 1 AND LOWER(p.firstName) LIKE LOWER(CONCAT('%', :firstName, '%')))
            )
          )
          AND (
            :lastName IS NULL
            OR LOWER(p.lastName) LIKE LOWER(CONCAT('%', :lastName, '%'))
          )
          AND (
            :specialty IS NULL
            OR LOWER(p.specialty) LIKE LOWER(CONCAT('%', :specialty, '%'))
          )
        """)
    Page<Provider> searchProviders(
            @Param("firstName") String firstName,
            @Param("lastName") String lastName,
            @Param("specialty") String specialty,
            @Param("inPracticeOnly") Boolean inPracticeOnly,
            @Param("activeOnly") Boolean activeOnly,
            Pageable pageable
    );
}
