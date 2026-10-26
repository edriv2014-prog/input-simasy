import { Module } from '@nestjs/common';
import { KtpController } from './ktp.controller';
import { KtpService } from './ktp.service';
@Module({controllers:[KtpController], providers:[KtpService]}) export class KtpModule {}
