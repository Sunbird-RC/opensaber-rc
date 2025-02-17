import { randomUUID } from 'crypto';
import { CreateCredentialDTO } from './dto/create-credentials.dto';
import { VerifiableCredentialSchema } from '@prisma/client';

export const generateCredentialSchemaTestBody = (): CreateCredentialDTO => {
  return {
    schema: {
      type: 'https://w3c-ccg.github.io/vc-json-schemas/',
      version: '1.0.0',
      id: `${randomUUID()}`,
      name: 'Proof of Academic Evaluation Credential',
      author: 'did:rcw:82f1ef57-3969-42db-9ef3-a477f5f7b010',
      authored: '2022-12-19T09:22:23.064Z',
      schema: {
        $id: 'Proof-of-Academic-Evaluation-Credential-1.0',
        $schema: 'https://json-schema.org/draft/2019-09/schema',
        description:
          'The holder has secured the <PERCENTAGE/GRADE> in <PROGRAMME> from <ABC_Institute>.',
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Grade (%age, GPA, etc.) secured by the holder.',
          },
          programme: {
            type: 'string',
            description: 'Name of the programme pursed by the holder.',
          },
          certifyingInstitute: {
            type: 'string',
            description:
              'Name of the instute which certified the said grade in the said skill',
          },
          evaluatingInstitute: {
            type: 'string',
            description:
              'Name of the institute which ran the programme and evaluated the holder.',
          },
        },
        required: [
          'grade',
          'programme',
          'certifyingInstitute',
          'evaluatingInstitute',
        ],
        additionalProperties: true,
      },
    },
    tags: ['tag1', 'tag2'],
    status: 'DRAFT',
  };
};

export const generateTestDIDBody = () => {
  return {
    content: [
      {
        alsoKnownAs: ['testDID'],
        services: [
          {
            id: 'CredentialSchemaService',
            type: 'CredentialSchema',
          },
        ],
        method: 'schema',
      },
    ],
  };
};

export const testSchemaRespose1: VerifiableCredentialSchema = {
  id: 'schema-id',
  type: 'UniversityDegreeCredential',
  version: '1.0.0',
  name: 'Bachelor of Science in Computer Science',
  author: 'University A',
  authored: new Date('2023-01-01'),
  schema: { title: 'B.Sc. Computer Science', properties: { gpa: { type: 'number' } } },
  proof: { type: 'Ed25519Signature2020', created: '2023-01-01T00:00:00Z', verificationMethod: 'did:example:123#key-1', proofPurpose: 'assertionMethod', jws: 'eyJhbGciOiJFZERTQSJ9..CLcx8u6ljgfhHGghjGFDhfghg' },
  createdAt: new Date('2023-01-01T00:00:00Z'),
  updatedAt: new Date('2023-01-01T00:00:00Z'),
  createdBy: 'admin',
  updatedBy: 'admin',
  deletedAt: null,
  tags: ['degree', 'computer science', 'bachelor'],
  status: 'DRAFT',
  deprecatedId: null,
  blockchainStatus: null
};

export const testSchemaRespose2: VerifiableCredentialSchema = {
  id: 'schema-id',
  type: 'ProfessionalCertification',
  version: '1.1.0',
  name: 'Certified Blockchain Expert',
  author: 'Blockchain Institute',
  authored: new Date('2023-02-01'),
  schema: { title: 'Blockchain Certification', properties: { certificationId: { type: 'string' }, issuedDate: { type: 'string' } } },
  proof: { type: 'Ed25519Signature2020', created: '2023-02-01T00:00:00Z', verificationMethod: 'did:example:456#key-1', proofPurpose: 'assertionMethod', jws: 'eyJhbGciOiJFZERTQSJ9..mHkj8oOlgfhHGghjGFDhfghg' },
  createdAt: new Date('2023-02-01T00:00:00Z'),
  updatedAt: new Date('2023-02-01T00:00:00Z'),
  createdBy: 'admin',
  updatedBy: 'admin',
  deletedAt: null,
  tags: ['certification', 'blockchain', 'expert'],
  status: 'DRAFT',
  deprecatedId: null,
  blockchainStatus: null, 
};