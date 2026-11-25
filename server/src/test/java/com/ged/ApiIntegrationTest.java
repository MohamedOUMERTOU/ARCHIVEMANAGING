package com.ged;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Parcours complet de l'API sur un vrai PostgreSQL et un vrai MinIO (Testcontainers), avec les données
 * de démonstration : les fichiers des documents passent donc réellement par le stockage S3.
 */
@SpringBootTest
@Testcontainers
class ApiIntegrationTest {

    /** Même image que docker-compose.yml (les images officielles MinIO ne sont plus publiées). */
    static final String MINIO_IMAGE = "pgsty/minio:RELEASE.2026-08-04T00-00-00Z";

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");

    @Container
    static MinIOContainer minio = new MinIOContainer(
            DockerImageName.parse(MINIO_IMAGE).asCompatibleSubstituteFor("minio/minio"));

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("ged.storage.type", () -> "s3");
        r.add("ged.storage.s3.endpoint", minio::getS3URL);
        r.add("ged.storage.s3.access-key", minio::getUserName);
        r.add("ged.storage.s3.secret-key", minio::getPassword);
        r.add("ged.storage.s3.bucket", () -> "ged-test");
        r.add("ged.storage.s3.console-url", () -> "http://localhost:9001");
        // Lecture du texte en arrière-plan : pas de Tesseract ici, et elle continuerait après l'arrêt de la base
        r.add("ged.ocr.enabled", () -> "false");
        r.add("ged.demo-data.enabled", () -> "true");
    }

    @Autowired WebApplicationContext context;
    @Autowired JsonMapper json;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    record Login(String token, Cookie refresh) {}

    Login login(String email) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"demo1234\"}"))
                .andExpect(status().isOk()).andReturn();
        Cookie cookie = r.getResponse().getCookie("ged_refresh");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        return new Login(read(r).get("accessToken").asString(), cookie);
    }

    JsonNode read(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    String bearer(Login l) {
        return "Bearer " + l.token();
    }

    @Test
    void refuseUnMauvaisMotDePasseAvecUnProblemDetail() throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@exemple.com\",\"password\":\"faux\"}"))
                .andExpect(status().isUnauthorized()).andReturn();
        assertThat(read(r).get("code").asString()).isEqualTo("BAD_CREDENTIALS");
        mvc.perform(get("/api/classification/tree")).andExpect(status().isUnauthorized());
    }

    @Test
    void renouvelleLeJetonEtDetecteUnJetonRejoue() throws Exception {
        Login l = login("k.benali@exemple.com");
        MvcResult refreshed = mvc.perform(post("/api/auth/refresh").cookie(l.refresh())).andExpect(status().isOk()).andReturn();
        Cookie next = refreshed.getResponse().getCookie("ged_refresh");
        assertThat(next.getValue()).isNotEqualTo(l.refresh().getValue());

        // L'ancien jeton revient : il a pu être volé, toutes les sessions sont fermées
        mvc.perform(post("/api/auth/refresh").cookie(l.refresh())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/refresh").cookie(next)).andExpect(status().isUnauthorized());
    }

    @Test
    void parcoursDeposerClasserReclasserTelecharger() throws Exception {
        Login admin = login("admin@exemple.com");

        // Plan de classement de démonstration
        JsonNode tree = read(mvc.perform(get("/api/classification/tree").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andReturn());
        String ff25 = idOf(tree, "FIN/CPT/FF-2025");
        String fc25 = idOf(tree, "FIN/CPT/FC-2025");
        JsonNode types = read(mvc.perform(get("/api/document-types").header("Authorization", bearer(admin))).andReturn());
        String facture = types.valueStream().filter(t -> t.get("code").asString().equals("FACTURE")).findFirst()
                .orElseThrow().get("id").asString();

        // 1. Dépôt dans « À classer »
        byte[] content = "%PDF-1.4 facture de test".getBytes(StandardCharsets.UTF_8);
        JsonNode uploaded = read(mvc.perform(multipart("/api/documents")
                        .file(new MockMultipartFile("files", "scan_0931.pdf", "application/pdf", content))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isCreated()).andReturn());
        String id = uploaded.get(0).get("id").asString();
        assertThat(uploaded.get(0).get("sha256").asString()).isEqualTo(sha256(content));

        // 2. Les métadonnées obligatoires du type sont vérifiées
        MvcResult invalid = mvc.perform(post("/api/documents/" + id + "/classify").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("nodeId", ff25, "typeId", facture, "title", "Facture test",
                                "metadata", Map.of("montant_ttc", "abc")))))
                .andExpect(status().isBadRequest()).andReturn();
        assertThat(read(invalid).get("errors").has("metadata.fournisseur")).isTrue();

        // 3. Classement : cote attribuée, conservation calculée (dossier pas encore clos → pas de date)
        JsonNode classified = read(mvc.perform(post("/api/documents/" + id + "/classify").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("nodeId", ff25, "typeId", facture, "title", "Facture test",
                                "documentDate", "2025-11-03", "tags", List.of("Test"),
                                "metadata", Map.of("fournisseur", "ACME", "numero", "A-1", "montant_ttc", "10", "devise", "EUR")))))
                .andExpect(status().isOk()).andReturn());
        String reference = classified.get("reference").asString();
        assertThat(reference).startsWith("FIN/CPT/FF-2025-");
        assertThat(classified.get("status").asString()).isEqualTo("ACTIVE");
        assertThat(classified.get("node").get("path").asString()).isEqualTo("Direction financière › Comptabilité › Factures fournisseurs 2025");
        assertThat(classified.get("tags").get(0).asString()).isEqualTo("test");

        // 4. Reclassement : nouvelle cote, l'ancienne reste trouvable
        JsonNode reclassified = read(mvc.perform(post("/api/documents/" + id + "/reclassify").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("nodeId", fc25, "reason", "Erreur de dossier"))))
                .andExpect(status().isOk()).andReturn());
        assertThat(reclassified.get("reference").asString()).startsWith("FIN/CPT/FC-2025-");
        JsonNode found = read(mvc.perform(get("/api/documents").param("q", reference).header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andReturn());
        assertThat(found.get("totalElements").asLong()).isEqualTo(1);

        // 5. Téléchargement : contenu identique, empreinte annoncée
        MvcResult file = mvc.perform(get("/api/documents/" + id + "/versions/1/content").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andReturn();
        assertThat(file.getResponse().getContentAsByteArray()).isEqualTo(content);
        assertThat(file.getResponse().getHeader("X-Content-SHA256")).isEqualTo(sha256(content));

        // 6. Historique complet
        JsonNode events = read(mvc.perform(get("/api/documents/" + id + "/events").header("Authorization", bearer(admin))).andReturn());
        List<String> typesSeen = events.valueStream().map(e -> e.get("type").asString()).toList();
        assertThat(typesSeen).contains("CREE", "CLASSE", "RECLASSE", "TELECHARGE");
        JsonNode reclass = events.valueStream().filter(e -> e.get("type").asString().equals("RECLASSE")).findFirst().orElseThrow();
        assertThat(reclass.get("before").get("reference").asString()).isEqualTo(reference);
        assertThat(reclass.get("reason").asString()).isEqualTo("Erreur de dossier");

        // 7. La chaîne du journal d'audit est intacte
        JsonNode verify = read(mvc.perform(get("/api/audit/verify").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andReturn());
        assertThat(verify.get("valid").asBoolean()).isTrue();
        assertThat(verify.get("entries").asInt()).isGreaterThan(10);
    }

    @Test
    void unComptableNePeutNiReclasserNiLireLAudit() throws Exception {
        Login k = login("k.benali@exemple.com");
        mvc.perform(get("/api/audit").header("Authorization", bearer(k))).andExpect(status().isForbidden());
        JsonNode docs = read(mvc.perform(get("/api/documents").header("Authorization", bearer(k))).andReturn());
        String someId = docs.get("content").get(0).get("id").asString();
        mvc.perform(post("/api/documents/" + someId + "/reclassify").header("Authorization", bearer(k))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeId\":\"" + someId + "\",\"reason\":\"test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void unDocumentAClasserNestVisibleQueParSonDeposantEtLesArchivistes() throws Exception {
        Login y = login("y.tazi@exemple.com");
        JsonNode inbox = read(mvc.perform(get("/api/documents").param("status", "A_CLASSER").header("Authorization", bearer(y)))
                .andExpect(status().isOk()).andReturn());
        // Le courrier de démonstration a été déposé par l'administrateur
        assertThat(inbox.get("totalElements").asLong()).isZero();

        Login archiviste = login("s.amrani@exemple.com");
        JsonNode all = read(mvc.perform(get("/api/documents").param("status", "A_CLASSER").header("Authorization", bearer(archiviste)))
                .andReturn());
        assertThat(all.get("totalElements").asLong()).isPositive();
    }

    @Test
    void lApercuPasseParUnLienSigneEtEstTrace() throws Exception {
        Login admin = login("admin@exemple.com");
        JsonNode docs = read(mvc.perform(get("/api/documents").param("q", "climatisation").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andReturn());
        String id = docs.get("content").get(0).get("id").asString();

        JsonNode link = read(mvc.perform(post("/api/documents/" + id + "/versions/1/view-link").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andReturn());
        assertThat(link.get("previewable").asBoolean()).isTrue();
        String url = link.get("url").asString();
        String token = url.substring(url.indexOf("token=") + 6);

        // Sans en-tête Authorization : c'est le jeton du lien qui donne accès, en affichage « inline »
        MvcResult shown = mvc.perform(get("/api/documents/" + id + "/versions/1/view").param("token", token))
                .andExpect(status().isOk()).andReturn();
        assertThat(shown.getResponse().getContentType()).isEqualTo("application/pdf");
        assertThat(shown.getResponse().getHeader("Content-Disposition")).startsWith("inline");
        assertThat(shown.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(new String(shown.getResponse().getContentAsByteArray(), StandardCharsets.ISO_8859_1)).startsWith("%PDF");

        // Jeton modifié, ou utilisé pour une autre version : refusé
        mvc.perform(get("/api/documents/" + id + "/versions/1/view").param("token", token + "x")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/documents/" + id + "/versions/2/view").param("token", token)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/documents/" + id + "/versions/1/view")).andExpect(status().isBadRequest());

        // Un format que le navigateur ne doit pas interpréter n'obtient pas de lien
        JsonNode txt = read(mvc.perform(multipart("/api/documents")
                        .file(new MockMultipartFile("files", "notes.txt", "text/plain", "bonjour".getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isCreated()).andReturn());
        JsonNode txtLink = read(mvc.perform(post("/api/documents/" + txt.get(0).get("id").asString() + "/versions/1/view-link")
                .header("Authorization", bearer(admin))).andExpect(status().isOk()).andReturn());
        assertThat(txtLink.get("previewable").asBoolean()).isFalse();
        assertThat(txtLink.get("url").isNull()).isTrue();

        // La consultation est dans l'historique
        JsonNode events = read(mvc.perform(get("/api/documents/" + id + "/events").header("Authorization", bearer(admin))).andReturn());
        assertThat(events.valueStream().map(e -> e.get("type").asString())).contains("CONSULTE");
    }

    @Test
    void parametrageCompletEtSesGardeFous() throws Exception {
        Login admin = login("admin@exemple.com");
        String auth = bearer(admin);

        // Règle de conservation
        JsonNode rule = read(mvc.perform(post("/api/settings/retention-rules").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Notes internes\",\"durationYears\":3,\"startEvent\":\"DATE_DOCUMENT\",\"finalAction\":\"DETRUIRE\"}"))
                .andExpect(status().isCreated()).andReturn());
        String ruleId = rule.get("id").asString();

        // Type de document avec des champs ; un schéma invalide est refusé champ par champ
        MvcResult bad = mvc.perform(post("/api/settings/document-types").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"NOTE\",\"name\":\"Note\",\"fields\":[{\"key\":\"Bad Key\",\"label\":\"x\",\"type\":\"TEXT\",\"required\":false}]}"))
                .andExpect(status().isBadRequest()).andReturn();
        assertThat(read(bad).get("errors").has("fields[0].key")).isTrue();
        JsonNode type = read(mvc.perform(post("/api/settings/document-types").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("code", "note", "name", "Note interne", "defaultRetentionRuleId", ruleId,
                                "fields", List.of(Map.of("key", "auteur", "label", "Auteur", "type", "TEXT", "required", true))))))
                .andExpect(status().isCreated()).andReturn());
        assertThat(type.get("code").asString()).isEqualTo("NOTE");

        // Le nouveau type sert au classement ; une règle utilisée ne peut plus être supprimée
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/settings/retention-rules/" + ruleId)
                .header("Authorization", auth)).andExpect(status().isConflict());

        // Rôle et utilisateur ; le nouveau compte peut se connecter
        JsonNode role = read(mvc.perform(post("/api/settings/roles").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Lecteur audit\",\"permissions\":[\"audit.read\"]}"))
                .andExpect(status().isCreated()).andReturn());
        mvc.perform(post("/api/settings/users").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"Nouveau@Exemple.com\",\"fullName\":\"N. Nouveau\",\"password\":\"court\",\"roleIds\":[]}"))
                .andExpect(status().isBadRequest());
        JsonNode user = read(mvc.perform(post("/api/settings/users").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", "Nouveau@Exemple.com", "fullName", "N. Nouveau",
                                "password", "un-mot-de-passe-long", "roleIds", List.of(role.get("id").asString())))))
                .andExpect(status().isCreated()).andReturn());
        assertThat(user.get("email").asString()).isEqualTo("nouveau@exemple.com");
        MvcResult newLogin = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nouveau@exemple.com\",\"password\":\"un-mot-de-passe-long\"}"))
                .andExpect(status().isOk()).andReturn();
        String newToken = "Bearer " + read(newLogin).get("accessToken").asString();
        mvc.perform(get("/api/audit").header("Authorization", newToken)).andExpect(status().isOk());
        mvc.perform(get("/api/settings/users").header("Authorization", newToken)).andExpect(status().isForbidden());

        // Garde-fous : pas de désactivation de son propre compte, toujours un administrateur actif
        JsonNode users = read(mvc.perform(get("/api/settings/users").header("Authorization", auth)).andReturn());
        JsonNode me = users.valueStream().filter(u -> u.get("email").asString().equals("admin@exemple.com")).findFirst().orElseThrow();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/settings/users/" + me.get("id").asString())
                        .header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Administrateur\",\"active\":false,\"roleIds\":[]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/settings/users/" + me.get("id").asString())
                        .header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Administrateur\",\"active\":true,\"roleIds\":[]}"))
                .andExpect(status().isConflict());

        // Tags : création puis fusion (les documents passent au tag conservé)
        JsonNode tags = read(mvc.perform(get("/api/settings/tags").header("Authorization", auth)).andReturn());
        JsonNode maintenance = tags.valueStream().filter(t -> t.get("name").asString().equals("maintenance")).findFirst().orElseThrow();
        JsonNode entretien = read(mvc.perform(post("/api/settings/tags").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Entretien\",\"color\":\"#1E7A4F\"}"))
                .andExpect(status().isCreated()).andReturn());
        JsonNode merged = read(mvc.perform(post("/api/settings/tags/merge").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("sourceId", maintenance.get("id").asString(),
                                "targetId", entretien.get("id").asString()))))
                .andExpect(status().isOk()).andReturn());
        assertThat(merged.get("name").asString()).isEqualTo("entretien");
        assertThat(merged.get("documentCount").asLong()).isEqualTo(maintenance.get("documentCount").asLong());

        // La chaîne d'audit reste intacte après toutes ces modifications
        assertThat(read(mvc.perform(get("/api/audit/verify").header("Authorization", auth)).andReturn()).get("valid").asBoolean()).isTrue();
    }

    @Test
    void archivesPhysiquesNiveauxEmplacementsRangementPrets() throws Exception {
        String auth = bearer(login("admin@exemple.com"));
        var put = (java.util.function.Function<String, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder>)
                url -> org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(url).header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON);

        JsonNode levels = read(mvc.perform(get("/api/physical/levels").header("Authorization", auth)).andExpect(status().isOk()).andReturn());
        String batiment = idOf(levels, "BATIMENT");
        String boite = idOf(levels, "BOITE");
        JsonNode tree = read(mvc.perform(get("/api/physical/locations").header("Authorization", auth)).andReturn());
        String b112 = idOf(tree, "B-112");
        String siege = idOf(tree, "SIEGE");
        String armoire = idOf(tree, "ARM-A3");
        String s205 = idOf(tree, "S-205");
        String etagere = idOf(tree, "ARM-A3-E2");
        long docsInB112 = tree.valueStream().filter(n -> n.get("code").asString().equals("B-112")).findFirst().orElseThrow()
                .get("documentCount").asLong();
        assertThat(docsInB112).isGreaterThanOrEqualTo(2);

        // Règles de la société : pas de boîte directement dans un bâtiment, pas de boucle entre niveaux
        mvc.perform(post("/api/physical/locations").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("parentId", siege, "levelId", boite, "code", "B-X", "label", "Boîte X"))))
                .andExpect(status().isBadRequest());
        mvc.perform(put.apply("/api/physical/levels/" + boite + "/children")
                        .content(json.writeValueAsString(Map.of("childLevelIds", List.of(batiment)))))
                .andExpect(status().isBadRequest());

        // Déplacement de l'armoire : le chemin de ses boîtes et de leurs documents suit
        mvc.perform(post("/api/physical/locations/" + armoire + "/move").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"newParentId\":\"" + s205 + "\"}"))
                .andExpect(status().isOk());
        JsonNode box = read(mvc.perform(get("/api/physical/locations/" + b112).header("Authorization", auth)).andReturn());
        assertThat(box.get("path").asString()).isEqualTo("Siège › Étage 2 › Salle 205 › Armoire A3 › Étagère 2 › Boîte B-112");

        JsonNode inBox = read(mvc.perform(get("/api/documents").param("locationId", s205).header("Authorization", auth)).andReturn());
        assertThat(inBox.get("totalElements").asLong()).isGreaterThanOrEqualTo(docsInB112);
        String docId = inBox.get("content").get(0).get("id").asString();
        JsonNode doc = read(mvc.perform(get("/api/documents/" + docId).header("Authorization", auth)).andReturn());
        assertThat(doc.get("physicalLocation").get("path").asString()).contains("Salle 205");

        // Un document ne se range que dans un niveau qui reçoit des documents
        mvc.perform(put.apply("/api/documents/" + docId + "/location").content("{\"locationId\":\"" + etagere + "\"}"))
                .andExpect(status().isBadRequest());

        // Prêt de la boîte : chaque document la contenant est « en prêt », un second prêt est refusé
        JsonNode loan = read(mvc.perform(post("/api/physical/loans").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("locationId", b112, "borrower", "Service juridique",
                                "reason", "Contrôle", "dueAt", java.time.LocalDate.now().plusDays(7).toString()))))
                .andExpect(status().isCreated()).andReturn());
        assertThat(loan.get("documentCount").asLong()).isEqualTo(docsInB112);
        mvc.perform(post("/api/physical/loans").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("locationId", b112, "borrower", "Autre",
                                "dueAt", java.time.LocalDate.now().plusDays(7).toString()))))
                .andExpect(status().isConflict());
        JsonNode onLoan = read(mvc.perform(get("/api/documents/" + docId).header("Authorization", auth)).andReturn());
        assertThat(onLoan.get("openLoan").get("viaBox").asBoolean()).isTrue();

        mvc.perform(post("/api/physical/loans/" + loan.get("id").asString() + "/return").header("Authorization", auth))
                .andExpect(status().isOk());
        JsonNode back = read(mvc.perform(get("/api/documents/" + docId).header("Authorization", auth)).andReturn());
        assertThat(back.get("openLoan").isNull()).isTrue();

        JsonNode events = read(mvc.perform(get("/api/documents/" + docId + "/events").header("Authorization", auth)).andReturn());
        assertThat(events.valueStream().map(e -> e.get("type").asString())).contains("RANGE", "DEPLACE", "ORIGINAL_SORTI", "ORIGINAL_RENDU");

        // Un comptable consulte mais ne modifie pas les emplacements
        String comptable = bearer(login("k.benali@exemple.com"));
        mvc.perform(get("/api/physical/locations").header("Authorization", comptable)).andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/physical/locations/" + b112)
                .header("Authorization", comptable)).andExpect(status().isForbidden());

        assertThat(read(mvc.perform(get("/api/audit/verify").header("Authorization", auth)).andReturn()).get("valid").asBoolean()).isTrue();
    }

    @Test
    void stockageMinioEtatEtControleDIntegrite() throws Exception {
        String admin = bearer(login("admin@exemple.com"));

        JsonNode s = read(mvc.perform(get("/api/settings/storage").header("Authorization", admin))
                .andExpect(status().isOk()).andReturn());
        assertThat(s.get("type").asString()).isEqualTo("s3");
        assertThat(s.get("bucket").asString()).isEqualTo("ged-test");
        assertThat(s.get("reachable").asBoolean()).isTrue();
        assertThat(s.get("consoleUrl").asString()).isEqualTo("http://localhost:9001");
        assertThat(s.get("usage").get("versions").asLong()).isPositive();
        assertThat(s.get("usage").get("bytesByType").has("application/pdf")).isTrue();

        // Les fichiers de démonstration sont dans le bucket, avec la taille enregistrée en base
        JsonNode check = read(mvc.perform(post("/api/settings/storage/check").header("Authorization", admin))
                .andExpect(status().isOk()).andReturn());
        assertThat(check.get("healthy").asBoolean()).isTrue();
        assertThat(check.get("missingCount").asInt()).isZero();
        assertThat(check.get("ok").asInt()).isEqualTo(check.get("expected").asInt()).isPositive();

        // Réservé au paramétrage
        String comptable = bearer(login("k.benali@exemple.com"));
        mvc.perform(get("/api/settings/storage").header("Authorization", comptable)).andExpect(status().isForbidden());
        mvc.perform(post("/api/settings/storage/check").header("Authorization", comptable))
                .andExpect(status().isForbidden());

        mvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
    }

    @Test
    void cycleDeVieGelBordereauxVisaEtExecution() throws Exception {
        String admin = bearer(login("admin@exemple.com"));
        String archiviste = bearer(login("s.amrani@exemple.com"));
        String juriste = bearer(login("y.tazi@exemple.com"));
        String comptable = bearer(login("k.benali@exemple.com"));

        // Réservé aux rôles du cycle de vie
        mvc.perform(get("/api/lifecycle/summary").header("Authorization", comptable)).andExpect(status().isForbidden());

        JsonNode summary = read(mvc.perform(get("/api/lifecycle/summary").header("Authorization", archiviste))
                .andExpect(status().isOk()).andReturn());
        assertThat(summary.get("awaitingVisa").asInt()).isEqualTo(1);
        assertThat(summary.get("activeHolds").asInt()).isEqualTo(1);

        JsonNode due = read(mvc.perform(get("/api/lifecycle/due?finalAction=DETRUIRE").header("Authorization", archiviste))
                .andExpect(status().isOk()).andReturn());
        String gardiennage = dueId(due, "Contrat de gardiennage du site");
        String energie = dueId(due, "Contrat de fourniture d'énergie");
        assertThat(byTitle(due, "Contrat de fourniture d'énergie").get("legalHold").asBoolean()).isTrue();
        assertThat(byTitle(due, "Contrat de nettoyage des locaux").get("pendingListNumber").asString()).startsWith("ELIM-");
        // Pas encore échu : absent de l'échéancier du jour
        assertThat(due.valueStream().map(d -> d.get("title").asString())).doesNotContain("Contrat de maintenance des ascenseurs");

        // Un document gelé ne peut pas être proposé à l'élimination
        mvc.perform(post("/api/lifecycle/lists").header("Authorization", archiviste).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"ELIMINATION\",\"title\":\"Test\",\"documentIds\":[\"" + energie + "\"]}"))
                .andExpect(status().isConflict());

        // ── Versement : préparé et soumis par l'administrateur, visé par la juriste ──
        JsonNode dueRh = read(mvc.perform(get("/api/lifecycle/due?finalAction=VERSER").header("Authorization", admin)).andReturn());
        String rh1 = dueId(dueRh, "Dossier de départ - agent administratif");
        String rh2 = dueId(dueRh, "Dossier de départ - technicien de maintenance");
        JsonNode vers = read(mvc.perform(post("/api/lifecycle/lists").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"VERSEMENT\",\"title\":\"Dossiers du personnel sortis\",\"destination\":\"Archives régionales\","
                                + "\"documentIds\":[\"" + rh1 + "\",\"" + rh2 + "\"]}"))
                .andExpect(status().isCreated()).andReturn());
        String versId = vers.get("list").get("id").asString();
        String versNumber = vers.get("list").get("number").asString();
        mvc.perform(post("/api/lifecycle/lists/" + versId + "/submit").header("Authorization", admin)).andExpect(status().isOk());
        // Quatre yeux : l'auteur ne vise pas son propre bordereau, même administrateur
        mvc.perform(post("/api/lifecycle/lists/" + versId + "/approve").header("Authorization", admin))
                .andExpect(status().isConflict());
        // Le paquet n'existe qu'après le visa
        mvc.perform(get("/api/lifecycle/lists/" + versId + "/package.zip").header("Authorization", admin))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/lifecycle/lists/" + versId + "/approve").header("Authorization", juriste)
                .contentType(MediaType.APPLICATION_JSON).content("{\"comment\":\"Vu\"}")).andExpect(status().isOk());
        MvcResult zip = mvc.perform(get("/api/lifecycle/lists/" + versId + "/package.zip").header("Authorization", admin))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.request().asyncStarted())
                .andReturn();
        MvcResult zipDone = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch(zip))
                .andExpect(status().isOk()).andReturn();
        List<String> entries = new java.util.ArrayList<>();
        try (var in = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(zipDone.getResponse().getContentAsByteArray()))) {
            for (var e = in.getNextEntry(); e != null; e = in.getNextEntry()) entries.add(e.getName());
        }
        assertThat(entries).contains("manifest.json").hasSize(3);
        mvc.perform(post("/api/lifecycle/lists/" + versId + "/execute").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"confirmNumber\":\"NON\"}")).andExpect(status().isBadRequest());
        JsonNode versDone = read(mvc.perform(post("/api/lifecycle/lists/" + versId + "/execute").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"confirmNumber\":\"" + versNumber + "\"}"))
                .andExpect(status().isOk()).andReturn());
        assertThat(versDone.get("list").get("status").asString()).isEqualTo("EXECUTE");
        assertThat(read(mvc.perform(get("/api/documents/" + rh1).header("Authorization", admin)).andReturn())
                .get("status").asString()).isEqualTo("VERSE");

        // ── Élimination de démonstration : soumise par l'archiviste, visée par la juriste, exécutée ──
        JsonNode lists = read(mvc.perform(get("/api/lifecycle/lists?status=open").header("Authorization", admin)).andReturn());
        JsonNode elim = lists.valueStream().filter(l -> l.get("kind").asString().equals("ELIMINATION")).findFirst().orElseThrow();
        String elimId = elim.get("id").asString();
        JsonNode elimDetail = read(mvc.perform(get("/api/lifecycle/lists/" + elimId).header("Authorization", admin)).andReturn());
        String eliminated = elimDetail.get("items").get(0).get("documentId").asString();
        // Proposé à l'élimination : le document est figé
        mvc.perform(post("/api/documents/" + eliminated + "/reclassify").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"nodeId\":\"" + UUID.randomUUID() + "\",\"reason\":\"x\"}"))
                .andExpect(status().is4xxClientError());
        mvc.perform(post("/api/lifecycle/lists/" + elimId + "/approve").header("Authorization", archiviste))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/lifecycle/lists/" + elimId + "/approve").header("Authorization", juriste))
                .andExpect(status().isOk());
        mvc.perform(post("/api/lifecycle/lists/" + elimId + "/execute").header("Authorization", archiviste)
                .contentType(MediaType.APPLICATION_JSON).content("{\"confirmNumber\":\"" + elim.get("number").asString() + "\"}"))
                .andExpect(status().isOk());

        JsonNode gone = read(mvc.perform(get("/api/documents/" + eliminated).header("Authorization", admin)).andReturn());
        assertThat(gone.get("status").asString()).isEqualTo("ELIMINE");
        assertThat(gone.get("lifecycle").get("disposedAt").isNull()).isFalse();
        mvc.perform(get("/api/documents/" + eliminated + "/versions/1/content").header("Authorization", admin))
                .andExpect(status().isGone());
        JsonNode events = read(mvc.perform(get("/api/documents/" + eliminated + "/events").header("Authorization", admin)).andReturn());
        assertThat(events.valueStream().map(e -> e.get("type").asString())).contains("SORT_PROPOSE", "ELIMINE");
        // Le contenu a bien été détruit dans MinIO (toutes versions) et le contrôle d'intégrité reste conforme
        JsonNode check = read(mvc.perform(post("/api/settings/storage/check").header("Authorization", admin)).andReturn());
        assertThat(check.get("residualCount").asInt()).isZero();
        assertThat(check.get("missingCount").asInt()).isZero();

        // ── Gel levé par la juriste : le contrat reprend son cycle de vie ──
        JsonNode holdsList = read(mvc.perform(get("/api/lifecycle/holds").header("Authorization", juriste)).andReturn());
        String holdId = holdsList.get(0).get("id").asString();
        mvc.perform(post("/api/lifecycle/holds/" + holdId + "/release").header("Authorization", juriste)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/lifecycle/holds/" + holdId + "/release").header("Authorization", juriste)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Jugement rendu\"}")).andExpect(status().isOk());
        assertThat(read(mvc.perform(get("/api/documents/" + energie).header("Authorization", admin)).andReturn())
                .get("legalHold").asBoolean()).isFalse();

        // Le gardiennage, resté libre, peut toujours être éliminé plus tard
        assertThat(gardiennage).isNotBlank();
        mvc.perform(post("/api/lifecycle/recalculate").header("Authorization", archiviste)).andExpect(status().isOk());
        assertThat(read(mvc.perform(get("/api/audit/verify").header("Authorization", admin)).andReturn()).get("valid").asBoolean()).isTrue();
    }

    private static JsonNode byTitle(JsonNode list, String title) {
        return list.valueStream().filter(n -> n.get("title").asString().equals(title)).findFirst().orElseThrow();
    }

    private static String dueId(JsonNode list, String title) {
        return byTitle(list, title).get("id").asString();
    }

    private static String idOf(JsonNode tree, String code) {
        return tree.valueStream().filter(n -> n.get("code").asString().equals(code)).findFirst().orElseThrow()
                .get("id").asString();
    }

    private static String sha256(byte[] b) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
    }
}
