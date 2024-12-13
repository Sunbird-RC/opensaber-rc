import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BlockchainAnchor } from '../interfaces/blockchain_anchor.interface';
import { AxiosResponse } from '@nestjs/terminus/dist/health-indicator/http/axios.interfaces';
import { IssueCredentialDTO } from '../dto/issue-credential.dto';
import { JwtCredentialSubject } from 'src/app.interface';
import { W3CCredential, Verifiable } from 'vc.types';

@Injectable()
export class AnchorCordService implements BlockchainAnchor {

  private readonly logger = new Logger(AnchorCordService.name);


  constructor(private readonly httpService: HttpService) {

  }

  async anchorCredential(issueRequest: IssueCredentialDTO): Promise<any> {
    try {
      const credInReq = issueRequest.credential;
      if (!issueRequest.credentialSchemaId) {

        this.logger.error('Credential SchemaId Schema ID is required for anchoring but is missing');
        throw new BadRequestException('Cord Schema ID is missing');
      }

      this.logger.debug('url', process.env.ISSUER_AGENT_BASE_URL);
      this.logger.debug('Anchoring unsigned credential to Cord blockchain with schema ID:', issueRequest.credentialSchemaId);
      const credentialPayload = {
        ...credInReq,
        schemaId: issueRequest.credentialSchemaId,
      }
      let anchorHttpResponse: AxiosResponse =
        await this.httpService.axiosRef.post(
          `${process.env.ISSUER_AGENT_BASE_URL}/cred`,
          {
            credential: credentialPayload,
          }
        );

      this.logger.debug('Credential successfully anchored');
      let anchoredResult = anchorHttpResponse.data.result;
      this.logger.debug('Credential successfully anchored to Cord:', anchoredResult);
      const {
        id, issuer, issuanceDate, validUntil: expirationDate, credentialSubject, proof,
      } = anchoredResult.vc;

      const anchoredCredentialData = {
        id,
        type: issueRequest.credential.type,
        issuer,
        issuanceDate,
        expirationDate,
        subject: credentialSubject,
        subjectId: (credentialSubject as JwtCredentialSubject).id,
        proof,
        credential_schema: issueRequest.credentialSchemaId,
        signed: anchoredResult.vc as object,
        tags: issueRequest.tags,
        blockchainStatus: "ANCHORED",

      };
      return anchoredCredentialData;
    } catch (err) {
      this.logger.error('Error anchoring credential:', err);

      throw new InternalServerErrorException(`Error anchoring credential : ${err.response.data.details}`);
    }
  }


  async verifyCredential(
    credToVerify: Verifiable<W3CCredential>
  ): Promise<any> {
    try {
      this.logger.debug(`${process.env.VERIFICATION_MIDDLEWARE_BASE_URL}/credentials/verify}`)
      const response = await this.httpService.axiosRef.post(
        `${process.env.VERIFICATION_MIDDLEWARE_BASE_URL}/credentials/verify`,
        credToVerify
      );

      if (response.status !== 200) {
        this.logger.error('Cord verification failed:', response.data);
        throw new InternalServerErrorException('Cord verification failed');
      }

      return response.data;
    } catch (err) {
      this.logger.error('Error calling Cord verification API:', err);
      throw new InternalServerErrorException(
        'Error verifying credential on Cord'
      );
    }
  }

}
