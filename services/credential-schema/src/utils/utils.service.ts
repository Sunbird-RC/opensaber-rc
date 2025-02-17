import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

@Injectable()
export class UtilsService {
  constructor(private readonly httpService: HttpService) {}
  private logger = new Logger(UtilsService.name);
  async sign(did: string, body: any) {
    try {
      const signedVCResponse = await this.httpService.axiosRef.post(
        `${process.env.IDENTITY_BASE_URL}/utils/sign`,
        {
          DID: did,
          payload: body,
        },
      );
      return signedVCResponse.data;
    } catch (err) {
      this.logger.error(err, err.response?.data);
      throw new HttpException("Couldn't sign the schema", 500);
    }
  }

  async generateDID(body: any) {
    try {
      const did = await this.httpService.axiosRef.post(
        `${process.env.IDENTITY_BASE_URL}/did/generate`,
        body,
      );
      return did.data[0];
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('Can not generate a new DID');
    }
  }

}
