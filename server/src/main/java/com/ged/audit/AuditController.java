package com.ged.audit;

import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private static final String READ = "audit.read";

    private final AuditService audit;
    private final CurrentUserProvider currentUser;

    public AuditController(AuditService audit, CurrentUserProvider currentUser) {
        this.audit = audit;
        this.currentUser = currentUser;
    }

    @GetMapping
    List<AuditService.AuditEntryDto> list(@RequestParam(required = false) Long before,
                                          @RequestParam(defaultValue = "100") int size) {
        CurrentUser user = currentUser.require(READ);
        return audit.list(user.organizationId(), before, size);
    }

    /** Recalcule toute la chaîne d'empreintes de la société. */
    @GetMapping("/verify")
    AuditService.ChainVerification verify() {
        return audit.verify(currentUser.require(READ).organizationId());
    }
}
