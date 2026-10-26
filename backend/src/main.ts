import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
async function bootstrap(){
  const app=await NestFactory.create(AppModule);
  app.enableCors({origin:true});
  await app.listen(process.env.PORT||3001);
  return app.getHttpAdapter().getInstance();
}
export default bootstrap();
if(require.main===module){ bootstrap(); }
