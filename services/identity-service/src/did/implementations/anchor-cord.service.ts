import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BlockchainAnchor } from '../interfaces/blockchain_anchor.interface';
import {BadRequestException} from '@nestjs/common';
@Injectable()
export class AnchorCordService implements BlockchainAnchor {
  private readonly logger = new Logger(AnchorCordService.name);

  constructor(private readonly httpService: HttpService) {}

  async anchorDid(body: any): Promise<{ document: any; mnemonic: string; delegateKeys: object }> {
    try {
      if (body.method !== 'cord') {
          throw new BadRequestException('Invalid method: only "cord" is allowed for anchoring to Cord.');
          }
      const response = await this.httpService.axiosRef.post(
        `${process.env.ISSUER_AGENT_BASE_URL}/did/create/`,
        body,
      );
      return response.data.result;
    } catch (err) {
      this.logger.error('Error anchoring DID to CORD blockchain', err);
      throw new InternalServerErrorException('Failed to anchor DID to CORD blockchain');
    }
  }
}
