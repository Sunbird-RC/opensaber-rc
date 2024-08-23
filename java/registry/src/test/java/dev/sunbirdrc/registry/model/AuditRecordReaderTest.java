package dev.sunbirdrc.registry.model;

import dev.sunbirdrc.pojos.AuditRecord;
import dev.sunbirdrc.registry.authorization.pojos.AuthInfo;
import dev.sunbirdrc.registry.config.GenericConfiguration;
import dev.sunbirdrc.registry.exception.audit.LabelCannotBeNullException;
import dev.sunbirdrc.registry.middleware.util.Constants;
import dev.sunbirdrc.registry.sink.DatabaseProvider;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversal;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource;
import org.apache.tinkerpop.gremlin.structure.Graph;
import org.apache.tinkerpop.gremlin.structure.Vertex;
import org.apache.tinkerpop.gremlin.structure.VertexProperty;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SpringBootTest(classes = { Environment.class, GenericConfiguration.class, AuditRecordReader.class })
@ActiveProfiles(Constants.TEST_ENVIRONMENT)
public class AuditRecordReaderTest {

    @Mock
    private DatabaseProvider databaseProviderMock;
    @Autowired
    @InjectMocks
    private AuditRecordReader auditRecordReader;
    private Graph graphMock;
    private GraphTraversalSource graphTraversalSourceMock;
    private GraphTraversalSource graphTraversalSourceCloneMock;
    private GraphTraversal VMock;
    @Value("${registry.system.base}")
    private String registrySystemContext;
    private GraphTraversal hasLabelMock;
    private GraphTraversal traversalMock;
    private AuthInfo authInfo;

    @BeforeEach
    public void setUp() throws Exception {
		this.graphMock = mock(Graph.class);
		this.graphTraversalSourceMock = mock(GraphTraversalSource.class);
		this.graphTraversalSourceCloneMock = mock(GraphTraversalSource.class);
		this.VMock = mock(GraphTraversal.class);
		this.hasLabelMock = mock(GraphTraversal.class);
		this.traversalMock = mock(GraphTraversal.class);
		this.authInfo = mock(AuthInfo.class);
		when(databaseProviderMock.getGraphStore()).thenReturn(graphMock);
		when(graphMock.traversal()).thenReturn(graphTraversalSourceMock);
		when(graphTraversalSourceMock.clone()).thenReturn(graphTraversalSourceCloneMock);
		when(graphTraversalSourceCloneMock.V()).thenReturn(VMock);
    }

    @AfterEach
    public void tearDown() throws Exception {
        // Teardown code
    }

    @Test
    public void testNullLabel() throws LabelCannotBeNullException {
		auditRecordReader.fetchAuditRecords(null, null);
    }

    @Test
    public void testFetchingUnMatchedLabel() throws LabelCannotBeNullException {
		when(VMock.hasLabel("X-AUDIT")).thenReturn(hasLabelMock);
		when(hasLabelMock.out(registrySystemContext + "audit")).thenReturn(traversalMock);
		when(traversalMock.hasNext()).thenReturn(false);
		List<AuditRecord> auditRecords = auditRecordReader.fetchAuditRecords("X", null);
		assertNotNull(auditRecords);
		assertEquals(0, auditRecords.size());
    }

