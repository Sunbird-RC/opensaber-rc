package dev.sunbirdrc.registry.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.sunbirdrc.registry.middleware.util.Constants;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(SpringExtension.class)
@SpringBootTest(classes = {OSSystemFieldsHelper.class, DefinitionsManager.class, OSResourceLoader.class, ObjectMapper.class})
@ActiveProfiles(Constants.TEST_ENVIRONMENT)
class OSSystemFieldsHelperTest {

    @Autowired
    private OSSystemFieldsHelper systemFieldsHelper;

    private final ObjectMapper mapper = new ObjectMapper();

    private String entityType;

    @BeforeEach
    void init() {
        JsonNode testNode = getTestNode();
        entityType = testNode.fieldNames().next();
    }

    private JsonNode getTestNode() {
        ObjectNode testNode = JsonNodeFactory.instance.objectNode();
        try {
            testNode = (ObjectNode) mapper.readTree(
                    "{\"Teacher\":{\"osid\":\"1-09cc3c81-6180-4e74-aba9-f015bbaa95f1\",\"basicProficiencyLevel\":[{\"osid\":\"1-1a496e91-7886-44e2-abfa-1a40c3337d1e\"}],\"childObj\":{\"osid\":\"1-4a497b91-7886-44e2-abfa-1a40c3337d1f\"}}}");
        } catch (IOException e) {
            // let the test fail with null
        }
        return testNode;
    }

    @Test
    void testAddSystemPropertyNotValid() {
        JsonNode testNode = getTestNode();
        JsonNode node = testNode.get(entityType);

        try {
            systemFieldsHelper.addSystemProperty("notValid", node, "userId", "timeStamp", true);
        } catch (Exception e) {
            org.junit.jupiter.api.Assertions.fail("Exception " + e);
        }
    }

    @Test
    void testAddSystemPropertyCreatedAt() throws IOException {
        JsonNode testNode = getTestNode();
        JsonNode node = testNode.get(entityType);

        systemFieldsHelper.addSystemProperty("osCreatedAt", node, "userId", "timeStamp", true);

        String expected = "{\"osid\":\"1-09cc3c81-6180-4e74-aba9-f015bbaa95f1\",\"basicProficiencyLevel\":[{\"osid\":\"1-1a496e91-7886-44e2-abfa-1a40c3337d1e\",\"osCreatedAt\":\"timeStamp\"}],\"childObj\":{\"osid\":\"1-4a497b91-7886-44e2-abfa-1a40c3337d1f\",\"osCreatedAt\":\"timeStamp\"},\"osCreatedAt\":\"timeStamp\"}";
        ObjectNode expectedNode = (ObjectNode) mapper.readTree(expected);

        assertEquals(expectedNode, node);
    }

    @Test
    void testAddSystemPropertyCreatedBy() throws IOException {
        JsonNode testNode = getTestNode();
        JsonNode node = testNode.get(entityType);

        systemFieldsHelper.addSystemProperty("osCreatedBy", node, "userId", "timeStamp", true);

        String expected = "{\"osid\":\"1-09cc3c81-6180-4e74-aba9-f015bbaa95f1\",\"basicProficiencyLevel\":[{\"osid\":\"1-1a496e91-7886-44e2-abfa-1a40c3337d1e\",\"osCreatedBy\":\"userId\"}],\"childObj\":{\"osid\":\"1-4a497b91-7886-44e2-abfa-1a40c3337d1f\",\"osCreatedBy\":\"userId\"},\"osCreatedBy\":\"userId\"}";
        ObjectNode expectedNode = (ObjectNode) mapper.readTree(expected);

        assertEquals(expectedNode, node);
    }

    @Test
    void testAddSystemPropertyUpdatedAt() throws IOException {
        JsonNode testNode = getTestNode();
        JsonNode node = testNode.get(entityType);

        systemFieldsHelper.addSystemProperty("osUpdatedAt", node, "userId", "timeStamp", false);

        String expected = "{\"osid\":\"1-09cc3c81-6180-4e74-aba9-f015bbaa95f1\",\"basicProficiencyLevel\":[{\"osid\":\"1-1a496e91-7886-44e2-abfa-1a40c3337d1e\",\"osUpdatedAt\":\"timeStamp\"}],\"childObj\":{\"osid\":\"1-4a497b91-7886-44e2-abfa-1a40c3337d1f\",\"osUpdatedAt\":\"timeStamp\"},\"osUpdatedAt\":\"timeStamp\"}";
        ObjectNode expectedNode = (ObjectNode) mapper.readTree(expected);

        assertEquals(expectedNode, node);
    }

    @Test
    void testAddSystemPropertyUpdatedBy() throws IOException {
        JsonNode testNode = getTestNode();
        String key = testNode.fieldNames().next();
        JsonNode node = testNode.get(key);

        systemFieldsHelper.addSystemProperty("osUpdatedBy", node, "userId", "timeStamp", false);

        String expected = "{\"osid\":\"1-09cc3c81-6180-4e74-aba9-f015bbaa95f1\",\"basicProficiencyLevel\":[{\"osid\":\"1-1a496e91-7886-44e2-abfa-1a40c3337d1e\",\"osUpdatedBy\":\"userId\"}],\"childObj\":{\"osid\":\"1-4a497b91-7886-44e2-abfa-1a40c3337d1f\",\"osUpdatedBy\":\"userId\"},\"osUpdatedBy\":\"userId\"}";
        ObjectNode expectedNode = (ObjectNode) mapper.readTree(expected);

        assertEquals(expectedNode, node);
    }
}