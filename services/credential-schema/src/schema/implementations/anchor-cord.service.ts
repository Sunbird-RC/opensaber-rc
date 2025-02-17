import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BlockchainAnchor } from '../interfaces/blockchain_anchor.interface';
import {BadRequestException} from '@nestjs/common';
@Injectable()
export class AnchorCordService implements BlockchainAnchor {
  private readonly logger = new Logger(AnchorCordService.name);

  constructor(private readonly httpService: HttpService) {}

  async anchorSchema(body: any): Promise<any> {
    try {
      const response = await this.httpService.axiosRef.post(
        `${process.env.ISSUER_AGENT_BASE_URL}/schema`,
        body,
      );
      return response.data;
    } catch (err) {
      const errorDetails = {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        headers: err.response?.headers,
        request: err.config,
      };

      this.logger.error(
        'Error anchoring schema to Cord blockchain',
        errorDetails,
      );
      throw new InternalServerErrorException(
        'Failed to anchor schema to Cord blockchain',
      );
    }
  }
}