    @Test
    public void testSingleAuditRecordMatch() throws LabelCannotBeNullException {
		when(VMock.hasLabel("X-AUDIT")).thenReturn(hasLabelMock);
		when(hasLabelMock.out(registrySystemContext + "audit")).thenReturn(traversalMock);
		Vertex auditVertex1 = mock(Vertex.class);
		VertexProperty predicate1 = mock(VertexProperty.class);
		VertexProperty oldObject1 = mock(VertexProperty.class);
		VertexProperty newObject1 = mock(VertexProperty.class);
		VertexProperty authInfo1 = mock(VertexProperty.class);
		when(auditVertex1.property(registrySystemContext + "predicate")).thenReturn(predicate1);
		when(predicate1.isPresent()).thenReturn(true);
		when(predicate1.value()).thenReturn(registrySystemContext + "PREDICATE1");
		when(auditVertex1.property(registrySystemContext + "oldObject")).thenReturn(oldObject1);
		when(oldObject1.isPresent()).thenReturn(true);
		when(oldObject1.value()).thenReturn(registrySystemContext + "OLDOBJECT1");
		when(auditVertex1.property(registrySystemContext + "newObject")).thenReturn(newObject1);
		when(newObject1.isPresent()).thenReturn(true);
		when(newObject1.value()).thenReturn(registrySystemContext + "NEWOBJECT1");
		when(auditVertex1.property(registrySystemContext + "authInfo")).thenReturn(authInfo1);
		when(authInfo1.isPresent()).thenReturn(true);
		when(authInfo1.value()).thenReturn("AUTHINFO1");
		when(traversalMock.hasNext()).thenReturn(true, false);
		when(traversalMock.next()).thenReturn(auditVertex1);
		List<AuditRecord> auditRecords = auditRecordReader.fetchAuditRecords("X", null);
		assertEquals(1, auditRecords.size());
		AuditRecord record = auditRecords.get(0);
		/*assertEquals(record.getSubject(), "X-AUDIT");
		assertEquals(record.getPredicate(), registrySystemContext + "PREDICATE1");
		assertEquals(record.getOldObject(), registrySystemContext + "OLDOBJECT1");
		assertEquals(record.getNewObject(), registrySystemContext + "NEWOBJECT1");*/
    }

    @Test
    public void testPredicateButNoMatch() throws LabelCannotBeNullException {
		when(VMock.hasLabel("X-AUDIT")).thenReturn(hasLabelMock);
        GraphTraversal tempTraversalMock = mock(GraphTraversal.class);
        when(hasLabelMock.out(registrySystemContext + "audit")).thenReturn(tempTraversalMock);
        when(tempTraversalMock.has(registrySystemContext + "predicate", "P")).thenReturn(traversalMock);
        List<AuditRecord> auditRecords = auditRecordReader.fetchAuditRecords("X", "P");
        when(traversalMock.hasNext()).thenReturn(false);
        assertEquals(0, auditRecords.size());
    }

    @Test
    public void testPredicateMatchButOneRecord() throws LabelCannotBeNullException {
        when(VMock.hasLabel("X-AUDIT")).thenReturn(hasLabelMock);
        GraphTraversal tempTraversalMock = mock(GraphTraversal.class);
        when(hasLabelMock.out(registrySystemContext + "audit")).thenReturn(tempTraversalMock);
        when(tempTraversalMock.has(registrySystemContext + "predicate", "PREDICATE1")).thenReturn(traversalMock);
        Vertex auditVertex1 = mock(Vertex.class);
        VertexProperty predicate1 = mock(VertexProperty.class);
        VertexProperty oldObject1 = mock(VertexProperty.class);
        VertexProperty newObject1 = mock(VertexProperty.class);
        VertexProperty authInfo1 = mock(VertexProperty.class);
        when(auditVertex1.property(registrySystemContext + "predicate")).thenReturn(predicate1);
        when(predicate1.isPresent()).thenReturn(true);
        when(predicate1.value()).thenReturn(registrySystemContext + "PREDICATE1");
        when(auditVertex1.property(registrySystemContext + "oldObject")).thenReturn(oldObject1);
        when(oldObject1.isPresent()).thenReturn(true);
        when(oldObject1.value()).thenReturn(registrySystemContext + "OLDOBJECT1");
        when(auditVertex1.property(registrySystemContext + "newObject")).thenReturn(newObject1);
        when(newObject1.isPresent()).thenReturn(true);
        when(newObject1.value()).thenReturn(registrySystemContext + "NEWOBJECT1");
        when(auditVertex1.property(registrySystemContext + "authInfo")).thenReturn(authInfo1);
        when(authInfo1.isPresent()).thenReturn(true);
        when(authInfo1.value()).thenReturn(registrySystemContext + "AUTHINFO1");
        when(traversalMock.hasNext()).thenReturn(true, false);
        when(predicate1.isPresent()).thenReturn(true);
        when(traversalMock.next()).thenReturn(auditVertex1);
        List<AuditRecord> auditRecords = auditRecordReader.fetchAuditRecords("X", "PREDICATE1");
        assertEquals(1, auditRecords.size());
    }
}