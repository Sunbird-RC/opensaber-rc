import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CredentialsModule } from './credentials/credentials.module';
import { HealthCheckService, TerminusModule } from '@nestjs/terminus';
import { HealthCheckUtilsService } from './credentials/utils/healthcheck.utils.service';
import { PrismaClient } from '@prisma/client';
import { RevocationList } from './revocation-list/revocation-list.helper';
import { RevocationListImpl } from './revocation-list/revocation-list.impl';
import { RevocationListService } from './revocation-list/revocation-list.service';
import { RevocationListModule } from './revocation-list/revocation-list.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({ isGlobal: true }),
    CredentialsModule,
    TerminusModule,
    RevocationListModule,
  ],
  controllers: [AppController],
  providers: [  AppService, ConfigService, PrismaClient, HealthCheckUtilsService, RevocationList, RevocationListImpl, RevocationListService],
})
export class AppModule {}
