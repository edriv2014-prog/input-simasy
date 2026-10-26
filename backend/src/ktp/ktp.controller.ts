import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KtpService } from './ktp.service';
@Controller('ktp') export class KtpController{
  constructor(private svc:KtpService){}
  @Post('upload') @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file:Express.Multer.File){ return this.svc.process(file); }
}
